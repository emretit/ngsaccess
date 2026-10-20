# Mobile release procedure

Status: release tooling is implemented; distribution and device acceptance still require actual results. This procedure does not authorize store upload, backend deployment, production mutation or a replacement signing identity.

## Automated preparation

Run `scripts/build_mobile.sh` from mobile/ with APP_ENV/CONVEX_URL/CONVEX_ALLOWED_HOST set to the approved environment. Run `python3 scripts/release_preflight.py sources` before native work. Exact toolchain expectations live in toolchain.json. The script checks the supplied Flutter3.47.2/Dart3.13.2 pin; use `python3 scripts/check_apple_tools.py` to check selected Xcode27. CI installs CocoaPods1.16.2 for Flutter fallback. SDK patch and runner image compatibility still need recorded clean-build evidence.

Android Gradle release uses an upload config loaded from environment/ignored key.properties and never selects debug signing. Normal release fails with missing signing. The `android-unsigned` wrapper sets `ORG_GRADLE_PROJECT_ngsUnsignedRelease=true` only in that command's environment. For final upload preparation use `android-release`: upload-key preflight, release AAB, bundletool validation, expected SHA-256 signer, existing application ID, targetAPI36, merged manifest permission/backup check, arm64, 64-bit ELF LOAD segments16KB (32-bit LOAD minimum4KB), and PAGE_ALIGNMENT_16K. AAB ZIP alignment is not the same thing as a generated APK installation test: inspect Play/bundletool-generated APKs and run on a16KB device/emulator too. `android-apk --signed` can verify an APK using the expected appropriate signer fingerprint.

iOS `ios-archive` requires IOS_TEAM_ID and IOS_PROFILE_PATH for an unexpired App Store profile for the exact existing bundle ID, without get-task-allow/device-limited/ad-hoc/enterprise privileges. A matching Apple Distribution identity must be installed. The generated ExportOptions.plist uses `destination=export` and `method=app-store-connect`; no upload occurs. Archive structure/signature is checked separately because an archive may be development signed; exported IPA must pass the distribution profile, signed app identity and non-debug entitlement checks. PrivacyInfo.xcprivacy must ship in the app bundle and no unused gallery declaration or `.env` may ship. Verify all plugin privacy resources in the Xcode privacy report; the source manifest only declares the app's UserDefaults reason CA92.1 and no tracking, without inventing backend collection/privacy labels.

## Pending native commands (coordinator owns SDK lock during parallel development)

These commands are documented for the SDK owner; the platform worker did not run them. Run sequentially, from mobile/, after all source owners finish:

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

Flutter manages SwiftPM/fallback resolution during native builds. If it reports CocoaPods regeneration is needed, first generate the pinned Flutter config and then resolve the fallback graph:

```sh
flutter build ios --config-only --no-codesign --no-pub --dart-define=APP_ENV=staging --dart-define=CONVEX_URL=https://your-staging-deployment.convex.cloud --dart-define=CONVEX_ALLOWED_HOST=your-staging-deployment.convex.cloud
(cd ios && pod install)
git diff -- ios/Podfile.lock ios/Runner.xcodeproj/project.pbxproj
(cd ios && pod install --deployment)
```

Replace placeholder host values before invoking. Review actual SwiftPM-generated/fallback graph; never hand-edit a lock to look current. Review plugin registrant diffs from `flutter pub get`, including unsupported desktop generated files, without claiming desktop QA. Re-run `flutter pub get --enforce-lockfile` and supported platform builds after the graph is accepted and require no unexpected lock/project changes. Do not delete working native files or switch the global Flutter SwiftPM flag to make a stale lock appear consistent. macOS native restore/build is deferred unless product support is explicitly expanded; its old Podfile.lock is not evidence of supported mobile failure.

For native regression tests on the available authorized simulator, select its actual UDID (do not commit device identifiers) and run:

```sh
xcodebuild test -workspace ios/Runner.xcworkspace -scheme Runner -configuration Debug -destination 'platform=iOS Simulator,id=<selected-simulator-udid>' CODE_SIGNING_ALLOWED=NO
```

RunnerTests checks the application camera/gallery and packaged privacy resource. It has not run in the platform worker. This is not a camera permission/physical panel E2E.

Once the release owner supplies approved credentials and tools, run:

```sh
python3 scripts/release_preflight.py android-signing
scripts/build_mobile.sh android-release
python3 scripts/release_preflight.py ios-signing
scripts/build_mobile.sh ios-archive
```

Do not run these with fake credentials or replace the current upload/team identity. Version1.0.4+1 is preserved; the owner must determine a monotonic build/version against store history before preparing an actual upload. No store history is available in this checkout. Environment host provenance in a receipt describes build inputs; pair it with the matching artifact hash and runtime network QA, not a different/stale binary.

## Device and operational evidence required

Record platform/OS, app version/build, artifact hash, approved environment reference, test date and outcome without real account/card/token payloads:

