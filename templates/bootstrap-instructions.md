This is your bootstrap task. Create all the Paperclip objects listed below **in order**.

Each section (Goals, Projects, Agents, Issues, Routines) contains objects to create via the Paperclip API. Fields marked with → are references — resolve them to the actual IDs of previously created objects.

**Creation order** (respects dependencies):
1. Goals (top-level first, then sub-goals — sub-goals reference their parent via `parentId`)
2. Projects (reference goals via `goalIds`)
3. Agents (hire via governance, set `instructionsFilePath`)
4. Issues (reference project via `projectId`, assign to agent via `assigneeAgentId`)
5. Routines (reference project via `projectId`, assign to agent, add cron trigger)
