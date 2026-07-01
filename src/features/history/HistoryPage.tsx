import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
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

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
          <Section title="Gescannt" count={scanItems.length} onClear={() => void clearScans()}>
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

          <Section title="Erstellt" count={genItems.length} onClear={() => void clearGenerated()}>
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
        <Button size="sm" variant="ghost" onClick={onClear}>
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
  return (
    <li className="flex items-start gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="accent">{badge}</Badge>
          <span className="text-xs text-fg-subtle">{date}</span>
        </div>
        <p className="truncate text-sm text-fg" title={text}>
          {text}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded-md p-2 text-fg-subtle hover:bg-surface-sunken hover:text-danger"
        aria-label="Eintrag löschen"
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </li>
  );
}
