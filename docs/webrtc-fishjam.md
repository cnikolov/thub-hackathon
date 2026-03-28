# GenAI & WebRTC Integration (Fishjam)

The most robust architectural upgrade for TeamHub is moving from simple client-sided logic to a localized Server/SFU driven connection using **Fishjam**.

## The Flow

### 1. `docker-compose.yml`
The root directory will contain a container orchestration file specifically for Fishjam:
```yaml
version: "3"
services:
  fishjam:
    image: softwaremansion/fishjam:latest
    ports:
      - "5002:5002" # HTTP API
      - "50000-50050:50000-50050/udp" # WebRTC ICE Traffic
    environment:
      - FISHJAM_PORT=5002
```

### 2. Client Side (`apps/frontend`)
The candidate UI (`InterviewView.tsx`) utilizes the Fishjam Client SDK. When the UI mounts, it requests an audio track from the microphone (`getUserMedia`) and adds the track directly to the Fishjam Room.
```ts
const fishjam = new FishjamClient();
await fishjam.connect(peerToken);
fishjam.addTrack(stream.getAudioTracks()[0]);
```

### 3. Server Side (`apps/api`)
The API handles two duties using `@google/genai` and `@fishjam-cloud/server-sdk-node`:

**Bridging Fishjam to Gemini:**
1. Use the `fishjam-server-sdk` to ingest the stream on the backend or consume the outbound streams natively.
2. The incoming WebRTC stream is transcribed into raw PCM buffers.
3. The PCM buffers are automatically serialized into `base64` strings and written directly into the `session.sendRealtimeInput({ audio: ... })` method of the Gemini SDK.

**Bridging Gemini out to Fishjam:**
1. The AI voice yields raw 16kHz PCM frames in `message.serverContent.modelTurn.parts`.
2. The `api` will utilize an internal MediaServer implementation or WebRTC injection technique to route the audio directly into the Fishjam room target, meaning the Candidate hears the AI organically within the Fishjam room instead of via standard REST response cycles.

### 4. Live Scoring
While Gemini interacts with the user, it is instructed to call a specific tool via `functionDeclarations: [ { name: "updateAssessment" } ]`. When this executes, the `api` will emit the results over a WebSocket to mutate the Candidate dashboard in real-time.
