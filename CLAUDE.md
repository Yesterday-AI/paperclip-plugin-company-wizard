# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Company Wizard is a [Paperclip](https://github.com/paperclipai/paperclip) plugin for bootstrapping agent company workspaces. It provides an interactive wizard UI (manual and AI-powered paths) that assembles companies from modular templates and optionally provisions them via the Paperclip API. Derived from the standalone `@yesterday-ai/paperclip-plugin-company-wizard` CLI.

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

**Plugin worker** (`src/worker.ts`) — Registers actions via the Paperclip Plugin SDK:
- `preview-files` — Assembles to a temp dir, returns `.md` file tree as `{path, content}[]`, cleans up. Used by the ConfigReview step for inline preview+edit before provisioning.
- `start-provision` — Assembles to the workspace `companies/` dir, applies `fileOverrides` (edits from preview), then provisions via Paperclip API.
- `check-auth` — Validates Paperclip API credentials early (used by the summary step).
- `ai-chat` — Proxies messages to the Anthropic API using the configured key. Returns `{ text, error? }` — never throws.
- `check-ai-config` — Lightweight check that `anthropicApiKey` is configured. Called by the AI wizard on mount to show a warning banner.
- `refresh-templates` — Deletes cached templates dir and re-downloads from GitHub. Triggered by the "Update templates" button on the onboarding screen.

All worker actions return errors as `{ error }` instead of throwing, so the plugin host never swallows messages in generic 502 responses.

**Plugin UI** (`src/ui/`) — React state machine (WizardContext + reducer). Manual path: ONBOARDING → NAME → GOAL → PRESET → MODULES → ROLES → SUMMARY → PROVISION → DONE. AI path: ONBOARDING → AI_WIZARD → PROVISION → DONE.

**Build** — esbuild bundles `src/worker.ts`, `src/manifest.ts`, and `src/ui/main.tsx` into `dist/`. CSS via PostCSS/Tailwind 4.

### Source Layout

- `src/worker.ts` — Worker entry point; registers actions with `ctx.actions.register`
- `src/manifest.ts` — Plugin manifest: `id: "yesterday-ai.paperclip-plugin-company-wizard"`, `displayName: "Company Wizard"`
- `src/logic/assemble.js` — File assembly: copies templates, resolves capabilities, generates BOOTSTRAP.md
- `src/logic/resolve.js` — Capability resolution, role formatting, module dependency expansion
- `src/logic/load-templates.js` — Loads presets, modules, roles. Exports `collectGoals()`, `validateGoal()`
- `src/api/client.js` — Paperclip REST API client (auto-detects auth: no-op for local_trusted, Better Auth sign-in for authenticated). Network errors wrapped with actionable messages. Methods: `createCompany`, `getCompany`, `updateCompany`, `deleteCompany`, `listAgents`, `getAgent`, `createAgent` (approval-aware: falls back to `/agent-hires` + auto-approve when board approval is required), `createGoal`, `createProject`, `createIssue`, `createRoutine`, `createRoutineTrigger`, `triggerHeartbeat`
- `src/ui/context/WizardContext.tsx` — State machine + reducer. Key state: `goals: Goal[]`, `projects: WizardProject[]`, `fileOverrides: Record<string,string>`, `existingCompanyId: string` (when set, provisioning targets this company instead of creating a new one)
- `src/ui/components/ConfigReview.tsx` — Review step: calls `preview-files`, shows collapsible `FileEntry` components with inline edit. Overrides dispatched via `SET_FILE_OVERRIDE`/`DELETE_FILE_OVERRIDE`
- `src/ui/components/steps/StepProvision.tsx` — Passes `fileOverrides` to `start-provision`

### Template System

