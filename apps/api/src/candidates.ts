import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { candidates, jobs, jobInterviewSteps, candidateStepResults } from './schema';
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { scoreCandidate, extractCvMetadata } from './services/gemini';
import {
  bufferToFloat32,
  embedDocument,
  embedQuery,
  float32ToBuffer,
  hasEmbeddingConfig,
  maxSimilarityToQuery,
} from './services/embeddings';
import { extractTextFromCvBytes } from './services/cvParse';

const sqlite = new Database('dev.db');
const db = drizzle(sqlite);

type CandidateRow = typeof candidates.$inferSelect;

/** API-safe row (no embedding blobs). */
function publicCandidate(row: CandidateRow, extra?: { matchScore?: number }) {
  const { cvEmbedding: _c, notesEmbedding: _n, ...rest } = row;
  return {
    ...rest,
    ...(extra?.matchScore != null ? { matchScore: Math.round(extra.matchScore * 1000) / 1000 } : {}),
  };
}

async function persistNotesEmbedding(candidateId: number, row: { notes: string | null; strengths: string[] | string | null; weaknesses: string[] | string | null }) {
  if (!hasEmbeddingConfig()) return;
  const parts: string[] = [];
  if (row.notes?.trim()) parts.push(row.notes.trim());
  const str = (v: string[] | string | null) =>
    Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '';
  const s = str(row.strengths);
  const w = str(row.weaknesses);
  if (s) parts.push(`Strengths: ${s}`);
  if (w) parts.push(`Weaknesses: ${w}`);
  const text = parts.join('\n');
  if (!text) {
    await db.update(candidates).set({ notesEmbedding: null }).where(eq(candidates.id, candidateId));
    return;
  }
  try {
    const vec = await embedDocument(text);
    await db
      .update(candidates)
      .set({ notesEmbedding: float32ToBuffer(vec) })
      .where(eq(candidates.id, candidateId));
  } catch (e) {
    console.error('notes embedding failed', e);
  }
}

/** Filter: token must match at least one searchable field. */
function matchSearchToken(token: string): SQL {
  const t = token.toLowerCase();
  return sql`(
    instr(lower(coalesce(${candidates.name}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.email}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.phone}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.location}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.headline}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.socialLinks}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.notes}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.transcript}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.resumeText}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.strengths}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.weaknesses}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.skillsTags}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.availability}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.experienceSummary}, '')), ${t}) > 0 OR
    instr(lower(coalesce(${candidates.educationSummary}, '')), ${t}) > 0
  )`;
}

/*
 * Relevance score per token.  Higher tiers → higher points so name/email
 * matches float to the top while deep-body matches (transcript, resume text)
 * still appear but further down.
 *
 *   Tier 1 (100): name, email
 *   Tier 2  (40): headline, phone, location, skillsTags
 *   Tier 3  (15): notes, strengths, weaknesses, socialLinks
 *   Tier 4   (5): transcript, resumeText, experienceSummary,
 *                  educationSummary, availability
 *
 * We sum across fields — intentionally additive so a token that appears in
 * both the name *and* the notes scores higher than just name alone.
 */
function relevanceForToken(token: string): SQL {
  const t = token.toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hit = (col: any, pts: number) =>
    sql`(CASE WHEN instr(lower(coalesce(${col}, '')), ${t}) > 0 THEN ${pts} ELSE 0 END)`;

  return sql`(
    ${hit(candidates.name, 100)} +
    ${hit(candidates.email, 100)} +
    ${hit(candidates.headline, 40)} +
    ${hit(candidates.phone, 40)} +
    ${hit(candidates.location, 40)} +
    ${hit(candidates.skillsTags, 40)} +
    ${hit(candidates.notes, 15)} +
    ${hit(candidates.strengths, 15)} +
    ${hit(candidates.weaknesses, 15)} +
    ${hit(candidates.socialLinks, 15)} +
    ${hit(candidates.transcript, 5)} +
    ${hit(candidates.resumeText, 5)} +
    ${hit(candidates.experienceSummary, 5)} +
    ${hit(candidates.educationSummary, 5)} +
    ${hit(candidates.availability, 5)}
  )`;
}

