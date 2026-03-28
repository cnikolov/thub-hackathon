import { Hono } from 'hono';
import { analyzeJobOffer, scoreCandidate } from './services/gemini';

export const aiController = new Hono();

aiController.post('/analyze-job', async (c) => {
  try {
    const body = await c.req.json();
    const description = body.description as string | undefined;
    const interviewType = body.interviewType as 'intro' | 'technical' | undefined;
    if (!description?.trim()) {
      return c.json({ success: false, error: 'description is required' }, 400);
    }
    if (interviewType !== 'intro' && interviewType !== 'technical') {
      return c.json({ success: false, error: 'interviewType must be intro or technical' }, 400);
    }
    const data = await analyzeJobOffer(description, interviewType);
    return c.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return c.json({ success: false, error: message }, 500);
  }
});

aiController.post('/score-candidate', async (c) => {
  try {
    const body = await c.req.json();
    const transcript = body.transcript as string | undefined;
    const jobDescription = body.jobDescription as string | undefined;
    if (!transcript?.trim()) {
      return c.json({ success: false, error: 'transcript is required' }, 400);
    }
    const data = await scoreCandidate(transcript, jobDescription ?? '');
    return c.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scoring failed';
    return c.json({ success: false, error: message }, 500);
  }
});
