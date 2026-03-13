# Clipper Web — Roadmap

## Done

- [x] Project scaffold (Vite + React 19 + TS + Tailwind v4 + shadcn/ui)
- [x] Paperclip-identical OKLCh theme system
- [x] Build-time template loader (Vite virtual module)
- [x] Wizard state machine (useReducer, 11 steps)
- [x] Two-path onboarding: "Setup my own org" vs "Autonomous from idea" (Dotta pattern)
- [x] Manual wizard flow: Name → Goal → Project → Preset → Modules → Roles → Summary
- [x] AI wizard flow: 4-phase (Describe → Interview → Configure → Review)
- [x] Multi-turn AI interview mode (3-question guided conversation)
- [x] Module dependency logic (auto-select deps, block deselect)
- [x] Role gating (activatesWithRoles awareness)
- [x] CLI command generation for assembly + provisioning
- [x] Step indicator with progress bar
- [x] Editable review in both modes (inline edit fields, toggleable modules/roles)
- [x] Detailed configuration view (roles with enhances, modules with capabilities/tasks)
- [x] Shared ConfigReview component (used by both manual and AI flows)
- [x] Direct API provisioning — call Paperclip REST API from browser (skip CLI step)
- [x] Dark mode toggle

## Next

- [ ] **Paperclip plugin integration** — package as a `page` slot plugin
    - Blocked on: plugin system implementation in Paperclip (post-V1, see `doc/plugins/PLUGIN_SPEC.md`)
    - See: [PLUGIN-INTEGRATION.md](./PLUGIN-INTEGRATION.md) for full architecture plan
    - Steps when unblocked:
    1. Create `@paperclipai/plugin-clipper` package with manifest + worker + UI bundle
    2. Worker: template loading via `getData`, provisioning via `performAction`
    3. UI: export `WizardPage` for `page` slot, use `usePluginData`/`usePluginAction` bridge
    4. Manifest: declare capabilities (`companies.create`, `agents.create`, `ui.page.register`)
    5. Publish to npm, install via `pnpm paperclipai plugin install`

## Later

- [ ] Adapter model selection (general / specific for each role)
- [ ] Agent heartbeat rate configuration (predefined values for each role)
- [ ] Remaining agent configurations available in the wizard
- [ ] Provide agent tool to add modules and/or roles to the company after creation (considering human approval required setting)
- [ ] Generate multiple projects by the wizard / Add multiple projects (non-wizard)
- [ ] Generate additional issues by the wizard, if applicable (the current ones are all predefined in the modules)
- [ ] Org hierarchy chart preview
- [ ] Live preview of assembled markdown files during wizard
- [ ] BYO bring your own templates — pre-assembled complete teams as a third onboarding path (AGENTS.md, HEARTBEAT.md, reference docs ...)
    - Load from `paperclipai/companies` repo (Marketing Agency, Research Team, Startup Essentials), or
    - Define local template directory (e.g. `~/.paperclip/templates`)
    - Show as example cards alongside presets in StepPreset or as a new StepTemplate
    - Allow users to save their own company configs as reusable templates
    - Template format: full agent directory tree (AGENTS.md, SOUL.md, HEARTBEAT.md, TOOLS.md per role)
    - Needs: template import/export, local storage or API persistence for custom templates
- [ ] Template gallery / marketplace (browse community templates)
