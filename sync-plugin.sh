#!/usr/bin/env bash
# Sync built plugin artifacts to the Paperclip plugins directory.
# Run after `pnpm build` to make the new version visible to the container.
set -euo pipefail

CLIPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOTPAPERCLIP="${PAPERCLIP_DOTPAPERCLIP_HOST:-/Users/alex/.paperclip-playground/data/paperclip/.paperclip}"
PLUGIN_DIR="$DOTPAPERCLIP/plugins/@yesterday-ai/plugin-paperclip-company-wizard"

mkdir -p "$PLUGIN_DIR"
rsync -a --delete "$CLIPPER_DIR/dist/"      "$PLUGIN_DIR/dist/"
rsync -a --delete "$CLIPPER_DIR/templates/" "$PLUGIN_DIR/templates/"
cp "$CLIPPER_DIR/package.json"              "$PLUGIN_DIR/package.json"

echo "Synced to $PLUGIN_DIR"

# Update manifest_json and reset status in DB so the server picks up schema changes on next restart
MANIFEST_JSON=$(node --input-type=module -e "
import manifest from '$CLIPPER_DIR/dist/manifest.js';
process.stdout.write(JSON.stringify(manifest));
" 2>/dev/null || echo "")

if [ -n "$MANIFEST_JSON" ]; then
  docker exec paperclip-db-1 psql -U paperclip -d paperclip \
    -c "UPDATE plugins SET manifest_json = '$MANIFEST_JSON'::jsonb, package_name='@yesterday-ai/plugin-paperclip-company-wizard', status='ready', last_error=NULL, updated_at=now() WHERE plugin_key='yesterday-ai.plugin-paperclip-company-wizard';" \
    2>/dev/null && echo "DB manifest + status updated" || echo "DB update skipped (container not running?)"
else
  docker exec paperclip-db-1 psql -U paperclip -d paperclip \
    -c "UPDATE plugins SET status='ready', last_error=NULL WHERE plugin_key='yesterday-ai.plugin-paperclip-company-wizard';" \
    2>/dev/null && echo "DB status reset to ready" || echo "DB reset skipped (container not running?)"
fi
