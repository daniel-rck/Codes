/**
 * Content-type payload builders for QR codes. Each builder turns a typed input
 * into the canonical string that scanners recognise (URL, vCard/MeCard, WiFi,
 * mailto, SMS, tel, geo, VEVENT, Bitcoin), plus lightweight validation.
 */

export type PayloadType =
  | "url"
  | "text"
  | "vcard"
  | "mecard"
  | "wifi"
  | "email"
  | "sms"
  | "tel"
  | "geo"
  | "event"
  | "bitcoin";

export type ValidationResult = { ok: true } | { ok: false; error: string };

// ── helpers ──────────────────────────────────────────────────────────

/** Escape characters significant in WiFi / MeCard payloads (\ ; , : "). */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

/** Escape characters significant in vCard 3.0 text values. */
function escapeVcard(value: string): string {
  return value.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
}

function escapeMecard(value: string): string {
  return value.replace(/([\\;:,])/g, "\\$1");
}

function encodeQuery(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
}

/** Format a Date (or ISO string) as iCalendar basic UTC, e.g. 20260101T090000Z. */
export function toICalDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new Error("Ungültiges Datum.");
  return `${date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")}`;
}

// ── inputs ───────────────────────────────────────────────────────────

export type UrlInput = { url: string };
export type TextInput = { text: string };
export type WifiInput = {
  ssid: string;
  password?: string;
  encryption?: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
};
export type EmailInput = { to: string; subject?: string; body?: string };
export type SmsInput = { number: string; message?: string };
export type TelInput = { number: string };
export type GeoInput = { lat: number; lon: number; altitude?: number };
export type VCardInput = {
  firstName?: string;
  lastName?: string;
  organization?: string;
  title?: string;
  phone?: string;
  email?: string;
  url?: string;
  address?: string;
  note?: string;
};
export type EventInput = {
  summary: string;
  start: string | Date;
  end?: string | Date;
  location?: string;
  description?: string;
};
export type BitcoinInput = {
  address: string;
  amount?: number;
  label?: string;
  message?: string;
};

// ── builders ─────────────────────────────────────────────────────────

