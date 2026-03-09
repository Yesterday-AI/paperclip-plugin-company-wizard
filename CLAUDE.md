# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Clipper is a company-as-code bootstrapping CLI for the Paperclip AI agent platform. It uses Ink v6 (React 19 for terminals) to provide an interactive wizard that assembles company workspaces from modular templates, then optionally provisions them via the Paperclip API.

## Commands

```bash
npm run build       # esbuild: src/cli.jsx → dist/cli.mjs (single ESM bundle)
npm test            # node --test src/logic/*.test.js
node dist/cli.mjs   # Run built CLI (interactive wizard)

# Headless mode — skips the Ink wizard, plain stdout
node dist/cli.mjs --name "Acme Corp" --preset fast
node dist/cli.mjs --name "Acme Corp" --preset quality --goal "Ship MVP" \
  --project MyApp --repo https://github.com/org/repo --api

# AI wizard — describe company, Claude selects config (needs ANTHROPIC_API_KEY)
node dist/cli.mjs --ai "A fintech startup building a payment API, focus on security"
```

## Architecture

**Ink/React CLI** — The app is a React state machine rendered in the terminal via Ink. The wizard flows through steps: NAME → GOAL → PROJECT → PRESET → MODULES → ROLES → SUMMARY → ASSEMBLE → PROVISION → DONE.

**Build** — esbuild bundles all JSX + deps into a single `dist/cli.mjs`. The banner injects a shebang and `createRequire` shim for CJS dependencies. `react-devtools-core` is aliased to an empty shim.

### Source Layout

- `src/cli.jsx` — Entry point, CLI flag parsing, routes to `<App>` (interactive), `headless()`, or AI wizard
- `src/headless.js` — Non-interactive mode: runs assembly + provisioning with plain stdout logging
- `src/logic/ai-wizard.js` — AI wizard: calls Claude API to analyze description and select config. Prompts loaded from `templates/ai-wizard/`
- `src/app.jsx` — Main state machine, step transitions, derived state
- `src/components/Step*.jsx` — One component per wizard step
- `src/components/MultiSelect.jsx` — Reusable multi-select (used by StepModules, StepRoles)
- `src/logic/assemble.js` — File assembly: copies templates, resolves capabilities, generates BOOTSTRAP.md
- `src/logic/resolve.js` — Capability resolution, role formatting
- `src/logic/load-templates.js` — Loads presets, modules, roles from templates/
- `src/api/client.js` — Paperclip REST API client (localhost:3100, no auth in local_trusted mode)
- `src/api/provision.js` — Orchestrates API provisioning: Company → Goal → Project → Agents → Issues → CEO heartbeat

### Template System

```text
templates/
├── base/            # Always-present roles (ceo, engineer) with role.json + AGENTS.md
├── roles/           # Optional roles (product-owner, code-reviewer, ui-designer, ux-researcher)
├── modules/         # Composable capabilities with module.json
│   └── <module>/
│       ├── module.json                # capabilities[], activatesWithRoles[], tasks[]
│       ├── skills/                    # Shared primary skills (any owner can use)
│       │   └── <skill>.md
│       ├── agents/<role>/
│       │   ├── skills/                # Role-specific overrides + fallback variants
│       │   │   ├── <skill>.md         # Override (replaces shared for this role)
│       │   │   └── <skill>.fallback.md # Fallback (reduced scope for non-primary)
│       │   └── heartbeat-section.md   # Optional: injected into role's HEARTBEAT.md
│       └── docs/                      # Shared docs injected into all agents
├── presets/         # Curated module+role combinations (fast, quality, startup, research, full)
└── ai-wizard/       # Configurable prompts for --ai mode
    ├── config-format.md       # JSON output format + selection rules
    ├── single-shot-system.md  # System prompt for --ai "description"
    ├── interview-system.md    # System prompt for --ai interview
    └── messages.json          # User-turn instructions (interview flow)
```

### Skill Resolution

For a capability's primary skill, assembly checks two locations in order:

1. `agents/<role>/skills/<skill>.md` — role-specific override (wins if present)
2. `skills/<skill>.md` — shared skill (default for any primary owner)

This avoids duplicating identical skill files across roles. Most capabilities use a single shared primary skill. Role-specific overrides exist only when a role brings a genuinely different approach (e.g., UX Researcher does user-focused market analysis). Fallback variants are always role-specific.

### Heartbeat Injection

Convention-based: if a module provides `agents/<role>/heartbeat-section.md`, assembly injects it into that role's HEARTBEAT.md before the `<!-- Module-specific ... -->` marker comment. Multiple modules can inject into the same role — sections are appended in module order. Follows the same gracefully-optimistic pattern as skills: file exists → heartbeat extends, file absent → nothing breaks.

Currently 3 modules have heartbeat sections: `stall-detection` (CEO), `auto-assign` (CEO fallback + PO primary), `roadmap-to-issues` (CEO fallback + PO primary).

### Key Concepts

- **Headless mode** — When `--name` and `--preset` are both provided, the CLI skips the Ink wizard entirely and runs assembly + provisioning via `src/headless.js` with plain stdout. Available flags: `--name`, `--goal`, `--goal-description`, `--project`, `--project-description`, `--repo`, `--preset`, `--modules` (comma-separated), `--roles` (comma-separated).
- **Dry run** — `--dry-run` shows the resolved summary (company, preset, modules, roles, capabilities) and exits without writing files. Works in all modes: interactive wizard (stops at summary), headless, and AI wizard.
- **AI wizard mode** — Two sub-modes: `--ai` starts a 3-question interview (multi-turn conversation with Claude); `--ai "description"` does single-shot analysis. Both auto-select preset, modules, and roles. Requires `ANTHROPIC_API_KEY` env var. Explicit flags override AI choices. Uses `src/logic/ai-wizard.js`.
- **Gracefully optimistic architecture** — Capabilities extend when roles are present, degrade gracefully when absent. A capability's `owners[]` chain determines primary/fallback assignment at assembly time.
- **Shared vs role-specific skills** — Shared skills (`skills/`) work for any owner. Role-specific overrides (`agents/<role>/skills/`) exist only for genuinely different behavior. Fallbacks are always role-specific.
- **role.json `adapter` field** — Per-agent model config (`model`, `effort`, etc.). `--model` CLI flag is a fallback.
- **toPascalCase** — Company and project names become PascalCase directory names ("Black Mesa" → "BlackMesa"). Special characters are stripped.
- **BOOTSTRAP.md** — Generated guide describing what was assembled and how to provision manually if not using `--api`.

### Paperclip API Flow (--api)

Creates in order: Company → Goal → Project (with workspace cwd) → Agents (with absolute instructionsFilePath) → Issues (linked to goal+project) → optional CEO heartbeat (`--start`).

## Ink/React Considerations

- Ink requires TTY for raw mode — won't work in piped/non-interactive contexts
- `ink-select-input` items need explicit `key` property (not just `value`) to avoid React key warnings
- All paths in agent `adapterConfig` must be absolute (agents may run in different cwd)
