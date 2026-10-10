# Instrument import (#200, work in progress)

Scope pins: [6091749530](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6091749530)
and [6094747629](https://github.com/yigini/soilfer-lims/issues/200#issuecomment-6094747629).

The paste dialog matches displayed lab labels, original IDs and internal IDs,
supports explicit tab/semicolon/comma delimiters, preserves raw cell whitespace,
and refuses ambiguous or repeated targets. Numeric previews use the supplied
task policy. The pure source decoder preserves exact UTF-8 source bytes and
SHA256, quoted cells, Unicode, raw units/dilution and malformed-row evidence.
The 40 by four plus six QC source case currently proves decoding only.

The schema declares append-only instrument templates, immutable import receipts
and a nullable draft receipt pointer. An independent own-Prisma7.10 emission
contains 91 models and 78,187 bytes, SHA256
`9beb953d1a87816c60d19743c4ce00fd32f980c4a3cefce57aff70259853155c`.
The three managed fresh-table definitions have oracle SHA256
`9e098129de487fdb8ae551da9756a48c5627821ebe8da899f965824f815849df`.
The additive migration uses the two new table definitions exactly, adds the
nullable restrictive draft foreign key and six guards. Its SHA256 is
`68555c0f9901a48c1c87a7d4ccb8320d0c515e388df094a47865064ee0ad6fc8`.

The closed schema-only test factory has no arguments, one permitted caller and
no analytical fixture writes. Its literal predecessor is the unmodified
89-model own-Prisma emission from main4a49798: 76,218 bytes, SHA256
`c49761af3bab4bc8b822bc94f4f2193c8f3f780b7da6c715fe5a8a424af70aee`.
The scanner binds its source and literal schema independently, rejects altered
source and unlisted/runtime imports, and grants no Result writer authority.

Five focused suites pass all 179 tests, zero skipped (14.048 s), covering the
source decoder, actual paste UI, unchanged keyboard UI, new SQL contracts and
all 105 existing security-scanner tests. The SQL contracts exercise every
immutable field, deletion refusals, revision chains, instrument/lab bindings,
receipt validity, restrictive nullable pointer and integrity checks. The
separate in-memory rehearsal preserves 89 original tables' rows (synthetic
lab/equipment rows and empty analytical tables), with 29 refusal probes. It is
not a populated production migration proof.

The first five-suite run passed 157 tests and failed one scanner assertion;
the keyboard suite could not load its external jsdom dependency. The primary
checkout retained a CRLF copy of the unchanged rawInput migration after rebase,
so its existing byte-bound loader refused it. The original disk bytes were
retained separately and the exact committed LF bytes restored without changing
the migration or scanner's expected digest. The corrected harness supplies the
existing dependency paths; no test, assertion or guard was weakened. Both logs
are retained. All checks left working dev.db exactly SHA256
`490b8c4782bdc5300e729dbcafe9f01dd695995a7d6c69f3002dde9b75cf1835`.
The rebased client build passes (12.48 s), and lint passes (zero errors,
fourteen existing warnings).

The classified installer module now requires the real #199 readiness check,
then distinguishes the captured PRE_200, exact empty fresh-Prisma and verified
COMPLETE_200 states. Foreign, partial, unmarked populated and forged-receipt
states refuse. Original draft definitions and the actual SQLite ALTER result
are captured independently at SHA256a523b351ff7046f21c448c637600ddbbc159c38487a4cd982163e0ada13ef6af
and4f444bdf15f710a2c0223764b650713ce6b413c3d4469a950bb8bfaa05bf666b.
It uses an immediate transaction, verifies every original field/row/object and
prior receipt, and appends one source-bound installation receipt. Dry-run and
completed apply open read-only. The separate startup checker refuses an
uninstalled or missing database without creating or changing it.

Current focused validation passes five suites / 191 tests, zero skipped
(12.346 s), including all 105 unchanged scanner tests. The earlier classifier
run passed 182 tests and found one unresolved new test SQL source; the test now
uses a separate digest-bound release-source binding for execution, preserving
the scanner's restriction. The subsequent run passed 189 tests and found that
an empty Jest parameter tuple accidentally selected the done-callback form;
the new argument cases now pass arrays as explicit tuple values. All logs are
retained; no existing test timeout or assertion changed.

Separate owned rehearsals exercise PRE_200 and actual emitted FRESH_PRISMA
through COMPLETE_200, startup readiness and repeated NO_OP. Both report zero
new templates, zero import receipts, zero draft links and zero backfills; the
only row change is one installation receipt. Original rows/schema objects and
predecessor receipts are preserved. Dry-run and NO_OP preserve database bytes;
the source owned template and working database remain unchanged. The fresh
case clones only the actual owned catalogue prerequisites (36 Unit, 10
AnalysisCategory and 176 Analysis rows), then invokes the real #199 installer.
Its first setup omitted the category dependency and correctly refused a
foreign-key insert before any #200 installation; that owned file is retained.
The completed proof never disables foreign keys. Both rehearsals have zero
Sample and Result rows; populated analytical preservation remains to be tested.

