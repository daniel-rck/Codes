import {
  Camera,
  CameraOff,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Share2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { addScan } from "../../db/history.ts";
import { Button, PageHeader } from "../../lib/ui/index.ts";
import { decodeImageFile } from "../../scanner/decodeImage.ts";
import { warmUpDecoder } from "../../scanner/decoderClient.ts";
import { type ScanHit, startScanLoop } from "../../scanner/scanLoop.ts";
import { useCamera } from "../../scanner/useCamera.ts";

/** Absolute href for openable scan results, or null when not a link. */
function toHref(text: string): string | null {
  if (/^(https?|mailto|tel|geo|bitcoin):/i.test(text)) return text;
  // A bare "www.…" would resolve relative to the app origin — make it absolute.
  if (/^www\./i.test(text)) return `https://${text}`;
  return null;
}

export function ScanPage() {
  const camera = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<{ stop: () => void } | null>(null);
  const [result, setResult] = useState<ScanHit | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const stopLoop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
  }, []);

  // Pre-compile the worker's wasm so the first frame decode is instant.
  useEffect(() => {
    warmUpDecoder();
  }, []);

  const handleHit = useCallback(
    (hit: ScanHit) => {
      stopLoop();
      setResult(hit);
      navigator.vibrate?.(80);
      void addScan(hit.text, hit.format);
    },
    [stopLoop],
  );

  // Attach the stream and (re)start the scan loop while the camera is live.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !camera.stream) return;
    video.srcObject = camera.stream;
    void video.play().catch(() => undefined);
    if (!result) {
      loopRef.current = startScanLoop(video, { onHit: handleHit });
    }
    return stopLoop;
  }, [camera.stream, result, handleHit, stopLoop]);

  // Stop everything on unmount.
  useEffect(() => () => stopLoop(), [stopLoop]);

  const onPickImage = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    try {
      const hits = await decodeImageFile(file);
      const first = hits[0];
      if (first) {
        setResult(first);
        void addScan(first.text, first.format);
      } else {
        setImageError("Kein Code im Bild gefunden.");
      }
    } catch {
      setImageError("Bild konnte nicht gelesen werden.");
    }
  }, []);

  const rescan = useCallback(() => {
    setResult(null);
  }, []);

  return (
    <>
      <PageHeader title="Scannen" subtitle="Kamera oder Bild — alles bleibt auf dem Gerät." />

      <div className="space-y-4">
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl bg-black">
          {/* biome-ignore lint/a11y/useMediaCaption: live camera preview has no captions */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            aria-label="Kamera-Vorschau"
          />
          {camera.stream ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-2/3 w-2/3 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
              <Camera size={40} aria-hidden />
              <p className="px-6 text-center text-sm">{camera.error ?? "Kamera ist aus."}</p>
            </div>
          )}

          {camera.stream && camera.torchAvailable ? (
            <button
              type="button"
              onClick={() => void camera.toggleTorch()}
              className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white"
              aria-label="Taschenlampe umschalten"
            >
              <Zap size={20} aria-hidden className={camera.torchOn ? "fill-current" : ""} />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {camera.stream ? (
            <Button variant="secondary" onClick={camera.stop}>
              <CameraOff size={16} aria-hidden /> Kamera aus
            </Button>
          ) : (
            <Button onClick={() => void camera.start()} disabled={camera.starting}>
              <Camera size={16} aria-hidden /> Kamera starten
            </Button>
          )}

          <label className="inline-flex">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void onPickImage(e.target.files?.[0])}
            />
            <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-muted px-4 text-sm font-medium hover:bg-surface-sunken">
              <ImageIcon size={16} aria-hidden /> Aus Bild
            </span>
          </label>

          {camera.devices.length > 1 && camera.stream ? (
            <select
              value={camera.activeDeviceId ?? ""}
              onChange={(e) => void camera.switchDevice(e.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-2 text-sm"
              aria-label="Kamera wählen"
            >
              {camera.devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Kamera ${i + 1}`}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {imageError ? <p className="text-center text-sm text-danger">{imageError}</p> : null}
      </div>

      {result ? <ResultSheet hit={result} onClose={rescan} /> : null}
    </>
  );
}

function ResultSheet({ hit, onClose }: { hit: ScanHit; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const href = toHref(hit.text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hit.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    try {
      await navigator.share?.({ text: hit.text });
    } catch {
      // user cancelled or unsupported — no-op
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-4 pb-20 shadow-lg md:bottom-4 md:left-1/2 md:max-w-md md:-translate-x-1/2 md:rounded-xl md:border md:pb-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-accent-600">
        {hit.format}
      </div>
      <p className="mb-4 break-words text-sm text-fg">{hit.text}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy}>
          <Copy size={16} aria-hidden /> {copied ? "Kopiert" : "Kopieren"}
        </Button>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex">
            <Button variant="secondary">
              <ExternalLink size={16} aria-hidden /> Öffnen
            </Button>
          </a>
        ) : null}
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <Button variant="secondary" onClick={share}>
            <Share2 size={16} aria-hidden /> Teilen
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onClose}>
          Weiter scannen
        </Button>
      </div>
    </div>
  );
}
