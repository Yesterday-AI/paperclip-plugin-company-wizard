# Clipper — Project Vision

## What

Clipper is a company-as-code bootstrapping CLI for the [Paperclip](https://github.com/paperclipai/paperclip) AI agent platform. It assembles ready-to-run company workspaces from modular, composable templates — turning the messy process of configuring agent roles, workflows, and processes into a single command.

Clipper supports two usage modes:
- **Interactive** — An Ink-based terminal wizard that walks through each configuration step (requires TTY).
- **Headless** — Pass `--name` and `--preset` (minimum) as CLI flags to skip the wizard entirely. Runs assembly and optional API provisioning with plain stdout. Designed for scripting, CI pipelines, and programmatic use by other agents.
- **AI wizard** — Pass `--ai "description"` to describe your company in natural language. Claude analyzes the description and auto-selects the best preset, modules, and roles. Requires `ANTHROPIC_API_KEY`.

## Why

The default Paperclip company setup is a blank slate: one CEO with a bootstrap prompt, no defined workflows, no process for generating issues, no review cycles. Every company starts from zero and reinvents the same patterns.

Clipper encodes organizational knowledge into reusable templates. Instead of hoping agents figure out how to collaborate, you start with proven structures — issue generation from roadmaps, auto-assignment of idle agents, stall detection, PR review flows — all wired up and ready.

## Core Idea: Gracefully Optimistic Architecture

Inspired by the [OpenClaw gateway architecture](https://x.com/cosmo_kappa/status/2023872554457591971) where channel adapters declare what they CAN do rather than what they MUST do, and the system degrades gracefully when features are absent.

Clipper applies the same principle to organizational capabilities: **the system never asks "which preset is this?" — it asks "which roles are present, and what can they do?"**

| OpenClaw Pattern | Clipper Equivalent |
| ---------------- | ------------------ |
| Channel declares capabilities | Module declares `capabilities` with `owners[]` chain |
| Missing feature → graceful degrade | Missing role → fallback owner takes over |
| Core is channel-agnostic | Assembly is preset-agnostic |
| Adapter is optional | Role is optional — base always works |

A company with just CEO + Engineer works fine — the CEO handles backlog, auto-assign, and stall detection. Add a Product Owner, and it automatically takes over backlog management as primary owner while the CEO becomes the fallback safety net. Add a Code Reviewer, and PR review workflows activate.

Every company starts functional and gets better as you add roles. No capability is ever "missing" — there's always someone responsible.

## Design Principles

- **Files, not config servers** — Company structure is markdown files on disk. Agents read them fresh every heartbeat. Edit a file, behavior changes next cycle.
- **Composable, not monolithic** — Modules are independent building blocks. Presets are just curated module combinations. Everything can be mixed, matched, and extended.
- **Opinionated defaults, easy overrides** — Templates encode best practices but every file is editable after generation. Clipper gets you started; you own the result.
- **Capability-based, not identity-based** — The system resolves "what can this company do?" based on present roles, not "which template was selected?" Roles declare capabilities, modules declare ownership chains, the assembly resolves at build time.
- **Primary/fallback ownership** — Every capability has an ownership chain. The most qualified present role owns it; less specialized roles serve as safety nets.
- **Shared skills, role-specific overrides** — Primary skills live in a shared `skills/` folder unless a role brings a genuinely different approach. Fallbacks are always role-specific.

## Architecture

```text
clipper/
├── src/
│   ├── cli.jsx                 # Entry point, flag parsing, renders <App>
│   ├── app.jsx                 # Wizard state machine (NAME → ... → DONE)
│   ├── components/             # One Ink component per wizard step
│   ├── logic/                  # Pure functions (assembly, resolution, loading)
│   └── api/                    # Paperclip API client + provisioning
├── templates/
│   ├── base/                   # Always-present roles (ceo, engineer)
│   ├── roles/                  # Optional roles (9: product-owner, code-reviewer, ui-designer, ux-researcher, cto, cmo, cfo, devops, qa)
│   ├── modules/                # Composable capabilities (14 modules)
│   │   ├── vision-workshop/    # Strategic foundation
│   │   ├── market-analysis/    # Market research
│   │   ├── hiring-review/      # Team gap analysis
│   │   ├── tech-stack/         # Technology evaluation
│   │   ├── architecture-plan/  # System + design system architecture
│   │   ├── github-repo/        # Git workflow
│   │   ├── pr-review/          # PR-based code review
│   │   ├── backlog/            # Backlog lifecycle and health
│   │   ├── auto-assign/        # Idle agent → issue matching
│   │   ├── stall-detection/    # Stuck handover detection
│   │   ├── brand-identity/     # Brand guidelines and visual identity
│   │   ├── user-testing/       # Usability evaluations
│   │   ├── ci-cd/              # CI/CD pipeline
│   │   └── monitoring/         # Observability and alerting
│   ├── presets/                # Curated combinations (fast, quality, rad, startup, research, full)
│   └── ai-wizard/             # Configurable prompts for --ai mode
│       ├── config-format.md   # JSON output format + selection rules
│       ├── single-shot-system.md  # System prompt for --ai "description"
│       ├── interview-system.md    # System prompt for --ai interview
│       └── messages.json      # User-turn instructions (interview flow)
├── dist/cli.mjs                # Built CLI (esbuild bundle)
└── esbuild.config.mjs          # Build config
```

Each module contains:
- `module.meta.json` — Capability ownership chains, activation rules, initial tasks, dependencies, permissions
- `skills/<skill>.md` — Shared primary skill (used by any primary owner)
- `agents/<role>/skills/` — Role-specific overrides and fallback variants
- `docs/` — Shared documentation injected into all agents

## Where This Is Going

See [ROADMAP.md](ROADMAP.md) for the full backlog. Key areas:

- **Excalidraw MCP integration** — Visual diagram generation as an agent skill
- **Process docs for more modules** — `auto-assign`, `hiring-review`, and others need `*-process.md` workflow guides (backlog done)
