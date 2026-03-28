export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
}

export interface Job {
  id: number;
  projectId: number;
  title: string;
  description: string;
  requirements: string;
  systemPrompt: string;
  shareCode: string;
  status: 'open' | 'closed';
  interviewType: 'intro' | 'technical';
  durationMinutes: number;
  createdAt: Date;
}

export interface Candidate {
  id: number;
  jobId: number;
  name: string;
  email: string;
  score: number | null;
  notes: string | null;
  transcript: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  status: 'pending' | 'interviewed' | 'shortlisted' | 'rejected';
  createdAt: Date;
}