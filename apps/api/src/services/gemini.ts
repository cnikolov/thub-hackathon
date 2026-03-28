import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY ?? '';

function client() {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }
  return new GoogleGenAI({ apiKey });
}

export async function analyzeJobOffer(
  jobDescription: string,
  interviewType: 'intro' | 'technical',
) {
  const ai = client();
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Analyze this job offer for a ${interviewType === 'intro' ? 'First/Introductory' : 'Technical'} interview.
Suggest 5 interview questions, a system prompt for an AI interviewer, and an estimated interview duration.

${interviewType === 'intro' ? 'Focus on: welcome, company culture, candidate background, and what they are looking for.' : 'Focus on: technical skills, problem-solving, specific technologies mentioned in the job description, and practical experience.'}

For each question, specify if it should be mandatory and provide some possible answers if applicable.
Job Description: ${jobDescription}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                isMandatory: { type: Type.BOOLEAN },
                possibleAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['text', 'isMandatory'],
            },
          },
          durationMinutes: { type: Type.NUMBER },
          systemPrompt: {
            type: Type.STRING,
            description: 'A detailed system prompt for an AI interviewer to follow.',
          },
          hiringStrategy: {
            type: Type.STRING,
            description: 'A brief strategy for the interview process.',
          },
        },
        required: ['suggestedQuestions', 'durationMinutes', 'systemPrompt', 'hiringStrategy'],
      },
    },
  });

  return JSON.parse(response.text || '{}') as {
    suggestedQuestions: {
      text: string;
      isMandatory: boolean;
      possibleAnswers?: string[];
    }[];
    durationMinutes: number;
    systemPrompt: string;
    hiringStrategy: string;
  };
}

export async function scoreCandidate(transcript: string, jobDescription: string) {
  const ai = client();
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Score this candidate based on the interview transcript and job description.
Job Description: ${jobDescription}
Transcript: ${transcript}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: 'Score from 0 to 100' },
          notes: { type: Type.STRING, description: 'Detailed summary and notes about the candidate' },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['score', 'notes', 'strengths', 'weaknesses'],
      },
    },
  });

  return JSON.parse(response.text || '{}') as {
    score: number;
    notes: string;
    strengths: string[];
    weaknesses: string[];
  };
}

export type CvProfile = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  socialLinks: { platform: string; url: string }[];
  skillsTags: string[];
  availability: string | null;
  experienceSummary: string | null;
  educationSummary: string | null;
};

/** Derive a full structured profile from CV/resume text. */
export async function extractCvMetadata(resumeText: string): Promise<CvProfile> {
  const body = resumeText.trim().slice(0, 14_000);
  if (!body) {
    return {
      fullName: null, email: null, phone: null, location: null, headline: null,
      socialLinks: [], skillsTags: [], availability: null,
      experienceSummary: null, educationSummary: null,
    };
  }
  const ai = client();
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `You are a resume-parsing engine for an ATS. Extract every field you can from the resume below.

Rules:
- socialLinks: extract every profile URL you find (LinkedIn, GitHub, Twitter/X, portfolio, personal site, Dribbble, Behance, StackOverflow, etc.). Use the domain name as "platform" (e.g. "LinkedIn", "GitHub").
- skillsTags: up to 15 short skill labels (technologies, domains, seniority signals). Title Case.
- availability: notice period / earliest start / "Open to work" / remote preference, or "Unknown".
- experienceSummary: 2-3 sentence summary of their work history.
- educationSummary: degrees, institutions, years — 1-2 sentences.
- headline: a short professional headline or current title (e.g. "Senior Frontend Engineer").
- fullName, email, phone, location: extract if present.

Resume:
${body}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullName: { type: Type.STRING, description: 'Full name from the CV' },
          email: { type: Type.STRING, description: 'Email address' },
          phone: { type: Type.STRING, description: 'Phone number' },
          location: { type: Type.STRING, description: 'City / country / region' },
          headline: { type: Type.STRING, description: 'Professional headline or current title' },
          socialLinks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                platform: { type: Type.STRING, description: 'e.g. LinkedIn, GitHub' },
                url: { type: Type.STRING, description: 'Full URL' },
              },
              required: ['platform', 'url'],
            },
            description: 'All social / portfolio links found in the resume',
          },
          skillsTags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Concise skill labels from the CV',
          },
          availability: {
            type: Type.STRING,
            description: 'Availability / start date / notice, or Unknown',
          },
          experienceSummary: {
            type: Type.STRING,
            description: 'Brief summary of work experience',
          },
          educationSummary: {
            type: Type.STRING,
            description: 'Brief education summary',
          },
        },
        required: ['skillsTags', 'availability', 'socialLinks'],
      },
    },
  });

  const raw = JSON.parse(response.text || '{}') as Record<string, unknown>;

  const str = (k: string) => {
    const v = raw[k];
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t && t.toLowerCase() !== 'unknown' && t.toLowerCase() !== 'n/a' ? t : null;
  };

  const socialLinks = Array.isArray(raw.socialLinks)
    ? (raw.socialLinks as { platform?: string; url?: string }[])
        .filter((l) => typeof l.url === 'string' && l.url.startsWith('http'))
        .map((l) => ({
          platform: String(l.platform ?? 'Link').trim(),
          url: String(l.url).trim(),
        }))
    : [];

  const skillsTags = Array.isArray(raw.skillsTags)
    ? (raw.skillsTags as string[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 15)
    : [];

  return {
    fullName: str('fullName'),
    email: str('email'),
    phone: str('phone'),
    location: str('location'),
    headline: str('headline'),
    socialLinks,
    skillsTags,
    availability: str('availability'),
    experienceSummary: str('experienceSummary'),
    educationSummary: str('educationSummary'),
  };
}
