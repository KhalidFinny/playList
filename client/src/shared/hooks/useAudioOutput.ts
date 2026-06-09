import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'playmusic_preview_device';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function useAudioOutput() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || 'default'
  );

  // Enumerate audio output devices
  useEffect(() => {
    // Only works on HTTPS (or localhost) with user gesture
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const refresh = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = allDevices
          .filter((d) => d.kind === 'audiooutput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Speaker (${d.deviceId.slice(0, 8)}...)` }));
        setDevices(audioOutputs);
      } catch {
        // Permission denied or not available
      }
    };

    refresh();
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh);
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem(STORAGE_KEY, deviceId);
  }, []);

  const supportsSetSinkId = typeof HTMLAudioElement !== 'undefined' &&
    'setSinkId' in HTMLAudioElement.prototype;

  const isCustomDevice = selectedDeviceId !== 'default';

  return {
    devices,
    selectedDeviceId,
    selectDevice,
    supportsSetSinkId,
    isCustomDevice,
  };
}
