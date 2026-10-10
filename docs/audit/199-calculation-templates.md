# Calculation templates and retained evidence (#199)

The additive installer creates five new calculation tables and sixteen guards,
adds up to eleven inactive reference definitions when their catalogue prerequisites
are present, and records each installed reference independently. It inserts zero
Unit or Analysis rows; `pct_mass` belongs to the units seed. Missing prerequisites
are disclosed as healthy deferrals. It never activates a template, back-fills
analytical data or changes an existing catalogue definition. The same guards protect fresh Prisma tables
and managed databases; no table is rebuilt.

Use an explicit database path. The default command is read-only:

```sh
node scripts/install_calculation_templates.js --db /path/to/lab.db --dry-run
```

Review its classification, source digests, differences and planned insert counts.
An intact prior application schema and the existing catalogue units/analyses are
required. Conflicting units or references, partial schema/guards/receipts, invalid
stored templates, and existing PASS curves with invalid coefficients refuse
before any write. Resolve a refusal by reviewing its retained evidence and the
appropriate issue; never drop guards, rebuild tables, invent coefficients or
overwrite analytical history.

During an authorized release, after the usual backup and prior release steps:

```sh
node scripts/install_calculation_templates.js --db /path/to/lab.db --apply
```

The schema, guards, references and source-bound receipt install in one
transaction. A second apply is a zero-write no-op. Docker runs this after the
prior installers and ships the exact DDL/oracle outside the persistent volume.
Direct startup checks installation through a read-only gate before loading the
application. Report actual insert and back-fill counts in the release receipt.

The readiness scenario `calculation-default-entrypoint-pre199` runs the shipped
default `docker-entrypoint.sh` on its owned PRE_199 database and retains the actual
installer output in `199-default-entrypoint.log`. The installer reports PRE_199
to COMPLETE, eleven inactive references, zero activations and zero analytical
back-fills. The repeat uses a direct installer module call in an owned container,
reports NO_OP with zero changes, and verifies exact database bytes. It is not a
second entrypoint invocation. The scenario prints the dry-run, startup readiness
and repeat receipts together as `calculationEntrypointProof`.

Reference definitions require local SOP review. A lab manager clones a reference
into a lab/method scope, cites the local SOP, supplies fixed reporting precision
when the publication does not prescribe it, and explicitly verifies activation.
Definitions and activation decisions are append-only. Lab policy changes never
activate a reference or select a different calculation variant implicitly.

The Kjeldahl publication lists several reporting units without specifying the
unit for its conditional precision thresholds. The reference retains this
ambiguity as read-only source evidence with `executable: false` and
`thresholdUnit: null`. A local SOP clone must choose fixed reporting decimals;
the library does not execute the conditional rule or infer a threshold conversion.
