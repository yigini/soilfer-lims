# Sample codes (audit 1.3)

`Sample.id` is the immutable row identity. `Sample.labSampleCode` is the unique issued laboratory sample code. `Sample.labId` remains the compatibility alias for one release; back-fill never changes its bytes. `WorkItem.labId` identifies the laboratory doing the analysis, independently of the sample code.

The `policyService` keys `sample.codeFormat` and `sample.sequenceReset` supply the format and reset behavior. All presets ship `{LAB}-{YY}-{SEQ:6}{CHK}` and `YEARLY`. Supported tokens are LAB, YY, YYYY, SEQ (optional padding up to 32), CHK and PROJECT. PROJECT requires a project at intake; failure returns 409 / SAMPLE_CODE_PROJECT_REQUIRED without a counter or sample write. Omitting CHK is allowed and displays a warning in the policy editor. A changed policy affects future codes only.

The sequence namespace is `(registered Lab.id, SAMPLE, year)`. YEARLY uses the laboratory's local year, with UTC fallback for absent or invalid timezones. NEVER uses sequence year 0; date tokens still show the local issue year. Projects never partition the counter. The counter's `next` is the next value to issue. Insert-if-absent and UPDATE increment/RETURNING run in the same transaction as the sample write. Failed transactions roll back their increments. Historical identifiers reserve their existing values; collisions advance the counter inside that transaction without scanning for a maximum. Field originalIds starting with S do not set the counter.

The check character uses ISO 7064 MOD 37,36 with alphabet `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ`. Uppercase letters and digits enter the checksum; hyphen, underscore, space and period are presentation separators. The initial state is 18, each symbol updates it by `((state || 36) * 2 % 37 + symbolIndex) % 36`, and the appended symbol makes the completed checksum 1. All non-check tokens enter the checksum even when CHK is placed earlier in the format. `verifyCheckCharacter` verifies the conventional final check character. The reference vector `A12425GABC1234002` gives `M`, as documented by the [python-stdnum project](https://arthurdejong.org/python-stdnum/doc/2.2/stdnum.iso7064). This is an error-detection check, not an authenticity signature.

Apply `20261004170000_add_atomic_sample_codes/migration.sql` additively, then run:

```text
node scripts/backfill_sample_codes.js --database <existing SQLite file> --dry-run
node scripts/backfill_sample_codes.js --database <existing SQLite file> --apply
```

Dry-run is the default and opens the file read-only. Apply is one immediate transaction and re-plans inside it. Every nonblank legacy sample labId not exactly matching a registered lab id/code is copied byte-for-byte, except normalized lab-like values, which remain NULL and are listed as AMBIGUOUS_LAB_OR_CODE. Duplicate codes, existing-code conflicts or uniqueness collisions refuse the whole apply. No issued code is invented or renumbered. Reports list category counts and ids for other historical formats.

WorkItem.assignedLab wins when registered (referred analyses can belong to a different lab); otherwise Sample.assignedLab is used. Registered codes resolve to canonical Lab.id. The old WorkItem.labId is retained in the additive legacyLabId field, and the report lists each before/after. Unresolved rows remain unchanged and are listed as WORKITEM_LAB_UNRESOLVED; different valid work-item/sample labs are listed as WORKITEM_SAMPLE_LAB_DIFFER. Re-running the script makes no further changes. Resolution of unresolved ownership is a later audited manager action. Analytical data, QC values and audit rows are never changed by this migration or script.

Label layout, Code128, print/reprint audit and aliquots remain item 5.4. General intake/work-item transaction consolidation remains item 1.2 (#179); this item makes code allocation and the sample write atomic.
