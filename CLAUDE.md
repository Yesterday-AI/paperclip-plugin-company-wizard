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

**Ink/React CLI** — The app is a React state machine rendered in the terminal via Ink. The wizard flows through steps: NAME → GOAL → PROJECT → PRESET → MODULES → ROLES → SUMMARY → ASSEMBLE → PROVISION → DONE. Goals are derived automatically from the selected preset and modules (no separate goal template selection step).

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
- `src/logic/load-templates.js` — Loads presets, modules, roles from templates/. Exports `collectGoals()` (collects inline goals from preset + modules) and `modulesWithActiveGoals()` (determines which modules have active goals so their tasks can be skipped).
- `src/api/client.js` — Paperclip REST API client (auto-detects auth: no-op for local_trusted, Better Auth sign-in for authenticated instances)
- `src/api/provision.js` — Orchestrates API provisioning: Company → Goal → Project → Agents → Issues → Inline goals (sub-goals + projects + milestones + issues) → CEO heartbeat

### Template System

```text
templates/
├── roles/           # All roles with role.meta.json (base: true for always-present roles)
├── modules/         # Composable capabilities with module.meta.json
│   └── <module>/
│       ├── module.meta.json           # capabilities[], activatesWithRoles[], tasks[], permissions[], adapterOverrides?, goal?
│       ├── skills/                    # Shared primary skills (any owner can use)
│       │   └── <skill>.md
│       ├── agents/<role>/
│       │   ├── skills/                # Role-specific overrides + fallback variants
│       │   │   ├── <skill>.md         # Override (replaces shared for this role)
│       │   │   └── <skill>.fallback.md # Fallback (reduced scope for non-primary)
│       │   └── heartbeat-section.md   # Optional: injected into role's HEARTBEAT.md
│       └── docs/                      # Shared docs injected into all agents
├── presets/         # Curated module+role combinations with preset.meta.json (may include goals[])
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

### Doc References in Skills

Two kinds of docs live in `{company}/docs/`:

- **Templates** (`lowercase-kebab.md`) — Shipped by modules, copied at assembly time. Guaranteed to exist if the module is active. Skills may reference these directly.
- **Agent output** (`UPPERCASE.md`) — Created by agents during execution. May or may not exist yet.

Three patterns for referencing docs from skills:

| Reference | Rule | Example |
| :--- | :--- | :--- |
| Define own output | Name the path directly | "Document in `docs/TECH-STACK.md`" |
| Read own template | Reference directly (assembly guarantees it) | "Follow conventions in `docs/pr-conventions.md`" |
| Read cross-module output | **Always conditional** with graceful fallback | "If `docs/TECH-STACK.md` exists, review it. Otherwise, proceed based on project context." |

The naming convention is the contract: `UPPERCASE.md` from another module → always wrap in "if exists". `lowercase.md` from own module → safe to reference directly.

### Heartbeat Injection

Convention-based: if a module provides `agents/<role>/heartbeat-section.md`, assembly injects it into that role's HEARTBEAT.md before the `<!-- Module-specific ... -->` marker comment. Multiple modules can inject into the same role — sections are appended in module order. Follows the same gracefully-optimistic pattern as skills: file exists → heartbeat extends, file absent → nothing breaks.

Currently 3 modules have heartbeat sections: `stall-detection` (CEO), `auto-assign` (CEO fallback + PO primary), `backlog` (CEO fallback + PO primary).

### Key Concepts

- **Inline goals** — Goals live inside presets (`goals: []` array) or modules (`goal: {}` single object). `collectGoals()` merges them at runtime. When a module has an active goal, its `tasks` array is skipped (the goal's issues are the comprehensive replacement). Goals support `project: boolean` (default true) to control whether a dedicated Paperclip project is created. Milestones can also have `project: true` for milestone-level projects.
- **Hierarchical project resolution** — Issues resolve to the nearest ancestor project: milestone project → goal project → main project. Gracefully deterministic: if no milestone or goal project exists, issues fall back to the main project.
- **`assignTo: "user"`** — Issues with `assignTo: "user"` are assigned to the board user via `assigneeUserId` (resolved during `client.connect()`). For `local_trusted` instances the user is `"local-board"`; for authenticated instances the signed-in user's ID.
- **Headless mode** — When `--name` and `--preset` are both provided, the CLI skips the Ink wizard entirely and runs assembly + provisioning via `src/headless.js` with plain stdout. Available flags: `--name`, `--goal`, `--goal-description`, `--project`, `--project-description`, `--repo`, `--preset`, `--modules` (comma-separated), `--roles` (comma-separated).
- **Dry run** — `--dry-run` shows the resolved summary (company, preset, modules, roles, capabilities) and exits without writing files. Works in all modes: interactive wizard (stops at summary), headless, and AI wizard.
- **AI wizard mode** — Two sub-modes: `--ai` starts a 3-question interview (multi-turn conversation with Claude); `--ai "description"` does single-shot analysis. Both auto-select preset, modules, and roles. Requires `ANTHROPIC_API_KEY` env var. Explicit flags override AI choices. Uses `src/logic/ai-wizard.js`.
- **Gracefully optimistic architecture** — Capabilities extend when roles are present, degrade gracefully when absent. A capability's `owners[]` chain determines primary/fallback assignment at assembly time.
- **Shared vs role-specific skills** — Shared skills (`skills/`) work for any owner. Role-specific overrides (`agents/<role>/skills/`) exist only for genuinely different behavior. Fallbacks are always role-specific.
- **role.meta.json `adapter` field** — Per-agent model config (`model`, `effort`, etc.). `--model` CLI flag is a fallback.
- **role.meta.json `base` field** — `true` for always-present roles (ceo, engineer). Base roles are auto-included in every company.
- **module.meta.json `permissions` field** — Paperclip API permissions required by capability owners (e.g., `["tasks:assign"]` for auto-assign).
- **module.meta.json `adapterOverrides` field** — Adapter config keys (e.g., `{ "chrome": true }`) applied to all capability owner roles during provisioning. Collected per-role at assembly time, merged into agent `adapterConfig` at provisioning. Keeps role templates clean — modules declare what they need.
- **toPascalCase** — Company and project names become PascalCase directory names ("Black Mesa" → "BlackMesa"). Special characters are stripped.
- **BOOTSTRAP.md** — Generated guide describing what was assembled and how to provision manually if not using `--api`.

### Paperclip API Flow (--api)

Connects to Paperclip API (auto-detects auth mode, resolves `boardUserId`). Creates in order: Company → Goal → Project (with workspace cwd + goalIds) → Agents (with absolute instructionsFilePath, adapter config incl. chrome/model) → Module task issues (main project, skipping modules with active goals) → Inline goals (sub-goal + optional dedicated project + milestones + issues with hierarchical project resolution; `assignTo: "user"` issues get `assigneeUserId`) → optional CEO heartbeat (`--start`).

## Ink/React Considerations

- Ink requires TTY for raw mode — won't work in piped/non-interactive contexts
- `ink-select-input` items need explicit `key` property (not just `value`) to avoid React key warnings
- All paths in agent `adapterConfig` must be absolute (agents may run in different cwd)
