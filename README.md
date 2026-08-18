# NotAllowedRoom

Private rooms for chat, invites, and audio/video calls. The web app uses a black-and-white interface with full light mode and dark mode.

## Apps

| Folder | Stack | Role |
| --- | --- | --- |
| `frontend` | React 19, Vite 8 | Web client (deploy this to Vercel) |
| `server` | Node.js, Express, Socket.IO, PostgreSQL | API, auth, rooms, realtime |
| `mobile` | Expo SDK 56 | Native companion shell |

## Node.js

The project targets **Node.js 24.x** (Active LTS, Krypton). Use [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows):

```bash
nvm install 24
nvm use 24
node -v
```

## Local development

1. Copy environment files:

```bash
copy server\.env.example server\.env
copy frontend\.env.example frontend\.env
```

On macOS/Linux use `cp` instead of `copy`.

2. Start the API. Local development uses an embedded Postgres (PGlite), so you do not need a separate database password:

```bash
cd server
npm install
npm run migrate
npm run dev
```

To use your own PostgreSQL instead, set `DB_DRIVER=postgres` in `server/.env` and fill in `DB_*`.

3. In another terminal, start the web app:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The frontend talks to `VITE_BACKEND_URL` (default `http://localhost:9000`).

To run both together from the server folder:

```bash
cd server
npm run dev:all
```

## Light mode and dark mode

- The web app follows the system theme on first visit.
- Use the sun / moon / monitor control in the header to cycle **system → light → dark**.
- The choice is saved in `localStorage` (`nar_theme`) and applied before first paint to avoid a flash.

## Deploy the frontend on Vercel

This repo is a monorepo. The root `vercel.json` builds `frontend` from the repository root, so you can import the GitHub repo and deploy without changing Root Directory.

1. Import the repository in Vercel.
2. Confirm Node.js **24.x** (from `engines` / `.nvmrc`).
3. Add environment variable **`VITE_BACKEND_URL`** (your public API origin, no trailing slash). Camera and rooms will not start without this.
4. Deploy.

If you prefer setting **Root Directory** to `frontend` in the Vercel dashboard, that also works. Use the same `VITE_BACKEND_URL` variable.

The API still needs `FRONT_CORS` to include your Vercel origin, for example:

```
FRONT_CORS=https://react-not-allowed-room-raven.vercel.app
FRONTEND_URL=https://react-not-allowed-room-raven.vercel.app
```

Do not proxy the API through Vercel rewrites. The client calls `VITE_BACKEND_URL` directly (CORS is handled by the server).

## Mobile

```bash
cd mobile
npm install
npx expo start
```

See [Expo SDK 56 docs](https://docs.expo.dev/versions/v56.0.0/).
