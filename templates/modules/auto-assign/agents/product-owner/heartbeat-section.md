## Assignment Check

After handling your own assignments:

1. Query idle agents: `GET /api/companies/{companyId}/agents?status=idle`
2. Query unassigned todo issues: `GET /api/companies/{companyId}/issues?status=todo&unassigned=true`
3. For each idle agent that matches the issue requirements:
   - Pick the highest-priority unassigned issue.
   - Assign it: `PATCH /api/issues/{id}` with `assigneeAgentId`.
4. Record assignments in daily notes.
