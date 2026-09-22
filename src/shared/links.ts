/** Absolute href for openable decoded payloads, or null when not a link. */
export function toHref(text: string): string | null {
  const trimmed = text.trim();
  if (/^(https?|mailto|tel|sms|geo|bitcoin):/i.test(trimmed)) return trimmed;
  // SMS QR codes use "SMSTO:<number>:<message>", which browsers don't open —
  // translate to the RFC 5724 "sms:" URI.
  const smsto = /^smsto:([^:]*)(?::([\s\S]*))?$/i.exec(trimmed);
  if (smsto) {
    const body = smsto[2] ? `?body=${encodeURIComponent(smsto[2])}` : "";
    return `sms:${smsto[1]}${body}`;
  }
  // A bare "www.…" would resolve relative to the app origin — make it absolute.
  if (/^www\.\S+$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}
