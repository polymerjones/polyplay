import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { getGratitudeBackupFilename, serializeGratitudeJson } from "../lib/backup";
import {
  DEFAULT_GRATITUDE_SETTINGS,
  createEntry,
  deleteEntry,
  listEntries,
  replaceGratitudeEntries,
  saveGratitudeSettings,
  type GratitudeEntry,
  type GratitudeSettings,
  updateEntry
} from "../lib/gratitude";
import { fireHeavyHaptic, fireLightHaptic, fireSuccessHaptic } from "../lib/haptics";
import { normalizeSaveFilename, promptForSaveFilename, saveTextWithBestEffort, shouldUseInlineSaveNameStep } from "../lib/saveBlob";

type Props = {
  open: boolean;
  onClose: () => void;
};

type JournalBackground = {
  id: "1" | "2";
  src: string;
};
type Sparkle = {
  id: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
};

const JOURNAL_BG_TOGGLE_KEY = "polyplay_journalBgToggle_v1";
const JOURNAL_VERSE_INDEX_KEY = "polyplay_journalVerseIndex_v1";
const JOURNAL_LOOP_START_SEC = 0.08;
const JOURNAL_LOOP_END_GUARD_SEC = 0.06;
const JOURNAL_EDGE_CLOSE_PX = 56;
const JOURNAL_SWIPE_CLOSE_DISTANCE_PX = 128;
const JOURNAL_SWIPE_CLOSE_MAX_SIDEWAYS_PX = 72;
const JOURNAL_SWIPE_CLOSE_MIN_VELOCITY = 0.42;
const JOURNAL_SWIPE_START_BAND_PX = 180;
const JOURNAL_VERSE_SWIPE_DISTANCE_PX = 44;
const JOURNAL_VERSE_SWIPE_MAX_VERTICAL_PX = 52;
const JOURNAL_VERSE_SWIPE_MIN_VELOCITY = 0.3;

const JOURNAL_BACKGROUNDS: JournalBackground[] = [
  { id: "1", src: "/clouds1.mov" },
  { id: "2", src: "/demo/clouds2replaced.mp4" }
];

const DEFAULT_JOURNAL_VERSES = [
  "Be still, and know that I am God. — Psalm 46:10",
  "I can do all things through Christ who strengthens me. — Philippians 4:13",
  "The Lord is my shepherd; I shall not want. — Psalm 23:1",
  "Let all that you do be done in love. — 1 Corinthians 16:14",
  "Rejoice in hope, be patient in tribulation, be constant in prayer. — Romans 12:12",
  "\"Submit to God, and you will have peace; then things will go well for you.\" — Job 22:21 (NLT)",
  "\"Humble yourselves, therefore, under God’s mighty hand, that he may lift you up in due time.\" — 1 Peter 5:6 (NIV)"
];

type GratitudeBackupImportPayload = {
  settings: GratitudeSettings;
  entries: GratitudeEntry[];
};

function pickAlternatingBackground(): JournalBackground {
  let nextId: "1" | "2" = "1";
  try {
    const last = localStorage.getItem(JOURNAL_BG_TOGGLE_KEY);
    nextId = last === "1" ? "2" : "1";
    localStorage.setItem(JOURNAL_BG_TOGGLE_KEY, nextId);
  } catch {
    nextId = "1";
  }
  return JOURNAL_BACKGROUNDS.find((bg) => bg.id === nextId) || JOURNAL_BACKGROUNDS[0];
}

function formatDateLabel(entry: GratitudeEntry): string {
  const base = entry.updatedAt || entry.createdAt;
  const date = new Date(base);
  if (!Number.isFinite(date.getTime())) return base;
  return date.toLocaleString();
}

function shouldUseLightJournalFx(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  const isCoarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = typeof navigator !== "undefined" && "connection" in navigator
    ? Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
    : false;
  return isCoarse || reduced || saveData;
}

function isCompactJournalEditingViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(max-width: 520px)").matches;
}

function isKeyboardEditableElement(node: Element | null): node is HTMLElement {
  return Boolean(
    node &&
      (node instanceof HTMLInputElement ||
        node instanceof HTMLTextAreaElement ||
        node instanceof HTMLSelectElement ||
        (node instanceof HTMLElement && node.isContentEditable))
  );
}

function isNearJournalDismissEdge(event: MouseEvent<HTMLElement>): boolean {
  if (typeof window === "undefined") return false;
  const { clientX, clientY } = event;
  return (
    clientX <= JOURNAL_EDGE_CLOSE_PX ||
    clientY <= JOURNAL_EDGE_CLOSE_PX ||
    clientX >= window.innerWidth - JOURNAL_EDGE_CLOSE_PX ||
    clientY >= window.innerHeight - JOURNAL_EDGE_CLOSE_PX
  );
}

function createSparkles(count: number): Sparkle[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `sparkle-${index}-${Math.random().toString(36).slice(2, 7)}`,
    left: Math.round(Math.random() * 100),
    top: Math.round(Math.random() * 100),
    size: Number((1.8 + Math.random() * 3.2).toFixed(2)),
    delay: Number((Math.random() * 8).toFixed(2)),
    duration: Number((8 + Math.random() * 8).toFixed(2)),
    drift: Number((8 + Math.random() * 20).toFixed(2))
  }));
}