/** Sum relevance across all search tokens. */
function totalRelevanceScore(tokens: string[]): SQL {
  if (tokens.length === 0) return sql`0`;
  if (tokens.length === 1) return relevanceForToken(tokens[0]!);
  const parts = tokens.map((t) => relevanceForToken(t));
  return sql.join(parts, sql` + `);
}

/** App-side name/email boost for semantic-search blending. */
function computeNameEmailBoost(row: CandidateRow, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const name = (row.name ?? '').toLowerCase();
  const email = (row.email ?? '').toLowerCase();
  let score = 0;
  for (const tok of tokens) {
    const t = tok.toLowerCase();
    if (name.includes(t)) score += 100;
    if (email.includes(t)) score += 100;
  }
  return score;
}

/** Skill terms: each must appear in interview strengths or CV skill tags. */
function matchStrengthSkill(skill: string): SQL {
  const s = skill.trim().toLowerCase();
  return sql`(
    instr(lower(coalesce(${candidates.strengths}, '')), ${s}) > 0 OR
    instr(lower(coalesce(${candidates.skillsTags}, '')), ${s}) > 0
  )`;
}

export const candidatesController = new Hono();

candidatesController.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const jobId = Number(body.jobId);
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    if (!Number.isFinite(jobId) || !name || !email) {
      return c.json({ success: false, error: 'jobId, name, and email are required' }, 400);
    }

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) {
      return c.json({ success: false, error: 'Job not found' }, 404);
    }

    const transcript = body.transcript != null ? String(body.transcript) : null;
    const resumeText = body.resumeText != null ? String(body.resumeText).trim() || null : null;
    const liveObservations: string[] = Array.isArray(body.liveObservations)
      ? (body.liveObservations as unknown[]).filter((o): o is string => typeof o === 'string' && o.trim() !== '')
      : [];

    const jobStepIdRaw = body.jobStepId;
    const jobStepId =
      jobStepIdRaw != null && jobStepIdRaw !== '' ? Number(jobStepIdRaw) : null;
    const existingCandidateId =
      body.candidateId != null && body.candidateId !== '' ? Number(body.candidateId) : null;

    const pipelineStep =
      jobStepId != null && Number.isFinite(jobStepId) && jobStepId > 0 ? jobStepId : null;

    if (pipelineStep != null) {
      const transcriptText = transcript?.trim() ?? '';
      if (!transcriptText) {
        return c.json({ success: false, error: 'transcript is required for pipeline interview steps' }, 400);
      }
      const [stepRow] = await db
        .select()
        .from(jobInterviewSteps)
        .where(and(eq(jobInterviewSteps.id, pipelineStep), eq(jobInterviewSteps.jobId, jobId)))
        .limit(1);
      if (!stepRow) {
        return c.json({ success: false, error: 'Invalid jobStepId for this job' }, 400);
      }

      let candidateId = existingCandidateId;
      if (candidateId != null && Number.isFinite(candidateId)) {
        const [cand] = await db.select().from(candidates).where(eq(candidates.id, candidateId)).limit(1);
        if (!cand || cand.jobId !== jobId) {
          return c.json({ success: false, error: 'Invalid candidateId' }, 400);
        }
      } else {
        const [byEmail] = await db
          .select()
          .from(candidates)
          .where(and(eq(candidates.jobId, jobId), eq(candidates.email, email)))
          .limit(1);
        if (byEmail) {
          candidateId = byEmail.id;
        } else {
          const [created] = await db
            .insert(candidates)
            .values({
              jobId,
              name,
              email,
              status: 'pending',
              createdAt: new Date(),
            })
            .returning();
          candidateId = created!.id;
        }
      }

      const [existingSr] = await db
        .select()
        .from(candidateStepResults)
        .where(
          and(
            eq(candidateStepResults.candidateId, candidateId!),
            eq(candidateStepResults.stepId, pipelineStep),
          ),
        )
        .limit(1);

      if (existingSr) {
        await db
          .update(candidateStepResults)
          .set({ transcript: transcriptText })
          .where(eq(candidateStepResults.id, existingSr.id));
      } else {
        await db.insert(candidateStepResults).values({
          candidateId: candidateId!,
          stepId: pipelineStep,
          transcript: transcriptText,
          createdAt: new Date(),
        });
      }

      const pipeline = await db
        .select()
        .from(jobInterviewSteps)
        .where(eq(jobInterviewSteps.jobId, jobId))
        .orderBy(asc(jobInterviewSteps.stepOrder));
      const results = await db
        .select()
        .from(candidateStepResults)
        .where(eq(candidateStepResults.candidateId, candidateId!));

      const combined = pipeline
        .map((step) => {
          const r = results.find((x) => x.stepId === step.id);
          return r?.transcript ? `--- ${step.title} ---\n${r.transcript}` : '';
        })
        .filter(Boolean)
        .join('\n\n');

      const totalRow = await db
        .select({ totalSteps: count() })
        .from(jobInterviewSteps)
        .where(eq(jobInterviewSteps.jobId, jobId));
      const doneRow = await db
        .select({ doneSteps: count() })
        .from(candidateStepResults)
        .where(eq(candidateStepResults.candidateId, candidateId!));
      const totalSteps = totalRow[0]?.totalSteps ?? 0;
      const doneSteps = doneRow[0]?.doneSteps ?? 0;

      const allComplete = totalSteps > 0 && doneSteps >= totalSteps;

      let score: number | null = null;
      let notes: string | null = null;
      let strengths: string[] | undefined;
      let weaknesses: string[] | undefined;

      if (allComplete && combined) {
        try {
          const s = await scoreCandidate(combined, job.description, liveObservations);
          score = s.score;
          notes = s.notes;
          strengths = s.strengths;
          weaknesses = s.weaknesses;
        } catch {
          notes =
            'All interview rounds saved; configure GEMINI_API_KEY on the API for automatic scoring.';
        }
      }

      const [updated] = await db
        .update(candidates)
        .set({
          transcript: combined || null,
          score: score != null && !Number.isNaN(score) ? Math.round(score) : null,
          notes: notes ?? null,
          strengths: strengths ?? null,
          weaknesses: weaknesses ?? null,
          resumeText,
          status: allComplete ? 'interviewed' : 'pending',
        })
        .where(eq(candidates.id, candidateId!))
        .returning();

      if (updated) {
        await persistNotesEmbedding(updated.id, { notes: updated.notes, strengths: updated.strengths, weaknesses: updated.weaknesses });
      }

      return c.json({
        success: true,
        data: updated ? publicCandidate(updated) : null,
        meta: {
          allStepsComplete: allComplete,
          completedSteps: doneSteps,
          totalSteps,
        },
      });
    }

    let score = body.score != null ? Number(body.score) : null;
    let notes = body.notes != null ? String(body.notes) : null;
    let strengths = body.strengths as string[] | undefined;
    let weaknesses = body.weaknesses as string[] | undefined;

    if (transcript && (score == null || Number.isNaN(score))) {
      try {
        const s = await scoreCandidate(transcript, job.description, liveObservations);
        score = s.score;
        notes = s.notes;
        strengths = s.strengths;
        weaknesses = s.weaknesses;
      } catch {
        notes =
          notes ??
          'Interview saved; configure GEMINI_API_KEY on the API for automatic scoring.';
      }
    }

    const [row] = await db
      .insert(candidates)
      .values({
        jobId,
        name,
        email,
        score: score != null && !Number.isNaN(score) ? Math.round(score) : null,
        notes: notes ?? null,
        transcript,
        resumeText,
        strengths: strengths ?? null,
        weaknesses: weaknesses ?? null,
        status: body.status ?? 'interviewed',
        createdAt: new Date(),
      })
      .returning();

    if (row) {
      await persistNotesEmbedding(row.id, { notes: row.notes, strengths: row.strengths, weaknesses: row.weaknesses });
    }

    return c.json({ success: true, data: row ? publicCandidate(row) : null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Create failed';
    return c.json({ success: false, error: message }, 500);
  }
});

