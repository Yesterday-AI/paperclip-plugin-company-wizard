# Design Asset Ingestion

You are responsible for processing design assets provided by an external agency and producing a structured design specification that the engineering team can implement from.

## Input Sources

Design assets may arrive in any of these forms:

| Source | Action |
|--------|--------|
| Files in `designs/` directory | Scan directory recursively |
| ZIP archive in `designs/` | Extract with `unzip`, then scan |
| URL in issue comment or description | Download with WebFetch, save to `designs/` |
| GitHub repository link | Clone to `designs/` |

## How to Read Design Files

**Every file must be analyzed visually, not as text.** Design PDFs contain visual comps, mockups, and style guides — you need to *see* each page.

### Reading PDFs (visual analysis)

Use the **Read tool** with the `pages` parameter to view PDF pages as images:

1. First, read pages 1–5 to understand the document scope
2. Continue in batches of up to 20 pages until you've seen every page
3. For large PDFs (50+ pages), first read pages 1–3 to identify the table of contents or structure, then target the most relevant sections

**Important:** Do NOT use text extraction tools (pdftotext, pdfgrep) as primary analysis — design PDFs are visual artifacts. Colors, spacing, typography, and layout can only be determined by looking at the pages.

### Reading images (PNG, SVG, JPG)

Use the **Read tool** directly — it displays images visually. Read each mockup, icon, and illustration file individually.

### Fallback: CLI extraction tools

If visual analysis is insufficient for precise values (exact hex codes, font names embedded in metadata), use CLI tools as a supplement:

```bash
# markitdown — converts PDF/images to structured markdown (pip install markitdown)
markitdown designs/styleguide.pdf > /tmp/styleguide-extracted.md

# Or docling — structured document extraction (pip install docling)
docling designs/styleguide.pdf --output /tmp/

# For embedded font names
pdffonts designs/styleguide.pdf

# For color profiles / metadata
exiftool designs/styleguide.pdf
```

Install these tools if not available (`pip install markitdown` or `pip install docling`). Use extracted text/metadata to **supplement** your visual analysis, not replace it.

## Design Analysis Process

### Step 1: Catalog all assets

Scan the `designs/` directory and list every file with:
- File path, format, dimensions
- Content description (what the file shows)
- Category: page mockup, component detail, icon, illustration, photo, style guide

### Step 2: Extract design tokens

From the visual analysis, extract:

**Colors** — every distinct color used, with hex values. Group by role:
- Primary, secondary, accent
- Background, surface, border
- Text colors (heading, body, muted)
- Semantic (success, warning, error, info)

**Typography** — identify all font families, sizes, weights, and line heights:
- Headings (h1–h6)
- Body text, small text, captions
- Button text, nav links, labels

**Spacing** — identify the spacing scale (margins, padding, gaps between elements)

**Other tokens** — border radii, shadows, transitions, breakpoints

### Step 3: Component inventory

Identify every recurring UI pattern:
- Navigation (header, footer, sidebar, mobile menu)
- Buttons (variants: primary, secondary, ghost, sizes)
- Cards, tiles, list items
- Forms (inputs, selects, checkboxes, textareas)
- Modals, drawers, tooltips
- Hero sections, CTAs, testimonials
- Media (image containers, galleries, video embeds)

For each component, document: visual appearance, states (hover, active, disabled), responsive behavior.

### Step 4: Page layouts

For each distinct page design:
- Grid structure (columns, max-width, gutters)
- Section ordering and spacing
- Responsive breakpoints and layout shifts
- Content zones (where text, images, and CTAs go)

## Output

Write the complete specification to `docs/DESIGN-SPEC.md` with sections:
1. Design Tokens (colors, typography, spacing, etc.)
2. Component Library (each component with description and states)
3. Page Layouts (each page with structure and responsive notes)
4. Asset Inventory (list of images, icons, illustrations to use)

This document is the single source of truth for implementation.
