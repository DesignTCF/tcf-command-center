#!/bin/bash
# Runs every time Codespace starts

cd /workspaces/tcf-command-center/server

# Update redirect URIs to use the Codespace forwarded URL
CODESPACE_URL="https://${CODESPACE_NAME}-3001.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"

if [ -n "$CODESPACE_NAME" ]; then
  echo "→ Codespace detected. Updating OAuth redirect URIs..."
  # Patch .env with the correct Codespace URLs
  sed -i "s|GMAIL_REDIRECT_URI=.*|GMAIL_REDIRECT_URI=${CODESPACE_URL}/auth/gmail/callback|" /workspaces/tcf-command-center/.env 2>/dev/null || \
    echo "GMAIL_REDIRECT_URI=${CODESPACE_URL}/auth/gmail/callback" >> /workspaces/tcf-command-center/.env
  sed -i "s|DRIVE_REDIRECT_URI=.*|DRIVE_REDIRECT_URI=${CODESPACE_URL}/auth/drive/callback|" /workspaces/tcf-command-center/.env 2>/dev/null || \
    echo "DRIVE_REDIRECT_URI=${CODESPACE_URL}/auth/drive/callback" >> /workspaces/tcf-command-center/.env
fi

# Start the server
echo ""
echo "════════════════════════════════════════"
echo "  TCF Command Center — Starting"
echo "════════════════════════════════════════"
node index.js &
SERVER_PID=$!
sleep 2

echo ""
echo "  ✅ Dashboard running"
echo "  📧 Authorize Gmail:  ${CODESPACE_URL}/auth/gmail"
echo "  📁 Authorize Drive:  ${CODESPACE_URL}/auth/drive"
echo "  🏠 Dashboard:        ${CODESPACE_URL}"
echo ""
echo "  → Open the Gmail link first, authorize all 3 accounts"
echo "  → Then open the Drive link, authorize all 3 accounts"
echo "  → Both sets of tokens are saved automatically"
echo ""

wait $SERVER_PID
