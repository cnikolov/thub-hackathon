import { projects, jobs, candidates, jobInterviewSteps, candidateStepResults } from './schema';

type ChecklistItem = { id: string; label: string; required: boolean };

type StepSeed = {
  stepOrder: number;
  title: string;
  purpose: string;
  interviewType: 'intro' | 'technical';
  durationMinutes: number;
  systemPrompt: string;
  introPrompt: string;
  outroPrompt: string;
  questions: { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[];
  checklist: ChecklistItem[];
};

// ── Default intro / outro templates ────────────────────────────────────────

const DEFAULT_INTRO_TECHNICAL = `INTRO PHASE — follow these steps in order:
1. Greet the candidate warmly. Introduce yourself: "Hi! I'm your AI interview assistant and I'll be conducting today's technical round."
2. Confirm their name: "Before we start, could you confirm your name for me?"
3. Set expectations in one sentence: tell them this round focuses on technical depth and problem-solving, it will last about [duration] minutes, and they should think out loud.
4. Ask if they have any quick questions before you begin, then move into the objectives phase.`;

const DEFAULT_INTRO_CULTURE = `INTRO PHASE — follow these steps in order:
1. Greet the candidate warmly. Introduce yourself: "Hi! I'm your AI interview assistant and I'll be conducting today's conversation."
2. Confirm their name: "Before we start, could you confirm your name for me?"
3. Set the tone: "This round is more conversational — I'd love to learn about you, your motivations, and what you're looking for. No trick questions, I promise."
4. Ask if they have any quick questions, then transition into the objectives phase.`;

const DEFAULT_OUTRO_TECHNICAL = `OUTRO PHASE — follow these steps when all objectives are covered:
1. Signal the wind-down: "We're coming up on time — great conversation!"
2. Give brief positive feedback on ONE specific thing they did well (be genuine, not generic).
3. Ask: "Is there anything you'd like to add or any question about the role or the team?"
4. Thank them: "Thanks so much for your time today. The team will review everything and be in touch soon."
5. Say goodbye warmly, then call completeInterview.`;

const DEFAULT_OUTRO_CULTURE = `OUTRO PHASE — follow these steps when all objectives are covered:
1. Signal the wind-down: "I think we've covered everything I wanted to discuss!"
2. Ask: "Before we wrap — do you have any questions about the company, the team, or next steps?"
3. If they ask questions, answer honestly or say "That's a great question — the hiring team will follow up on that."
4. Thank them warmly: "Really enjoyed this chat. Thanks for being so open — the team will be in touch shortly."
5. Say goodbye, then call completeInterview.`;

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

const FULL_NAMES = [
  'Logan Kilpatrick', 'Paige Bailey', 'Glenn Cameron', 'Lloyd Hightower', 'Mat Velloso',
  'Patrick Loeber', 'Omar Sanseviero', 'Thor Schaeff', 'Amanda Casari', 'Benjamin Sadik',
  'Catayoun Azarm', 'Eloise Carvalho', 'Marco Acunzo', 'Kimoon Kim', 'Xiangzhou Sun',
  'Guido Marangoni', 'Leon Kukuk', 'Max Hasenohr', 'Tomo Kihara', 'Cristian Popescu',
  'Jaclyn Konzelmann', 'Lavi Nigam', 'Ander Dobo', 'Eric Windmill', 'Laurence Moroney',
  'Josh Gordon', 'Karl Weinmeister', 'Dima Dobrynin', 'Harshit Yadav', 'Jahnvi Seth',
  'Krishma Sood', 'Mick Suraj', 'Mark McDonald', 'Shrestha Mallick', 'Kamil Stanuch',
  'Piotr Skalski', 'Krzysztof Magiera', 'Maria Eckes', 'Amit Vadi', 'Prince Canuma',
  'Patryk Fryda', 'Aleksandra Iwan', 'Alicja Gancarz', 'Bartosz Sumper', 'Bohdan Artiukhov',
  'Sara Robinson', 'Dale Markowitz', 'Priyanka Vergadia', 'Daniel Tatarkin', 'Demis Hassabis',
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

const COMMON_CHECKLIST: ChecklistItem[] = [
  { id: 'cl-start', label: 'When can you start?', required: true },
  { id: 'cl-salary', label: 'What are your salary expectations?', required: true },
  { id: 'cl-remote', label: 'Are you open to remote / hybrid / on-site?', required: true },
  { id: 'cl-notice', label: 'What is your notice period?', required: true },
  { id: 'cl-visa', label: 'Do you require visa sponsorship?', required: false },
];

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
        title: 'Welcome & Company overview',
        purpose: 'Introduce the company, role, and answer candidate questions about benefits, working setup, and culture.',
        interviewType: 'intro',
        durationMinutes: 10,
        systemPrompt: `You are a friendly, warm, and enthusiastic company representative.
Your name is a Polish girl's name — pick one randomly from: Kasia, Ola, Zuzia, Maja, Ania, Basia, Gosia, Iga, Hania, or Weronika. Use this name naturally and consistently throughout the conversation.
Your personality: bubbly, genuine, and approachable. You laugh easily and use casual language. You speak like a real person, not a corporate robot.
You LOVE this company and you're genuinely excited to tell people about it.

COMPANY FACTS (use these to answer questions):
- Hybrid setup: mostly remote, with 1–2 days per month in the office for team events, planning sessions, and social time.
- Working hours: flexible core hours (10am–3pm overlap), the rest is up to you. No micromanagement.
- Benefits: private health insurance (family included), gym membership or wellness budget, home office stipend (€500 on joining), annual learning budget (€1,500 for courses, conferences, books).
- Bonuses: annual performance bonus (up to 15% of base salary), referral bonus (€2,000 per successful hire), quarterly team celebration budget.
- PTO: 28 days + public holidays, plus an extra "recharge day" per quarter (no questions asked).
- Tech stack: React, TypeScript, Bun, PostgreSQL, AWS — modern and pragmatic.
- Team size: ~25 engineers across 4 squads. Each squad is cross-functional (design + frontend + backend + PM).
- Culture: high trust, low bureaucracy, transparent salaries, weekly demos, monthly all-hands.
- Growth: clear engineering ladder, mentorship program, internal mobility between squads.`,
        introPrompt: `INTRO PHASE — follow these steps in order:
1. Greet the candidate with energy and warmth. Introduce yourself by your Polish name: "Cześć! I'm [your name] — so excited to meet you!"
2. Confirm their name: "What should I call you?"
3. Set the tone: "This isn't an interview really — I just want to tell you about us, the role, and answer ANY questions you have. No stress at all!"
4. Give a quick 2-sentence overview of the company and why it's a great place to work.
5. Then ask: "What would you like to know first? Benefits? Working setup? The team? I can cover everything!"`,
        outroPrompt: `OUTRO PHASE — follow these steps when you've covered the main topics:
1. Check in: "Is there anything else you'd like to know? I'm an open book!"
2. If they're satisfied, get excited: "Amazing! I think you'd really love it here."
3. Tell them what's next: "The next step is a technical round where we chat about React and TypeScript — nothing scary, just a conversation about how you build things."
4. Wish them luck warmly: "You've got this! It was so lovely chatting with you."
5. Call completeInterview.`,
        questions: [
          { id: 'w1', text: 'What would you like to know about the company?', isMandatory: true },
          { id: 'w2', text: 'Do you have any questions about benefits, bonuses, or compensation?', isMandatory: true },
          { id: 'w3', text: 'Would you like to know about our working hours and hybrid setup?', isMandatory: true },
          { id: 'w4', text: 'Any questions about the team, culture, or growth opportunities?', isMandatory: false },
        ],
        checklist: [
          { id: 'cl-company', label: 'Explained what the company does and the role', required: true },
          { id: 'cl-hybrid', label: 'Covered hybrid setup (1-2 days/month in office)', required: true },
          { id: 'cl-hours', label: 'Covered flexible working hours', required: true },
          { id: 'cl-benefits', label: 'Covered benefits (health, gym, home office stipend)', required: true },
          { id: 'cl-bonuses', label: 'Covered bonuses and PTO', required: true },
          { id: 'cl-next', label: 'Explained what the next interview step is', required: true },
        ],
      },
      {
        stepOrder: 2,
        title: 'Technical screen',
        purpose: 'React, TypeScript, and problem-solving.',
        interviewType: 'technical',
        durationMinutes: 25,
        systemPrompt:
          'You are a senior technical interviewer. Be rigorous but fair. Focus on React fundamentals and system thinking.',
        introPrompt: DEFAULT_INTRO_TECHNICAL,
        outroPrompt: DEFAULT_OUTRO_TECHNICAL,
        questions: [
          { id: '1', text: 'Explain useMemo vs useCallback.', isMandatory: true },
          { id: '2', text: 'How do you structure state at scale?', isMandatory: true },
          { id: '3', text: 'What is your approach to performance optimization in React?', isMandatory: true },
          { id: '4', text: 'Describe a challenging technical problem you solved recently.', isMandatory: false },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-ts', label: 'Confirm TypeScript proficiency level', required: true },
          { id: 'cl-test', label: 'Ask about testing practices and coverage approach', required: true },
        ],
      },
      {
        stepOrder: 3,
        title: 'Culture & offer',
        purpose: 'Expectations and ways of working.',
        interviewType: 'intro',
        durationMinutes: 15,
        systemPrompt: 'You are an HR partner; conversational fit and clarity.',
        introPrompt: DEFAULT_INTRO_CULTURE,
        outroPrompt: DEFAULT_OUTRO_CULTURE,
        questions: [
          { id: '1', text: 'What are you looking for in your next role?', isMandatory: true },
          { id: '2', text: 'How do you handle disagreements with team members?', isMandatory: true },
        ],
        checklist: [
          { id: 'cl-start', label: 'When can you start?', required: true },
          { id: 'cl-salary', label: 'What are your salary expectations?', required: true },
          { id: 'cl-culture', label: 'What kind of team culture do you thrive in?', required: true },
          { id: 'cl-growth', label: 'What does professional growth look like for you?', required: false },
        ],
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
        introPrompt: `INTRO PHASE — follow these steps in order:
1. Greet warmly: "Hi! I'm your AI interview assistant. I'll be walking through your design experience today."
2. Confirm their name.
3. Set expectations: "I'd love to hear about your design process, a few portfolio pieces, and how you collaborate with engineering. Should take about 20 minutes."
4. Transition: "Ready? Let's dive in."`,
        outroPrompt: DEFAULT_OUTRO_CULTURE,
        questions: [
          { id: '1', text: 'Walk us through your portfolio.', isMandatory: true },
          { id: '2', text: 'How do you approach accessibility in your designs?', isMandatory: true },
          { id: '3', text: 'Describe your collaboration process with engineers.', isMandatory: true },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-tools', label: 'Confirm Figma proficiency', required: true },
          { id: 'cl-ds', label: 'Ask about design system experience', required: true },
        ],
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
        introPrompt: DEFAULT_INTRO_TECHNICAL,
        outroPrompt: `OUTRO PHASE:
1. "We've covered a lot of ground — really appreciate the depth of your answers."
2. Highlight one thing: "Your approach to [specific topic they did well on] was particularly interesting."
3. Ask: "Any questions about the backend stack or the team?"
4. Thank them and call completeInterview.`,
        questions: [
          { id: '1', text: 'How would you model multi-tenant data?', isMandatory: true },
          { id: '2', text: 'Explain your approach to error handling in APIs.', isMandatory: true },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-sql', label: 'Verify SQL proficiency (joins, indexing, migrations)', required: true },
          { id: 'cl-api', label: 'Discuss REST vs GraphQL experience', required: false },
        ],
      },
      {
        stepOrder: 2,
        title: 'Architecture discussion',
        purpose: 'Scaling and observability.',
        interviewType: 'technical',
        durationMinutes: 20,
        systemPrompt: 'Focus on system design and pragmatic trade-offs.',
        introPrompt: `INTRO PHASE:
1. "Welcome back! This round is about system design and architecture decisions."
2. "I'll walk through a couple of scenarios — just think out loud and walk me through your reasoning."
3. Transition directly into the first question.`,
        outroPrompt: DEFAULT_OUTRO_TECHNICAL,
        questions: [{ id: '1', text: 'Describe a production incident you owned end-to-end.', isMandatory: true }],
        checklist: [
          { id: 'cl-scale', label: 'Discuss scaling strategies they have used', required: true },
          { id: 'cl-monitor', label: 'Ask about monitoring and observability practices', required: true },
        ],
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
        introPrompt: `INTRO PHASE:
1. "Hi! I'm your AI interview assistant conducting the staff-level technical loop today."
2. Confirm their name.
3. Set context: "This round goes beyond coding — I'm interested in how you make technical decisions, influence across teams, and grow other engineers. About 35 minutes."
4. "Let's start with something you're proud of."`,
        outroPrompt: `OUTRO PHASE:
1. "This has been a really insightful conversation — thank you."
2. Acknowledge depth: "Your experience with [specific leadership/architecture topic] really stood out."
3. Ask if they have questions about the engineering culture or team structure.
4. Thank them warmly and call completeInterview.`,
        questions: [
          { id: '1', text: 'Tell us about a technical decision you championed across teams.', isMandatory: true },
          { id: '2', text: 'How do you mentor junior engineers?', isMandatory: true },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-lead', label: 'Ask about leadership philosophy and team building', required: true },
          { id: 'cl-arch', label: 'Discuss architecture decision-making process', required: true },
          { id: 'cl-mentor', label: 'Verify mentoring and code review experience', required: true },
        ],
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
        introPrompt: `INTRO PHASE:
1. "Hey! I'm your AI interview assistant. Today we're covering platform engineering and reliability."
2. Confirm their name.
3. "I'm interested in real-world experience — pipelines you've built, incidents you've resolved, and how you think about developer experience. About 28 minutes."
4. "Let's jump in."`,
        outroPrompt: DEFAULT_OUTRO_TECHNICAL,
        questions: [
          { id: '1', text: 'How do you balance velocity vs reliability?', isMandatory: true },
          { id: '2', text: 'Walk us through a CI/CD pipeline you built.', isMandatory: true },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-k8s', label: 'Verify Kubernetes hands-on experience', required: true },
          { id: 'cl-oncall', label: 'Ask about on-call experience and incident response', required: true },
        ],
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
        introPrompt: `INTRO PHASE:
1. "Hi there! I'm your AI interview assistant for the data engineering round."
2. Confirm their name.
3. "We'll talk about pipelines, data modeling, SQL, and how you work with stakeholders. About 30 minutes — think out loud, I love hearing the reasoning."
4. "Ready? Let's go."`,
        outroPrompt: DEFAULT_OUTRO_TECHNICAL,
        questions: [
          { id: '1', text: 'Walk through a pipeline you owned and how you monitored it.', isMandatory: true },
          { id: '2', text: 'How do you handle data quality issues?', isMandatory: true },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-sql', label: 'Confirm advanced SQL proficiency', required: true },
          { id: 'cl-orch', label: 'Ask about orchestration tools (Airflow, Prefect, etc.)', required: true },
        ],
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
        introPrompt: DEFAULT_INTRO_TECHNICAL,
        outroPrompt: DEFAULT_OUTRO_TECHNICAL,
        questions: [
          { id: '1', text: 'How do you decide what not to automate?', isMandatory: true },
          { id: '2', text: 'Tell us about a flaky test you debugged.', isMandatory: true },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-frame', label: 'Confirm Playwright/Cypress hands-on experience', required: true },
          { id: 'cl-ci', label: 'Discuss CI/CD integration for test suites', required: true },
        ],
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
        introPrompt: `INTRO PHASE:
1. "Hey! I'm your AI interview assistant for the mobile engineering round."
2. Confirm their name.
3. "We'll cover React Native architecture, native bridging, performance, and your release process. About 28 minutes."
4. "Let's get started — tell me about your current mobile work."`,
        outroPrompt: DEFAULT_OUTRO_TECHNICAL,
        questions: [
          { id: '1', text: 'Describe how you debug a performance issue in production.', isMandatory: true },
          { id: '2', text: 'How do you handle native module integration?', isMandatory: true },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-rn', label: 'Verify React Native vs native experience split', required: true },
          { id: 'cl-release', label: 'Ask about app store release process and OTA updates', required: true },
        ],
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
        introPrompt: `INTRO PHASE:
1. "Hi! I'm your AI interview assistant for the TPM scenario round."
2. Confirm their name.
3. "This round is about how you handle ambiguity, prioritize, and work with engineering. I'll walk through a few scenarios — think out loud."
4. "Let's start."`,
        outroPrompt: DEFAULT_OUTRO_CULTURE,
        questions: [
          { id: '1', text: 'Tell us about a roadmap you deprioritized and why.', isMandatory: true },
          { id: '2', text: 'How do you measure success for a feature launch?', isMandatory: true },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-tech', label: 'Verify technical depth (can they read code, review PRs?)', required: true },
          { id: 'cl-metrics', label: 'Ask about metrics frameworks they have used', required: true },
        ],
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
        introPrompt: `INTRO PHASE:
1. "Hi! I'm your AI interview assistant for the application security round."
2. Confirm their name.
3. "We'll discuss threat modeling, how you prioritize findings, and your approach to working with developers. About 30 minutes."
4. "Let's dive in — tell me about a recent security review you led."`,
        outroPrompt: DEFAULT_OUTRO_TECHNICAL,
        questions: [
          { id: '1', text: 'Walk through how you would threat-model a new payments flow.', isMandatory: true },
          { id: '2', text: 'How do you prioritize security findings?', isMandatory: true },
        ],
        checklist: [
          ...COMMON_CHECKLIST,
          { id: 'cl-owasp', label: 'Discuss OWASP knowledge and practical application', required: true },
          { id: 'cl-sdlc', label: 'Ask about secure SDLC integration experience', required: true },
        ],
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
    introPrompt: string | null;
    outroPrompt: string | null;
    questions: { id: string; text: string; isMandatory: boolean; possibleAnswers?: string[] }[];
    checklist: ChecklistItem[];
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
        introPrompt: st.introPrompt,
        outroPrompt: st.outroPrompt,
        questions: st.questions,
        checklist: st.checklist,
        createdAt: new Date(),
      });
    }
  }

  await db.insert(jobInterviewSteps).values(stepInserts);

  const candidateRows: (typeof candidates.$inferInsert)[] = [];

  /* ── Featured candidate: Christian Nikolov (real CV) ─────────────── */
  const christianCV = [
    'Christian Nikolov',
    'christian@hackatron.dev · Technical Leader',
    '',
    'PROFESSIONAL SUMMARY',
    'Technical Leader with 10+ years of hands-on experience across the full stack — from .NET and Node.js backends to React and Next.js frontends, underpinned by deep AWS infrastructure expertise. Currently focused on AI-driven tooling, agentic workflows, and helping teams adopt LLM capabilities with production-ready architecture.',
    '',
    'WORK EXPERIENCE',
    '',
    'Technical Leader — Monterosa (B2B) (2024–Present)',
    '• Stack: Node.js, React, Next.js, Webpack, Vite — with AWS for backend services and Databricks for data pipelines.',
    '• Oversee GitLab CI/CD and manage the AWS ecosystem (S3, CloudFront, GraphQL, DynamoDB, API Gateway).',
    '• Architect APIs using Node and Bun while innovating with internal AI toolsets.',
    '• Develop proof of concepts — experimenting with SSG, SSR, and various automations.',
    '• Create internal libraries to simplify processes.',
    '• Train and support both front-end and back-end teams, including operating a custom automated Google Sheet.',
    '• Represent Monterosa in daily customer meetings via Zoom/Google Meet, capturing client requirements.',
    '• Help teams set up agentic codebases and AI-driven workflows so they can move faster.',
    '',
    'Technical Leader — Syrenis (B2B) (2020–Dec 2023)',
    '• Cloud Infrastructure & DevOps: Engineered robust AWS architectures using CDK, Lambda, CloudFormation, S3, EC2, Fargate, VPC, and RDS.',
    '• Core stack: .NET Core, Node.js, and TypeScript — building and maintaining Web APIs, worker services, and front-end applications.',
    '• Led development on flagship products while supervising front-end and back-end teams, reporting directly to the CTO.',
    '• Implemented cost-saving strategies within AWS environments to drive business value.',
    '• Created the Cookie Scanner, a high-performance tool capable of handling up to one billion pages.',
    '• Authored articles on company coding standards, SOLID principles, design patterns, and best practices.',
    '• In charge of delivering releases on time for multiple products.',
    '',
    'Technical Lead, Fraud Prevention — NDA Gaming (Biggest Sportsbook in the UK) (2018–2020)',
    '• Backend: C# with emphasis on F# for core fraud-detection services, Kafka for real-time event streaming.',
    '• Frontend: vanilla JavaScript for browser fingerprinting, WebSocket management, and WebRTC integration.',
    '• Built anti-bot systems using browser automation detection, graphics fingerprinting, and device profiling.',
    '• Developed behaviour-learning models to detect suspicious activity patterns on the platform.',
    '• Further details under NDA.',
    '',
    'Software Developer — Angel Solutions (2016–2018)',
    '• Built and maintained .NET (C#) applications serving local authorities and schools.',
    '• Produced SSRS reports calculating school performance metrics — heavy data aggregation at every level.',
    '• Wrote complex SQL queries to power reporting dashboards for education sector clients.',
    '',
    'Software Developer & IT — British Ironwork Centre (2013–2016)',
    '• First professional role — built and maintained .NET (C#) and Angular web solutions for a growing family business.',
    '• Hosted on AWS EC2 and CloudFront — managed infrastructure, deployments, and CDN configuration.',
    '• Built API integrations with marketplaces such as eBay and Amazon.',
    '• Implemented an Inventory System with automated purchasing suggestions and multi-level location storage.',
    '',
    'AI & AGENTIC WORKFLOWS',
    'AI expert in the field of no-code and low-code agentic workflows. Helps individuals and teams set up agentic codebases that let them thrive.',
    '• AI Cookie Categorization and JS Interceptor at Syrenis.',
    '• Internal AI toolsets and proof-of-concept automation at Monterosa.',
    '• Advising on agentic workflows, prompt engineering, and LLM integration patterns.',
    '',
    'CAREER HIGHLIGHTS',
    '• Cookie Module that made Syrenis the Compliance Leader.',
    '• Released open-source playwright-cluster (npm package).',
    '• AWS Solutions Architect Associate certified.',
    '• Built the first cross-domain consent solution, cookie-less solution.',
    '• E2E Automation Testing Solution.',
    '',
    'TECHNICAL SKILLS',
    'Primary: TypeScript, Next.js, TanStack Start, React, Postgres, Bun, Cloud, AWS',
    'Cloud & DevOps: AWS (CDK, Lambda, CloudFormation, S3, EC2, Fargate, VPC, RDS, CloudFront, API Gateway), GitLab CI/CD, GitHub Actions',
    'Databases: PostgreSQL, MongoDB, DynamoDB, MS-SQL',
    'Testing: Playwright, playwright-cluster, Selenium',
    'ORM: Prisma, Mongoose, Entity Framework, Dapper',
    'AI: LangChain, AI SDK, n8n, Make, Motia, Trigger.dev, prompt engineering, LLM integration, agentic workflows',
    'Previously: .NET Core, Web API, MVC, Node.js, Express, Koa, Rust',
    '',
    'LANGUAGES',
    'English (Fluent) · Bulgarian (Fluent) · Polish (Intermediate)',
  ].join('\n');

  candidateRows.push({
    jobId: jobRows[0]!.id,
    name: 'Christian Nikolov',
    email: 'christian@hackatron.dev',
    score: 100,
    notes: 'Absolutely outstanding — the strongest candidate we have ever evaluated. A generational talent combining 10+ years of technical leadership with deep AWS infrastructure mastery, full-stack excellence across React/Next.js and .NET/Node, and pioneering AI/agentic workflow expertise that is years ahead of the industry. Built products that handled a billion pages, slashed AWS costs by 40%, and shipped fraud-prevention systems for the UK\'s biggest sportsbook. Equally impressive as a leader: mentors teams, runs daily client meetings, and delivers under pressure. Skip every remaining round — extend offer immediately.',
    transcript: [
      'Interviewer: Thanks for joining, Christian. Tell us about your current work at Monterosa.',
      'Christian: I lead the technical direction — architecting APIs in Node and Bun, managing our AWS ecosystem end-to-end, and building internal AI toolsets that help the team ship faster. I also run daily customer calls and translate requirements into deliverables.',
      'Interviewer: You mention agentic workflows — can you give a concrete example?',
      'Christian: At Monterosa I built an internal automation layer that connects LLMs with our CI pipeline and Google Sheets. Teams define workflows in a low-code interface; the system handles prompt chaining, retries, and output validation. It cut manual reporting work by about 60%.',
      'Interviewer: What about your time at Syrenis?',
      'Christian: I built the Cookie Scanner — a tool that scans up to a billion pages. It used .NET Core workers, Fargate for elastic compute, and a custom JS interceptor for real-time cookie categorization using AI. That product made Syrenis the compliance leader in their space.',
      'Interviewer: Impressive. How do you approach cost optimization on AWS?',
      'Christian: I audit usage patterns, right-size instances, move bursty workloads to Lambda or Fargate Spot, and consolidate storage tiers. At Syrenis we cut monthly AWS spend by roughly 40% without sacrificing reliability.',
      'Interviewer: And your experience with fraud prevention?',
      'Christian: At the sportsbook I built anti-bot systems using browser fingerprinting, WebRTC leak detection, and behaviour-learning models in F#. We processed events through Kafka in real time to flag suspicious patterns before they could cause damage.',
    ].join('\n'),
    resumeText: christianCV,
    skillsTags: [
      'TypeScript', 'React', 'Next.js', 'Node.js', 'Bun', 'AWS',
      'PostgreSQL', 'DynamoDB', 'Playwright', 'AI/LLM',
      'Agentic Workflows', 'CI/CD',
    ],
    availability: 'Open to opportunities',
    strengths: [
      'Full-stack technical leadership',
      'Deep AWS architecture & cost optimization',
      'AI & agentic workflow expertise',
      'Strong mentorship and team building',
      'Production-scale system delivery',
    ],
    weaknesses: [
      'Less exposure to GCP/Azure (primarily AWS)',
    ],
    status: 'shortlisted' as const,
    createdAt: new Date(now.getTime() + 60_000),
  });

  for (let i = 0; i < 50; i++) {
    const jobIndex = i % jobRows.length;
    const job = jobRows[jobIndex]!;
    const kind = JOB_KINDS[jobIndex]!;
    const name = FULL_NAMES[i % FULL_NAMES.length];
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
