import { projects, jobs, candidates, jobInterviewSteps, candidateStepResults } from './schema';

type StepSeed = {
  stepOrder: number;
  title: string;
  purpose: string;
  interviewType: 'intro' | 'technical';
  durationMinutes: number;
  systemPrompt: string;
  questions: { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[];
};

type JobSeed = {
  projectIndex: number;
  title: string;
  description: string;
  requirements: string;
  systemPrompt: string;
  shareCode: string;
  interviewType: 'intro' | 'technical';
  durationMinutes: number;
  steps: StepSeed[];
};

const FIRST_NAMES = [
  'Aarav', 'Priya', 'Marcus', 'Yuki', 'Fatima', 'Diego', 'Elena', 'Kwame', 'Sofia', 'Viktor',
  'Amara', 'Chen', 'Ingrid', 'Jamal', 'Katarina', 'Luis', 'Mei', 'Noah', 'Olga', 'Pavel',
  'Quinn', 'Rosa', 'Sanjay', 'Tariq', 'Uma', 'Vera', 'Wei', 'Zara', 'Hassan', 'Isla',
  'Jonas', 'Keiko', 'Liam', 'Mira', 'Nadia', 'Omar', 'Petra', 'Raj', 'Sven', 'Tessa',
  'Ada', 'Bruno', 'Chiara', 'Dmitri', 'Esme', 'Finn', 'Greta', 'Hiro', 'Ivy', 'Jun',
];

const LAST_NAMES = [
  'Nguyen', 'Patel', 'Okafor', 'Yamamoto', 'Al-Farsi', 'Rivera', 'Volkov', 'Mensah', 'Costa', 'Petrov',
  'Okonkwo', 'Liu', 'Berg', 'Hassan', 'Novak', 'García', 'Zhang', 'Cohen', 'Ivanova', 'Kowalski',
  'Murphy', 'Silva', 'Kapoor', 'Benali', 'Nair', 'Kozlov', 'Tanaka', 'Haddad', 'Lindström', 'Osei',
  'Bakker', 'Santos', 'Fischer', 'Dubois', 'Rossi', 'Khan', 'Johansson', 'Reyes', 'Nielsen', 'Abebe',
  'Cruz', 'Müller', 'Yılmaz', 'Olsen', 'Popescu', 'Singh', 'Wójcik', 'Kang', 'Flores', 'Varga',
];

const COMPANIES = [
  'Stripe', 'Shopify', 'Datadog', 'MongoDB', 'Vercel', 'Linear', 'Notion', 'Figma', 'GitLab', 'Elastic',
  'Cloudflare', 'Snowflake', 'Databricks', 'Spotify', 'Klarna', 'Wise', 'Revolut', 'N26', 'Zalando', 'Booking',
];

const UNIVERSITIES = [
  'TU Munich', 'ETH Zürich', 'Imperial College London', 'University of Toronto', 'Georgia Tech',
  'Seoul National University', 'University of São Paulo', 'University of Cape Town', 'McGill University',
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

function statusForIndex(i: number): 'pending' | 'interviewed' | 'shortlisted' | 'rejected' {
  const r = (i * 17 + 13) % 100;
  if (r < 22) return 'pending';
  if (r < 62) return 'interviewed';
  if (r < 82) return 'shortlisted';
  return 'rejected';
}

function scoreForIndex(i: number, status: string): number | null {
  if (status === 'pending') return null;
  const base = 42 + ((i * 31) % 50);
  if (status === 'rejected') return Math.min(base, 55 + (i % 8));
  if (status === 'shortlisted') return 78 + (i % 18);
  return 60 + (i % 35);
}

/** Multi-paragraph CV text aligned with job family `kind`. */
function buildResumeText(args: {
  name: string;
  email: string;
  jobTitle: string;
  kind:
    | 'frontend'
    | 'design'
    | 'backend'
    | 'staff_fe'
    | 'devops'
    | 'data'
    | 'qa'
    | 'mobile'
    | 'tpm'
    | 'security';
  i: number;
}): string {
  const { name, email, jobTitle, kind, i } = args;
  const years = 2 + (i % 12);
  const company = pick(COMPANIES, i + 3);
  const prev = pick(COMPANIES, i + 11);
  const school = pick(UNIVERSITIES, i);

  const summary: Record<typeof kind, string> = {
    frontend: `Product-minded engineer with ${years}+ years shipping React/TypeScript UIs, design systems, and performance work at scale.`,
    design: `Systems thinker and product designer with ${years}+ years in B2B SaaS, design ops, and accessibility-led delivery.`,
    backend: `Backend engineer focused on APIs, data modeling, and pragmatic reliability in TypeScript/Node and SQL-first stacks.`,
    staff_fe: `Staff-level frontend leader with ${years}+ years mentoring teams, owning architecture, and partnering with product on roadmaps.`,
    devops: `Platform engineer with ${years}+ years automating delivery, hardening infra, and improving observability across Kubernetes and cloud.`,
    data: `Data engineer with ${years}+ years building pipelines, warehouses, and self-serve analytics with strong SQL and orchestration experience.`,
    qa: `QA engineer specializing in test automation, CI integration, and flake reduction across web and API surfaces.`,
    mobile: `Mobile engineer with ${years}+ years shipping cross-platform apps with React Native, native modules, and release discipline.`,
    tpm: `Technical PM with ${years}+ years translating ambiguous goals into roadmaps, specs, and measurable outcomes with engineering teams.`,
    security: `Security engineer with ${years}+ years in appsec reviews, threat modeling, and secure SDLC practices in fast-moving product orgs.`,
  };

  const skills: Record<typeof kind, string> = {
    frontend:
      'React, TypeScript, Vite, Next.js, TanStack Query, Zustand, Tailwind CSS, Web Vitals, Storybook, Jest, Playwright',
    design: 'Figma, design tokens, WCAG 2.2, prototyping, user research synthesis, design QA with engineering',
    backend: 'TypeScript, Bun/Node, REST, SQLite/Postgres, Drizzle, Redis, OpenAPI, testing with Vitest',
    staff_fe: 'React, TypeScript, bundlers, module federation, performance budgets, mentoring, RFC process',
    devops: 'Kubernetes, Terraform, GitHub Actions, Prometheus, Grafana, Docker, AWS/GCP basics',
    data: 'SQL, dbt, Airflow/Prefect, Snowflake/BigQuery, Python, data quality checks, BI partnerships',
    qa: 'Playwright, Cypress, API testing, contract tests, CI gates, test data strategy, accessibility checks',
    mobile: 'React Native, TypeScript, native bridges, OTA updates, App Store release, performance profiling',
    tpm: 'Roadmapping, PRDs, metrics, stakeholder management, technical trade-off framing, agile rituals',
    security: 'OWASP ASVS, SAST/DAST, secrets management, dependency review, incident response basics',
  };

  return [
    `${name}`,
    `${email} · ${jobTitle} candidate`,
    '',
    'PROFESSIONAL SUMMARY',
    summary[kind],
    '',
    'EXPERIENCE',
    `Senior contributor — ${company} (${2018 + (i % 6)}–Present)`,
    `• Led delivery of customer-facing features with measurable impact on activation and retention.`,
    `• Partnered with PM/Design on discovery; reduced cycle time through better specs and incremental releases.`,
    `• Improved reliability and observability: on-call rotation, dashboards, and blameless postmortems.`,
    '',
    `Software Engineer — ${prev} (${2014 + (i % 4)}–${2018 + (i % 6)})`,
    `• Shipped core platform improvements; collaborated across time zones with clear written communication.`,
    `• Mentored junior engineers; introduced code review norms and testing habits that stuck.`,
    '',
    'EDUCATION',
    `B.Sc. Computer Science — ${school} (graduated ${2012 + (i % 6)})`,
    'Coursework: distributed systems, algorithms, databases, human–computer interaction (where applicable).',
    '',
    'SKILLS',
    skills[kind],
    '',
    'CERTIFICATIONS & LANGUAGES',
    i % 3 === 0 ? 'AWS Cloud Practitioner · English (C1) · German (B2)' : 'English (fluent) · Additional language for regional collaboration',
    '',
    'OPEN SOURCE / SIDE PROJECTS',
    i % 2 === 0
      ? 'Maintains small OSS utilities for developer experience; occasional conference talks on team practices.'
      : 'Contributes to internal platform tools; writes internal documentation that reduced support load.',
  ].join('\n');
}

function skillsTagsForKind(
  kind: Parameters<typeof buildResumeText>[0]['kind'],
  i: number,
): string[] {
  const pools: Record<typeof kind, string[][]> = {
    frontend: [
      ['React', 'TypeScript', 'Next.js', 'Vite'],
      ['Design Systems', 'Storybook', 'Accessibility', 'Web Performance'],
    ],
    design: [['Figma', 'Prototyping', 'Design Systems', 'User Research'], ['WCAG', 'Workshop Facilitation']],
    backend: [['TypeScript', 'REST', 'SQL', 'SQLite'], ['Redis', 'API Design', 'Testing']],
    staff_fe: [['React', 'Architecture', 'Mentoring', 'Performance'], ['RFC Process', 'TypeScript']],
    devops: [['Kubernetes', 'Terraform', 'CI/CD'], ['Observability', 'Docker', 'AWS']],
    data: [['SQL', 'dbt', 'Python'], ['ETL', 'Snowflake', 'Data Quality']],
    qa: [['Playwright', 'Cypress', 'CI'], ['API Testing', 'Test Strategy']],
    mobile: [['React Native', 'TypeScript', 'iOS/Android'], ['OTA', 'Performance']],
    tpm: [['Roadmapping', 'Metrics', 'Stakeholders'], ['Technical Trade-offs', 'Agile']],
    security: [['AppSec', 'Threat Modeling', 'OWASP'], ['SAST', 'Secrets', 'SDLC']],
  };
  const a = pick(pools[kind], i);
  const b = pick(pools[kind], i + 1);
  return [...new Set([...a, ...b])].slice(0, 12);
}

function strengthsWeaknesses(kind: Parameters<typeof buildResumeText>[0]['kind'], i: number) {
  const s: Record<typeof kind, [string[], string[]]> = {
    frontend: [
      ['Component architecture', 'Performance tuning', 'Clear code reviews'],
      ['Limited native mobile', 'Less Kotlin/Swift'],
    ],
    design: [
      ['Systems thinking', 'Accessibility advocacy', 'Cross-functional facilitation'],
      ['Slower in highly ambiguous greenfield without research budget'],
    ],
    backend: [
      ['Pragmatic data modeling', 'API clarity', 'Operational mindset'],
      ['Less frontend polish', 'Limited ML depth'],
    ],
    staff_fe: [
      ['Technical leadership', 'Roadmap alignment', 'Mentoring'],
      ['Can be opinionated in debates'],
    ],
    devops: [
      ['Automation first', 'Incident response', 'Cost awareness'],
      ['Less product UX depth'],
    ],
    data: [
      ['SQL strength', 'Pipeline reliability', 'Stakeholder communication'],
      ['Heavy ML modeling not primary focus'],
    ],
    qa: [
      ['Test design', 'Flake hunting', 'CI integration'],
      ['Less greenfield product discovery'],
    ],
    mobile: [
      ['Ship velocity', 'Release discipline', 'Profiling'],
      ['Smaller web SEO experience'],
    ],
    tpm: [
      ['Clarity under ambiguity', 'Metrics literacy', 'Engineering trust'],
      ['Can over-document early'],
    ],
    security: [
      ['Threat modeling', 'Practical controls', 'Developer empathy'],
      ['Less formal crypto research'],
    ],
  };
  return { strengths: s[kind][0], weaknesses: s[kind][1] };
}

const JOB_SEEDS: JobSeed[] = [
  {
    projectIndex: 0,
    title: 'Senior React Developer',
    description:
      'Build high-performance web apps with React, TypeScript, and modern tooling in a product-led team.',
    requirements: '5+ years React, TypeScript, performance tuning, collaboration with design.',
    systemPrompt: 'You are a senior technical interviewer for frontend React roles.',
    shareCode: 'REACT24',
    interviewType: 'technical',
    durationMinutes: 30,
    steps: [
      {
        stepOrder: 1,
        title: 'Technical screen',
        purpose: 'React, TypeScript, and problem-solving.',
        interviewType: 'technical',
        durationMinutes: 25,
        systemPrompt:
          'You are a senior technical interviewer. Be rigorous but fair. Focus on React fundamentals and system thinking.',
        questions: [
          { id: '1', text: 'Explain useMemo vs useCallback.', isMandatory: true },
          { id: '2', text: 'How do you structure state at scale?', isMandatory: true },
        ],
      },
      {
        stepOrder: 2,
        title: 'Culture & offer',
        purpose: 'Expectations and ways of working.',
        interviewType: 'intro',
        durationMinutes: 15,
        systemPrompt: 'You are an HR partner; conversational fit and clarity.',
        questions: [{ id: '1', text: 'What are you looking for in your next role?', isMandatory: true }],
      },
    ],
  },
  {
    projectIndex: 0,
    title: 'Product Designer',
    description: 'Own the design system and key product flows with accessibility at the core.',
    requirements: 'Figma, prototyping, accessibility, strong communication.',
    systemPrompt: 'You are a design interviewer focused on craft and process.',
    shareCode: 'DESIGN1',
    interviewType: 'intro',
    durationMinutes: 20,
    steps: [
      {
        stepOrder: 1,
        title: 'Portfolio review',
        purpose: 'Craft, process, and collaboration.',
        interviewType: 'intro',
        durationMinutes: 20,
        systemPrompt: 'You are a design lead interviewing for craft and communication.',
        questions: [{ id: '1', text: 'Walk us through your portfolio.', isMandatory: true }],
      },
    ],
  },
  {
    projectIndex: 1,
    title: 'Backend Engineer (Bun)',
    description: 'APIs, SQLite, and realtime services with a small, fast runtime.',
    requirements: 'TypeScript, SQL, REST, pragmatic testing.',
    systemPrompt: 'You are a backend interviewer.',
    shareCode: 'BUNDEV',
    interviewType: 'technical',
    durationMinutes: 25,
    steps: [
      {
        stepOrder: 1,
        title: 'Technical deep-dive',
        purpose: 'API design, SQL, reliability.',
        interviewType: 'technical',
        durationMinutes: 25,
        systemPrompt: 'You are a staff backend engineer interviewing for depth.',
        questions: [{ id: '1', text: 'How would you model multi-tenant data?', isMandatory: true }],
      },
      {
        stepOrder: 2,
        title: 'Architecture discussion',
        purpose: 'Scaling and observability.',
        interviewType: 'technical',
        durationMinutes: 20,
        systemPrompt: 'Focus on system design and pragmatic trade-offs.',
        questions: [{ id: '1', text: 'Describe a production incident you owned end-to-end.', isMandatory: true }],
      },
    ],
  },
  {
    projectIndex: 0,
    title: 'Staff Frontend Engineer',
    description: 'Lead frontend strategy, mentor engineers, and raise the bar for architecture and UX performance.',
    requirements: '8+ years web platform work, TypeScript, mentoring, cross-team influence.',
    systemPrompt: 'You are a staff engineer interviewer.',
    shareCode: 'STAFFFE',
    interviewType: 'technical',
    durationMinutes: 35,
    steps: [
      {
        stepOrder: 1,
        title: 'Staff technical loop',
        purpose: 'Architecture, trade-offs, and leadership signals.',
        interviewType: 'technical',
        durationMinutes: 35,
        systemPrompt: 'Probe for multi-team impact, RFC quality, and technical judgment.',
        questions: [{ id: '1', text: 'Tell us about a technical decision you championed across teams.', isMandatory: true }],
      },
    ],
  },
  {
    projectIndex: 1,
    title: 'DevOps / Platform Engineer',
    description: 'Own CI/CD, Kubernetes workloads, and developer experience for internal platforms.',
    requirements: 'K8s, Terraform or equivalent, observability, scripting.',
    systemPrompt: 'You are a platform engineering interviewer.',
    shareCode: 'PLATF1',
    interviewType: 'technical',
    durationMinutes: 28,
    steps: [
      {
        stepOrder: 1,
        title: 'Platform & SRE screen',
        purpose: 'Automation, incidents, and reliability culture.',
        interviewType: 'technical',
        durationMinutes: 28,
        systemPrompt: 'Assess practical platform skills and on-call maturity.',
        questions: [{ id: '1', text: 'How do you balance velocity vs reliability?', isMandatory: true }],
      },
    ],
  },
  {
    projectIndex: 1,
    title: 'Data Engineer',
    description: 'Build pipelines, warehouse models, and trusted metrics for product and GTM teams.',
    requirements: 'SQL, Python, dbt or similar, orchestration, data quality mindset.',
    systemPrompt: 'You are a data engineering interviewer.',
    shareCode: 'DATAENG',
    interviewType: 'technical',
    durationMinutes: 30,
    steps: [
      {
        stepOrder: 1,
        title: 'Data modeling interview',
        purpose: 'SQL, pipelines, and stakeholder alignment.',
        interviewType: 'technical',
        durationMinutes: 30,
        systemPrompt: 'Focus on correctness, idempotency, and explaining trade-offs to non-experts.',
        questions: [{ id: '1', text: 'Walk through a pipeline you owned and how you monitored it.', isMandatory: true }],
      },
    ],
  },
  {
    projectIndex: 0,
    title: 'QA Automation Engineer',
    description: 'Drive end-to-end and API test strategy with tight CI integration.',
    requirements: 'Playwright/Cypress, API testing, flake reduction, collaboration with devs.',
    systemPrompt: 'You are a QA leadership interviewer.',
    shareCode: 'QA_AUTO',
    interviewType: 'technical',
    durationMinutes: 25,
    steps: [
      {
        stepOrder: 1,
        title: 'Test architecture',
        purpose: 'Automation design and CI gates.',
        interviewType: 'technical',
        durationMinutes: 25,
        systemPrompt: 'Evaluate test pyramid thinking and pragmatic coverage.',
        questions: [{ id: '1', text: 'How do you decide what not to automate?', isMandatory: true }],
      },
    ],
  },
  {
    projectIndex: 0,
    title: 'Mobile Engineer (React Native)',
    description: 'Ship iOS and Android experiences with shared codebase and native bridges when needed.',
    requirements: 'React Native, TypeScript, performance, release process.',
    systemPrompt: 'You are a mobile engineering interviewer.',
    shareCode: 'MOBILE1',
    interviewType: 'technical',
    durationMinutes: 28,
    steps: [
      {
        stepOrder: 1,
        title: 'Mobile technical screen',
        purpose: 'RN architecture, native interop, and shipping.',
        interviewType: 'technical',
        durationMinutes: 28,
        systemPrompt: 'Assess depth on mobile constraints and pragmatic delivery.',
        questions: [{ id: '1', text: 'Describe how you debug a performance issue in production.', isMandatory: true }],
      },
    ],
  },
  {
    projectIndex: 0,
    title: 'Technical Product Manager',
    description: 'Bridge engineering and GTM with crisp specs, metrics, and roadmap trade-offs.',
    requirements: 'Technical depth, written communication, stakeholder management.',
    systemPrompt: 'You are a TPM interviewer.',
    shareCode: 'TPM2024',
    interviewType: 'intro',
    durationMinutes: 30,
    steps: [
      {
        stepOrder: 1,
        title: 'TPM scenario interview',
        purpose: 'Ambiguity, prioritization, and metrics.',
        interviewType: 'intro',
        durationMinutes: 30,
        systemPrompt: 'Evaluate structured thinking and partnership with engineering.',
        questions: [{ id: '1', text: 'Tell us about a roadmap you deprioritized and why.', isMandatory: true }],
      },
    ],
  },
  {
    projectIndex: 1,
    title: 'Security Engineer (AppSec)',
    description: 'Embed security in SDLC: reviews, threat modeling, and pragmatic controls.',
    requirements: 'AppSec fundamentals, secure coding, collaboration with developers.',
    systemPrompt: 'You are a security engineering interviewer.',
    shareCode: 'SECENG1',
    interviewType: 'technical',
    durationMinutes: 30,
    steps: [
      {
        stepOrder: 1,
        title: 'AppSec interview',
        purpose: 'Threat modeling and practical mitigations.',
        interviewType: 'technical',
        durationMinutes: 30,
        systemPrompt: 'Balance rigor with shipping; developer empathy matters.',
        questions: [{ id: '1', text: 'Walk through how you would threat-model a new payments flow.', isMandatory: true }],
      },
    ],
  },
];

const JOB_KINDS: Parameters<typeof buildResumeText>[0]['kind'][] = [
  'frontend',
  'design',
  'backend',
  'staff_fe',
  'devops',
  'data',
  'qa',
  'mobile',
  'tpm',
  'security',
];

/** Rich sample data for local SQLite — includes multi-step interview pipelines per job and 50 seeded candidates. */
export async function populateSampleData(db: any, options: { clearFirst?: boolean } = {}) {
  if (options.clearFirst) {
    await db.delete(candidateStepResults);
    await db.delete(candidates);
    await db.delete(jobInterviewSteps);
    await db.delete(jobs);
    await db.delete(projects);
  }

  const [p1] = await db
    .insert(projects)
    .values({
      name: 'Hackatron Project',
      description: 'Product, design, and talent programs for the Hackatron workspace.',
      ownerId: 'user-123',
    })
    .returning();

  const [p2] = await db
    .insert(projects)
    .values({
      name: 'Engineering Platform',
      description: 'Core infrastructure, data, and platform engineering.',
      ownerId: 'user-123',
    })
    .returning();

  const projectIds = [p1!.id, p2!.id];

  const now = new Date();
  const jobRows = await db
    .insert(jobs)
    .values(
      JOB_SEEDS.map((j, idx) => ({
        projectId: projectIds[j.projectIndex]!,
        title: j.title,
        description: j.description,
        requirements: j.requirements,
        systemPrompt: j.systemPrompt,
        shareCode: j.shareCode,
        status: 'open' as const,
        interviewType: j.interviewType,
        durationMinutes: j.durationMinutes,
        questions: [] as { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[],
        createdAt: new Date(now.getTime() - idx * 60_000),
      })),
    )
    .returning();

  const stepInserts: {
    jobId: number;
    stepOrder: number;
    title: string;
    purpose: string;
    interviewType: 'intro' | 'technical';
    durationMinutes: number;
    systemPrompt: string;
    questions: { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[];
    createdAt: Date;
  }[] = [];

  for (let ji = 0; ji < jobRows.length; ji++) {
    const job = jobRows[ji]!;
    const seed = JOB_SEEDS[ji]!;
    for (const st of seed.steps) {
      stepInserts.push({
        jobId: job.id,
        stepOrder: st.stepOrder,
        title: st.title,
        purpose: st.purpose,
        interviewType: st.interviewType,
        durationMinutes: st.durationMinutes,
        systemPrompt: st.systemPrompt,
        questions: st.questions,
        createdAt: new Date(),
      });
    }
  }

  await db.insert(jobInterviewSteps).values(stepInserts);

  const candidateRows: (typeof candidates.$inferInsert)[] = [];

  for (let i = 0; i < 50; i++) {
    const jobIndex = i % jobRows.length;
    const job = jobRows[jobIndex]!;
    const kind = JOB_KINDS[jobIndex]!;
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3) % LAST_NAMES.length]}`;
    const email = `seed.candidate.${i + 1}@hackatron.seed`;
    const status = statusForIndex(i);
    const score = scoreForIndex(i, status);
    const { strengths, weaknesses } = strengthsWeaknesses(kind, i);
    const resumeText = buildResumeText({
      name,
      email,
      jobTitle: job.title,
      kind,
      i,
    });
    const skillsTags = skillsTagsForKind(kind, i);
    const availability =
      status === 'pending'
        ? 'Available in 2–4 weeks after offer'
        : pick(
            [
              'Immediate',
              '2 weeks notice',
              '1 month notice',
              'Open to contract-to-hire',
              'Remote EU timezone',
            ],
            i,
          );

    const notes =
      status === 'pending'
        ? 'Awaiting scheduling.'
        : pick(
            [
              'Strong alignment with role; follow up on system design depth.',
              'Great communication; verify hands-on depth in next round.',
              'Mixed signals on production scale; consider take-home.',
              'Excellent culture add; compensation expectations TBD.',
              'Referral from internal engineer; prioritize loop.',
            ],
            i + jobIndex,
          );

    const transcript =
      status === 'pending'
        ? null
        : [
            `Interviewer: Thanks for joining. Let's start with your recent work at ${pick(COMPANIES, i)}.`,
            `${name.split(' ')[0]}: I led a migration that cut p95 latency by 18% and improved error budgets.`,
            `Interviewer: How did you validate the change?`,
            `${name.split(' ')[0]}: Canary rollout, shadow traffic, and dashboards we reviewed in weekly ops sync.`,
          ].join('\n');

    candidateRows.push({
      jobId: job.id,
      name,
      email,
      score,
      notes,
      transcript,
      resumeText,
      skillsTags,
      availability,
      strengths,
      weaknesses,
      status,
      createdAt: new Date(now.getTime() - i * 120_000),
    });
  }

  await db.insert(candidates).values(candidateRows);

  return {
    projects: projectIds.length,
    jobs: jobRows.length,
    candidates: candidateRows.length,
  };
}
