'use client';

import { useEffect, useState } from 'react';

import { useRecording } from '../contexts/RecordingContext';

export function DeviceSelector() {
  const {
    cameraEnabled,
    microphoneEnabled,
    setCameraEnabled,
    setMicrophoneEnabled,
    setCameraStream,
    setMicrophoneStream,
    setScreenshareStream,
    layout,
  } = useRecording();

  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');

  // Get available devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameraDevices(devices.filter(d => d.kind === 'videoinput'));
        setMicrophoneDevices(devices.filter(d => d.kind === 'audioinput'));

        // Select first devices by default
        const firstCamera = devices.find(d => d.kind === 'videoinput');
        const firstMic = devices.find(d => d.kind === 'audioinput');
        if (firstCamera) setSelectedCamera(firstCamera.deviceId);
        if (firstMic) setSelectedMicrophone(firstMic.deviceId);
      } catch (error) {
        console.error('Error enumerating devices:', error);
      }
    };

    getDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, []);

  // Get camera stream
  useEffect(() => {
    if (!selectedCamera || !cameraEnabled || layout === 'screenOnly') {
      setCameraStream(null);
      return;
    }

    const getCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedCamera },
        });
        setCameraStream(stream);
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    getCamera();

    return () => {
      setCameraStream(prevStream => {
        prevStream?.getTracks().forEach(track => track.stop());
        return null;
      });
    };
  }, [selectedCamera, cameraEnabled, layout, setCameraStream]);

  // Get microphone stream
  useEffect(() => {
    if (!selectedMicrophone || !microphoneEnabled) {
      setMicrophoneStream(null);
      return;
    }

    const getMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedMicrophone },
        });
        setMicrophoneStream(stream);
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    };

    getMicrophone();

    return () => {
      setMicrophoneStream(prevStream => {
        prevStream?.getTracks().forEach(track => track.stop());
        return null;
      });
    };
  }, [selectedMicrophone, microphoneEnabled, setMicrophoneStream]);

  // Get screenshare (when needed)
  const handleScreenshare = async () => {
    if (layout === 'cameraOnly') return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Stop sharing when user clicks browser's stop button
      stream.getVideoTracks()[0].onended = () => {
        setScreenshareStream(null);
      };

      setScreenshareStream(stream);
    } catch (error) {
      console.error('Error accessing screen:', error);
    }
  };

  return (
    <div className="space-y-4 p-6 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Device Settings</h2>

      {/* Camera selection */}
      {layout !== 'screenOnly' && (
        <div>
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={cameraEnabled}
              onChange={(e) => setCameraEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium">Camera</span>
          </label>
          {cameraEnabled && (
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {cameraDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Microphone selection */}
      <div>
        <label className="flex items-center mb-2">
          <input
            type="checkbox"
            checked={microphoneEnabled}
            onChange={(e) => setMicrophoneEnabled(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium">Microphone</span>
        </label>
        {microphoneEnabled && (
          <select
            value={selectedMicrophone}
            onChange={(e) => setSelectedMicrophone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {microphoneDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Screenshare button */}
      {layout !== 'cameraOnly' && (
        <button
          onClick={handleScreenshare}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Select Screen to Share
        </button>
      )}
    </div>
  );
}
