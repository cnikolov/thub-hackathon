# TeamHub

AI-powered hiring platform with live voice interviews via Google Gemini.

## Prerequisites

- [Bun](https://bun.sh/) v1.1+
- A [Google Gemini API key](https://aistudio.google.com/apikey)
- A [Fishjam Cloud](https://fishjam.io/) account (for WebRTC)

## Install

```bash
bun install
```

## Configure

Create `apps/api/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key
FISHJAM_ID=your-fishjam-app-id
FISHJAM_MANAGEMENT_TOKEN=your-fishjam-management-token
```

## Database

Push the schema and seed sample data:

```bash
cd apps/api
bun run db:push
bun run db:seed
```

`db:push` creates the SQLite database (`dev.db`) with all tables. `db:seed` populates it with sample projects, jobs, and interview steps so you have something to work with immediately.

To inspect the database visually:

```bash
bun run db:studio
```

## Run

From the project root:

```bash
bun run dev
```

This starts both services concurrently:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:3001 |

The frontend proxies `/api` and `/ws` requests to the API automatically — no extra config needed.

## Usage

1. Open http://localhost:5173 and log in (any email works, auth is simplified for the hackathon).
2. Create a project and add a job posting. Gemini will analyze it and generate an interview plan.
3. Copy the **share code** from the job.
4. Open http://localhost:5173/interview in a new tab (or incognito). Enter the share code, your name, and email.
5. Allow mic/camera access, then start the interview. Gemini will conduct the interview live via voice.
6. After the interview, go back to the recruiter view to see the candidate's score, transcript, and AI evaluation.

## Project structure

```
thub/
├── apps/
│   ├── api/             # Bun + Hono + SQLite backend
│   │   └── src/
│   │       ├── index.ts         # Server entry point (port 3001)
│   │       ├── schema.ts        # Database schema (Drizzle ORM)
│   │       ├── seed.ts          # Database seeder
│   │       ├── rooms.ts         # Interview session routes
│   │       ├── candidates.ts    # Candidate CRUD + search
│   │       ├── jobs.ts          # Job posting routes
│   │       ├── interview/       # Live interview engine
│   │       │   ├── agent.ts     # Fishjam agent orchestration
│   │       │   ├── gemini.ts    # Gemini Live API connection
│   │       │   ├── prompts.ts   # AI interviewer system prompts
│   │       │   ├── sessions.ts  # Session lifecycle
│   │       │   └── ws.ts        # WebSocket hub
│   │       └── services/
│   │           ├── gemini.ts    # Scoring, analysis, CV extraction
│   │           └── embeddings.ts
│   └── frontend/        # React 19 + Vite + Tailwind v4
│       └── src/
│           ├── pages/
│           │   ├── InterviewView.tsx   # Candidate interview UI
│           │   ├── Candidates.tsx      # Recruiter pipeline view
│           │   └── ...
│           └── lib/
│               ├── api.ts       # HTTP client
│               └── ws.ts        # WebSocket client
└── packages/
    └── types/           # Shared TypeScript types
```

## Useful commands

```bash
bun run dev              # Start everything
cd apps/api
  bun run db:push        # Create/update database schema
  bun run db:seed        # Seed sample data
  bun run db:studio      # Open Drizzle Studio (DB browser)
cd apps/frontend
  bun run build          # Production build
  bun run lint           # ESLint
```
