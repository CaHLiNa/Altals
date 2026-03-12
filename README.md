# Altals

Altals is a local-first desktop workspace for writing, references, code, and AI-assisted research workflows.

## What stays

- Desktop app built with Tauri + Vue
- Local provider keys for Anthropic, OpenAI, Google, Exa, and OpenAlex
- GitHub sync from the desktop app
- Minimal `web/` bridge for GitHub OAuth only

## What was removed from the upstream fork

- Upstream hosted account login and session flows
- Billing, subscriptions, and balance tracking
- AI proxying through the hosted backend
- Telemetry and hosted analytics endpoints
- Marketing website, docs site, review tools, and admin backend

## Development

Requirements:

- Node.js
- Rust toolchain
- Bun is optional if you want to keep the existing Tauri commands

Desktop app:

```bash
npm install
npm run build
npm run tauri dev
```

GitHub OAuth bridge:

```bash
cd web
npm install
npm run dev
```

Required `web/.env` values:

- `NUXT_BASE_URL`
- `NUXT_GITHUB_CLIENT_ID`
- `NUXT_GITHUB_CLIENT_SECRET`

Required desktop env for OAuth:

- `VITE_GITHUB_AUTH_ORIGIN`

Example:

```bash
VITE_GITHUB_AUTH_ORIGIN=http://localhost:3000 npm run tauri dev
```

## Repository

- GitHub: [CaHLiNa/Altals](https://github.com/CaHLiNa/Altals)
