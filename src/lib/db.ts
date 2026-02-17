import type { Track } from "../types";

export type DbTrackRecord = {
  id: number;
  title?: string;
  sub?: string;
  aura?: number;
  audio?: Blob;
  art?: Blob;
  createdAt?: number;
};

const DB_NAME = "carplay_app";
const DB_VERSION = 1;
const STORE_NAME = "tracks";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAllRows(db: IDBDatabase): Promise<DbTrackRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve((req.result ?? []) as DbTrackRecord[]);
    req.onerror = () => reject(req.error);
  });
}

function clampAura(aura: number): number {
  return Math.max(0, Math.min(5, Math.round(aura)));
}

export async function getTracksFromDb(): Promise<Track[]> {
  const db = await openDb();
  const rows = await readAllRows(db);

  return rows
    .slice()
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .map((row) => {
      const audioUrl = row.audio ? URL.createObjectURL(row.audio) : undefined;
      const artUrl = row.art ? URL.createObjectURL(row.art) : undefined;

      return {
        id: String(row.id),
        title: row.title?.trim() || `Track ${row.id}`,
        sub: row.sub || "Uploaded",
        aura: clampAura(row.aura ?? 0),
        audioUrl,
        artUrl,
        audioBlob: row.audio,
        artBlob: row.art,
        persistedNumericId: row.id
      } satisfies Track;
    });
}

export async function getTrackRowsFromDb(): Promise<DbTrackRecord[]> {
  const db = await openDb();
  const rows = await readAllRows(db);
  return rows.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function addTrackToDb(params: {
  title: string;
  sub?: string;
  audio: Blob;
  art?: Blob | null;
}): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add({
      title: params.title,
      sub: params.sub || "Uploaded",
      audio: params.audio,
      art: params.art || null,
      aura: 0,
      createdAt: Date.now()
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveAuraToDb(trackId: number, aura: number): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(trackId);

    getReq.onsuccess = () => {
      const row = getReq.result as DbTrackRecord | undefined;
      if (!row) {
        resolve();
        return;
      }

      row.aura = clampAura(aura);
      const putReq = store.put(row);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function updateArtworkInDb(trackId: number, art: Blob): Promise<void> {
  const db = await openDb();
  await updateTrackById(db, trackId, (row) => {
    row.art = art;
  });
}

export async function replaceAudioInDb(trackId: number, audio: Blob): Promise<void> {
  const db = await openDb();
  await updateTrackById(db, trackId, (row) => {
    row.audio = audio;
  });
}

export async function removeTrackFromDb(trackId: number): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(trackId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function resetAuraInDb(): Promise<number> {
  const db = await openDb();

  return await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let updated = 0;
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve(updated);
        return;
      }

      const row = cursor.value as DbTrackRecord;
      row.aura = 0;
      const updateReq = cursor.update(row);
      updateReq.onsuccess = () => {
        updated += 1;
        cursor.continue();
      };
      updateReq.onerror = () => reject(updateReq.error);
    };

    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function clearTracksInDb(): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function updateTrackById(
  db: IDBDatabase,
  trackId: number,
  mutator: (row: DbTrackRecord) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(trackId);

    getReq.onsuccess = () => {
      const row = getReq.result as DbTrackRecord | undefined;
      if (!row) {
        reject(new Error("Track not found"));
        return;
      }

      mutator(row);
      const putReq = store.put(row);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}
