import { Clock } from "lucide-react";
import { EmptyState, PageHeader } from "../../lib/ui/index.ts";

export function HistoryPage() {
  return (
    <>
      <PageHeader
        title="Verlauf"
        subtitle="Gescannte und erstellte Codes — nur lokal gespeichert."
      />
      <EmptyState
        icon={<Clock size={40} aria-hidden />}
        title="Noch kein Verlauf"
        description="Der lokale Verlauf wird in einer späteren Phase ergänzt."
      />
    </>
  );
}
