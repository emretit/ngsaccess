#!/usr/bin/env python3
"""Catalog parity check; Flutter gen-l10n + git diff verifies generated code separately."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'lib/l10n'
tr = json.loads((root / 'app_tr.arb').read_text())
en = json.loads((root / 'app_en.arb').read_text())
keys = lambda catalog: {key for key in catalog if not key.startswith('@')}
if keys(tr) != keys(en):
    raise SystemExit('TR/EN catalog message keys differ.')
for key in keys(tr):
    placeholders = lambda catalog: {name: item.get('type') for name, item in catalog.get('@' + key, {}).get('placeholders', {}).items()}
    if placeholders(tr) != placeholders(en):
        raise SystemExit('TR/EN placeholder names or types differ.')
print('TR/EN catalog key and placeholder parity passed.')
