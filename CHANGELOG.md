# Changelog

All notable changes to Clipper are documented here.

## [0.3.8] — 2026-03-xx

### Added

- **Inline goals** — Goals now live inside presets (`goals: []`) or modules (`goal: {}`), replacing the separate `templates/goals/` directory. Goals are collected automatically from the selected preset and modules — no manual selection step needed.
    - Presets `launch-mvp`, `build-api`, and `website-relaunch` — thin bundles that reference goal-carrying modules.
    - Modules `ci-cd`, `website-relaunch`, `build-api`, and `launch-mvp` carry module-specific inline goals.
    - `collectGoals()` merges goals from preset + selected modules at runtime.
    - `modulesWithActiveGoals()` identifies modules whose tasks should be skipped when their goal is active.
- **Hierarchical project resolution** — Inline goals support `project: boolean` (default true) to create dedicated Paperclip projects. Milestones can also have `project: true`. Issues resolve to the nearest ancestor project: milestone project → goal project → main project.
- **`assignTo: "user"` support** — Issues with `assignTo: "user"` are assigned to the board user (`assigneeUserId`), not left unassigned. For `local_trusted` instances the user is `local-board`; for authenticated instances the signed-in user's ID is resolved during `connect()`.
- **Website relaunch module** — `website-relaunch` module with `design-ingestion` and `site-audit` shared skills (with ui-designer role-specific override for design-focused audits), 5 milestones, and 11 issues covering the full relaunch lifecycle from audit through go-live.
- **Build API module** — `build-api` module with `api-design` skill, 4 milestones (schema → endpoints → auth → docs), and 8 issues. Requires `github-repo`.
- **Launch MVP module** — `launch-mvp` module with 4 milestones (scope → build → deploy → iterate) and 8 issues. No capabilities — pure project lifecycle structure.
- **Website relaunch preset** — `website-relaunch` preset bundling the module with github-repo, pr-review, backlog, auto-assign, stall-detection, UI Designer, and Product Owner.
- **`issuePrefix` in provision result** — `provisionCompany()` now returns the Paperclip-generated `issuePrefix` alongside `companyId`.
- **Provision test suite** — Unit tests for `provisionCompany()` covering inline goals, project hierarchy, milestones, partial failures, user tasks, and multiple goals.

- **Module-level `adapterOverrides`** — Modules can declare `"adapterOverrides": { "chrome": true }` (or any adapter key) in `module.meta.json`. During assembly, overrides are collected per role (for all capability owners in that module). During provisioning, overrides are merged into each agent's `adapterConfig`. This keeps role templates clean — Chrome, model overrides, etc. are applied only when the module that needs them is active.
- **`site-audit` capability expanded** — Owner chain now includes `ui-designer` as primary (design/content-focused audit), with `engineer` as fallback (technical audit). UI Designer gets a role-specific skill override for visual and content analysis. UI Designer role has `"chrome": true` in its base adapter config (visual analysis is inherent to the role). Engineer gets Chrome via the `website-relaunch` module's `adapterOverrides` only when that module is selected.
- **Explicit PDF visual analysis instructions** — `design-ingestion` skill now documents exactly how to read design files: Read tool with `pages` parameter for PDFs, direct Read for images. Includes fallback CLI tools (`markitdown`, `docling`, `pdffonts`, `exiftool`) for supplementing visual analysis with extracted metadata.
- **Separate visual/UX audit** — Website relaunch module now has two discovery issues: "Technical site audit" (engineer — URLs, tech stack, SEO) and "Visual and UX audit" (ui-designer — layout patterns, design tokens, content quality, accessibility, migration recommendations).

### Changed

- **Wizard simplified** — Removed the GOAL_TEMPLATES step. Goals are derived automatically from preset + module selections. Wizard is now 7 steps (was 8): NAME → GOAL → PROJECT → PRESET → MODULES → ROLES → SUMMARY.
- **`--goal-template` flag removed** — No longer needed since goals are inline in presets and modules.
- **Module task skipping** — When a module has an active inline goal, its `tasks[]` are skipped during assembly and provisioning. The goal's issues are the comprehensive replacement, preventing duplicate work.

