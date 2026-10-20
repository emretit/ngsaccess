# NGS Plus mobile

Flutter client for employee access and attendance. The web administration application and Convex backend live in the repository root. Employee accounts and initial passwords are provisioned by an authorized administrator; the mobile app does not provide public registration or send password reset emails. Use the organization's established administrator/support process for recovery.

## Supported targets and capability boundaries

| Target | Release scope |
| --- | --- |
| Android | Supported mobile target; minimum API23 or the pinned Flutter minimum, whichever is higher; compile/target API36 |
| iOS | Supported mobile target; minimum iOS15 (required by the pinned Flutter SDK); existing bundle ID preserved |
| macOS, Windows, Linux, web | Unsupported product targets; retained runner scaffolding is not a support promise and is excluded from release CI |

The client has employee login/session handling, attendance history, device selection, camera-based device QR scanning, employee QR display, TR/EN localization and themes. Access permission, command acknowledgement, physical passage and official attendance are separate outcomes: a successful request alone does not prove a door opened. QR camera permission recovery belongs to the scanner; the app requests no storage/gallery access. Camera hardware is optional so non-scanning flows can remain available.

The mobile release work adds secure session storage, session/request isolation, cursor history and summaries, scoped command/QR APIs, profile/version/localization and host-scoped visitor work across separate modules. See [delivery reports](../docs/mobile-release/reports/) for what each module actually implemented and tested; source presence is not physical device or panel acceptance. There is no claimed push delivery, offline mutation queue, public signup or self-service reset email service. Visitor/panel synchronization and physical entry require their own integration evidence.

## Toolchain and dependency policy

The authoritative release pin is [release/toolchain.json](release/toolchain.json): Flutter **3.47.2**, Dart **3.13.2**, Java **17**, Gradle **8.14.3**, AGP **8.11.1**, Kotlin **2.2.21**, Android build-tools **36.0.0**, Xcode major **27**, CocoaPods fallback **1.16.2**. The pubspec minimum follows the resolved dependency graph (Dart3.11 / Flutter3.38.4); release scripts require the exact pin. Native versions satisfy the pinned Flutter SDK's dependency checks; the Gradle distribution checksum is verified. The supported iOS minimum is **15.0**. Runtime metadata uses package_info_plus8.3.1; secure storage is pinned to10.3.1. Durable operation persistence uses direct path_provider2.1.6, matching the existing locked implementation. Dependency upgrades must include Dart and native graph review.

Flutter's default SwiftPM integration is retained, with CocoaPods fallback for plugins that need it. Do not assume every Dart plugin appears in Podfile.lock when SwiftPM handles it. Commit regenerated lock/project/registrant changes only after reviewing the actual pinned-SDK restore/build. macOS native graph is outside supported mobile release acceptance. Do not run Flutter processes concurrently against one SDK lock/cache.

## Setup

Run from the repository's `mobile/` directory. Install the declared toolchain, Android SDK/API36 or the authorized Apple development tools, then:

```sh
flutter pub get
flutter gen-l10n
python3 scripts/check_l10n.py
flutter analyze --no-pub
flutter test --no-pub
python3 -m unittest discover -s scripts/tests -v
```

Commit the reviewed pubspec.lock. Subsequent clean checkouts and CI use `flutter pub get --enforce-lockfile`; unexpected lock drift fails CI. TR/EN ARB files are authoritative; generated `lib/l10n/` is checked for drift after `flutter gen-l10n`.

The environment example is documentation for **public** compile-time values. It is not an asset or a secret store, and copying it to `.env` is unnecessary. The legacy local `.env` is neither read by release scripts nor bundled. Do not put passwords, tokens, private keys or signing material in Dart defines: compiled values can be recovered from an application.

Choose approved values explicitly in your local shell/CI configuration:

```sh
export APP_ENV=staging
export CONVEX_URL=https://your-staging-deployment.convex.cloud
export CONVEX_ALLOWED_HOST=your-staging-deployment.convex.cloud
scripts/build_mobile.sh run
```

Replace both host placeholders before running. APP_ENV is `staging` or `production`; the URL must be HTTPS, have the exact approved host and contain no credentials, path, query or fragment. Config preflight prints only environment and a host hash. The runtime config also validates before creating a client. Build scripts provide the three Dart defines consistently. Provision a test employee using your existing administrator workflow; never use real production employee data for smoke tests. No backend deploy is part of mobile setup here.

## Native compilation and distribution

```sh
scripts/build_mobile.sh android-unsigned
scripts/build_mobile.sh ios-simulator
scripts/build_mobile.sh ios-nosign
```

The unsigned Android APK is for compilation checks, with ELF LOAD16KB alignment, APK zip alignment, API36/identity, forbidden-permission and unsigned-state inspection. It is not a Play upload or installation/signing acceptance. iOS simulator/no-sign compilation likewise does not prove distribution readiness. Standard Android release tasks fail when upload signing is absent; only the explicitly scoped `ngsUnsignedRelease=true` property permits compile-only release output.

For authorized signed preparation, configure existing approved identities rather than generating replacement keys:

- Android: `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (or ignored `android/key.properties` fields `storeFile`, `storePassword`, `keyAlias`, `keyPassword`) plus `ANDROID_EXPECTED_CERT_SHA256`. Relative storeFile is resolved from `android/`. Keep simple unescaped property values; environment variables avoid Java-properties escaping ambiguity. `BUNDLETOOL_JAR` must point to the owner-approved bundletool. Run `scripts/build_mobile.sh android-release` to verify the upload certificate before build and the final AAB signature, manifest and16KB properties afterwards. The expected upload certificate differs from the Play App Signing installation certificate when Play re-signs delivery; preserve both continuity records privately.
- iOS: `IOS_TEAM_ID` and `IOS_PROFILE_PATH` refer to the existing authorized App Store distribution team/profile and matching installed Apple Distribution identity. Run `scripts/build_mobile.sh ios-archive`. The script generates an ignored, mode0600 ExportOptions.plist for local export, builds/exports with no upload, then checks the archive and final IPA code signature/profile/entitlements/bundle/privacy resources. The existing iOS bundle ID is `com.ngsplus.app`; Android's separate existing ID is `com.ngsplus.app.ngsplusapp`. Do not make them identical as a cleanup.

Signing inputs never belong in this README, release evidence or command output. Do not enable shell tracing. Scripts do not create keystores, upload to a store or deploy a backend. A missing secret/profile/certificate/tool causes a failing preflight. Build receipts in `build/release-evidence/` record artifact hashes, revision/dirty state, public environment host hash, lock hash and toolchain. Retain symbol files and Apple dSYMs privately with their exact artifact/build; CI uploads evidence only.

[The release checklist](release/README.md) names the remaining store, policy, signing and device gates. [The review template](release/store-review-template.md) deliberately leaves legal/store facts for the owner. A checked-in privacy manifest is not a completed privacy label or legal review.

## CI

[mobile.yml](../.github/workflows/mobile.yml) gates mobile changes on exact-lock restore, generated localization drift, analyze/tests, release preflight tests, unsigned Android artifact inspection and iOS simulator/device no-sign compilation. Compile jobs use a reserved `.invalid` host with no employee credentials. An explicitly requested manual workflow can build and verify the approved Android upload signature using the protected `mobile-release` environment; it never publishes. Missing Xcode27 runner availability, signing secrets or owner-approved bundletool checksum remains an explicit infrastructure blocker, not a skipped successful signing check.
