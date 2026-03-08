# Clipper — Project Vision

## What

Clipper is a company-as-code bootstrapping CLI for the [Paperclip](https://github.com/paperclipai/paperclip) AI agent platform. It assembles ready-to-run company workspaces from modular, composable templates — turning the messy process of configuring agent roles, workflows, and processes into a single command.

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

A company with just CEO + Engineer works fine — the CEO handles roadmap-to-issues, auto-assign, and stall detection. Add a Product Owner, and it automatically takes over backlog management as primary owner while the CEO becomes the fallback safety net. Add a Code Reviewer, and PR review workflows activate.

Every company starts functional and gets better as you add roles. No capability is ever "missing" — there's always someone responsible.

## Design Principles

- **Files, not config servers** — Company structure is markdown files on disk. Agents read them fresh every heartbeat. Edit a file, behavior changes next cycle.
- **Zero dependencies** — The CLI is a single Node.js script with no npm dependencies. Runs anywhere Node 18+ exists.
- **Composable, not monolithic** — Modules are independent building blocks. Presets are just curated module combinations. Everything can be mixed, matched, and extended.
- **Opinionated defaults, easy overrides** — Templates encode best practices but every file is editable after generation. Clipper gets you started; you own the result.
- **Capability-based, not identity-based** — The system resolves "what can this company do?" based on present roles, not "which template was selected?" Roles declare capabilities, modules declare ownership chains, the assembly resolves at build time.
- **Primary/fallback ownership** — Every capability has an ownership chain. The most qualified present role owns it; less specialized roles serve as safety nets.

## Architecture

```text
clipper/
├── create-company.mjs          # The CLI — interactive prompts → assembled workspace
├── templates/
│   ├── base/                   # Always-present roles (ceo, engineer)
│   ├── roles/                  # Optional roles (product-owner, code-reviewer)
│   ├── modules/                # Composable capabilities
│   │   ├── github-repo/        # Git workflow
│   │   ├── pr-review/          # PR-based code review
│   │   ├── roadmap-to-issues/  # Backlog generation from goals
│   │   ├── auto-assign/        # Idle agent → unassigned issue matching
│   │   └── stall-detection/    # Stuck handover detection
│   └── presets/                # Curated combinations (fast, quality)
```

Each module contains:
- `module.json` — Capability ownership chains, activation rules, initial tasks
- `agents/<role>/skills/` — Primary and fallback skill variants
- `docs/` — Shared documentation injected into all agents

## Where This Is Going

- **API provisioning** — Create the company and agents directly via the Paperclip API instead of manual UI setup
- **More modules** — Testing workflows, deployment pipelines, documentation generation, sprint cycles
- **More roles** — CTO, Designer, DevOps, Researcher — each extending capabilities gracefully
- **Community templates** — Third-party modules and presets shared via npm or git
- **Goal templates** — Pre-built company goals with matching roadmaps and initial issue sets
- **Runtime capability awareness** — Agents know at runtime which capabilities their company has, enabling smarter handover decisions (currently resolved at build time only)
- **Formal capability declarations per role** — Roles declare machine-readable capabilities (not just human-readable `enhances[]` text), enabling automatic module activation and dependency resolution
