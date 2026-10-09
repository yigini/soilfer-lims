# Audit 4.2 — run barcode scanning (#195)

Scope follows Claude's [6061884497 pin](https://github.com/yigini/soilfer-lims/issues/195#issuecomment-6061884497).
The cited worksheet search remained a substring filter with no scan/Enter workflow on main0b54284.

The worksheet keeps a Scan field alongside the run controls. F2 focuses it;
an unfocused keyboard wedge with inter-key gaps below30ms transfers its prefix
there. Lookup uses the existing authenticated, scoped `/api/samples/lookup`.
Only exact issued `labSampleCode` or `originalId` matches can select a linked
SAMPLE position in the current run. Successful scans scroll to that row, focus
its first available value input and use the existing success cue. Misses,
ambiguities, unavailable rows and out-of-run samples produce a red banner and
the error cue. Responses from a former run are ignored.

Stored issued labels remain authoritative, including historical formats,
non-trailing check characters and labels without checksums. Original IDs skip
checksum interpretation. Only a failed lookup may explain an invalid check
character: the scanning lab's current format comes from `policyService`, and
the existing verifier is used only for a single trailing `{CHK}`. The existing
404 status/body is retained with the additive `SCAN_CHECK_CHARACTER_INVALID`
code. A lab-scoped actor cannot override its lab through `scanLabId`; global
actors may supply the selected run's registered lab for this diagnostic.
Unavailable diagnostic policy preserves plain scoped not-found.

Numeric, texture, single-sample and Native QC value inputs buffer a possible
wedge until its gap ends. More than6 characters followed by Enter before30ms
are discarded before any draft/preview/observation callback, restoring the
previous displayed value. The table checks the same candidate before Enter
navigation. Ordinary slow typing, locale decimal strings, short input and
blur commits remain available. Unmount cancels pending writes.

The positive acceptance literal is `GHA1-26-000123N`; the illustrative `K`
suffix is the pinned negative case unless it exactly matches an original ID.
New messages are translated in all5 client locales. No schema migration,
backfill, label regeneration, analytical/QC/audit-row mutation or new workflow
writer is introduced. A jsdom development dependency supports real DOM tests
of the actual worksheet, scanner and input editors.

Validation in progress: focused real DOM/HTTP and existing worksheet/number
contracts67/67 passed before additional boundary coverage. Client build
14.83s passed; lint0errors/14existing warnings. Full suite and final CI will
be recorded in the PR after completion. Tests run on an owned validation copy,
with a published113-article test-only help baseline and disposable databases.
No production action; the #162 demo freeze remains in force.
