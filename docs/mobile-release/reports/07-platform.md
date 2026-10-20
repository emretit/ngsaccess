# 07 — Platform implementation and release preparation

Date: 19 October 2026. Owner: dispatched platform worker, task `task_fcd8bbc1f544`, dispatch `ctx_f8e64a93712a`. This is an implementation delivery, not a store-readiness certificate. No Flutter/Dart analyze/test/pub-get/gen-l10n/build, CocoaPods install, Gradle build, commit, push, deploy, production mutation or store upload was run by this worker. The coordinator owns the shared SDK lock and final native validation.

## Result

Implemented Android/iOS release configuration, fail-closed signing checks, exact-environment build wrappers, native artifact validators, release CI, dependency changes, permission/backup/keychain/privacy configuration and truthful setup/release documentation. Fifteen Python regression tests and platform source/syntax checks pass. Missing approved signing identities, unresolved actual native graph/build evidence, physical-device/panel acceptance and store/legal inputs prevent a claim that a distributable release is ready.

## Revalidated audit findings and disposition

Read development-package.md, the full platform-quality module and localization requirements relevant to runtime metadata/catalog drift. Revalidated the source: Android release selected debug signing, .env was packaged, storage/gallery declarations had no released file flow, pubspec minimums did not represent the resolved graph, Apple locks differed from the Dart plugin graph, no mobile CI existed, README described nonexistent public signup/reset and demo-only camera, and Google Fonts used runtime font loading without bundled font assets. No real secrets or .env values were read into output/report.

| Audit/work IDs | Implemented closure or current boundary |
| --- | --- |
| MOB-20 / PLAT-F01, WP01 | Source bug closed: Android debug release fallback removed; upload signing environment/key.properties path, explicit unsigned opt-in and fail-closed checks. Source application IDs preserved. Approved upload SHA256 and final AAB/APK signer validation implemented. Actual identity/upgrade/device acceptance remains open. |
| MOB-20 / PLAT-F02, WP02; NET-F08 | Platform side closed: .env removed from assets, public env.example, three mandatory Dart define inputs, HTTPS/exact-host/no-payload URL validation before build and environment/hash provenance. Runtime startup/client validation is the transport/composition owners' delivery and must be included in final integration. |
| MOB-21 / PLAT-F03, WP03 | Dependency/strategy contract implemented: Flutter default SwiftPM with CocoaPods fallback; no fabricated native lock edits. pubspec/plugin graph regeneration and supported iOS clean builds are coordinator-owned pending evidence; stale macOS lock is outside supported product scope. This finding is not fully closed by source editing. |
| MOB-21 / PLAT-F04, WP04, WP09 | Source gap closed: exact release pin, compatible SDK minimums, Java17/API36/AGP8.10.1, lock/catalog/analyze/test/native CI gates, signing-verification-only manual job, artifact receipts. CI execution, external branch/environment protection and Xcode27 runner availability remain unverified. |
| MOB-21 / PLAT-WP10 | Theme owner removed Google Fonts usages; platform owner removed dependency. System-font typography is deterministic without font-network download. Offline first-install visual acceptance remains device QA. |
| MOB-22 / PLAT-F05, WP05 | Source bug closed: Android READ/WRITE_EXTERNAL_STORAGE and iOS gallery declaration removed, camera hardware optional, camera permission retained and permission_handler camera macro enabled for Settings recovery. Backup/cloud/device-transfer exclusions added for secure-session storage. Final merged artifact/device permission recovery remains pending. |
| MOB-22 / PLAT-F06, WP06 | Scope resolved: only Android/iOS supported; desktop/web runners are retained unsupported scaffolding, with no new macOS support claim or unnecessary entitlement expansion. Scanner capability guards are QR/composition ownership. |
| MOB-23 / PLAT-F07, WP07 | Documentation gap closed: real repository setup, admin-provisioned accounts, actual QR/localization, capability/physical-effect boundaries, supported targets, release/toolchain/secret contract and honest missing gates. |
| MOB-23 / PLAT-F08, WP08 | Platform provides secret-safe preflight diagnostics and build/artifact provenance; runtime stack/operation hooks/redaction belong to transport/composition. No external telemetry service or policy is claimed. Final synthetic release-error/device acceptance remains open. |
| MOB-16 / L10N-W07/W08 | package_info_plus provided to profile owner; TR/EN key and placeholder parity plus generated-code drift gate implemented. Runtime version/profile/About behavior belongs to profile owner. |

## Concrete implementation

