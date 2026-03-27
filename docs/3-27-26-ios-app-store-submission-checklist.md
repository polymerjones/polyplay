# Polyplay iOS App Store Submission Checklist - March 27, 2026

## Release Candidate

- [ ] `main` is the intended release branch
- [ ] Local worktree is clean or only contains intentional release-candidate changes
- [ ] Xcode is using the intended synced web bundle
- [ ] Version number is correct
- [ ] Build number is correct

## Device QA

- [ ] Fresh install on iPhone succeeds
- [ ] First launch is stable
- [ ] Import user media works
- [ ] Playback works
- [ ] Seek/skip/repeat/shuffle work
- [ ] Fullscreen player works
- [ ] Rows/Tiles toggle works and first-tap hint dismisses correctly
- [ ] Settings/admin opens correctly
- [ ] Journal create/edit/delete works
- [ ] Gratitude prompt opens correctly and starts blank
- [ ] `Nuke Playlist` clears only the active playlist contents

## Vault

- [ ] Fresh Vault export succeeds
- [ ] Exported ZIP saves/shares correctly
- [ ] Clean reinstall + Vault import succeeds
- [ ] Restored media plays correctly
- [ ] Restored playlists are correct
- [ ] Restored loop markers are correct
- [ ] Vault no longer claims to include journal data
- [ ] Separate journal backup/import still works independently

## Metadata / Packaging

- [ ] App icon is correct
- [ ] Display name is correct
- [ ] Bundle identifier is correct
- [ ] Signing/team/profile configuration is correct
- [ ] Privacy strings are accurate
- [ ] No placeholder branding or copy remains
- [ ] Screenshots match the current shipped UI
- [ ] App description matches current behavior

## Archive / Upload

- [ ] Archive succeeds in Xcode
- [ ] Validate App passes
- [ ] Upload to App Store Connect succeeds
- [ ] Build appears in App Store Connect
- [ ] Selected build matches intended version/build numbers

## App Store Connect

- [ ] App metadata is complete
- [ ] Keywords are set
- [ ] Support URL is valid
- [ ] Privacy policy URL is valid
- [ ] Age rating is set correctly
- [ ] App Privacy questionnaire is accurate
- [ ] Export compliance is answered correctly
- [ ] Any reviewer notes are added if needed

## Final Go / No-Go

- [ ] No known data-loss bugs remain
- [ ] No known playback blockers remain
- [ ] No known Vault integrity blockers remain
- [ ] No known iPhone UI blockers remain
- [ ] Approved to submit for review
