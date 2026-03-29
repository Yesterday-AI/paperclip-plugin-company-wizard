---
name: release
description: Prepare a new release by updating CHANGELOG.md, verifying documentation (README.md, CLAUDE.md, AGENTS.md, ROADMAP.md, docs/), bumping patch version in package.json, building, and suggesting publish commands. Use when asked to release, bump version, prepare release, or publish.
---

# Release — Prepare and Document a New Version

## Phase 1: Analyze Changes

Understand what changed since the last release:

1. **Read current version** from `package.json`.
2. **Read `CHANGELOG.md`** to understand the last documented version and its date. Note any gap — if `package.json` is ahead of the changelog, intermediate releases were shipped without entries.
3. **Find the release boundary.** Try `git tag -l 'v*' --sort=-v:refname | head -5` for the latest tag. If no tags exist, find the commit that last bumped the version (e.g., `git log --oneline --all -- package.json | head -5`) and use that SHA as the base.
4. **Run `git log <base>..HEAD`** to collect all commit messages since the last release.
5. **Run `git diff <base>..HEAD`** to see all committed file changes. Also run **`git diff HEAD`** to capture any uncommitted work in the working tree — this may contain unreleased feature work.
6. **Count templates from the filesystem** to verify against documentation:
   - `ls templates/presets/ | wc -l`
   - `ls templates/modules/ | wc -l`
   - `ls templates/roles/ | wc -l`
7. Pay attention to:
   - New features (new files, new actions, new UI steps)
   - Bug fixes (error handling, logic corrections)
   - Template changes (new presets, modules, roles, prompt updates)
   - Configuration changes (new settings, defaults)
   - Breaking changes (removed features, renamed fields, API changes)
8. **Categorize changes** into: Added, Changed, Fixed, Removed, Template system (if applicable).

## Phase 2: Update CHANGELOG.md

1. **Read** `CHANGELOG.md` to understand the existing format and style.
2. **If intermediate versions exist without changelog entries** (e.g., `package.json` jumped from 0.1.0 to 0.1.2 but the changelog only has 0.1.0), create brief entries for the skipped versions too — even if they were just version bumps or metadata changes.
3. **Add a new version section** at the top (below the header), following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format:

   ```text
   ## [X.Y.Z] — YYYY-MM-DD

   ### Added
   - Feature description

   ### Changed
   - Change description

   ### Fixed
   - Bug fix description
   ```

4. **Match the tone and detail level** of existing entries. Be specific — mention file names, action names, field names where relevant.
5. **Do NOT include** trivial changes (formatting, comments) unless they affect behavior.

## Phase 3: Verify Documentation

Check each documentation file against the actual codebase. For each file, read it and verify accuracy. Only edit if something is factually wrong or missing due to the changes being released.

### Files to check

1. **`README.md`** — Verify:
   - Feature descriptions match current behavior
   - Configuration options are up to date
   - Template counts (presets, modules, roles) are accurate
   - Example commands still work
   - Any new features from this release are mentioned where appropriate

2. **`CLAUDE.md`** — Verify:
   - Architecture description matches current source layout
   - Key concepts are accurate (especially if state fields, actions, or API flow changed)
   - Template system description is current
   - Build/test commands are correct

3. **`AGENTS.md`** — Verify:
   - Project vision still matches reality
   - Architecture diagram is current
   - Design principles haven't been violated by changes
   - Template/module/role counts are accurate

4. **`ROADMAP.md`** — Verify:
   - Move newly completed items from "Backlog" or "In Progress" to "Done"
   - Add any new backlog items discovered during development
   - Remove items that are no longer relevant

5. **`docs/`** directory — Verify:
   - Any documentation files are consistent with template/module changes
   - Cross-references between docs are still valid

### Documentation rules

- Only update what's actually wrong or missing. Don't rewrite prose that's still accurate.
- If counts changed (e.g., "14 presets" → "15 presets"), update all occurrences across all files.
- If a new state field was added, ensure CLAUDE.md's WizardContext description mentions it.
- If new worker actions were added, ensure they're listed in the architecture section.

## Phase 4: Bump Version

**You MUST bump the version. Do NOT skip this phase. Do NOT leave the version unchanged.**

1. **Read** `package.json` to get the current version.
2. **Check for recent version-bump commits** — run `git log --oneline -5 -- package.json` to ensure you're not colliding with a version that was already bumped externally. If the current version was bumped by a recent commit you haven't accounted for, increment from that version instead.
3. **Increment the patch version** (e.g., `0.1.5` → `0.1.6`). Always patch. Never minor or major unless the user explicitly says so.
4. **Edit** `package.json` — change the `"version"` field to the new version.
5. **Edit** `src/manifest.ts` — change the `version` field to the same new version.
6. **Verify both files match** — grep both files to confirm the version is identical.
7. **Also check** if the version appears in any other files (README badges, etc.) and update those too.

## Phase 5: Build and Verify

1. **Run `pnpm build`** — ensure it succeeds with no errors.
2. **Run `pnpm typecheck`** — ensure no type errors.
3. **Run `pnpm test`** — vitest plugin tests.
4. **Run `pnpm test:logic`** — node:test logic suite. Both test suites must pass.

If any step fails, fix the issue before proceeding.

## Phase 6: Suggest Publish Commands

Do NOT run these commands — just print them for the user to review and execute manually.

Present the commands in order:

```bash
# Review the changes one more time:
git diff

# Commit everything:
git add -A
git commit -m "chore: release vX.Y.Z"

# Tag the release:
git tag vX.Y.Z

# Push:
git push && git push --tags

# Publish to npm:
pnpm publish --access public
```

If the package is scoped (starts with `@`), remind the user that `--access public` is needed for public packages.

Also mention: "After publishing, reload the plugin in the Paperclip UI to pick up the new version."
