import { ScanLine } from "lucide-react";
import { EmptyState, PageHeader } from "../../lib/ui/index.ts";

export function ScanPage() {
  return (
    <>
      <PageHeader
        title="Scannen"
        subtitle="Barcode oder QR-Code mit der Kamera oder aus einem Bild lesen."
      />
      <EmptyState
        icon={<ScanLine size={40} aria-hidden />}
        title="Scanner folgt"
        description="Kamera- und Bild-Scan werden in einer späteren Phase ergänzt."
      />
    </>
  );
}