### Removed

- `templates/goals/` directory — goal templates dissolved into presets and modules.
- `loadGoals()` function — replaced by `collectGoals()`.
- `StepGoalTemplates` component — no longer needed.

## [0.3.7] — 2026-03-12

### Changed

- **Template metadata renamed** — All metadata files renamed from `*.json` to `*.meta.json` (`role.meta.json`, `module.meta.json`, `preset.meta.json`) for clearer separation from content files.
- **Base roles consolidated** — `templates/base/` removed. CEO and Engineer now live in `templates/roles/` with a `"base": true` flag in their `role.meta.json`. The `baseName` parameter and preset `"base"` field are eliminated — base roles are discovered dynamically from metadata.
- **`buildAllRoles()` signature** — Now accepts an array of role objects (with `base` flag) instead of a hardcoded string array. Callers no longer need to know which roles are base.

### Added

- **Module permissions** — `module.meta.json` supports a `permissions` field declaring Paperclip API permissions required by capability owners (e.g., `"permissions": ["tasks:assign"]` on auto-assign). Used during provisioning to grant agents the permissions their modules need.
- **3 new roles** — `technical-writer` (developer docs, API refs, onboarding guides), `security-engineer` (threat modeling, OWASP, security reviews), `customer-success` (customer health, churn prevention, competitive intelligence from the customer perspective).
- **4 new modules** — `security-audit` (threat model + security review capabilities), `documentation` (project docs capability), `competitive-intel` (competitive tracking capability), `accessibility` (WCAG 2.2 audit capability). All follow the gracefully-optimistic pattern with full owner chains and fallback skills.
- **3 new presets** — `secure` (security-focused for regulated industries), `gtm` (go-to-market with competitive intel and brand identity), `content` (documentation and accessibility focused).
- **`division` field on roles** — Functional grouping (`leadership`, `engineering`, `design`, `product`) for wizard display and AI selection.
- **`tagline` field on roles** — One-liner personality summary for better wizard UX and AI wizard selection.

## [0.3.6] — 2026-03-11

### Added

