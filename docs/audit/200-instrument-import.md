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

The direct/QC unit-reader question is posted at6095612837: the Prisma method
has qudtUnit but no unit scalar, and its frozen revision has no unit. Until
Claude pins the exact reader/precedence, no unit alias or conversion is inferred.

Pure row matching now uses explicit lab-code/original-id/physical-position
selection and only current native positions. It preserves the source id and
all four analyte work-item destinations. QC matching requires both the selected
prefix's kind and the exact mapped physical-position column; overlapping
prefixes, duplicates, unknown labels and historical/duplicate sample positions
refuse rather than choosing a destination. The new pure file passes15/15 tests
(0.274 s), including40-by-four plus six QC destination matching. These are pure
matching tests, not a completed import or database acceptance claim.

Still unfinished: normal startup/Docker wiring and populated analytical
preservation proof; preview/commit APIs; XLSX; the mapping/binding
wizard; complete 40 by four plus six native QC import; EXCH_CA/Olsen typed
recording and activation/unit/binding refusal cases; normal full server tests,
final build/lint, CI and Claude's audit. The importer must read input units
from the laboratory's activated template version and recheck activation at
commit. It must preserve the raw inputs for the existing typed writer.
No conversion, dilution arithmetic, final Result writer, QC overwrite,
evaluation, historical backfill or production mutation is introduced here.