function normalizeImportedGratitudeSettings(value: unknown): GratitudeSettings {
  if (!value || typeof value !== "object") return DEFAULT_GRATITUDE_SETTINGS;
  const row = value as Partial<GratitudeSettings>;
  const frequency =
    row.frequency === "daily" || row.frequency === "weekly" || row.frequency === "launch" || row.frequency === "off"
      ? row.frequency
      : DEFAULT_GRATITUDE_SETTINGS.frequency;
  return {
    enabled: row.enabled !== false,
    frequency,
    doNotSaveText: Boolean(row.doNotSaveText),
    doNotPromptAgain: Boolean(row.doNotPromptAgain)
  };
}

function normalizeImportedGratitudeEntries(value: unknown): GratitudeEntry[] {
  if (!Array.isArray(value)) return [];
  const normalized: GratitudeEntry[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const row = value[index];
    if (!row || typeof row !== "object") continue;
    const entry = row as Partial<GratitudeEntry>;
    if (typeof entry.text !== "string") continue;
    const trimmed = entry.text.trim();
    if (!trimmed) continue;
    const createdAt = typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : new Date().toISOString();
    const id = typeof entry.id === "string" && entry.id ? entry.id : `imported-${createdAt}-${index}`;
    normalized.push({
      id,
      text: trimmed,
      verse: typeof entry.verse === "string" && entry.verse.trim() ? entry.verse.trim() : undefined,
      createdAt,
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : undefined,
      privateMode: Boolean(entry.privateMode)
    });
  }
  return normalized;
}

function parseGratitudeBackupImportText(content: string): GratitudeBackupImportPayload {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) {
    return {
      settings: DEFAULT_GRATITUDE_SETTINGS,
      entries: normalizeImportedGratitudeEntries(parsed)
    };
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup file.");
  }
  const payload = parsed as {
    kind?: unknown;
    settings?: unknown;
    entries?: unknown;
  };
  if (typeof payload.kind === "string" && payload.kind !== "polyplay-gratitude") {
    throw new Error("Unsupported backup file type.");
  }
  return {
    settings: normalizeImportedGratitudeSettings(payload.settings),
    entries: normalizeImportedGratitudeEntries(payload.entries)
  };
}

