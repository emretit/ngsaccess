import datetime as dt
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import release_preflight as check


class ToolchainTests(unittest.TestCase):
    def test_checked_in_native_versions_match_release_pin(self):
        pin = json.loads((check.ROOT / 'release/toolchain.json').read_text())
        check.check_project_toolchain(pin)

    def test_old_wrapper_or_plugin_is_rejected_before_starting_gradle(self):
        pin = json.loads((check.ROOT / 'release/toolchain.json').read_text())
        for field, value in [('gradle', '8.12'), ('androidGradlePlugin', '8.10.1'),
                             ('kotlin', '2.1.0')]:
            with self.subTest(field=field), self.assertRaises(check.PreflightError):
                check.check_project_toolchain({**pin, field: value})


class PublicConfigTests(unittest.TestCase):
    def setUp(self):
        self.valid = {'APP_ENV': 'staging', 'CONVEX_URL': 'https://staging.company.test',
                      'CONVEX_ALLOWED_HOST': 'staging.company.test'}

    def test_approved_https_environment_returns_only_host_digest(self):
        result = check.config(self.valid)
        self.assertEqual(result['environment'], 'staging')
        self.assertEqual(len(result['backendHostSha256']), 64)
        self.assertNotIn('company.test', str(result))

    def test_unapproved_or_credential_bearing_urls_fail_before_build(self):
        urls = ['', 'http://staging.company.test', 'https://evil.test',
                'https://staging.company.test.evil.test', 'https://secret@staging.company.test',
                'https://staging.company.test/?token=secret', 'https://staging.company.test/api',
                'https://staging.company.test:444', 'https://staging.company.test/#secret',
                'https://staging.company.test:bad', 'https://staging.company.test\n']
        for url in urls:
            with self.subTest(url=url), self.assertRaises(check.PreflightError):
                check.config({**self.valid, 'CONVEX_URL': url})

    def test_missing_or_arbitrary_environment_is_rejected(self):
        for environment in ['', 'development', 'prod']:
            with self.subTest(environment=environment), self.assertRaises(check.PreflightError):
                check.config({**self.valid, 'APP_ENV': environment})

    def test_error_output_does_not_print_sensitive_input_or_native_stderr(self):
        failure = subprocess.CompletedProcess(['tool'], 1, b'', b'synthetic-private-marker')
        with patch.object(check.subprocess, 'run', return_value=failure):
            with self.assertRaises(check.PreflightError) as result:
                check.run(['tool'])
        self.assertNotIn('synthetic-private-marker', str(result.exception))


class PermissionAndSigningTests(unittest.TestCase):
    def manifest(self, additional='', app='android:allowBackup="false"'):
        return f'''<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="{check.ANDROID_ID}">
        <uses-permission android:name="android.permission.CAMERA"/>{additional}<application {app}/></manifest>'''

    def test_unused_permission_from_transitive_manifest_is_rejected(self):
        for permission in check.FORBIDDEN_PERMISSIONS:
            with self.subTest(permission=permission), self.assertRaises(check.PreflightError):
                check.permissions(self.manifest(f'<uses-permission android:name="{permission}"/>'))

    def test_release_must_disable_backup_and_debugging(self):
        for app in ['', 'android:allowBackup="true"', 'android:allowBackup="false" android:debuggable="true"']:
            with self.subTest(app=app), self.assertRaises(check.PreflightError):
                check.permissions(self.manifest(app=app))
        self.assertIn('android.permission.CAMERA', check.permissions(self.manifest()))

    def test_missing_credentials_fail_closed_without_local_property_file(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(check, 'ROOT', Path(directory)):
            with self.assertRaises(check.PreflightError):
                check.signing_values({})

    def test_debug_alias_cannot_be_used_even_with_complete_credentials(self):
        with tempfile.NamedTemporaryFile() as keystore:
            inputs = {'ANDROID_KEYSTORE_PATH': keystore.name, 'ANDROID_KEYSTORE_PASSWORD': 'synthetic',
                      'ANDROID_KEY_ALIAS': 'AndroidDebugKey', 'ANDROID_KEY_PASSWORD': 'synthetic'}
            with self.assertRaises(check.PreflightError):
                check.signing_values(inputs)

    def test_approved_fingerprint_mismatch_stops_release(self):
        with patch.object(check, 'signing_values', return_value={'ANDROID_KEYSTORE_PATH': '/synthetic', 'ANDROID_KEYSTORE_PASSWORD': 'synthetic', 'ANDROID_KEY_ALIAS': 'upload', 'ANDROID_KEY_PASSWORD': 'synthetic'}), patch.object(check, 'run', return_value='SHA256: ' + '11' * 32):
            with self.assertRaises(check.PreflightError):
                check.android_signing({'ANDROID_EXPECTED_CERT_SHA256': '22' * 32})

    def test_changed_application_identity_and_missing_camera_are_rejected(self):
        for manifest in [self.manifest().replace(check.ANDROID_ID, 'another.application'),
                         self.manifest().replace('android.permission.CAMERA', 'another.permission')]:
            with self.subTest(manifest=manifest), self.assertRaises(check.PreflightError):
                check.permissions(manifest)

    def test_signed_apk_cannot_be_reported_as_unsigned_compile_evidence(self):
        import zipfile
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / 'app.apk'
            analyzer = root / 'cmdline-tools/latest/bin/apkanalyzer'
            analyzer.parent.mkdir(parents=True)
            analyzer.touch()
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('lib/arm64-v8a/libapp.so', NativeArtifactTests.elf(16384))
            badging = "package: name='" + check.ANDROID_ID + "' targetSdkVersion:'36'"
            with patch.dict(check.os.environ, {'ANDROID_HOME': directory}), patch.object(check, 'android_tools', side_effect=lambda name: name), patch.object(check, 'run', side_effect=['', self.manifest(), badging]), patch.object(check.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)):
                with self.assertRaises(check.PreflightError):
                    check.android_artifact(artifact, False, {})

    def test_private_env_asset_inside_native_package_is_rejected(self):
        import zipfile
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'app.apk'
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('assets/flutter_assets/.env', 'synthetic-private-marker')
            with self.assertRaises(check.PreflightError) as failure:
                check.android_artifact(artifact, False, {})
            self.assertNotIn('synthetic-private-marker', str(failure.exception))


