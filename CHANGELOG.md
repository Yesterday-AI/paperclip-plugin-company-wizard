# Changelog

All notable changes to the Company Wizard plugin are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
- New `templatesRepoUrl` plugin setting — GitHub tree URL for auto-downloading templates. Defaults to the Yesterday-AI/plugin-paperclip-company-wizard repo
- `templatesPath` now defaults to `~/.paperclip/plugin-templates`, auto-downloaded from `templatesRepoUrl` if missing; falls back to bundled templates
- `sync-plugin.sh` added — syncs built artifacts and updates `manifest_json` in the Paperclip DB so schema changes are picked up on restart

### Bug fixes

- Bootstrap issue is now set to `todo` immediately after creation (was `backlog`, which the CEO agent inbox endpoint doesn't return)
- `issues.update` capability added to manifest to support the status update
- Generated files are now written directly to `companiesDir` — removes the container/host path split and fixes incorrect paths in the bootstrap issue description
- Improved loading screen: spinner + explanation that templates may be downloaded on first load

---

## Prior art

This plugin is derived from [`@yesterday-ai/plugin-paperclip-company-wizard`](https://github.com/Yesterday-AI/plugin-paperclip-company-wizard), the standalone Clipper CLI. See that project's changelog for history prior to this plugin.