After rebasing onto merged #201, the branch generates its own 92-model Prisma
client. The scoped template owner and mounted workbench save/list routes now
append instrument mappings and immutable revisions with MANAGE_EQUIPMENT,
expected-version checks and audits. Identifier/analyte/input/unit/dilution/QC
column choices are explicit; mappings contain no conversion or calculation.
Historical fixture completeness accounts for exactly two new models and one
nullable draft field, and the QC fixture invokes the actual additive installer.
No historical literal, factory authority or old assertion changes.

The six-file focused run passes all208 tests, zero skipped (18.860 s), including
actual template transactions, mounted token/permission/scope routes, retained
paste/source/installer tests and all105 scanner tests. Both the source owned
database and working database SHA490b8c remain unchanged. This custom focused
run is separate from the still-pending complete normal suite.

Claude's entry-only QC pin6095469488 requires the same #186 owner, new observations
and pending-state/event/audit writes only. Automatic evaluation, Result flags,
references, corrections and evaluated-analyte entry are refused. The importer
now uses this pin on the existing owner, with a receipt bound to the current
lab/instrument/run/importer. Invalid option combinations refuse atomically.
The normal evaluation loop is skipped only for this internal import call, and
the entry event retains entryMode and importReceiptId. No alternate measurement
authority is introduced.

The eight-file focused run passes all273 tests, zero skipped (76.133 s), including
the entire unchanged native QC file, the new entry-only cases and the earlier
template/paste/source/SQL/scanner files. A real retained Result is byte-equivalent
through the last required imported QC value; the analyte remains QC_PENDING,
zero evaluations/NCRs are created, and the event/audit are present. Later
explicit evaluation produces the normal verdict. Evaluated analytes, existing
observations and invalid combinations refuse with all rows unchanged. Both
owned-source and working database digests remain unchanged. Preview and commit
integration are still unfinished; this is not the full 40-by-four acceptance.

Claude's unit-reader pin6095652486 answers6095612837: extract the typed writer's
read-only unit decision into one shared function without changing its behavior.
Direct/QC units must exactly match the non-null Analysis.units or unitCode (or
percent for actual texture fractions). An empty accepted set refuses with409
IMPORT_UNIT_UNAVAILABLE; synonyms/case changes refuse IMPORT_UNIT_MISMATCH.
Each receipt retains the actual unit fields and which matched. Methodology.qudtUnit
and the dead method.unit fallback are deferred to#283. The shared decision is
implemented; no unit alias or conversion is inferred.

Pure row matching now uses explicit lab-code/original-id/physical-position
selection and only current native positions. It preserves the source id and
all four analyte work-item destinations. QC matching requires both the selected
prefix's kind and the exact mapped physical-position column; overlapping
prefixes, duplicates, unknown labels and historical/duplicate sample positions
refuse rather than choosing a destination. The new pure file passes15/15 tests
(0.274 s), including40-by-four plus six QC destination matching. These are pure
matching tests, not a completed import or database acceptance claim.

The read-only #200 checker now runs before app/adapters/schedulers, the shipped
default entrypoint invokes the actual installer after its predecessors, Docker
retains all four digest-bound assets outside the Prisma mount, and normal test
setup uses the real installer. Retained startup/bootstrap assertions remain,
with an additional missing-import refusal/byte-preservation check and real
COMPLETE_200 readiness before listen. The three-file focused run passes140/140
tests, zero skipped (50.384 s), including the105 scanner tests. Source-owned and
working database hashes stay unchanged. Actual Docker execution is still pending.

Still unfinished: actual Docker execution and populated analytical preservation
proof; preview/commit APIs; XLSX; the mapping/binding
wizard; complete 40 by four plus six native QC import; EXCH_CA/Olsen typed
recording and activation/unit/binding refusal cases; normal full server tests,
final build/lint, CI and Claude's audit. The importer must read input units
from the laboratory's activated template version and recheck activation at
commit. It must preserve the raw inputs for the existing typed writer.
No conversion, dilution arithmetic, final Result writer, QC overwrite,
evaluation, historical backfill or production mutation is introduced here.

