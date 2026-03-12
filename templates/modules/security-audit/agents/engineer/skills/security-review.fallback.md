# Skill: Security Review (Fallback)

The Security Engineer and DevOps own security review above you. You are the last-resort fallback — step in only if both are absent or haven't performed the review.

## Security Review (Fallback)

1. If no `docs/SECURITY-REVIEW.md` exists and the Security Engineer hasn't started:
   - Run `npm audit` (or equivalent) and document critical CVEs
   - Check for obvious issues: hardcoded secrets, missing input validation, permissive CORS
   - Document in `docs/SECURITY-REVIEW.md`
   - Tag the Security Engineer or DevOps to expand the review
2. If the Security Engineer or DevOps is active, skip this entirely.

## Rules

- This is a safety net. Focus on the most obvious vulnerabilities.
- Let the Security Engineer own comprehensive security reviews.
