# Enable missing Flutter platforms

If `flutter run` says there are devices but they are "not supported by this project", the project is missing the corresponding platform folders.

From `frontend/`, run:

```bash
flutter create . --platforms=android,ios,web,windows,linux,macos
```

Then fetch dependencies and run for a specific target:

```bash
flutter pub get
flutter run -d chrome
# or
flutter run -d windows
# or
flutter run -d emulator-5554
```

You only need to run `flutter create .` once (or whenever platform scaffolding is deleted).
