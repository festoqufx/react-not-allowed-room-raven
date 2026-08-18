# NotAllowedRoom web app

Vite + React client for rooms, chat, and calls. The UI is black and white, with light mode, dark mode, and a system-follow option.

## Scripts

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production build
npm run lint
```

Requires **Node.js 24.x**.

## Environment

Copy `.env.example` to `.env`:

```
VITE_BACKEND_URL=http://localhost:9000
```

Vite inlines this value at **build** time. For Vercel, set `VITE_BACKEND_URL` in Project Settings so production builds point at your API.

## Theme

`ThemeProvider` stores `nar_theme` as `system`, `light`, or `dark`. A small script in `index.html` applies the theme before React loads.

## Vercel

- Deploy from the repo root (root `vercel.json` builds this folder) **or** set Root Directory to `frontend`.
- Framework: Vite. Output: `dist`.
- SPA routes rewrite to `index.html`.
- Set **`VITE_BACKEND_URL`** (or `BACKEND_ORIGIN`) to your public API origin **before** building. Example: `https://api.example.com` with no trailing slash.
- Also set the API `FRONT_CORS` to include `https://react-not-allowed-room-raven.vercel.app`.
- Camera and calls only start after the frontend can reach that API.

Do not add an `/api` rewrite to a remote host. The previous sslip.io proxy broke deploys; the client now uses the backend origin directly.
