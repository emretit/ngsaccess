#!/usr/bin/env python3
"""Build provenance without dumping environment, account data or signing inputs."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from release_preflight import ROOT, config

mode = sys.argv[1]
artifacts = {
    'android-unsigned': list((ROOT / 'build/app/outputs/flutter-apk').glob('app-release.apk')),
    'android-release': list((ROOT / 'build/app/outputs/bundle/release').glob('*.aab')),
    'ios-archive': list((ROOT / 'build/ios/ipa').glob('*.ipa')),
}.get(mode, [])
receipt = {'mode': mode, **config(os.environ), 'storeReadiness': 'requires-owner-and-device-validation'}
receipt['toolchain'] = json.loads((ROOT / 'release/toolchain.json').read_text())
revision = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True)
status = subprocess.run(['git', 'status', '--porcelain', '--untracked-files=normal', '--', 'mobile'], cwd=ROOT.parent, capture_output=True, text=True)
receipt['sourceDirty'] = bool(status.stdout.strip()) if status.returncode == 0 else None
receipt['revision'] = revision.stdout.strip() if revision.returncode == 0 else 'unavailable'
receipt['artifacts'] = [{'name': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in artifacts]
receipt['pubspecLockSha256'] = hashlib.sha256((ROOT / 'pubspec.lock').read_bytes()).hexdigest()
output = ROOT / 'build/release-evidence' / (mode + '.json')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n')
print('Build provenance written; distribution approval remains separate.')
