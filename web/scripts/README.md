# Verification harnesses

Browser-driven checks that run against a local `next dev` on :3000. They cover
what `npm run test` (unit) and `npm run typecheck` cannot see: what the pages
actually render, what a click actually does, and what the server actually
allows.

## Running them

Several checks claim a sample landowner identity, and each identity can be
claimed only once. Reset first:

```
bash scripts/reset-dev.sh   # stop, drop data/farmkaro.db, start, wait for :3000
npm run verify:all          # every check below, one pass/fail line each
```

Individual checks are `node scripts/<file>`; `audit:ui`, `audit:mobile`,
`audit:links` and `verify:flows` also have npm aliases.

## What each one covers

| Check | File | What it asserts |
| --- | --- | --- |
| links | `audit-links.mjs` | Every internal link resolves; no `href="#"`, no anchor without an href, 404 route really 404s |
| cards | `verify-cards.mjs` | One link per result card, the whole card navigates, one tab stop each |
| discover | `verify-discover.mjs` | Every filter narrows the set *and* the listed values obey it (acres ≥ min, ₹/ac ≤ max) |
| sorting | `verify-sorting.mjs` | Each sort really orders the list — monotonic rent, acreage and distance |
| map labels | `verify-map-labels.mjs` | No visible price pill overlaps another, at desktop and phone width, before and after zooming |
| chrome | `verify-chrome.mjs` | Theme default and persistence, sign in/out, notifications, and the land-record lookup's consent and identifier rules |
| flows | `verify-flows.mjs` | OTP sign-in, identity-claim guards, all six wizard steps including drawing a boundary, the self-deal refusal, enquiry and offer reaching the owner |
| lease | `verify-lease.mjs` | Offer → accept/counter/reject → every lease transition → the registration ladder, plus the guards on each |
| messaging | `verify-messaging.mjs` | The thread an enquiry opens: both parties read and reply, a stranger gets 403, empty messages refused |
| ui audit | `audit-ui.mjs` | Full-page screenshots, console/page errors, and real WCAG contrast for every text node, 6 routes × 2 themes |
| mobile | `audit-mobile.mjs` | At 390px: no sideways scroll, every tap target ≥ 24px, contrast clean, no JS errors |

## Notes on the two audits

**Contrast** (`contrast.mjs`, shared) is deliberately careful about what it
refuses to judge. Text on a photograph has no computable background, so it is
skipped rather than guessed at. Text on a `.glass` scrim over imagery *is*
judged, against the worst case: the scrim composited over pure white for light
text, over pure black for dark text. That worst case is what caught a theme
token being used on permanently-dark map chrome, where it turned to unreadable
dark-on-dark in the light theme.

**Tap targets** measure the *effective* target, not the element's own box: a
control wrapped in a label is tapped through the label, and a `.stretch-link`
covers its positioned ancestor. Measuring the raw box reported failures that
were not real.

A passing run means only "no failure of this kind was found". When changing the
design tokens, confirm the audit still has teeth by putting a known-bad colour
back and watching it fail.
