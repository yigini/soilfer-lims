# API key creation window — 4 October 2026

The creation window exceeded the viewport because its long, centred panel had no height limit or main scroll area. Only the laboratory list could scroll. It also lacked Escape handling and keyboard focus management.

The correction is confined to `ApiKeyManager.jsx` and one new clipboard-failure message in each of the five language packs. Creation uses a native modal dialog above page stacking/transform contexts, a viewport-limited panel, a scrolling form body, and fixed header/footer. Escape, Close and Cancel preserve entered fields; all three wait while generation is in progress. Validation and request errors appear inside the form. The generated-secret window has the same bounded layout and requires its explicit saved-key acknowledgement before dismissal. Copy feedback waits for clipboard success; failure retains the secret and offers manual copying. Backend routes, permissions, scopes and submitted payloads are unchanged.

## Executed verification

- Client production build passed.
- Chromium through Playwright, using the actual component and providers in a local isolated harness with synthetic administration and laboratory data. Every API request was handled by a synthetic adapter; no live API key was created or changed. The harness included a transformed, clipped parent to reproduce the problematic page environment and React Strict Mode.
- Creation stayed within the viewport, with footer buttons visible, a scrolling body and no horizontal overflow at 1280×720, 1024×600, 960×540, 320×568, 568×320 and 480×270. The latter sizes include small viewport equivalents for zoom; these are not a claim of physical-device or native browser-zoom qualification.
- Initial name-field focus; Tab and Shift+Tab wrapping; Escape dismissal; focus restoration; closing/reopening retained the name and laboratory selection.
- Missing laboratory scope produced an inline error without sending a creation request. Pending generation disabled Close/Cancel and prevented Escape dismissal. A rejected synthetic request retained the form and remained dismissible afterwards.
- The successful synthetic request retained the original role, country, laboratory, capability and expiry payload. Creation transitioned to the one-time secret dialog. Escape and outside clicks did not discard the secret.
- Clipboard rejection showed an inline failure and retained the key without false “Copied” feedback. Successful clipboard completion showed “Copied”. Explicit acknowledgement dismissed the secret and restored focus to the creation trigger.
- The secret dialog also retained a visible footer without horizontal overflow at 320×568 and 480×270.

The temporary harness and synthetic browser state are excluded from the release. Physical mobile devices and a human screen-reader listening session were not used for this focused correction.

Merge, CI and production verification are recorded separately once actually completed.
