import type { MouseEvent } from "react";

const ORACLE_URL_SCHEMES = ["polyoracle://", "poly-oracle://"] as const;
const ORACLE_APP_STORE_URL = "https://apps.apple.com/app/poly-oracle/id6760079845";
const ORACLE_FALLBACK_DELAY_MS = 1400;
const ORACLE_SCHEME_RETRY_DELAY_MS = 220;

function isLikelyIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isTouchMac = /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  return isAppleMobile || isTouchMac;
}

export function PolyOracleOrb() {
  const onOpenOracle = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isLikelyIOSDevice()) return;
    event.preventDefault();
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const candidates = ORACLE_URL_SCHEMES.map((value) => value.trim()).filter(Boolean);
    const primary = candidates[0];
    if (!primary) {
      window.location.href = ORACLE_APP_STORE_URL;
      return;
    }

    let didLeavePage = false;
    let fallbackTimer: number | null = null;
    let secondaryAttemptTimer: number | null = null;

    const cleanup = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", onBlur);
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (secondaryAttemptTimer !== null) {
        window.clearTimeout(secondaryAttemptTimer);
        secondaryAttemptTimer = null;
      }
    };

    const markLeft = () => {
      didLeavePage = true;
      cleanup();
    };

    const onPageHide = () => markLeft();
    const onBlur = () => markLeft();
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      markLeft();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide, { once: true });
    window.addEventListener("blur", onBlur, { once: true });

    fallbackTimer = window.setTimeout(() => {
      cleanup();
      if (didLeavePage) return;
      window.location.href = ORACLE_APP_STORE_URL;
    }, ORACLE_FALLBACK_DELAY_MS);

    window.location.assign(primary);

    const secondary = candidates[1];
    if (secondary && secondary !== primary) {
      secondaryAttemptTimer = window.setTimeout(() => {
        if (didLeavePage) return;
        window.location.assign(secondary);
      }, ORACLE_SCHEME_RETRY_DELAY_MS);
    }
  };

  return (
    <a
      href={ORACLE_APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open PolyOracle"
      title="Open PolyOracle"
      className="pp-oracle-link nav-action-btn"
      data-ui="true"
      onClick={onOpenOracle}
    >
      <span className="pp-oracle-orb" />
    </a>
  );
}
