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
    model: 'gemini-2.5-flash',
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

export async function scoreCandidate(
  transcript: string,
  jobDescription: string,
  liveObservations?: string[],
) {
  const ai = client();

  const observationsBlock = liveObservations?.length
    ? `\nLIVE INTERVIEWER OBSERVATIONS (recorded in real-time during the call):\n${liveObservations.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nThese observations are FIRST-HAND notes from the AI interviewer who conducted the call. Treat them as factual evidence — especially any notes about professionalism, attitude, or behaviour. They MUST be reflected in the final score, notes, strengths, and weaknesses.\n`
    : '';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are a rigorous hiring evaluator. Score this candidate based on the interview transcript, job description, and any live interviewer observations.

JOB DESCRIPTION:
${jobDescription}

TRANSCRIPT:
${transcript}
${observationsBlock}
SCORING RUBRIC — follow these criteria strictly:

1. TECHNICAL COMPETENCE (0–40 points)
   - Does the candidate demonstrate solid knowledge of the technologies listed in the job description?
   - CRITICAL: Strongly prefer candidates who use well-established, battle-tested, community-backed libraries and frameworks (e.g. React Query, Redux/Zustand, Express, Django, Spring, etc.) over candidates who claim to roll their own solutions or use unconventional/unheard-of approaches.
   - Rolling your own state management, reinventing ORMs, avoiding standard tooling, or using obscure DIY patterns when mature industry solutions exist is a RED FLAG — it suggests the candidate may lack awareness of ecosystem best practices, struggle in team environments, or create unmaintainable code. Deduct 10-25 points depending on severity.
   - Evaluate depth: can they explain trade-offs, edge cases, and real-world experience, or are answers surface-level?

2. COMMUNICATION & CLARITY (0–20 points)
   - Are answers clear, structured, and well-articulated?
   - Can they explain complex topics simply?
   - Do they stay on topic and answer what was asked?

3. PROFESSIONALISM & ATTITUDE (0–25 points)
   - This is weighted HEAVILY. A candidate who is rude, dismissive, makes inappropriate jokes, uses unprofessional language, appears disengaged, or does not take the interview seriously should receive 0-5 points in this category AND the total score should be capped at 35 maximum regardless of technical ability.
   - Disrespect toward the interviewer (even though it is AI) is disqualifying behaviour.
   - Look for: politeness, enthusiasm, preparation, professionalism, respectful communication.
   - Mild informality is fine. Hostility, mockery, vulgarity, or checked-out energy is not.

4. PROBLEM-SOLVING & EXPERIENCE (0–15 points)
   - Can they apply their knowledge to real scenarios?
   - Do they show evidence of meaningful hands-on experience?
   - Can they reason through problems rather than just recite definitions?

FINAL SCORE = sum of the four categories (0–100).

IMPORTANT SCORING RULES:
- If the candidate was flagged as unprofessional in the live observations, the total score MUST NOT exceed 35.
- If the candidate avoids industry-standard tools in favour of DIY/custom solutions without an excellent justification, deduct at least 10 points from Technical Competence.
- A candidate who gives joke answers, troll responses, or clearly is not engaging seriously should score below 20 total.
- Include specific quotes or paraphrases from the transcript to justify your scoring decisions.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: 'Final score from 0 to 100, sum of the four rubric categories' },
          notes: { type: Type.STRING, description: 'Detailed summary including specific evidence from the transcript. Mention professionalism issues prominently if any.' },
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
    model: 'gemini-2.5-flash',
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
