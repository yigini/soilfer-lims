# Planning design review

Reviewed 30 September 2026, completed at 12:01 UTC. This evidence covers the proposed colours and fictional preview. It does not establish that the feature exists in SoilFER or has passed production acceptance.

| Check | Result | Limit |
|---|---|---|
| Current source inventory | 215 code/style files and 45 route declarations recorded at main `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` | Static source inspection; literal colours are review candidates, not automatic defects |
| Seven families × Light/Dark | All 14 proposed core palettes present | Hover/pressed/disabled/chart and other production token states remain to be completed |
| Opaque core contrast | All 294 calculations pass their declared thresholds, using unrounded ratios for pass/fail | No full rendered accessibility, transparency, logo or chart certification |
| Desktop preview | All seven Light/Dark cards reviewed in the Codex in-app browser; at 1440 CSS pixels the gallery has three columns and no horizontal page overflow | Fictional static components; not the actual application |
| Narrow phone preview | At 320 CSS pixels, Light and Dark controls work, seven cards remain present, phone layout reflows, and no horizontal page overflow is detected | Browser viewport check; not a physical iOS/Android device or mobile acceptance |
| Browser diagnostics | No captured JavaScript error/warning entries at the end of the preview review | The temporary local server logged a harmless missing favicon request; no external dependencies or application API calls |

Saved views: [Light](PREVIEW-LIGHT.png), [Dark](PREVIEW-DARK.png), [narrow phone](PREVIEW-PHONE.png). The preview keeps its comparison-page header light while switching the miniature laboratory views. It is a design gallery, not an implemented theme selector.

The local preview server and temporary browser tab were closed after review. The HTML remains self-contained and can be opened locally.

Only this new planning folder was created or edited. Existing application files, concurrent documentation, production, Agy's task and the completed monitor were untouched. No application tests, build, migration or deployment were run for this planning request.

Implementation acceptance still requires the full plan's route/state coverage, role and lab authority tests, real device checks, work preservation, scientific/print regression, migration compatibility and safe release evidence.
