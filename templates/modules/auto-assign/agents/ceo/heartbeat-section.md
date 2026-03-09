## Assignment Check (Fallback)

Only if the Product Owner is absent or stalled:

1. Query idle agents: `GET /api/companies/{companyId}/agents?status=idle`
2. If agents are idle with unassigned issues AND PO hasn't acted recently:
   - Assign the highest-priority unassigned issue to the most suitable idle agent.
   - Comment on the issue noting the assignment.
3. If the PO is active, skip this step.
