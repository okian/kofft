import { useState, useCallback, useRef, useEffect } from "react";
import { useAudioStore } from "@/stores/audioStore";
import { audioPlayer } from "@/utils/audioPlayer";
import { conditionalToast } from "@/utils/toast";

export const useMicrophone = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { setMicrophoneActive, setLive, setCurrentTrack } = useAudioStore();

  // Initialize audio context using the shared one
  const initAudioContext = useCallback(async () => {
    try {
      const context = await audioPlayer.initAudioContext();
      setIsInitialized(true);
      return context;
    } catch (error) {
      throw new Error("Audio context initialization failed");
    }
  }, []);

  // Request microphone permission
  const requestPermission = useCallback(async () => {
    setIsRequestingPermission(true);
    setError(null);

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access not supported in this browser");
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      mediaStreamRef.current = stream;
      setIsRequestingPermission(false);
      return stream;
    } catch (error) {
      setIsRequestingPermission(false);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to access microphone";
      setError(errorMessage);

      if (error instanceof Error && error.name === "NotAllowedError") {
        conditionalToast.error(
          "Microphone permission denied. Please allow microphone access.",
        );
      } else {
        conditionalToast.error(errorMessage);
      }

      throw error;
    }
  }, []);

  // Start microphone input
  const startMicrophone = useCallback(async () => {
    try {
      // Initialize audio context if needed
      await initAudioContext();

      // Stop any existing stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      // Request permission and get stream
      const stream = await requestPermission();

      // Use the shared audio player to start microphone
      const success = await audioPlayer.startMicrophone(stream);

      if (success) {
        // Set up live mode
        setMicrophoneActive(true);
        setLive(true);
        setCurrentTrack(null); // Clear any file track

        conditionalToast.success("Microphone activated");
        return true;
      } else {
        throw new Error("Failed to start microphone");
      }
    } catch (error) {
      // Human-readable explanation of the start failure.
      const message =
        error instanceof Error ? error.message : "Failed to start microphone";
      console.error("Microphone start failed", error);
      conditionalToast.error(message);
      return false;
    }
  }, [
    initAudioContext,
    requestPermission,
    setMicrophoneActive,
    setLive,
    setCurrentTrack,
  ]);

  // Stop microphone input
  const stopMicrophone = useCallback(() => {
    try {
      // Use the shared audio player to stop microphone
      const success = audioPlayer.stopMicrophone();

      if (success) {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        // Update state
        setMicrophoneActive(false);
        setLive(false);

        conditionalToast.success("Microphone deactivated");
        return true;
      } else {
        throw new Error("Failed to stop microphone");
      }
    } catch (error) {
      // Human-readable explanation of the stop failure.
      const message =
        error instanceof Error ? error.message : "Failed to stop microphone";
      console.error("Microphone stop failed", error);
      conditionalToast.error(message);
      return false;
    }
  }, [setMicrophoneActive, setLive]);

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    const { isMicrophoneActive } = useAudioStore.getState();

    if (isMicrophoneActive) {
      return await stopMicrophone();
    } else {
      return await startMicrophone();
    }
  }, [startMicrophone, stopMicrophone]);

  // Get available input devices
  const getInputDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "audioinput");
    } catch (error) {
      console.error("Failed to enumerate input devices", error);
      conditionalToast.error("Failed to enumerate input devices");
      return [];
    }
  }, []);

  // Switch to specific input device
  const switchInputDevice = useCallback(
    async (deviceId: string) => {
      try {
        // Stop current microphone
        await stopMicrophone();

        // Request new stream with specific device
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
          },
        });

        // Start microphone with new stream
        const success = await audioPlayer.startMicrophone(stream);

        if (success) {
          conditionalToast.success("Input device switched");
          return true;
        } else {
          throw new Error("Failed to switch input device");
        }
      } catch (error) {
        conditionalToast.error("Failed to switch input device");
        return false;
      }
    },
    [stopMicrophone],
  );

  // Get frequency data for spectrogram (from shared audio player)
  const getFrequencyData = useCallback(() => {
    return audioPlayer.getFrequencyData();
  }, []);

  // Get time domain data (from shared audio player)
  const getTimeData = useCallback(() => {
    return audioPlayer.getTimeData();
  }, []);

  // Start real-time analysis loop
  const startAnalysis = useCallback(
    (onData: (frequencyData: Uint8Array, timeData: Uint8Array) => void) => {
      const analyse = () => {
        const frequencyData = getFrequencyData();
        const timeData = getTimeData();

        if (frequencyData && timeData) {
          onData(frequencyData, timeData);
        }

        animationFrameRef.current = requestAnimationFrame(analyse);
      };

      analyse();
    },
    [getFrequencyData, getTimeData],
  );

  // Stop analysis loop
  const stopAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Get input level
  const getInputLevel = useCallback(() => {
    const timeData = getTimeData();
    if (!timeData) return 0;

    // Calculate RMS (Root Mean Square) of the audio data
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - 128) / 128; // Convert to -1 to 1 range
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / timeData.length);

    // Convert to dB
    const db = 20 * Math.log10(Math.max(rms, 1e-10));

    // Normalize to 0-1 range (assuming -60dB to 0dB range)
    return Math.max(0, Math.min(1, (db + 60) / 60));
  }, [getTimeData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnalysis();
      stopMicrophone();
    };
  }, [stopMicrophone, stopAnalysis]);

  return {
    isInitialized,
    isRequestingPermission,
    error,
    startMicrophone,
    stopMicrophone,
    toggleMicrophone,
    getInputDevices,
    switchInputDevice,
    getFrequencyData,
    getTimeData,
    startAnalysis,
    stopAnalysis,
    getInputLevel,
    initAudioContext,
  };
};
