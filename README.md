# Procurement Tracker 采购包招投标管理工作台

A lightweight project tracker for procurement bidding & tendering workflows.

## Features

- **Dashboard** — Overview of all procurement packages with progress, status, and alerts
- **Node Timeline** — Gantt-style view comparing planned vs actual dates for each workflow node (N01–N13)
- **Quick Log** — Record progress, issues, experiences, deviations, decisions, and reminders per package/node
- **Log Filtering** — Filter logs by type to quickly find relevant entries

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Deploy to Vercel (Free)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com), sign in with GitHub
3. Import this repository → Click **Deploy**
4. Done! You'll get a `xxx.vercel.app` URL

Every `git push` will auto-redeploy.

## Tech Stack

- React 18 + Vite
- Pure CSS (no UI library)
- localStorage for data persistence (Supabase integration planned)

## Roadmap

- [ ] Supabase backend for persistent storage
- [ ] Data export (JSON / Excel)
- [ ] Review & retrospective summary view
- [ ] Overdue auto-reminders
- [ ] Multi-device sync
