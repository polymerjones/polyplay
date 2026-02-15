const grid = document.querySelector("#grid");
const nowTitle = document.querySelector(".np-title");
const nowSub = document.querySelector(".np-sub");
const auraBtn = document.querySelector(".aura-btn");
const playBtn = document.querySelector(".ctrl.play");
const prevButtons = document.querySelectorAll("[data-track='prev']");
const nextButtons = document.querySelectorAll("[data-track='next']");
const loopBtn = document.querySelector(".loop-btn");
const skipButtons = document.querySelectorAll(".ctrl.skip");
const player = document.querySelector("#player");
const npArt = document.querySelector("#npArt");
const waveCanvas = document.querySelector("#waveCanvas");
const waveCtx = waveCanvas.getContext("2d");
const waveCanvasDecor = document.querySelector("#waveCanvasDecor");
const waveDecorCtx = waveCanvasDecor ? waveCanvasDecor.getContext("2d") : null;
const nowPlaying = document.querySelector(".now-playing");
nowPlaying.classList.add('empty');
const waveHeader = document.querySelector('.wave-header');
const loopOverlay = document.querySelector('.loop-overlay');
const loopRange = document.querySelector('.loop-range');
const loopStartHandle = document.querySelector('.loop-handle.start');
const loopEndHandle = document.querySelector('.loop-handle.end');
const clearLoopBtn = document.querySelector('.clear-loop');

let currentTrackId = null;
let isPlaying = false;
let isLooping = false;
let rafId = null;
let audioCtx = null;
const trackCache = new Map();
let loopRegion = { start: 0, end: 0, active: false, editing: false };
let loopDrag = null;
let pressTimer = null;
const LONG_PRESS_MS = 450;

const DEFAULT_ART = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23263140'/%3E%3Cstop offset='100%25' stop-color='%23101822'/%3E%3C/linearGradient%3E%3CradialGradient id='shine' cx='30%25' cy='20%25' r='60%25'%3E%3Cstop offset='0%25' stop-color='rgba(255,255,255,0.6)'/%3E%3Cstop offset='50%25' stop-color='rgba(255,255,255,0.15)'/%3E%3Cstop offset='100%25' stop-color='rgba(255,255,255,0)'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='400' height='400' rx='36' fill='url(%23g)'/%3E%3Crect width='400' height='400' rx='36' fill='url(%23shine)'/%3E%3Cpath d='M240 110v140c0 22-20 40-44 40-25 0-46-19-46-42s21-42 46-42c8 0 15 2 22 5V126l102-26z' fill='%23e9f0f7' fill-opacity='0.9'/%3E%3Cpath d='M240 126l102-26v38l-102 26z' fill='%23b8c9dc' fill-opacity='0.9'/%3E%3C/svg%3E";

const sampleTracks = [
  { id: "sample-1", title: "Neon Drive", sub: "Mix v12", aura: 28, artGrad: "linear-gradient(135deg, #09121f, #2b5c7a)" },
  { id: "sample-2", title: "Midnight Loop", sub: "Mix v7", aura: 12, artGrad: "linear-gradient(135deg, #1b2a4a, #4d2d6c)" },
  { id: "sample-3", title: "Glass Signal", sub: "Mix v3", aura: 3, artGrad: "linear-gradient(135deg, #19202b, #3c3f47)" },
  { id: "sample-4", title: "City Pulse", sub: "Mix v5", aura: 9, artGrad: "linear-gradient(135deg, #121a2d, #3b6f8b)" },
  { id: "sample-5", title: "Nightglass", sub: "Mix v1", aura: 2, artGrad: "linear-gradient(135deg, #0e1118, #2b2f3a)" },
  { id: "sample-6", title: "Ruby Lane", sub: "Mix v9", aura: 21, artGrad: "linear-gradient(135deg, #2a0f1b, #8b2c3c)" },
];

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

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

