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
import { Button, buttonClass, PageHeader, Spinner } from "../../lib/ui/index.ts";
import { decodeImageFile } from "../../scanner/decodeImage.ts";
import { warmUpDecoder } from "../../scanner/decoderClient.ts";
import { type ScanHit, startScanLoop } from "../../scanner/scanLoop.ts";
import { useCamera } from "../../scanner/useCamera.ts";
import { toHref } from "../../shared/links.ts";

/**
 * After "Weiter scannen" the code that was just read is usually still in
 * frame — ignore it for a moment so the sheet doesn't pop right back up and
 * the history doesn't fill with duplicates.
 */
const RESCAN_IGNORE_MS = 3000;

export function ScanPage() {
  const camera = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<{ stop: () => void } | null>(null);
  const [result, setResult] = useState<ScanHit | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [decodingImage, setDecodingImage] = useState(false);
  const ignoreRef = useRef<{ text: string; until: number } | null>(null);

  const stopLoop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
  }, []);

  // Pre-compile the worker's wasm so the first frame decode is instant.
  useEffect(() => {
    warmUpDecoder();
  }, []);

  // Start the camera right away when access was granted before — asking for a
  // click every visit is needless friction. Without a prior grant we wait for
  // the button so the permission prompt doesn't appear out of nowhere.
  const { start: startCamera } = camera;
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "camera" as PermissionName })
      .then((status) => {
        if (!cancelled && status.state === "granted") void startCamera();
      })
      .catch(() => undefined); // "camera" isn't a queryable permission everywhere.
    return () => {
      cancelled = true;
    };
  }, [startCamera]);

  const handleHit = useCallback(
    (hit: ScanHit) => {
      const ignore = ignoreRef.current;
      if (ignore && ignore.text === hit.text && Date.now() < ignore.until) return;
      ignoreRef.current = null;
      stopLoop();
      setScanError(null);
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
      setScanError(null);
      loopRef.current = startScanLoop(video, { onHit: handleHit, onError: setScanError });
    }
    return stopLoop;
  }, [camera.stream, result, handleHit, stopLoop]);

  // Stop everything on unmount.
  useEffect(() => () => stopLoop(), [stopLoop]);

  const onPickImage = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    setDecodingImage(true);
    try {
      const hits = await decodeImageFile(file);
      const first = hits[0];
      if (first) {
        setScanError(null);
        setResult(first);
        void addScan(first.text, first.format);
      } else {
        setImageError("Kein Code im Bild gefunden.");
      }
    } catch {
      setImageError("Bild konnte nicht gelesen werden.");
    } finally {
      setDecodingImage(false);
    }
  }, []);

  const rescan = useCallback(() => {
    setResult((current) => {
      if (current) ignoreRef.current = { text: current.text, until: Date.now() + RESCAN_IGNORE_MS };
      return null;
    });
  }, []);

  return (
    <>
      <PageHeader title="Scannen" subtitle="Kamera oder Bild — alles bleibt auf dem Gerät." />

      <div className="space-y-4">
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl bg-black">
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
              {camera.starting ? (
                <Spinner size="sm" label="Kamera startet …" className="text-white" />
              ) : (
                <Camera size={16} aria-hidden />
              )}{" "}
              {camera.starting ? "Kamera startet …" : "Kamera starten"}
            </Button>
          )}

          <label
            className={buttonClass(
              "secondary",
              "md",
              `cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-500 has-[:focus-visible]:ring-offset-2 ${decodingImage ? "pointer-events-none opacity-60" : ""}`,
            )}
          >
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={decodingImage}
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset so picking the same file again still fires `change`.
                e.target.value = "";
                void onPickImage(file);
              }}
            />
            {decodingImage ? (
              <>
                <Spinner size="sm" label="Bild wird gelesen …" /> Bild wird gelesen …
              </>
            ) : (
              <>
                <ImageIcon size={16} aria-hidden /> Aus Bild
              </>
            )}
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

        <p role="alert" className="min-h-5 text-center text-sm text-danger">
          {imageError ?? scanError ?? ""}
        </p>
      </div>

      {result ? <ResultSheet hit={result} onClose={rescan} /> : null}
    </>
  );
}

function ResultSheet({ hit, onClose }: { hit: ScanHit; onClose: () => void }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const href = toHref(hit.text);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (copyState === "idle") return;
    const t = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(t);
  }, [copyState]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hit.text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ text: hit.text });
    } catch {
      // user cancelled or unsupported — no-op
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Scan-Ergebnis"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface p-4 shadow-lg md:bottom-4 md:left-1/2 md:max-w-md md:-translate-x-1/2 md:rounded-xl md:border"
    >
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-accent-600">
        {hit.format}
      </div>
      <p className="mb-4 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-fg">
        {hit.text}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} aria-live="polite">
          <Copy size={16} aria-hidden />{" "}
          {copyState === "copied"
            ? "Kopiert"
            : copyState === "failed"
              ? "Kopieren fehlgeschlagen"
              : "Kopieren"}
        </Button>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className={buttonClass("secondary")}
          >
            <ExternalLink size={16} aria-hidden /> Öffnen
          </a>
        ) : null}
        {canShare ? (
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
