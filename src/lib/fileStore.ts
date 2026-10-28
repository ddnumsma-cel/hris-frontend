// Uploaded files, kept in this browser's IndexedDB by document id so they can be
// viewed later. Stands in for file storage on a server. Every call fails soft:
// if storage is blocked, uploads still record their name, just without a preview.

import { api, serverMode } from "./http";
import { backendOn } from "./backend/client";
import { backendOpenFile, stashFile } from "./backend/documents";

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

const asDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that file"));
    r.readAsDataURL(file);
  });

/**
 * With the API server, a company policy's document (id "policy-…", uploaded before the policy is saved)
 * is stored on the server; this maps the form's id to the server's file id for savePolicy.
 */
export const uploadedPolicyFiles = new Map<string, string>();

export async function saveFile(id: string, file: File): Promise<void> {
  // With the backend, 201 papers are sent with their upload action (lib/backend/documents.ts); policy files stay as before.
  if (backendOn() && !id.startsWith("policy-")) return stashFile(id, file);
  if (serverMode && id.startsWith("policy-")) {
    const { id: serverId } = await api<{ id: string }>("POST", "/policies/files", { fileName: file.name, dataUrl: await asDataUrl(file) });
    uploadedPolicyFiles.set(id, serverId);
    return;
  }
  // With the API server the file is stored with the document, so HR can open it from any computer.
  if (serverMode) return void (await api("PUT", `/corehr/documents/${encodeURIComponent(id)}/file`, { fileName: file.name, dataUrl: await asDataUrl(file) }));
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
  // With the backend, a 201 paper opens from there (every opening is recorded).
  if (backendOn() && !id.startsWith("policy-")) return backendOpenFile(id);
  if (serverMode) {
    const res = await fetch(`/api/corehr/documents/${encodeURIComponent(id)}/file`, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return { blob, name: "document", type: blob.type, savedAt: "" };
  }
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
