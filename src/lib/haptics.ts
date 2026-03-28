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

export function fireLightHaptic(): void {
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
    fallbackVibrate(12);
  });
}