- Android upgrade from approved installed release; distinguish Play App Signing cert from upload cert. Verify final merged permissions, optional camera, no backup/transfer of session state and runtime package version.
- Android16/API36 and16KB emulator/device: install generated APK, cold start, auth, camera/scanner/native plugin registration and background/foreground. Test lowest supported Android version too.
- iPhone/iPad: first camera grant/refusal/permanent denial, Settings return, cold launch/deep link, background/foreground, runtime version and keychain error/logout/relaunch. Validate exported distribution package via authorized test distribution separately.
- Session revocation/offline logout/account switch, HTTP560 business/auth handling, history time boundaries/cursor completeness and mutation response-loss/replay behavior with isolated test data.
- Reader/panel test: challenge consumption/expiry, authorized and denied targets, command acknowledgement vs physical door/passage and official attendance. Record manufacturer/firmware and independent physical observation.
- TR/EN, VoiceOver/TalkBack,200% text and small/landscape viewports; first launch without font network/cache. Supported targets use platform system typography, not a runtime Google Fonts fetch.
- Synthetic production-like error shows safe build/operation/stack context without planted sensitive markers. Remote telemetry/data retention is a separately chosen operational capability.

## CI/signing infrastructure

The protected `mobile-release` GitHub environment needs secret names ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD, and variables MOBILE_CONVEX_URL, MOBILE_CONVEX_ALLOWED_HOST, ANDROID_EXPECTED_CERT_SHA256, BUNDLETOOL_1_18_2_SHA256. The checksum must be independently approved for the official fixed Google1.18.2 jar; none is invented here. Protect the workflow environment and default branch with appropriate organization review rules. CI availability and branch protection are external configuration; this code does not prove they are enabled. The macOS runner must actually provide selected Xcode27 or its job fails explicitly.

Store metadata, privacy policy/support URLs, account deletion requirements, organizational distribution choice, reviewer account/demo guidance and data safety labels remain owner-reviewed inputs in store-review-template.md. Employee accounts are administrator provisioned; do not infer a store account-deletion exemption solely from absence of a public signup screen. No real contacts, legal policy, review credentials or approval checkboxes were fabricated.

## Private support reports and release symbols

Profile → Help & Support → Technical support report copies versioned JSON only after a user taps Copy. It contains bounded safe technical events and build identity, without account/request/response/QR data; no automatic network upload or telemetry provider is configured. Clear local log empties memory, leaving previously copied clipboard content alone. Process termination loses this log; this is not persistent fatal-crash reporting. Users should share the clipboard report only through their organization's established support process.

The build wrapper reads the version/build from pubspec.yaml and Flutter version from the installed pinned SDK metadata after toolchain preflight, validates numeric identity and passes APP_VERSION, BUILD_NUMBER and NGS_FLUTTER_VERSION to Dart. Direct Flutter commands that omit those defines report unknown metadata. Support reports preserve only bounded canonical AOT headers, hex build IDs/PC addresses and Dart snapshot offsets for symbolication; arbitrary native paths, symbols, process/thread names and exception text are dropped.

Before another build overwrites outputs, the release owner must retain a private immutable set for each exact distributed artifact SHA-256:

- Android: the AAB from `build/app/outputs/bundle/release/app-release.aab`, `build/release-evidence/android-release.json`, the corresponding pubspec version/build and the entire `build/symbols/android/` directory generated by `android-release`.
- iOS: the exported `build/ios/ipa/*.ipa`, `build/release-evidence/ios-archive.json`, `build/symbols/ios/`, and the complete `build/ios/archive/Runner.xcarchive` including its `dSYMs/` directory. Keep the archive's native symbol association as well as the Dart symbol files.

Store these in an access-controlled release vault under artifact hash + platform + version/build + ABI, with the actual symbol build ID where available. Never commit symbols/dSYMs, publish them with public CI evidence, attach them to user reports, or substitute files from a rebuild bearing the same version. Keep them for every supported distributed build and dispose only under the organization's release retention policy; a retention duration has not been invented here. Existing CI evidence upload does not automatically archive private symbols: the owner must arrange and verify vault retention.

For a selected event in a copied `support.json`, extract that event's `stack` strings into a UTF-8 `stack.txt`, preserving order and line breaks. Choose the symbol file matching its exact artifact, platform and architecture; for Android arm64, the generated filename is `app.android-arm64.symbols`. On the SDK owner's machine, use:

```sh
flutter symbolize -i stack.txt -d /private/release-vault/exact-artifact/android/app.android-arm64.symbols
```

Use the matching iOS ABI symbol file from `build/symbols/ios/` for an iOS Dart stack; native Apple crashes separately require the matching archive/dSYMs. Flutter documents the matching-symbol requirement and command in [Obfuscate Dart code](https://docs.flutter.dev/deployment/obfuscate). A controlled production-like error on each actual release target must still prove copy → sensitive-marker exclusion → matching-symbol recovery, alongside a separate native crash/archive check. Source fixtures and local unit tests do not establish that physical release gate.
