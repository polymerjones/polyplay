# PolyPlay iOS App Store Submission Checklist — 2026-04-07

Use this as the final pre-submission device and packaging checklist for the current stabilization build.

## Release candidate

- [ ] `main` contains the intended release candidate
- [ ] Local worktree is clean or only contains intentional release packaging changes
- [ ] Xcode is pointing at the intended synced web bundle
- [ ] Version number is correct
- [ ] Build number is correct

## Trust-critical playback

- [ ] Fresh install on iPhone succeeds
- [ ] First launch is stable
- [ ] Import one short audio track
- [ ] Import one long audio track
- [ ] Imported tracks do not show false `Missing audio`
- [ ] Tapping a tile starts playback
- [ ] Tapping a row starts playback
- [ ] Manual `Play` still works
- [ ] Track end advances to the next track and autoplay resumes
- [ ] `Next` and `Prev` work normally, including wraparound from last track to first
- [ ] Background playback works
- [ ] Lock screen / Now Playing title, artwork, and transport controls appear correctly
- [ ] Reopen the app after playback and state still looks correct

## Waveform / loop / crop

- [ ] Short imported tracks resolve to a real waveform rather than staying on the lazy fallback
- [ ] Waveform remains visible against the viewport background in the tested themes
- [ ] Track switching no longer shows a flat/dead waveform viewport
- [ ] Waveform handoff feels controlled on iPhone
- [ ] Waveform handoff also looks correct in Safari if browser QA is part of the release signoff
- [ ] Long tracks open with a usable default loop region
- [ ] Manual loop adjustment still works
- [ ] Loop playback still works
- [ ] Saved loop persistence still works after reopen
- [ ] Short-track crop still works for replace-existing
- [ ] Short-track crop still works for duplicate-to-new-track
- [ ] Long-track crop does not crash or refresh the app on iPhone
- [ ] Long-track crop shows the guardrail message clearly

## Theme / FX spot checks

- [ ] Light mode FX read pink rather than purple
- [ ] Amber FX read warm amber/gold rather than purple-orange
- [ ] Crimson FX read crimson/red rather than purple
- [ ] Merica fireworks still sequence correctly
- [ ] Rasta leaf is visible on iOS and still blurred/abstract
- [ ] Rasta smoke feels offset/organic rather than duplicated
- [ ] No theme shows obviously incorrect FX colors or broken contrast

## Import / settings overlay

- [ ] Opening Import no longer reveals weird background layers while the panel loads
- [ ] `Loading import panel…` veil appears and clears cleanly
- [ ] Manage/Settings mode still opens cleanly

## UI sanity sweep

- [ ] Tile art no longer shows the dark rounded backplate seam
- [ ] Imported rows no longer show the unnecessary `Imported` label
- [ ] Long-track fallback auto-art no longer shows the theme badge/text
- [ ] Mute shows `Audio Muted`
- [ ] Dim shows `Audio Dimmed`
- [ ] No obvious placeholder, debug, or admin-only UI leaks into the release flow

## Archive / packaging

- [ ] App icon is correct
- [ ] Display name is correct
- [ ] Bundle identifier is correct
- [ ] Signing, team, and provisioning are correct
- [ ] Background audio capability is enabled as intended
- [ ] Privacy strings are accurate and human-readable
- [ ] Archive succeeds in Xcode
- [ ] Validate App passes
- [ ] Upload to App Store Connect succeeds
- [ ] The uploaded build appears with the expected version/build number

## Final go / no-go

- [ ] No known playback blocker remains
- [ ] No known import/reopen blocker remains
- [ ] No known iPhone crash path remains in the tested release flow
- [ ] Approved to submit for review