async function getTracks() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", "readonly");
      const store = tx.objectStore("tracks");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function saveAura(id, aura) {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("tracks", "readwrite");
    const store = tx.objectStore("tracks");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return resolve();
      item.aura = aura;
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

function setAuraClass(tile, count) {
  tile.classList.remove("aura-low", "aura-med", "aura-hot");
  if (count >= 4) tile.classList.add("aura-hot");
  else if (count >= 2) tile.classList.add("aura-med");
  else tile.classList.add("aura-low");
}


function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function updateLoopOverlay() {
  if (!loopOverlay || !loopRange || !loopStartHandle || !loopEndHandle || !player.duration) return;
  const startPct = clamp(loopRegion.start / player.duration, 0, 1);
  const endPct = clamp(loopRegion.end / player.duration, 0, 1);
  loopRange.style.left = `${startPct * 100}%`;
  loopRange.style.width = `${Math.max(0, endPct - startPct) * 100}%`;
  loopStartHandle.style.left = `${startPct * 100}%`;
  loopEndHandle.style.left = `${endPct * 100}%`;
  nowPlaying.classList.toggle('loop-editing', loopRegion.editing);
  nowPlaying.classList.toggle('loop-active', loopRegion.active);
  loopBtn.classList.toggle('active', loopRegion.active);
}

function setLoopRegion(start, end, active = true, editing = true) {
  if (!player.duration) return;
  const safeStart = clamp(start, 0, player.duration);
  const safeEnd = clamp(end, safeStart + 0.1, player.duration);
  loopRegion = { start: safeStart, end: safeEnd, active, editing };
  player.loop = false;
  updateLoopOverlay();
}

function clearLoop() {
  loopRegion = { start: 0, end: 0, active: false, editing: false };
  isLooping = false;
  player.loop = false;
  updateLoopOverlay();
}

function loopFromEvent(event) {
  const rect = waveHeader.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  return ratio * player.duration;
}

function setAuraHeat(tile, count) {
  const heat = Math.min(1, count / 5);
  const hue = 275 + 35 * heat; // 275=purple -> 310=bright pink
  const boost = Math.min(180, count * 36);
  const level = Math.min(1, count / 5);
  tile.style.setProperty("--glow-hue", hue.toFixed(1));
  tile.style.setProperty("--glow-boost", `${boost}px`);
  tile.style.setProperty("--aura-level", level.toFixed(2));
}

function updateAura(tile, delta) {
  const next = Number(tile.dataset.aura || "0") + delta;
  const count = Math.max(0, Math.min(5, next));
  tile.dataset.aura = String(count);
  const meter = tile.querySelector(".aura-meter");
  if (meter) meter.textContent = `Aura ${count}/5`;
  setAuraClass(tile, count);
  setAuraHeat(tile, count);
  const trackId = tile.dataset.trackId;
  if (trackId && !trackId.startsWith("sample-")) saveAura(Number(trackId), count);
}

function getTiles() {
  return [...grid.querySelectorAll(".tile")];
}

function moveTrack(direction) {
  const tiles = getTiles();
  if (!tiles.length) return;
  const currentIndex = tiles.findIndex((tile) => tile.dataset.trackId === String(currentTrackId));
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (safeIndex + direction + tiles.length) % tiles.length;
  const nextTile = tiles[nextIndex];
  if (!nextTile) return;
  setNowPlaying(nextTile);
  if (!isPlaying) togglePlay();
}

function sparkleAndHaptic(button) {
  if (button) {
    button.classList.remove("sparkle");
    // Force reflow to restart animation
    void button.offsetWidth;
    button.classList.add("sparkle");
  }
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}

function updateTimecode() {
  const current = formatTime(player.currentTime || 0);
  const total = formatTime(player.duration || 0);
  nowSub.textContent = `${current} / ${total}`;
}

function setNowPlaying(tile) {
  const nextTrackId = tile.dataset.trackId || null;
  const isSameTrack = nextTrackId && nextTrackId === currentTrackId;
  const title = tile.querySelector(".title")?.textContent || "Unknown";
  const sub = tile.querySelector(".sub")?.textContent || "";
  nowTitle.textContent = title;
  nowSub.textContent = `0:00 / 0:00`;
  currentTrackId = nextTrackId;
  nowPlaying.classList.remove('empty');

  grid.querySelectorAll(".tile.is-playing").forEach((node) => node.classList.remove("is-playing"));
  if (isPlaying) {
    tile.classList.add("is-playing");
  }

  const track = trackCache.get(currentTrackId);
  if (track && track.audioUrl) {
    if (!isSameTrack) {
      player.src = track.audioUrl;
    }
    if (isPlaying) player.play().catch(() => {});
  }

  if (track && track.artUrl) {
    npArt.style.backgroundImage = `url('${track.artUrl}')`;
  } else if (track && track.artGrad) {
    npArt.style.backgroundImage = track.artGrad;
  } else {
    npArt.style.backgroundImage = "url('logo.png')";
  }

  drawWaveform();
  if (track) ensureWaveform(track);
}

function spawnRipple(tile, x, y) {
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  tile.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

function getRelativePoint(el, event) {
  const rect = el.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function buildTile(track) {
  const button = document.createElement("button");
  button.className = "tile";
  button.dataset.aura = String(track.aura || 0);
  button.dataset.trackId = String(track.id);

  const art = document.createElement("div");
  art.className = "art";
  if (track.artUrl) {
    const img = document.createElement("img");
    img.src = track.artUrl;
    img.alt = track.title || "Artwork";
    art.appendChild(img);
  } else if (track.artGrad) {
    art.style.backgroundImage = track.artGrad;
    art.classList.add("art-grad");
  } else {
    const img = document.createElement("img");
    img.src = DEFAULT_ART;
    img.alt = track.title || "Artwork";
    art.appendChild(img);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `
    <div class="title">${track.title}</div>
    <div class="aura-meter">Aura ${track.aura || 0}</div>
  `;

  const auraBtn = document.createElement("button");
  auraBtn.className = "aura-like";
  auraBtn.type = "button";
  auraBtn.setAttribute("aria-label", "Give aura");
  auraBtn.innerHTML = "<span class=\"aura-icon\" aria-hidden=\"true\"></span>";

  button.appendChild(art);
  button.appendChild(meta);
  button.appendChild(auraBtn);

  setAuraClass(button, track.aura || 0);
  setAuraHeat(button, track.aura || 0);

  auraBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    updateAura(button, 1);
    auraBtn.classList.remove("aura-bounce");
    void auraBtn.offsetWidth;
    auraBtn.classList.add("aura-bounce");
    const sparkle = document.createElement("span");
    sparkle.className = "aura-sparkle";
    auraBtn.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
    if (navigator.vibrate) navigator.vibrate(12);
  });

  button.addEventListener("click", (event) => {
    if (event.target.closest(".aura-like")) return;
    const { x, y } = getRelativePoint(button, event);
    spawnRipple(button, x, y);
    setNowPlaying(button);
    if (!isPlaying) togglePlay();
  });

  button.addEventListener("touchstart", (event) => {
    if (event.target.closest(".aura-like")) return;
    const { x, y } = getRelativePoint(button, event);
    spawnRipple(button, x, y);
    setNowPlaying(button);
    if (!isPlaying) togglePlay();
  });

  return button;
}

async function loadTracks() {
  const tracks = await getTracks();
  const data = tracks.length
    ? tracks.map((t) => ({
        id: t.id,
        title: t.title,
        sub: t.sub || "",
        aura: t.aura || 0,
        audioBlob: t.audio,
        artBlob: t.art,
      }))
    : sampleTracks;

  grid.innerHTML = "";
  data.forEach((track) => {
    if (track.audioBlob) {
      track.audioUrl = URL.createObjectURL(track.audioBlob);
    }
    if (track.artBlob) {
      track.artUrl = URL.createObjectURL(track.artBlob);
    }
    trackCache.set(String(track.id), track);
    grid.appendChild(buildTile(track));
  });
}

function togglePlay() {
  isPlaying = !isPlaying;
  playBtn.classList.toggle("playing", isPlaying);
  playBtn.classList.toggle("paused", !isPlaying);
  if (isPlaying) player.play().catch(() => {});
  else player.pause();

  const tiles = grid.querySelectorAll(".tile");
  tiles.forEach((tile) => {
    if (tile.dataset.trackId === String(currentTrackId)) {
      tile.classList.toggle("is-playing", isPlaying);
    } else {
      tile.classList.remove("is-playing");
    }
  });
}

playBtn.addEventListener("click", () => {
  togglePlay();
});

prevButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    sparkleAndHaptic(btn);
    moveTrack(-1);
  });
});

nextButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    sparkleAndHaptic(btn);
    moveTrack(1);
  });
});

skipButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!player.duration) return;
    const delta = Number(btn.dataset.skip || "0");
    const nextTime = Math.max(0, Math.min(player.duration, player.currentTime + delta));
    player.currentTime = nextTime;
    drawWaveform();
  });
});

auraBtn.addEventListener("click", () => {
  if (!currentTrackId) return;
  const tile = [...grid.querySelectorAll(".tile")].find(
    (node) => node.dataset.trackId === String(currentTrackId)
  );
  if (tile) updateAura(tile, 1);
});

loopBtn.addEventListener("click", () => {
  if (loopRegion.end > loopRegion.start) {
    loopRegion.active = !loopRegion.active;
    loopRegion.editing = false;
    loopBtn.classList.toggle('active', loopRegion.active);
    return;
  }
  isLooping = !isLooping;
  player.loop = isLooping;
  loopBtn.classList.toggle("active", isLooping);
});

function getGradientColorsFromImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 40;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      let r1 = 0, g1 = 0, b1 = 0;
      let r2 = 0, g2 = 0, b2 = 0;
      const count = data.length / 4;
      for (let i = 0; i < count; i += 1) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        if (i % 2 === 0) {
          r1 += r; g1 += g; b1 += b;
        } else {
          r2 += r; g2 += g; b2 += b;
        }
      }
      r1 = Math.round(r1 / (count / 2));
      g1 = Math.round(g1 / (count / 2));
      b1 = Math.round(b1 / (count / 2));
      r2 = Math.round(r2 / (count / 2));
      g2 = Math.round(g2 / (count / 2));
      b2 = Math.round(b2 / (count / 2));

      resolve([`rgb(${r1}, ${g1}, ${b1})`, `rgb(${r2}, ${g2}, ${b2})`]);
    };
    img.onerror = () => resolve(["rgba(123, 224, 255, 0.9)", "rgba(255, 128, 200, 0.8)"]);
    img.src = url;
  });
}

