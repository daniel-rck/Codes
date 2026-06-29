# codes

**Barcodes und QR-Codes lesen und erzeugen — vollständig lokal, offline-fähig.**

`codes` ist eine Standalone-PWA zum gleichwertigen **Lesen und Erstellen** von
Barcodes und QR-Codes. Alles läuft client-side: Kein Backend, kein Tracking,
keine Inhalte verlassen das Gerät. Einzige Domain-Abhängigkeit ist
[`zxing-wasm`](https://github.com/Sec-ant/zxing-wasm) (liest *und* schreibt) — der
QR-Encoder samt Styling ist Eigenbau.

## Funktionen

- **Scannen** — Kamera (Rückkamera, Geräte-Wahl, Taschenlampe) mit Live-Decoding
  im Web Worker, oder Scan aus einem Bild. WASM-Pfad auf allen Plattformen,
  deterministisch gleich.
- **Erstellen** — QR-Codes mit eigenem, abhängigkeitsfreiem Encoder
  (Reed-Solomon, Versionen 1–40, alle EC-Level) und gestyltem Renderer
  (Farben, Verläufe, Modul-/Eckenformen, Logo mit Aussparung, CTA-Rahmen).
  Nicht-QR-Formate (EAN, Code128, Code39, ITF, PDF417, Data Matrix, Aztec …)
  über den zxing-Writer.
- **Inhaltstypen** — URL, Text, WLAN, Kontakt (vCard/MeCard), E-Mail, SMS,
  Telefon, Standort, Termin (VEVENT), Bitcoin.
- **Export** — SVG, PNG und PDF (abhängigkeitsfrei via `CompressionStream`).
- **Verlauf** — gescannte und erzeugte Codes, rein lokal in IndexedDB,
  einzeln oder komplett löschbar.
- **Offline** — App-Shell *und* das WASM-Modul werden vom Service Worker
  vorgeladen; Scannen und Erzeugen funktionieren ohne Netz.

## Stack

Bun · React 19 · Vite 8 · TypeScript (strict) · Tailwind 4 · Biome ·
idb/`useLiveQuery` · injectManifest-PWA · Cloudflare Workers. Basis:
[`web-base`](https://github.com/daniel-rck/web-base).

## Entwicklung

```bash
bun install
bun run dev        # Dev-Server
bun run build      # Typecheck + Production-Build
bun run lint       # Biome
bun run test       # Vitest
```

### Architektur

```
src/
  scanner/    Kamera, Scan-Loop, Decode-Worker, Bild-Decode
  generator/
    qr/       eigener Encoder: reedSolomon · encode · matrix · renderQr
    barcode/  writeOther (zxing-Writer für Nicht-QR)
    payloads  Inhaltstyp-Builder + Validierung
  shared/     zxing-Setup (lokales WASM-Hosting) · Export (SVG/PNG/PDF)
  db/         lokaler Verlauf (IndexedDB)
  features/   Screens: scan · generate · history
  lib/ui/     web-base-UI
```

### Tests

Das Herz ist der eigene QR-Encoder. Sicherheitsnetz:

- Reed-Solomon gegen den ISO/IEC-18004-Referenzvektor (V1-M).
- **Roundtrip**: eigener Encode → `zxing readBarcodes` = identischer Input,
  über alle vier EC-Level und mehrere Versionen.
- Lesbarkeits-Tests gestylter Varianten (Punkte, abgerundet, Logo @ ECC H).

## Deployment

```bash
bun run worker:deploy   # Cloudflare Workers (Wrangler)
```

## Datenschutz

Lokal-first by design: keine Telemetrie, kein Tracking, kein Sync. Der Verlauf
liegt ausschließlich im IndexedDB des Geräts und lässt sich jederzeit löschen.

## Lizenz

MIT
