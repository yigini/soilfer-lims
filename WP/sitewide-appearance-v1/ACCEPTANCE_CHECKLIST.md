# Appearance implementation acceptance checklist

This is the required future application validation, not a claim that the implementation exists. Attach a result, final revision and evidence to each row. The package's `preview-qa.json` covers the mockup only.

## Preference and data integrity

- [ ] Clean browser + OS dark starts light, including login and public routes.
- [ ] Legacy `localStorage.darkMode=true` does not restore dark or become a saved profile preference.
- [ ] Header switch performs no profile API write and changes every mounted surface.
- [ ] Route changes and same-tab reload preserve a temporary selection.
- [ ] New independent tab uses saved default; duplicated/restored tab behavior is explicitly tested and documented.
- [ ] Explicit logout, account switch, 401 expiry and impersonation start/end clear the appropriate override and cache without leaking appearance between users.
- [ ] Auth revalidation, slow network, cached identity mismatch and blocked storage have safe light/memory fallbacks without a blank page or content flash.
- [ ] Dark saved through profile returns dark on later login and another device/browser.
- [ ] A temporary Light override beats saved Dark for that session; clearing the override restores saved Dark.
- [ ] Saving Light overrides previous saved Dark and clears the local temporary choice.
- [ ] Saving an unchanged selection is idempotent and does not change authentication or other preferences.
- [ ] Profile failure/offline/validation error shows readable feedback, preserves selected value for retry and never reports a false save.
- [ ] Concurrent saves and late auth responses cannot write another identity's state or revert the newer choice.
- [ ] A successful save updates the current profile/cache, with safe re-fetch on another tab's focus; an active temporary override still wins.
- [ ] OS light/dark changes do not override the explicit product rules.
- [ ] Theme changes during entry preserve field value, dirty state, validation messages, keyboard focus, selected rows, scroll and draft revision.
- [ ] Theme changes during an upload, graph inspection or review modal do not restart requests, reset zoom, close dialogs or submit anything.
- [ ] Mandatory-password-change and inactive-account restrictions remain enforced; no permission broadening.

## API and migration

- [ ] Additive migration works on a populated disposable SQLite database and is safe to run twice.
- [ ] Existing users resolve to light; IDs, passwords, roles, settings and sample/result data remain unchanged.
- [ ] Self-service endpoint is authenticated and updates `req.user.id` only.
- [ ] Accept only `light|dark`; reject extra target ID/role/lab/password fields, invalid types and unsupported `system` values.
- [ ] Every active user role can save its own preference; unauthenticated calls fail; impersonated sessions cannot silently persist another person's preference.
- [ ] Login, `/me`, user cache and serializers agree on the appearance field without exposing secrets.
- [ ] Old frontend tolerates the extra field and old application rollback tolerates the retained column.
- [ ] Backup and rollout order are recorded; no reset or destructive schema command was used.

## Visual and interaction coverage

- [ ] Every route/alias in `SOURCE_INVENTORY.md` is covered in both themes or assigned an explicit tested content exception.
- [ ] Every role dashboard has nonempty, empty, loading and error states reviewed.
- [ ] Every modal, drawer, tooltip, popover, toast, file/select/date control and portal inherits appearance, including dialogs opened before a toggle.
- [ ] Numeric, operational, texture and spectral editors are legible in normal, selected, readonly, blocked, warning, error, pending-save and disabled states.
- [ ] Table header/footer/sticky columns, row hover, paging/filter controls and horizontal scrolling keep readable backgrounds and text.
- [ ] No near-black legacy panel or accidental bright UI island remains in graphite mode.
- [ ] Normal text meets 4.5:1; large text meets 3:1; essential control boundaries, graph edges/marks and focus affordances meet applicable 3:1 requirements on actual adjacent surfaces.
- [ ] Status is conveyed through text/shape/icon as well as color; disabled actions explain the reason and remain readable.
- [ ] Recharts, custom spectral SVG, React Flow and Leaflet UI are audited with correct data colors/labels/units and theme transitions.
- [ ] Focus is visible using keyboard alone; popover closes with Escape, dialog focus stays inside and returns to its trigger.
- [ ] Appearance text is translated with the current language system in en, es, es-419, fr and pt; long labels at 200% zoom fit.
- [ ] Chrome/Edge and Firefox, desktop 1440/1280/1024, tablet 768 and mobile 390/320 reviewed as applicable; no loss of controls or clipped text.
- [ ] Reduced motion, forced colors/high contrast, autofill and browser native input appearances are checked.
- [ ] Branding logos and configured accent fallback remain legible and are not color-inverted.

## Print, export and public content

- [ ] Report viewer/loading/error/action bar follows appearance; scoped paper stays white with dark text.
- [ ] A4 reports and 101 × 54 mm labels print correctly from both modes; CSS rules do not override each other's format/visibility.
- [ ] Report contents, values, IDs, approvals and previously issued files are unchanged.
- [ ] Map/spectrum export uses the documented export palette, correct background and readable axes without changing the screen or data.
- [ ] Public report token expiry/revocation/errors are readable without authentication in both temporary appearances.
- [ ] Deliberate white content exceptions (paper, images, basemap, logos) are enumerated; they do not cover ordinary unthemed UI.

## Release evidence

- [ ] Token contrast checker and relevant resolver/API/auth/storage lifecycle regression tests pass.
- [ ] Appropriate frontend build, i18n audit, backend tests and migration smoke tests pass on final commit; lint results are reported honestly, with baseline failures distinguished.
- [ ] Visual evidence matrix includes route, role, theme, state, viewport, screenshot and any resolved issue reference.
- [ ] Browser console has no new runtime/theme errors; no critical or serious appearance/accessibility regression remains in audited states.
- [ ] Staging demonstration includes switching during an unsaved worksheet, Profile save/re-login and print previews.
- [ ] GitHub PR, CI and exact deployed commit are identified. Production checks use read-only actions or a dedicated test account/isolated demo data.
- [ ] Rollback is ready; remaining exceptions and limitations are named. “All done” requires this matrix, not only successful CSS build output.
