import { type DBSchema, type IDBPDatabase, openDB } from "idb";

/** A barcode/QR code read by the scanner. */
export type ScanEntry = {
  id: string;
  text: string;
  format: string;
  createdAt: number;
};

/** A barcode/QR code created by the generator. */
export type GeneratedEntry = {
  id: string;
  /** "QRCode" or any zxing format name. */
  format: string;
  /** The encoded content string. */
  content: string;
  /** Optional human label (e.g. content type or a short preview). */
  label?: string;
  createdAt: number;
};

export interface AppSchema extends DBSchema {
  scans: {
    key: string;
    value: ScanEntry;
    indexes: { byCreatedAt: number };
  };
  generated: {
    key: string;
    value: GeneratedEntry;
    indexes: { byCreatedAt: number };
  };
}

const DB_NAME = "codes";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<AppSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AppSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("scans")) {
          const scans = db.createObjectStore("scans", { keyPath: "id" });
          scans.createIndex("byCreatedAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("generated")) {
          const generated = db.createObjectStore("generated", { keyPath: "id" });
          generated.createIndex("byCreatedAt", "createdAt");
        }
      },
    });
  }
  return dbPromise;
}

/** Test helper: wipe all stores in the current DB. */
export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(Array.from(db.objectStoreNames), "readwrite");
  await Promise.all(Array.from(db.objectStoreNames).map((name) => tx.objectStore(name).clear()));
  await tx.done;
  notifyMutation("*");
}

/** Notify subscribers of mutations. Channels are per-store. */
export function notifyMutation(storeName: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(`db:${storeName}`);
  channel.postMessage({ type: "mutation", at: Date.now() });
  channel.close();
}
