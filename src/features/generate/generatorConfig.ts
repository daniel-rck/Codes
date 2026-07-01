/**
 * Data-driven configuration for the QR generator: each content type lists its
 * input fields and a builder that turns the collected values into a payload
 * string (via the payload builders) plus validation.
 */
import {
  buildBitcoin,
  buildEmail,
  buildEvent,
  buildGeo,
  buildMeCard,
  buildSms,
  buildTel,
  buildText,
  buildUrl,
  buildVCard,
  buildWifi,
  type PayloadType,
  type ValidationResult,
  validate,
} from "../../generator/payloads.ts";

export type FieldType =
  | "text"
  | "textarea"
  | "tel"
  | "email"
  | "number"
  | "password"
  | "datetime-local"
  | "select";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export type ContentValues = Record<string, string>;

export type ContentTypeDef = {
  id: PayloadType;
  label: string;
  fields: FieldDef[];
  build: (values: ContentValues) => string;
  validate: (values: ContentValues) => ValidationResult;
};

function num(value: string | undefined): number {
  return value ? Number(value) : Number.NaN;
}

export const CONTENT_TYPES: ContentTypeDef[] = [
  {
    id: "url",
    label: "URL",
    fields: [{ key: "url", label: "Adresse", type: "text", placeholder: "example.com" }],
    build: (v) => buildUrl({ url: v.url ?? "" }),
    validate: (v) => validate("url", v),
  },
  {
    id: "text",
    label: "Text",
    fields: [{ key: "text", label: "Text", type: "textarea", placeholder: "Beliebiger Text …" }],
    build: (v) => buildText({ text: v.text ?? "" }),
    validate: (v) => validate("text", v),
  },
  {
    id: "wifi",
    label: "WLAN",
    fields: [
      { key: "ssid", label: "Netzwerkname (SSID)", type: "text" },
      { key: "password", label: "Passwort", type: "password" },
      {
        key: "encryption",
        label: "Verschlüsselung",
        type: "select",
        options: [
          { value: "WPA", label: "WPA/WPA2" },
          { value: "WEP", label: "WEP" },
          { value: "nopass", label: "Offen" },
        ],
      },
    ],
    build: (v) =>
      buildWifi({
        ssid: v.ssid ?? "",
        password: v.password,
        encryption: (v.encryption as "WPA" | "WEP" | "nopass") || "WPA",
      }),
    validate: (v) => validate("wifi", v),
  },
  {
    id: "vcard",
    label: "Kontakt",
    fields: [
      { key: "firstName", label: "Vorname", type: "text" },
      { key: "lastName", label: "Nachname", type: "text" },
      { key: "organization", label: "Organisation", type: "text" },
      { key: "phone", label: "Telefon", type: "tel" },
      { key: "email", label: "E-Mail", type: "email" },
      { key: "url", label: "Webseite", type: "text" },
      { key: "address", label: "Adresse", type: "text" },
    ],
    build: (v) => buildVCard(v),
    validate: (v) => validate("vcard", v),
  },
  {
    id: "mecard",
    label: "MeCard",
    fields: [
      { key: "firstName", label: "Vorname", type: "text" },
      { key: "lastName", label: "Nachname", type: "text" },
      { key: "phone", label: "Telefon", type: "tel" },
      { key: "email", label: "E-Mail", type: "email" },
    ],
    build: (v) => buildMeCard(v),
    validate: (v) => validate("mecard", v),
  },
  {
    id: "email",
    label: "E-Mail",
    fields: [
      { key: "to", label: "Empfänger", type: "email" },
      { key: "subject", label: "Betreff", type: "text" },
      { key: "body", label: "Nachricht", type: "textarea" },
    ],
    build: (v) => buildEmail({ to: v.to ?? "", subject: v.subject, body: v.body }),
    validate: (v) => validate("email", v),
  },
  {
    id: "sms",
    label: "SMS",
    fields: [
      { key: "number", label: "Nummer", type: "tel" },
      { key: "message", label: "Nachricht", type: "textarea" },
    ],
    build: (v) => buildSms({ number: v.number ?? "", message: v.message }),
    validate: (v) => validate("sms", v),
  },
  {
    id: "tel",
    label: "Telefon",
    fields: [{ key: "number", label: "Nummer", type: "tel" }],
    build: (v) => buildTel({ number: v.number ?? "" }),
    validate: (v) => validate("tel", v),
  },
  {
    id: "geo",
    label: "Standort",
    fields: [
      { key: "lat", label: "Breitengrad", type: "number", placeholder: "48.137" },
      { key: "lon", label: "Längengrad", type: "number", placeholder: "11.575" },
    ],
    build: (v) => buildGeo({ lat: num(v.lat), lon: num(v.lon) }),
    validate: (v) => validate("geo", v),
  },
  {
    id: "event",
    label: "Termin",
    fields: [
      { key: "summary", label: "Titel", type: "text" },
      { key: "start", label: "Beginn", type: "datetime-local" },
      { key: "end", label: "Ende", type: "datetime-local" },
      { key: "location", label: "Ort", type: "text" },
    ],
    build: (v) =>
      buildEvent({
        summary: v.summary ?? "",
        start: v.start ?? "",
        end: v.end || undefined,
        location: v.location,
      }),
    validate: (v) => validate("event", v),
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    fields: [
      { key: "address", label: "Adresse", type: "text" },
      { key: "amount", label: "Betrag (BTC)", type: "number" },
      { key: "label", label: "Label", type: "text" },
    ],
    build: (v) =>
      buildBitcoin({
        address: v.address ?? "",
        amount: v.amount ? Number(v.amount) : undefined,
        label: v.label,
      }),
    validate: (v) => validate("bitcoin", v),
  },
];
