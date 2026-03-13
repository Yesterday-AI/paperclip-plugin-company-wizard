<p align="center">
  <h1 align="center">Clipper Web</h1>
  <p align="center">
    <strong>Web UI for bootstrapping AI agent companies — pre-plugin preview.</strong>
  </p>
</p>

> **Preview:** This is a development preview of the Paperclip plugin version of Clipper. It runs as a standalone Vite app that assembles company files and provisions them via the Paperclip REST API. Once the [Paperclip plugin system](https://github.com/paperclipai/paperclip/pull/432) is available, Clipper will run as a native plugin — using the instance's configured LLM (no separate API key) and writing provisioned files directly through the plugin SDK.

---

Clipper Web is the browser-based companion to the [Clipper CLI](../README.md). It provides the same company-as-code wizard — team presets, composable modules, AI-powered configuration — but as a React app with real-time API provisioning.

<br>

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
  - [Paperclip on Host (no Docker)](#paperclip-on-host-no-docker)
  - [Paperclip in Docker](#paperclip-in-docker)
    - [1. Ensure the bind-mount exists](#1-ensure-the-bind-mount-exists)
    - [2. Configure the path mapping](#2-configure-the-path-mapping)
- [Environment Variables](#environment-variables)
- [How It Works](#how-it-works)
- [Features](#features)
- [Development](#development)
  - [AI Wizard](#ai-wizard)
- [Plugin Roadmap](#plugin-roadmap)
- [License](#license)

<br>

## Quick Start

```sh
cd web
cp .env.example .env     # configure Paperclip connection
npm install
npm run dev              # → http://localhost:5173
```

<br>

## Prerequisites

- **Node.js 20+**
- **A running Paperclip instance** — either on the host or in Docker
- **`ANTHROPIC_API_KEY`** — for the AI wizard (set in your shell environment). This requirement goes away once the plugin system is available.

<br>

## Configuration

Clipper Web needs a **shared workspace directory** — a folder where it writes the generated company files (agent personas like `AGENTS.md`, `SOUL.md`, `HEARTBEAT.md`, skills, and shared docs) and that the Paperclip instance can read at runtime. Both Clipper and Paperclip must have access to this directory.

> This filesystem-based approach is **pre-plugin only**. Once the Paperclip plugin system ships, Clipper will write files directly via the plugin SDK — no shared directory or path mapping needed.

How you configure this depends on where Paperclip is running.

### Paperclip on Host (no Docker)

When Paperclip runs directly on the host, both Clipper and Paperclip share the same filesystem. Set `PAPERCLIP_WORKDIR_HOST` to the directory where Clipper should write the generated agent files — Paperclip will read them from the same path at runtime.

```sh
# .env
PAPERCLIP_URL=http://localhost:3100

# Where to write company workspaces (required)
PAPERCLIP_WORKDIR_HOST=/path/to/your/companies
# PAPERCLIP_WORKDIR_CONTAINER is not needed — Paperclip sees the same path

# For authenticated instances:
PAPERCLIP_EMAIL=you@example.com
PAPERCLIP_PASSWORD=yourpassword
```

For `local_trusted` instances (the default dev mode), no email/password is needed.

### Paperclip in Docker

When Paperclip runs in a Docker container, Clipper writes the generated agent files to a host directory, and Paperclip reads them from inside the container. A **bind-mount** bridges the two: Clipper Web needs to know both the host path (where it writes) and the container path (where Paperclip sees the files).

#### 1. Ensure the bind-mount exists

Your `docker-compose.override.yml` must map a host directory into the container. The key line is:

```yaml
services:
  server:
    volumes:
      - ${PAPERCLIP_WORKDIR_HOST:-/tmp}:${PAPERCLIP_WORKDIR_CONTAINER:-/host-workdir}
```

<details>
<summary><strong>Full example: <code>docker-compose.official.override.yml</code></strong></summary>

```yaml
volumes:
  pgdata:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${PAPERCLIP_PGDATA_HOST:-/tmp/paperclip-pgdata}

services:
  db:
    image: ${PAPERCLIP_PG_IMAGE:-postgres:17-alpine}
    environment:
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "${PAPERCLIP_DB_PORT:-5432}:5432"
  server:
    image: ${PAPERCLIP_IMAGE:-ghcr.io/paperclipai/paperclip:latest}
    user: root
    entrypoint: ["/container-init.sh"]
    command: ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
    ports:
      - "${PAPERCLIP_APP_PORT:-3100}:3100"
    environment:
      PAPERCLIP_PUBLIC_URL: "${PAPERCLIP_PUBLIC_URL:-http://localhost:${PAPERCLIP_APP_PORT:-3100}}"
      CLAUDE_CODE_OAUTH_TOKEN: "${CLAUDE_CODE_OAUTH_TOKEN:-}"
      GITHUB_TOKEN: "${GITHUB_TOKEN:-}"
    volumes:
      - ${PAPERCLIP_INIT_SCRIPT:-./container-init.sh}:/container-init.sh:ro
      - ${PAPERCLIP_INSTANCES_HOST:-./data/instances}:/paperclip/instances
      - ${PAPERCLIP_DOTPAPERCLIP_HOST:-./data/dotpaperclip}:/paperclip/.paperclip
      - ${CODEX_CONFIG_DIR:-~/.codex}:/paperclip/.codex:ro
      - ${PAPERCLIP_WORKDIR_HOST:-/tmp}:${PAPERCLIP_WORKDIR_CONTAINER:-/host-workdir}
```

</details>

#### 2. Configure the path mapping

```sh
# .env
PAPERCLIP_URL=http://localhost:3100
PAPERCLIP_EMAIL=you@example.com
PAPERCLIP_PASSWORD=yourpassword

# Host path — where Clipper writes files on your machine
PAPERCLIP_WORKDIR_HOST=/tmp

# Container path — where the Paperclip server sees those same files
PAPERCLIP_WORKDIR_CONTAINER=/host-workdir
```

Clipper writes the assembled company workspace (agent personas, skills, docs) to `PAPERCLIP_WORKDIR_HOST` on the host. When it calls the API to register agents, it translates paths to `PAPERCLIP_WORKDIR_CONTAINER` so the Paperclip server can find the same files inside the container.

```text
Host:      /tmp/AcmeCorp/agents/ceo/AGENTS.md
                    ↕ bind-mount
Container: /host-workdir/AcmeCorp/agents/ceo/AGENTS.md
```

<br>

## Environment Variables

All variables are set in `web/.env`. Copy `.env.example` to get started.

| Variable | Description | Default |
| :------- | :---------- | :------ |
| `PAPERCLIP_URL` | Paperclip API base URL | `http://localhost:3100` |
| `PAPERCLIP_EMAIL` | Board login email (authenticated instances) | — |
| `PAPERCLIP_PASSWORD` | Board login password | — |
| `PAPERCLIP_WORKDIR_HOST` | Host path to workspace directory | `/tmp` |
| `PAPERCLIP_WORKDIR_CONTAINER` | Container path to workspace directory | — (falls back to `_HOST`) |

For `local_trusted` instances (default Paperclip dev mode), `PAPERCLIP_EMAIL` and `PAPERCLIP_PASSWORD` can be omitted.

<br>

## How It Works

```text
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Browser UI    │────▶│   Vite Server    │────▶│  Paperclip API   │
│  (React wizard) │     │  (SSE endpoint)  │     │  (REST, Docker)  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │  Host FS     │
                        │  (workdir)   │
                        └──────────────┘
```

1. The wizard collects configuration (company name, goal, project, preset, modules, roles)
2. The AI wizard (optional) calls the Anthropic API from the browser to auto-select configuration
3. On submit, the browser sends a `POST /api/provision` to the Vite dev server
4. The server-side plugin:
   - **Assembles** the company workspace (agent files, skills, docs) to `PAPERCLIP_WORKDIR_HOST`
   - **Translates** paths for the container (`WORKDIR_HOST` → `WORKDIR_CONTAINER`)
   - **Provisions** via the Paperclip REST API (company → goal → project → agents → issues)
   - **Streams** progress back as Server-Sent Events
5. The UI shows real-time log output and links to the provisioned company on completion

<br>

## Features

- **Two creation paths** — manual step-by-step wizard or AI-powered configuration
- **AI wizard** — describe your company in plain English, Claude selects optimal preset, modules, and roles
    - **Interview mode** — 3 guided questions, each building on previous answers
    - **Quick generate** — single description, instant configuration
- **Live config review** — edit any field, hover over modules and roles for details
- **Real-time provisioning** — SSE-streamed progress log, no page refresh
- **Full template catalog** — same presets, modules, and roles as the CLI
- **Dark/light mode** — respects system preference

<br>

## Development

```sh
npm run dev          # Start Vite dev server with HMR → http://localhost:5173
npm run build        # Type-check + production build
npm run preview      # Preview production build locally
```

The dev server includes the provisioning API endpoint — no additional backend needed.

### AI Wizard

The AI wizard requires `ANTHROPIC_API_KEY` in your shell environment (not in `.env` — it's used browser-side via the Anthropic SDK's direct browser access):

```sh
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Prompts are in `src/prompts/` and can be edited without rebuilding.

<br>

## Plugin Roadmap

This standalone app is a **preview**. The target architecture is a Paperclip plugin (`@paperclipai/plugin-clipper`), which brings two key improvements:

| Current (preview) | Plugin version |
| :----------------- | :------------- |
| Separate Vite dev server | Embedded in Paperclip UI |
| Requires `ANTHROPIC_API_KEY` for AI wizard | Uses instance-configured LLM |
| Assembles files via host filesystem + bind-mount | Writes files directly via plugin SDK |
| Provisions via REST API with separate auth | Uses plugin API context (no credentials needed) |
| Template catalog bundled at build time | Loaded dynamically via `usePluginData()` |

The plugin system is [fully specified](PLUGIN-INTEGRATION.md) but not yet implemented in Paperclip (post-V1). When it ships, the migration is straightforward — the wizard components, state machine, and AI interview flow remain unchanged. See `PLUGIN-INTEGRATION.md` for the full migration plan.

<br>

## License

[MIT](../LICENSE) &mdash; [Yesterday](https://yesterday-ai.de)
