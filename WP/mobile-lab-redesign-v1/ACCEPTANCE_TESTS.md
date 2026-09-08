# Mobile and offline release acceptance

These are implementation requirements, not claims of passed production tests. Store evidence by build SHA, API/schema version, operating system, browser/runtime version, device, role, locale and theme. `prototype-qa.json` tests only the design study.

## 1. Test surfaces and fixtures

Agree supported OS versions from the lab's actual device inventory. Cover a small iPhone and a current iPhone; iPad portrait, landscape and split view; a lower-cost Android phone, current Android phone and Android tablet. Exercise Safari and installed iOS web apps separately; Chrome and installed Android web apps separately; packaged Android and iOS apps separately. Include a desktop browser regression run and a secondary Android browser if staff use it. Emulators supplement physical-device tests; they do not replace camera, keyboard, lifecycle, file-provider or storage tests.

Use 320, 360, 390, 430, 600, 768, 1024 and 1440 CSS-pixel layout tests, portrait/landscape, browser text enlargement and zoom. Test English and every other configured language, including long translated method names and validation text. Light and graphite must have identical functionality.

Seed an isolated test lab with: 5 expected project samples; 40 pH determinations under one method revision; 8 preparations; a texture panel; MIR/NIR files in supported import profiles; duplicates and QC controls; expired and current instruments; different analysts; manager-required verification; returned, approved and amended results; two labs with similarly named samples; archived and reassigned work. Use no production record for destructive verification.

## 2. Laboratory correctness — blockers for release

| ID | Scenario | Required outcome |
|---|---|---|
| LAB-01 | Expected sample, no physical receipt, no submitted analyses | No final approval or release. Disabled action explains the missing requirements; direct API rejects unauthorized transition. |
| LAB-02 | Sample drying or preparation | Checklist and method-specific operational evidence; no generic numerical result field. One canonical confirmation updates every view. |
| LAB-03 | Prepare after drying | Correct dependency order; a required manager verification still blocks progression. Offline provisional dependencies are identified explicitly. |
| LAB-04 | 40 samples for one method | A saved run retains order, position, QC rows, units and method revision; Next never silently skips invalid/unsaved input. Phone and tablet use the same records. |
| LAB-05 | Sample page versus workbench | Sample page displays results and opens the exact authorized workbench item. No competing result-entry or completion endpoint is exposed. |
| LAB-06 | Texture | Sand/silt/clay remain one atomic panel, validated against the configured SOP tolerance; no independent partial submission or silent normalization. Class uses the validated versioned classification implementation, not a UI approximation. |
| LAB-07 | Spectroscopy | Original spectrum and required metadata preserved; no substitute scalar reflectance input. File/parser/QC errors remain visible and block affected submission. |
| LAB-08 | Approve, return, amend | Fresh authorization and version validation; approved records cannot be overwritten. An amendment retains reason, history and previous released version. |
| LAB-09 | Repeated confirm/submit | One effective transition, audit event and downstream event. Existing receipts are shown rather than fabricated duplicate success. |
| LAB-10 | Reception counts | Expected or locally pending receipts do not become server-received samples or inflate drying/preparation queues. Online dashboard and queue counts agree for the same scope and filters. |

## 3. Offline durability and synchronization

| ID | Fault or scenario | Required evidence |
|---|---|---|
| OFF-01 | Download selected work pack, then airplane mode and cold launch | Every selected route, schema, translation, SOP and allowed file opens without the network. No uncached lazy chunk/font/decoder breaks the task. |
| OFF-02 | Kill the process immediately before/after the local transaction | Success appears only after durable commit. Relaunch shows the committed record once, or an honest unsaved state. Test native process termination and browser termination separately. |
| OFF-03 | Save offline, switch samples, rotate, lock phone, reboot | All acknowledged values, units, checklists, attachments and run position recover under the same account. |
| OFF-04 | Receipt → drying → prep → analytical draft while disconnected | Allowed same-pack dependencies progress provisionally in order. A rejected or unverified prerequisite blocks descendants without deleting their evidence. |
| OFF-05 | Disconnect after server commit but before response | Retry the same operation ID; return original receipt and ID mapping. Exactly one mutation, accession, audit event and notification exists. |
| OFF-06 | Concurrent duplicate requests and multiple browser tabs | One effective mutation; unique receipt claim handles races. Tabs share outbox coordination without relying solely on a timer. |
| OFF-07 | Same operation ID with changed payload | Reject; never apply a different body under an existing success receipt. Cross-user or cross-device replay is denied. |
| OFF-08 | Two technicians change the same result | Conflict shows local and current server values, units, actors and versions. No last-write-wins, averaging or automatic version bump. Resolving creates a new authorized revision/command. |
| OFF-09 | Mixed 40-sample batch: one conflict, one invalid, one unassigned | Independent valid items synchronize; exact failed items and blocked descendants remain recoverable. Counts match actual receipts. |
| OFF-10 | Server 401/403, lease expiry, scope or assignment revoked | Sign-in or attention state rather than endless retries. Keep local data protected. Reauthentication alone does not override lost privileges. |
| OFF-11 | Offline authorization expires or device time changes | New protected work locks according to policy; existing evidence remains. Server records received time separately and revalidates backdated capture claims. |
| OFF-12 | Browser quota exceeded, persistence denied, low disk or native DB error | No false saved message. Preflight estimates required storage, handles mid-write failure and provides a recovery path. Browser eviction is an explicit platform risk, not a claimed solved condition. |
| OFF-13 | Large spectrum/photo set; fail at every upload part | Durable file bytes survive restart. Checksums, resumption and finalization prevent missing, changed or duplicated evidence. No completion while required evidence is incomplete. |
| OFF-14 | External file provider unavailable after selection | Copied bytes remain locally available, or capture is explicitly not saved. A temporary URI is not treated as an uploaded/durable attachment. |
| OFF-15 | Provisional intake reconnects repeatedly | One server accession and mapping. Temporary labels cannot masquerade as centrally issued labels; reserved official IDs follow server allocation policy. |
| OFF-16 | Pull delta deleted/archived/reassigned records; cursor expires | Apply tombstones and scope changes; resnapshot preserves unsynchronized commands for authorized resolution. |
| OFF-17 | Retry after server maintenance, 429, timeout and 5xx | Backoff with jitter; visible last attempt and retry option. Reconnect/manual foreground sync works without browser Background Sync. |
| OFF-18 | Logout or account/lab switch with pending work | Explicit lock/preservation workflow. No silent deletion; another account cannot read or submit the first user's queue. Test shared device reuse. |
| OFF-19 | App update with unsent old-schema commands | Supported compatibility path and tested local migration; no forced reload, dropped outbox or mixed code/schema worker state. |
| OFF-20 | Rollback application after additive server change | Previous supported client and its queued commands still synchronize. Backup/restore rehearsal does not erase post-backup unsent device work. |
| OFF-21 | Queue final approval or external SIS delivery offline | No automatic approval/release on reconnect. Review notes may synchronize; final authority requires fresh online validation and confirmation. |
| OFF-22 | Staff leave app closed overnight | No promise of background upload. Resume shows true state and starts permitted synchronization; notifications do not substitute for receipts. |

