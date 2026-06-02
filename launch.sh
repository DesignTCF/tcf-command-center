#!/bin/bash
# TCF Command Center v2 — Launch Script

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$DIR/server"
CLIENT_DIR="$DIR/client"

# ── Find Node / npm ───────────────────────────────────────────────────────────
NODE=""
NPM=""
for candidate in /usr/local/bin/node /opt/homebrew/bin/node /usr/bin/node \
  "$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | sort -rV | head -1)/bin/node" \
  "$HOME/.volta/bin/node"; do
  if [ -x "$candidate" ]; then
    NODE="$candidate"
    NPM="$(dirname "$candidate")/npm"
    break
  fi
done

if [ -z "$NODE" ]; then
  echo ""
  echo "  ❌  Node.js not found."
  echo "  Install: brew install node  or  https://nodejs.org"
  echo ""
  exit 1
fi

echo ""
echo "  TCF Command Center v2"
echo "  ──────────────────────────────────────"
echo "  Node: $("$NODE" --version)  |  npm: $("$NPM" --version)"
echo ""

# ── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f "$DIR/.env" ]; then
  cp "$DIR/.env.example" "$DIR/.env"
  echo "  Created .env from .env.example — edit it to add API tokens."
fi

# ── Install server dependencies ───────────────────────────────────────────────
if [ ! -d "$SERVER_DIR/node_modules" ]; then
  echo "  Installing server dependencies…"
  cd "$SERVER_DIR" && "$NPM" install --silent
  echo "  ✓ Server ready"
fi

# ── Install client dependencies ───────────────────────────────────────────────
if [ ! -d "$CLIENT_DIR/node_modules" ]; then
  echo "  Installing client dependencies…"
  cd "$CLIENT_DIR" && "$NPM" install --silent
  echo "  ✓ Client ready"
fi

# ── Build client (production) ─────────────────────────────────────────────────
echo "  Building client…"
cd "$CLIENT_DIR" && "$NPM" run build --silent
echo "  ✓ Client built"

# ── Start server ──────────────────────────────────────────────────────────────
echo ""
echo "  Starting server…"
cd "$SERVER_DIR"
"$NODE" index.js &
SERVER_PID=$!
sleep 1.5

# ── Open browser ─────────────────────────────────────────────────────────────
if [ "$(uname)" = "Darwin" ]; then
  open "http://localhost:3001"
fi

echo "  ✓ Open: http://localhost:3001"
echo "  Press Ctrl+C to stop."
echo ""

trap "kill $SERVER_PID 2>/dev/null; exit" INT TERM
wait $SERVER_PID
