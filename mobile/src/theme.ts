/**
 * QuickShare Mobile Design Tokens
 * ================================
 *
 * Canonical mobile design tokens derived from the web design-tokens.css.
 * Every component must import from this file — no hardcoded hex values.
 *
 * Web source: src/main/resources/static/css/design-tokens.css
 */

export const Theme = {
  /* ── Primary palette (web: --color-primary family) ── */
  primary:        '#3b82f6',
  primaryLight:   '#60a5fa',
  primaryDark:    '#2563eb',
  primary14:      'rgba(59, 130, 246, 0.14)',
  primary08:      'rgba(59, 130, 246, 0.08)',
  primary06:      'rgba(59, 130, 246, 0.06)',
  primary03:      'rgba(59, 130, 246, 0.03)',

  /* ── Accent / Indigo ── */
  accent:         '#6366f1',
  accent10:       'rgba(99, 102, 241, 0.10)',
  accent18:       'rgba(99, 102, 241, 0.18)',

  /* ── Semantic ── */
  success:        '#10b981',
  successDark:    '#059669',
  success10:      'rgba(16, 185, 129, 0.10)',
  success05:      'rgba(16, 185, 129, 0.05)',
  warning:        '#f59e0b',
  warningDark:    '#b45309',
  warning08:      'rgba(245, 158, 11, 0.08)',
  danger:         '#ef4444',
  danger12:       'rgba(239, 68, 68, 0.12)',

  /* ── Text hierarchy (web: --color-text family) ── */
  text:           '#1a1a2e',
  textSecondary:  '#64748b',
  textTertiary:   '#94a3b8',
  textInverse:    '#ffffff',

  /* ── Surfaces ── */
  bg:             '#f0f4fa',
  surface:        '#ffffff',
  surfaceRaised:  '#ffffff',
  surfaceSunken:  '#f8fafc',
  surfaceTint:    '#eff6ff',
  surfaceTintDark:'#dbeafe',

  /* ── Borders ── */
  border:         'rgba(148, 163, 184, 0.16)',
  borderStrong:   'rgba(148, 163, 184, 0.26)',
  borderInput:    '#cbd5e1',
  borderFocus:    '#3b82f6',

  /* ── Shadows (elevation on mobile) ── */
  shadowSm:       'rgba(15, 23, 42, 0.06)',
  shadowMd:       'rgba(15, 23, 42, 0.08)',
  shadowLg:       'rgba(15, 23, 42, 0.10)',

  /* ── Spacing (web: --space-N) ── */
  space1:  2,
  space2:  4,
  space3:  6,
  space4:  8,
  space5:  10,
  space6:  12,
  space7:  14,
  space8:  16,
  space9:  18,
  space10: 20,
  space12: 24,
  space14: 28,
  space16: 32,
  space20: 40,
  space24: 48,

  /* ── Typography ── */
  fontSizeXs:     11,
  fontSizeSm:     12,
  fontSizeCaption:13,
  fontSizeBase:   14,
  fontSizeMd:     15,
  fontSizeLg:     16,
  fontSizeXl:     18,
  fontSize2xl:    22,
  fontSize3xl:    28,

  /* ── Radius (web: --radius-N) ── */
  radiusSm:       8,
  radiusMd:       10,
  radiusLg:       12,
  radiusXl:       14,
  radius2xl:      18,
  radius3xl:      22,
  radiusFull:     999,

  /* ── Touch targets ── */
  touchMin:       44,
} as const;

/** Type-safe theme access */
export type ThemeTokens = typeof Theme;
