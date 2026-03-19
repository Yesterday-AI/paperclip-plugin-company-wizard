# Company Wizard — Project Vision

## What

Company Wizard is a [Paperclip](https://github.com/paperclipai/paperclip) plugin for bootstrapping agent company workspaces from modular, composable templates. It provides an interactive wizard (manual and AI-powered paths) that assembles ready-to-run companies — roles, workflows, skills, process docs, heartbeat sections, and Paperclip API provisioning — all from a single UI.

The plugin runs inside the Paperclip board UI and ships with a complete template library: 14 presets, 22 modules, 17 optional roles (CEO is the only base role).

## Why

The default Paperclip company setup is a blank slate: one CEO with a bootstrap prompt, no defined workflows, no process for generating issues, no review cycles. Every company starts from zero and reinvents the same patterns.

Company Wizard encodes organizational knowledge into reusable templates. Instead of hoping agents figure out how to collaborate, you start with proven structures — issue generation from roadmaps, auto-assignment of idle agents, stall detection, PR review flows — all wired up and ready.

## Core Idea: Gracefully Optimistic Architecture

Inspired by the [OpenClaw gateway architecture](https://x.com/cosmo_kappa/status/2023872554457591971) where channel adapters declare what they CAN do rather than what they MUST do, and the system degrades gracefully when features are absent.

Company Wizard applies the same principle to organizational capabilities: **the system never asks "which preset is this?" — it asks "which roles are present, and what can they do?"**

| OpenClaw Pattern | Company Wizard Equivalent |
| ---------------- | ------------------------- |
| Channel declares capabilities | Module declares `capabilities` with `owners[]` chain |
| Missing feature → graceful degrade | Missing role → fallback owner takes over |
| Core is channel-agnostic | Assembly is preset-agnostic |
| Adapter is optional | Role is optional — base always works |

A company with just the CEO works fine — they handle backlog, auto-assign, and stall detection. Add an Engineer and they take over implementation. Add a Product Owner, and it automatically takes over backlog management as primary owner while the CEO becomes the fallback safety net. Add a Code Reviewer, and PR review workflows activate.

Every company starts functional and gets better as you add roles. No capability is ever "missing" — there's always someone responsible.

## Design Principles

- **Files, not config servers** — Company structure is markdown files on disk. Agents read them fresh every heartbeat. Edit a file, behavior changes next cycle.
- **Composable, not monolithic** — Modules are independent building blocks. Presets are just curated module combinations. Everything can be mixed, matched, and extended.
- **Opinionated defaults, easy overrides** — Templates encode best practices but every file is editable after generation (including in the wizard's preview step). Company Wizard gets you started; you own the result.
- **Capability-based, not identity-based** — The system resolves "what can this company do?" based on present roles, not "which template was selected?" Roles declare capabilities, modules declare ownership chains, the assembly resolves at build time.
- **Primary/fallback ownership** — Every capability has an ownership chain. The most qualified present role owns it; less specialized roles serve as safety nets.
- **Shared skills, role-specific overrides** — Primary skills live in a shared `skills/` folder unless a role brings a genuinely different approach. Fallbacks are always role-specific.

## Architecture

```text
src/
├── worker.ts                  # Plugin worker (actions: preview-files, start-provision, check-auth)
├── manifest.ts                # Plugin manifest (id, displayName, sidebar slot)
├── logic/                     # Pure functions (assembly, resolution, template loading, AI wizard)
├── api/                       # Paperclip REST API client + provisioning
└── ui/
    ├── context/               # WizardContext — state machine + reducer
    └── components/            # WizardShell, step components, ConfigReview (file preview)

templates/
├── roles/                     # All roles with role.meta.json
├── modules/                   # Composable capabilities (22 modules)
│   └── <module>/
│       ├── module.meta.json   # capabilities[], activatesWithRoles[], tasks[], goal?, adapterOverrides?
│       ├── skills/            # Shared primary skills
│       ├── agents/<role>/     # Role-specific overrides, fallbacks, heartbeat sections
│       └── docs/              # Shared docs injected into all agents
└── presets/                   # Curated combinations (14 presets, may include goals[])
```

Each module contains:
- `module.meta.json` — Capability ownership chains, activation rules, initial tasks, inline goal
- `skills/<skill>.md` — Shared primary skill (used by any primary owner)
- `agents/<role>/skills/` — Role-specific overrides and fallback variants
- `docs/` — Shared documentation injected into all agents

## Where This Is Going

See [ROADMAP.md](ROADMAP.md) for the full backlog.
