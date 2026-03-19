# Contributing to Company Wizard

Thanks for your interest in contributing! Company Wizard is a [Paperclip](https://github.com/paperclipai/paperclip) plugin that bootstraps agent company workspaces from composable templates.

## Getting Started

```sh
git clone <repo-url>
cd clipper
pnpm install
pnpm build
```

## Development

```sh
pnpm build           # esbuild: worker + manifest + UI → dist/
pnpm dev             # watch mode (rebuilds on change)
pnpm test            # vitest: tests/**/*.spec.ts
pnpm test:logic      # node --test: src/logic/*.test.js
pnpm typecheck       # tsc --noEmit
```

Load the plugin in Paperclip by pointing to this directory (the `paperclipPlugin` field in `package.json` tells Paperclip where to find the built artifacts). After `pnpm build`, reload the plugin in the Paperclip UI — no reinstall required.

## Project Structure

```text
src/
├── worker.ts             # Plugin worker: actions (preview-files, start-provision, check-auth)
├── manifest.ts           # Plugin manifest (id, displayName, slots)
├── logic/                # Pure functions (assembly, resolution, template loading)
├── api/                  # Paperclip REST API client and provisioning
└── ui/
    ├── main.tsx          # UI entry point
    ├── context/          # WizardContext (state machine + reducer)
    └── components/       # React components (WizardShell, step components, ConfigReview)

templates/
├── roles/                # All roles with role.meta.json (base: true for always-present)
├── modules/              # Composable capabilities with module.meta.json
└── presets/              # Curated module+role combinations with preset.meta.json
```

## Adding Templates

### New module

See [docs/TEMPLATES.md](docs/TEMPLATES.md) for the full module schema. Key points:

- Every capability needs a shared skill in `skills/<skill>.md`
- Role-specific overrides go in `agents/<role>/skills/<skill>.md` (only when genuinely different)
- Fallback variants are always role-specific (`.fallback.md`)
- Add `node --test` tests in `src/logic/` if the module has non-trivial resolution logic

### New role

See [docs/TEMPLATES.md](docs/TEMPLATES.md). Map `paperclipRole` to a valid Paperclip enum value. Set `base: true` only for roles that belong in every company (only the CEO currently has `base: true`).

### New preset

See [docs/TEMPLATES.md](docs/TEMPLATES.md). Test that the module combination resolves correctly. Presets can include inline `goals[]` arrays with milestones and issues.

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Add or update tests for logic changes
- Run `pnpm test && pnpm test:logic` before submitting
- Update `docs/TEMPLATES.md` if you add modules, roles, or presets
- Update `CHANGELOG.md` with your changes

## Code Style

- TypeScript for plugin infrastructure (`src/worker.ts`, `src/manifest.ts`, `src/ui/`)
- ESM only (`type: "module"`)
- Plain JS for logic/API modules (`src/logic/`, `src/api/`) — JSDoc where helpful
- Prettier via pre-commit hook (lint-staged)

## Reporting Issues

Use GitHub Issues. Include:

- What you expected vs what happened
- Plugin version (from `package.json`)
- Node.js version (`node --version`)
- OS

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
