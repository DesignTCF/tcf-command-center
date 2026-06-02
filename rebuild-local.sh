#!/bin/bash
# Quick rebuild for local preview — run this any time client-dist is missing
export PATH=/tmp/node-v20.15.0-darwin-arm64/bin:$PATH
BASE="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE/server" && npm install --silent 2>/dev/null
cd "$BASE/client" && npm install --silent 2>/dev/null && npm run build
echo "✓ Ready — restart the preview server"
