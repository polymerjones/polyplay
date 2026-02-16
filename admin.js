const form = document.querySelector(".admin-form");
const statusEl = document.querySelector(".admin-status");
const resetBtn = document.querySelector(".reset-aura");
const artworkForm = document.querySelector(".artwork-form");
const trackSelect = document.querySelector(".track-select");
const artworkStatus = document.querySelector(".artwork-status");
const updateArtworkBtn = document.querySelector(".update-artwork");
const artworkThumb = document.querySelector(".artwork-thumb");
const uploadArtworkCanvas = document.querySelector(".upload-artwork-canvas");
const uploadArtworkCrop = document.querySelector(".upload-artwork-crop");
const uploadArtworkCtx = uploadArtworkCanvas?.getContext("2d");
const uploadZoom = form?.querySelector("input[name=\"uploadZoom\"]");
const uploadPanX = form?.querySelector("input[name=\"uploadPanX\"]");
const uploadPanY = form?.querySelector("input[name=\"uploadPanY\"]");
const artworkCanvas = artworkForm?.querySelector(".artwork-canvas");
const artworkCtx = artworkCanvas?.getContext("2d");
const cropControls = artworkForm?.querySelector(".crop-controls");
const zoomInput = artworkForm?.querySelector("input[name='zoom']");
const panXInput = artworkForm?.querySelector("input[name='panX']");
const panYInput = artworkForm?.querySelector("input[name='panY']");
const removeForm = document.querySelector(".remove-form");
const removeSelect = document.querySelector(".remove-track-select");
const removeBtn = document.querySelector(".remove-track");
const removeStatus = document.querySelector(".remove-status");
const replaceAudioForm = document.querySelector(".replace-audio-form");
const replaceAudioSelect = document.querySelector(".replace-audio-select");
const replaceAudioBtn = document.querySelector(".replace-audio");
const replaceAudioStatus = document.querySelector(".replace-audio-status");
const nukeBtn = document.querySelector(".nuke-polyplaylist");
const nukeModal = document.querySelector(".nuke-modal");
const nukeCancel = document.querySelector("[data-nuke-cancel]");
const nukeConfirm = document.querySelector("[data-nuke-confirm]");
const nukeCountdown = document.querySelector(".nuke-countdown");
const nukeNumber = document.querySelector(".nuke-number");
const nukeAbort = document.querySelector(".nuke-abort");
const splashVideo = document.querySelector(".splash-video");

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


function sparkleButton(button) {
  if (!button) return;
  button.classList.remove('sparkle');
  void button.offsetWidth;
  button.classList.add('sparkle');
  if (navigator.vibrate) navigator.vibrate(12);
}

function setArtworkStatus(text) {
  artworkStatus.textContent = text;
}


