
// The `useSandbox` hook gets the fishjamId from FishjamProvider
// It will work ONLY with the FISHJAM_ID of the Sandbox environment
const { getSandboxPeerToken } = useSandbox();
const peerToken = await getSandboxPeerToken(roomName, peerName);
Connecting
Use the useConnection hook to get the joinRoom function.

React (Web)
React Native (Mobile)
Copy
import { useConnection, useSandbox } from "@fishjam-cloud/react-client";
import React, { useCallback } from "react";
export function JoinRoomButton() {
  const { joinRoom } = useConnection();
  // get the peer token from sandbox or your backend
  const { getSandboxPeerToken } = useSandbox();
  const onJoinRoomPress = useCallback(async () => {
    const peerToken = await getSandboxPeerToken("Room", "User");
    await joinRoom({ peerToken });
  }, [joinRoom]);
  return <button onClick={onJoinRoomPress}>Join room</button>;
}
Disconnecting
In order to close connection, use the leaveRoom method from useConnection hook.

React (Web)
React Native (Mobile)
Copy
import { useConnection } from "@fishjam-cloud/react-client";
import React, { useCallback } from "react";
export function LeaveRoomButton() {
  const { leaveRoom } = useConnection();
  return <button onClick={leaveRoom}>Leave room</button>;
}