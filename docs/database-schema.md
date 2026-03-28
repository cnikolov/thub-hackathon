# Database Schema (Drizzle ORM for SQLite)

TeamHub uses `bun:sqlite` with Drizzle ORM for blistering fast local data persistence.

## Tables & Definitions

### `projects`
- `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
- `name`: `TEXT NOT NULL`
- `description`: `TEXT`
- `ownerId`: `TEXT NOT NULL` (maps to an external identity or JWT)
- `createdAt`: `INTEGER DEFAULT (cast(unixepoch() as int))`

### `jobs`
- `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
- `projectId`: `INTEGER NOT NULL REFERENCES projects(id)`
- `title`: `TEXT NOT NULL`
- `description`: `TEXT NOT NULL`
- `requirements`: `TEXT NOT NULL`
- `systemPrompt`: `TEXT NOT NULL`
- `shareCode`: `TEXT UNIQUE NOT NULL`
- `status`: `TEXT DEFAULT 'open'` ('open', 'closed')
- `interviewType`: `TEXT DEFAULT 'intro'` ('intro', 'technical')
- `durationMinutes`: `INTEGER DEFAULT 15`
- `createdAt`: `INTEGER DEFAULT (cast(unixepoch() as int))`

### `questions`
- `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
- `jobId`: `INTEGER NOT NULL REFERENCES jobs(id)`
- `text`: `TEXT NOT NULL`
- `isMandatory`: `INTEGER DEFAULT 1` (Boolean flag)
- `possibleAnswers`: `TEXT` (JSON encoded string array of answers)

### `candidates`
- `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
- `jobId`: `INTEGER NOT NULL REFERENCES jobs(id)`
- `name`: `TEXT NOT NULL`
- `email`: `TEXT NOT NULL`
- `score`: `INTEGER` (Out of 100)
- `notes`: `TEXT`
- `transcript`: `TEXT`
- `strengths`: `TEXT` (JSON array)
- `weaknesses`: `TEXT` (JSON array)
- `status`: `TEXT DEFAULT 'pending'` ('pending', 'interviewed', 'shortlisted', 'rejected')
- `createdAt`: `INTEGER DEFAULT (cast(unixepoch() as int))`

## Schema Migration & Seeding
Migrations are kept in `apps/api/drizzle` and are applied automatically upon API startup during development (`bunx drizzle-kit push:sqlite`). Drizzle provides raw type-safety natively accessible in `packages/types/schema.ts`.
