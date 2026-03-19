# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Company Wizard is a [Paperclip](https://github.com/paperclipai/paperclip) plugin for bootstrapping agent company workspaces. It provides an interactive wizard UI (manual and AI-powered paths) that assembles companies from modular templates and optionally provisions them via the Paperclip API. Derived from the standalone `@yesterday-ai/plugin-paperclip-company-wizard` CLI.

## Commands

```bash
pnpm build          # esbuild: worker + manifest + UI → dist/
pnpm dev            # watch mode
pnpm test           # vitest: tests/**/*.spec.ts
pnpm test:logic     # node --test: src/logic/*.test.js
pnpm typecheck      # tsc --noEmit
```

After `pnpm build`, reload the plugin in the Paperclip UI. No reinstall required.

## Architecture

**Plugin worker** (`src/worker.ts`) — Registers three actions via the Paperclip Plugin SDK:
- `preview-files` — Assembles to a temp dir, returns `.md` file tree as `{path, content}[]`, cleans up. Used by the ConfigReview step for inline preview+edit before provisioning.
- `start-provision` — Assembles to the workspace `companies/` dir, applies `fileOverrides` (edits from preview), then provisions via Paperclip API.
- `check-auth` — Validates API credentials early (used by the summary step).

**Plugin UI** (`src/ui/`) — React state machine (WizardContext + reducer). Manual path: ONBOARDING → NAME → GOAL → PRESET → MODULES → ROLES → SUMMARY → PROVISION → DONE. AI path: ONBOARDING → AI_WIZARD → PROVISION → DONE.

**Build** — esbuild bundles `src/worker.ts`, `src/manifest.ts`, and `src/ui/main.tsx` into `dist/`. CSS via PostCSS/Tailwind 4.

### Source Layout

- `src/worker.ts` — Worker entry point; registers actions with `ctx.actions.register`
- `src/manifest.ts` — Plugin manifest: `id: "paperclipai.plugin-clipper"`, `displayName: "Company Wizard"`
- `src/logic/assemble.js` — File assembly: copies templates, resolves capabilities, generates BOOTSTRAP.md
- `src/logic/resolve.js` — Capability resolution, role formatting, module dependency expansion
- `src/logic/load-templates.js` — Loads presets, modules, roles. Exports `collectGoals()` and `modulesWithActiveGoals()`
- `src/logic/ai-wizard.js` — AI wizard: calls Claude API to analyze description and select config
- `src/api/client.js` — Paperclip REST API client (auto-detects auth: no-op for local_trusted, Better Auth sign-in for authenticated)
- `src/api/provision.js` — Provisioning orchestration: Company → Goal → Project → Agents → Issues → Inline goals → CEO heartbeat
- `src/ui/context/WizardContext.tsx` — State machine + reducer. Includes `fileOverrides: Record<string,string>` for edits made in ConfigReview
- `src/ui/components/ConfigReview.tsx` — Review step: calls `preview-files`, shows collapsible `FileEntry` components with inline edit. Overrides dispatched via `SET_FILE_OVERRIDE`/`DELETE_FILE_OVERRIDE`
- `src/ui/components/steps/StepProvision.tsx` — Passes `fileOverrides` to `start-provision`

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
└── ai-wizard/       # Configurable prompts for AI wizard mode
    ├── config-format.md
    ├── single-shot-system.md
    ├── interview-system.md
    └── messages.json
```

**Current counts**: 14 presets, 22 modules, 17 optional roles (CEO is the only base role).

### Skill Resolution

For a capability's primary skill, assembly checks two locations in order:

1. `agents/<role>/skills/<skill>.md` — role-specific override (wins if present)
2. `skills/<skill>.md` — shared skill (default for any primary owner)

Role-specific overrides exist only when a role brings a genuinely different approach. Fallback variants are always role-specific.

### Doc References in Skills

Two kinds of docs live in `{company}/docs/`:

- **Templates** (`lowercase-kebab.md`) — Shipped by modules, copied at assembly time. Safe to reference directly.
- **Agent output** (`UPPERCASE.md`) — Created by agents during execution. Always wrap in "if exists" conditionals.

### Heartbeat Injection

Convention-based: if a module provides `agents/<role>/heartbeat-section.md`, assembly injects it into that role's HEARTBEAT.md before the `<!-- Module-specific ... -->` marker comment. Multiple modules can inject into the same role.

Currently 3 modules have heartbeat sections: `stall-detection` (CEO), `auto-assign` (CEO fallback + PO primary), `backlog` (CEO fallback + PO primary).

### Key Concepts

- **Inline goals** — Goals live inside presets (`goals: []` array) or modules (`goal: {}` single object). `collectGoals()` merges them at runtime. When a module has an active goal, its `tasks` array is skipped (the goal's issues replace them). Goals support `project: boolean` (default true) to control whether a dedicated Paperclip project is created.
- **Hierarchical project resolution** — Issues resolve: milestone project → goal project → main project.
- **`assignTo: "user"`** — Issues assigned to the board user via `assigneeUserId` (resolved during `client.connect()`).
- **File overrides** — `WizardContext.fileOverrides` (`Record<string,string>`) stores edits made in ConfigReview. Passed to `start-provision` as `params.fileOverrides`; written over assembled files before API provisioning.
- **Gracefully optimistic architecture** — Capabilities extend when roles are present, degrade gracefully when absent. A capability's `owners[]` chain determines primary/fallback assignment at assembly time.
- **`adapterOverrides` field** — Module-level adapter config (e.g., `{ "chrome": true }`) merged into agent `adapterConfig` at provisioning. Keeps role templates clean.
- **toPascalCase** — Company and project names become PascalCase directory names. Special characters are stripped.
- **BOOTSTRAP.md** — Generated guide describing what was assembled and how to provision manually if not using the wizard.

### Paperclip API Flow (start-provision)

Connects to Paperclip API (auto-detects auth mode, resolves `boardUserId`). Creates in order: Company → Goal → Project (with workspace cwd + goalIds) → Agents (with absolute instructionsFilePath, adapter config incl. chrome/model) → Module task issues (main project, skipping modules with active goals) → Inline goals (sub-goal + optional dedicated project + milestones + issues with hierarchical project resolution) → optional CEO heartbeat.

## Test Suites

Two separate test runners:
- `pnpm test` — vitest, `tests/**/*.spec.ts` — TypeScript plugin tests
- `pnpm test:logic` — `node --test`, `src/logic/*.test.js` — Plain-JS logic tests

## React Considerations

- All paths in agent `adapterConfig` must be absolute (agents may run in different cwd)
- Tailwind 4: use `wrap-break-word` not `break-words`
- `@ts-ignore` suppresses hints on the three plain-JS imports in `worker.ts`

## Legacy Note

This plugin was derived from [`@yesterday-ai/plugin-paperclip-company-wizard`](https://github.com/Yesterday-AI/plugin-paperclip-company-wizard), the standalone Ink-based CLI. The template system, assembly logic, and API client were carried over intact. The CLI entry points (`src/cli.jsx`, `src/app.jsx`, `src/headless.js`), Ink components, and old build config were removed. See `CHANGELOG.md` for the full v0.1.0 feature list.
