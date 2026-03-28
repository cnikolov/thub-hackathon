# REST API Endpoints Specification

Below are the intended REST API endpoints exposed by `apps/api` for the `frontend` to consume.

## Authentication (Basic JWT)
- `POST /api/auth/login`: Issue an access token.
- `GET /api/auth/me`: Decrypt token, return User context.

## Jobs
- `GET /api/jobs`: List open positions for a project.
- `POST /api/jobs`: Create a new Job. Initiates a `bun` background task extracting text from an uploaded PDF, sending it to Gemini, generating `Job.systemPrompt` and saving the resulting entities to `jobs` and `questions`.
- `GET /api/jobs/:code`: Verify a `shareCode` provided by a candidate on the frontend landing page. 

## Candidates
- `GET /api/candidates`: Return candidate records.
- `GET /api/candidates/:candidateId`: Fetch detailed candidate assessment, transcript, scoring arrays, and linked WebRTC recordings.

## Real-Time Audio (Fishjam)
- `POST /api/interview/init`:
  - Validates `Candidate` and `Job`.
  - API calls the local **Fishjam** instance Server SDK to create a Room.
  - API requests a Peer Token from Fishjam for the React Client.
  - API instantiates a Node-based Gemini Live API session attached to the created Room/Candidate ID.
  - Returns `{ roomUrl, peerToken }` back to the Candidate `frontend`.

## WebSockets
- `WSS /ws/live-assessment`: Stream score updates (`updateAssessment`) from the API server to the React UI in real-time, modifying the Candidate dashboard Live Scoring UI.
