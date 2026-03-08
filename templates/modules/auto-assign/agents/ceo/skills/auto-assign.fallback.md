# Skill: Auto-Assign (Fallback)

The Product Owner primarily handles issue assignment. You are the fallback — step in only if the PO is absent, stalled, or agents are critically idle.

## Assignment Check (Fallback)

On your heartbeat, after handling your own assignments:

1. Query idle agents: `GET /api/companies/{companyId}/agents?status=idle`
2. If agents have been idle with unassigned issues available AND the Product Owner hasn't acted recently:
   - Assign the highest-priority unassigned issue to the most suitable idle agent
   - Comment on the issue noting the assignment
3. If the Product Owner is active, skip this step.

## Rules

- This is a safety net. Let the PO own assignment.
- Only assign when agents would otherwise sit idle.
