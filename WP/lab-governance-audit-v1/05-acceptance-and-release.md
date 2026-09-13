# Acceptance tests and release evidence

## 1. Required test environment

Create an isolated, disposable SQLite database from the actual Prisma schema and migration history. Inject its path explicitly and assert at test startup that it is outside all live/default database paths. Never run the repository’s existing integration bootstrap until its database routing has been inspected: `server/tests/setup.js` imports `../db` and may fall back to a configured DB.

Use real Express route mounts, current authentication, real Prisma validation, transactions, audit and receipt persistence. Mock only external mail/Kobo/SIS transports. The VM runner in this package demonstrates current logic; it is not the implementation’s acceptance suite. Preserve original evidence separately when fixes change probe outcomes.

Fixtures: labs A and B in GTM, C in FRA; A active, B active, C paused; an orphan/no-lab fixture; all ten roles; two retained super administrators and a last-admin case; a national lead scoped to A/B; project lead with one explicitly assigned cross-lab project; local-owned, shared, junction-only and legacy-conflicting projects; active/inactive/pending people; known unknown/offline devices; two distinct browser accounts.

Scientific fixtures: expected/unreceived sample, accepted intake, pending drying/prep, ready method batch, returned work, saved draft, submitted/accepted determination, released report, amendment and spectra. Include a 40-sample method batch and 200-row directory pagination. Do not use a manager role as a stand-in for every role test.

## 2. Blocking acceptance matrix

Each row needs named test evidence, not a checked box without output. Read tests must check denied data are absent. Write tests must assert no DB mutation, audit side effect, receipt success or emitted event on denial. Valid companion actions must still succeed.

| ID | Scenario | Required outcome |
|---|---|---|
| A01 | Manager A calls every lab profile/status/staff/reset endpoint for B, including same-country B | Denied consistently; no B data or mutations |
| A02 | Manager A targets peer manager, project manager, national/admin user or self through lab and Users routes | Forbidden management changes; permitted self-profile fields work through own-profile endpoint |
| A03 | Manager creates own allowed subordinate / viewer tries same call | Exact permitted role/lab/project subset only; viewer denied |
| A04 | National scope GTM opens FRA lab by direct ID, query selector, pagination/filter, export and cached URL | Denied before exposing lab name/staff/counts; A/B still available |
| A05 | National scope empty/malformed; unknown role; no lab | Explicit actionable denial; never global fallback or invalid Prisma country field |
| A06 | All ten roles use list/detail/search/count/export for user/lab/project/sample/equipment | Same resource policy, appropriate minimal fields and valid positive journeys |
| A07 | Lab PUT injects ID/isActive/createdAt/unknown fields; user role empty, boolean string or invalid locale | Rejected with field errors; omitted fields preserved; immutable identities unchanged |
| A08 | User creation/transfer targets nonexistent, paused or unauthorized lab/project | Rejected or pending setup according to explicit lifecycle; no orphan records |
| A09 | Attempt to disable/delete/demote last admin in both staff interfaces and lab lifecycle | Atomic guard; remaining recovery account tested |
| A10 | Two concurrent admins demote/suspend each other using the same initial snapshot | At least one effective admin remains; stale/conflicting request receives 409 |
| A11 | Planned departure with work / immediate emergency disable with work | Planned handover available; emergency disable succeeds within authority and flags stranded work, preserves evidence |
| A12 | Invitation create/resend/expire/reuse/revoke, duplicate email, delivery failure | One pending identity, hashed single-use secret, no shared password, clear delivery state, no false active user |
| A13 | Admin recovery and password change, old JWT, reactivated user | Old tokens invalid on HTTP, SIS and WebSocket; only intended recovery endpoints reachable; reactivation does not revive old sessions |
| A14 | Impersonation target has nonzero version; original admin later disabled | Support starts correctly then ends on actor revocation; target rights never exceed intended support grant; original actor in audit |
| A15 | User changes lab/role while two tabs and socket are open | Old views clear/reload safely; socket revoked; account identity cannot remain subscribed to old lab |
| A16 | Cached pack requested by another person/lab, expired pack, missing pack ID | Denied or explicit 404/expiry; no new unrelated pack silently substituted |
| A17 | Pack requested without a required lab or for somebody else’s work | Denied; no global sample query; only authorized content in bundle |
| A18 | Offline viewer or revoked technician completes foreign-lab/accepted work | Rejected by canonical domain policy; no attempt/update/receipt APPLIED |
| A19 | Offline draft save then restart server / duplicate replay | Durable draft survives; original exact command receipt returned; no duplicate attempts |
| A20 | Account A’s unsynced draft, logout, login B, reconnect | No A work visible or replayed as B; draft retained and recoverable by authorized A workflow |
| A21 | Offline transfer/suspension, stale method revision, equipment now blocked, expired lease | Evidence retained with honest conflict/recovery status; no auto-approval or substitution of actor |
| A22 | Missing prerequisites, scalar versus checklist, texture group and spectral upload | Same existing scientific rules online/offline; no generic scalar fallback |
| A23 | Assignment to inactive technician, wrong lab, unauthorized national actor | Denied both picker and command; correct technician works; old attempts stay attributed |
| A24 | Shared project manager edits global name/access/manifest/archive/restore/delete | Only explicit owner/delegation allowed; local lab cannot unlink other labs’ samples |
| A25 | Junction-only project and project-manager grant across list/detail/reports | Valid records consistently accessible; no overbroad legacy union |
| A26 | Remove project/lab relation with pending samples and released report | Reviewed action preserves sample provenance/history and defined historical access; no RESTORE pool data loss |
| A27 | Kobo project config, lab config, form fields, sync sample/lab/all from foreign scope | Denied; exact authorized config selected; no raw token returned, no cross-lab job triggered |
| A28 | SIS key create/list/revoke by ordinary lab manager or excessive delegated scope | Denied outside explicit integration authority; bounded lab grants/expiry; new valid scoped key actually reads expected released data |
| A29 | SIS API key missing labs, expired/revoked key; JWT with stale version | Denied; preserve existing fail-closed consumer behavior |
| A30 | Equipment create with foreign body.labId, update/status/disposition/events/eligibility | Every operation checks parent/resource lab; authorized calibration logging still works |
| A31 | Inventory lot points to foreign location/item/work or user lacks lab | Denied without partial ledger; valid same-lab transfer preserves quantity and audit |
| A32 | Local language/branding settings versus global locale create/delete | Own-lab overrides preserved, global mutations restricted; all five locales remain intact |
| A33 | Pause/resume lab with individually disabled staff, no-lab admin, offline users and in-flight command | Explicit state, transaction and revision outcome; disabled staff stay disabled; no accidental global admin lockout |
| A34 | Audit write fails / mail delivery fails / event broadcaster fails | Transaction failure rolls back business data; external delivery failure does not lie about committed data; retry uses same command ID |
| A35 | Admin with no home lab assigns work in A | A’s users receive scoped refresh; B receives no private update; missed event recovered by refetch |
| A36 | Expected samples, released samples, waiting gates, cancelled/waived tasks | Lab workload metrics and queue rows agree; expected is not drying pending; count units clear |
| A37 | Lab midnight, browser in other timezone, DST 23/25-hour day | Correct half-open next-local-midnight interval; no duplicate/omitted day; old UTC timestamps unchanged |
| A38 | Search/race/error/empty roster; 40 staff and 200+ rows | DB pagination bounded; stale response cannot replace latest search; 403/500 shows error, never “No staff” |
| A39 | 320, 390, 768, 1440 px; both themes; all five locales with long labels | No clipped names/actions, page overflow or unreadable inputs; keyboard/dialog focus and touch targets pass |
| A40 | Existing deep links, Help context, Reports, sample map, mobile workbench and recent/offline client build | Working routes/filter context; helpful guide; preserved drafts and core workflows |
| A41 | Project update handler and retry | One HTTP response, one intended transaction, no headers-sent error, correct current revision |
| A42 | Migration rerun, rollback-compatible code, partial failure and restore rehearsal | Idempotent mapping, no orphan/lost entities, retained admin works; exact forward-repair procedure tested |

