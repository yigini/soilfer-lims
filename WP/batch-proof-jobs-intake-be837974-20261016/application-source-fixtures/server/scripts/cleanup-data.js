/** #179 pin 5990137651: preserve the entry point, refuse before opening a database. */
process.exit(console.error('SCRIPT_RETIRED_DESTRUCTIVE_CLEANUP\nUse scripts/migrate_legacy_statuses.js --db <owned-copy> --dry-run for inventory, followed by the reviewed status-migration plan workflow. Destructive cleanup is deferred to audit 8.1.') || 1);
