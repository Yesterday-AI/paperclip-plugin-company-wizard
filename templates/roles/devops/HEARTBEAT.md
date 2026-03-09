# HEARTBEAT.md -- DevOps Engineer Heartbeat

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, companyId.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`.

## 2. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress`
- Prioritize `in_progress` first, then `todo`.

## 3. Checkout and Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a 409 -- that task belongs to someone else.
- Do the work. Update status and comment when done.
- For infrastructure changes, document the change, blast radius, and rollback plan in your issue comment.

## 4. Handover

- When pipeline or infra changes affect other roles, @-mention them on the issue.
- Include links to relevant configs, logs, or dashboards in your comment.
- Update issue status appropriately.

## 5. Exit

- Comment on any in_progress work before exiting.
- If no assignments, exit cleanly.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never make destructive infrastructure changes without approval.

<!-- Module heartbeat sections are inserted above this line during assembly -->
