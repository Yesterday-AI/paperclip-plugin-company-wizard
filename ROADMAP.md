# Company Wizard Roadmap

## Done

- Shared skills system — deduplicate primary skills, role-specific overrides only when genuinely different
- 26 modules: vision-workshop, market-analysis, hiring-review, tech-stack, architecture-plan, github-repo, pr-review, backlog, auto-assign, stall-detection, brand-identity, user-testing, ci-cd, monitoring, competitive-intel, documentation, security-audit, accessibility, website-relaunch, build-api, launch-mvp, codebase-onboarding, triage, dependency-management, release-management, game-design
- 17 optional roles: product-owner, code-reviewer, ui-designer, ux-researcher, cto, cmo, cfo, devops, qa, technical-writer, security-engineer, customer-success, game-designer, level-designer, game-artist, audio-designer
- 15 presets: fast, quality, rad, startup, research, full, secure, gtm, content, launch-mvp, build-api, website-relaunch, repo-maintenance, build-game, launch-pack
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
- `companyDescription` field — AI wizard generates comprehensive company descriptions, passed to Paperclip API
- AI wizard prompt overhaul — explicit role instructions (engineer not base), interview guidance, information preservation, all-inclusive module/role lists
- Preset role merging — AI wizard merges preset roles with AI-selected roles
- `launch-pack` preset — full executive team launch with CTO + CMO
- `repo-maintenance` preset — custodial maintenance for existing repos
- `build-game` preset — game development with Game Designer, Game Artist, Audio Designer
- 4 maintenance modules: codebase-onboarding, triage, dependency-management, release-management
- `game-design` module — GDD creation, mechanics design, balancing
- 8 new optional roles: technical-writer, security-engineer, customer-success, game-designer, level-designer, game-artist, audio-designer
- Multi-goal/project support — `goals[]` and `projects[]` arrays replace singular fields; AI wizard generates hierarchical goals with `parentGoal`; projects linked to goals via `goals[]`
- Preset module merging — AI wizard merges preset modules with AI-selected ones (was only merging roles)
- Preset roles in AI catalog — `buildCatalog()` shows roles per preset so AI knows what each preset includes
- BOOTSTRAP.md overhaul — hierarchical goal tree, full issue details (descriptions, priority), project annotations, routines with cron schedules, correct Paperclip API provisioning steps
- Milestones → subgoals — template system aligned with Paperclip API (multi-level goals with `parentId` instead of invented milestones). `tasks` → `issues`, `goal.issues` moved to module level
- Routines in templates — 6 modules define `routines[]` with cron schedules (stall-detection, auto-assign, backlog, ci-cd, build-api, website-relaunch)
- `createRoutine()` + `createRoutineTrigger()` API client methods
- Graceful error handling — all worker actions return `{ error }` instead of throwing, preventing generic 502s. `PaperclipClient` wraps network errors with actionable messages (wrong port, connection refused). AI wizard shows API key warning on mount.
- Existing-company provisioning — wizard can target an existing Paperclip company via `existingCompanyId` (paste in ConfigReview). Reuses an active CEO if present, otherwise hires one. Partial-failure cleanup no longer deletes existing companies.
- Approval-aware agent hiring — `createAgent()` falls back to `POST /agent-hires` when direct creation requires board approval, then auto-approves via `/approvals/{id}/approve`. Pending approval IDs surfaced in logs on auto-approve failure.
- `disableBoardApprovalOnNewCompanies` plugin setting — optional compatibility mode that PATCHes new companies to disable mandatory board approval for new agents (default `false`, preserves approval-gated policies).

## In Progress

_(nothing currently in progress)_

## Backlog

### Template System

### Platform

- [ ] Paperclip workspace resolution fix — `resolveWorkspaceForRun()` returns null when manually triggering heartbeat (no issue/project context). Needs server-side fix.
