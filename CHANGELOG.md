# Changelog

All notable changes to the Company Wizard plugin are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.1.11] — 2026-03-29

### Added

- Bootstrap instructions loaded from `templates/bootstrap-instructions.md` — editable without code changes

### Changed

- BOOTSTRAP.md field names now match Paperclip API exactly: `parentId` (was `parentGoal`), `assigneeAgentId` (was `assignee`), `projectId` (was `project`), `goalIds` (was `goals`)
- References use `→ "name"` syntax to signal the CEO must resolve names to UUIDs
- Company description rendered under `## Company` heading

### Fixed

- BOOTSTRAP.md metadata switched from `<!-- -->` HTML comments to visible `- **key**: value` bullet lists — HTML comments were stripped by Paperclip's markdown renderer

---

## [0.1.9] — 2026-03-29

### Added

- **Routines** — new `routines[]` field in module/preset meta.json for recurring scheduled agent work. Modules `stall-detection`, `auto-assign`, `backlog`, `ci-cd`, `build-api`, and `website-relaunch` now define routines with cron schedules
- `## Routines` section in BOOTSTRAP.md with `<!-- assignee, schedule, concurrencyPolicy -->` frontmatter per routine
- `createRoutine()` and `createRoutineTrigger()` methods in API client
- Subgoal expansion — `goal.subgoals[]` are expanded into the goal hierarchy as nested goals with `level: "team"` and `parentGoal`
- Robust JSON parser — string-aware brace tracking, trailing comma cleanup, markdown code fence fallback, `console.error` debug logging on parse failure
- ConfigReview file grouping — agent files grouped by `agents/<role>/` instead of flat `agents/`
- "Update templates" button on onboarding screen — `refresh-templates` worker action deletes cached templates and re-downloads from GitHub

### Changed

- **Template schema harmonized with Paperclip API** — `milestones[]` → `subgoals[]` (with `id`, `title`, `level`, `description`); `goal.issues[]` removed (issues belong to projects, not goals); `tasks[]` → `issues[]` everywhere
- BOOTSTRAP.md uses `<!-- -->` HTML-comment frontmatter instead of code fences (safe when descriptions contain code blocks)
- BOOTSTRAP.md issue frontmatter: only `assignee` + `project` (removed `milestone`)
- BOOTSTRAP.md provisioning steps show correct goal `level` (not hardcoded to `company`)
- `assembleCompany()` returns `initialIssues` + `initialRoutines` (was `initialTasks`)
- `createGoal()` API client now accepts `status` and `ownerAgentId` fields
- `ai-chat` action: `max_tokens` increased from 1024 to 16384

### Removed

- `GoalMilestone` typedef, `GoalIssue` typedef, `modulesWithActiveGoals()` export
- `milestone` field on template issues
- `completionCriteria` field on milestones (folded into subgoal `description`)
- `generateBootstrapDescription()` — bootstrap issue uses BOOTSTRAP.md directly
- `skipTaskModules` logic — goals no longer contain issues, so no skip needed

---

## [0.1.7] — 2026-03-29

### Changed

- `ai-chat` action: `max_tokens` increased from 1024 to 16384 — prevents truncated JSON when AI generates thorough goal descriptions with the new `goals[]`/`projects[]` format

### Fixed

- JSON parser in `tryExtractConfig` now string-aware: brace-depth tracker skips `{`/`}` inside quoted strings, preventing false matches on text like `"Build API with {userId}"`
- JSON parser handles trailing commas, line comments, unescaped newlines/tabs in AI-generated JSON
- JSON parser falls back to markdown code fence extraction (`\`\`\`json ... \`\`\``) when brace tracking finds no valid config
- Added `console.error` debug logging when config parsing fails — raw AI response is now visible in browser devtools

---

## [0.1.6] — 2026-03-29

### Changed

- Bootstrap issue now uses BOOTSTRAP.md content directly as its description — the CEO gets the full company spec, goals, projects, agents, issues, and provisioning steps instead of a generic "set up workspace" message

### Removed

