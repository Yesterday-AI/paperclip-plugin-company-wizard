# Clipper Roadmap

## Done

- Shared skills system — deduplicate primary skills, role-specific overrides only when genuinely different
- 14 modules: vision-workshop, market-analysis, hiring-review, tech-stack, architecture-plan, github-repo, pr-review, roadmap-to-issues, auto-assign, stall-detection, brand-identity, user-testing, ci-cd, monitoring
- 9 optional roles: product-owner, code-reviewer, ui-designer, ux-researcher, cto, cmo, cfo, devops, qa
- 6 presets: fast, quality, rad, startup, research, full
- Template catalogue in README
- Special characters in company names (stripped in PascalCase)
- `dangerouslySkipPermissions` default for claude_local agents
- `reportsTo` hierarchy wiring (CEO-first provisioning)
- Module dependency validation — auto-include required modules, prevent deselecting dependencies
- Non-interactive (headless) CLI mode — all wizard options as flags, no TTY required
- TUI modernization — step counter, consistent prompts, cleaner summary and output
- OSS repo polish — badges, CONTRIBUTING.md, CI, issue/PR templates, .editorconfig
- Remove legacy `create-company.mjs` CLI
- Wire devops into ci-cd and monitoring modules (capability ownership chains with engineer fallback)
- Wire qa into user-testing module (capability ownership chain)
- Wire cmo into brand-identity and market-analysis modules (fallback chains)
- Expand pr-review activatesWithRoles to include ui-designer, ux-researcher, qa, devops
- Wire ui-designer, ux-researcher, qa, devops into pr-review module (design review, UX review, QA review, infra review skill files)
- AI wizard mode — `--ai "description"` calls Claude API to auto-select preset, modules, and roles
- Heartbeat injection — modules extend agent HEARTBEAT.md with recurring tasks via convention-based `heartbeat-section.md`
- Auto-increment company directory name when directory already exists (Hyperion → Hyperion2 → Hyperion3)
- Show preset constraints in interactive wizard — yellow warnings when a preset has limitations (e.g., "not suited for multiple engineers")
- `activatesWithRoles` feedback — module descriptions show required roles, summary warns about modules that will be skipped
- `--dry-run` flag — show summary and exit without writing files (works in all modes: interactive, headless, AI wizard)

## In Progress

## Backlog

### Template System

- [ ] Excalidraw MCP server integration — add as a tool skill for agents to generate diagrams and architecture visuals

### Platform

- [ ] Paperclip workspace resolution fix — `resolveWorkspaceForRun()` returns null when manually triggering heartbeat (no issue/project context). Needs server-side fix.
