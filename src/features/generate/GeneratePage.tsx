import { Check, Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chip, Field, Input, Select, Textarea } from "../../components/form.tsx";
import { addGenerated } from "../../db/history.ts";
import {
  type CreatableBarcodeFormat,
  formatLabel,
  writeOther,
} from "../../generator/barcode/writeOther.ts";
import { qrMatrix } from "../../generator/qr/matrix.ts";
import { renderQrSvg } from "../../generator/qr/renderQr.ts";
import { Button, PageHeader } from "../../lib/ui/index.ts";
import {
  downloadBlob,
  PRINT_HINTS,
  toPDFBlob,
  toPNGBlob,
  toSVGString,
} from "../../shared/export.ts";
import { CONTENT_TYPES, type ContentTypeDef, type ContentValues } from "./generatorConfig.ts";
import { DEFAULT_STYLE, type GeneratorStyle, StylePanel } from "./StylePanel.tsx";

const OTHER_FORMAT_CHIPS: CreatableBarcodeFormat[] = [
  "Code128",
  "EAN13",
  "EAN8",
  "UPCA",
  "Code39",
  "ITF",
  "PDF417",
  "DataMatrix",
  "Aztec",
];

type FormatSelection = { kind: "qr" } | { kind: "other"; format: CreatableBarcodeFormat };

