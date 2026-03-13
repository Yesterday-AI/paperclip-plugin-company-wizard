# Clipper → Paperclip Plugin Integration

> Research findings and implementation plan for packaging Clipper Web as a Paperclip plugin.
> Based on analysis of `doc/plugins/PLUGIN_SPEC.md` (1,617 lines) in the Paperclip repo.

## Status

**Plugin system is fully specified but not yet implemented.** It is explicitly post-V1. No SDK, no worker runtime, no UI slot mounting infrastructure, no example plugins exist yet.

- Spec: `doc/plugins/PLUGIN_SPEC.md` (Paperclip repo)
- Comparison: `doc/plugins/ideas-from-opencode.md` (Paperclip repo)
- PR reference: https://github.com/paperclipai/paperclip/pull/432

## Plugin Architecture Overview

### Extension Classes

Paperclip distinguishes two extension types:

1. **Platform Modules** — trusted, in-process (agent adapters, storage providers, etc.)
2. **Plugins** — installable, out-of-process extensions with capability gates

Clipper would be a **Plugin** (category: `workspace` + `ui`).

### Process Model

- One Node worker process per plugin, communicating with host via **JSON-RPC on stdio**
- UI bundles loaded separately into the Paperclip React app via extension slots
- Worker and UI communicate through a bridge (`usePluginData`, `usePluginAction`)

### Plugin File Structure

```
@paperclipai/plugin-clipper/
├── package.json
│   └── paperclipPlugin: { manifest, worker, ui }
├── src/
│   ├── manifest.ts
│   ├── worker.ts          # JSON-RPC handler
│   └── ui/                # React components
│       ├── index.ts       # Named exports for slots
│       └── ...            # Our existing wizard components
└── dist/
    ├── manifest.js
    ├── worker.js
    └── ui/
```

### Installation

Plugins are npm packages installed per-instance:

```bash
pnpm paperclipai plugin install @paperclipai/plugin-clipper
```

Installed into `~/.paperclip/instances/default/plugins/`. **Not** checked into the Paperclip repo — separate package.

## Manifest

```ts
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

export default {
  id: "@paperclipai/plugin-clipper",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Company Creator",
  description: "AI-powered wizard to bootstrap agent companies from composable templates",
  categories: ["workspace", "ui"],
  minimumPaperclipVersion: "1.1.0",

  capabilities: [
    // Read templates and existing data
    "companies.read",
    "projects.read",
    "agents.read",
    "goals.read",
    "issues.read",
    // Create new entities during provisioning
    "companies.create",
    "projects.create",
    "agents.create",
    "goals.create",
    "issues.create",
    // Plugin state for saved templates
    "plugin.state.read",
    "plugin.state.write",
    // UI slot
    "ui.page.register",
    "ui.sidebar.register",
  ],

  entrypoints: {
    worker: "dist/worker.js",
    ui: "dist/ui/",
  },

  ui: {
    slots: [
      {
        type: "page",
        id: "company-wizard",
        displayName: "Company Creator",
        exportName: "WizardPage",
      },
      {
        type: "sidebar",
        id: "company-wizard-link",
        displayName: "Create Company",
        exportName: "SidebarLink",
      },
    ],
  },
} satisfies PaperclipPluginManifestV1;
```

## Worker

The worker handles template loading and provisioning — the "backend" of the plugin:

```ts
import { definePlugin } from "@paperclipai/plugin-sdk";

export default definePlugin({
  async setup(ctx) {
    // Serve template data to the UI
    ctx.data.register("templates", async () => {
      // Load from bundled templates (or from a configurable path)
      return { presets, modules, roles };
    });

    // Provisioning action — replaces CLI command generation
    ctx.actions.register("provision", async (params) => {
      const { companyName, goal, project, modules, roles, presetName } = params;

      // Use Paperclip API directly (worker has SDK access)
      const company = await ctx.api.companies.create({ name: companyName });
      const goalEntity = await ctx.api.goals.create({ companyId: company.id, title: goal.title, description: goal.description });
      const projectEntity = await ctx.api.projects.create({ companyId: company.id, name: project.name });

      // Create agents from role data
      for (const role of resolvedRoles) {
        await ctx.api.agents.create({ companyId: company.id, ...roleConfig });
      }

      // Create initial issues from module tasks
      for (const task of resolvedTasks) {
        await ctx.api.issues.create({ companyId: company.id, goalId: goalEntity.id, ...task });
      }

      return { companyId: company.id, goalId: goalEntity.id, projectId: projectEntity.id };
    });

    // Save/load user templates
    ctx.data.register("saved-templates", async () => {
      return await ctx.state.get({ scope: "instance", key: "user-templates" }) ?? [];
    });

    ctx.actions.register("save-template", async (params) => {
      const templates = await ctx.state.get({ scope: "instance", key: "user-templates" }) ?? [];
      templates.push(params.template);
      await ctx.state.set({ scope: "instance", key: "user-templates" }, templates);
    });
  },
});
```

