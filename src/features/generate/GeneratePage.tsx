import { QrCode } from "lucide-react";
import { EmptyState, PageHeader } from "../../lib/ui/index.ts";

export function GeneratePage() {
  return (
    <>
      <PageHeader title="Erstellen" subtitle="Barcodes und QR-Codes lokal erzeugen." />
      <EmptyState
        icon={<QrCode size={40} aria-hidden />}
        title="Generator folgt"
        description="Der QR-Encoder und die Generator-Oberfläche werden in späteren Phasen ergänzt."
      />
    </>
  );
}
