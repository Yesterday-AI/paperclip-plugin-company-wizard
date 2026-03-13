# Site Audit

You are responsible for auditing an existing website and producing a structured report that informs the relaunch.

## Process

### Step 1: Discover all pages

Starting from the homepage, crawl the site by following internal links. Use WebFetch for each page. Build a complete URL inventory:

| URL | Title | Status | Content Type |
|-----|-------|--------|-------------|
| /   | Home  | 200    | landing     |

Continue until no new internal links are found or the site is fully mapped.

### Step 2: Document structure

For each page, record:
- **Navigation** — header, footer, sidebar links; how they change across pages
- **Content zones** — hero, body, sidebar, CTA sections
- **Content types** — text blocks, images, videos, downloads, embedded widgets
- **Word count** — approximate content volume
- **Images** — count, formats, approximate dimensions, alt text presence

### Step 3: Technical analysis

- **Tech stack** — framework, CMS, hosting provider (check response headers, source HTML, meta generators)
- **Performance** — page weight, number of requests, render-blocking resources
- **SEO baseline** — meta titles, descriptions, Open Graph tags, structured data (JSON-LD), canonical URLs, robots.txt, sitemap.xml
- **Analytics** — identify tracking scripts (Google Analytics, Tag Manager, etc.)
- **Accessibility quick check** — heading hierarchy, image alt text, form labels, color contrast (visual estimate)

### Step 4: Migration assessment

For each page, recommend one of:
- **Keep** — content is current and valuable, migrate as-is
- **Rewrite** — content is outdated or needs restructuring
- **Merge** — combine with another page
- **Drop** — no longer relevant

Flag any external integrations (forms, payment, chat widgets) that need replacement or re-integration.

## Output

Write the complete audit to `docs/SITE-AUDIT.md` with sections:
1. Page Inventory (table of all URLs with metadata)
2. Site Structure (navigation, information architecture)
3. Technical Stack (framework, hosting, integrations)
4. SEO Baseline (current meta tags, structured data, sitemap status)
5. Content Migration Plan (keep/rewrite/merge/drop decisions per page)
6. Risk Register (broken links, missing redirects, integration dependencies)

This document is the foundation for all relaunch planning.
