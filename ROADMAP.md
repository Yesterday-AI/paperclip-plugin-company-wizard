# Clipper Roadmap

## Done

- Shared skills system — deduplicate primary skills, role-specific overrides only when genuinely different
- 21 modules: vision-workshop, market-analysis, hiring-review, tech-stack, architecture-plan, github-repo, pr-review, backlog, auto-assign, stall-detection, brand-identity, user-testing, ci-cd, monitoring, competitive-intel, documentation, security-audit, accessibility, website-relaunch, build-api, launch-mvp
- 9 optional roles: product-owner, code-reviewer, ui-designer, ux-researcher, cto, cmo, cfo, devops, qa
- 12 presets: fast, quality, rad, startup, research, full, secure, gtm, content, launch-mvp, build-api, website-relaunch
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
- Rename `roadmap-to-issues` → `backlog` — module now owns the full backlog lifecycle, not just the roadmap-to-issues transformation. Capability renamed to `backlog-health`. Added `docs/backlog-process.md` process definition.
- Module process docs — modules that define workflows ship a `*-process.md` in `docs/` explaining the full process for all agents (complementing role-specific skills)
- Inline goals — goals dissolved from separate `templates/goals/` into presets (`goals[]`) and modules (`goal`). `collectGoals()` merges at runtime. Module tasks skipped when goal is active.
- Hierarchical project resolution — goals and milestones can create dedicated projects. Issues resolve: milestone project → goal project → main project.
- `assignTo: "user"` support — issues assigned to board user via `assigneeUserId` (resolved during API connect)
- Website relaunch module — `website-relaunch` with design-ingestion + site-audit skills (ui-designer override), 5 milestones, 10 issues
- Build API module — `build-api` with api-design skill, 4 milestones, 8 issues
- Launch MVP module — `launch-mvp` with 4 milestones, 8 issues (pure lifecycle structure)
- Presets `launch-mvp`, `build-api`, and `website-relaunch` — thin bundles referencing goal-carrying modules
- Chrome enabled by default for UI Designer roles

## In Progress

_(nothing currently in progress)_

## Backlog

### Template System

### Platform

- [ ] Paperclip workspace resolution fix — `resolveWorkspaceForRun()` returns null when manually triggering heartbeat (no issue/project context). Needs server-side fix.