- `generateBootstrapDescription()` — redundant; BOOTSTRAP.md IS the bootstrap issue

---

## [0.1.5] — 2026-03-29

### Added

- **Multi-goal support** — `goals[]` array replaces singular `goal` field; AI wizard generates hierarchical goals with `parentGoal` for sub-goals
- **Multi-project support** — `projects[]` array replaces singular `project` field; projects linked to goals via `goals[]` array (matches Paperclip API `goalIds`)
- `WizardProject` interface (`name`, `description`, `goals[]`) and `Goal.parentGoal` field
- `companyDescription` rendered in BOOTSTRAP.md (was previously only sent to the API)
- Full issue details in BOOTSTRAP.md: descriptions, `[priority]` annotations, `_(milestone: id)_` references
- Full milestone details in BOOTSTRAP.md: descriptions and `_Done when:_` completion criteria
- Preset roles shown in AI wizard catalog — `buildCatalog()` now includes `roles: engineer, ...` for each preset so the AI knows what selecting a preset implies

### Changed

- **BOOTSTRAP.md structure** — unified hierarchy: Goals (### top-level, #### sub-goals) → Projects (with workspace + goal links) → Agents (instructionsFilePath only) → Issues (grouped by goal, annotated with target project) → Provisioning Steps (explicit API creation order)
- **AI wizard config format** — `goal`/`goalDescription`/`project`/`projectDescription` (flat) → `goals: [{title, description, parentGoal?}]` + `projects: [{name, description, goals[]}]` (backward compatible with old format)
- **AI wizard prompts** — `goalDescription` instructions now demand thorough, spec-level detail; system prompts explain `goals[]`/`projects[]` format
- `assembleCompany()` signature — `goal`/`project`/`goals` → `userGoals`/`userProjects`/`inlineGoals`; module inline goals auto-linked as sub-goals of the main user goal
- Agent listings in BOOTSTRAP.md show `instructionsFilePath` only (removed legacy `cwd` field)
- Issues in BOOTSTRAP.md are grouped by goal with `_Project: "name"_` annotation instead of `goalId →` references (issues link to projects, not goals)
- Ungrouped module tasks rendered under "Initial tasks" heading (not under main goal title)

### Fixed

- AI wizard silently dropped preset modules — only roles were merged with AI-selected ones; now both modules and roles are defensively merged from the preset definition
- AI wizard rarely selected engineer — `buildCatalog()` listed presets with modules but not roles, so the AI didn't see that selecting a preset doesn't auto-add its roles
- BOOTSTRAP.md had two confusing issue sections ("Goal: ..." with issues and separate "Initial Tasks") — now unified under single `## Issues`
- `project` and `projectDescription` from AI wizard config were silently ignored — never reached `assembleCompany` or BOOTSTRAP.md

---

## [0.1.4] — 2026-03-28

### Added

- `companyDescription` field — AI wizard now generates a comprehensive 2-4 paragraph company description that's stored in `WizardContext` and passed to the Paperclip API when creating the company
- Preset role merging — AI wizard merges preset roles with AI-selected roles so preset roles aren't lost when the AI omits them
- Interview guidance — interview system prompt now covers what to ask about (stage, quality vs speed, team needs, repo details) and skips questions already answered
- Information preservation section — prompts instruct the AI to write thorough `companyDescription`, `goalDescription`, and `projectDescription` fields as the company's permanent record
- `launch-pack` preset — full executive team launch with CTO + CMO: strategy, tech, and marketing from day one
- 4 new modules: `codebase-onboarding` (audit existing codebases), `triage` (classify inbound GitHub issues), `dependency-management` (CVE scanning, safe patching), `release-management` (semver, changelogs, tagging)
- `repo-maintenance` preset — custodial maintenance for existing repos using the new modules

### Changed

- AI wizard config format: `extraModules`/`extraRoles` → `modules`/`roles` (all-inclusive lists that include preset defaults)
- AI wizard prompts now explicitly document that `engineer` is NOT a base role and must be listed for software projects
- Interview start message now includes the user's initial description (`{{DESCRIPTION}}`) so the AI has context from turn one
- Generate-config message reminds the AI to include all non-base roles and write thorough descriptions
- Single-shot system prompt restructured with numbered steps, "How Roles Work" section, and information preservation guidelines
- Template counts: 15 presets, 26 modules, 17 optional roles

### Fixed

- AI wizard no longer silently drops preset roles — `StepAiWizard` merges preset and AI-selected role arrays before dispatching
- Interview-mode template now passes `{{DESCRIPTION}}` in the start message (was previously blank, losing user context)

## [0.1.3] — 2026-03-28

### Added

- `publish:npm` and `prepublishOnly` scripts in `package.json` for streamlined npm publishing
- `files` whitelist in `package.json` to control published package contents

## [0.1.2] — 2026-03-25

### Changed

- Updated plugin references and repository links to point to the new repo
- Updated favicon path and added new favicon SVG
- Updated author name in manifest

## [0.1.1] — 2026-03-22

### Changed

- Version bump and manifest updates

---

## [0.1.0] — 2026-03-18

Initial release of the plugin. Replaces the standalone Clipper CLI with a native Paperclip plugin.

### Added

- Interactive wizard UI (manual and AI-powered paths) for bootstrapping agent companies
- Preset, module, and role selection with hover-card detail previews and inline editing
- **Preview generated files** — collapsible file browser in the review step; each `.md` file can be expanded and edited before provisioning
- `preview-files` worker action: assembles to a temp dir and returns file contents without writing to disk
- `fileOverrides` support in `start-provision`: edits made in the UI are applied to assembled files before the API calls
- CEO adapter configuration (adapter type, working directory, model) in the wizard
- Real-time provisioning log streamed from the worker
- `check-auth` action for surfacing credential issues early (used by the summary step)
- Self-contained: templates, assembly logic, and API client are all bundled inside the plugin
- CI workflow (GitHub Actions) with pnpm, build, vitest, and node:test logic suite
- Pre-commit hook running prettier via lint-staged

### Template system

- 14 presets (fast, quality, rad, startup, research, full, secure, gtm, content, launch-mvp, build-api, website-relaunch, repo-maintenance, build-game)
- 22 modules across strategy, maintenance, and engineering workflow categories
- 17 optional roles (CEO is the only base role; Engineer is optional but included in most presets)
- All 22 modules now have `description` fields (previously only presets and roles had them)
- Engineer moved from base role to optional; added to 13 presets and to `pr-review`'s `activatesWithRoles`; task `assignTo` falls back to CEO if the named role is absent
- Gracefully optimistic capability resolution: responsibilities shift automatically as roles are added
- Inline goals with milestones and issues (from presets and modules)
- Heartbeat section injection into assembled `HEARTBEAT.md` files

### Configuration

- New `companiesDir` plugin setting — where assembled company workspaces are written. Defaults to `~/.paperclip/instances/default/companies`
- New `templatesRepoUrl` plugin setting — GitHub tree URL for auto-downloading templates. Defaults to the Yesterday-AI/paperclip-plugin-company-wizard repo
- `templatesPath` now defaults to `~/.paperclip/plugin-templates`, auto-downloaded from `templatesRepoUrl` if missing; falls back to bundled templates
- `sync-plugin.sh` added — syncs built artifacts and updates `manifest_json` in the Paperclip DB so schema changes are picked up on restart

### Bug fixes

- Bootstrap issue is now set to `todo` immediately after creation (was `backlog`, which the CEO agent inbox endpoint doesn't return)
- `issues.update` capability added to manifest to support the status update
- Generated files are now written directly to `companiesDir` — removes the container/host path split and fixes incorrect paths in the bootstrap issue description
- Improved loading screen: spinner + explanation that templates may be downloaded on first load

---

## Prior art

This plugin is derived from [`@yesterday-ai/paperclip-plugin-company-wizard`](https://github.com/Yesterday-AI/paperclip-plugin-company-wizard), the standalone Clipper CLI. See that project's changelog for history prior to this plugin.
