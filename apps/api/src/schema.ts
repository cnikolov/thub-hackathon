import { sqliteTable, text, integer, uniqueIndex, blob } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: text('ownerId').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('projectId').notNull().references(() => projects.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  requirements: text('requirements').notNull(),
  systemPrompt: text('systemPrompt').notNull(),
  shareCode: text('shareCode').unique().notNull(),
  status: text('status', { enum: ['open', 'closed'] }).default('open'),
  interviewType: text('interviewType', { enum: ['intro', 'technical'] }).default('intro'),
  durationMinutes: integer('durationMinutes').default(15),
  questions: text('questions', { mode: 'json' }).$type<{ id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[]>(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/** Ordered interview rounds for a job (e.g. technical screen → offer conversation). */
export const jobInterviewSteps = sqliteTable('job_interview_steps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('jobId')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  stepOrder: integer('stepOrder').notNull(),
  title: text('title').notNull(),
  purpose: text('purpose').notNull(),
  interviewType: text('interviewType', { enum: ['intro', 'technical'] }).notNull(),
  durationMinutes: integer('durationMinutes').default(15),
  systemPrompt: text('systemPrompt').notNull(),
  /** AI instructions for the intro phase (greeting, name confirmation, round overview). */
  introPrompt: text('introPrompt'),
  /** AI instructions for the outro phase (wrap-up, next steps, farewell). */
  outroPrompt: text('outroPrompt'),
  questions: text('questions', { mode: 'json' }).$type<
    { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[]
  >(),
  /** Must-cover checklist items the AI needs to confirm during the interview (e.g. salary, start date). */
  checklist: text('checklist', { mode: 'json' }).$type<
    { id: string; label: string; required: boolean }[]
  >(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type SocialLink = { platform: string; url: string };

export const candidates = sqliteTable('candidates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('jobId').notNull().references(() => jobs.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  location: text('location'),
  headline: text('headline'),
  socialLinks: text('socialLinks', { mode: 'json' }).$type<SocialLink[]>(),
  score: integer('score'),
  notes: text('notes'),
  transcript: text('transcript'),
  /** Raw resume / CV text (from upload or paste). */
  resumeText: text('resumeText'),
  /** Gemini RETRIEVAL_DOCUMENT embedding of CV/resume text (Float32 bytes). */
  cvEmbedding: blob('cvEmbedding', { mode: 'buffer' }),
  /** Gemini embedding of interview notes (Float32 bytes). */
  notesEmbedding: blob('notesEmbedding', { mode: 'buffer' }),
  /** Skills inferred from CV (tags); searchable alongside strengths. */
  skillsTags: text('skillsTags', { mode: 'json' }).$type<string[]>(),
  /** Short phrase: notice period, start date, open to work, etc. */
  availability: text('availability'),
  /** Work experience summary extracted from CV. */
  experienceSummary: text('experienceSummary'),
  /** Education summary extracted from CV. */
  educationSummary: text('educationSummary'),
  strengths: text('strengths', { mode: 'json' }).$type<string[]>(),
  weaknesses: text('weaknesses', { mode: 'json' }).$type<string[]>(),
  status: text('status', { enum: ['pending', 'interviewed', 'shortlisted', 'rejected'] }).default('pending'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/** Tracks when a candidate joins (and optionally completes) an interview session. */
export const interviewAttendance = sqliteTable('interview_attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('jobId')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  /** Which pipeline round the candidate started (1-based). */
  round: integer('round').default(1),
  joinedAt: integer('joinedAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** Set when the interview (or final round) finishes. */
  completedAt: integer('completedAt', { mode: 'timestamp' }),
});

/** Per-round transcript/score when a candidate completes a pipeline step. */
export const candidateStepResults = sqliteTable(
  'candidate_step_results',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    candidateId: integer('candidateId')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    stepId: integer('stepId')
      .notNull()
      .references(() => jobInterviewSteps.id, { onDelete: 'cascade' }),
    transcript: text('transcript'),
    score: integer('score'),
    notes: text('notes'),
    createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (t) => ({
    candStepUniq: uniqueIndex('candidate_step_results_candidate_step').on(t.candidateId, t.stepId),
  }),
);
