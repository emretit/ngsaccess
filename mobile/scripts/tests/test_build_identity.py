"""Exercise the real wrapper using an isolated fake SDK; never invokes Flutter."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


MOBILE = Path(__file__).resolve().parents[2]


class BuildIdentityTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        (self.root / 'scripts').mkdir()
        (self.root / 'release').mkdir()
        shutil.copyfile(MOBILE / 'scripts/build_mobile.sh', self.root / 'scripts/build_mobile.sh')
        # Deliberately bypass unrelated native/signing/config checks in this isolated
        # fixture. The real production preflight remains unchanged and runs first.
        (self.root / 'scripts/release_preflight.py').write_text('pass\n')
        (self.root / 'scripts/build_receipt.py').write_text('pass\n')
        self.pubspec = self.root / 'pubspec.yaml'
        self.pubspec.write_text('name: fixture\nversion: 7.8.9+123\n')
        self.pin = json.loads((MOBILE / 'release/toolchain.json').read_text())
        (self.root / 'release/toolchain.json').write_text(json.dumps(self.pin))
        sdk = self.root / 'fake-sdk'
        (sdk / 'bin/cache').mkdir(parents=True)
        self.metadata = sdk / 'bin/cache/flutter.version.json'
        self.metadata.write_text(json.dumps({
            'frameworkVersion': self.pin['flutter'], 'dartSdkVersion': self.pin['dart']}))
        executable = sdk / 'bin/flutter'
        executable.write_text(
            '#!' + sys.executable + '\n'
            'import json, os, sys\n'
            'from pathlib import Path\n'
            'if any(arg.startswith("--dart-define=FLUTTER_VERSION=") for arg in sys.argv[1:]): sys.exit(2)\n'
            'Path(os.environ["FIXTURE_ARGS"]).write_text(json.dumps(sys.argv[1:]))\n')
        executable.chmod(0o700)
        self.args = self.root / 'flutter-args.json'
        self.env = dict(os.environ, PATH=str(sdk / 'bin') + os.pathsep + os.environ['PATH'],
                        APP_ENV='production', CONVEX_URL='https://fixture.invalid',
                        CONVEX_ALLOWED_HOST='fixture.invalid', FIXTURE_ARGS=str(self.args),
                        APP_VERSION='untrusted-env-marker', BUILD_NUMBER='untrusted-env-marker',
                        NGS_FLUTTER_VERSION='untrusted-env-marker',
                        ANDROID_KEYSTORE_PASSWORD='sensitive-fixture-password')

    def run_wrapper(self, mode='run'):
        return subprocess.run(['bash', str(self.root / 'scripts/build_mobile.sh'), mode],
                              env=self.env, text=True, capture_output=True, check=False)

    def assert_rejected(self):
        result = self.run_wrapper()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.args.exists(), 'Invalid identity must never reach the fake build')
        self.assertNotIn('sensitive-fixture-password', result.stdout + result.stderr)
        self.assertNotIn('private-input-marker', result.stdout + result.stderr)
        self.assertNotIn('Traceback', result.stderr)

    def test_defines_use_pubspec_and_installed_pin_instead_of_environment_overrides(self):
        result = self.run_wrapper()
        self.assertEqual(result.returncode, 0, result.stderr)
        args = json.loads(self.args.read_text())
        for flag in ['--dart-define=APP_VERSION=7.8.9', '--dart-define=BUILD_NUMBER=123',
                     '--dart-define=NGS_FLUTTER_VERSION=' + self.pin['flutter']]:
            self.assertIn(flag, args)
        self.assertNotIn('untrusted-env-marker', ' '.join(args))
        self.assertNotIn('sensitive-fixture-password', result.stdout + result.stderr + ' '.join(args))

    def test_actual_checkout_pubspec_version_and_build_are_forwarded(self):
        self.pubspec.write_text((MOBILE / 'pubspec.yaml').read_text())
        result = self.run_wrapper()
        self.assertEqual(result.returncode, 0, result.stderr)
        declaration = next(line for line in self.pubspec.read_text().splitlines()
                           if line.startswith('version:')).split(':', 1)[1].strip()
        version, build = declaration.split('+')
        args = json.loads(self.args.read_text())
        self.assertIn('--dart-define=APP_VERSION=' + version, args)
        self.assertIn('--dart-define=BUILD_NUMBER=' + build, args)

    def test_unsigned_release_also_gets_real_identity(self):
        result = self.run_wrapper('android-unsigned')
        self.assertEqual(result.returncode, 0, result.stderr)
        args = json.loads(self.args.read_text())
        self.assertEqual(args[:3], ['build', 'apk', '--release'])
        self.assertIn('--dart-define=APP_VERSION=7.8.9', args)

    def test_missing_sdk_metadata_fails_before_build(self):
        self.metadata.unlink()
        self.assert_rejected()

    def test_wrong_flutter_or_dart_pin_fails_before_build(self):
        for field in ['frameworkVersion', 'dartSdkVersion']:
            with self.subTest(field=field):
                metadata = {'frameworkVersion': self.pin['flutter'], 'dartSdkVersion': self.pin['dart']}
                metadata[field] = '0.0.0'
                self.metadata.write_text(json.dumps(metadata))
                self.assert_rejected()

    def test_invalid_sdk_json_and_untrusted_value_fail_without_echo(self):
        for metadata in ['not-json-private-input-marker', '[]', 'null',
                         '{"frameworkVersion":"private-input-marker","dartSdkVersion":""}']:
            with self.subTest(metadata=metadata):
                self.metadata.write_text(metadata)
                self.assert_rejected()

    def test_missing_duplicate_or_injected_pubspec_identity_is_rejected(self):
        for content in ['name: fixture\n', 'version: 1.2.3\n', 'version: 1.2.3+0\n',
                        'version: 1.2.3+4\nversion: private-input-marker\n',
                        'version: 1.2.3+4$(private-input-marker)\n']:
            with self.subTest(content=content):
                self.pubspec.write_text(content)
                self.assert_rejected()


if __name__ == '__main__':
    unittest.main()