class NativeArtifactTests(unittest.TestCase):
    @staticmethod
    def elf(alignment):
        blob = bytearray(120)
        blob[:6] = b'\x7fELF\x02\x01'
        struct.pack_into('<Q', blob, 32, 64)
        struct.pack_into('<HH', blob, 54, 56, 1)
        struct.pack_into('<I', blob, 64, 1)
        struct.pack_into('<Q', blob, 112, alignment)
        return bytes(blob)

    def test_every_native_load_segment_requires_16kb_alignment(self):
        check.elf_alignment(self.elf(16384))
        with self.assertRaises(check.PreflightError):
            check.elf_alignment(self.elf(4096))

    def test_32bit_library_uses_4kb_minimum_without_weakening_64bit_validation(self):
        blob = bytearray(84)
        blob[:6] = b'\x7fELF\x01\x01'
        struct.pack_into('<I', blob, 28, 52)
        struct.pack_into('<HH', blob, 42, 32, 1)
        struct.pack_into('<I', blob, 52, 1)
        struct.pack_into('<I', blob, 80, 4096)
        check.elf_alignment(bytes(blob))
        struct.pack_into('<I', blob, 80, 1024)
        with self.assertRaises(check.PreflightError):
            check.elf_alignment(bytes(blob))
        with self.assertRaises(check.PreflightError):
            check.elf_alignment(self.elf(4096))

    def profile(self):
        return {'ExpirationDate': dt.datetime.now() + dt.timedelta(days=1),
                'TeamIdentifier': ['SYNTHETIC'], 'Entitlements': {
                    'application-identifier': 'SYNTHETIC.' + check.IOS_ID, 'get-task-allow': False}}

    def test_profile_must_be_unexpired_distribution_for_exact_existing_bundle(self):
        check.validate_profile(self.profile(), 'SYNTHETIC')
        alterations = [dict(ExpirationDate=dt.datetime(2000, 1, 1)),
                       dict(TeamIdentifier=['OTHER']), dict(ProvisionedDevices=['synthetic']),
                       dict(ProvisionsAllDevices=True), dict(Entitlements={'application-identifier': 'SYNTHETIC.*', 'get-task-allow': False}),
                       dict(Entitlements={'application-identifier': 'SYNTHETIC.' + check.IOS_ID, 'get-task-allow': True})]
        for alteration in alterations:
            with self.subTest(alteration=alteration), self.assertRaises(check.PreflightError):
                check.validate_profile({**self.profile(), **alteration}, 'SYNTHETIC')

    def test_repository_source_contract(self):
        self.assertEqual(check.sources()['sourcePermissions'], 'passed')


if __name__ == '__main__':
    unittest.main()
