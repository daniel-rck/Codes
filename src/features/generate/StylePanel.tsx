/**
 * Collapsible styling controls for QR codes: error-correction level, colours,
 * gradient, module/eye shapes, centred logo and CTA frame.
 */
import { ChevronDown, X } from "lucide-react";
import { useRef, useState } from "react";
import { Chip, Field, Input, Switch } from "../../components/form.tsx";
import type { EccLevel } from "../../generator/qr/encode.ts";
import type { EyeShape, ModuleShape, QrRenderStyle } from "../../generator/qr/renderQr.ts";

export type GeneratorStyle = QrRenderStyle & { ecc: EccLevel };

export const DEFAULT_STYLE: GeneratorStyle = {
  ecc: "M",
  fg: "#0a0a0a",
  bg: "#ffffff",
  moduleShape: "square",
  eyeShape: "square",
};

const MODULE_SHAPES: { value: ModuleShape; label: string }[] = [
  { value: "square", label: "Quadrate" },
  { value: "dots", label: "Punkte" },
  { value: "rounded", label: "Abgerundet" },
];

const EYE_SHAPES: { value: EyeShape; label: string }[] = [
  { value: "square", label: "Eckig" },
  { value: "rounded", label: "Rund" },
  { value: "circle", label: "Kreis" },
];

const ECC_LEVELS: { value: EccLevel; label: string }[] = [
  { value: "L", label: "L · 7%" },
  { value: "M", label: "M · 15%" },
  { value: "Q", label: "Q · 25%" },
  { value: "H", label: "H · 30%" },
];

export type StylePanelProps = {
  value: GeneratorStyle;
  onChange: (style: GeneratorStyle) => void;
};

export function StylePanel({ value, onChange }: StylePanelProps) {
  const [open, setOpen] = useState(false);
  // ECC level chosen before a logo forced it to H, restored on logo removal.
  const eccBeforeLogo = useRef<EccLevel | null>(null);
  const patch = (next: Partial<GeneratorStyle>) => onChange({ ...value, ...next });

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!value.logo) eccBeforeLogo.current = value.ecc;
      patch({
        logo: { href: String(reader.result), sizeRatio: value.logo?.sizeRatio ?? 0.18, padding: 1 },
        ecc: "H", // logos cover modules — require the strongest EC.
      });
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    patch({ logo: undefined, ecc: eccBeforeLogo.current ?? value.ecc });
    eccBeforeLogo.current = null;
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        aria-expanded={open}
      >
        Gestaltung
        <ChevronDown
          size={18}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-5 border-t border-border px-4 py-4">
          <div className="space-y-1">
            <span className="block text-sm font-medium">Fehlerkorrektur</span>
            <div className="flex flex-wrap gap-2">
              {ECC_LEVELS.map((l) => (
                <Chip
                  key={l.value}
                  active={value.ecc === l.value}
                  onClick={() => patch({ ecc: l.value })}
                >
                  {l.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vordergrund">
              {(id) => (
                <Input
                  id={id}
                  type="color"
                  value={value.fg ?? "#0a0a0a"}
                  onChange={(e) => patch({ fg: e.target.value })}
                  className="h-10 p-1"
                />
              )}
            </Field>
            <Field label="Hintergrund">
              {(id) => (
                <Input
                  id={id}
                  type="color"
                  value={value.bg === "transparent" ? "#ffffff" : (value.bg ?? "#ffffff")}
                  onChange={(e) => patch({ bg: e.target.value })}
                  className="h-10 p-1"
                />
              )}
            </Field>
          </div>

          <div className="space-y-1">
            <span className="block text-sm font-medium">Modulform</span>
            <div className="flex flex-wrap gap-2">
              {MODULE_SHAPES.map((s) => (
                <Chip
                  key={s.value}
                  active={value.moduleShape === s.value}
                  onClick={() => patch({ moduleShape: s.value })}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="block text-sm font-medium">Eckenform</span>
            <div className="flex flex-wrap gap-2">
              {EYE_SHAPES.map((s) => (
                <Chip
                  key={s.value}
                  active={value.eyeShape === s.value}
                  onClick={() => patch({ eyeShape: s.value })}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          <Switch
            label="Farbverlauf"
            checked={Boolean(value.gradient)}
            onChange={(on) =>
              patch({
                gradient: on
                  ? { type: "linear", from: "#06b6d4", to: "#3b0764", rotation: 45 }
                  : undefined,
              })
            }
          />
          {value.gradient ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Verlauf von">
                {(id) => (
                  <Input
                    id={id}
                    type="color"
                    value={value.gradient?.from ?? "#06b6d4"}
                    onChange={(e) =>
                      patch({
                        gradient: {
                          ...(value.gradient ?? { type: "linear", to: "#000" }),
                          from: e.target.value,
                        },
                      })
                    }
                    className="h-10 p-1"
                  />
                )}
              </Field>
              <Field label="Verlauf bis">
                {(id) => (
                  <Input
                    id={id}
                    type="color"
                    value={value.gradient?.to ?? "#3b0764"}
                    onChange={(e) =>
                      patch({
                        gradient: {
                          ...(value.gradient ?? { type: "linear", from: "#000" }),
                          to: e.target.value,
                        },
                      })
                    }
                    className="h-10 p-1"
                  />
                )}
              </Field>
            </div>
          ) : null}

          <Field label="Logo (optional)" hint="Bei Logo wird Fehlerkorrektur H gesetzt.">
            {(id) => (
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  // Remount on removal so the file input actually clears.
                  key={value.logo ? "logo-set" : "logo-empty"}
                  type="file"
                  accept="image/*"
                  onChange={(e) => onLogoFile(e.target.files?.[0])}
                />
                {value.logo ? (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="shrink-0 rounded-md border border-border p-2 text-fg-muted hover:bg-surface-sunken hover:text-danger"
                    aria-label="Logo entfernen"
                  >
                    <X size={16} aria-hidden />
                  </button>
                ) : null}
              </div>
            )}
          </Field>

          <Switch
            label="Rahmen mit Text"
            checked={Boolean(value.frame)}
            onChange={(on) => patch({ frame: on ? { text: "Scan me" } : undefined })}
          />
          {value.frame ? (
            <Field label="Rahmentext">
              {(id) => (
                <Input
                  id={id}
                  value={value.frame?.text ?? ""}
                  onChange={(e) => patch({ frame: { ...value.frame, text: e.target.value } })}
                />
              )}
            </Field>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