candidatesController.get('/', async (c) => {
  try {
    const jobIdStr = c.req.query('jobId');
    const projectIdStr = c.req.query('projectId');
    const qRaw = c.req.query('q')?.trim() ?? '';
    const skillsRaw = c.req.query('skills')?.trim() ?? '';
    const interviewedOnly =
      c.req.query('interviewedOnly') === 'true' || c.req.query('interviewedOnly') === '1';
    const semantic = c.req.query('semantic') === 'true' || c.req.query('semantic') === '1';

    const searchTokens = qRaw.split(/\s+/).filter(Boolean);
    const skillTerms = skillsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const useSemantic = semantic && qRaw.length > 0;

    if (useSemantic && !hasEmbeddingConfig()) {
      return c.json(
        { success: false, error: 'Semantic search requires GEMINI_API_KEY for embeddings.' },
        503,
      );
    }

    const conditions: SQL[] = [];

    if (jobIdStr) {
      const jobId = parseInt(jobIdStr, 10);
      if (Number.isNaN(jobId)) {
        return c.json({ success: false, error: 'Invalid jobId' }, 400);
      }
      conditions.push(eq(candidates.jobId, jobId));
    } else if (projectIdStr) {
      const projectId = parseInt(projectIdStr, 10);
      if (Number.isNaN(projectId)) {
        return c.json({ success: false, error: 'Invalid projectId' }, 400);
      }
      const projectJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.projectId, projectId));
      const jobIds = projectJobs.map((j) => j.id);
      if (jobIds.length === 0) {
        return c.json({ success: true, data: [], meta: useSemantic ? { semantic: true } : undefined });
      }
      conditions.push(inArray(candidates.jobId, jobIds));
    }

    if (interviewedOnly) {
      conditions.push(eq(candidates.status, 'interviewed'));
    }

    if (!useSemantic) {
      for (const token of searchTokens) {
        conditions.push(matchSearchToken(token));
      }
    }

    for (const skill of skillTerms) {
      conditions.push(matchStrengthSkill(skill));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const hasTextQuery = searchTokens.length > 0;

    if (useSemantic) {
      const rows = whereClause
        ? await db.select().from(candidates).where(whereClause)
        : await db.select().from(candidates);

      const queryVec = await embedQuery(qRaw);

      const scored = rows.map((row) => {
        const cv = bufferToFloat32(row.cvEmbedding as Buffer | null);
        const ne = bufferToFloat32(row.notesEmbedding as Buffer | null);
        const vectorSim = maxSimilarityToQuery(queryVec, cv, ne);
        const nameBoost = computeNameEmailBoost(row, searchTokens);
        const blended = nameBoost > 0 ? 1.0 + nameBoost / 200 + vectorSim : vectorSim;
        return { row, matchScore: vectorSim, blended };
      });
      scored.sort((a, b) => b.blended - a.blended);

      return c.json({
        success: true,
        data: scored.map((s) => publicCandidate(s.row, { matchScore: s.matchScore })),
        meta: { semantic: true },
      });
    }

    if (hasTextQuery) {
      const relevanceExpr = totalRelevanceScore(searchTokens);
      const relevanceAlias = sql`${relevanceExpr}`.as('_rel');
      const rows = whereClause
        ? await db
            .select({ row: candidates, _rel: relevanceAlias })
            .from(candidates)
            .where(whereClause)
            .orderBy(sql`_rel DESC`, desc(candidates.createdAt))
        : await db
            .select({ row: candidates, _rel: relevanceAlias })
            .from(candidates)
            .orderBy(sql`_rel DESC`, desc(candidates.createdAt));

      return c.json({
        success: true,
        data: rows.map((r) => publicCandidate(r.row)),
      });
    }

    const rows = whereClause
      ? await db.select().from(candidates).where(whereClause).orderBy(desc(candidates.createdAt))
      : await db.select().from(candidates).orderBy(desc(candidates.createdAt));

    return c.json({ success: true, data: rows.map((r) => publicCandidate(r)) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: message }, 500);
  }
});

