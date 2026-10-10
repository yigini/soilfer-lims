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

Still unfinished: classified dry-run/apply/startup installer and populated
preservation proof; template/preview/commit APIs; XLSX; the mapping/binding
wizard; complete 40 by four plus six native QC import; EXCH_CA/Olsen typed
recording and activation/unit/binding refusal cases; normal full server tests,
final build/lint, CI and Claude's audit. The importer must read input units
from the laboratory's activated template version and recheck activation at
commit. It must preserve the raw inputs for the existing typed writer.
No conversion, dilution arithmetic, final Result writer, QC overwrite,
evaluation, historical backfill or production mutation is introduced here.
