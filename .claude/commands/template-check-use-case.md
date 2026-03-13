# Template Gap Analysis for Use Case

Analyze the Clipper template system against a provided use case to identify gaps, missing capabilities, and improvement opportunities.

## Input

$ARGUMENTS

If no use case is provided, ask the user to describe their use case.

## Instructions

You are auditing Clipper's template system (presets, modules, roles, skills, inline goals) against the use case above. Follow the template philosophy: **gracefully optimistic, modular, markdown-first**.

### Step 1: Understand the use case

Break the use case into concrete requirements:
- What roles/agents are needed?
- What workflows/capabilities must exist?
- What initial tasks or goals should be created?
- What integrations or tools are implied?
- Are there human/board tasks (assignTo: "user")?
- What is the expected output (artifacts, docs, code)?

### Step 2: Audit existing templates

Read and evaluate the following against the requirements:

1. **Presets** — `templates/presets/*/preset.meta.json`
   - Does an existing preset cover this use case? Partially?
   - If not, should a new preset be created?
   - Check inline `goals[]` — do any preset goals match the use case objectives?

2. **Modules** — `templates/modules/*/module.meta.json`
   - Which existing modules are needed?
   - Are there capability gaps (workflows the use case needs that no module provides)?
   - Check `tasks[]` — do initial tasks cover the use case's bootstrapping needs?
   - Check `goal` — does any module carry an inline goal relevant to this use case?
   - Check `activatesWithRoles` — will needed modules activate with the available roles?
   - Check `dependencies` — are there implicit dependencies not declared?

3. **Roles** — `templates/roles/*/role.meta.json`
   - Which existing roles are needed?
   - Are there missing roles (expertise the use case needs that no role provides)?
   - Check `capabilities` — do roles cover the skills needed for this use case?
   - Check `reportsTo` — does the hierarchy make sense for this use case?

4. **Skills** — `templates/modules/*/skills/` and `templates/modules/*/agents/*/skills/`
   - Are the skill instructions adequate for the use case workflows?
   - Are there missing skills (specific procedures not covered)?
   - Do cross-module doc references follow the conditional pattern for `UPPERCASE.md` files?

5. **Docs** — `templates/modules/*/docs/`
   - Are process docs adequate for the workflows implied by the use case?
   - Are there missing process definitions?

### Step 3: Report findings

Organize findings into:

#### Covered
What the template system already handles well for this use case.

#### Gaps
What's missing or insufficient. For each gap, classify as:
- **Module gap** — A new module is needed
- **Role gap** — A new role is needed
- **Skill gap** — An existing module needs a new or improved skill
- **Goal gap** — A preset or module needs an inline goal for this use case
- **Preset gap** — A new preset would make this use case a one-click path
- **Task gap** — Initial tasks are missing for bootstrapping

#### Recommendations
Concrete, actionable suggestions ordered by impact. For each:
- What to create or modify
- Where it goes in the template hierarchy
- How it follows the gracefully-optimistic pattern (works with minimal roles, improves with more)

### Philosophy checks

For every recommendation, verify:
- [ ] **Gracefully optimistic** — Works with just CEO + Engineer, improves when optional roles are added
- [ ] **Modular** — New capability is a composable module, not hardcoded into a role
- [ ] **Markdown-first** — Skills are `.md` files with clear instructions, not code
- [ ] **Convention-based** — Follows existing naming and structure patterns
- [ ] **No duplication** — Shared skills where possible, role-specific only when genuinely different
