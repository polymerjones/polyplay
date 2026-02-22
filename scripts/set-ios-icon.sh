#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_ICON="${1:-$ROOT_DIR/assets/icon-1024.png}"
DEST_DIR="$ROOT_DIR/ios/App/App/Assets.xcassets/AppIcon.appiconset"
DEST_ICON="$DEST_DIR/AppIcon-512@2x.png"

if [[ ! -f "$SRC_ICON" ]]; then
  echo "[ios:icon] Source icon not found: $SRC_ICON"
  echo "[ios:icon] Put a 1024x1024 PNG at assets/icon-1024.png or pass a path."
  exit 1
fi

if [[ ! -d "$DEST_DIR" ]]; then
  echo "[ios:icon] iOS AppIcon directory not found: $DEST_DIR"
  echo "[ios:icon] Run: npx cap add ios"
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "[ios:icon] 'sips' not found (required on macOS)."
  exit 1
fi

TMP_ICON="$(mktemp /tmp/polyplay-icon.XXXXXX.png)"
trap 'rm -f "$TMP_ICON"' EXIT

# Normalize to exact 1024x1024 PNG for Xcode AppIcon slot.
sips -s format png -z 1024 1024 "$SRC_ICON" --out "$TMP_ICON" >/dev/null
cp "$TMP_ICON" "$DEST_ICON"

echo "[ios:icon] Updated iOS app icon: $DEST_ICON"
echo "[ios:icon] Next: npm run ios:open (or rebuild in Xcode)"
