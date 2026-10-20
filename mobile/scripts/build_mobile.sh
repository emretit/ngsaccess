#!/usr/bin/env bash
# Never enable shell tracing: environment and signing values must stay private.
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:-}"
case "$mode" in
  run|android-unsigned|android-release|ios-simulator|ios-nosign|ios-archive) ;;
  *) echo 'Usage: scripts/build_mobile.sh run|android-unsigned|android-release|ios-simulator|ios-nosign|ios-archive' >&2; exit 2 ;;
esac
python3 scripts/release_preflight.py config
python3 scripts/release_preflight.py sources
python3 scripts/release_preflight.py toolchain
# Read public identity from the same installed SDK checked above and pubspec,
# never caller-supplied identity overrides. Validate before shell interpolation.
build_identity=$(python3 - <<'PY'
import json
from pathlib import Path
import re
import shutil
import sys

def fail():
    raise SystemExit('Build identity is missing, invalid or does not match the pinned SDK.')

try:
    pubspec = Path('pubspec.yaml').read_text()
    versions = re.findall(r'^version:[ \t]*([0-9]{1,6}\.[0-9]{1,6}\.[0-9]{1,6})\+([1-9][0-9]{0,8})[ \t]*$',
                          pubspec, re.MULTILINE)
    if len(versions) != 1 or len(re.findall(r'^version:', pubspec, re.MULTILINE)) != 1:
        fail()
    app_version, build_number = versions[0]
    executable = shutil.which('flutter')
    if executable is None:
        fail()
    sdk = Path(executable).resolve().parent.parent
    installed = json.loads((sdk / 'bin/cache/flutter.version.json').read_text())
    pin = json.loads(Path('release/toolchain.json').read_text())
    if not isinstance(installed, dict) or not isinstance(pin, dict):
        fail()
    flutter_version = installed.get('frameworkVersion')
    dart_version = installed.get('dartSdkVersion')
    if (not isinstance(flutter_version, str) or
            re.fullmatch(r'[0-9]{1,6}\.[0-9]{1,6}\.[0-9]{1,6}', flutter_version) is None or
            flutter_version != pin.get('flutter') or not isinstance(dart_version, str) or
            dart_version.split()[0] != pin.get('dart')):
        fail()
except (OSError, ValueError, TypeError, IndexError, KeyError):
    fail()
sys.stdout.write(f'{app_version} {build_number} {flutter_version}')
PY
)
IFS=' ' read -r app_version build_number flutter_version <<< "$build_identity"
build_flags=(--no-pub "--dart-define=APP_ENV=${APP_ENV}" "--dart-define=CONVEX_URL=${CONVEX_URL}" "--dart-define=CONVEX_ALLOWED_HOST=${CONVEX_ALLOWED_HOST}" "--dart-define=APP_VERSION=${app_version}" "--dart-define=BUILD_NUMBER=${build_number}" "--dart-define=NGS_FLUTTER_VERSION=${flutter_version}")
case "$mode" in
  run) flutter run "${build_flags[@]}" ;;
  android-unsigned)
    # The Gradle opt-in is scoped to this process, never persisted in gradle.properties.
    ORG_GRADLE_PROJECT_ngsUnsignedRelease=true flutter build apk --release "${build_flags[@]}"
    python3 scripts/release_preflight.py android-apk --artifact build/app/outputs/flutter-apk/app-release.apk
    ;;
  android-release)
    # Reject a compile-only property inherited from a CI job or local shell.
    unset ORG_GRADLE_PROJECT_ngsUnsignedRelease
    python3 scripts/release_preflight.py android-signing
    flutter build appbundle --release "${build_flags[@]}" --obfuscate --split-debug-info=build/symbols/android
    python3 scripts/release_preflight.py android-aab --artifact build/app/outputs/bundle/release/app-release.aab
    ;;
  ios-simulator) flutter build ios --simulator --debug "${build_flags[@]}" ;;
  ios-nosign) flutter build ios --release --no-codesign "${build_flags[@]}" ;;
  ios-archive)
    python3 scripts/check_apple_tools.py
    python3 scripts/release_preflight.py ios-export-options --output release/ExportOptions.plist
    flutter build ipa --release "${build_flags[@]}" --obfuscate --split-debug-info=build/symbols/ios --export-options-plist=release/ExportOptions.plist
    python3 scripts/release_preflight.py ios-archive --artifact build/ios/archive/Runner.xcarchive
    shopt -s nullglob
    exported_ipas=(build/ios/ipa/*.ipa)
    if [[ ${#exported_ipas[@]} -ne 1 ]]; then
      echo 'Expected one exported distribution IPA.' >&2; exit 1
    fi
    python3 scripts/release_preflight.py ios-ipa --artifact "${exported_ipas[0]}"
    ;;
esac
mkdir -p build/release-evidence
# Records only public config hashes, source/build identity, and artifact hashes.
python3 scripts/build_receipt.py "$mode"
