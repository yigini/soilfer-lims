# Instrument file import (#200 / 4.7)

CSV/TXT and ordinary XLSX imports now use saved instrument mappings, read-only
previews and atomic draft/QC commits. Paste also matches actual lab sample labels
and comma/semicolon/tab delimiters. Import never records final Results, performs
an activated calculation, evaluates QC or changes workflow status.

## Scope and authorities

Implemented on main e0462c85 after #210; merged #186/#190 are dependencies and
merged #199 supplies current local-template activation. The cited paste defects
were confirmed before editing on main7ea12c66.

Issue comment pins take precedence:

- [Templates/evidence/QC](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6091749530).
- [Activated inputs](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6094747629).
- [Existing QC owner, entry only](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6095469488).
- [Shared typed reporting-unit reader](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6095652486).
- [Atomic commit/existing drafts](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6096085980).
- [Draft receipt-field refusal/input-only QC](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6096218065).
- [XLSX boundary](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6095961328).
- [Latest numeric storage/round-trip decision](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6096643904), superseding earlier raw numeric storage.

Closed schema-only fixtures, LF digests/callers, additive installers and independent
Prisma oracles follow [the standing agreement](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6089928620).
Original89-model and independently emitted current-main92-model predecessors are
retained. Their factories create schema only and grant no analytical-row authority.

## Mapping and API

GET /api/workbench/runs/:batchId/imports/context uses the same scoped started,
non-closed native run and actual instrument as preview. It returns persisted
instrument templates, exact catalogue reporting-unit fields and the validated
current activation's input definitions.

POST /api/workbench/instruments/:instrumentId/import-templates requires
MANAGE_EQUIPMENT. Append-only revisions retain lab/instrument and name their exact
predecessor/version. Every template column is immutable.

POST /api/workbench/runs/:batchId/imports/preview and /commit require ENTER_RESULTS.
Multipart fields: file, templateId, optional exact sheetName, and commit-only
previewToken. Another instrument/lab cannot authorize the run. Clients supply
no receipt ID or policy/activation override.

Mappings specify delimiter/header, identifier column/type and analytes. Matching
uses lab sample code, original ID or physical run position. Each analyte uses
one shape: direct value with exact fixed unit/unit column and optional dilution,
or every current activated input variable exactly once with its declared unit.
No output unit/value or implicit reference-library calculation is inferred.
Import never converts units or multiplies dilution; direct dilution is absent or1.

QC detection uses explicit editable BLANK/CCV/LRM prefixes and physical position.
Only existing matching native QC positions receive new observations. Input-only
calculated QC refuses here; its calculation-aware path belongs to #213.

The screen uses actual definitions and saved immutable revisions, shows every
matched/unmatched/QC row and per-cell issues with paging, and invalidates preview
on file/sheet/template/mapping changes. Dirty edits must be saved. Manager controls
are permission-bound. All new client strings exist in all5 locales, with prior
translation values unchanged.

## Preview, commit and evidence

Preview is read-only. The server seals actor/run/lab/instrument, template revision,
file name/SHA, sheet selection, current activation and effective lab number policy.
Commit checks that seal and rereads the authorities inside one transaction.

Unknown IDs remain SKIPPED_UNMATCHED in preview/receipt and write nothing. Any
matched-row conflict refuses the whole file with its stable code and zero writes.
Zero matches and ambiguous/duplicate destinations are explicit refusals. Existing
populated/receipt-linked drafts and sealed executions are refused; nothing is
merged into, overwritten, adopted or corrected.

Drafts use the existing draft owner with a server-only receipt option. Ordinary
controller/owner receipt fields give DRAFT_FIELDS_INVALID before writes; other
unknown fields retain prior behavior. Direct/QC units use the shared typed-writer
reader with strict import units; ordinary typed behavior is unchanged.

QC uses the existing writeNativeMeasurements owner with its pinned entry-only
option: new pending observations and existing event/audit evidence, no evaluation,
reference edits, correction, final result or disposition. Later recording and
evaluation remain explicit actions through their existing owners.

One immutable InstrumentImportReceipt stores unchanged uploaded SHA/name, template
revision and complete decoded preview, including skipped rows, raw cells, mapping,
policy/activation and per-cell evidence. Receipt, drafts and QC commit atomically.

## XLSX parsing and required dependency approval

Untrusted XLSX is parsed on the server. The client's existing xlsx@0.18.5 is not
used for these uploads. ZIP decoding uses Node zlib/CRC checks, ordinary single-disk
stored/deflated members and data descriptors. It verifies local/central headers,
declared/actual sizes, CRC, consumed bytes, duplicate/overlapping members and paths.
No extraction, formula evaluation, external loading or XML entity expansion.
ZIP64, encrypted and unsupported ZIP forms refuse conservatively.

XML uses **saxes6.0.0 (ISC)**, promoted from the existing exact dev lock, with
exact locked xmlchars2.2.0 (MIT). Upstream saxes is archived. October10 GitHub
Advisory Database queries found no matching advisory for either package. Existing
repository dependency findings are neither fixed nor concealed by this issue.
**Explicit YY approval of this concrete dependency in the PR is required before
merge**, per the XLSX pin; no approval is claimed here.