function setupDropZone(label, input) {
  if (!label || !input) return;
  const addOver = () => label.classList.add('dragover');
  const removeOver = () => label.classList.remove('dragover');
  label.addEventListener('dragenter', (e) => {
    e.preventDefault();
    addOver();
  });
  label.addEventListener('dragover', (e) => {
    e.preventDefault();
    addOver();
  });
  label.addEventListener('dragleave', () => {
    removeOver();
  });
  label.addEventListener('drop', (e) => {
    e.preventDefault();
    removeOver();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
}

let cropImage = null;
let cropImageUrl = null;
const ART_EXPORT_SIZE = 1024;

function renderCroppedBlob(image, zoom, panX, panY, size = ART_EXPORT_SIZE) {
  return new Promise((resolve) => {
    if (!image) return resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);
    const iw = image.width;
    const ih = image.height;
    const baseScale = Math.max(size / iw, size / ih);
    const scale = baseScale * zoom;
    const drawW = iw * scale;
    const drawH = ih * scale;
    const offsetX = (size - drawW) / 2 + panX * size;
    const offsetY = (size - drawH) / 2 + panY * size;
    ctx.fillStyle = "#111824";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

function setCanvasEmpty(message) {
  if (!artworkCtx || !artworkCanvas) return;
  artworkCtx.clearRect(0, 0, artworkCanvas.width, artworkCanvas.height);
  artworkCtx.fillStyle = "#111824";
  artworkCtx.fillRect(0, 0, artworkCanvas.width, artworkCanvas.height);
  artworkCtx.fillStyle = "rgba(233, 240, 247, 0.7)";
  artworkCtx.font = "12px Avenir, sans-serif";
  artworkCtx.textAlign = "center";
  artworkCtx.textBaseline = "middle";
  artworkCtx.fillText(message, artworkCanvas.width / 2, artworkCanvas.height / 2);
}

function loadCropImageFromBlob(blob) {
  if (!blob || !artworkCanvas) return;
  if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
  cropImageUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    cropImage = img;
    drawCrop();
  };
  img.src = cropImageUrl;
}

function drawCrop() {
  if (!artworkCtx || !artworkCanvas) return;
  if (!cropImage) {
    setCanvasEmpty("No artwork");
    return;
  }
  const zoom = Number(zoomInput?.value || 1);
  const panX = Number(panXInput?.value || 0);
  const panY = Number(panYInput?.value || 0);
  const cw = artworkCanvas.width;
  const ch = artworkCanvas.height;
  const iw = cropImage.width;
  const ih = cropImage.height;
  const baseScale = Math.max(cw / iw, ch / ih);
  const scale = baseScale * zoom;
  const drawW = iw * scale;
  const drawH = ih * scale;
  const offsetX = (cw - drawW) / 2 + panX * cw;
  const offsetY = (ch - drawH) / 2 + panY * ch;
  artworkCtx.clearRect(0, 0, cw, ch);
  artworkCtx.fillStyle = "#111824";
  artworkCtx.fillRect(0, 0, cw, ch);
  artworkCtx.drawImage(cropImage, offsetX, offsetY, drawW, drawH);
}

function getCroppedBlob() {
  const zoom = Number(zoomInput?.value || 1);
  const panX = Number(panXInput?.value || 0);
  const panY = Number(panYInput?.value || 0);
  return renderCroppedBlob(cropImage, zoom, panX, panY);
}

function setRemoveStatus(text) {
  removeStatus.textContent = text;
}

function setReplaceAudioStatus(text) {
  replaceAudioStatus.textContent = text;
}

async function getTracks() {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("tracks", "readonly");
    const store = tx.objectStore("tracks");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function refreshTrackSelect() {
  try {
    const tracks = await getTracks();
    const trackMap = new Map(tracks.map((t) => [String(t.id), t]));
    trackSelect.innerHTML = "";
    removeSelect.innerHTML = "";
    replaceAudioSelect.innerHTML = "";
    if (!tracks.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No tracks found";
      trackSelect.appendChild(opt);
      removeSelect.appendChild(opt.cloneNode(true));
      trackSelect.disabled = true;
      updateArtworkBtn.disabled = true;
      removeSelect.disabled = true;
      removeBtn.disabled = true;
      replaceAudioSelect.disabled = true;
      replaceAudioBtn.disabled = true;
      return;
    }
    trackSelect.disabled = false;
    updateArtworkBtn.disabled = false;
    removeSelect.disabled = false;
    removeBtn.disabled = false;
    replaceAudioSelect.disabled = false;
    replaceAudioBtn.disabled = false;
    tracks.forEach((track) => {
      const opt = document.createElement("option");
      opt.value = String(track.id);
      opt.textContent = track.title || `Track ${track.id}`;
      trackSelect.appendChild(opt);
      const opt2 = opt.cloneNode(true);
      removeSelect.appendChild(opt2);
      const opt3 = opt.cloneNode(true);
      replaceAudioSelect.appendChild(opt3);
    });
    const initial = trackSelect.value || tracks[0]?.id;
    if (initial) {
      trackSelect.value = String(initial);
      updateArtworkPreview(trackMap.get(String(initial)));
    }
  } catch {
    trackSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Unable to load tracks";
    trackSelect.appendChild(opt);
    trackSelect.disabled = true;
    updateArtworkBtn.disabled = true;
  }
}

function updateArtworkPreview(track) {
  artworkThumb.innerHTML = "";
  if (!track || !track.art) {
    artworkThumb.textContent = "No artwork";
    artworkThumb.classList.add("empty");
    return;
  }
  artworkThumb.classList.remove("empty");
  const url = URL.createObjectURL(track.art);
  const img = document.createElement("img");
  img.src = url;
  img.alt = "Current artwork";
  img.onload = () => URL.revokeObjectURL(url);
  artworkThumb.appendChild(img);
  loadCropImageFromBlob(track.art);
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
  sparkleButton(form.querySelector(".admin-primary"));
  let audioFile = form.audio.files[0];
  const artFile = form.art.files[0];

  if (!audioFile) {
    setStatus("Please provide an audio file.");
    return;
  }

  const rawTitle = form.title.value.trim();
  const fallbackTitle = audioFile.name.replace(/\.[^/.]+$/, "").trim();
  const title = rawTitle || fallbackTitle || "Untitled";

  try {
    const finalArt = artFile ? ((await getUploadCroppedBlob()) || artFile) : null;
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      const record = {
        title,
        sub: "Uploaded",
        audio: audioFile,
        art: finalArt,
        aura: 0,
        createdAt: Date.now(),
      };
      const req = store.add(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    setStatus("Uploaded. Opening music page...");
    form.reset();
    await refreshTrackSelect();
    window.location.href = "index.html";
  } catch {
    setStatus("Upload failed. Try again.");
  }
});

resetBtn.addEventListener("click", async () => {
  if (!confirm("Reset aura for all tracks?")) return;
  setStatus("Resetting aura...");
  try {
    const updated = await resetAllAura();
    setStatus(`Aura reset for ${updated} track${updated === 1 ? "" : "s"}. Refresh the main page.`);
  } catch {
    setStatus("Aura reset failed. Try again.");
  }
});

artworkForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

updateArtworkBtn.addEventListener("click", async () => {
  const trackId = trackSelect.value;
  const artFile = artworkForm.artwork.files[0];
  if (!trackId) {
    setArtworkStatus("Select a track first.");
    return;
  }
  if (!artFile && !cropImage) {
    setArtworkStatus("Choose a new artwork image.");
    return;
  }
  setArtworkStatus("Updating artwork...");
  try {
    const cropped = await getCroppedBlob();
    const finalBlob = cropped || artFile;
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      const getReq = store.get(Number(trackId));
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          reject(new Error("Track not found"));
          return;
        }
        record.art = finalBlob;
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
    setArtworkStatus("Artwork updated. Refresh the main page.");
    artworkForm.reset();
    refreshTrackSelect();
  } catch {
    setArtworkStatus("Update failed. Try again.");
  }
});

removeBtn.addEventListener("click", async () => {
  const trackId = removeSelect.value;
  if (!trackId) {
    setRemoveStatus("Select a track first.");
    return;
  }
  if (!confirm("Remove this track? This cannot be undone.")) return;
  setRemoveStatus("Removing track...");
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      const req = store.delete(Number(trackId));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    setRemoveStatus("Track removed. Refresh the main page.");
    refreshTrackSelect();
  } catch {
    setRemoveStatus("Remove failed. Try again.");
  }
});

trackSelect.addEventListener("change", async () => {
  try {
    const tracks = await getTracks();
    const track = tracks.find((t) => String(t.id) === trackSelect.value);
    updateArtworkPreview(track);
  } catch {
    artworkThumb.textContent = "No artwork";
  }
});

removeSelect.addEventListener("change", () => {
  setRemoveStatus("");
});

refreshTrackSelect();

if (splashVideo) {
  splashVideo.muted = true;
  splashVideo.addEventListener("loadedmetadata", () => {
    splashVideo.currentTime = 0;
    splashVideo.play().catch(() => {});
  });
}


const artworkFileInput = artworkForm?.querySelector("input[name='artwork']");
if (artworkFileInput) {
  artworkFileInput.addEventListener("change", () => {
    const file = artworkFileInput.files[0];
    if (file) {
      loadCropImageFromBlob(file);
      setArtworkStatus("");
    }
  });
}

if (cropControls) {
  [zoomInput, panXInput, panYInput].forEach((input) => {
    if (input) input.addEventListener("input", drawCrop);
  });
}


const audioInput = form?.querySelector("input[name='audio']");
const artInput = form?.querySelector("input[name='art']");
const artworkInput = artworkForm?.querySelector("input[name='artwork']");
setupDropZone(document.querySelector('[data-drop="audio"]'), audioInput);
setupDropZone(document.querySelector('[data-drop="art"]'), artInput);
setupDropZone(document.querySelector('[data-drop="artwork"]'), artworkInput);


const replaceAudioInput = replaceAudioForm?.querySelector("input[name='audio']");
setupDropZone(document.querySelector('[data-drop="audio-replace"]'), replaceAudioInput);

replaceAudioBtn?.addEventListener('click', async () => {
  const trackId = replaceAudioSelect.value;
  const audioFile = replaceAudioForm.audio.files[0];
  if (!trackId) {
    setReplaceAudioStatus('Select a track first.');
    return;
  }
  if (!audioFile) {
    setReplaceAudioStatus('Choose a new audio file.');
    return;
  }
  setReplaceAudioStatus('Replacing audio...');
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readwrite');
      const store = tx.objectStore('tracks');
      const getReq = store.get(Number(trackId));
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          reject(new Error('Track not found'));
          return;
        }
        record.audio = audioFile;
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
    setReplaceAudioStatus('Audio replaced. Refresh the main page.');
    replaceAudioForm.reset();
    refreshTrackSelect();
  } catch {
    setReplaceAudioStatus('Replace failed. Try again.');
  }
});