Android keeps `com.ngsplus.app.ngsplusapp`. Gradle release loads four upload inputs from environment or ignored key.properties; absent input/file/debug alias fails normal release tasks. The unsigned CI opt-in is a process-scoped Gradle property, not a persisted fallback. Signed wrapper unsets the unsigned environment opt-in, verifies the approved upload certificate, builds an AAB and verifies the bundle signature and manifest. Existing Gradle8.12/Kotlin2.1.0 retained; AGP8.10.1/Java17 and compile/targetAPI36 added; minimum is max(API23, Flutter minimum). No fake key generated. An ignored-file-aware scoped metadata scan found no release keystore/key.properties files under mobile (excluding generated caches/build/Pods); this says nothing about a private vault or existing store keys.

Android APK validation checks the actual manifest through apkanalyzer, aapt package/target/debug state, no forbidden storage/media permission, backup disabled, no bundled .env, arm64 presence, every native ELF LOAD segment16KB alignment and zipalign-P16. Unsigned evidence fails if apksigner reports a valid signature. Signed APK expects the approved certificate. Final AAB validation uses a locally approved bundletool, jarsigner/keytool expected upload SHA256, exact identity, targetAPI36, merged permissions/backup, all ELF LOAD16KB and PAGE_ALIGNMENT_16K. These are artifact checks, not a successful runtime16KB installation or panel effect.

iOS keeps `com.ngsplus.app`. Camera/gallery declarations reconciled, permission_handler's camera macro enabled, separate debug/profile and release keychain entitlements wired, iOS13 made explicit, and PrivacyInfo.xcprivacy included in Runner resources. The app reason declaration is UserDefaults CA92.1 and no tracking; it does not invent backend collection labels. CocoaPods/SwiftPM plugin manifests must be inspected in the actual privacy report. Distribution preflight requires an unexpired exact-team/bundle App Store profile, no get-task-allow/device-limited/ad-hoc/enterprise privileges and a matching installed Apple Distribution identity. Local ExportOptions generation uses mode0600 and export-only destination. Archive verification is distinct from final IPA distribution-profile/signed-entitlement validation, because archive and exported signatures can differ.

Build scripts pass APP_ENV/CONVEX_URL/CONVEX_ALLOWED_HOST, enforce the supplied Flutter3.47.2/Dart3.13.2 release pin and write receipts with artifact/lock hashes, revision/dirty state, environment/host hash and toolchain. No token/account/password/key/certificate payload is recorded. Native stderr is captured without printing sensitive dynamic exception content. The GitHub manual protected job materializes an existing provided key privately, verifies an owner-approved fixed bundletool checksum, builds/verifies and cleans key material; it does not publish artifacts to a store. Compile CI uses a reserved .invalid backend and no employee credentials. Exported artifacts/symbols require private operational retention; CI uploads evidence only.

## Files changed by this owner

- `mobile/pubspec.yaml`: exact flutter_secure_storage10.0.0/package_info_plus8.3.1; direct path_provider2.1.5 at the existing locked version for operations-store owner; SDK minimums; remove Google Fonts dependency and .env asset; retain permission_handler and legacy debug dotenv adapter.
- `mobile/android/app/build.gradle.kts`, `mobile/android/settings.gradle.kts`.
- `mobile/android/app/src/main/AndroidManifest.xml`, new `res/xml/data_extraction_rules.xml`.
- `mobile/ios/Podfile`, `mobile/ios/Runner.xcodeproj/project.pbxproj`, `mobile/ios/Runner/Info.plist`.
- New `mobile/ios/Runner/DebugProfile.entitlements`, `Release.entitlements`, `PrivacyInfo.xcprivacy`.
- `mobile/ios/RunnerTests/RunnerTests.swift`: replace empty example with application camera/gallery and bundled privacy assertions.
- `.github/workflows/mobile.yml`.
- `mobile/.gitignore`, `mobile/env.example`, rewritten `mobile/README.md`.
- New `mobile/release/toolchain.json`, `mobile/release/README.md`, `mobile/release/store-review-template.md`.
- New `mobile/scripts/release_preflight.py`, `build_mobile.sh`, `build_receipt.py`, `check_apple_tools.py`, `check_l10n.py`, `prepare_upload_key.py`, `fetch_bundletool.py`, `tests/test_release_preflight.py`.
- This report.

The coordinator regenerated pubspec.lock and desktop generated plugin registrants after receiving early dependency status; those generated edits are not a claim that this worker ran SDK commands. Existing web/Convex edits and all other Flutter source/test ownership were preserved. mobile/.env was neither printed nor changed. No main/root/global generated l10n edits were made here.

## Interfaces and dependencies

