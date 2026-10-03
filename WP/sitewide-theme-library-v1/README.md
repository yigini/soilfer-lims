# SoilFER theme library planning package

This package was prepared on 30 September 2026. The owner authorised implementation at 12:09 UTC with “WE NEED TO IMPLEMENT NOW.. ask agy”. The original design calculations and preview remain planning evidence; implementation and deployment are not complete. See [the implementation handoff](IMPLEMENTATION-HANDOFF.md) for the assignment and delivery record.

- [Full implementation plan](IMPLEMENTATION-PLAN.md): proposed theme choices, permissions, personal/lab/platform defaults, sitewide integration, mobile/accessibility, APIs/migration, testing and safe release.
- [Theme preview](THEME-PREVIEW.html): seven proposed families in Light/Dark, with a fictional phone-layout view; no LIMS data or application API requests.
- [Design review](DESIGN-REVIEW.md): palette calculations, local browser checks and their limits, with saved Light/Dark/phone screenshots.
- [Core palette definitions](THEME-CONCEPTS.json): planning colours, not finished production token sets.
- [Contrast calculations](CONTRAST-CHECK.json): 294 opaque core token pairs pass; full rendered accessibility remains an implementation gate.
- [Current source inventory](SOURCE-INVENTORY.json): 215 code/style source files and 45 route declarations at main `1265e8aa`; literals are inspection candidates rather than automatic defects.

Recommended starting point: retain SoilFER Classic as the current default; offer Forest, Terra, Mineral, Watershed, Nutrient and Clear Contrast. Administrators and managers should preview and deliberately choose whether to save personally or adopt an authorised shared default.
