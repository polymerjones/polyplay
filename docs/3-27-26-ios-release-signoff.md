# Polyplay iOS Release Signoff - March 27, 2026

## Build

- [ ] `main` is the release branch being packaged
- [ ] No unproven last-minute code changes remain
- [ ] Version/build number updated correctly
- [ ] Xcode archive is built from the intended release candidate

## Install / Launch

- [ ] App installs cleanly on iPhone
- [ ] First launch is stable
- [ ] No unexpected stale state survives reinstall

## Playback

- [ ] User audio imports successfully
- [ ] Play/pause works
- [ ] Seek works
- [ ] Skip back/forward works
- [ ] Repeat works
- [ ] Shuffle works
- [ ] DIM/MUTE behavior is acceptable on iPhone
- [ ] Lock/unlock and app-switch return do not break playback

## Player UI

- [ ] Mini player is usable
- [ ] Fullscreen player is usable
- [ ] No clipped controls or unreadable labels
- [ ] Artwork/video artwork behaves correctly

## Loops

- [ ] Loop markers can be created
- [ ] Loop playback behaves correctly
- [ ] Loop markers persist after relaunch
- [ ] Loop markers restore correctly from Vault

## Vault

- [ ] Fresh Vault export succeeds
- [ ] Exported ZIP is save/share usable
- [ ] Clean reinstall + Vault import succeeds
- [ ] Restored track audio plays
- [ ] Restored artwork appears
- [ ] Restored playlists are correct
- [ ] Restored loop markers are correct
- [ ] Restored journal data is correct

## Library / Management

- [ ] Playlist create works
- [ ] Playlist rename works
- [ ] Playlist delete behavior is correct
- [ ] Track rename works
- [ ] Track delete behavior is correct

## Journal

- [ ] Create works
- [ ] Edit works
- [ ] Delete works
- [ ] Layout/buttons remain reachable on iPhone
- [ ] Entries persist after relaunch

## Settings / Admin

- [ ] Settings/admin opens correctly
- [ ] Core actions are tappable
- [ ] No broken iframe/modal behavior
- [ ] Destructive confirmations behave correctly

## Visual / Performance

- [ ] Dark mode looks correct
- [ ] Light mode looks correct
- [ ] Contrast is acceptable
- [ ] FX/performance is acceptable on device
- [ ] No obvious stutter/overheating issues

## Packaging / App Store

- [ ] App icon is correct
- [ ] App name/display name is correct
- [ ] Metadata/screenshots are accurate
- [ ] No placeholder branding/text remains
- [ ] Permission/privacy strings are accurate

## Final Go/No-Go

- [ ] No crashes in core flows
- [ ] No data-loss bugs
- [ ] No playback blockers
- [ ] No Vault integrity blockers
- [ ] Approved to archive and submit