Pin6095652486: the typed writer's numericReportingUnit decision is extracted
into resultReportingUnit.js and remains the writer's actual runtime call.
Ordinary fallback/refusal behavior is retained. The additional import mode
requires an exact catalogue units/unitCode match, or percent for actual texture
fractions, with no method/QUDT inference, aliases or conversions. It returns
the analysis code, both original catalogue unit fields and the matched field
for the future immutable receipt. Import-unit preflight/API/receipt integration
and zero-write commit refusal acceptance remain unfinished. Read-decision and
unchanged typed-writer tests pass in the normal validation environment; no full
import pass is claimed.

At d631fd7b, the normal unchanged global setup passes five suites/196 tests,
zero skipped (37.257 s), including the entire original result-write and catalogue
files, receipt-bound QC entry, import-unit decisions and the state-write scanner.
This resolves all four earlier reduced-harness prerequisite failures without
changing their assertions. Their original failed logs remain retained. The
owned validation checkout has its own dependencies/configuration/92-model
Prisma client and a newly emitted metadata/Help-only template, SHA256
6fa171ade891660acad4717b6a53a89b805f77f6397bfeb9d11b39afe2d8858e,
with zero Sample/Result/import receipt rows. That template, the original Help-only
template and the primary working database remain unchanged.

Pin6096085980 now defines exactly one direct or activated-input mapping shape
per analysis. The validator accepts the input-only variable bindings and refuses
mixed, incomplete, unknown-key and duplicate-analysis shapes with400
IMPORT_TEMPLATE_MAPPING_INVALID. Optional explicit sheetName follows XLSX
pin6095961328. Preview/commit binding and atomicity acceptance remain pending.

The mapping/scoped HTTP/matching/unchanged scanner group passes three suites/
141 tests, zero skipped (15.234 s), through normal global setup at a71ccb75.
The protected owned template and working database remain unchanged.

Pin6096218065 confirms400 DRAFT_FIELDS_INVALID for receipt fields in ordinary
draft owner inputs and HTTP bodies, with unknown non-receipt fields still
ignored. Both boundaries now check before any write. The server-only import
option validates the persisted receipt against actor/lab/instrument/run/line,
then uses the existing draft owner and its readiness checks. Existing drafts
of all kinds refuse IMPORT_DRAFT_EXISTS, and current Results keep the existing
RESULT_WORKITEM_SEALED refusal. Input-only QC rows are deferred to#213 and must
refuse the whole import; no new calculated-QC shape is inferred in#200.

The first new draft proof at9b5fd075 passed three existing suites and133 tests
but failed11 new tests in their snapshot setup: WorkAttempt events are stored
in AuditLog, not a separate WorkAttemptEvent model. The new snapshot now uses
the actual AuditLog already included by the owned fixture. Assertions, owner
guards and existing tests are unchanged; the original failed log is retained.

The corrected draft group at32f70e7d passes four suites/144 tests, zero skipped
(25.692 s). At24f4ba31 the normal seven-file group passes seven suites/173 tests,
zero skipped (44.604 s), including actual multipart CSV preview/commit, exact raw
draft/QC/receipt evidence, all-or-nothing multi-row refusals, unmatched rows,
duplicate destinations, post-preview drafts, source/actor/signature changes,
the complete existing draft integrity file and the unchanged scanner. Both
protected database hashes remain unchanged. This is the bounded CSV proof,
not the full40-by-four/XLSX/calculation acceptance or a full-suite claim.

The preview and commit re-use the existing draft owner's read-only scope and
readiness decision. A server-signed preview context binds actor/run/instrument/
template/source hash and exact activations; commit re-reads them in the file's
single transaction. A new receipt is created only with successful draft and
entry-only QC writes. The upload has a16MiB memory resource cap, independent of
laboratory batch/policy settings. CSV/TXT are implemented; XLSX is unfinished.

After #210 merged as e0462c85, the branch is rebased onto that exact main. Both
startup gates, installer assets, fixture completeness checks and prior assertions
are retained. Own Prisma7.10 clients now have94 models. A new schema-emitted,
metadata/Help-only owned validation template has SHA256
6d216ef232db2e7b0772bd1d59cf2425eeefa6f4542a1636e94feb4d027e08fe,
zero Sample/Result/import/amendment bindings and intact foreign keys. The old
6fa template is retained byte-equivalent; working490 is unchanged. The normal
ten-file rebase group passes10 suites/252 tests/0 skipped (88.999s), including
the full startup/bootstrap/installer and CSV/draft/QC/unit/scanner groups.

XLSX archive decoding is being added with16MiB compressed/64MiB total
uncompressed/4096-member resource caps. It reads stored/deflated members in memory
and checks actual sizes, CRCs, local/central headers, descriptors, duplicates,
overlaps and macro/external-link paths. No archive member is extracted to disk.
The existing dev-locked saxes6.0.0 (ISC) is pinned as a proposed production XML
dependency; xmlchars2.2.0 is its locked transitive dependency. Their current
GitHub Advisory Database queries return zero matching advisories; this does
not clear the repository's41 existing npm findings. Saxes upstream is archived.
Per6096456697, explicit YY approval in the concrete#200 PR is still required
before merge. No parser dependency approval, complete XLSX import or full-suite
pass is claimed.

