What is an Agent?
An agent is a piece of software that allows your backend server to participate in a Fishjam room, similar to how the Fishjam client SDKs allow your client-side application to participate in a Fishjam room. They can be used to implement features such as real-time audio transcription, real-time content moderation, conversations with AI agents and more.

You can simply think of an agent as a peer running within your backend application.

Writing an Agent
In this section we show how to implement an agent using the Fishjam server SDKs. If you are not using the SDKs, then you can check out the Agent Internals, to learn how to integrate with Fishjam Agents.

Prerequisites
Before we create the actual agent, we need to create a room first, as agents are scoped to rooms. Additionally, we will also create a peer so that the agent has someone to listen to and talk to.

TypeScript
Python
Copy
import { FishjamClient } from '@fishjam-cloud/js-server-sdk';
const fishjamClient = new FishjamClient({ fishjamId, managementToken });
const room = await fishjamClient.createRoom();
const peer = await fishjamClient.createPeer(room.id);
Creating a listening Agent
If you are using the server SDKs, then creating an agent and defining its behavior is very simple. By default, agents receive all peers' audio streams. However, it's likely that in your scenario you'll want to use the Selective Subscriptions API for fine-grained control over which peers/tracks they should receive audio from.

TypeScript
Python
Copy
import type { AgentCallbacks, PeerOptions } from '@fishjam-cloud/js-server-sdk';
const agentOptions = {
  subscribeMode: 'auto',
  output: { audioFormat: 'pcm16', audioSampleRate: 16000 }
} satisfies PeerOptions;
const agentCallbacks = {
  onError: console.error,
  onClose: (code, reason) => console.log('Agent closed', code, reason)
} satisfies AgentCallbacks;
const { agent } = await fishjamClient.createAgent(room.id, agentOptions, agentCallbacks);
// Register a callback for incoming audio data
agent.on('trackData', ({ track, peerId, data }) => {
  // process the incoming data
})
Multiple Agents in a Room
You can create multiple agents inside a single room by creating agents with the same room ID multiple times. Each agent operates independently, with its own set of tracks and callbacks.

TypeScript
Python
Copy
const agentCallbacks1 = {
  onError: console.error,
  onClose: (code, reason) => console.log('Agent 1 closed', code, reason)
} satisfies AgentCallbacks;
const agentCallbacks2 = {
  onError: console.error,
  onClose: (code, reason) => console.log('Agent 2 closed', code, reason)
} satisfies AgentCallbacks;
const { agent: agent1 } = await fishjamClient.createAgent(room.id, agentOptions, agentCallbacks1);
const { agent: agent2 } = await fishjamClient.createAgent(room.id, agentOptions, agentCallbacks2);
Making the Agent speak
Apart from just listening, agents can also send audio data to peers.
Let's assume that in the previous section we forwarded the peer's audio to some audio chatbot. Now, the chatbot returns responses, and we want to play it back to the peer.

tip
You can interrupt the currently played audio chunk. See the example below.

TypeScript
Python
Copy
import { type AudioCodecParameters } from '@fishjam-cloud/js-server-sdk';
const codecParameters = {
  encoding: 'pcm16',
  sampleRate: 16000,
  channels: 1,
} satisfies AudioCodecParameters;
const agentTrack = agent.createTrack(codecParameters);
// that's a dummy chatbot,
// you can bring your audio from anywhere
chatbot.on('response', (response: Uint8Array) => {
  agent.sendData(agentTrack.id, response);
  // you're able to interrupt the currently played audio chunk
  agent.interruptTrack(agentTrack.id);
});
Making the Agent see
Agents can also request video frames (JPEG images) from peers' video tracks. Unlike audio, which streams continuously, video frames must be explicitly requested and arrive asynchronously.

important
Video frame capture is rate-limited to one frame per second per track.

TypeScript
Python
Copy
import type { IncomingTrackImage } from '@fishjam-cloud/js-server-sdk';
// Listen for incoming video frames
agent.on('trackImage', (message: IncomingTrackImage) => {
  const { contentType, data } = message;
  // process the image data
});
// Request a frame periodically
setInterval(() => {
  agent.captureImage(trackId);
}, 1000);