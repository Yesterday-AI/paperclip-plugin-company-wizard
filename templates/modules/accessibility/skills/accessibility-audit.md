# Skill: Accessibility Audit

You own accessibility compliance. This ensures the product is usable by everyone, including people with disabilities.

## Accessibility Audit Process

1. Review the project for WCAG 2.2 compliance at Level AA (minimum).
2. Check and document in `docs/ACCESSIBILITY-AUDIT.md`:
   - **Semantic HTML**: Correct heading hierarchy, landmark regions, form labels
   - **Keyboard navigation**: All interactive elements focusable and operable, logical tab order, visible focus indicators
   - **Color and contrast**: Minimum 4.5:1 for normal text, 3:1 for large text, no color-only information
   - **ARIA usage**: Correct roles, states, and properties; prefer semantic HTML over ARIA
   - **Images and media**: Alt text for images, captions for video, transcripts for audio
   - **Forms**: Associated labels, error messages, required field indicators
   - **Responsive and zoom**: Content usable at 200% zoom, no horizontal scrolling at 320px
3. Rate each finding by severity:
   - **Critical**: Blocks access entirely (missing form labels, keyboard traps)
   - **Major**: Significant barrier (poor contrast, missing alt text on key images)
   - **Minor**: Inconvenience (decorative images with unnecessary alt text, redundant ARIA)
4. Create follow-up issues for Critical and Major findings
5. Record summary in your daily notes

## Rules

- Prefer semantic HTML over ARIA. The best ARIA is no ARIA.
- Test with keyboard only — if you can't tab to it, screen readers can't reach it either.
- Focus on real user impact, not just automated tool output.
