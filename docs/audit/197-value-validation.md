# Audit4.4 — value feedback and override requests (#197), WIP

Branch `audit/4.4-value-validation` begins at mainad2244c9 after194 merged.
The cited missing `isInvalid` input and censor-limit/LOQ comparison remain.
[Scope pin6080149352](https://github.com/yigini/soilfer-lims/issues/197#issuecomment-6080149352)
defines the additive single-use approval table, immutable SQL state/context,
shared browser/server classification, nullable lab/method limits and a dilution
prompt only after an existing recorded source is eligible for191's command.

Initial WIP adds shared parsing/classification and the three nullable policy
keys. No default range is invented. Below-LOQ censor limits cannot be overridden;
numeric below-LOQ readings stay amber. Existing numeric-validation callers use
the actual shared classifier. The authorized queue now returns actual per-row
hard/policy/method rules; both numeric editors classify drafts immediately and
show translated ranges/LOQ/unit with the method LOQ quick key. The quick key
waits for BarcodeSafeInput's accepted change rather than bypassing wedge refusal.
Owned proof at1238f019: five suites/51 tests PASS, zero skips,10.546s.

[Cancellation pin6081599894](https://github.com/yigini/soilfer-lims/issues/197#issuecomment-6081599894)
adds explicit nullable cancelledBy/cancelledAt/cancelReason. Pending cancellation
keeps decision fields NULL; approved cancellation/consumption preserve original
approval byte for byte. The additive table, immutable SQL edges/context, active
cell partial uniqueness and dry-default preservation installer are implemented.
The unchanged historical DDL completeness check declares only this exact new
table as absent; its equality assertion and all prior gaps remain unchanged.
At pre-rebase6c0bc04a, actual HTTP/SQL/installer/UI/context/classification and
barcode contracts passed7 suites/85 tests,zero skips,31.621s. Rebased onto
merged #196 at6093198e while preserving decimal acknowledgement, Escape and
keyboard navigation. Fixed the new editor's LanguageContext import to the
actual existing context path.

Scoped technician requests/cancellation and manager approval/rejection use the
new table. Existing Result transactions consume exactly matching approvals
once, audit request/approver/Result ids and expose approval in current/history
read views. The desktop/touch actions select only a server request id; the
existing completion preview carries it through confirmation and commit. No
draft JSON acts as an approval. Below-LOQ censoring remains non-overridable.
The manager queue has a reason and refuses self approval.

Dilution eligibility is a read-only projection through #191's actual preflight,
only for a retained ABOVE_RANGE reading. Unrecorded drafts say to record first;
the prompt calls the existing repeat command without an automatic record or
repeat chain. Docker preserves exact DDL outside the Prisma volume, startup
installs then gates read-only, and owned setup/rehearsal uses the real installer.
The scanner inspects both new byte-bound sources; no writer exemption.
Integrated proof at187c8ba8:11 suites/135 tests PASS,zero skips,33.626s,
including actual HTTP completion preview/commit, history approver, unchanged
repeat preflight/command, both approval roles, all prior barcode and keyboard
assertions and security wiring. Existing success responses omit an empty
errors field; the new completion test checks normalized absence of errors.
Owned QC fixtures install the actual additive approval prerequisite by default;
only this issue's pre-install tests explicitly use the predecessor schema.
No prior assertion, SQL guard or Result writer is bypassed. Full validation
remains in progress.
No production migration/backfill count or full-suite pass is claimed.
199's future run-curve calibration maximum is deferred and will take precedence.
Production freeze remains; #195's #196-merge prerequisite is now met.
No production-host action.

Full validation at ba0b3171 exposed two integration gaps before completing:
the existing complete-startup fixture needed the actual #197 installer, and
the new SQL tests directly seeded protected Sample/WorkItem/Result rows and
used an unsupported inline migration-loader expression. The startup fixture
now installs the new prerequisite and additionally checks its read-only gate
before listening, with every prior assertion retained. New SQL tests use
qcGateFixture and the actual request and Result writers, retaining all SQL
refusal/history assertions and adding terminal-insert refusal. The fresh-DDL
test binds the exact migration source to a const for scanner inspection; no
scanner exemption or existing test weakening was added. Fresh validation follows.
