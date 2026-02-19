export type BlobKind = "audio" | "image" | "video";

type BlobRecord = {
  key: string;
  blob: Blob;
  mime: string;
  type: BlobKind;
  createdAt: number;
};

export type BlobStat = {
  key: string;
  type: BlobKind;
  bytes: number;
  createdAt: number;
};

const DB_NAME = "showoff_db";
const DB_VERSION = 1;
const BLOBS_STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function initDB(): Promise<void> {
  const db = await openDb();
  db.close();
}

export async function putBlob(key: string, blob: Blob, meta: { type: BlobKind; createdAt?: number }): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, "readwrite");
      const store = tx.objectStore(BLOBS_STORE);
      const request = store.put({
        key,
        blob,
        mime: blob.type || "application/octet-stream",
        type: meta.type,
        createdAt: meta.createdAt ?? Date.now()
      } satisfies BlobRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function getBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, "readonly");
      const store = tx.objectStore(BLOBS_STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        const row = request.result as BlobRecord | undefined;
        resolve(row?.blob ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteBlob(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, "readwrite");
      const store = tx.objectStore(BLOBS_STORE);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function hasBlob(key: string): Promise<boolean> {
  const db = await openDb();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, "readonly");
      const store = tx.objectStore(BLOBS_STORE);
      const request = store.getKey(key);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function listBlobStats(): Promise<BlobStat[]> {
  const db = await openDb();
  try {
    return await new Promise<BlobStat[]>((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, "readonly");
      const store = tx.objectStore(BLOBS_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const rows = (request.result as BlobRecord[] | undefined) ?? [];
        resolve(
          rows.map((row) => ({
            key: row.key,
            type: row.type,
            bytes: row.blob?.size || 0,
            createdAt: Number.isFinite(row.createdAt) ? row.createdAt : Date.now()
          }))
        );
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
