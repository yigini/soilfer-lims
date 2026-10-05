/** #179 pin 5990137651: no flag or environment can revive this unreviewed writer. */
process.exit(console.error('SCRIPT_RETIRED_UNREVIEWED_STATUS_MIGRATION\nUse scripts/migrate_legacy_statuses.js --db <owned-copy> --dry-run for inventory, followed by the reviewed status-migration plan workflow before applying any status migration.') || 1);
