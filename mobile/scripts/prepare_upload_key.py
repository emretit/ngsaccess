#!/usr/bin/env python3
"""Decode only the explicitly provided CI upload key; never create a signing identity."""
import base64
import os
from pathlib import Path

try:
    encoded = os.environ['ANDROID_KEYSTORE_BASE64']
    if not encoded:
        raise ValueError()
    key = base64.b64decode(encoded, validate=True)
    if not key:
        raise ValueError()
    destination = Path(os.environ['ANDROID_KEYSTORE_PATH'])
    descriptor = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, 'wb') as output:
        output.write(key)
except (KeyError, ValueError, OSError):
    raise SystemExit('Approved CI upload key missing, invalid or destination unavailable.')
print('CI upload key prepared without logging credentials.')