async function ensureWaveform(track) {
  if (!track.audioBlob || track.peaks) return;
  waveCanvas.classList.remove("wave-ready");
  waveCanvas.classList.add("wave-loading");
  const ctx = ensureAudioContext();
  const arrayBuffer = await track.audioBlob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const channel = audioBuffer.getChannelData(0);
  const samples = 600;
  const blockSize = Math.floor(channel.length / samples);
  const peaks = new Array(samples).fill(0);

  for (let i = 0; i < samples; i += 1) {
    let sum = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channel.length);
    for (let j = start; j < end; j += 1) {
      sum = Math.max(sum, Math.abs(channel[j]));
    }
    peaks[i] = sum;
  }

  track.peaks = peaks;

  if (track.artUrl && !track.waveGradient) {
    track.waveGradient = await getGradientColorsFromImage(track.artUrl);
  }

  drawWaveform();
}

function drawWaveform() {
  const drawTo = (canvas, ctx) => {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      canvas.width = Math.floor(rect.width * window.devicePixelRatio);
      canvas.height = Math.floor(rect.height * window.devicePixelRatio);
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    }
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, width, height);

    const track = trackCache.get(currentTrackId);
    const peaks = track?.peaks;
    const progress = player.duration ? player.currentTime / player.duration : 0;
    const t = Date.now() / 1000;
    const pulse = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3.2));

    if (!peaks) {
      canvas.classList.remove("wave-ready");
      canvas.classList.add("wave-loading");
      return;
    }
    canvas.classList.remove("wave-loading");
    canvas.classList.add("wave-ready");

    const bars = peaks ? peaks.length : 60;
    const gap = 2;
    const barWidth = (width - gap * (bars - 1)) / bars;

    const gradColors = track?.waveGradient || ["rgba(92, 36, 150, 0.98)", "rgba(210, 140, 255, 1)"];
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, gradColors[0]);
    gradient.addColorStop(1, gradColors[1].replace("1", (0.8 + pulse).toFixed(2)));

    const loopActive = loopRegion.active && loopRegion.end > loopRegion.start && player.duration;
    const loopStartRatio = loopActive ? loopRegion.start / player.duration : 0;
    const loopEndRatio = loopActive ? loopRegion.end / player.duration : 0;

    for (let i = 0; i < bars; i += 1) {
      const magnitude = peaks ? peaks[i] : 0.3 + ((i * 37) % 100) / 100;
      const barHeight = Math.max(4, magnitude * height * 0.98);
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;
      const ratio = i / bars;

      if (loopActive && ratio >= loopStartRatio && ratio <= loopEndRatio) {
        ctx.fillStyle = "rgba(255, 214, 92, 0.9)";
      } else {
        ctx.fillStyle = ratio <= progress ? gradient : "rgba(120, 70, 180, 0.6)";
      }
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  };

  drawTo(waveCanvas, waveCtx);
  drawTo(waveCanvasDecor, waveDecorCtx);
}


function tick() {
  drawWaveform();
  rafId = requestAnimationFrame(tick);
}

window.addEventListener("resize", () => {
  drawWaveform();
});

