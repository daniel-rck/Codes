/** Absolute href for openable decoded payloads, or null when not a link. */
export function toHref(text: string): string | null {
  const trimmed = text.trim();
  if (/^(https?|mailto|tel|sms|geo|bitcoin):/i.test(trimmed)) return trimmed;
  // A bare "www.…" would resolve relative to the app origin — make it absolute.
  if (/^www\.\S+$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}
