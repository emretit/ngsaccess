#!/usr/bin/env python3
"""Fail-closed, secret-safe release checks. Python stdlib only; never reads .env."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ANDROID_ID = 'com.ngsplus.app.ngsplusapp'
IOS_ID = 'com.ngsplus.app'
NS = '{http://schemas.android.com/apk/res/android}'
FORBIDDEN_PERMISSIONS = {'android.permission.WRITE_EXTERNAL_STORAGE',
                         'android.permission.READ_EXTERNAL_STORAGE',
                         'android.permission.READ_MEDIA_IMAGES',
                         'android.permission.READ_MEDIA_VIDEO'}


class PreflightError(Exception):
    """Contains only fixed, non-sensitive diagnostics."""


def require(condition, message):
    if not condition:
        raise PreflightError(message)


def run(args, *, env=None):
    try:
        result = subprocess.run(args, capture_output=True, env=env, timeout=180)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PreflightError('Required release tool unavailable or timed out.') from error
    require(result.returncode == 0, 'Release tool failed; inspect locally without exposing credentials.')
    return result.stdout.decode('utf-8', errors='replace')


def config(values):
    require(values.get('APP_ENV') in ('staging', 'production'), 'APP_ENV must be staging or production.')
    raw = values.get('CONVEX_URL', '')
    allowed = values.get('CONVEX_ALLOWED_HOST', '')
    try:
        uri = urllib.parse.urlsplit(raw)
        valid = (uri.scheme == 'https' and uri.hostname == allowed and
                 len(allowed) <= 253 and all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in allowed.split('.')) and
                 '.' in allowed and not allowed.endswith('.') and
                 uri.port in (None, 443) and not uri.username and not uri.password and
                 uri.path in ('', '/') and not uri.query and not uri.fragment and
                 not any(c.isspace() for c in raw) and '%' not in raw)
    except ValueError:
        valid = False
    require(valid, 'Public backend config must be HTTPS with the exact approved host and no credentials/path/query.')
    require(not any(x in allowed for x in ('your-', 'example.', 'localhost')), 'Replace example backend config before building.')
    return {'environment': values['APP_ENV'], 'backendHostSha256': hashlib.sha256(allowed.encode()).hexdigest()}


def check_toolchain():
    pin = json.loads((ROOT / 'release/toolchain.json').read_text())
    check_project_toolchain(pin)
    installed = json.loads(run(['flutter', '--version', '--machine']))
    require(installed.get('frameworkVersion') == pin['flutter'], 'Flutter SDK does not match release pin.')
    require(installed.get('dartSdkVersion', '').split()[0] == pin['dart'], 'Dart SDK does not match release pin.')
    java = re.search(r'(?:openjdk|java)\s+(\d+)', run(['java', '--version']))
    require(java is not None and int(java.group(1)) == pin['java'], 'Java SDK does not match release pin.')


def check_project_toolchain(pin):
    wrapper = (ROOT / 'android/gradle/wrapper/gradle-wrapper.properties').read_text()
    settings = (ROOT / 'android/settings.gradle.kts').read_text()
    require(f"gradle-{pin['gradle']}-all.zip" in wrapper, 'Gradle wrapper does not match release pin.')
    for plugin, version in [('com.android.application', pin['androidGradlePlugin']),
                            ('org.jetbrains.kotlin.android', pin['kotlin'])]:
        require(bool(re.search(r'id\("' + re.escape(plugin) + r'"\)\s+version\s+"' +
                               re.escape(version) + r'"', settings)),
                'Android build plugin does not match release pin.')


def permissions(manifest):
    tree = ET.fromstring(manifest)
    require(tree.get('package') in (None, ANDROID_ID), 'Android application ID changed.')
    declared = {item.get(NS + 'name') for item in tree.findall('uses-permission')}
    require(not declared.intersection(FORBIDDEN_PERMISSIONS), 'Unused storage/media permission present in manifest.')
    require('android.permission.CAMERA' in declared, 'Camera permission missing.')
    app = tree.find('application')
    require(app is not None and app.get(NS + 'allowBackup') == 'false', 'Session backup must be disabled.')
    if app is not None:
        require(app.get(NS + 'debuggable') != 'true', 'Release artifact is debuggable.')
    return declared


def sources():
    permissions((ROOT / 'android/app/src/main/AndroidManifest.xml').read_text())
    info = plistlib.loads((ROOT / 'ios/Runner/Info.plist').read_bytes())
    require('NSCameraUsageDescription' in info, 'iOS camera description missing.')
    require('NSPhotoLibraryUsageDescription' not in info, 'Unused gallery declaration present.')
    privacy = plistlib.loads((ROOT / 'ios/Runner/PrivacyInfo.xcprivacy').read_bytes())
    require(privacy.get('NSPrivacyTracking') is False, 'Review tracking privacy manifest.')
    pubspec = (ROOT / 'pubspec.yaml').read_text()
    require(not re.search(r'^\s*-\s*\.env\s*$', pubspec, re.M), '.env must not be bundled as an asset.')
    return {'sourcePermissions': 'passed', 'privacyManifestSyntax': 'passed'}


def fingerprint(value):
    result = value.replace(':', '').lower()
    require(bool(re.fullmatch('[0-9a-f]{64}', result)), 'Expected signer SHA-256 must be supplied.')
    return result


def signing_values(values):
    # key.properties is local/ignored; never include its content in diagnostics.
    properties = {}
    file = ROOT / 'android/key.properties'
    if file.is_file():
        for line in file.read_text().splitlines():
            if '=' in line and not line.lstrip().startswith(('#', '!')):
                key, value = line.split('=', 1)
                properties[key.strip()] = value.strip()
    keys = {'ANDROID_KEYSTORE_PATH': 'storeFile', 'ANDROID_KEYSTORE_PASSWORD': 'storePassword',
            'ANDROID_KEY_ALIAS': 'keyAlias', 'ANDROID_KEY_PASSWORD': 'keyPassword'}
    resolved = {key: values.get(key) or properties.get(prop, '') for key, prop in keys.items()}
    require(all(resolved.values()), 'Upload signing inputs missing (environment or android/key.properties).')
    location = Path(resolved['ANDROID_KEYSTORE_PATH']).expanduser()
    if not location.is_absolute():
        location = ROOT / 'android' / location
    require(location.is_file(), 'Upload keystore file missing.')
    require(resolved['ANDROID_KEY_ALIAS'].lower() != 'androiddebugkey', 'Debug signing alias forbidden.')
    resolved['ANDROID_KEYSTORE_PATH'] = str(location)
    return resolved


def android_signing(values):
    signing = signing_values(values)
    expected = fingerprint(values.get('ANDROID_EXPECTED_CERT_SHA256', ''))
    environment = {**os.environ, **signing}
    text = run(['keytool', '-J-Duser.language=en', '-list', '-v', '-keystore',
                signing['ANDROID_KEYSTORE_PATH'], '-alias', signing['ANDROID_KEY_ALIAS'],
                '-storepass:env', 'ANDROID_KEYSTORE_PASSWORD'], env=environment)
    require('android debug' not in text.lower(), 'Debug certificate forbidden.')
    found = re.findall(r'SHA256:\s*([0-9a-fA-F:]{64,95})', text)
    require(found and fingerprint(found[0]) == expected, 'Upload certificate does not match approved fingerprint.')
    return {'approvedUploadCertificate': 'passed'}


def elf_alignment(blob):
    require(blob[:4] == b'\x7fELF' and len(blob) >= 64, 'Invalid native ELF library.')
    byte_order = '<' if blob[5] == 1 else '>'
    is64 = blob[4] == 2
    require(is64 or blob[4] == 1, 'Unknown native ELF class.')
    phoff = struct.unpack_from(byte_order + ('Q' if is64 else 'I'), blob, 32 if is64 else 28)[0]
    entsize, count = struct.unpack_from(byte_order + 'HH', blob, 54 if is64 else 42)
    loads = 0
    for index in range(count):
        offset = phoff + index * entsize
        kind = struct.unpack_from(byte_order + 'I', blob, offset)[0]
        if kind == 1:
            loads += 1
            align = struct.unpack_from(byte_order + ('Q' if is64 else 'I'), blob, offset + (48 if is64 else 28))[0]
            # Android's 16KB runtime/ELF requirement applies to 64-bit ABIs.
            # Keep validating 32-bit ELF structure and its 4KB minimum too.
            require(align >= (16384 if is64 else 4096),
                    'Native library LOAD segment alignment is incompatible with its ELF class.')
    require(loads > 0, 'Native ELF has no LOAD segments.')


def android_tools(name):
    sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    require(bool(sdk), 'Android SDK location missing.')
    pin = json.loads((ROOT / 'release/toolchain.json').read_text())
    path = Path(sdk) / 'build-tools' / pin['androidBuildTools'] / name
    require(path.is_file(), 'Pinned Android build tool missing.')
    return str(path)


def android_artifact(path, signed, values):
    require(path.is_file() and path.suffix == '.apk', 'Artifact check requires an APK built from the same release inputs.')
    with zipfile.ZipFile(path) as archive:
        require(not any(Path(n).name.startswith('.env') for n in archive.namelist()), 'Packaged .env asset forbidden.')
        libraries = [name for name in archive.namelist() if name.endswith('.so')]
        require(any('/arm64-v8a/' in n for n in libraries), '64-bit native libraries missing.')
        for name in libraries:
            elf_alignment(archive.read(name))
    run([android_tools('zipalign'), '-c', '-P', '16', '4', str(path)])
    sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    require(bool(sdk), 'Android SDK location missing.')
    analyzer = Path(sdk) / 'cmdline-tools/latest/bin/apkanalyzer'
    if not analyzer.is_file():
        installed = shutil.which('apkanalyzer')
        if installed is not None:
            analyzer = Path(installed)
    require(analyzer.is_file(), 'Android command-line manifest analyzer missing.')
    xml_manifest = run([str(analyzer), 'manifest', 'print', str(path)])
    permissions(xml_manifest)
    manifest = run([android_tools('aapt2'), 'dump', 'badging', str(path)])
    require(f"package: name='{ANDROID_ID}'" in manifest, 'Artifact package identity mismatch.')
    require("targetSdkVersion:'36'" in manifest, 'Artifact must target Android API36.')
    require(not any(p in manifest for p in FORBIDDEN_PERMISSIONS), 'Artifact contains storage/media permissions.')
    require('application-debuggable' not in manifest, 'Artifact is debuggable.')
    verifier = [android_tools('apksigner'), 'verify', '--print-certs', str(path)]
    if signed:
        result = run(verifier)
        certs = re.findall(r'certificate SHA-256 digest:\s*([a-fA-F0-9]+)', result)
        require(len(certs) == 1 and fingerprint(certs[0]) == fingerprint(values.get('ANDROID_EXPECTED_CERT_SHA256', '')),
                'Artifact signer differs from the approved upload certificate.')
        require('android debug' not in result.lower(), 'Artifact uses debug certificate.')
    else:
        result = subprocess.run(verifier, capture_output=True, timeout=60)
        require(result.returncode != 0, 'Unsigned compile artifact unexpectedly has a signing certificate.')
    return {'androidArtifact': 'signed-verified' if signed else 'unsigned-compile-only',
            'elf16k': 'passed', 'elf16kScope': '64-bit LOAD segments', 'zip16k': 'passed'}


def bundletool(*arguments):
    jar = Path(os.environ.get('BUNDLETOOL_JAR', ''))
    require(jar.is_file(), 'BUNDLETOOL_JAR must reference an approved local bundletool jar.')
    return run(['java', '-jar', str(jar), *arguments])


def android_bundle(path, values):
    require(path.is_file() and path.suffix == '.aab', 'A signed Android App Bundle is required.')
    bundletool('validate', '--bundle=' + str(path))
    manifest = bundletool('dump', 'manifest', '--bundle=' + str(path), '--module=base')
    permissions(manifest)
    tree = ET.fromstring(manifest)
    sdk = tree.find('uses-sdk')
    require(sdk is not None and sdk.get(NS + 'targetSdkVersion') == '36', 'Bundle must target API36.')
    alignment = bundletool('dump', 'config', '--bundle=' + str(path))
    require('PAGE_ALIGNMENT_16K' in alignment, 'Bundle does not request 16KB APK zip alignment.')
    verification = run(['jarsigner', '-J-Duser.language=en', '-verify', str(path)])
    require('jar verified.' in verification and 'unsigned entries' not in verification,
            'Bundle signature is missing or incomplete.')
    certificate = run(['keytool', '-J-Duser.language=en', '-printcert', '-jarfile', str(path)])
    found = re.findall(r'SHA256:\s*([0-9a-fA-F:]{64,95})', certificate)
    require(len(found) == 1 and fingerprint(found[0]) == fingerprint(values.get('ANDROID_EXPECTED_CERT_SHA256', '')),
            'Bundle signer differs from approved upload identity.')
    require('android debug' not in certificate.lower(), 'Debug bundle certificate forbidden.')
    with zipfile.ZipFile(path) as archive:
        require(not any(Path(n).name.startswith('.env') for n in archive.namelist()), 'Packaged .env asset forbidden.')
        libraries = [n for n in archive.namelist() if n.endswith('.so')]
        require(any('/arm64-v8a/' in n for n in libraries), 'Bundle 64-bit native libraries missing.')
        for name in libraries:
            elf_alignment(archive.read(name))
    return {'androidBundle': 'signed-verified', 'elf16k': 'passed', 'bundleZip16k': 'passed'}


def profile_data(path):
    return plistlib.loads(run(['security', 'cms', '-D', '-i', str(path)]).encode())


def validate_profile(profile, team):
    require(profile.get('ExpirationDate', dt.datetime.min) > dt.datetime.now(dt.timezone.utc).replace(tzinfo=None), 'Provisioning profile expired.')
    require(bool(team) and team in profile.get('TeamIdentifier', []), 'Provisioning team mismatch.')
    entitlements = profile.get('Entitlements', {})
    identifier = entitlements.get('application-identifier', '')
    require(identifier == team + '.' + IOS_ID, 'Provisioning profile must match the existing bundle ID exactly.')
    require(entitlements.get('get-task-allow') is False, 'Development provisioning profile forbidden for distribution.')
    require(not profile.get('ProvisionedDevices') and not profile.get('ProvisionsAllDevices'), 'App Store distribution profile required.')


def ios_signing(values):
    team = values.get('IOS_TEAM_ID', '')
    profile = Path(values.get('IOS_PROFILE_PATH', ''))
    require(bool(team) and profile.is_file(), 'iOS distribution team/profile missing.')
    validate_profile(profile_data(profile), team)
    identities = run(['security', 'find-identity', '-v', '-p', 'codesigning'])
    require(re.search(r'"Apple Distribution:[^\n]*\(' + re.escape(team) + r'\)"', identities), 'Matching Apple Distribution identity unavailable.')
    return {'iosDistributionPreflight': 'passed'}


def ios_app(app, values, *, distribution):
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    require(info.get('CFBundleIdentifier') == IOS_ID, 'Apple artifact bundle identity mismatch.')
    require(bool(info.get('CFBundleVersion')) and bool(info.get('CFBundleShortVersionString')), 'Apple build metadata missing.')
    require((app / 'PrivacyInfo.xcprivacy').is_file(), 'Apple artifact privacy manifest missing.')
    require('NSCameraUsageDescription' in info, 'Apple artifact camera description missing.')
    require('NSPhotoLibraryUsageDescription' not in info, 'Apple artifact contains unused gallery declaration.')
    require(not any(p.name.startswith('.env') for p in app.rglob('*')), 'Packaged .env asset forbidden.')
    run(['codesign', '--verify', '--deep', '--strict', str(app)])
    if distribution:
        team = values.get('IOS_TEAM_ID', '')
        validate_profile(profile_data(app / 'embedded.mobileprovision'), team)
        entitlements = plistlib.loads(run(['codesign', '--display', '--entitlements', ':-', str(app)]).encode())
        require(entitlements.get('application-identifier') == team + '.' + IOS_ID,
                'Signed application entitlement identity mismatch.')
        require(entitlements.get('get-task-allow') is False, 'Exported app allows debugging.')


def ios_artifact(path, values):
    apps = list((path / 'Products/Applications').glob('*.app'))
    require(len(apps) == 1, 'A single application archive is required.')
    # Archive may be development-signed before manual distribution export.
    ios_app(apps[0], values, distribution=False)
    return {'iosArchive': 'structure-and-code-signature-verified-export-still-required'}


def ios_ipa(path, values):
    require(path.is_file() and path.suffix == '.ipa', 'Exported IPA is required.')
    with tempfile.TemporaryDirectory() as directory:
        run(['ditto', '-x', '-k', str(path), directory])
        apps = list((Path(directory) / 'Payload').glob('*.app'))
        require(len(apps) == 1, 'Exported IPA must contain a single application.')
        ios_app(apps[0], values, distribution=True)
    return {'iosExport': 'distribution-signature-profile-and-entitlements-verified'}


def export_options(values, output):
    ios_signing(values)
    profile = profile_data(Path(values['IOS_PROFILE_PATH']))
    name = profile.get('Name')
    require(bool(name), 'Provisioning profile name missing.')
    payload = {'method': 'app-store-connect', 'destination': 'export', 'signingStyle': 'manual',
               'teamID': values['IOS_TEAM_ID'], 'signingCertificate': 'Apple Distribution',
               'provisioningProfiles': {IOS_ID: name}, 'uploadSymbols': True,
               'manageAppVersionAndBuildNumber': False}
    output.write_bytes(plistlib.dumps(payload))
    output.chmod(0o600)
    return {'exportOptions': 'generated-locally-no-upload'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('check', choices=['config', 'sources', 'toolchain', 'android-signing', 'android-apk', 'android-aab', 'ios-signing', 'ios-archive', 'ios-ipa', 'ios-export-options'])
    parser.add_argument('--artifact', type=Path)
    parser.add_argument('--signed', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        if args.check == 'config': result = config(os.environ)
        elif args.check == 'sources': result = sources()
        elif args.check == 'toolchain': check_toolchain(); result = {'toolchain': 'passed'}
        elif args.check == 'android-signing': result = android_signing(os.environ)
        elif args.check == 'android-apk': result = android_artifact(args.artifact or Path(''), args.signed, os.environ)
        elif args.check == 'android-aab': result = android_bundle(args.artifact or Path(''), os.environ)
        elif args.check == 'ios-signing': result = ios_signing(os.environ)
        elif args.check == 'ios-archive': result = ios_artifact(args.artifact or Path(''), os.environ)
        elif args.check == 'ios-ipa': result = ios_ipa(args.artifact or Path(''), os.environ)
        else:
            require(args.output is not None, 'Export options output path required.')
            result = export_options(os.environ, args.output)
        print(json.dumps(result, sort_keys=True))
    except PreflightError as error:
        print('Release preflight failed: ' + str(error), file=sys.stderr)
        return 1
    except (ValueError, OSError, KeyError, struct.error, ET.ParseError, zipfile.BadZipFile, plistlib.InvalidFileException):
        # Neither native stderr nor dynamic exception bodies reach CI/report output.
        print('Release preflight failed: required configuration, artifact or tool check did not pass.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
