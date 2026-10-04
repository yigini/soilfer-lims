"""Read-only by default; optionally rehearse the exact migration on a new backup copy."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3

TABLES = ("Sample", "Result", "Batch", "BatchQcResult", "AuditLog", "Report")


def fingerprint(db):
    result = {}
    for table in TABLES:
        columns = [row[1] for row in db.execute(f'PRAGMA table_info("{table}")') if row[1] != "rawInput"]
        projection = ",".join('"' + column + '"' for column in columns)
        digest = hashlib.sha256()
        count = 0
        for row in db.execute(f'SELECT {projection} FROM "{table}" ORDER BY "id"'):
            digest.update(json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode())
            count += 1
        result[table] = {"count": count, "sha256": digest.hexdigest()}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=Path)
    parser.add_argument("--backup-sha256", required=True)
    parser.add_argument("--apply-to-copy", type=Path)
    args = parser.parse_args()
    backup = args.backup.resolve(strict=True)
    backup_sha = hashlib.sha256(backup.read_bytes()).hexdigest()
    if backup_sha != args.backup_sha256:
        parser.error("Backup fingerprint mismatch")
    sql_path = Path(__file__).resolve().parents[1] / "prisma/migrations/20261004064500_add_result_raw_input/migration.sql"
    sql = sql_path.read_text(encoding="utf-8")
    with sqlite3.connect(backup.as_uri() + "?mode=ro", uri=True) as source:
        before = fingerprint(source)
        if any(row[1] == "rawInput" for row in source.execute('PRAGMA table_info("Result")')):
            parser.error("Backup already has rawInput; use the pre-migration backup")
        if source.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or source.execute("PRAGMA foreign_key_check").fetchall():
            parser.error("Backup integrity check failed")
    output = {"mode": "dry-run", "backupSha256": backup_sha, "migrationSha256": hashlib.sha256(sql_path.read_bytes()).hexdigest(), "protected": before, "backfillRows": 0}
    if args.apply_to_copy:
        requested = args.apply_to_copy
        target = requested.resolve()
        if not requested.is_absolute() or target.parent.name != "audit-rehearsals" or target == backup or target.exists() or requested.is_symlink():
            parser.error("Copy must be a new absolute path directly inside audit-rehearsals")
        target.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation prevents overwriting an existing rehearsal or live database.
        with target.open("xb") as destination, backup.open("rb") as source:
            shutil.copyfileobj(source, destination)
        with sqlite3.connect(target) as copy:
            copy.execute("PRAGMA foreign_keys=ON")
            copy.executescript("BEGIN IMMEDIATE;\n" + sql + "\nCOMMIT;")
            after = fingerprint(copy)
            assert before == after, "Protected rows changed"
            assert copy.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            assert not copy.execute("PRAGMA foreign_key_check").fetchall()
            legacy_null = copy.execute('SELECT COUNT(*) FROM "Result" WHERE "rawInput" IS NULL').fetchone()[0]
            assert legacy_null == before["Result"]["count"]
        assert hashlib.sha256(backup.read_bytes()).hexdigest() == backup_sha
        output.update(mode="applied-to-copy", copy=str(target), legacyRawInputNull=legacy_null, integrity="ok", foreignKeyErrors=0, protectedUnchanged=True)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