- Required public build inputs: APP_ENV=`staging|production`, CONVEX_URL, CONVEX_ALLOWED_HOST. Runtime owner has received/implemented this contract; final integration tests remain coordinator-owned. Debug dotenv adapter remains present but documented builds always pass Dart defines and no .env is bundled.
- Android signing: ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD; local equivalents storeFile/storePassword/keyAlias/keyPassword relative to android/. Approved ANDROID_EXPECTED_CERT_SHA256 required by signed preparation. Use environment values for paths/passwords needing Java-properties escaping.
- Android tools: installed SDK command-line apkanalyzer, declared build-tools36.0.0 aapt2/apksigner/zipalign; approved BUNDLETOOL_JAR. CI downloads official1.18.2 only if owner-approved BUNDLETOOL_1_18_2_SHA256 is configured; checksum not invented.
- iOS signing: IOS_TEAM_ID, IOS_PROFILE_PATH, installed matching Apple Distribution identity; output ignored ExportOptions.plist. No existing bundle/team identity rewritten.
- Dependencies selected from publisher primary docs: secure_storage10.0.0 (API23 default crypto, iOS keychain configuration), package_info_plus8.3.1 (Java17/AGP>=8.3/Gradle>=8.4). Newer package_info major versions would require broader native upgrades and were not selected merely for recency. No new production framework or telemetry dependency.
- Flutter release modes: run, android-unsigned, android-release, ios-simulator, ios-nosign, ios-archive. Preflight subcommands are documented via `--help`; android-aab/ios-ipa inspect actual final distribution outputs.

## Tests and executed checks

**Executed by platform worker:**

- `python3 -m unittest discover -s mobile/scripts/tests -v`: **15/15 passed**. Wrong/credential-bearing/empty URL; missing/invalid environment; approved host digest; sensitive native stderr isolation; missing upload credentials; debug alias; approved fingerprint mismatch; wrong app identity/missing camera; transitive forbidden permissions; backup/debug flags; packaged .env rejection; signed APK rejected as unsigned compile evidence; ELF4KB rejected/16KB accepted; expired/wrong-team/wildcard/development/ad-hoc/enterprise profile rejection; source manifest/privacy contract.
- `python3 mobile/scripts/release_preflight.py sources`: sourcePermissions/privacyManifestSyntax passed.
- `python3 mobile/scripts/check_l10n.py`: TR/EN key and placeholder type/name parity passed against current owner catalogs.
- `python3 -m py_compile mobile/scripts/*.py mobile/scripts/tests/*.py`: passed.
- `bash -n mobile/scripts/build_mobile.sh`: passed.
- `plutil -lint` on Info.plist, PrivacyInfo.xcprivacy, both entitlements and project.pbxproj: passed.
- Ruby YAML parse of `.github/workflows/mobile.yml` and expected three jobs: passed. This is syntax validation, not execution of GitHub Actions.
- `git diff --check` restricted to owned mobile platform/pubspec/README/gitignore/workflow paths: passed. A broad mobile check encountered another owner's in-progress profile trailing blank line; that file was not changed here.

**Written but not executed:** two Swift RunnerTests assertions; all Flutter/native artifact/build/device/store tests. No native artifact exists from this worker, so no signer, actual16KB library, merged release manifest, archive/export, plugin registration or physical camera result is asserted. Existing baseline44-test success is historical coordinator audit evidence, not this delivery's current all-module result.

## Exact pending native and integration commands

See `mobile/release/README.md` for the runnable sequence, expected public environment inputs, signed preparation inputs and evidence boundaries. From mobile/, coordinator must run serially after all module edits:

```sh
flutter --version --machine
flutter pub get
flutter gen-l10n
python3 scripts/check_l10n.py
flutter analyze --no-pub
flutter test --no-pub --reporter expanded
flutter pub get --enforce-lockfile
git diff -- pubspec.lock ios/Podfile.lock ios/Runner.xcodeproj/project.pbxproj
scripts/build_mobile.sh android-unsigned
scripts/build_mobile.sh ios-simulator
scripts/build_mobile.sh ios-nosign
```

If fallback pods need regeneration, with real approved staging defines already in the shell:

```sh
flutter build ios --config-only --no-codesign --no-pub --dart-define=APP_ENV=staging --dart-define=CONVEX_URL=https://your-staging-deployment.convex.cloud --dart-define=CONVEX_ALLOWED_HOST=your-staging-deployment.convex.cloud
(cd ios && pod install)
git diff -- ios/Podfile.lock ios/Runner.xcodeproj/project.pbxproj
(cd ios && pod install --deployment)
```

