# Map background access failure — focused implementation addendum

15 September 2026. User supplied a screenshot of OSM 403 “Access blocked” tiles in the reception location picker and asked what to do. Continue through Antigravity within the existing safe-fix/deployment workflow. Preserve concurrent work; this is not the separate external Dashboard GTM issue #104.

## Evidence and limits

- Public LIMS /login HEAD response on 15 September at 05:09 UTC returned Referrer-Policy: no-referrer. server/app.js initializes Helmet without a referrer-policy override.
- LocationPicker.jsx, SampleMap.jsx and FieldMap.jsx OSM layers use https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png without an explicit tile referrerPolicy.
- Installed Leaflet supports a per-tile referrerPolicy and applies it to image elements before assigning the source.
- Missing referrer is a concrete configuration incompatibility and a likely cause of the screenshot, not proof that every client/network block has that cause. Verify an actual browser tile request after correction.
- OSM policy: https://operations.osmfoundation.org/policies/tiles/ . Leaflet API: https://leafletjs.com/reference.html#tilelayer-referrerpolicy . These were consulted in preparing the addendum.

## Smallest safe correction

1. Use canonical https://tile.openstreetmap.org/{z}/{x}/{y}.png in all OSM layers. Reuse a small shared provider configuration if appropriate; no new mapping framework.
2. Prefer explicit TileLayer referrerPolicy="strict-origin" for those requests: identify the real LIMS origin without sending sample paths, query parameters or identifiers. Keep the existing global no-referrer privacy policy if the element override works. Verify actual generated image attributes AND outgoing browser requests; do not assume a changed header alone proves success. Do not loosen CSP/CORS or spoof identity to bypass a block.
3. Preserve linked OSM copyright attribution and provider-specific attribution on other layers. Check reception editing, sample map display and field-map OSM layer switch. Do not silently replace other providers or use unofficial endpoint rotation as a workaround.
4. Handle tile errors/timeout with a bounded, translated “Map temporarily unavailable. You can still enter coordinates.” state and deliberate retry. Stop repeated failing requests. Keep latitude/longitude, uncertainty, elevation, markers and user-entered values intact; never substitute 0,0 or mark a sample received because a background loaded. A fallback must not block keyboard/manual entry or its normal save path.
5. Avoid hiding partial failures as healthy; allow recovery on successful reload/layer change. Tileerror detects network/HTTP failures but may not detect a provider returning an error graphic as a successful image, so include visual acceptance. Do not claim universal error-image detection without evidence.
6. Respect HTTP caching. No cache-busting loops, prefetch, automated pan/zoom sweeps or downloads of OSM public raster tiles for offline packs. Audit actual service-worker/offline tile behavior. Offline data entry remains supported with an honest unavailable-basemap state. A true offline basemap requires a separately configured licensed/self-hosted source; do not buy a service or claim offline maps are complete here.

## Verification and delivery

- Mock tile success, error and timeout in focused browser checks; test retry without lost coordinate values or form changes. Cover all three map consumers, light/dark and narrow screens. Use synthetic coordinates for test requests and do not persist production sample changes.
- Validate outgoing tile referrer is origin only, no sample URL/token; validate existing unrelated privacy headers remain intact. A minimal normal interactive live check is enough; do not run a headless tile crawl against community servers.
- Verify standard map imagery visibly renders after deployment. Record any remaining network/provider-specific blocking separately; do not promise a config fix immediately removes a persistent provider block.
- Keep this patch separate from in-progress Help publication data. Push a focused commit, pass relevant checks/CI, follow existing safe deployment, and verify exact release/assets plus ordinary login/reception access.
- Track the defect on GitHub as yigini (check duplicates first), explain the confirmed cause and solution, and close only after actual live verification. Keep #104's external Dashboard issue separate.
- No core workflow, permissions, database migration or bulk coordinate repair is needed for this fix. Continue other approved issue work after this bounded patch.