Also run current domain regression suites for workbench, operational confirmations, sample approval/amendment, spectral intake, dashboard scope, catalogue, inventory, mobile sync, theme and Help v2. Verify their test DB setup first. Do not disable or weaken existing tests to obtain a green build.

## 3. Human scenario sign-off

Use staging accounts, not real production staff actions:

1. Administrator provisions a lab in SETUP, validates identity/timezone, appoints a named manager and makes it ACTIVE after readiness checks. No generated generic accounts or test project.
2. Manager invites a technician, sees pending activation, opens the actual roster after activation, assigns a 40-sample pH batch and follows its real queue link. Technician records through workbench; sample page remains a consistent view.
3. Manager reviews a staff role change. Existing in-progress work is explicitly reassigned or flagged; prior results remain signed by the original technician.
4. National lead moves between authorized labs; foreign-lab URL is denied gracefully. Project lead sees their project across service labs but cannot administer those labs’ people or keys.
5. Administrator pauses and resumes a lab. Staff understand their access state, existing disabled account stays disabled, pending offline evidence remains available for controlled recovery, other labs keep working.
6. Auditor follows a change from person → assignment → sample → report → audit. External partner sees only intended published content. Reception and surveyor retain their daily paths.

Record screenshots, role, lab, route, expected/actual outcome and build commit. Do not include real recovery tokens or customer details in evidence.

## 4. Deployment gates and evidence

- Inventory exact Git branch/working tree, deployed commit, schema, environment and background jobs. Preserve unrelated work and newer Antigravity commits.
- Run additive migration and smoke journeys on a restored isolated snapshot; inspect mismatch report and reconcile intentional scope changes.
- Retain verified administrative access and independently test the recovery procedure. Record who can recover each lab and how work is handled if a person is suspended.
- Pass all security, integrity and lockout gates before enabling new management writes. Ship access-control fixes ahead of cosmetic work if separately verified.
- Commit only intended application/migration/tests/docs/assets; no DBs, uploads, `.env`, secrets or unreviewed private reports. Push the reviewed branch/commits to the configured GitHub remote; follow the repository’s release process once deployment is authorized.
- Use backward-compatible server/client rollout, then migrate readers/writers. Existing lazy-loaded asset URLs remain available during rollout; update messaging protects unsynced drafts.
- On production, verify release commit/health and read-only role-appropriate pages, counts, links, login and static assets. Do not use real staff/password/project changes as smoke tests. Use a clearly isolated test tenant only if one is explicitly approved and segregated.
- Monitor authorization errors, server 5xx, migration anomalies, failed audit/receipts, sync rejections and help requests by build and scope. Separate newly correct denials from legitimate users unexpectedly blocked.
- Roll back UI/code only to a compatible version retaining the security fixes. If that is impossible, disable affected administrative writes with a clear message while applying a forward repair; do not re-enable the bypass.
- Close issues only with PR/commit, passing tests, migration evidence and deployed verification. Keep any unresolved critical/high finding open and clearly mark release blocked; public issues use non-sensitive descriptions.

**Completion report format:** delivered commits and production build; migrations and before/after counts; A01–A42 evidence; all ten role journeys; remaining limitations; recovery owner and tested procedure. Do not report “zero issues” merely because the frontend builds.
