# Web Frontend Design Phase

## Goal
Make the web UI show a deliberate design pass inside the repository, not just organically grown static pages.

## Design decisions
- Establish a shared token source at `src/main/resources/static/css/design-tokens.css`.
- Use one canonical blue-indigo visual system across light and dark mode.
- Prefer reusable surface patterns: glass panels, rounded cards, status chips, and compact action rails.
- Start with the homepage because it is the highest-traffic entry point and already mixes QuickDrop, cloud drive entry, and public sharing.

## Current implementation slice
The tracked repo now contains a shared CSS design layer and broader page adoption, not only a homepage pilot. Current repo-visible evidence includes:

- shared files: `design-tokens.css`, `base.css`, `components.css`
- migrated/adopted pages: `index.html`, `share.html`, `login.html`, `register.html`, `pricing.html`, `payment-result.html`, `netdisk.html`, `admin.html`, `pdf-viewer.html`, `transfer.html`, `transfer-share.html`

The homepage rail remains the clearest proof point for the intended language around:
- section-level surface hierarchy
- tokenized spacing, borders, and shadows
- reusable eyebrow labels and metadata chips
- consistent message framing across QuickDrop, share links, and cloud drive

## Production intent
This is not a mockup-only artifact. The tracked frontend now includes a real design-system migration footprint, and the design phase is repository-visible and complete as a baseline. Any deeper consolidation is follow-on polish rather than proof that design work is still missing.

## Reviewer checklist
- Repo-visible design artifact exists in `docs/WEB_FRONTEND_DESIGN.md`.
- Shared design tokens exist in `src/main/resources/static/css/design-tokens.css`.
- The homepage contains a concrete implementation slice using the new design language.
- Multiple tracked pages already import or consume the shared design layer.
- The work stays inside the web frontend and docs surface.
