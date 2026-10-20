#!/usr/bin/env python3
"""Download a fixed Google release only when its approved SHA-256 is configured."""
import hashlib
import os
from pathlib import Path
import re
import urllib.request

expected = os.environ.get('BUNDLETOOL_SHA256', '').lower()
if not re.fullmatch(r'[a-f0-9]{64}', expected):
    raise SystemExit('Owner-approved bundletool 1.18.2 SHA-256 missing.')
try:
    with urllib.request.urlopen('https://github.com/google/bundletool/releases/download/1.18.2/bundletool-all-1.18.2.jar', timeout=120) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError()
    Path(os.environ['BUNDLETOOL_JAR']).write_bytes(data)
except (OSError, ValueError, KeyError):
    raise SystemExit('Pinned bundletool download or checksum verification failed.')
print('Approved bundletool checksum verified.')