## UI Changes Required

### Current → Plugin Migration

| Current (standalone) | Plugin version |
|---|---|
| `virtual:clipper-templates` Vite plugin | `usePluginData("templates")` hook |
| CLI command generation in StepProvision | `usePluginAction("provision")` |
| `localStorage` for API key | Not needed (worker has API access) |
| `fetch("api.anthropic.com")` for AI wizard | Keep as-is (browser-side, user's own key) |
| Standalone `index.html` + Vite dev server | Bundled as plugin UI, loaded into Paperclip shell |

### What Stays the Same

- `WizardContext` state machine — no changes
- All step components — no changes
- `ConfigReview` — no changes
- AI wizard interview flow — no changes (uses user's Anthropic key directly)

### What Changes

1. **Template source** — replace Vite virtual module with plugin data bridge:
   ```tsx
   // Before
   import { presets, modules, roles } from "virtual:clipper-templates";

   // After
   const { data: templates } = usePluginData("templates");
   ```

2. **Provisioning** — replace CLI generation with direct action:
   ```tsx
   // Before: generate CLI command string

   // After
   const provision = usePluginAction("provision");
   await provision({ companyName, goal, project, modules, roles });
   ```

3. **Entry point** — export named components instead of rendering to DOM:
   ```tsx
   // Before (main.tsx)
   createRoot(document.getElementById("root")!).render(<App />);

   // After (ui/index.ts)
   export function WizardPage() {
     return (
       <WizardProvider templates={usePluginData("templates")}>
         <WizardShell />
       </WizardProvider>
     );
   }
   export function SidebarLink() { /* ... */ }
   ```

4. **Build** — dual output (standalone Vite build + plugin UI bundle):
   ```json
   {
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "build:plugin": "vite build --config vite.plugin.config.ts"
     }
   }
   ```

## Capability Model

### Required Capabilities

| Capability | Why |
|---|---|
| `companies.create` | Create the company entity |
| `goals.create` | Create the top-level goal |
| `projects.create` | Create the project workspace |
| `agents.create` | Create agent entities for each role |
| `issues.create` | Create initial tasks from module definitions |
| `companies.read` | Check for name conflicts |
| `ui.page.register` | Mount the wizard as a full page |
| `ui.sidebar.register` | Add "Create Company" link to sidebar |
| `plugin.state.read/write` | Persist user-saved templates |

### Not Needed

- `events.subscribe` — no real-time event handling
- `jobs.schedule` — no background tasks
- `webhooks.receive` — no external integrations
- `agent.tools.register` — no agent tooling
- `secrets.read-ref` — API key handled browser-side for AI wizard

## Timeline & Dependencies

### Blocked On (Paperclip side)

1. `@paperclipai/plugin-sdk` package — worker SDK + UI hooks
2. Plugin worker runtime — process manager, JSON-RPC host
3. UI slot mounting — extension slot registry in Paperclip React app
4. Plugin install CLI — `pnpm paperclipai plugin install`
5. Plugin state storage — `plugin_state` DB table

### When Unblocked (Clipper side, ~2-3 days of work)

1. **Create package structure** — manifest.ts, worker.ts, vite.plugin.config.ts
2. **Adapt template loading** — `usePluginData("templates")` wrapper with fallback to Vite module
3. **Implement worker provisioning** — port `src/api/provision.js` logic to worker action
4. **Export UI components** — named exports for page + sidebar slots
5. **Dual build** — standalone mode (current) + plugin bundle mode
6. **Test with plugin harness** — `@paperclipai/plugin-test-harness` (once available)

## Design Decisions

### Own Package, Not In Paperclip Repo

- Plugins are installable npm packages by design
- Clipper has its own release cycle (templates change independently)
- Can be published as `@paperclipai/plugin-clipper` or `@yesterday-ai/clipper-plugin`
- Users install explicitly: `pnpm paperclipai plugin install @paperclipai/plugin-clipper`

### Keep Standalone Mode

- The standalone Vite app remains useful for:
  - Development and testing without a running Paperclip instance
  - NPM CLI users (`npx @yesterday-ai/paperclipper`)
  - Embedding in other contexts
- Dual build: `npm run build` (standalone) vs `npm run build:plugin` (plugin bundle)

### AI Wizard Stays Browser-Side

- The Anthropic API calls use the user's own API key (stored in localStorage)
- This is intentional: no server-side key management, no Paperclip dependency
- The `anthropic-dangerous-direct-browser-access` header is the correct pattern for this
- In plugin mode, the same flow works — the AI wizard doesn't use the plugin bridge

### Assembly Remains CLI-Only (For Now)

- File writing (AGENTS.md, SOUL.md, HEARTBEAT.md) needs filesystem access
- The plugin worker could potentially do this if the host provides a filesystem API
- For V1: provisioning creates API entities, assembly still requires CLI
- Future: worker could write files via a `workspace.files.write` capability (not in current spec)