- **Authenticated instance support** — `PaperclipClient` now auto-detects whether the Paperclip instance requires authentication. For `local_trusted` instances, nothing changes. For authenticated instances, Clipper signs in via Better Auth using board credentials.
    - `--api-email` / `--api-password` flags (or `PAPERCLIP_EMAIL` / `PAPERCLIP_PASSWORD` env vars).
    - `connect()` method probes the API, signs in if needed, and attaches the session cookie to all subsequent requests.
    - `Origin` header sent on all API requests (required by Better Auth and Paperclip's board mutation guard).
- **Docker workspace path remapping** (`--api-workspace-root`) — When Paperclip runs in Docker, local filesystem paths don't match the container's mount paths. This flag remaps all API-facing paths (agent `cwd`, `instructionsFilePath`, project workspace) to the Docker-side root.
    - Uses the actual assembled directory name (handles collision suffixes like `Minetris2` correctly).
    - Local file assembly is unaffected — only paths sent to the API are remapped.

## [0.3.5] — 2026-03-10

### Added

- **Heartbeat injection** — Modules can now extend agent HEARTBEAT.md files with recurring tasks.
    - Convention-based: if a module provides `agents/<role>/heartbeat-section.md`, it gets injected automatically.
    - 3 modules ship heartbeat sections: `stall-detection` (CEO), `auto-assign` (CEO + PO), `backlog` (CEO + PO).
    - Follows the gracefully-optimistic pattern — sections adapt based on which roles are present.
- **Dry run mode** (`--dry-run`) — Shows the resolved summary (company, preset, modules, roles, capabilities) and exits without writing files. Works in all modes: interactive wizard, headless, and AI wizard.
- **Backlog module** — Renamed `roadmap-to-issues` → `backlog`. Module now owns the full backlog lifecycle, not just the roadmap-to-issues transformation. Capability renamed to `backlog-health`.
    - `docs/backlog-process.md` — Full process definition: lifecycle, issue quality, sources, prioritization (P0–P3), health indicators, coordination.
    - `docs/backlog-template.md` — Living backlog artefact template: milestone tracking, roadmap table, issue categories, backlog snapshot, decisions log.
- **Doc reference pattern** — Established and documented a unified convention for how skills reference docs:
    - Own templates (`lowercase.md`) → reference directly (assembly guarantees existence).
    - Cross-module agent output (`UPPERCASE.md`) → always conditional with graceful fallback.
    - Documented in CLAUDE.md, README.md extending section.

### Fixed

- **AI wizard preview box** — Right border misalignment caused by hardcoded label width. Now computes per-label visual padding with ANSI-stripped lengths.
- **Cross-module doc references** — Audited all 14 modules. Fixed 2 non-compliant skills: `architecture-plan` (direct `TECH-STACK.md` ref) and `design-review` (direct `BRAND-IDENTITY.md` ref) now use conditional language.
- **Base role `role.json` leaking** — `copyDir` for base roles copied `.json` files into agent directories. Added `skipExt` option to exclude them.

### Changed

- Preset constraint warnings shown in interactive wizard (yellow `!` text below description).
- Module descriptions in wizard now show `activatesWithRoles` requirements. Summary warns about modules that will be skipped due to missing roles.
- All 6 presets updated for `roadmap-to-issues` → `backlog` rename.

## [0.3.4] — 2026-03-09

### Added

- **AI wizard mode** (`--ai`) — Let Claude configure your company setup.
    - **Interview mode** (`--ai`): 3 guided questions with iterative refinement — review summary, accept or revise.
    - **Single-shot mode** (`--ai "description"`): describe your company in natural language, get instant config.
    - Combine with `--api --start` for full programmatic integration in one command.
    - Configurable prompts in `templates/ai-wizard/` — edit to customize wizard behavior.
    - `--ai-model` flag to override the default model (`claude-opus-4-6`).
    - Requires `ANTHROPIC_API_KEY` environment variable.
- **Graceful API error handling** in AI wizard — specific messages for 401, 429, 529, and refusal errors.
    - Auto-retry for transient errors (rate limits, overload, network issues).
    - Interactive recovery in interview mode — revise your answer or quit instead of crashing.
- **Markdown rendering** in AI wizard terminal output — `**bold**`, `*italic*`, `` `code` `` rendered as ANSI styles.

### Fixed

- **Preset names truncated** in interactive selector — Ink flexbox compressed names when descriptions were long. Redesigned to single-line items with detail pane below.
- **Duplicate header lines** when navigating preset list — caused by variable-height list items triggering Ink re-render glitches.
- **Highlighted Enter line** in AI wizard input — background color leaked to the line after pressing Enter.

### Changed

- Default AI wizard model set to `claude-opus-4-6`.
- AI wizard prompts extracted from code to external templates (`templates/ai-wizard/`).

## [0.3.3] — 2026-03-08

### Added

- Capability ownership chains with graceful fallbacks — roles declare capabilities, assembly resolves primary/fallback at build time.
- 4 new modules: `brand-identity`, `user-testing`, `ci-cd`, `monitoring`.
- 4 new roles: CTO, CMO, CFO, DevOps Engineer, QA Engineer.

## [0.3.0] — 2026-03-08

### Added

- Headless mode (`--name` + `--preset`) for non-interactive use.
- API provisioning (`--api`, `--start`) for automated Paperclip setup.
- Module dependency resolution and auto-expansion.
- `rad` preset for rapid prototyping.
- Initial Ink-based interactive wizard.
