# FocusFlow

A local-first productivity workspace for college deadlines, projects, habits, and focus sessions.

## Run locally

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). To create and verify a production build, run `npm run build`; run the automated checks with `npm test`.

## Data and reminders

Tasks, projects, habits, plans, settings, completion history, and focus sessions are stored in this browser's local storage. Use **Settings → Export JSON** for a backup; importing replaces the current workspace after validation. Browser deadline notifications are optional, require explicit permission, and run only while FocusFlow is open.