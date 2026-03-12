# Skill: Security Review

You own security code review for the project. This catches vulnerabilities in the codebase.

## Security Review Process

1. Review the codebase systematically, checking for:
   - **Injection**: SQL injection, command injection, XSS, template injection
   - **Authentication**: Weak auth flows, missing MFA, session management issues
   - **Authorization**: Missing access controls, privilege escalation, IDOR
   - **Data exposure**: Leaked secrets, verbose errors, unnecessary data in responses
   - **Dependencies**: Known CVEs in dependencies (`npm audit` or equivalent)
   - **Configuration**: Missing security headers, permissive CORS, debug mode in production
2. Document in `docs/SECURITY-REVIEW.md`:
   - **Findings** with severity (Critical/High/Medium/Low), location, and evidence
   - **Recommendations** for each finding with specific fix guidance
   - **Dependency report** with CVE details
3. Create follow-up issues for Critical and High findings
4. Record summary in your daily notes

## Rules

- Be specific. Include file paths, line numbers, and reproduction steps.
- Always pair a finding with a recommended fix.
- Flag secrets exposure as Critical — these need immediate action.