The server-side XLSX XML/cell decoder is now implemented but unvalidated. It
adds resource caps of250,000 XML elements in the whole archive,64 nesting levels
and4,096 merge ranges, in addition to the archive caps above. Saxes rejects
malformed XML and DTDs; all XML and relationship parts are checked, including
unused content. Relative OPC targets resolve only inside the uploaded in-memory
parts; external targets and macro content are refused. Sparse worksheet cells
never allocate a dense grid. Merges retain the top-left value only.

Exact numeric/shared/inline lexemes and cell/style/sheet evidence are carried
into preview and the immutable receipt. Pins6096456697/6096497546 require the
unchanged lab parser to agree with the regex-constrained invariant comparator,
including canonical text; otherwise409 IMPORT_XLSX_NUMBER_POLICY_CONFLICT
refuses the complete import. Text cells keep existing lab parsing. Activated
raw-input columns receive the same check. Selected worksheet, resolved format
and policy version now bind the signed preview and are re-read before commit.
New pure decoder and actual multipart/transaction tests await validation;
complete40-by-four/QC/calculation/UI/full-suite acceptance remains unfinished.

The first XLSX group at ae9407d2 passes197/201 tests, four suites passed and
three failed (50.823s). Both owned templates and the working database retain
their hashes. Two new failures exposed the pin's impossible1.5 acceptance
under comma-decimal/dot-grouping; a new evidence assertion assumed a comma
grouping default instead of the actual null default; and adding an empty
details object broke an existing CSV refusal assertion. The old assertion
is retained and empty details are omitted again. Failed logs are retained.

Claude's superseding6096643904 now allows numeric-cell separator transliteration
with a verified round trip: the regex-constrained OOXML lexeme's single decimal
dot becomes a comma only for a comma-decimal lab, preserving digits/exponent.
No Number round trip or shared parser change. The draft/#199 raw input stores
this verified lab text; the receipt preserves the original lexeme, lab text,
cell/style and policy version. Three-fraction ambiguity with null grouping
still refuses409 with zero writes. Text cells retain their original lab parse.
New tests also exercise the existing typed Result writer after importing each
numeric case. This supersedes the prior numeric raw-storage paragraph only;
whole-source bytes, all original evidence and scientific values stay exact.

Additional actual main-after210 predecessor: e0462c85 (92 models), schema
SHA256 a8e2aa335963e709dfc9047166ca775bae948ddaebaf10cb0e07d5cdeb482b33,
untouched own Prisma7.10 emission79,066 bytes, DDL SHA256
d54b007ef4182ed1a08b340228a52b799308349a5cb632a05f7374cb8d5ebfb6.
Exact emission command and preserved working database hash are checked in with
the provenance. The earlier89-model literal/factory/scanner digest remain
unchanged. A separate no-argument, test-only, exact-caller/digest-bound factory
creates schema only; it grants no analytical-row authority. All prior installer
assertions now run against both predecessors, with added closure/shape probes.
Current-main installer validation and populated preservation are pending.

The revised702e951c XLSX/CSV group passes205/206 tests (44.839s), including
actual typed recording of the verified comma/dot numeric drafts. Its remaining
new fixture put shared-string1.234 under comma/space grouping and expected a
successful import, while the existing lab parser correctly reports
AMBIGUOUS_NUMBER. That fixture now supplies lab-syntax text for its positive
case, and an additional whole-commit zero-write test retains the ambiguous
original string. No shared parser or existing assertion is changed; the failed
log and all three protected database hashes are retained.

At d38fa819 all XLSX/CSV/QC/unit/scanner suites pass. The eight-file group
passes295/296 tests (47.004s); the additional schema shape probe used incorrect
table names. It now names the actual main SampleAmendmentAttempt (7 fields)
and ReportAmendmentWithdrawal (4 fields). All existing installer assertions
passed against both retained89 and current92-model literals. Logs are retained;
no installer/source/oracle or existing assertion is weakened.

The full ICP acceptance is added as an actual owned run/preview/commit test:
40 real samples,160 WorkItems under four independently resolved synthetic
analyte rules, six native QC positions (two blanks/four LRM) bound to a genuine
owned lab-assigned lot through existing reference owners, plus one unknown ID.
It requires160 exact raw drafts/24 pending observations, complete source receipt,
zero Results/evaluations/NCR/attempt additions and unchanged original workflow,
reference values and audit rows. It is pending validation; no production counts.
