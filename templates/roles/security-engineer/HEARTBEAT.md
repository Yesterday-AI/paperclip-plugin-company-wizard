# HEARTBEAT.md -- Security Engineer Heartbeat

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, companyId.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`.

## 2. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress`
- Prioritize `in_progress` first, then `todo`.

## 3. Assess

- Checkout: `POST /api/issues/{id}/checkout`.
- Determine scope: threat model, code review, dependency audit, or config review.
- Perform the security assessment.
- Document findings with severity ratings.
- Create follow-up issues for remediation.
- Comment results on the originating issue.
- Mark issue done.

## 4. Exit

- If no assignments, exit cleanly.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Security findings are always blocking — never approve with open Critical/High findings.

<!-- Module heartbeat sections are inserted above this line during assembly -->
