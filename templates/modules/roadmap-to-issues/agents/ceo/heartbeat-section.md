## Backlog Health Check (Fallback)

Only if the Product Owner is absent or stalled:

1. Query unassigned issues: `GET /api/companies/{companyId}/issues?status=todo&unassigned=true`
2. If fewer than 1 unassigned issue AND PO hasn't acted recently:
   - Create 1-2 high-priority issues from the roadmap to keep engineers unblocked.
   - Tag the PO to take over backlog grooming.
3. If the PO is active and backlog has 1+ issues, skip this step.
