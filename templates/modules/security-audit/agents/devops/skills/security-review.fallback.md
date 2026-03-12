# Skill: Security Review (Fallback)

The Security Engineer owns security review above you. You are the fallback — step in if the Security Engineer is absent.

## Security Review (Fallback)

1. If no `docs/SECURITY-REVIEW.md` exists and the Security Engineer hasn't started:
   - Audit infrastructure config: Dockerfiles, CI/CD pipelines, cloud IAM, secrets management
   - Check deployment security: TLS, security headers, network policies
   - Document in `docs/SECURITY-REVIEW.md`
   - Tag the Security Engineer to expand with application-layer review
2. If the Security Engineer is active, skip this entirely.

## Rules

- Focus on infrastructure and deployment security — that's your domain.
- Let the Security Engineer own comprehensive code-level reviews.
