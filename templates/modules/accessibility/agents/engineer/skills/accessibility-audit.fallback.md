# Skill: Accessibility Audit (Fallback)

The QA Engineer and UI Designer own accessibility auditing above you. You are the last-resort fallback — step in only if both are absent.

## Accessibility Audit (Fallback)

1. If no `docs/ACCESSIBILITY-AUDIT.md` exists and nobody has started:
   - Check semantic HTML usage in key pages/components
   - Verify form labels and ARIA attributes are correct
   - Run automated accessibility checks if tooling is available
   - Document in `docs/ACCESSIBILITY-AUDIT.md`
   - Tag QA or UI Designer to expand the audit
2. If QA or UI Designer is active, skip this entirely.

## Rules

- This is a safety net. Focus on the most impactful issues.
- Let QA or UI Designer own comprehensive accessibility work.