Sources: [saxes](https://github.com/lddubeau/saxes),
[Node zlib](https://nodejs.org/download/release/v22.22.0/docs/api/zlib.html),
[ZIP APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT),
[OpenXML formats](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.numberingformat).

Caps: **16MiB compressed/upload**, **64MiB total uncompressed**, **4096 ZIP entries**,
**250000 XML nodes**, **depth64**, **4096 merge ranges**. Cap excess gives
IMPORT_XLSX_TOO_LARGE, including multipart. Malformed ZIP/XML, DTD, .xlsm, VBA and
external-link content give IMPORT_XLSX_INVALID. These refuse the file with no writes.

Numeric cells retain exact stored v lexemes; shared/inline rich strings retain
exact decoded text. Formula/cached-string cells, cell errors and mapped boolean/date
values give pinned codes. Percent/scaling-comma/date/time formats refuse; plain
rounding formats never render or round. Receipts retain sheet/ref/type/style/
format/raw lexeme for every cell.

Numeric lexemes first pass the pinned invariant regex and unchanged invariant
parser. Comma-decimal labs change only the single decimal mark; every digit,
sign and exponent is retained, with no Number() text round trip. The effective
lab parser must return exactly the same value and canonical text, or the entire
file refuses with IMPORT_XLSX_NUMBER_POLICY_CONFLICT. Drafts/activated inputs store
verified labText; receipts retain labText/policy version and original lexeme.
Text cells and CSV/TXT keep ordinary lab-policy parsing unchanged.

A single visible worksheet may be implicit. Multiple sheets or any hidden sheet
require an exact template/request name. Missing selection/name gives
IMPORT_XLSX_SHEET_REQUIRED/IMPORT_XLSX_SHEET_NOT_FOUND. Merged anchors carry values;
other cells stay empty.

## Additive installation and preservation

Migration20261010000100_instrument_import_templates creates two immutable import
tables/guards and adds nullable restrictive WorkItemDraft.importReceiptId using
native SQLite ALTER, without table rebuild or historical backfill. Independently
emitted fresh/prior/upgraded draft oracles are digest-bound.

On an explicit existing owned database, run server/scripts/install_instrument_imports.js
with --db /absolute/owned.db --dry-run, then the reviewed --apply. The installer
checks #199 prerequisites, integrity and exact schema/source classification.
Foreign/partial/forged/unmarked populated import schemas refuse with zero writes.
An IMMEDIATE transaction preserves all original rows/objects/columns/FKs, adds
approved objects and one installation receipt. Dry-run/repeated apply are read-only.
Startup does not create a missing database. Default entrypoint and Docker package
the real installer and all four source assets.

Populated owned predecessor proof at8aeeb095: **95 original tables**,2 Samples,
2 WorkItems,1 Result,1 WorkAttempt,1 raw draft,1 QC measurement,1 QC evaluation,
9 AuditLogs,6 BatchEvents,28 prior installation receipts. All original rows and
raw draft strings remain identical. Dry-run0 changes; apply **1 installation
receipt,0 templates,0 import receipts,0 draft links,0 backfills**; repeated apply0.
Separate retained before/after backups keep exact SHA values; integrity/FK pass.

## Validation and remaining gates

Normal npm test -- --runTestsByPath uses unchanged global setup and real owners/
fixtures, with no bypass, owner mocks, skipped or weakened tests:

- dc032759:10 suites/**301 tests/0 skipped**,55.099s,PASS. Includes source/commit/
  unit refusals, both predecessors, full ICP **40 samples x4 analytes +6 QC rows**
  (160 exact drafts/24 pending QC observations/one unknown ID), EXCH_CA/Olsen
  imports and later actual typed recording freezing activation/template/curve.
- ecf4c6d4:4 suites/**138 tests/0 skipped**,11.781s,PASS: import UI, existing paste/
  calculation UI, unchanged scanner. Real FormData, revisions, invalidation,
  permissions, refused commits and stale responses.
-8aeeb095:6 suites/**221 tests/0 skipped**,29.637s,PASS: populated preservation,
  actual commit/ICP/calculation/UI and scanner.
- Client build PASS17.919s;lint PASS8.671s,**0 errors/same14 existing warnings**.
  Client source is unchanged afterecf4c6d4; existing bundle-size warning retained.

Groups overlap and are not aggregated. Earlier failures remain logged; only new
fixture assumptions were corrected. All protected DB hashes remain unchanged:
owned6d216ef2, retained6fa171ad, working490b8c47.

The newly mounted compressed-size test, full suite/green CI, both real Docker
rehearsals, YY dependency approval and exact-current-head Claude audit remain
release gates. No production import migration/backfill has run. Deployment is
subject to absolute #190 disk/YY host hold; Claude closes issues after post-deploy.

Deferred: calculated QC#213, QUDT authority follow-up#283, unit/dilution conversion,
formula execution, alternative XLSX readers and scientific defaults.
