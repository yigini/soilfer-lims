# Calculation templates and retained evidence (#199)

The additive installer creates five new calculation tables and sixteen guards,
adds the `pct_mass` unit only when absent, and adds eleven inactive reference
definitions. It never activates a template, back-fills analytical data or changes
an existing catalogue definition. The same guards protect fresh Prisma tables
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

The schema, guards, unit, references and source-bound receipt install in one
transaction. A second apply is a zero-write no-op. Docker runs this after the
prior installers and ships the exact DDL/oracle outside the persistent volume.
Direct startup checks installation through a read-only gate before loading the
application. Report actual insert and back-fill counts in the release receipt.

Reference definitions require local SOP review. A lab manager clones a reference
into a lab/method scope, cites the local SOP, supplies fixed reporting precision
when the publication does not prescribe it, and explicitly verifies activation.
Definitions and activation decisions are append-only. Lab policy changes never
activate a reference or select a different calculation variant implicitly.