let uploadCropImage = null;
let uploadCropUrl = null;
let uploadCropBlob = null;
let uploadCropReady = false;

function setUploadCanvasEmpty() {
  if (!uploadArtworkCtx || !uploadArtworkCanvas) return;
  uploadArtworkCtx.clearRect(0, 0, uploadArtworkCanvas.width, uploadArtworkCanvas.height);
  uploadArtworkCtx.fillStyle = '#111824';
  uploadArtworkCtx.fillRect(0, 0, uploadArtworkCanvas.width, uploadArtworkCanvas.height);
  uploadArtworkCtx.fillStyle = 'rgba(233, 240, 247, 0.7)';
  uploadArtworkCtx.font = '12px Avenir, sans-serif';
  uploadArtworkCtx.textAlign = 'center';
  uploadArtworkCtx.textBaseline = 'middle';
  uploadArtworkCtx.fillText('No artwork', uploadArtworkCanvas.width / 2, uploadArtworkCanvas.height / 2);
}

function loadUploadCropFromBlob(blob) {
  if (!blob || !uploadArtworkCanvas) return;
  if (uploadCropUrl) URL.revokeObjectURL(uploadCropUrl);
  uploadCropUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    uploadCropImage = img;
    uploadCropReady = true;
    drawUploadCrop();
  };
  img.src = uploadCropUrl;
}

