#!/usr/bin/env bash
# AtlasLM T10b - site-wide punctuation gate. Fails the build if any
# non-human punctuation reaches the frontend. Wire into CI after lint.
set -euo pipefail
python3 tools/humanize_punctuation.py --check
