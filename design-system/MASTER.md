# Design System: Genesis

Global source of truth for `genesis-app`'s visual design. Every screen — including the four already-designed Title increments (Prelim Title Search, Commitment Schedule A, Commitment Schedule B-I/B-II, Curative) and everything after — implements against these tokens rather than styling ad hoc.

Generated via the `ui-ux-pro-max` plugin's design-system reasoning engine, then hand-merged: the plugin's raw single-query output is built for customer-facing marketing sites (its catalog's closest product-type matches — Legal Services, Invoice & Billing Tool — both describe public-facing pages, not internal back-office tools), so the color palette below combines two of its catalog rows rather than using either verbatim, and its landing-page "Pattern" section (Hero + Features + CTA) was discarded entirely as inapplicable. Full decision rationale lives in the companion vault doc: `Genesis Rebuild - Design System.md`.

## Style

**Minimalism & Swiss Style** — clean, spacious, functional, grid-based, high contrast, geometric, sans-serif. Catalog's own scoping: "Enterprise apps, dashboards, documentation sites, SaaS platforms, professional tools" — a direct match for Genesis's actual nature as an internal, form-heavy line-of-business tool, not a marketing site.

Chosen to lead over the "Accessible & Ethical" alternative (higher-contrast, larger-type, more spacious even at the cost of density) — Accessible & Ethical's specific *requirements* (4.5:1 contrast, visible focus states, keyboard nav, reduced-motion support) are still enforced as a baseline throughout, they just don't drive the overall look.

Deliberately positioned as visually distinct from SoftPro (the legacy competitor software Genesis replaces, screenshotted in the vault's `SoftPro Screenshots` folder) — modern web-app conventions (generous white space, grid layout, current typography) rather than dense legacy-desktop-app styling.

## Component library

**shadcn/ui** — accessible, composable primitives (dropdowns, dialogs, forms, tables) copied into the repo as owned code rather than a black-box dependency. Matches this style's own best-fit stack list.

## Colors

Merged from two catalog rows: "Legal Services" (`Authority navy + trust gold`) as the brand base, with "Invoice & Billing Tool" (`Navy professional + paid green`) layered in for status/workflow states — a deliberate fit for Genesis's own disposition/status-driven screens (Curative's Draft/Final/Cleared-for-Policy, Requirement/Exception dispositions).

| Role | Hex | CSS Variable | Use |
|---|---|---|---|
| Primary (Navy) | `#1E3A8A` | `--color-primary` | Structural brand color — nav, headers, primary buttons |
| On Primary | `#FFFFFF` | `--color-on-primary` | |
| Secondary (Navy, lighter) | `#1E40AF` | `--color-secondary` | Secondary actions |
| On Secondary | `#FFFFFF` | `--color-on-secondary` | |
| Brand Accent (Gold) | `#B45309` | `--color-accent` | Reserved for genuine emphasis moments only — e.g. Finalize, Issue CTC — not a default button color |
| On Accent | `#FFFFFF` | `--color-on-accent` | |
| Status: Pending / In-Progress (Amber) | `#D97706` | `--color-status-pending` | Draft Commitment, un-dispositioned Requirement/Exception, Title Status = Curative. Deliberately distinct from Brand Accent gold so "needs attention" never overloads the same hue as "genuine emphasis." |
| Status: Cleared / Dispositioned (Green) | `#059669` | `--color-status-cleared` | Final Commitment state, Released/Insured Over/etc. dispositions, Title Status = Cleared for Policy |
| Status: Rejected / Destructive (Red) | `#DC2626` | `--color-destructive` | Delete actions, error states |
| On Destructive | `#FFFFFF` | `--color-on-destructive` | |
| Background | `#F8FAFC` | `--color-background` | |
| Foreground | `#0F172A` | `--color-foreground` | |
| Card | `#FFFFFF` | `--color-card` | |
| Card Foreground | `#0F172A` | `--color-card-foreground` | |
| Muted | `#E9EEF5` | `--color-muted` | |
| Muted Foreground | `#475569` | `--color-muted-foreground` | |
| Border | `#CBD5E1` | `--color-border` | |
| Ring | `#1E3A8A` | `--color-ring` | Focus ring — matches Primary |

## Typography

**Plus Jakarta Sans** (heading + body). Catalog's own scoping: "B2B SaaS apps, productivity tools, government and finance mobile apps, admin dashboards, enterprise onboarding" — legible, modern, not decorative.

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');
```

## Key effects

Subtle hover states (200–250ms), smooth transitions, sharp shadows if any (avoid soft/glassy shadows — doesn't fit Swiss Style), clear type hierarchy, fast loading. All interaction timing respects `prefers-reduced-motion`.

## Anti-patterns (avoid)

- Excessive animation
- Dark mode by default (light mode is primary; dark mode support is a later, separate decision — not scoped here)
- Emojis as icons — use SVG icon sets (Heroicons/Lucide) instead
- Soft/glassy/neumorphic shadows — inconsistent with Swiss Style's flat, geometric character
- Reusing Brand Accent gold for status meaning (see Colors note above) — keep brand emphasis and workflow-status color vocabularies separate

## Pre-delivery checklist

- [ ] No emojis as icons (SVG: Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150–300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] Status colors (`--color-status-pending` / `--color-status-cleared` / `--color-destructive`) never rely on color alone — pair with text/icon for colorblind accessibility

## Page pattern

Not sourced from the plugin's landing-page pattern dataset (built for marketing sites — Hero/Features/CTA/Footer, inapplicable here). Genesis's own established convention, set by the existing Title-increment design docs: one scrolling **File Section** page per screen, no tab switchers, applied consistently across Prelim Title Search, Schedule A, Schedule B-I/B-II, and Curative.