/** Normalise a URL, prepending https:// when no scheme is present. */
export function buildUrl({ url }: UrlInput): string {
  const trimmed = url.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^[a-z]+:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildText({ text }: TextInput): string {
  return text;
}

export function buildWifi({ ssid, password, encryption = "WPA", hidden }: WifiInput): string {
  const enc = encryption === "nopass" ? "nopass" : encryption;
  const parts = [`T:${enc}`, `S:${escapeWifi(ssid)}`];
  if (encryption !== "nopass" && password) parts.push(`P:${escapeWifi(password)}`);
  if (hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

export function buildEmail({ to, subject, body }: EmailInput): string {
  return `mailto:${to.trim()}${encodeQuery({ subject, body })}`;
}

export function buildSms({ number, message }: SmsInput): string {
  const n = number.replace(/[^\d+]/g, "");
  return message ? `SMSTO:${n}:${message}` : `SMSTO:${n}`;
}

export function buildTel({ number }: TelInput): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

export function buildGeo({ lat, lon, altitude }: GeoInput): string {
  return altitude !== undefined ? `geo:${lat},${lon},${altitude}` : `geo:${lat},${lon}`;
}

export function buildVCard(input: VCardInput): string {
  const first = input.firstName ?? "";
  const last = input.lastName ?? "";
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`);
  lines.push(`FN:${escapeVcard(`${first} ${last}`.trim())}`);
  if (input.organization) lines.push(`ORG:${escapeVcard(input.organization)}`);
  if (input.title) lines.push(`TITLE:${escapeVcard(input.title)}`);
  if (input.phone) lines.push(`TEL;TYPE=CELL:${escapeVcard(input.phone)}`);
  if (input.email) lines.push(`EMAIL:${escapeVcard(input.email)}`);
  if (input.url) lines.push(`URL:${escapeVcard(input.url)}`);
  if (input.address) lines.push(`ADR;TYPE=HOME:;;${escapeVcard(input.address)};;;;`);
  if (input.note) lines.push(`NOTE:${escapeVcard(input.note)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export function buildMeCard(input: VCardInput): string {
  const name = [input.lastName, input.firstName]
    .filter((v): v is string => Boolean(v))
    .map(escapeMecard)
    .join(",");
  const fields: string[] = [];
  if (name) fields.push(`N:${name}`);
  if (input.phone) fields.push(`TEL:${escapeMecard(input.phone)}`);
  if (input.email) fields.push(`EMAIL:${escapeMecard(input.email)}`);
  if (input.url) fields.push(`URL:${escapeMecard(input.url)}`);
  if (input.address) fields.push(`ADR:${escapeMecard(input.address)}`);
  if (input.organization) fields.push(`ORG:${escapeMecard(input.organization)}`);
  if (input.note) fields.push(`NOTE:${escapeMecard(input.note)}`);
  return `MECARD:${fields.join(";")};;`;
}

export function buildEvent(input: EventInput): string {
  const lines = ["BEGIN:VEVENT", `SUMMARY:${escapeVcard(input.summary)}`];
  lines.push(`DTSTART:${toICalDate(input.start)}`);
  if (input.end) lines.push(`DTEND:${toICalDate(input.end)}`);
  if (input.location) lines.push(`LOCATION:${escapeVcard(input.location)}`);
  if (input.description) lines.push(`DESCRIPTION:${escapeVcard(input.description)}`);
  lines.push("END:VEVENT");
  return lines.join("\n");
}

export function buildBitcoin({ address, amount, label, message }: BitcoinInput): string {
  return `bitcoin:${address.trim()}${encodeQuery({
    amount: amount !== undefined ? String(amount) : undefined,
    label,
    message,
  })}`;
}

// ── validation ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(type: PayloadType, value: Record<string, unknown>): ValidationResult {
  switch (type) {
    case "url":
      return typeof value.url === "string" && value.url.trim().length > 0
        ? { ok: true }
        : { ok: false, error: "Bitte eine URL eingeben." };
    case "text":
      return typeof value.text === "string" && value.text.length > 0
        ? { ok: true }
        : { ok: false, error: "Bitte einen Text eingeben." };
    case "wifi":
      return typeof value.ssid === "string" && value.ssid.length > 0
        ? { ok: true }
        : { ok: false, error: "Bitte einen Netzwerknamen (SSID) eingeben." };
    case "email":
      return typeof value.to === "string" && EMAIL_RE.test(value.to)
        ? { ok: true }
        : { ok: false, error: "Bitte eine gültige E-Mail-Adresse eingeben." };
    case "sms":
    case "tel":
      return typeof value.number === "string" && value.number.replace(/[^\d+]/g, "").length >= 3
        ? { ok: true }
        : { ok: false, error: "Bitte eine gültige Telefonnummer eingeben." };
    case "geo": {
      const lat = Number(value.lat);
      const lon = Number(value.lon);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        return { ok: false, error: "Breitengrad muss zwischen -90 und 90 liegen." };
      }
      if (Number.isNaN(lon) || lon < -180 || lon > 180) {
        return { ok: false, error: "Längengrad muss zwischen -180 und 180 liegen." };
      }
      return { ok: true };
    }
    case "vcard":
    case "mecard":
      return (value.firstName as string)?.length || (value.lastName as string)?.length
        ? { ok: true }
        : { ok: false, error: "Bitte mindestens einen Namen eingeben." };
    case "event":
      return typeof value.summary === "string" && value.summary.length > 0 && value.start != null
        ? { ok: true }
        : { ok: false, error: "Titel und Startzeitpunkt sind erforderlich." };
    case "bitcoin":
      return typeof value.address === "string" && value.address.trim().length > 0
        ? { ok: true }
        : { ok: false, error: "Bitte eine Bitcoin-Adresse eingeben." };
    default:
      return { ok: false, error: "Unbekannter Typ." };
  }
}