export function JournalModal({ open, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const entryListRef = useRef<HTMLDivElement | null>(null);
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [selectedBgId, setSelectedBgId] = useState<"1" | "2">(JOURNAL_BACKGROUNDS[0]?.id || "1");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [verses, setVerses] = useState<string[]>(DEFAULT_JOURNAL_VERSES);
  const [verseIndex, setVerseIndex] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(JOURNAL_VERSE_INDEX_KEY);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed % DEFAULT_JOURNAL_VERSES.length;
    } catch {
      // Ignore localStorage failures.
    }
    return 0;
  });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newEntryText, setNewEntryText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [miniToast, setMiniToast] = useState<string | null>(null);
  const [journalStatus, setJournalStatus] = useState<{ message: string; tone: "info" | "success" | "error" } | null>(null);
  const [pendingExportContent, setPendingExportContent] = useState<string | null>(null);
  const [pendingExportFilename, setPendingExportFilename] = useState("");
  const [isKeyboardOverlayActive, setIsKeyboardOverlayActive] = useState(false);
  const [keyboardViewportHeight, setKeyboardViewportHeight] = useState<number | null>(null);
  const [verseFxActive, setVerseFxActive] = useState(false);
  const [verseFxBurstKey, setVerseFxBurstKey] = useState(0);
  const [pendingImportPayload, setPendingImportPayload] = useState<GratitudeBackupImportPayload | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const activeEditEntryRef = useRef<HTMLElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeEditActionsRef = useRef<HTMLDivElement | null>(null);
  const isResolvingEditRef = useRef(false);
  const deleteTimerRef = useRef<number | null>(null);
  const verseFxTimerRef = useRef<number | null>(null);
  const verseFxRafRef = useRef<number | null>(null);
  const suspendBackgroundPlaybackRef = useRef(false);
  const swipeDismissStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const verseSwipeStartRef = useRef<{ x: number; y: number; at: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    suspendBackgroundPlaybackRef.current = false;
    setEntries(listEntries());
    setEditingEntryId(null);
    setExpandedEntryId(null);
    setIsComposerOpen(false);
    setNewEntryText("");
    setDraftText("");
    setPendingImportPayload(null);
    setPendingExportContent(null);
    setPendingExportFilename("");
    setIsKeyboardOverlayActive(false);
    setKeyboardViewportHeight(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    const recomputeKeyboardState = () => {
      const compact = isCompactJournalEditingViewport();
      const focusedEditable = isKeyboardEditableElement(document.activeElement);
      const visibleHeight = viewport?.height ?? window.innerHeight;
      const keyboardLikelyOpen = compact && focusedEditable && visibleHeight < window.innerHeight - 120;
      setIsKeyboardOverlayActive(keyboardLikelyOpen);
      setKeyboardViewportHeight(keyboardLikelyOpen ? visibleHeight : null);
    };
    const onFocusChange = () => {
      window.setTimeout(recomputeKeyboardState, 0);
    };

    recomputeKeyboardState();
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusChange);
    viewport?.addEventListener("resize", recomputeKeyboardState);
    viewport?.addEventListener("scroll", recomputeKeyboardState);
    window.addEventListener("resize", recomputeKeyboardState);

    return () => {
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
      viewport?.removeEventListener("resize", recomputeKeyboardState);
      viewport?.removeEventListener("scroll", recomputeKeyboardState);
      window.removeEventListener("resize", recomputeKeyboardState);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selected = pickAlternatingBackground();
    setSelectedBgId(selected.id);
    setIsVideoReady(false);
    setVideoFailed(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const previous = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflowY = "hidden";
    return () => {
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      document.body.style.overflowY = previous.overflowY;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!isComposerOpen) return;
    composerRef.current?.focus();
  }, [isComposerOpen]);

  useEffect(() => {
    if (!editingEntryId) return;
    const scrollActiveEntryIntoComfortableView = () => {
      const list = entryListRef.current;
      const entry = activeEditEntryRef.current;
      const actions = activeEditActionsRef.current;
      if (!list || !entry) return;

      const listRect = list.getBoundingClientRect();
      const entryRect = entry.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect() ?? null;
      const isCompact = isCompactJournalEditingViewport();
      const topInset = isCompact ? 22 : 18;
      const bottomInset = isCompact ? 20 : 18;
      const entryTop = list.scrollTop + (entryRect.top - listRect.top);
      const entryBottom = list.scrollTop + ((actionsRect?.bottom ?? entryRect.bottom) - listRect.top);
      const visibleTop = list.scrollTop + topInset;
      const visibleBottom = list.scrollTop + list.clientHeight - bottomInset;
      let nextTop = list.scrollTop;

      if (entryTop < visibleTop) {
        nextTop = Math.max(0, entryTop - topInset);
      } else if (entryBottom > visibleBottom) {
        nextTop = Math.max(0, entryBottom - list.clientHeight + bottomInset);
      }

      if (isCompact) {
        list.scrollTop = nextTop;
      } else if (Math.abs(nextTop - list.scrollTop) > 1) {
        list.scrollTo({
          top: nextTop,
          behavior: "smooth"
        });
      }
    };

    const rafId = window.requestAnimationFrame(() => {
      scrollActiveEntryIntoComfortableView();
      editTextareaRef.current?.focus();
    });

    const settleTimer = window.setTimeout(() => {
      scrollActiveEntryIntoComfortableView();
    }, 320);

    const lateSettleTimer = window.setTimeout(() => {
      scrollActiveEntryIntoComfortableView();
    }, 650);

    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    const onViewportResize = () => scrollActiveEntryIntoComfortableView();
    viewport?.addEventListener("resize", onViewportResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      window.clearTimeout(lateSettleTimer);
      viewport?.removeEventListener("resize", onViewportResize);
    };
  }, [editingEntryId]);

  useEffect(() => {
    if (!editingEntryId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (isResolvingEditRef.current) return;
      const target = event.target as HTMLElement | null;
      const activeEntry = activeEditEntryRef.current;
      if (!target || !activeEntry) return;
      if (activeEntry.contains(target)) return;
      const clickedAnotherEntry = Boolean(target.closest(".journal-entry"));
      const didSave = saveEditedEntry(editingEntryId);
      if (clickedAnotherEntry || !didSave) {
        event.preventDefault();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editingEntryId, draftText, entries]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/content/journal-verses.json", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) return;
        const next = payload
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        if (!next.length || cancelled) return;
        setVerses(next);
      } catch {
        // Keep fallback verses.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVerseIndex((prev) => {
      const safeLength = Math.max(1, verses.length);
      return prev % safeLength;
    });
  }, [verses]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isComposerOpen) {
          event.preventDefault();
          setNewEntryText("");
          setIsComposerOpen(false);
          return;
        }
        if (editingEntryId) {
          event.preventDefault();
          discardEditedEntry();
          return;
        }
        if (pendingImportPayload) {
          event.preventDefault();
          setPendingImportPayload(null);
          return;
        }
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const focusables = card.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      const visible = Array.from(focusables).filter((node) => !node.hasAttribute("disabled"));
      if (!visible.length) return;
      const first = visible[0];
      const last = visible[visible.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, isComposerOpen, editingEntryId, pendingImportPayload]);

  useEffect(() => {
    if (!miniToast) return;
    const timer = window.setTimeout(() => setMiniToast(null), 1200);
    return () => window.clearTimeout(timer);
  }, [miniToast]);

  useEffect(() => {
    if (!journalStatus) return;
    const timeoutMs = journalStatus.tone === "info" ? 1800 : 3200;
    const timer = window.setTimeout(() => setJournalStatus(null), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [journalStatus]);

  const finishGratitudeBackupSave = async (content: string, filename: string) => {
    const saveMode = await saveTextWithBestEffort(
      content,
      filename,
      "application/json;charset=utf-8",
      {
        description: "Gratitude Backup",
        accept: { "application/json": [".json"] }
      }
    );
    setJournalStatus({
      message:
        saveMode === "shared"
          ? "Gratitude backup ready."
          : saveMode === "opened-preview"
            ? "Backup ready. Use iPhone save options to keep the file."
            : "Gratitude backup saved.",
      tone: "success"
    });
  };

  useEffect(() => {
    if (!open || !suspendBackgroundPlaybackRef.current) return;
    const onWindowFocus = () => {
      if (!suspendBackgroundPlaybackRef.current || pendingImportPayload) return;
      suspendBackgroundPlaybackRef.current = false;
      void backgroundVideoRef.current?.play().catch(() => undefined);
    };
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, [open, pendingImportPayload]);

  useEffect(() => {
    try {
      localStorage.setItem(JOURNAL_VERSE_INDEX_KEY, String(verseIndex));
    } catch {
      // Ignore storage failures.
    }
  }, [verseIndex]);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current !== null) {
        window.clearTimeout(deleteTimerRef.current);
      }
      if (verseFxTimerRef.current !== null) {
        window.clearTimeout(verseFxTimerRef.current);
      }
      if (verseFxRafRef.current !== null) {
        window.cancelAnimationFrame(verseFxRafRef.current);
      }
    };
  }, []);

  const triggerVerseFeedback = () => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;
    }
    if (verseFxRafRef.current !== null) {
      window.cancelAnimationFrame(verseFxRafRef.current);
    }
    setVerseFxActive(false);
    verseFxRafRef.current = window.requestAnimationFrame(() => {
      setVerseFxActive(true);
      setVerseFxBurstKey((prev) => prev + 1);
    });
    if (verseFxTimerRef.current !== null) {
      window.clearTimeout(verseFxTimerRef.current);
    }
    verseFxTimerRef.current = window.setTimeout(() => {
      setVerseFxActive(false);
      verseFxTimerRef.current = null;
    }, 520);
  };

  const cycleVerse = (delta: -1 | 1) => {
    setVerseIndex((prev) => {
      const safeLength = Math.max(1, verses.length);
      return (prev + delta + safeLength) % safeLength;
    });
    fireLightHaptic();
    triggerVerseFeedback();
  };

  const beginVerseSwipe = (touch: { clientX: number; clientY: number }, target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (element?.closest("button, input, textarea, select, a, label")) {
      verseSwipeStartRef.current = null;
      return;
    }
    verseSwipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: performance.now()
    };
  };

  const endVerseSwipe = (touch: { clientX: number; clientY: number }) => {
    const start = verseSwipeStartRef.current;
    verseSwipeStartRef.current = null;
    if (!start) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > JOURNAL_VERSE_SWIPE_MAX_VERTICAL_PX) return;
    const elapsedMs = Math.max(1, performance.now() - start.at);
    const velocityX = dx / elapsedMs;
    if (dx <= -JOURNAL_VERSE_SWIPE_DISTANCE_PX || velocityX <= -JOURNAL_VERSE_SWIPE_MIN_VELOCITY) {
      cycleVerse(1);
      return;
    }
    if (dx >= JOURNAL_VERSE_SWIPE_DISTANCE_PX || velocityX >= JOURNAL_VERSE_SWIPE_MIN_VELOCITY) {
      cycleVerse(-1);
    }
  };

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => entry.text.toLowerCase().includes(q));
  }, [entries, query]);

  const selectedBackground = useMemo(
    () => JOURNAL_BACKGROUNDS.find((bg) => bg.id === selectedBgId) || JOURNAL_BACKGROUNDS[0],
    [selectedBgId]
  );

  const isWritingActive = isComposerOpen || editingEntryId !== null;
  const lightFxMode = useMemo(() => shouldUseLightJournalFx(), []);
  const sparkles = useMemo(() => (lightFxMode ? [] : createSparkles(10)), [lightFxMode, selectedBgId]);
  const currentVerse = verses[verseIndex % Math.max(1, verses.length)] || DEFAULT_JOURNAL_VERSES[0];

  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!video || !open) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.load();
    const jumpToSafeStart = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) return;
      const safeStart = Math.min(JOURNAL_LOOP_START_SEC, Math.max(0, duration - 0.12));
      if (video.currentTime < safeStart) {
        video.currentTime = safeStart;
      }
    };
    const onTimeUpdate = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) return;
      if (video.currentTime >= duration - JOURNAL_LOOP_END_GUARD_SEC) {
        const safeStart = Math.min(JOURNAL_LOOP_START_SEC, Math.max(0, duration - 0.12));
        video.currentTime = safeStart;
      }
    };
    const onEnded = () => {
      jumpToSafeStart();
      void video.play().catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
        return;
      }
      if (suspendBackgroundPlaybackRef.current) return;
      void video.play().catch(() => undefined);
    };
    video.addEventListener("loadedmetadata", jumpToSafeStart);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setIsVideoReady(true);
    }
    if (!suspendBackgroundPlaybackRef.current) {
      void video.play().catch(() => undefined);
    }
    return () => {
      video.pause();
      video.removeEventListener("loadedmetadata", jumpToSafeStart);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [selectedBgId, open]);

  if (!open) return null;

  const canSaveNewEntry = newEntryText.trim().length > 0;

  const toggleExpandedEntry = (entryId: string) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  };

  const startEditingEntry = (entry: GratitudeEntry) => {
    fireLightHaptic();
    setEditingEntryId(entry.id);
    setExpandedEntryId(entry.id);
    setIsComposerOpen(false);
    setDraftText(entry.text);
  };

  const handleEntryTap = (entry: GratitudeEntry) => {
    if (editingEntryId && editingEntryId !== entry.id) return;
    if (expandedEntryId === entry.id) {
      if (!editingEntryId) startEditingEntry(entry);
      return;
    }
    toggleExpandedEntry(entry.id);
  };

  const releaseEditResolutionLock = () => {
    window.setTimeout(() => {
      isResolvingEditRef.current = false;
    }, 0);
  };

  const exitEditMode = () => {
    setEditingEntryId(null);
    setDraftText("");
  };

  const discardEditedEntry = () => {
    isResolvingEditRef.current = true;
    exitEditMode();
    releaseEditResolutionLock();
  };

  const saveEditedEntry = (entryId: string) => {
    if (isResolvingEditRef.current) return false;
    const trimmed = draftText.trim();
    if (!trimmed) {
      editTextareaRef.current?.focus();
      return false;
    }
    isResolvingEditRef.current = true;
    const previous = entries.find((entry) => entry.id === entryId);
    const didChange = !previous || previous.text.trim() !== trimmed;
    if (didChange) {
      updateEntry(entryId, trimmed);
      const next = listEntries();
      setEntries(next);
      setSavedEntryId(entryId);
      window.setTimeout(() => setSavedEntryId(null), 420);
      setMiniToast("Saved");
      fireSuccessHaptic();
    }
    exitEditMode();
    releaseEditResolutionLock();
    return true;
  };

  const resumeBackgroundPlayback = () => {
    suspendBackgroundPlaybackRef.current = false;
    void backgroundVideoRef.current?.play().catch(() => undefined);
  };

  const resetImportUiState = () => {
    setEditingEntryId(null);
    setExpandedEntryId(null);
    setIsComposerOpen(false);
    setNewEntryText("");
    setDraftText("");
    setSavedEntryId(null);
    setDeletingEntryId(null);
    setPendingImportPayload(null);
    setQuery("");
  };

  const applyImportedPayload = (payload: GratitudeBackupImportPayload) => {
    saveGratitudeSettings(payload.settings);
    const nextEntries = replaceGratitudeEntries(payload.entries);
    resetImportUiState();
    setEntries(nextEntries);
    resumeBackgroundPlayback();
  };

  const canStartSwipeDismiss = (target: EventTarget | null, clientY: number) => {
    const element = target as HTMLElement | null;
    const card = cardRef.current;
    if (!element || !card) return false;
    if (editingEntryId !== null || isComposerOpen || pendingImportPayload !== null) return false;
    if (element.closest("button, input, textarea, select, a, label")) return false;
    const cardTop = card.getBoundingClientRect().top;
    return clientY <= cardTop + JOURNAL_SWIPE_START_BAND_PX;
  };

  const beginSwipeDismiss = (touch: { clientX: number; clientY: number }, target: EventTarget | null) => {
    if (!canStartSwipeDismiss(target, touch.clientY)) {
      swipeDismissStartRef.current = null;
      return;
    }
    swipeDismissStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: performance.now()
    };
  };

  const endSwipeDismiss = (touch: { clientX: number; clientY: number }) => {
    const start = swipeDismissStartRef.current;
    swipeDismissStartRef.current = null;
    if (!start) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dy <= 0) return;
    if (Math.abs(dx) > JOURNAL_SWIPE_CLOSE_MAX_SIDEWAYS_PX) return;
    const elapsedMs = Math.max(1, performance.now() - start.at);
    const velocity = dy / elapsedMs;
    if (dy >= JOURNAL_SWIPE_CLOSE_DISTANCE_PX || velocity >= JOURNAL_SWIPE_CLOSE_MIN_VELOCITY) {
      fireLightHaptic();
      onClose();
    }
  };

  return (
    <section
      className="journal-modal journalScene"
      style={
        keyboardViewportHeight
          ? ({ "--journal-visible-vh": `${Math.round(keyboardViewportHeight)}px` } as CSSProperties)
          : undefined
      }
      role="dialog"
      aria-modal="true"
      aria-label="Gratitude Journal"
      onClick={(event) => {
        if (event.target === event.currentTarget && editingEntryId === null && isNearJournalDismissEdge(event)) onClose();
      }}
    >
      <video
        key={selectedBackground.id}
        ref={backgroundVideoRef}
        className={`journalVideoLayer ${isVideoReady && !videoFailed ? "is-ready" : ""}`.trim()}
        src={selectedBackground.src}
        preload="auto"
        autoPlay
        loop
        playsInline
        muted
        aria-hidden="true"
        onError={() => {
          setVideoFailed(true);
          setIsVideoReady(false);
        }}
        onLoadedData={() => {
          setVideoFailed(false);
          setIsVideoReady(true);
        }}
        onCanPlay={() => {
          setVideoFailed(false);
          setIsVideoReady(true);
        }}
      />
      <div className={`journalVideoFallback ${isVideoReady && !videoFailed ? "is-hidden" : ""}`.trim()} aria-hidden="true" />
      <div className="journalScrimLayer" aria-hidden="true" />
      <div className={`journalAmbientLayer ${lightFxMode ? "is-light-fx" : ""}`.trim()} aria-hidden="true" />
      {!lightFxMode && (
        <div className="journalStreaksLayer" aria-hidden="true">
          <span className="journalStreak journalStreak--one" />
          <span className="journalStreak journalStreak--two" />
        </div>
      )}
      {!lightFxMode && (
        <div className="journalSparklesLayer" aria-hidden="true">
          {sparkles.map((sparkle) => (
            <span
              key={sparkle.id}
              className="journalSparkle"
              style={
                {
                  "--left": `${sparkle.left}%`,
                  "--top": `${sparkle.top}%`,
                  "--size": `${sparkle.size}px`,
                  "--delay": `${sparkle.delay}s`,
                  "--duration": `${sparkle.duration}s`,
                  "--drift": `${sparkle.drift}px`
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="journalUI">
        <div
          className={`journal-modal__card journalGlassPanel ${isWritingActive ? "is-writing" : ""} ${
            isKeyboardOverlayActive ? "is-keyboard-active" : ""
          }`.trim()}
          ref={cardRef}
          onTouchStart={(event) => {
            if (event.touches.length !== 1) {
              swipeDismissStartRef.current = null;
              return;
            }
            beginSwipeDismiss(event.touches[0], event.target);
          }}
          onTouchEnd={(event) => {
            const touch = event.changedTouches[0];
            if (!touch) return;
            endSwipeDismiss(touch);
          }}
          onTouchCancel={() => {
            swipeDismissStartRef.current = null;
          }}
        >
          <div className="journalRim" aria-hidden="true" />
          <div className="journal-modal__head">
            <h3>Gratitude Journal</h3>
            <div className="journal-modal__head-actions">
              <button
                type="button"
                className="journal-modal__export"
                onClick={() => {
                  void (async () => {
                    setJournalStatus({ message: "Preparing gratitude backup…", tone: "info" });
                    try {
                      const content = serializeGratitudeJson();
                      const defaultFilename = getGratitudeBackupFilename();
                      if (shouldUseInlineSaveNameStep()) {
                        setPendingExportContent(content);
                        setPendingExportFilename(defaultFilename);
                        setJournalStatus({ message: "Backup ready. Name it, then tap Save backup.", tone: "info" });
                        return;
                      }
                      const filename = promptForSaveFilename(defaultFilename, {
                        message: "Name this backup before saving.",
                        requiredExtension: ".json"
                      });
                      if (!filename) {
                        setJournalStatus({ message: "Save gratitude backup canceled.", tone: "info" });
                        return;
                      }
                      await finishGratitudeBackupSave(content, filename);
                    } catch {
                      setJournalStatus({ message: "Gratitude backup failed.", tone: "error" });
                    }
                  })();
                }}
              >
                Save Backup
              </button>
              <button
                type="button"
                className="journal-modal__export"
                onClick={() => {
                  setJournalStatus({ message: "Choose a gratitude backup to import…", tone: "info" });
                  suspendBackgroundPlaybackRef.current = true;
                  backgroundVideoRef.current?.pause();
                  importInputRef.current?.click();
                }}
              >
                Import Backup
              </button>
              <button type="button" className="journal-modal__close" aria-label="Close Journal" onClick={onClose}>
                ✕
              </button>
            </div>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              void (async () => {
                try {
                  setJournalStatus({ message: "Reading gratitude backup…", tone: "info" });
                  const content = await file.text();
                  const payload = parseGratitudeBackupImportText(content);
                  if (payload.entries.length === 0) {
                    throw new Error("Backup has no entries.");
                  }
                  const hasExisting = entries.length > 0;
                  if (hasExisting) {
                    setJournalStatus({ message: "Confirm overwrite to import backup.", tone: "info" });
                    setPendingImportPayload(payload);
                    return;
                  }
                  applyImportedPayload(payload);
                  setJournalStatus({
                    message: `Backup imported (${payload.entries.length} entr${payload.entries.length === 1 ? "y" : "ies"}).`,
                    tone: "success"
                  });
                } catch {
                  resumeBackgroundPlayback();
                  setJournalStatus({ message: "Gratitude backup import failed.", tone: "error" });
                }
              })();
            }}
          />
          {pendingExportContent && (
            <div className="journal-save-name-card" role="group" aria-label="Name gratitude backup">
              <p>Name this gratitude backup before saving.</p>
              <input
                type="text"
                value={pendingExportFilename}
                onChange={(event) => setPendingExportFilename(event.currentTarget.value)}
                className="journal-save-name-input"
                placeholder="Gratitude backup"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <div className="journal-save-name-actions">
                <button
                  type="button"
                  className="journal-modal__export"
                  onClick={() => {
                    const filename = normalizeSaveFilename(pendingExportFilename, getGratitudeBackupFilename(), ".json");
                    if (!filename) {
                      setJournalStatus({ message: "Enter a backup filename first.", tone: "error" });
                      return;
                    }
                    void (async () => {
                      try {
                        await finishGratitudeBackupSave(pendingExportContent, filename);
                        setPendingExportContent(null);
                        setPendingExportFilename("");
                      } catch {
                        setJournalStatus({ message: "Gratitude backup failed.", tone: "error" });
                      }
                    })();
                  }}
                >
                  Save Backup
                </button>
                <button
                  type="button"
                  className="journal-modal__export"
                  onClick={() => {
                    setPendingExportContent(null);
                    setPendingExportFilename("");
                    setJournalStatus({ message: "Save gratitude backup canceled.", tone: "info" });
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {pendingImportPayload && (
            <div
              className="journal-confirm"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm gratitude import overwrite"
              onClick={(event) => {
                if (event.target === event.currentTarget) setPendingImportPayload(null);
              }}
            >
              <div className="journal-confirm__card">
                <h4>Overwrite Gratitude Journal?</h4>
                <p>Import Backup will replace your current Gratitude Journal entries on this device.</p>
                <div className="journal-confirm__actions">
                  <button
                    type="button"
                    className="journal-confirm__btn journal-confirm__btn--ghost"
                    onClick={() => {
                      setPendingImportPayload(null);
                      resumeBackgroundPlayback();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="journal-confirm__btn journal-confirm__btn--danger"
                    onClick={() => {
                      applyImportedPayload(pendingImportPayload);
                      setJournalStatus({
                        message: `Backup imported (${pendingImportPayload.entries.length} entr${
                          pendingImportPayload.entries.length === 1 ? "y" : "ies"
                        }).`,
                        tone: "success"
                      });
                      setPendingImportPayload(null);
                    }}
                  >
                    Overwrite
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="journalControlRow">
            <div
              className={`journalVerseCard ${verseFxActive ? "is-verse-flash" : ""}`.trim()}
              onTouchStart={(event) => {
                if (event.touches.length !== 1) {
                  verseSwipeStartRef.current = null;
                  return;
                }
                beginVerseSwipe(event.touches[0], event.target);
              }}
              onTouchEnd={(event) => {
                const touch = event.changedTouches[0];
                if (!touch) return;
                endVerseSwipe(touch);
              }}
              onTouchCancel={() => {
                verseSwipeStartRef.current = null;
              }}
            >
              <strong>Verse</strong>
              <p>{currentVerse}</p>
              {verseFxActive && (
                <div key={verseFxBurstKey} className="journalVerseBurst" aria-hidden="true">
                  <span className="journalVerseSpark journalVerseSpark--1" />
                  <span className="journalVerseSpark journalVerseSpark--2" />
                  <span className="journalVerseSpark journalVerseSpark--3" />
                  <span className="journalVerseSpark journalVerseSpark--4" />
                </div>
              )}
              <div className="journalVerseBtnRow">
                <button
                  type="button"
                  className="journalVerseBtn journalVerseBtn--prev"
                  aria-label="Previous verse"
                  onClick={() => cycleVerse(-1)}
                />
                <button
                  type="button"
                  className="journalVerseBtn journalVerseBtn--next"
                  aria-label="Next verse"
                  onClick={() => cycleVerse(1)}
                />
              </div>
            </div>
            <div className="journalPrimaryActionWrap">
              <button
                type="button"
                className="journal-modal__new journal-modal__new--primary"
                aria-label="New Journal Entry"
                onClick={() => {
                  setIsComposerOpen(true);
                  setEditingEntryId(null);
                }}
              >
                <svg viewBox="0 0 24 24" className="journal-modal__icon-svg">
                  <path d="M4 20l4-1 9-9-3-3-9 9-1 4Z" />
                  <path d="M13 6l3 3M3 21h18" />
                </svg>
                <span>New</span>
              </button>
            </div>
          </div>

          <div className="journal-modal__content">
            {isComposerOpen && (
              <div className="journal-compose">
                <textarea
                  ref={composerRef}
                  className="journal-entry__editor"
                  rows={4}
                  placeholder="Write a new gratitude entry..."
                  value={newEntryText}
                  onChange={(event) => setNewEntryText(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.stopPropagation();
                  }}
                />
                <div className="journal-entry__editor-actions">
                  <button
                    type="button"
                    className="journal-entry__save"
                    disabled={!canSaveNewEntry}
                    onClick={() => {
                      const trimmed = newEntryText.trim();
                      if (!trimmed) return;
                      createEntry(trimmed, currentVerse);
                      setEntries(listEntries());
                      setExpandedEntryId(null);
                      setNewEntryText("");
                      setIsComposerOpen(false);
                      setMiniToast("Saved");
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                      <path d="M5 12.5 9.2 17 19 7.5" />
                    </svg>
                    Save
                  </button>
                  <button
                    type="button"
                    className="journal-entry__cancel"
                    onClick={() => {
                      setNewEntryText("");
                      setIsComposerOpen(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                      <path d="M6 6 18 18M18 6 6 18" />
                    </svg>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="journalSearchBarWrap journalSearchBarWrap--list">
              <span className="journalSearchIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16 20 20" />
                </svg>
              </span>
              <input
                className="journalSearchInput"
                type="search"
                placeholder="Search journal entries..."
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              {query.trim().length > 0 && (
                <button type="button" className="journalSearchClear" aria-label="Clear search" onClick={() => setQuery("")}>
                  ×
                </button>
              )}
            </div>

            <div ref={entryListRef} className={`journal-modal__list ${editingEntryId ? "is-edit-mode" : ""}`.trim()}>
              {filteredEntries.length ? (
                filteredEntries.map((entry) => {
                  const isEditing = editingEntryId === entry.id;
                  const isAnotherEntryBlocked = editingEntryId !== null && !isEditing;
                  const isDeleting = deletingEntryId === entry.id;
                  const isExpanded = isEditing || expandedEntryId === entry.id;
                  const helperText = isEditing ? null : isExpanded ? "Tap to edit" : "Tap to expand";
                  return (
                    <article
                      key={entry.id}
                      className={`journal-entry ${isExpanded ? "is-expanded" : ""} ${isEditing ? "is-editing" : ""} ${
                        isAnotherEntryBlocked ? "is-edit-blocked" : ""
                      } ${
                        savedEntryId === entry.id ? "is-saved" : ""
                      } ${isDeleting ? "is-deleting" : ""}`.trim()}
                      aria-expanded={isExpanded}
                      aria-disabled={isAnotherEntryBlocked}
                      ref={isEditing ? activeEditEntryRef : null}
                      onClick={(event) => {
                        const target = event.target as HTMLElement | null;
                        if (target?.closest("button, input, textarea, select, a, label")) return;
                        if (isAnotherEntryBlocked) return;
                        if (isEditing) return;
                        handleEntryTap(entry);
                      }}
                    >
                  <div className="journal-entry__meta">
                    <span>{formatDateLabel(entry)}</span>
                    <div className="journal-entry__actions">
                      {helperText ? <span className="journal-entry__helper">{helperText}</span> : null}
                      <button
                        type="button"
                        className="journal-entry__edit"
                        aria-label="Edit entry"
                        disabled={isDeleting || isEditing || isAnotherEntryBlocked}
                        onClick={() => {
                          if (isAnotherEntryBlocked) return;
                          startEditingEntry(entry);
                        }}
                      >
                        <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                          <path d="m4 20 4-1 9-9-3-3-9 9-1 4Z" />
                          <path d="m13 6 3 3" />
                        </svg>
                      </button>
                      {!isEditing ? (
                        <button
                          type="button"
                          className="journal-entry__delete"
                          aria-label="Delete entry"
                          disabled={isDeleting || isAnotherEntryBlocked}
                          onClick={() => {
                            if (isAnotherEntryBlocked) return;
                            if (isDeleting) return;
                            const previousEntries = entries.slice();
                            setDeletingEntryId(entry.id);
                            if (editingEntryId === entry.id) {
                              setEditingEntryId(null);
                              setDraftText("");
                            }
                            if (expandedEntryId === entry.id) setExpandedEntryId(null);
                            if (deleteTimerRef.current !== null) window.clearTimeout(deleteTimerRef.current);
                            deleteTimerRef.current = window.setTimeout(() => {
                              try {
                                deleteEntry(entry.id);
                                setEntries(listEntries());
                                setMiniToast("Deleted");
                                fireHeavyHaptic();
                              } catch {
                                setEntries(previousEntries);
                                setMiniToast("Delete failed");
                              } finally {
                                setDeletingEntryId((prev) => (prev === entry.id ? null : prev));
                              }
                              deleteTimerRef.current = null;
                            }, 220);
                          }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isEditing ? (
                    <>
                      <textarea
                        ref={isEditing ? editTextareaRef : null}
                        className="journal-entry__editor"
                        value={draftText}
                        onChange={(event) => setDraftText(event.currentTarget.value)}
                        onBlur={(event) => {
                          if (isResolvingEditRef.current) return;
                          const nextTarget = event.relatedTarget as HTMLElement | null;
                          const activeEntry = activeEditEntryRef.current;
                          if (nextTarget && activeEntry?.contains(nextTarget)) return;
                          saveEditedEntry(entry.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.stopPropagation();
                        }}
                        rows={4}
                      />
                      <div ref={isEditing ? activeEditActionsRef : null} className="journal-entry__editor-actions">
                        <button
                          type="button"
                          className="journal-entry__save"
                          onClick={() => saveEditedEntry(entry.id)}
                          disabled={draftText.trim().length === 0}
                        >
                          <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                            <path d="M5 12.5 9.2 17 19 7.5" />
                          </svg>
                          Save Changes
                        </button>
                        <button
                          type="button"
                          className="journal-entry__cancel"
                          onClick={discardEditedEntry}
                        >
                          <svg viewBox="0 0 24 24" className="journal-entry__icon-svg">
                            <path d="M6 6 18 18M18 6 6 18" />
                          </svg>
                          Discard Changes
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="journal-entry__text">{entry.text}</p>
                  )}
                  </article>
                  );
                })
              ) : (
                <div className="journal-modal__emptyHint">
                  <p className="journal-modal__empty">No entries yet. Tap New.</p>
                </div>
              )}
            </div>
          </div>
          {journalStatus && (
            <div className={`journal-modal__status journal-modal__status--${journalStatus.tone}`.trim()} role="status" aria-live="polite">
              {journalStatus.message}
            </div>
          )}
          {miniToast && <div className="journal-modal__toast">{miniToast}</div>}
        </div>
      </div>
    </section>
  );
}
