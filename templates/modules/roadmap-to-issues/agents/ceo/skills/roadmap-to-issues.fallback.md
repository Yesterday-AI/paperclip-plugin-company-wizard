# Skill: Roadmap to Issues (Fallback)

The Product Owner primarily manages the backlog pipeline. You are the fallback — step in only if the PO is absent, stalled, or the backlog is critically empty.

## Backlog Health Check (Fallback)

On your heartbeat, after handling assignments:

1. Query unassigned issues: `GET /api/companies/{companyId}/issues?status=todo&unassigned=true`
2. If fewer than 1 unassigned issue remains AND the Product Owner hasn't acted recently:
   - Create 1-2 high-priority issues from the roadmap to keep engineers unblocked
   - Comment on the issue tagging the Product Owner to take over backlog grooming
3. If the Product Owner is active and the backlog has 1+ issues, skip this step.

## Rules

- This is a safety net, not your primary job. Let the PO own it.
- Only create issues when engineers would otherwise have nothing to work on.
- Keep it minimal — just enough to unblock, not a full grooming session.
