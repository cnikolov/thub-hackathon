Display media of other peers
To access data and media of other peers, use the usePeers hook. It returns two properties, remotePeers and localPeer. They contain all the tracks of other peers and all the tracks of the local user, respectively.

Example of playing other peers' available media
React (Web)
React Native (Mobile)
Copy
import { usePeers } from "@fishjam-cloud/react-client";
export function Component() {
  const { remotePeers } = usePeers();
  return (
    <ul>
      {remotePeers.map(({ id, cameraTrack, microphoneTrack }) => (
        <li key={id}>
          <VideoRenderer stream={cameraTrack?.stream} /> // remember to import
          your VideoRenderer component
          <AudioPlayer stream={microphoneTrack?.stream} />
        </li>
      ))}
    </ul>
  );
}