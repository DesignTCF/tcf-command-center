#!/bin/bash
# Runs once when Codespace is first created
set -e

echo ""
echo "════════════════════════════════════════"
echo "  TCF Command Center — Codespace Setup"
echo "════════════════════════════════════════"

# Install server deps
echo "→ Installing server dependencies..."
cd /workspaces/tcf-command-center/server && npm install

# Install client deps
echo "→ Installing client dependencies..."
cd /workspaces/tcf-command-center/client && npm install

# Build client
echo "→ Building dashboard..."
npm run build

# Copy .env from secrets if not present
if [ ! -f /workspaces/tcf-command-center/.env ]; then
  echo "→ Creating .env from Codespace secrets..."
  cat > /workspaces/tcf-command-center/.env << ENVFILE
NOTION_TOKEN=${NOTION_TOKEN:-ntn_f59403340455wAg7BBb4LeIMiAbwOgZQoDFHcmiXQ009cl}
NOTION_TODO_DB_ID=${NOTION_TODO_DB_ID:-337162124ddd80508602d598cd2896da}
GMAIL_CLIENT_ID=${GMAIL_CLIENT_ID:-987647160274-lnvc9hq4paubgvtc3gfje90e4losboi2.apps.googleusercontent.com}
GMAIL_CLIENT_SECRET=${GMAIL_CLIENT_SECRET:-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}
GMAIL_ACCOUNTS=design@thecosmeticformulary.com,design@paulyinc.com,tcfdesign.katherinefox@gmail.com
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
GITHUB_USER=DesignTCF
GITHUB_TOKEN=${GITHUB_TOKEN:-}
GDOC_ID=1hg66MmORP86JiuprbWGV0d3r480A31mCpm47GBYcnxM
PORT=3001
ENVFILE
fi

echo ""
echo "✅ Setup complete. Starting server..."
