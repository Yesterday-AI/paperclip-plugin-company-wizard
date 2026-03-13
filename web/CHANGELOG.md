# Changelog — Clipper Web

All notable changes to the Clipper Web UI are documented here. For CLI changes, see the [main changelog](../CHANGELOG.md).

## [0.1.0] — 2026-03-13

### Added

- **Web UI wizard** — Full browser-based company creation wizard with the same template catalog as the CLI.
    - Step-by-step manual flow: name → goal → project → preset → modules → roles → summary → provision.
    - AI wizard flow: describe → interview (or quick generate) → review → provision.
- **AI wizard** — Two modes for AI-powered configuration:
    - **Interview mode** — 3-question guided conversation with Claude, builds context iteratively.
    - **Quick generate** — Single-shot description, instant configuration.
    - Skip button during interview to generate config early.
    - AI explanation text displayed above the generated config review.
- **Real-time provisioning** — SSE-streamed progress log during company assembly and API provisioning.
- **ConfigReview component** — Editable summary with inline editing for all fields, hover cards with full module/role details (capabilities, tasks, enhances, adapter config).
- **Dark/light mode** — System preference detection with manual toggle (persisted to localStorage). Flash-free via inline script before React hydrates.
- **Template catalog** — Vite plugin loads presets, modules, and roles from `templates/` at build time as a virtual module.
- **Provisioning plugin** — Vite server-side plugin handles assembly + Paperclip API provisioning with Docker path translation.
- **Authenticated instance support** — Auto-detects `local_trusted` vs authenticated Paperclip instances.
- **Docker path mapping** — `PAPERCLIP_WORKDIR_HOST` / `PAPERCLIP_WORKDIR_CONTAINER` env vars for bind-mount path translation.

### UI Details

- **Project name defaults** to company name when left empty.
- **Module selection** — Shows description, capability count with owner chains, task count, dependency requirements. Scrollable list.
- **Role selection** — Shows division badge, tagline, reports-to chain, and enhances list (when selected). Scrollable list.
- **Preset selection** — Scrollable list with module/role counts and constraint warnings.
- **Done screen** — Shows goal, project, team, modules, issue count, preset, and company ID.
- **Onboarding** — Two-path selection (manual wizard vs AI-powered) with feature descriptions.

### Architecture

- React + Vite + Tailwind CSS v4 (with shadcn/ui primitives).
- State machine via `useReducer` context (`WizardContext.tsx`).
- Shared CLI logic — dynamically imports `assembleCompany()` and `provisionCompany()` from CLI source.
- AI wizard calls Anthropic API directly from browser (requires `ANTHROPIC_API_KEY`).

### Known Limitations (pre-plugin)

- Runs as a standalone Vite dev server (not embedded in Paperclip UI).
- Requires separate `ANTHROPIC_API_KEY` for AI wizard.
- Writes files via host filesystem + bind-mount (not plugin SDK).
- Template catalog bundled at build time (not dynamically loaded).

See [PLUGIN-INTEGRATION.md](PLUGIN-INTEGRATION.md) for the migration plan once the Paperclip plugin system ships.