function drawUploadCrop() {
  if (!uploadArtworkCtx || !uploadArtworkCanvas) return;
  if (!uploadCropImage) {
    setUploadCanvasEmpty();
    return;
  }
  const zoom = Number(uploadZoom?.value || 1);
  const panX = Number(uploadPanX?.value || 0);
  const panY = Number(uploadPanY?.value || 0);
  const cw = uploadArtworkCanvas.width;
  const ch = uploadArtworkCanvas.height;
  const iw = uploadCropImage.width;
  const ih = uploadCropImage.height;
  const baseScale = Math.max(cw / iw, ch / ih);
  const scale = baseScale * zoom;
  const drawW = iw * scale;
  const drawH = ih * scale;
  const offsetX = (cw - drawW) / 2 + panX * cw;
  const offsetY = (ch - drawH) / 2 + panY * ch;
  uploadArtworkCtx.clearRect(0, 0, cw, ch);
  uploadArtworkCtx.fillStyle = '#111824';
  uploadArtworkCtx.fillRect(0, 0, cw, ch);
  uploadArtworkCtx.drawImage(uploadCropImage, offsetX, offsetY, drawW, drawH);
}

async function getUploadCroppedBlob() {
  if (!uploadCropReady || !uploadCropImage) return null;
  const zoom = Number(uploadZoom?.value || 1);
  const panX = Number(uploadPanX?.value || 0);
  const panY = Number(uploadPanY?.value || 0);
  return renderCroppedBlob(uploadCropImage, zoom, panX, panY);
}


