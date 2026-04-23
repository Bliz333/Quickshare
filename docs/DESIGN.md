# Web Frontend Design Phase

## Goal
Make the web UI show a deliberate design pass inside the repository, not just organically grown static pages.

## Design decisions
- Establish a shared token source at `src/main/resources/static/css/design-tokens.css`.
- Use one canonical blue-indigo visual system across light and dark mode.
- Prefer reusable surface patterns: glass panels, rounded cards, status chips, and compact action rails.
- Start with the homepage because it is the highest-traffic entry point and already mixes QuickDrop, cloud drive entry, and public sharing.

## Current implementation slice
The tracked repo now shows a broader first-phase migration rather than a homepage-only experiment. The current design-system evidence includes:

- `src/main/resources/static/css/design-tokens.css`
- `src/main/resources/static/css/base.css`
- `src/main/resources/static/css/components.css`
- `index.html`, `share.html`, `login.html`, `register.html`, `pricing.html`, `payment-result.html` migrated or token/base-adopted
- `netdisk.html`, `admin.html`, `pdf-viewer.html`, `transfer.html`, `transfer-share.html` importing the shared token layer

The homepage remains the highest-traffic proof point, and its feature-card rail demonstrates:
- section-level surface hierarchy
- tokenized spacing, borders, and shadows
- reusable eyebrow labels and metadata chips
- consistent message framing across QuickDrop, share links, and cloud drive

## Production intent
This is not a mockup-only artifact. The design phase now exists as a repo-visible token/component system with multiple migrated or adopted pages, and the remaining expansion path is follow-on polish rather than evidence that the design phase is still incomplete.
