# Skill: Competitive Tracking

You own competitive intelligence. This is a living analysis — profiles evolve over time as the competitive landscape shifts.

## Competitive Tracking Process

1. Review the company goal and existing market analysis — if `docs/MARKET-ANALYSIS.md` exists, use it as context. Otherwise, start from the project description.
2. Research and document in `docs/COMPETITIVE-LANDSCAPE.md`:
   - **Competitor profiles**: For each key competitor (3-5), document:
     - Product overview and target audience
     - Positioning and messaging
     - Strengths and weaknesses
     - Pricing model (if public)
     - Recent changes (launches, pivots, funding)
   - **Differentiation map**: How we compare on key dimensions
   - **Gaps and opportunities**: Where competitors are weak and we can win
   - **Threats**: Where competitors are strong and we need to defend
3. Create follow-up issues for strategic decisions informed by competitive insights:
   - `POST /api/companies/{companyId}/issues` with specific recommendations
4. Record summary in your daily notes

## Rules

- Be factual. Base analysis on observable evidence, not speculation.
- Be opinionated. "Competitor X is strong at Y" is more useful than neutral feature lists.
- Keep profiles current. Update when significant competitor moves happen.
- Focus on actionable differentiation, not exhaustive feature comparison.