const uploadArtInput = form?.querySelector("input[name='art']");


if (uploadZoom || uploadPanX || uploadPanY) {
  [uploadZoom, uploadPanX, uploadPanY].forEach((input) => input?.addEventListener('input', drawUploadCrop));
}

setUploadCanvasEmpty();


let nukeTimer = null;
let nukeTimeLeft = 0;

function showNukeModal() {
  if (!nukeModal) return;
  nukeModal.hidden = false;
  nukeModal.setAttribute('aria-hidden', 'false');
  if (nukeCountdown) nukeCountdown.hidden = true;
}

function hideNukeModal() {
  if (!nukeModal) return;
  nukeModal.hidden = true;
  nukeModal.setAttribute('aria-hidden', 'true');
}

async function nukeAllTracks() {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function startNukeCountdown() {
  nukeTimeLeft = 4;
  if (nukeCountdown) nukeCountdown.hidden = false;
  if (nukeNumber) nukeNumber.textContent = String(nukeTimeLeft);
  document.body.classList.add('nuke-shake', 'nuke-flash');
  nukeTimer = setInterval(async () => {
    nukeTimeLeft -= 1;
    if (nukeNumber) nukeNumber.textContent = String(Math.max(nukeTimeLeft, 1));
    if (nukeTimeLeft <= 0) {
      clearInterval(nukeTimer);
      nukeTimer = null;
      try {
        await nukeAllTracks();
        setStatus('All tracks nuked. Refresh the main page.');
      } catch {
        setStatus('Nuke failed. Try again.');
      }
      document.body.classList.remove('nuke-shake', 'nuke-flash');
      hideNukeModal();
      refreshTrackSelect();
    }
  }, 1000);
}

function abortNuke() {
  if (nukeTimer) {
    clearInterval(nukeTimer);
    nukeTimer = null;
  }
  document.body.classList.remove('nuke-shake', 'nuke-flash');
  hideNukeModal();
}

if (nukeBtn) nukeBtn.addEventListener('click', showNukeModal);
if (nukeCancel) nukeCancel.addEventListener('click', hideNukeModal);
if (nukeConfirm) nukeConfirm.addEventListener('click', startNukeCountdown);
if (nukeAbort) nukeAbort.addEventListener('click', abortNuke);

document.addEventListener('DOMContentLoaded', () => {
  try {
    hideNukeModal();
    if (nukeCountdown) nukeCountdown.hidden = true;
  } catch {}
});

form.addEventListener('reset', () => {
  if (uploadArtworkCrop) uploadArtworkCrop.hidden = true;
  uploadCropBlob = null;
  uploadCropImage = null;
  uploadCropReady = false;
  if (typeof setUploadCanvasEmpty === 'function') setUploadCanvasEmpty();
});

if (uploadArtworkCrop) uploadArtworkCrop.hidden = true;
if (typeof setUploadCanvasEmpty === 'function') setUploadCanvasEmpty();

if (uploadArtInput) {
  uploadArtInput.addEventListener('change', () => {
    const file = uploadArtInput.files[0];
    if (!file) return;
    uploadCropReady = false;
    if (uploadArtworkCrop) uploadArtworkCrop.hidden = false;
    loadUploadCropFromBlob(file);
  });
}