candidatesController.post('/:id/cv', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) {
      return c.json({ success: false, error: 'Invalid id' }, 400);
    }
    const [existing] = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
    if (!existing) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }

    const body = await c.req.parseBody();
    const file = body['file'];
    if (!(file instanceof File)) {
      return c.json({ success: false, error: 'Expected multipart field "file" with a PDF or text file' }, 400);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || 'application/octet-stream';
    let text: string;
    try {
      text = await extractTextFromCvBytes(buf, mime);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to read file';
      return c.json({ success: false, error: msg }, 400);
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return c.json({ success: false, error: 'No text could be extracted from the file' }, 400);
    }

    let profile: Awaited<ReturnType<typeof extractCvMetadata>> | null = null;
    try {
      profile = await extractCvMetadata(trimmed);
    } catch {
      // Gemini unavailable — still persist raw text + embeddings below
    }

    let cvBuf: Buffer | null = null;
    if (hasEmbeddingConfig()) {
      try {
        cvBuf = float32ToBuffer(await embedDocument(trimmed));
      } catch (e) {
        console.error('cv embedding failed', e);
      }
    }

    const patch: Record<string, unknown> = {
      resumeText: trimmed,
      cvEmbedding: cvBuf,
    };

    if (profile) {
      patch.skillsTags = profile.skillsTags.length ? profile.skillsTags : null;
      patch.availability = profile.availability;
      patch.phone = profile.phone;
      patch.location = profile.location;
      patch.headline = profile.headline;
      patch.socialLinks = profile.socialLinks.length ? profile.socialLinks : null;
      patch.experienceSummary = profile.experienceSummary;
      patch.educationSummary = profile.educationSummary;

      if (profile.fullName && profile.fullName !== existing.name) {
        patch.name = profile.fullName;
      }
      if (profile.email && profile.email !== existing.email) {
        patch.email = profile.email;
      }
    }

    const [updated] = await db
      .update(candidates)
      .set(patch)
      .where(eq(candidates.id, id))
      .returning();

    return c.json({ success: true, data: updated ? publicCandidate(updated) : null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return c.json({ success: false, error: message }, 500);
  }
});

