# Changelog

All notable changes to Clipper are documented here.

## [0.3.5] — 2026-03-09

### Added

- **Heartbeat injection** — Modules can now extend agent HEARTBEAT.md files with recurring tasks.
    - Convention-based: if a module provides `agents/<role>/heartbeat-section.md`, it gets injected automatically.
    - 3 modules ship heartbeat sections: `stall-detection` (CEO), `auto-assign` (CEO + PO), `roadmap-to-issues` (CEO + PO).
    - Follows the gracefully-optimistic pattern — sections adapt based on which roles are present.
- **Dry run mode** (`--dry-run`) — Shows the resolved summary (company, preset, modules, roles, capabilities) and exits without writing files. Works in all modes: interactive wizard, headless, and AI wizard.

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
