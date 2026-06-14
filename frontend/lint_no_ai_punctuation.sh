#!/usr/bin/env bash
# ============================================================
# PATCH 006: CI lint. Fails the build if user-visible strings
# contain em dashes, en dashes, or ellipsis characters.
# Wire into CI before the frontend build step:
#   bash scripts/lint_no_ai_punctuation.sh
# ============================================================
set -u
FAIL=0
PATTERN="—|–|…"

check() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    return
  fi
  local matches
  matches=$(find "$dir" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" -o -name "*.html" \) \
      ! -path "*/node_modules/*" ! -path "*/.next/*" \
      -exec grep -HnE "$PATTERN" {} + 2>/dev/null)
  if [ -n "$matches" ]; then
    echo "PUNCTUATION LINT FAILED in $dir:"
    echo "$matches"
    FAIL=1
  fi
}

# If frontend directory exists (run from root), check it.
# Otherwise, if we are in the frontend container, the current directory is the frontend source.
if [ -d "frontend" ]; then
  check frontend
else
  # We are likely inside the frontend container /workspace
  # Check current directory
  check .
fi

# Check backend/app if it exists (only from root)
if [ -d "backend/app" ]; then
  matches=$(find backend/app -type f -name "*.py" -exec grep -HnE "$PATTERN" {} + 2>/dev/null)
  if [ -n "$matches" ]; then
    echo "PUNCTUATION LINT FAILED in backend/app:"
    echo "$matches"
    FAIL=1
  fi
fi

if [ "$FAIL" -eq 0 ]; then
  echo "Punctuation lint passed. No em dashes, en dashes, or ellipses found."
fi
exit $FAIL
