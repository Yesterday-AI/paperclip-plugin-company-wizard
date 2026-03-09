## Stall Detection Check

After handling assignments and before exit:

1. Query active issues: `GET /api/companies/{companyId}/issues?status=in_progress,in_review`
2. For each issue, check the latest comment/activity timestamp.
3. If an issue has had no activity for more than 2 heartbeat cycles:
   - Agent is `idle` → @-mention with a nudge.
   - Agent is `running` → skip (may be mid-work).
   - Agent is `error` or `paused` → escalate to the board.
4. If already nudged and still no progress → escalate to the board.
5. Record stall findings in daily notes.
