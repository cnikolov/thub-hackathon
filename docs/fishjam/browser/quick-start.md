Set up Fishjam context
Wrap your app in the FishjamProvider component:

Copy
// Check https://fishjam.io/app/ for your Fishjam ID
const FISHJAM_ID = "YOUR_FISHJAM_ID";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FishjamProvider fishjamId={FISHJAM_ID}>
      <App />
    </FishjamProvider>
  </React.StrictMode>,
);
Step 2: Join a room and start streaming
Create a component that joins a room and starts streaming:

Copy
import React from "react";
import {
  useConnection,
  useCamera,
  useInitializeDevices,
  useSandbox,
} from "@fishjam-cloud/react-client";
export function JoinRoomButton() {
  const { joinRoom } = useConnection();
  const { selectCamera } = useCamera();
  const { initializeDevices } = useInitializeDevices();
  const { getSandboxPeerToken } = useSandbox();
  const handleJoinRoom = async () => {
    const roomName = "testRoom";
    const peerName = "testUser";
    // In sandbox environment, you can get the peer token from our sandbox API
    // In production environment, you need to get it from your backend
    const peerToken = await getSandboxPeerToken(roomName, peerName);
    // Start camera by selecting the first available camera
    await initializeDevices({ enableAudio: false }); // or just initializeDevices(); if you want both camera and mic
    // Join the room
    await joinRoom({ peerToken });
  };
  return <button onClick={handleJoinRoom}>Join Room</button>;
}
Step 3: Display other participants
Show video from other peers:

Copy
import React from "react";
import { useEffect, useRef } from "react";
import { usePeers } from "@fishjam-cloud/react-client";
function VideoPlayer({ stream }: { stream: MediaStream | null | undefined }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream ?? null;
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline />;
}
export function ParticipantsView() {
  const { remotePeers } = usePeers();
  return (
    <div>
      {remotePeers.map((peer) => (
        <div key={peer.id}>
          {peer.cameraTrack?.stream && (
            <VideoPlayer stream={peer.cameraTrack.stream} />
          )}
        </div>
      ))}
    </div>
  );
}
Step 4: Display your video
Show your own video stream:

Copy
import React from "react";
import { useCamera } from "@fishjam-cloud/react-client";
export function MyVideo() {
  const { cameraStream } = useCamera();
  return <VideoPlayer stream={cameraStream} />;
}
Step 5: Handle connection status
Monitor your connection:

Copy
import React from "react";
import { useConnection } from "@fishjam-cloud/react-client";
export function ConnectionStatus() {
  const { peerStatus } = useConnection();
  return <div>Status: {peerStatus}</div>;
}
Complete example
Here's a complete working app:

Copy
function VideoPlayer({ stream }: { stream: MediaStream | null | undefined }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream ?? null;
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline />;
}
function VideoCall() {
  const { joinRoom, peerStatus } = useConnection();
  const { cameraStream } = useCamera();
  const { remotePeers } = usePeers();
  const { initializeDevices } = useInitializeDevices();
  const { getSandboxPeerToken } = useSandbox();
  const [isJoined, setIsJoined] = useState(false);
  const handleJoin = async () => {
    const roomName = "testRoom";
    const peerName = `user_${Date.now()}`;
    // Initialize devices first
    await initializeDevices();
    // In sandbox environment, you can get the peer token from our sandbox API
    // In production environment, you need to get it from your backend
    const peerToken = await getSandboxPeerToken(roomName, peerName);
    await joinRoom({ peerToken });
    setIsJoined(true);
  };
  return (
    <div>
      <h1>Fishjam Video Call</h1>
      <p>Status: {peerStatus}</p>
      {!isJoined && <button onClick={handleJoin}>Join Room</button>}
      {cameraStream && (
        <div>
          <h3>Your Video</h3>
          <VideoPlayer stream={cameraStream} />
        </div>
      )}
      <div>
        <h3>Other Participants</h3>
        {remotePeers.map((peer) => (
          <div key={peer.id}>
            {peer.cameraTrack?.stream && (
              <VideoPlayer stream={peer.cameraTrack.stream} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
export default function App() {
  return (
    <FishjamProvider fishjamId={FISHJAM_ID}>
      <VideoCall />
    </FishjamProvider>
  );
}