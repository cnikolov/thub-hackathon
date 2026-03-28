To select the desired camera or microphone, use selectCamera() and selectMicrophone() functions.
Lists of the available devices are available via the cameraDevices and microphoneDevices properties.

Usage Example
Copy
import React from "react";
import { useCamera } from "@fishjam-cloud/react-client";
export function CameraControl() {
  const { cameraDevices, selectCamera } = useCamera();
  return (
    <ul>
      {cameraDevices.map(({ deviceId, label }) => (
        <li key={deviceId}>
          <button onClick={() => selectCamera(deviceId)}>{label}</button>
        </li>
      ))}
    </ul>
  );
}
Turning Camera On and Off
React (Web)
React Native (Mobile)
Use the toggleCamera() method to control the physical operational state of the camera.

Turning the camera off: This action stops the camera device, disables the media stream, and pauses streaming. The webcam indicator light will shut down.
Turning the camera on: This action starts the camera and resumes streaming, allowing other participants to see video after a brief initialization period.
Usage Example
Copy
import React from "react";
import { useCamera } from "@fishjam-cloud/react-client";
export function CameraControl() {
  const { toggleCamera } = useCamera();
  return <button onClick={() => toggleCamera()}>Toggle Camera Device</button>;
}
Turning Microphone On and Off
React (Web)
React Native (Mobile)
Use the toggleMicrophone() method to toggle the microphone's physical operational state. The function interacts with a physical device, so it might take a noticeable amount of time.

Turning the microphone off: This action turns the microphone off, disables the media stream, and pauses any audio transmission.

Turning the microphone on: This action turns the microphone on and resumes audio streaming.

Muting and Unmuting Microphone (Web only)
note
This feature is only available on Web. On mobile, use toggleMicrophone or stopMicrophone to disable audio transmission.

Use toggleMicrophoneMute() to manage the audio stream's operational status without affecting the microphone's hardware state.

Muting and unmuting is faster than turning the microphone on/off, but a muted device still uses resources. This is useful, as it is common to mute and unmute during a meeting. Unmuting needs to be quick to capture the first word of a sentence.

Muting the microphone: This action disables the media stream and stops audio transmission while keeping the microphone active.
Unmuting the microphone: This action enables the media stream, allowing immediate transmission of sounds.
Usage Example
Copy
import React from "react";
import { useMicrophone } from "@fishjam-cloud/react-client";
export function MicrophoneControl() {
  const { toggleMicrophone, toggleMicrophoneMute } = useMicrophone();
  return (
    <div>
      <button onClick={() => toggleMicrophone()}>
        Toggle Microphone Device
      </button>
      <button onClick={() => toggleMicrophoneMute()}>
        Toggle Microphone Mute
      </button>
    </div>
  );
}