# Flutter iOS Setup

This folder contains a Flutter app skeleton for Polyplay.

## 1) Install Flutter
- Install from: https://docs.flutter.dev/get-started/install/macos
- Verify with `flutter doctor`

## 2) Generate platform folders (including iOS)
From `flutter_app/` run:

```bash
flutter create . --platforms=ios
```

## 3) Run on iOS simulator
```bash
flutter pub get
flutter run -d ios
```

## 4) Next integration step
Wire the Flutter app to your backend/API or local persistence that mirrors the web track model:
- `id`
- `title`
- `sub`
- `aura`
- `audio_url` or audio blob source
- `art_url`
