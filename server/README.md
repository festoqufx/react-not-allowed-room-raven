# NotAllowedRoom API

Express + Socket.IO backend for authentication, rooms, messages, and WebRTC signaling.

## Requirements

- Node.js 24.x
- PostgreSQL

## Setup

```bash
copy .env.example .env
npm install
npm run migrate
npm run dev
```

By default `DB_DRIVER=pglite` stores rooms in `server/data/` so you can create rooms without installing PostgreSQL. Set `DB_DRIVER=postgres` to use a full Postgres server.

The API listens on `PORT` (default `9000`).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Nodemon for the API |
| `npm start` | Production process |
| `npm run migrate` | Apply SQL migrations |
| `npm run dev:all` | API + Vite frontend together |

## CORS and email

Set `FRONT_CORS` and `FRONTEND_URL` to the web origin (local Vite or your Vercel URL). Email settings are in `.env.example`.
