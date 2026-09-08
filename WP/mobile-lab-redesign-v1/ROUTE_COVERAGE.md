# Mobile route design and verification register

Every captured route has a proposed design below. **Application/device verification is pending for every row.** The prototype covers representative journeys only. Recheck actual role guards and current routes at implementation; aliases must share controllers and storage.

Offline capture means scoped work packs, durable local commands and later server validation. A snapshot is downloaded, authorized and version-labelled. Online operations remain usable on mobile when connected. Every row needs all five languages, light/graphite, keyboard, zoom and permitted-role tests.

| Route | Phone / tablet design | Offline disposition | Verification |
|---|---|---|---|
| `/login` | Compact login/unlock; keyboard-safe fields, destination restoration | First enrollment online; enrolled unlock within offline grant | Pending |
| `/` | Role-specific actionable home; tablet task/attention split | Timestamped snapshot totals; local counts separate | Pending |
| `/samples` | Searchable specimen rows; tablet list/detail | Downloaded specimens and provisional intakes; no global search claim | Pending |
| `/samples/:id` | Compact identity, next action, sections; results read view | Snapshot plus provisional trail; edits open canonical task | Pending |
| `/samples/:id/map` | Linear dependency trail; optional touch graph with controls | Downloaded workflow plus labelled pending local steps | Pending |
| `/workflow-map` | Scope chooser and graph/list; tablet split view | Downloaded scope, no false live/global status | Pending |
| `/my-work` | Same run/work controller as workbench | Same queue/outbox; preserve links and filters | Pending |
| `/workbench` | Method runs → active specimen; tablet batch/list detail | Eligible checklists, numeric/panel/file capture and reviewed queued submissions | Pending |
| `/manager-queue` | Attention/review list, evidence and decision view | Cached evidence and review notes/proposals; final decision online | Pending |
| `/reception` | Identity → condition → analyses → review; all existing modes | Eligible receipt/draft/photo capture; provisional or reserved identity | Pending |
| `/inventory` | Lot search, stock detail, transaction form; tablet ledger | Downloaded lots and eligible usage; balance conflicts checked on sync | Pending |
| `/equipment` | Find/scan instrument, validity, assigned work, service evidence | Snapshot validity and eligible log/evidence capture; holds revalidated | Pending |
| `/users` | List and single-user form; tablet master/detail | Authorized reference only; role/account mutations online | Pending |
| `/projects` | Project → arrivals/samples/field context; tablet detail/map | Selected records and provenance; global changes online | Pending |
| `/admin` | Grouped destinations, search, clear current section | Bundled navigation/reference; authoritative changes online | Pending |
| `/admin/methods` | Catalogue → definition/SOP/schema editor | Pinned definitions for work; catalogue publishing online | Pending |
| `/lab-methods` | Lab availability, parameter names, equipment context | Downloaded configuration; availability changes online | Pending |
| `/admin/audit` | Event list and actor/time/evidence detail | Authorized immutable snapshots; no local audit editing | Pending |
| `/admin/labs` | Lab list, scope and single-lab management form | Reference snapshots; scope/global changes online | Pending |
| `/admin/legacy-import` | File pick, mapping, validation and commit review | Local staging where supported; central validation/commit online | Pending |
| `/datasheet` | Parameter-aware rows/detail; tablet pinned identity matrix | Scoped data; existing entry links resolve to canonical work controller | Pending |
| `/maps` | List/coordinate alternative; touch map with zoom buttons | Selected records; tiles only if supported/licensed | Pending |
| `/qa` | Exceptions/QC and evidence; tablet list/detail | Eligible evidence capture; authority-sensitive dispositions online | Pending |
| `/spectral-library` | Spectrum list, plot/detail, model/reference context | Selected spectra/reference; library/model publishing online | Pending |
| `/spectral` | Spectrum intake/run/parser/QC; tablet trace comparison | Original file and pinned metadata; processing pending unless validated local engine exists | Pending |
| `/data-results` | Scientific rows, units, panels/classes and filters | Scoped read snapshots; entry links open workbench | Pending |
| `/result-reports` | Issued report list, preview, tested export controls | Downloaded released versions; new release/server exports online | Pending |
| `/reports` | Report filters/list/preview; tablet detail | Same repository and release policy as other report entry points | Pending |
| `/report/:token` | Recipient report view, readable pages, download/print | Explicit authorized download only; preserve token access/version policy | Pending |
| `/profile` | Account, locale, appearance, enrolled-device sections | Cached preferences, supported queued changes; credentials/security online | Pending |
| `/about` | Readable product content and navigation | Bundle essential content/version | Pending |
| `/techstack` | Reflow long content, links and code blocks | Bundled internal content; external links need connection | Pending |
| `/tech-stack` | Same canonical content/view | Same asset/cache behavior | Pending |
| `/credits` | Readable credits and accessible links | Bundled content; external links identified | Pending |
| `*` | Helpful not-found/unavailable state and Back/Home | Distinguish uncached, wrong link and permission denial; preserve pending work | Pending |

## Embedded controls and non-route surfaces

Header/user/notification menus, language/theme selectors, navigation, analysis selection, bulk actions, batch/spectral dialogs, assignment/approval/amendment, field data, audit drawers, labels/printing, tutorial, translation editor within admin, KoBo/SIS settings, import/export, session-expired views, scanner/permissions, file/camera pickers, offline enrollment, work packs, Sync Centre, conflicts and update prompts. Create explicit implementation test cases even if App.jsx has no separate route.

Maintain evidence per row. Do not turn Pending into Pass based only on source inspection, route existence, a screenshot or an in-memory prototype test.
