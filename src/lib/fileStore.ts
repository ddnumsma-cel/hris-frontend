// Uploaded files, kept in this browser's IndexedDB by document id so they can be
// viewed later. Stands in for file storage on a server. Every call fails soft:
// if storage is blocked, uploads still record their name, just without a preview.

const DB = "heyhr-files";
const STORE = "files";

export interface StoredFile {
  blob: Blob;
  name: string;
  type: string;
  savedAt: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFile(id: string, file: File): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ blob: file, name: file.name, type: file.type, savedAt: new Date().toISOString() } satisfies StoredFile, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // No preview for this file; the upload itself still goes through.
  }
}

export async function getFile(id: string): Promise<StoredFile | null> {
  try {
    const db = await open();
    const result = await new Promise<StoredFile | null>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as StoredFile | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}
