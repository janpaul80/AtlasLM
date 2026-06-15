#!/bin/sh
# AtlasLM Patch 007 CI gate: provider name leak audit.
# Promotes the Patch 006 T11 manual grep into a standing build/log check.
# Run after a full chat + studio + ingestion smoke run, against docker logs.
# Usage: docker compose logs --no-color | sh check_provider_leak.sh
PATTERN='langdock\|openrouter\|openai\|anthropic\|gemini\|api\.openai\|googleapis'
# Read logs from stdin; ignore the harmless compose 'version is obsolete' line.
MATCHES=$(grep -i "$PATTERN" 2>/dev/null | grep -v 'attribute .version. is obsolete' || true)
if [ -n "$MATCHES" ]; then
  echo "PROVIDER LEAK DETECTED in logs:"
  echo "$MATCHES"
  exit 1
fi
echo "Provider leak audit passed. No provider or gateway names found in logs."
exit 0
