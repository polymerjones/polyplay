# PolyPlay Post-Release Marketing Links - 2026-05-13

## Scope

Small post-release UI update for PolyPlay Audio. This was a narrow product/marketing addition, not a stabilization pass.

## Changes

- Added an App Store badge link to the desktop main toolbar.
- Added a footer section at the bottom of the Settings content with:
  - official "Download on the App Store" badge
  - Instagram icon link
  - TikTok icon link
  - existing Privacy Policy, Terms & Conditions, and Support links preserved below the social links
- Used the official App Store badge SVG from Wikimedia:
  - `https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg`
- Added parent-window external link handling for Settings because Settings runs inside an iframe in the main app.

## Link Targets

- App Store: `https://apps.apple.com/us/app/polyplay-audio/id6760799840`
- Instagram: `https://www.instagram.com/polyplayaudio/`
- TikTok: `https://www.tiktok.com/@polyplayaudio`

## Implementation Notes

- `src/admin/AdminApp.tsx`
  - Adds Settings footer markup.
  - Routes external footer links through `polyplay:open-external-url` when Settings is embedded in the parent iframe.
  - Avoids navigating the Settings iframe directly to external sites.
- `src/App.tsx`
  - Adds desktop toolbar App Store badge.
  - Handles `polyplay:open-external-url` messages from the Settings iframe.
  - Uses Capacitor Browser when available and falls back to opening a new browser context.
- `src/index.css`
  - Adds Settings footer, App Store badge, and social icon styling.
- `styles.css`
  - Adds desktop toolbar badge sizing and mobile hiding.

## QA Completed

- `npm run typecheck` passed.
- `git diff --check` passed.
- App Store badge URL returned HTTP 200.
- User confirmed the desktop/homepage App Store link opened correctly.
- User reported iframe navigation issue from Settings; fixed by routing Settings external links through the parent app.

## QA Still Recommended

- Confirm Settings App Store, Instagram, and TikTok links open correctly in the installed iOS app.
- Confirm returning to PolyPlay after opening those links leaves Settings intact rather than showing an external-site iframe error.
- Confirm desktop toolbar badge spacing across common desktop widths.
