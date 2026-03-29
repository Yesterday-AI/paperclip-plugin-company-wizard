This is your bootstrap task. Create all the Paperclip objects listed below **in order**.

Each section (Goals, Projects, Agents, Issues, Routines) contains objects to create via the Paperclip API.

**How to read the metadata:**

- Direct values like `level: company` or `priority: high` → use as-is in the API call
- References like `parentId: → "Ship MVP"` → find the object with that name and use its ID
- `assigneeAgentId: → "engineer"` → find the agent with that role and use its ID
- `assigneeUserId: → board user` → assign to the board user (the human who created this company)

**Creation order** (respects dependencies):

1. **Goals** — top-level first, then sub-goals. Sub-goals have `parentId: → "Parent Title"` — create the parent first, then use its ID
2. **Projects** — reference goals via `goalIds`. Create after all goals exist
3. **Labels** — create issue labels (`POST /api/companies/{companyId}/labels` with `{ name, color }`). Use them to categorize issues
4. **Agents** — hire via governance. Set `instructionsFilePath` from the metadata
5. **Issues** — reference project via `projectId`, assign to agent via `assigneeAgentId` or to the board user via `assigneeUserId`. Attach labels via `labelIds`
6. **Routines** — reference project and agent. Add a cron trigger with the `schedule` value

**After bootstrap**: keep labels current. When creating new issues in your heartbeat, always assign appropriate labels.
