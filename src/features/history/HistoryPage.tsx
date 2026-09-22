import { Check, Copy, ExternalLink, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  clearGenerated,
  clearScans,
  deleteGenerated,
  deleteScan,
  type GeneratedEntry,
  listGenerated,
  listScans,
  type ScanEntry,
} from "../../db/history.ts";
import { useLiveQuery } from "../../lib/db/index.ts";
import { Badge, Button, EmptyState, PageHeader } from "../../lib/ui/index.ts";
import { toHref } from "../../shared/links.ts";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Bulk delete is irreversible — ask first. */
function confirmClear(kind: string, clear: () => Promise<void>): void {
  if (window.confirm(`Alle ${kind} Einträge löschen? Das lässt sich nicht rückgängig machen.`)) {
    void clear();
  }
}

export function HistoryPage() {
  const scans = useLiveQuery<ScanEntry[]>("scans", listScans);
  const generated = useLiveQuery<GeneratedEntry[]>("generated", listGenerated);

  const scanItems = scans.data ?? [];
  const genItems = generated.data ?? [];
  const empty = scanItems.length === 0 && genItems.length === 0;

  return (
    <>
      <PageHeader title="Verlauf" subtitle="Gescannt und erstellt — nur lokal gespeichert." />

      {empty ? (
        <EmptyState
          title="Noch kein Verlauf"
          description="Gescannte und erzeugte Codes erscheinen hier. Nichts verlässt dein Gerät."
        />
      ) : (
        <div className="space-y-8">
          <Section
            title="Gescannt"
            count={scanItems.length}
            onClear={() => confirmClear("gescannten", clearScans)}
          >
            {scanItems.map((entry) => (
              <Row
                key={entry.id}
                badge={entry.format}
                text={entry.text}
                date={formatDate(entry.createdAt)}
                onDelete={() => void deleteScan(entry.id)}
              />
            ))}
          </Section>

          <Section
            title="Erstellt"
            count={genItems.length}
            onClear={() => confirmClear("erstellten", clearGenerated)}
          >
            {genItems.map((entry) => (
              <Row
                key={entry.id}
                badge={entry.label ?? entry.format}
                text={entry.content}
                date={formatDate(entry.createdAt)}
                onDelete={() => void deleteGenerated(entry.id)}
              />
            ))}
          </Section>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  count,
  onClear,
  children,
}: {
  title: string;
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg-muted">
          {title} ({count})
        </h3>
        <Button size="sm" variant="ghost" onClick={onClear} className="hover:text-danger">
          Alle löschen
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {children}
      </ul>
    </section>
  );
}

function Row({
  badge,
  text,
  date,
  onDelete,
}: {
  badge: string;
  text: string;
  date: string;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const href = toHref(text);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — nothing to do.
    }
  };

  const iconButton =
    "shrink-0 rounded-md p-2 text-fg-subtle hover:bg-surface-sunken " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500";

  return (
    <li className="flex items-start gap-1 p-3">
      <div className="min-w-0 flex-1 pr-2">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="accent">{badge}</Badge>
          <span className="text-xs text-fg-subtle">{date}</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className={`block w-full rounded text-left text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
            expanded ? "whitespace-pre-wrap break-words" : "truncate"
          }`}
          title={expanded ? undefined : "Vollständig anzeigen"}
        >
          {text}
        </button>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className={`${iconButton} hover:text-fg`}
        aria-label={copied ? "Kopiert" : "Inhalt kopieren"}
        title={copied ? "Kopiert" : "Kopieren"}
      >
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      </button>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className={`${iconButton} hover:text-fg`}
          aria-label="Link öffnen"
          title="Öffnen"
        >
          <ExternalLink size={16} aria-hidden />
        </a>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        className={`${iconButton} hover:text-danger`}
        aria-label="Eintrag löschen"
        title="Löschen"
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </li>
  );
}
