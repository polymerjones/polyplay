const form = document.querySelector(".admin-form");
const statusEl = document.querySelector(".admin-status");
const resetBtn = document.querySelector(".reset-aura");

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("carplay_app", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("tracks")) {
        db.createObjectStore("tracks", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

async function resetAllAura() {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("tracks", "readwrite");
    const store = tx.objectStore("tracks");
    let updated = 0;
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve(updated);
        return;
      }
      const value = cursor.value;
      value.aura = 0;
      const updateReq = cursor.update(value);
      updateReq.onsuccess = () => {
        updated += 1;
        cursor.continue();
      };
      updateReq.onerror = () => reject(updateReq.error);
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = form.title.value.trim();
  const audioFile = form.audio.files[0];
  const artFile = form.art.files[0];

  if (!title || !audioFile || !artFile) {
    setStatus("Please provide title, audio, and artwork.");
    return;
  }

  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      const record = {
        title,
        sub: "Uploaded",
        audio: audioFile,
        art: artFile,
        aura: 0,
        createdAt: Date.now(),
      };
      const req = store.add(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    setStatus("Uploaded. Open the main page and refresh.");
    form.reset();
  } catch {
    setStatus("Upload failed. Try again.");
  }
});

resetBtn.addEventListener("click", async () => {
  setStatus("Resetting aura...");
  try {
    const updated = await resetAllAura();
    setStatus(`Aura reset for ${updated} track${updated === 1 ? "" : "s"}. Refresh the main page.`);
  } catch {
    setStatus("Aura reset failed. Try again.");
  }
});
