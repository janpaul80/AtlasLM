#!/usr/bin/env bash
# ============================================================
# PATCH 006: CI lint. Fails the build if user-visible strings
# contain em dashes, en dashes, or ellipsis characters.
# Wire into CI before the frontend build step:
#   bash scripts/lint_no_ai_punctuation.sh
# ============================================================
set -u
FAIL=0
PATTERN=$'\u2014|\u2013|\u2026'

check() {
  local dir="$1"; shift
  local matches
  matches=$(grep -rnE "$PATTERN" "$dir" \
      --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js' --include='*.html' \
      --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null)
  if [ -n "$matches" ]; then
    echo "PUNCTUATION LINT FAILED in $dir:"
    echo "$matches"
    FAIL=1
  fi
}

check frontend
# backend user-facing strings (error messages, canned phrases)
matches=$(grep -rnE "$PATTERN" backend/app --include='*.py' 2>/dev/null)
if [ -n "$matches" ]; then
  echo "PUNCTUATION LINT FAILED in backend/app:"
  echo "$matches"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "Punctuation lint passed. No em dashes, en dashes, or ellipses found."
fi
exit $FAIL