## 4. Mobile interaction and accessibility

- Header, navigation, dialogs, sheets, error banners and menus fit 320 CSS pixels; no global horizontal overflow. True two-dimensional graphs/tables use a bounded view plus an accessible linear alternative.
- Keyboard cannot cover the current input, error or Save/Next controls. Inputs retain at least 16px text, allow zoom and use the appropriate keyboard without preventing signs, decimal separators or qualifiers permitted by the method.
- Every action works without hover and without drag gestures. Use 44–48px product touch targets; verify WCAG 2.2 target spacing and focus requirements rather than declaring compliance from nominal button dimensions.
- VoiceOver and TalkBack announce labels, units, validation, local/server state, tabs and modal context. Focus returns correctly when sheets close; closed drawers and covered content are inert.
- Android system back, iOS/browser back, deep links and scan-to-item transitions preserve unsaved edits and never exit the run unexpectedly. Full-screen dialog back closes the dialog first.
- Scan tests: camera denied/revoked, front/back camera, poor light, duplicate scans, unknown sample, wrong lab, malicious URL, suspended camera, hardware keyboard wedge. Manual entry is always usable.
- Five-language tests include navigation, errors, notifications, offline states, method/schema labels, confirmation receipts and report export. Codes and scientific units remain stable; human names are translated.
- Profile's persistent appearance preference and session-only override keep existing policy. Launch defaults to light when there is no saved choice. Offline cold launch uses the authorized cached preference; no theme flash makes text unreadable.
- Tablets can enter a batch efficiently with keyboard or touch. Switching layout does not remount away an uncommitted edit. Desktop receives no mobile-sized worksheet regression.
- Printing/downloads and camera/files use tested platform pathways. Do not mark arbitrary Bluetooth printers, USB spectrometers or external storage providers supported without device evidence.

## 5. Performance targets to validate

Proposed budgets, not measurements: visible tap response within 100ms; local text/checklist save acknowledgement p95 within 250ms on the agreed mid-range device under normal storage; no full 40-row rerender per keystroke; progressive work-pack download with item/byte progress and cancel/resume. Agree exceptions for large file hashing/imports and show progress without locking navigation.

Measure a representative 40-sample shift first, then a 500-item pack with realistic attachments and the maximum supported spectrum size. Record bytes, peak memory, cold launch, local save latency, sync throughput and battery impact. Set enforced pack/file limits from those measurements. Test slow and unstable connections; desktop broadband is insufficient evidence.

## 6. Release evidence and gates

1. Baseline existing visual/localization work and current workflow services. Reproduce and fix the approval/readiness contradictions before relying on them offline.
2. Complete the route register: each route maps to a phone/tablet design, permission model and explicit offline capability. No `Pending` row may be described as fully supported.
3. Unit/contract tests validate scientific panel atomicity, readiness and idempotent state transitions. Integration tests inject the failures above into real storage and server transactions. UI tests prove screen behavior; screenshots alone do not prove correctness.
4. Pilot one lab with a small enrolled device group, a technician, reception officer and manager. Run a disconnected half-shift and supervised reconciliation using test records, then a controlled real-lab pilot under agreed SOPs.
5. Release separately labelled web/PWA, Android and iOS readiness results. Obtain signed native builds using the organization's legitimate signing setup. Do not conflate a Chrome viewport screenshot with an iPhone app test.
6. Before deployment: commit reviewed app/server/native changes together as appropriate; CI green; migration and rollback rehearsed; documented compatible client versions; publish build SHA and open known issues. Push and production deployment only under the user's implementation authorization.
7. After deployment: verify production build identity and read-only operational smoke tests; use approved test fixtures for writes. Monitor pending queue age, rejected commands and duplicate-receipt anomalies without logging result payloads or secrets. Keep any unresolved defect visible; no unsupported zero-defect claim.
