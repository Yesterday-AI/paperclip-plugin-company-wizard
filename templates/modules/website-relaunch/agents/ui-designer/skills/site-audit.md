# Site Audit — Design & Content Perspective

You are responsible for auditing an existing website with a focus on visual design, content quality, and user experience. Your audit informs the relaunch design direction.

## Process

### Step 1: Discover all pages

Starting from the homepage, browse the site page by page. Use WebFetch (or Chrome if available) for each page. Build a complete URL inventory:

| URL | Title | Status | Page Type |
|-----|-------|--------|-----------|
| /   | Home  | 200    | landing   |

Continue until the site is fully mapped.

### Step 2: Visual & layout analysis

For each page type, document:
- **Layout pattern** — grid structure, column count, content zones (hero, body, sidebar, CTA, footer)
- **Visual hierarchy** — heading sizes, spacing rhythm, how the eye flows down the page
- **Color usage** — primary, secondary, accent colors observed; background patterns; contrast quality
- **Typography** — font families (inspect source), size scale, weight usage, line heights
- **Imagery** — style (photography, illustration, icons), quality, consistency, sizing patterns
- **Component patterns** — recurring UI elements (cards, buttons, forms, nav bars, modals)
- **Responsive behavior** — how layouts adapt (if detectable from source/meta viewport)

### Step 3: Content assessment

For each page:
- **Content quality** — is copy clear, current, and on-brand? Flag outdated or placeholder content
- **Content structure** — heading hierarchy (H1 → H2 → H3), content length, scannability
- **Media inventory** — images with dimensions, videos, downloads; note missing alt text
- **CTAs** — what actions does each page drive? Are they clear and consistent?
- **Brand voice** — tone consistency across pages, alignment with brand positioning

### Step 4: UX observations

- **Navigation** — is the structure intuitive? Dead ends? Orphan pages?
- **User flows** — identify the primary journeys (e.g., homepage → product → contact)
- **Friction points** — broken links, confusing labels, inconsistent patterns
- **Accessibility** — heading hierarchy, image alt text, form labels, color contrast (visual estimate)

### Step 5: Migration recommendations

For each page, recommend:
- **Keep** — design and content are strong, migrate as-is
- **Redesign** — layout or visual treatment needs rethinking
- **Rewrite** — content is outdated or off-brand
- **Merge** — combine with another page
- **Drop** — no longer relevant

Note which visual patterns from the current site should be preserved vs. replaced in the new design.

## Output

Write the complete audit to `docs/SITE-AUDIT.md` with sections:
1. Page Inventory (table of all URLs with page type and status)
2. Visual Design Patterns (current color palette, typography, component library)
3. Content Assessment (quality, structure, and brand voice per page)
4. UX Observations (navigation, user flows, friction points)
5. Content Migration Plan (keep/redesign/rewrite/merge/drop per page)
6. Design Direction Notes (what to preserve, what to rethink, opportunities)

This document is the foundation for all relaunch planning.
