# Control charts and Westgard rules (#214)

New runs in laboratories using the shipped Strict preset, or any resolved
CONTROL_CHART LRM setting, require the served LRM lots to be bound before start.
The start form offers eligible lots and binds the selected lot in the same
guarded transaction as first start. An unbound position is refused with
`QC_CHART_LOT_REQUIRED`; the message identifies the position. This also applies
to Provisional series. A started chart position retains its lot and reference
value revision. Another lot requires another position or a new run.
FIXED_WINDOW laboratories retain late binding. Runs already started before this
change retain their original criteria and evaluation behaviour.

The series scope is laboratory, analyte, methodology and ReferenceMaterial lot.
Each new start freezes its approved limit set, or its Provisional fixed window,
the scoped `qc.controlChartMinPoints` policy (shipped default 20), the applicable
rule actions and the ordered history used by later immutable evaluations.
Ordering is Batch.startedAt, position sequence index and QcMeasurement ID.
Unavailable ordering data is refused. A different lot, method, approved limit
set or Provisional/chart transition resets the sequence. Correction replaces an
effective observation in future history; original evaluations and proposals
remain retained. Failed QC remains in sequence history but cannot enter the
passing baseline selection.

Baselines use explicit passing, uncensored, effective observations. The user
selects the measurement IDs, records a reason for every excluded eligible point
and supplies a proposal reason. Outliers are flagged for review and never
automatically removed. Mean is arithmetic and SD is sample SD (n−1). Proposal
facts, values, selected/excluded IDs, reasons and policy are immutable. A named
LAB_MANAGER, SUPER_ADMIN or MASTER_USER with APPROVE_CONTROL_LIMITS must differ
from the proposer. Approval creates a new set and retains the superseded set's
original facts and validity dates. It never reclassifies an already-started run.

R-4s considers only replicates in one run in one series and is NOT_APPLICABLE for
a single observation. 2-2s, 4-1s and 10x use consecutive eligible observations
across runs; multiple observations in one run count. Thresholds are strict.
Provisional mode evaluates its frozen fixed window and records multirules as
NOT_EVALUATED_PROVISIONAL. Strict rejects 1-3s, 2-2s and R-4s, warns on 1-2s and
opens review obligations for 4-1s and 10x. Basic/Advisory review arrays are empty.
Stored legacy policies without `review` resolve to an empty array without a
database rewrite. Review obligations are separate from CRM nonconformities,
sample closure and disposition. Each evaluation/rule creates at most one
obligation. A named authorised reviewer appends NO_ACTION or
INVESTIGATE_NEW_LIMITS with a mandatory note; resolution changes no verdict or
release decision.

## Additive installation and readiness

After the preceding installers, use the explicit database path:

```sh
node scripts/install_control_charts.js --db /explicit/database.sqlite --dry-run
node scripts/install_control_charts.js --db /explicit/database.sqlite --apply
```

Only the four additive control-chart/review tables, their guarded indexes and
triggers, and one schema receipt may be installed. The installer proves all old
rows and stored policy bytes unchanged. Repeated application is NO_OP. Partial,
populated unmarked, tampered or incompatible schemas are refused. Startup checks
the receipt and exact objects read-only before listening or enabling jobs.
The normal Docker entrypoint installs in sequence; an installer/default-entrypoint
attempt consumes its authorised release boundary, including DRY/NO_OP/failure.
Production recovery follows the separately audited forward-fix process.

## Prebinding impact at the eventual release-kit audit

Before a fresh gate, the kit must retain an actual read-only count for the
candidate policy/profile and database:

```sh
node scripts/control_chart_prebinding_impact.js --db /explicit/database.sqlite
```

This collector opens SQLite with `readonly: true` and `fileMustExist: true`, does
not load the default Prisma client or set connection pragmas, and captures its
required rows in one read transaction. It resolves actual application policy
and QC-rule precedence through an injected reader. The report lists chart
contexts by lab/analyte/method, created-but-not-started Native runs with unbound
served LRM placements, and separate existing sequence refusals. Generic analyte
contexts and method contexts are distinct. It writes only JSON to stdout. An
unavailable or inconsistent context fails the collection; no inferred count is
substituted. Claudio reviews the actual retained report so YY can see who is
affected before a single-use gate. No production collection or new release is
authorised merely by the existence of this script.

The issue remains open until actual deployment and Claudio's post-deploy check.
