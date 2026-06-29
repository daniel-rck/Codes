/**
 * Local-first history: scans and generated codes persisted in IndexedDB.
 * Nothing leaves the device. Entries are addable, listable (newest first) and
 * deletable individually or in bulk.
 */
import { type GeneratedEntry, getDB, notifyMutation, type ScanEntry } from "../lib/db/index.ts";

export type { GeneratedEntry, ScanEntry };

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export async function addScan(text: string, format: string): Promise<ScanEntry> {
  const entry: ScanEntry = { id: newId(), text, format, createdAt: Date.now() };
  const db = await getDB();
  await db.put("scans", entry);
  notifyMutation("scans");
  return entry;
}

export async function addGenerated(
  data: Omit<GeneratedEntry, "id" | "createdAt">,
): Promise<GeneratedEntry> {
  const entry: GeneratedEntry = { ...data, id: newId(), createdAt: Date.now() };
  const db = await getDB();
  await db.put("generated", entry);
  notifyMutation("generated");
  return entry;
}

export async function listScans(): Promise<ScanEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("scans", "byCreatedAt");
  return all.reverse();
}

export async function listGenerated(): Promise<GeneratedEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("generated", "byCreatedAt");
  return all.reverse();
}

export async function deleteScan(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("scans", id);
  notifyMutation("scans");
}

export async function deleteGenerated(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("generated", id);
  notifyMutation("generated");
}

export async function clearScans(): Promise<void> {
  const db = await getDB();
  await db.clear("scans");
  notifyMutation("scans");
}

export async function clearGenerated(): Promise<void> {
  const db = await getDB();
  await db.clear("generated");
  notifyMutation("generated");
}