candidatesController.patch('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) {
      return c.json({ success: false, error: 'Invalid id' }, 400);
    }
    const [existing] = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
    if (!existing) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }

    const body = await c.req.json();
    const patch: {
      notes?: string | null;
      name?: string;
      email?: string;
      status?: CandidateRow['status'];
    } = {};

    if (body.notes !== undefined) {
      patch.notes = body.notes != null ? String(body.notes) : null;
    }
    if (body.name !== undefined) {
      patch.name = String(body.name ?? '').trim();
    }
    if (body.email !== undefined) {
      patch.email = String(body.email ?? '').trim();
    }
    if (body.status !== undefined) {
      patch.status = body.status as CandidateRow['status'];
    }

    if (Object.keys(patch).length === 0) {
      return c.json({ success: true, data: publicCandidate(existing) });
    }

    await db.update(candidates).set(patch).where(eq(candidates.id, id));

    const [fresh] = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);

    if (patch.notes !== undefined && fresh) {
      await persistNotesEmbedding(id, { notes: fresh.notes, strengths: fresh.strengths, weaknesses: fresh.weaknesses });
    }

    return c.json({ success: true, data: fresh ? publicCandidate(fresh) : null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Update failed';
    return c.json({ success: false, error: message }, 500);
  }
});

candidatesController.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) {
      return c.json({ success: false, error: 'Invalid id' }, 400);
    }
    const [existing] = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
    if (!existing) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }
    await db.delete(candidateStepResults).where(eq(candidateStepResults.candidateId, id));
    await db.delete(candidates).where(eq(candidates.id, id));
    return c.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    return c.json({ success: false, error: message }, 500);
  }
});

candidatesController.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) {
      return c.json({ success: false, error: 'Invalid id' }, 400);
    }
    const row = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
    if (!row.length) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }
    return c.json({ success: true, data: publicCandidate(row[0]!) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: message }, 500);
  }
});
