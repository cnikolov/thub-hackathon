/** Shapes returned by the Bun API (SQLite / Drizzle). */

export type Question = {
  id: string;
  text: string;
  isMandatory: boolean;
  possibleAnswers?: string[];
};

/** One ordered round in a job’s interview pipeline (e.g. technical screen → offer discussion). */
export type JobInterviewStep = {
  id: number | null;
  jobId: number;
  stepOrder: number;
  title: string;
  purpose: string;
  interviewType: 'intro' | 'technical';
  durationMinutes: number | null;
  systemPrompt: string;
  /** AI instructions for the intro phase (greeting, name confirmation, round overview). */
  introPrompt: string | null;
  /** AI instructions for the outro phase (wrap-up, next steps, farewell). */
  outroPrompt: string | null;
  questions:
    | { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[]
    | null;
  /** Must-cover checklist items the AI needs to confirm during the interview. */
  checklist: { id: string; label: string; required: boolean }[] | null;
  createdAt: Date | string | null;
  /** Synthetic single-step fallback when no rows exist in `job_interview_steps`. */
  legacy?: boolean;
};

export type Project = {
  id: number;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date | string | null;
};

export type Job = {
  id: number;
  projectId: number;
  title: string;
  description: string;
  requirements: string;
  systemPrompt: string;
  shareCode: string;
  status: 'open' | 'closed';
  interviewType: 'intro' | 'technical';
  durationMinutes: number | null;
  questions:
    | { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[]
    | null;
  createdAt: Date | string | null;
  interviewSteps?: JobInterviewStep[];
};

export type SocialLink = { platform: string; url: string };

export type Candidate = {
  id: number;
  jobId: number;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  headline: string | null;
  socialLinks: SocialLink[] | null;
  score: number | null;
  notes: string | null;
  transcript: string | null;
  /** Searchable resume / CV body. */
  resumeText: string | null;
  /** Skills inferred from uploaded CV (Gemini). */
  skillsTags: string[] | null;
  /** Notice period, start date, open to work, etc. */
  availability: string | null;
  /** Work experience summary extracted from CV. */
  experienceSummary: string | null;
  /** Education summary extracted from CV. */
  educationSummary: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  status: 'pending' | 'interviewed' | 'shortlisted' | 'rejected';
  createdAt: Date | string | null;
  /** Present when list was ranked by semantic search (0–1 cosine similarity). */
  matchScore?: number;
};

export type InterviewAttendance = {
  id: number;
  jobId: number;
  name: string;
  email: string;
  round: number | null;
  joinedAt: Date | string | null;
  completedAt: Date | string | null;
  jobTitle: string;
};

export type CandidatePipelineMeta = {
  allStepsComplete: boolean;
  completedSteps: number;
  totalSteps: number;
};
