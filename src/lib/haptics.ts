import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

function fallbackVibrate(durationMs: number): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Ignore unsupported vibration calls.
  }
}

export function fireSuccessHaptic(): void {
  void Haptics.notification({ type: NotificationType.Success }).catch(() => {
    fallbackVibrate(18);
  });
}

export function fireHeavyHaptic(): void {
  void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {
    fallbackVibrate(26);
  });
}

export function fireAuraHaptic(level: number): void {
  const clamped = Math.max(0, Math.min(10, Math.round(level)));
  if (clamped >= 8) {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {
      fallbackVibrate(24);
    });
    return;
  }
  if (clamped >= 5) {
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {
      fallbackVibrate(18);
    });
    return;
  }
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
    fallbackVibrate(12);
  });
}

export function fireLightHaptic(): void {
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
    fallbackVibrate(12);
  });
}
