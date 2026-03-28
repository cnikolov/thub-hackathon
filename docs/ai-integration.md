# Google Gemini AI Integrations

The TeamHub platform relies heavily on the `@google/genai` (v1.29+) SDK within the local Node/Bun API ecosystem.

## Real-Time Audio (Live Preview API)
The core candidate experience relies on `gemini-3.1-flash-live-preview`. The API manages real-time active WebSocket connections with Google servers.

- **System Prompting:** When a Live session starts, a `systemInstruction` instructs the AI to behave as a warm HR interviewer, armed with mandatory questions mapped from the `jobs` SQLite database.
- **Audio Routing:** The backend receives media packets from Fishjam and converts them into `base64` strings encoded at `16000Hz` for the Gemini SDK to interpret.
- **Streaming Audio Out:** The AI returns raw PCM byte responses. The backend buffers these into nodes and plays them to the Fishjam Room.
- **Tool Calling (Assessments):** Gemini natively triggers a custom function named `updateAssessment`. The backend receives the `{ score, notes }` arguments, immediately updates the UI dashboard via WebSockets, and logs them into SQLite.

## Static Inference Models
Beyond real-time interview operations, the TeamHub architecture implements `gemini-3.1-pro` for asynchronous processing of long-form context windows.

- **Automated Resume Parsing:** Converting uploaded PDF documents (using `pdfjs-dist`) into extracted raw text and sending the text to the AI to auto-generate `Job` specifications.
- **Drafting Interview Forms:** Based on the AI analysis of standard Job Descriptions, Gemini automatically populates a list of mandatory and optional interview questions for the specific position parameters (Technical vs Cultural).
- **Final Transcript Analysis:** Post-interview, `scoreCandidate` is called, feeding the entire conversational log into Gemini to summarize Candidate "Areas of Growth" and final recommendations.
