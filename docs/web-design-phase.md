# QuickShare Web Frontend Design Phase

This document marks the explicit web frontend design phase that Oracle said was missing from the tracked repository.

## Goal

Separate visual-system work from organic page-by-page feature growth by introducing:

- shared design tokens
- shared base styles
- shared component styles
- deliberate page migrations onto that design system

## Current implementation slice

The first design-phase slice in the tracked repo is:

- `src/main/resources/static/css/design-tokens.css`
- `src/main/resources/static/css/base.css`
- `src/main/resources/static/css/components.css`
- `src/main/resources/static/share.html` migrated to consume that shared CSS layer

## File responsibilities

| File | Contents |
|------|----------|
| `design-tokens.css` | CSS custom properties: colors (light + dark), typography, spacing, shadows, radii, motion/easing, layout constants, and short-form semantic aliases. Single source of truth for all visual constants. |
| `base.css` | Reset, body defaults, utility classes (`.sr-only`, `.hidden`), keyframe animations (`spin`, `fadeUp`, `slideUp`), toast system, spinner. |
| `components.css` | Reusable component styles: topbar, shell layout, tab bar, card with mouse-light effect, upload area, file list, picker buttons, form fields, action buttons (primary/success/ghost variants), result box, copy button, download info, preview container, responsive breakpoints. |

Pages must import the three files in order:

```html
<link rel="stylesheet" href="css/design-tokens.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/components.css">
```

## Architecture decisions

- **Canonical + alias naming**: `design-tokens.css` defines long-form names (`--color-primary`, `--space-8`) and short-form aliases (`--primary`, `--sh-m`). Long form is canonical; short forms support backward compatibility with existing inline styles.
- **Dark mode via `.dark-mode` class**: Both token layers define `:root` (light) and `.dark-mode` (dark) blocks. A blocking `<script>` reads `localStorage('quickshare-theme')` and applies the class before first paint.
- **FOUC-prevention stays inline**: Rules like `html.lang-pending body { opacity: 0 }` remain as inline `<style>` because they must execute before the first render.
- **No build pipeline**: All CSS is vanilla. No preprocessors, PostCSS, or bundler. Spring Boot serves files directly.

## Why `share.html` first

`share.html` is a public-facing page with a complete set of reusable primitives: topbar, buttons, tabs, forms, cards, upload zone, file list, result/feedback sections. It provides clear design-phase evidence with lower functional risk than the real-time homepage.

## What changed in share.html

**Before**: ~262 lines of inline `<style>` containing all tokens, resets, and component rules.

**After**: Three `<link>` imports + a 4-line inline `<style>` for FOUC prevention only. All visual output is identical — same CSS values, same selectors, same specificity. The inline `<style>` shrank from ~262 lines to ~4 lines.

## Migration intent

This design phase is intentionally distinct from feature work:

- no new backend capability is introduced here
- the shared CSS layer provides a canonical visual vocabulary for later migrations
- future pages can migrate incrementally without inventing new token dialects

## Migration status

| Page | Status | Inline `<style>` lines (before → after) |
|------|--------|----------------------------------------|
| `share.html` | **Migrated** | ~262 → ~4 |
| `login.html` | **Migrated** | ~215 → ~18 |
| `register.html` | **Migrated** | ~400 → ~15 |
| `index.html` | Pending | |
| `pricing.html` | Pending | |
| `netdisk.html` | Pending | |
| `transfer.html` | Pending | |
| `admin.html` | Pending | |

### What changed in login.html

**Before**: ~215 lines of inline `<style>` containing duplicate CSS custom properties, resets, toast styles, card/form/button/divider/social styles.

**After**: Three `<link>` imports + ~18 lines of page-specific inline overrides (body centering, `.t-btn` border-radius tweak, auth-orb hover state). All functional selectors and visual output preserved.

### What changed in register.html

**Before**: ~400 lines of inline `<style>` containing duplicate tokens, resets, blob animations, card, form groups, inputs, buttons, divider, toast, social, footer, and responsive breakpoints.

**After**: Three `<link>` imports + ~15 lines of page-specific inline overrides (blob color variants, dark-mode blob overrides, toggle button sizing). All functional selectors and visual output preserved.

### Components added to components.css (§16–§22)

| Section | Purpose |
|---------|---------|
| §16 Auth page background orbs | `.bg-glow`, `.bg-orb-*`, `.blob`, `.blob-*`, `@keyframes blobFloat` |
| §17 Auth card | `.login-card`, `.register-container`, card accent bar |
| §18 Auth page controls | `.back-link`, `.top-actions`, `.top-buttons`, `.top-btn`, `.back-btn` |
| §19 Auth logo & forms | `.logo-icon`, `.logo`, `.form-group`, `.input-wrap`/`.input-wrapper`, `.input-icon`, `.form-control`, `.form-row`, `.email-row`, `.btn-code`, `.captcha-container` |
| §20 Auth buttons | `.btn`, `.btn-submit` with gradient, hover, disabled, dark-mode variants |
| §21 Auth divider, links, social, footer | `.divider`, `.links`, `.social-buttons`, `.social-btn`, `.card-footer` |
| §22 Auth page responsive | Mobile breakpoints for auth cards, form rows, email rows, captcha |

The long-term goal is to make the tracked web frontend read as a designed system rather than a set of unrelated inline-style pages.
