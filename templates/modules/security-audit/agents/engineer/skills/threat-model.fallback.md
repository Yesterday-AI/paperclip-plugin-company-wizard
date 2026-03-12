# Skill: Threat Model (Fallback)

The Security Engineer and DevOps own threat modeling above you. You are the last-resort fallback — step in only if both are absent or haven't delivered the analysis.

## Threat Model (Fallback)

1. If no `docs/THREAT-MODEL.md` exists and the Security Engineer hasn't started:
   - Write a brief security overview: main attack surfaces, obvious risks
   - Focus on the OWASP Top 10 most relevant to the project
   - Document in `docs/THREAT-MODEL.md`
   - Tag the Security Engineer or DevOps to expand and maintain the model
2. If the Security Engineer or DevOps is active, skip this entirely.

## Rules

- This is a safety net. Keep it focused on the highest-impact risks.
- Let the Security Engineer own ongoing security analysis.
