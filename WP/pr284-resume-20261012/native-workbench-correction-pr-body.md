The instrument-import dry-run refuses the actual historical workbench draft table, so #200 cannot complete its release rehearsal. The native workbench DDL contains inline workItemId uniqueness and an updatedAt CURRENT_TIMESTAMP default that the Prisma-only captured variants omitted.

Add only that exact historical pre-200/native-ALTER pair to the hash-bound schema list. Preserve all six existing variants, the migration SQL, original rows and constraints. The regression contract builds the historical DDL plus #205 records in an owned fixture, proves populated dry/apply/repeat preservation, and refuses nearby foreign constraint/default/type/column changes. Refresh the SQL scanner's exact loader digest without changing its write policy.

Validation: 4 focused suites/120 tests pass, including the write scanner and selected reported-value exports. Full local suite and GitHub CI are required before exact-head audit/merge; fresh source review, isolated proof and kit review follow. The failed rehearsal receipt 511c1951 remains FAILED and will never be retried or used by a kit. Production remains healthy at51f67988.

Refs #200, #162. PR284 is merged; this is a separate forward correction.
