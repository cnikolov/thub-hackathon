# System Architecture

## Overview
TeamHub is structured as a high-performance **Bun Monorepo** tailored for developer velocity. The system operates entirely on native, lightweight dependencies, replacing Firebase with an API-driven SQLite architecture and replacing standard WebRTC flows with **Fishjam** as the scalable media SFU.

## Monorepo Structure (Bun Workspaces)

The codebase leverages Bun workspaces to seamlessly share TypeScript definitions between the API and the Frontend without publish steps or build configurations.

```text
thub/
├── apps/
│   ├── frontend/        # React 19 + Vite UI
│   └── api/             # Bun + Hono/ElysiaJS Backend
├── packages/
│   └── types/           # Shared TypeScript models (User, Job, Candidate)
├── docs/                # Architecture specifications
├── package.json         # Workspace root configuration
└── docker-compose.yml   # Fishjam Media Server setup
```

## System Components

### 1. Frontend (`apps/frontend`)
- **Framework:** React 19, powered by Vite.
- **Styling:** Tailwind CSS V4 for ultra-fast compilation, Lucide React for iconography, Motion for animations.
- **State Management:** Custom hooks interfacing with the `apps/api` endpoints.
- **Responsibilities:** Renders the Dashboard, Job Boards, and the Candidate WebRTC Interview interface. Captures candidate microphone data and streams it through the Fishjam Client SDK.

### 2. API Server (`apps/api`)
- **Runtime:** Bun.
- **Framework:** Hono or ElysiaJS for maximum throughput and minimal overhead.
- **Database Connection:** Native `bun:sqlite` driven by Drizzle ORM.
- **AI Integration:** Implements the Google GenAI SDK (`@google/genai`) to manage Live API sessions, proxying audio chunks from the frontend directly to Gemini.
- **WebRTC Signalling:** Communicates with the local Fishjam instance via its Server SDK to create Rooms, ingest logic, and mint `peerTokens` for connecting candidates.

### 3. Database (`sqlite`)
- Embedded directly alongside the Node/Bun API process, yielding sub-millisecond query times.
- State is preserved in a local `database.sqlite` file.

### 4. Realtime Media Server (Fishjam)
- **Deployment:** A local container managed via Docker Compose.
- **Role:** WebRTC Selective Forwarding Unit (SFU). Handles all the STUN/TURN, ICE-negotiation, and active media routing between candidates, the API server, and eventually transcript logs.

## Flow Diagram: Candidate Interview (WebRTC + GenAI)

1. Candidate enters a `shareCode` into the `frontend`.
2. `frontend` hits the `api` which verifies the code against the SQLite DB.
3. If valid, `api` mints a Fishjam Peer Token and starts a Gemini Live API Session initialized with the Job's `systemPrompt` and Interview Questions.
4. `frontend` joins the Fishjam room using the Client SDK.
5. The `api` continually receives Fishjam audio streams, translates them to base64 PCM, and streams them to Gemini.
6. Gemini returns AI voice (PCM), which the `api` plays back into the Fishjam room. Gemini also calls tool endpoints (`updateAssessment`) dynamically updating the `frontend` score.
7. Post-interview, `api` stores the complete transcript and AI-generated strengths/weaknesses in SQLite.
