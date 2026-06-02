# TCF Command Center v2

Executive operating system for Katherine Fox — Art Director, The Cosmetic Formulary.

**Stack:** React + Vite + Tailwind CSS + Node.js + Express  
**Tabs:** Dashboard · Projects · Products · Creative · Operations · Files · Intelligence

---

## Quick Start

### 1. Install Node.js (one time only)
```bash
brew install node
```
No Homebrew? → https://brew.sh or https://nodejs.org

### 2. Add credentials to `.env`
```
NOTION_TOKEN=secret_xxxx
NOTION_TODO_DB_ID=337162124ddd80508602d598cd2896da

GMAIL_CLIENT_ID=xxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxx
GMAIL_REFRESH_TOKEN=1//xxxx

GDRIVE_CLIENT_ID=xxxx.apps.googleusercontent.com
GDRIVE_CLIENT_SECRET=GOCSPX-xxxx
GDRIVE_REFRESH_TOKEN=1//xxxx
```
The dashboard works with none, some, or all credentials filled in.

### 3. Launch
```bash
./launch.sh
```
This installs all dependencies, builds the React app, starts the server, and opens http://localhost:3001.

---

## What Each Tab Does

| Tab | Purpose |
|---|---|
| **Dashboard** | KPI strip + Today's Priorities + Activity Feed |
| **Projects** | Master tracker for every initiative — design, mfg, ops |
| **Products** | Full product dev lifecycle (formula → launch) per SKU |
| **Creative** | Website projects, packaging tracker, content pipeline |
| **Operations** | Email, supplier tracker, purchasing, inventory |
| **Files** | Drive-connected file management with upload |
| **Intelligence** | Research notes — suppliers, clients, market, regulatory |

---

## Data

Everything local is stored in `/data/*.json`:

```
products.json       formulas.json       packaging.json
manufacturing.json  content.json        decisions.json
intelligence.json   projects.json       suppliers.json
purchasing.json     inventory.json      websiteProjects.json
contacts.json       brandHealth.json
```

Back up this folder. No external database.

---

## Getting Google OAuth Tokens

1. https://console.cloud.google.com → create project
2. Enable Gmail API + Google Drive API
3. Credentials → OAuth Client ID → Desktop App → download JSON
4. Get refresh token at https://developers.google.com/oauthplayground:
   - Settings → Use your own OAuth credentials
   - Authorize: `https://mail.google.com/` + `https://www.googleapis.com/auth/drive`
   - Exchange auth code → copy Refresh Token
5. Use same client_id/secret/token for both Gmail and Drive vars

---

## Development Mode

To run with hot reload (requires Node):
```bash
# Terminal 1 — API server
cd server && npm run dev

# Terminal 2 — Vite dev server
cd client && npm run dev
```
Open http://localhost:5173

---

## Architecture

```
command-center/
├── .env                   ← credentials
├── launch.sh              ← one-click start
├── data/                  ← local JSON storage
├── server/
│   ├── index.js           ← Express API (:3001)
│   └── routes/
│       ├── notion.js      ← Notion bidirectional sync
│       ├── gmail.js       ← Gmail thread reader
│       ├── drive.js       ← Drive files + upload
│       └── data.js        ← CRUD for all data collections
└── client/
    ├── src/
    │   ├── App.jsx
    │   ├── store/AppContext.jsx   ← global state
    │   ├── lib/api.js             ← API client
    │   ├── components/            ← Nav, Modal, KPICard, StatusBadge...
    │   └── pages/                 ← Dashboard, Projects, Products...
    └── ...config files
```