export function GeneratePage() {
  const [selection, setSelection] = useState<FormatSelection>({ kind: "qr" });
  const [contentTypeId, setContentTypeId] = useState<ContentTypeDef["id"]>("url");
  const [values, setValues] = useState<ContentValues>({});
  const [otherText, setOtherText] = useState("");
  const [style, setStyle] = useState<GeneratorStyle>(DEFAULT_STYLE);

  const [otherSvg, setOtherSvg] = useState<string | null>(null);
  const [otherError, setOtherError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const contentType = useMemo(
    () => CONTENT_TYPES.find((c) => c.id === contentTypeId) ?? (CONTENT_TYPES[0] as ContentTypeDef),
    [contentTypeId],
  );

  // QR preview as staged derivations: encoding (mask evaluation is the
  // expensive part) only re-runs when the text or EC level changes — colour
  // and shape tweaks re-run just the cheap SVG render.
  const qrText = useMemo(() => {
    if (selection.kind !== "qr") return null;
    if (!contentType.validate(values).ok) return null;
    try {
      return contentType.build(values);
    } catch {
      return null;
    }
  }, [selection.kind, contentType, values]);

  const qrEncoded = useMemo(() => {
    if (qrText == null) return null;
    try {
      return { matrix: qrMatrix(qrText, style.ecc), error: null };
    } catch (err) {
      return {
        matrix: null,
        error: err instanceof Error ? err.message : "Fehler beim Erzeugen.",
      };
    }
  }, [qrText, style.ecc]);

  const qrSvg = useMemo(
    () => (qrEncoded?.matrix ? renderQrSvg(qrEncoded.matrix, style) : null),
    [qrEncoded, style],
  );

  // Build the non-QR preview (async via zxing writer, debounced).
  useEffect(() => {
    if (selection.kind !== "other") return;
    if (otherText.trim().length === 0) {
      setOtherSvg(null);
      setOtherError(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const { svg: out } = await writeOther(selection.format, otherText);
        if (cancelled) return;
        setOtherSvg(out);
        setOtherError(null);
      } catch (err) {
        if (cancelled) return;
        setOtherSvg(null);
        setOtherError(err instanceof Error ? err.message : "Format passt nicht zum Inhalt.");
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [selection, otherText]);

  const isQr = selection.kind === "qr";
  const svg = isQr ? qrSvg : otherSvg;
  const error = isQr ? (qrEncoded?.error ?? null) : otherError;
  const content = isQr ? (qrText ?? "") : otherText;
  const currentFormat = selection.kind === "qr" ? "QRCode" : selection.format;
  const saveKey = `${currentFormat}\u0000${content}`;
  const saved = savedKey === saveKey;

  const onSave = useCallback(async () => {
    if (!svg || saved) return;
    const label = selection.kind === "qr" ? contentType.label : formatLabel(selection.format);
    await addGenerated({ format: currentFormat, content, label });
    setSavedKey(saveKey);
  }, [svg, saved, selection, contentType, content, currentFormat, saveKey]);

  const exportAs = useCallback(
    async (kind: "svg" | "png" | "pdf") => {
      if (!svg) return;
      const base = `codes-${currentFormat.toLowerCase()}`;
      if (kind === "svg") {
        downloadBlob(new Blob([toSVGString(svg)], { type: "image/svg+xml" }), `${base}.svg`);
      } else if (kind === "png") {
        downloadBlob(await toPNGBlob(svg, { size: 1024 }), `${base}.png`);
      } else {
        downloadBlob(await toPDFBlob(svg, { size: 1024 }), `${base}.pdf`);
      }
    },
    [svg, currentFormat],
  );

  return (
    <>
      <PageHeader
        title="Erstellen"
        subtitle="Barcodes und QR-Codes lokal erzeugen — Live-Vorschau."
      />

      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Chip active={selection.kind === "qr"} onClick={() => setSelection({ kind: "qr" })}>
            QR-Code
          </Chip>
          {OTHER_FORMAT_CHIPS.map((f) => (
            <Chip
              key={f}
              active={selection.kind === "other" && selection.format === f}
              onClick={() => setSelection({ kind: "other", format: f })}
            >
              {formatLabel(f)}
            </Chip>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            {selection.kind === "qr" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_TYPES.map((c) => (
                    <Chip
                      key={c.id}
                      active={contentTypeId === c.id}
                      onClick={() => {
                        setContentTypeId(c.id);
                        setValues({});
                      }}
                    >
                      {c.label}
                    </Chip>
                  ))}
                </div>

                {contentType.fields.map((field) => (
                  <Field key={field.key} label={field.label}>
                    {(id) =>
                      field.type === "textarea" ? (
                        <Textarea
                          id={id}
                          placeholder={field.placeholder}
                          value={values[field.key] ?? ""}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [field.key]: e.target.value }))
                          }
                        />
                      ) : field.type === "select" ? (
                        <Select
                          id={id}
                          value={values[field.key] ?? field.options?.[0]?.value ?? ""}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [field.key]: e.target.value }))
                          }
                        >
                          {field.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          id={id}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={values[field.key] ?? ""}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [field.key]: e.target.value }))
                          }
                        />
                      )
                    }
                  </Field>
                ))}

                <StylePanel value={style} onChange={setStyle} />
              </>
            ) : (
              <Field
                label={`Inhalt für ${formatLabel(selection.format)}`}
                error={error ?? undefined}
              >
                {(id) => (
                  <Input
                    id={id}
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Inhalt eingeben …"
                  />
                )}
              </Field>
            )}
          </div>

          <div className="space-y-4">
            <Preview svg={svg} error={selection.kind === "qr" ? error : null} />
            {svg ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => exportAs("png")}>
                    <Download size={16} aria-hidden /> PNG
                  </Button>
                  <Button variant="secondary" onClick={() => exportAs("svg")}>
                    SVG
                  </Button>
                  <Button variant="secondary" onClick={() => exportAs("pdf")}>
                    PDF
                  </Button>
                  <Button variant="ghost" onClick={onSave} disabled={saved}>
                    {saved ? <Check size={16} aria-hidden /> : null}{" "}
                    {saved ? "Gespeichert" : "Speichern"}
                  </Button>
                </div>
                <ul className="space-y-1 text-xs text-fg-muted">
                  {PRINT_HINTS.map((hint) => (
                    <li key={hint}>• {hint}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function Preview({ svg, error }: { svg: string | null; error: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = svg ?? "";
  }, [svg]);

  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-white p-4">
      {svg ? (
        <div
          ref={ref}
          role="img"
          className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
          aria-label="Vorschau"
        />
      ) : (
        <p className="px-6 text-center text-sm text-fg-muted">
          {error ?? "Inhalt eingeben, um eine Vorschau zu sehen."}
        </p>
      )}
    </div>
  );
}