waveCanvas.addEventListener("click", (event) => {
  if (!player.duration) return;
  const rect = waveHeader.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const ratio = Math.min(1, Math.max(0, x / rect.width));
  player.currentTime = player.duration * ratio;
  drawWaveform();
});

if (waveHeader) {
  const startPress = (event) => {
    if (!player.duration) return;
    if (event.target.closest('.controls') || event.target.closest('.aux')) return;
    pressTimer = setTimeout(() => {
      const start = loopFromEvent(event);
      const end = clamp(start + 5, 0, player.duration);
      setLoopRegion(start, end, true, true);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };
  waveHeader.addEventListener('touchstart', startPress, { passive: true });
  waveHeader.addEventListener('touchend', cancelPress);
  waveHeader.addEventListener('mousedown', () => {
    // allow normal scroll on desktop unless editing
  });
  waveHeader.addEventListener('dblclick', (event) => {
    if (!player.duration) return;
    const start = loopFromEvent(event);
    const end = clamp(start + 5, 0, player.duration);
    setLoopRegion(start, end, true, true);
  });
  waveHeader.addEventListener('click', (event) => {
    if (event.target.closest('.loop-handle')) return;
    if (loopRegion.editing) {
      loopRegion.editing = false;
      updateLoopOverlay();
    }
  });
}

const handleDrag = (event) => {
  if (!loopDrag || !player.duration) return;
  if (event.cancelable) event.preventDefault();
  const t = loopFromEvent(event);
  if (loopDrag === 'start') {
    loopRegion.start = clamp(t, 0, loopRegion.end - 0.1);
  } else {
    loopRegion.end = clamp(t, loopRegion.start + 0.1, player.duration);
  }
  updateLoopOverlay();
};

const stopDrag = () => {
  loopDrag = null;
};

if (loopStartHandle && loopEndHandle) {
  loopStartHandle.addEventListener('mousedown', () => (loopDrag = 'start'));
  loopEndHandle.addEventListener('mousedown', () => (loopDrag = 'end'));
  loopStartHandle.addEventListener('touchstart', () => (loopDrag = 'start'), { passive: true });
  loopEndHandle.addEventListener('touchstart', () => (loopDrag = 'end'), { passive: true });
  window.addEventListener('mousemove', handleDrag);
  window.addEventListener('touchmove', handleDrag, { passive: false });
  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('touchend', stopDrag);
}

function scrubFromEvent(event) {
  if (!player.duration) return;
  if (loopRegion.editing) return;
  const target = event.target;
  if (target.closest(".controls") || target.closest(".aux") || target.closest(".ctrl") || target.closest(".ghost") || target.closest('.loop-handle')) {
    return;
  }
  const rect = nowPlaying.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const x = clientX - rect.left;
  const ratio = Math.min(1, Math.max(0, x / rect.width));
  player.currentTime = player.duration * ratio;
  drawWaveform();
}

nowPlaying.addEventListener("click", scrubFromEvent);
nowPlaying.addEventListener("touchstart", scrubFromEvent);

player.addEventListener("play", () => {
  cancelAnimationFrame(rafId);
  tick();
});

player.addEventListener("pause", () => {
  cancelAnimationFrame(rafId);
  drawWaveform();
  updateTimecode();
});

player.addEventListener("loadedmetadata", () => {
  drawWaveform();
  updateTimecode();
});

if (clearLoopBtn) {
  clearLoopBtn.addEventListener('click', () => {
    clearLoop();
  });
}

npArt.addEventListener('click', () => {
  if (!player.duration) return;
  if (!loopRegion.active && loopRegion.end <= loopRegion.start) {
    const start = player.currentTime;
    const end = clamp(start + 5, 0, player.duration);
    setLoopRegion(start, end, true, true);
    return;
  }
  if (loopRegion.active && loopRegion.editing) {
    loopRegion.end = clamp(player.currentTime, loopRegion.start + 0.1, player.duration);
    loopRegion.editing = false;
    updateLoopOverlay();
    return;
  }
  loopRegion.editing = !loopRegion.editing;
  updateLoopOverlay();
});

npArt.style.backgroundImage = "url('logo.png')";

loadTracks();

player.addEventListener("timeupdate", () => {
  updateTimecode();
  if (loopRegion.active && loopRegion.end > loopRegion.start) {
    if (player.currentTime >= loopRegion.end || player.currentTime < loopRegion.start) {
      player.currentTime = loopRegion.start;
    }
  }
});
