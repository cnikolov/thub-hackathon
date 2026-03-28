Streaming media
This guide covers the basics of initializing and using camera and microphone devices. For more advanced device management (selecting specific devices, device switching, muting, etc.), see the Managing devices guide.

Initialize access to your devices
React (Web)
React Native (Mobile)
Fishjam provides an API to browse and manage media devices you can use.
To ask the browser for permission to list the available devices, call the initializeDevices function from useInitializeDevices hook.

You can choose whether to initialize both camera and microphone devices or just one of them by passing InitializeDevicesSettings as an argument. By default, both camera and microphone are initialized.

The initializeDevices function will return a Promise<InitializeDevicesResult> object.

Copy
import React, { useEffect } from "react";
import { useInitializeDevices } from "@fishjam-cloud/react-client";
export function useExample() {
  const { initializeDevices } = useInitializeDevices();
  useEffect(() => {
    initializeDevices().then((result) => {
      // optionally handle the result
      console.log(result);
    });
  }, [initializeDevices]);
}
note
The useInitializeDevices hook gives you the convenience of asking the user for all permissions at once.

It is not the only way to enable the device. You can just toggle the device using useCamera or useMicrophone hooks.

Device API
React (Web)
React Native (Mobile)
To manage users' camera and microphone devices, use the respective useCamera and useMicrophone hooks. Both of them have similar API. To keep things simple, we will just use the camera hook.

Copy
import React, { useEffect, useRef } from "react";
import { useCamera } from "@fishjam-cloud/react-client";
export function ExampleCameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { activeCamera, selectCamera, cameraStream, cameraDevices } =
    useCamera();
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = cameraStream ?? null;
  }, [cameraStream]);
  return (
    <div>
      <p>Active camera: {activeCamera?.label ?? "None"}</p>
      <select onChange={(e) => selectCamera(e.target.value)}>
        {cameraDevices.map(({ label, deviceId }) => (
          <option key={deviceId} value={deviceId}>
            {label}
          </option>
        ))}
      </select>
      {cameraStream && <video ref={videoRef} autoPlay />}
    </div>
  );
}