Replace host placeholders; review actual SwiftPM-vs-pod ownership, then require a clean second restore/build. This is not a request to disable SwiftPM globally or manually forge a Podfile.lock. Actual simulator test destination must be selected locally without writing its identifier into the report:

```sh
xcodebuild test -workspace ios/Runner.xcworkspace -scheme Runner -configuration Debug -destination 'platform=iOS Simulator,id=<selected-simulator-udid>' CODE_SIGNING_ALLOWED=NO
```

After actual release-owner signing inputs exist:

```sh
python3 scripts/release_preflight.py android-signing
scripts/build_mobile.sh android-release
python3 scripts/release_preflight.py ios-signing
scripts/build_mobile.sh ios-archive
```

Native commands were communicated early; this worker never waited until completion to expose pub-get/lock integration needs.

## Honest remaining blockers

1. Coordinator final all-module Flutter analyze/test/gen-l10n, reviewed pubspec/plugin/native lock resolution and clean supported native builds. Coordinator has regenerated after Google Fonts removal; the approved direct path_provider2.1.5 promotion requires one more pub-get/lock restore. Native build failures, if any, must be fixed from actual evidence.
2. Actual approved Android upload key/expected fingerprint and previous Play App Signing install identity; actual iOS distribution identity/profile. Scoped checkout has no release key. No replacement identity, fake credential or signed-readiness claim was produced.
3. Real final AAB/IPA inspection, Android upgrade continuity, authorized iOS test distribution, Android16KB runtime and first launch/native plugin registration. No physical Android device was available per coordinator; available simulator is not physical camera/panel proof.
4. Xcode27-capable GitHub runner selection, configured protected release environment/secrets/approved bundletool checksum, branch-required checks and successful CI execution. YAML alone cannot configure organizational protections or prove external availability.
5. Real QR camera permission/recovery/lifecycle, approved reader/panel commands and passage, offline logout/keychain/account races, history calendar/cursor, accessibility and TR/EN release-device results. Module test evidence must not substitute for physical behavior.
6. Owner-reviewed store history/version increment, distribution channel, legal entity, real support/privacy URLs, backend-data privacy labels/retention/deletion/export compliance and reviewer access guidance. Template deliberately leaves these blank; source1.0.4+1 is preserved until actual store history is known.
7. Remote telemetry service/data policy and private symbols/dSYM retention/production-like synthetic diagnostic acceptance remain operational decisions; implemented safe hooks in another module are not an external observability deployment.

## Primary references checked

- [Flutter Android release/signing](https://docs.flutter.dev/deployment/android), [Flutter iOS archive/export](https://docs.flutter.dev/deployment/ios).
- [Flutter SwiftPM default and CocoaPods fallback](https://docs.flutter.dev/packages-and-plugins/swift-package-manager/for-app-developers): retained default integration, no invented Pod/SPM migration.
- [secure_storage10.0.0 publisher documentation](https://pub.dev/packages/flutter_secure_storage/versions/10.0.0), [package_info_plus8.3.1 requirements](https://pub.dev/packages/package_info_plus/versions/8.3.1).
- [Google Play target requirements](https://developer.android.com/google/play/requirements/target-sdk): API36 submissions from31August2026; [AGP8.10 compatibility](https://developer.android.com/build/releases/agp-8-10-0-release-notes): API36, Java17/Gradle>=8.11.1.
- [Android16KB validation](https://developer.android.com/guide/practices/page-sizes), [official fixed bundletool1.18.2 release](https://github.com/google/bundletool/releases/tag/1.18.2).
- [Flutter shared_preferences Foundation privacy resource](https://raw.githubusercontent.com/flutter/packages/main/packages/shared_preferences/shared_preferences_foundation/darwin/shared_preferences_foundation/Sources/shared_preferences_foundation/Resources/PrivacyInfo.xcprivacy) for UserDefaults reason; [Apple privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files); [Apple account-deletion review guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/).

No legal/store metadata, signing secret, backend deployment URL, token, employee/visitor personal data or certificate payload appears in this delivery.

## Koordinatörün gerçek native derleme eki

Bu rapor ilk worker tesliminin araç sürümlerini içerir. Son gerçek derlemelerde Flutter minimumlarına uyum için Gradle8.14.3, AGP8.11.1, Kotlin2.2.21 ve iOS15.0 pinleri kullanıldı. Son yetkili [araç zinciri](../../../mobile/release/toolchain.json) ve [doğrulama kaydı](../final-verification.json) bu eski checkpointi tamamlar. Android unsigned, iOS simulator/no-sign derlemeleri ve XCTest2/2 başarılıdır; dağıtım imzası ve gerçek16KB runtime hâlâ dış kapıdır.
