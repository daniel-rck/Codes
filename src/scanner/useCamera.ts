/**
 * Camera hook: manages a getUserMedia stream (rear camera by default), exposes
 * device switching and torch control. All processing stays on-device.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/** Read the (non-standard) torch capability without fighting the DOM types. */
function trackSupportsTorch(track: MediaStreamTrack | undefined): boolean {
  const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
  return Boolean(caps?.torch);
}

export type CameraState = {
  stream: MediaStream | null;
  error: string | null;
  starting: boolean;
  devices: MediaDeviceInfo[];
  activeDeviceId: string | null;
  torchOn: boolean;
  torchAvailable: boolean;
};

export type UseCameraResult = CameraState & {
  start: (deviceId?: string) => Promise<void>;
  stop: () => void;
  switchDevice: (deviceId: string) => Promise<void>;
  toggleTorch: () => Promise<void>;
};

export function useCamera(): UseCameraResult {
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const stop = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    setStream(null);
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Kamera wird von diesem Gerät/Browser nicht unterstützt.");
        return;
      }
      setStarting(true);
      setError(null);
      try {
        stop();
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: "environment" } },
          audio: false,
        };
        const media = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = media;
        setStream(media);

        const track = media.getVideoTracks()[0];
        setActiveDeviceId(track?.getSettings().deviceId ?? deviceId ?? null);
        setTorchAvailable(trackSupportsTorch(track));

        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "videoinput"));
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Kamerazugriff wurde verweigert."
            : "Kamera konnte nicht gestartet werden.",
        );
      } finally {
        setStarting(false);
      }
    },
    [stop],
  );

  const switchDevice = useCallback(
    async (deviceId: string) => {
      await start(deviceId);
    },
    [start],
  );

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !trackSupportsTorch(track)) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }, [torchOn]);

  // Clean up the stream on unmount.
  useEffect(() => stop, [stop]);

  return {
    stream,
    error,
    starting,
    devices,
    activeDeviceId,
    torchOn,
    torchAvailable,
    start,
    stop,
    switchDevice,
    toggleTorch,
  };
}
