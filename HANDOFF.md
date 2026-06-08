# TCF Command Center — Session Handoff
**Date:** 2026-06-08 | **Git commit:** fe1f7c0

---

## What This Is
Executive intelligence dashboard for Katherine Fox / The Cosmetic Formulary.  
React 18 + Vite + Tailwind frontend, static on GitHub Pages, data baked in by GitHub Actions.

## Live Site
**https://designtcf.github.io/tcf-command-center/**

## Repo
**https://github.com/DesignTCF/tcf-command-center**  
Git token: `[TOKEN IN MEMORY]`

---

## To Start a New Session

Tell Claude:
> "Continue work on the TCF Command Center dashboard. Check memory for full context. Repo is at /Users/design/tcf-dashboard, live at https://designtcf.github.io/tcf-command-center/"

---

## What Was Built This Session

### ✅ Fixed
- BrowserRouter missing `basename` → Home tab was blank on GitHub Pages
- Removed Notion entirely from all UI labels and data flows

### ✅ Connected
- Google Drive OAuth — 4 task documents pulling live into dashboard
- GitHub Actions secrets set: `DRIVE_REFRESH_TOKEN`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
- Workflow auto-fetches Drive tasks 4×/day and bakes into static site
- Client Status Tracker (Google Sheet) → powers Pipeline and Purchasing tabs

### ✅ Work Tab — Tasks Redesign
- 5 clean collapsed categories: Formula & Packaging, Brand & Website, Salt Spa, Client Work, TCF Operations
- Sorted by urgency (overdue → in progress → due soon → general)
- ✕ to dismiss any task (localStorage)
- ↗ on each task opens the exact Drive doc to edit
- Drive source links in footer, out of the way
- + Add Task writes directly to TCF to-do List Google Doc

---

## Current Task Counts (as of last workflow run)
| Category | Count |
|---|---|
| Formula & Packaging | 33 |
| Brand & Website | 41 |
| Salt Spa | 106 |
| Client Work | 1 |
| TCF Operations | 36 |
| **Total active** | **217** |

---

## Google Drive Task Sources
| Doc | Type | File ID |
|---|---|---|
| TCF to-do List | Google Doc | `1ofvcpceHYsEt7I-dwZXA78YycDH0WsdhlbUVlI0lYJA` |
| Katherine's Notes | Google Doc | `1hg66MmORP86JiuprbWGV0d3r480A31mCpm47GBYcnxM` |
| Salt Spa Action Items | Google Sheet | `1iPMeoBklpr90wV553ZGnYCsKqsmk4Jb9ww6kK-TXGjI` |
| Action Items – Class & Retail | Google Doc | `1IU3mAtJVSA1wO_xK8-3jwPlHxEe8xNWPruZgFvbXLcw` |
| Client Status Tracker | Google Sheet | `1hrnC8aDPM7fxZv1YygPgg4-JjDIZAkk9` |

---

## Build & Deploy (CRITICAL — read before touching anything)

**Never run Node from the Dropbox path.** Always work from `/Users/design/tcf-dashboard/`.

```bash
# Build
export PATH=/Users/design/.local/node/bin:$PATH
cd /Users/design/tcf-dashboard/client
npm install --silent   # only if node_modules missing
GH_PAGES=true node_modules/.bin/vite build

# Stage files BEFORE switching branches
rm -rf /tmp/gh-out && mkdir /tmp/gh-out
cp -r client-dist-gh/. /tmp/gh-out/
cp client-dist-gh/index.html /tmp/gh-out/404.html
touch /tmp/gh-out/.nojekyll

# Deploy to gh-pages
git stash --include-untracked
git checkout gh-pages && git reset --hard origin/gh-pages
find . -maxdepth 1 ! -name .git ! -name . -exec rm -rf {} +
cp -r /tmp/gh-out/. .
git add -A && git commit -m "description" && git push origin gh-pages
git checkout main && git stash pop
```

**After any local deploy, trigger GitHub Actions** to get real Drive task data baked in:
```bash
export PATH=/Users/design/.local/node/bin:$PATH
node - << 'EOF'
const https = require('https')
const TOKEN = '[TOKEN IN MEMORY]'
const body = '{"ref":"main"}'
const req = https.request({
  hostname: 'api.github.com',
  path: '/repos/DesignTCF/tcf-command-center/actions/workflows/refresh-and-deploy.yml/dispatches',
  method: 'POST',
  headers: { 'Authorization': `token ${TOKEN}`, 'User-Agent': 'tcf-bot',
    'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body) }
}, res => console.log(res.statusCode === 204 ? '✓ Triggered' : '✗'))
req.write(body); req.end()
EOF
```

---

## OAuth Credentials
```
Client ID:     [CLIENT_ID IN MEMORY]
Client Secret: [CLIENT_SECRET IN MEMORY]
Accounts:      design@thecosmeticformulary.com
               design@paulyinc.com
               tcfdesign.katherinefox@gmail.com
```
Tokens live in `data/drive-tokens.json` (local only, gitignored).

---

## What's Next (not done yet)
1. **Render deploy** — `render.yaml` is configured, just needs a Render account deploy for always-on backend (enables Gmail threads, live Drive sync without waiting for Actions)
2. **AI Chat** — Routes built, just add `ANTHROPIC_API_KEY` to .env and Render env vars
3. **Shopify** — Routes built, add `SHOPIFY_STORE_URL` + `SHOPIFY_ADMIN_TOKEN`
4. **Home tab improvements** — Task links on Home currently navigate to /work, could deep-link to the specific Drive doc
5. **Gmail integration** — Needs live backend; currently empty on static site
