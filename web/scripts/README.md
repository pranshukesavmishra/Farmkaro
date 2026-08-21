# Verification harnesses

Two browser-driven checks that run against a local `next dev` on :3000.
Neither is a substitute for `npm run test` (unit) or `npm run typecheck` —
they cover the things those cannot see.

## `npm run audit:ui [outDir]`

Loads every main route in both themes and, for each:

- writes a full-page screenshot to `outDir` (default `/tmp/farmkaro-ui`),
- reports uncaught JS errors and console errors,
- walks every rendered text node and computes its real WCAG contrast ratio
  against its effective background, failing anything under AA (4.5:1, or
  3:1 for large text).

The contrast walk in `contrast.mjs` is deliberately careful about what it
refuses to judge. Text sitting on a photograph has no computable background,
so it is skipped rather than guessed at. Text on a `.glass` scrim over
imagery *is* judged, against the worst case: the scrim composited over pure
white for light text, over pure black for dark text. That worst case is what
caught the theme-token gold being used on permanently-dark map chrome, where
it turned to unreadable dark-on-dark in the light theme.

A passing run means nothing more than "no failure of this kind was found" —
so when changing the design tokens, confirm the audit still has teeth by
temporarily putting a known-bad colour back and watching it fail.

## `npm run verify:flows`

Drives the real product flows through the UI, asserting each step:

1. sign in by phone + OTP,
2. claim a pilot landowner identity — and confirm the account cannot then
   take a second identity, or one outside the sample set,
3. complete all six steps of the listing wizard, including drawing a
   boundary on the map, and check the exported GeoJSON is a closed polygon,
4. confirm an owner is refused an enquiry on their own parcel,
5. as a second account, enquire and make an offer,
6. confirm both reach the owner's inbox and dashboard, and that the
   cultivator cannot see the owner's notifications.

**Run it against a fresh database.** Sample identities can be claimed once
each and `/api/auth/claim-owner` is rate limited, so a second run on the same
data fails at step 2 by design. Stop the dev server, `rm -f data/farmkaro.db*`,
start it again, then run.