```text
templates/
├── roles/           # All roles with role.meta.json (base: true for always-present roles)
├── modules/         # Composable capabilities with module.meta.json
│   └── <module>/
│       ├── module.meta.json           # capabilities[], activatesWithRoles[], issues[], routines[]?, permissions[], adapterOverrides?, goal?
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

**Current counts**: 15 presets, 26 modules, 17 optional roles (CEO is the only base role).

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

- **Goals and projects** — `WizardState.goals: Goal[]` holds user-specified goals (from manual step or AI wizard). `WizardState.projects: WizardProject[]` holds user-specified projects. Each `Goal` has `title`, `description`, and optional `parentGoal` for sub-goal hierarchy. Each `WizardProject` has `name`, `description`, and `goals[]` (goal titles it's linked to, matching Paperclip API `goalIds`).
- **Inline goals** — Module-level goals (`goal: {}` in `module.meta.json`) and preset goals (`goals: []` in `preset.meta.json`). Goals can have `subgoals[]` (nested goals with `id`, `title`, `level`, `description`). `collectGoals()` merges them at runtime as `inlineGoals`. During assembly, inline goals become sub-goals of the main user goal, and subgoals are expanded into the goal hierarchy.
- **Module issues and routines** — Issues are at module/preset level (`issues[]`), not inside goals. Routines (`routines[]`) define recurring scheduled work with `assignTo`, `schedule` (cron), and `concurrencyPolicy`. Both are collected from active modules during assembly.
- **`assembleCompany()` params** — `userGoals` (from wizard), `userProjects` (from wizard), `inlineGoals` (from `collectGoals()`). Module inline goals are auto-parented to `userGoals[0]`. If no `userProjects` specified, a default project linked to all goals is created.
- **Paperclip object model** — Goals have `level` (`company` | `team` | `agent` | `task`), nested via `parentId`. Projects link to goals via `goalIds`. Issues link to projects via `projectId`. Routines have `assigneeAgentId`, `schedule`, and cron triggers. `instructionsFilePath` sets the agent's working directory.
- **`assignTo: "user"`** — Issues assigned to the board user via `assigneeUserId` (resolved during `client.connect()`).
- **`companyDescription`** — AI wizard generates a comprehensive description. Stored in `WizardContext.companyDescription`, rendered in BOOTSTRAP.md, and sent to the Paperclip API as the company's `description` field.
- **File overrides** — `WizardContext.fileOverrides` (`Record<string,string>`) stores edits made in ConfigReview. Passed to `start-provision` as `params.fileOverrides`; written over assembled files before API provisioning.
- **Gracefully optimistic architecture** — Capabilities extend when roles are present, degrade gracefully when absent. A capability's `owners[]` chain determines primary/fallback assignment at assembly time.
- **`adapterOverrides` field** — Module-level adapter config (e.g., `{ "chrome": true }`) merged into agent `adapterConfig` at provisioning. Keeps role templates clean.
- **toPascalCase** — Company and project names become PascalCase directory names. Special characters are stripped.
- **BOOTSTRAP.md** — Generated guide with: company description, goal hierarchy (with `level` and `parentGoal` in HTML-comment frontmatter), projects with workspace + goal links, agents with role + instructionsFilePath, issues with assignee + project, routines with schedule + concurrencyPolicy, and provisioning steps in API dependency order. Used as the bootstrap issue description for the CEO.

### Paperclip API Flow (start-provision)

Connects to Paperclip API (auto-detects auth mode). Resolves the target company: creates a new one (with `companyDescription`) or, when `existingCompanyId` is passed, loads it via `getCompany` (existing-company runs skip company creation and skip cleanup on error). Resolves the CEO: reuses an active CEO on existing companies, otherwise creates one (with `instructionsFilePath`, adapter config). If direct agent creation is rejected because board approval is required, `createAgent` hires via `/agent-hires` and auto-approves. Finally creates a Bootstrap Issue (assigned to CEO, description = BOOTSTRAP.md content, title uses the resolved company name). The CEO then reads the bootstrap issue and creates goals, projects, agents, and issues as described in BOOTSTRAP.md.

Optional setting `disableBoardApprovalOnNewCompanies` (default `false`): when `true`, new companies are PATCHed to `requireBoardApprovalForNewAgents=false` right after creation for legacy fully-autonomous bootstrap behavior. Ignored for existing-company runs.

## Test Suites

Two separate test runners:
- `pnpm test` — vitest, `tests/**/*.spec.ts` — TypeScript plugin tests
- `pnpm test:logic` — `node --test`, `src/logic/*.test.js` — Plain-JS logic tests

## React Considerations

- All paths in agent `adapterConfig` must be absolute (agents may run in different cwd)
- Tailwind 4: use `wrap-break-word` not `break-words`
- `@ts-ignore` suppresses hints on the three plain-JS imports in `worker.ts`

## Legacy Note

This plugin was derived from [`@yesterday-ai/paperclip-plugin-company-wizard`](https://github.com/Yesterday-AI/paperclip-plugin-company-wizard), the standalone Ink-based CLI. The template system, assembly logic, and API client were carried over intact. The CLI entry points (`src/cli.jsx`, `src/app.jsx`, `src/headless.js`), Ink components, and old build config were removed. See `CHANGELOG.md` for the full v0.1.0 feature list.
