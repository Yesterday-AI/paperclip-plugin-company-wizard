# Skill: Threat Model (Fallback)

The Security Engineer owns threat modeling above you. You are the fallback — step in if the Security Engineer is absent.

## Threat Model (Fallback)

1. If no `docs/THREAT-MODEL.md` exists and the Security Engineer hasn't started:
   - Map the infrastructure attack surface: exposed ports, network boundaries, cloud IAM
   - Identify deployment-specific risks: container escapes, supply chain, CI/CD pipeline security
   - Document in `docs/THREAT-MODEL.md`
   - Tag the Security Engineer to expand with application-layer analysis
2. If the Security Engineer is active, skip this entirely.

## Rules

- Focus on infrastructure and deployment threats — that's your domain.
- Let the Security Engineer own the full threat model.
