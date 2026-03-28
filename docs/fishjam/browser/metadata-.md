Setting metadata when joining the room
The joinRoom method from the useConnection hook has a peerMetadata parameter, that can be used for setting object metadata.

React (Web)
React Native (Mobile)
Copy
import { useConnection } from "@fishjam-cloud/react-client";
import React, { useCallback } from "react";
type PeerMetadata = {
  displayName: string;
};
export function JoinRoomButton() {
  const { joinRoom } = useConnection();
  const onJoinRoomPress = useCallback(async () => {
    await joinRoom<PeerMetadata>({
      peerToken: PEER_TOKEN,
      peerMetadata: { displayName: "John Wick" },
    });
  }, [joinRoom]);
  return <button onClick={onJoinRoomPress}>Join room</button>;
}
Updating metadata during connection
Once you've joined the room, you can update your peer metadata with the updatePeerMetadata method of the useUpdatePeerMetadata hook:

React (Web)
React Native (Mobile)
Copy
import { useUpdatePeerMetadata } from "@fishjam-cloud/react-client";
import React, { useCallback } from "react";
type PeerMetadata = {
  displayName: string;
};
export function JoinRoomButton() {
  const { updatePeerMetadata } = useUpdatePeerMetadata<PeerMetadata>();
  const onPressUpdateName = useCallback(async () => {
    await updatePeerMetadata({ displayName: "Thomas A. Anderson" });
  }, [updatePeerMetadata]);
  return <button onClick={onPressUpdateName}>Change name</button>;
}
Reading metadata
Peer metadata is available as the metadata property for each peer. Therefore, when you list your peers with the usePeers hook, you can read the metadata associated with them. Note that the metadata.peer property contains only the metadata set by the client SDK (as in the examples examples above). The metadata set on the server side is available as metadata.server. Learn more about server metadata here.

React (Web)
React Native (Mobile)
Copy
import React from "react";
import { usePeers } from "@fishjam-cloud/react-client";
type PeerMetadata = {
  displayName: string;
};
type ServerMetadata = {
  realName: string;
};
export function ListAllNames() {
  const { remotePeers } = usePeers<PeerMetadata, ServerMetadata>();
  return (
    <div>
      {remotePeers.map((peer) => (
        <span>
          Display name: {peer.metadata?.peer.displayName}
          <br />
          Real name: {peer.metadata?.server.realName}
        </span>
      ))}
    </div>
  );
}
Track metadata
Each track published by a peer also carries a TrackMetadata object. Unlike peer metadata, track metadata is set internally by the SDK and cannot be modified directly by the user.

It contains the following fields:

type — the kind of media the track carries: camera, microphone, screenShareVideo, screenShareAudio, customVideo, or customAudio
paused — whether the track is currently muted/disabled
displayName — the peer's display name, used in recordings
You can read track metadata via the metadata property on a track, for example to check whether a peer's camera is enabled:

React (Web)
React Native (Mobile)
Copy
import React from "react";
import { usePeers } from "@fishjam-cloud/react-client";
export function CameraStatus() {
  const { remotePeers } = usePeers();
  return (
    <div>
      {remotePeers.map((peer) => {
        const isCameraEnabled = !peer.cameraTrack?.metadata?.paused;
        return (
          <span key={peer.id}>
            {peer.cameraTrack?.metadata?.displayName ?? "Unknown"}: camera is{" "}
            {isCameraEnabled ? "on" : "off"}
          </span>
        );
      })}
    </div>
  );
}