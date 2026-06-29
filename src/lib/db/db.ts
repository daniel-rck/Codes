import { type DBSchema, type IDBPDatabase, openDB } from "idb";

// Replace this interface with your app's schema. Each store gets a
// `key`/`value` shape and (optionally) named indexes.
export interface AppSchema extends DBSchema {
  // Example:
  // tenants: {
  //   key: string;
  //   value: { id: string; name: string; createdAt: number };
  //   indexes: { byName: string };
  // };
  [storeName: string]: { key: IDBValidKey; value: unknown };
}

const DB_NAME = "app";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<AppSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AppSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, _tx) {
        // Create stores and indexes here. Example:
        // if (!db.objectStoreNames.contains("tenants")) {
        //   const store = db.createObjectStore("tenants", { keyPath: "id" });
        //   store.createIndex("byName", "name");
        // }
        void db;
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
