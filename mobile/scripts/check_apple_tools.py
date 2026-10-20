#!/usr/bin/env python3
import json
import re
from release_preflight import ROOT, PreflightError, require, run

try:
    pin = json.loads((ROOT / 'release/toolchain.json').read_text())
    version = run(['xcodebuild', '-version'])
    require(re.search(r'^Xcode ' + str(pin['xcodeMajor']) + r'\.', version, re.M),
            'Selected Xcode does not match the release toolchain; select the approved Xcode in CI.')
    print('Selected Xcode matches the release toolchain.')
except PreflightError as error:
    raise SystemExit(str(error))
