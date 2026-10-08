ALTER TABLE "BatchDisposition" ADD COLUMN "scope" TEXT;

CREATE TRIGGER "BatchDisposition_scope_json_insert_guard"
BEFORE INSERT ON "BatchDisposition"
WHEN NEW."scope" IS NOT NULL AND (NOT json_valid(NEW."scope") OR json_type(NEW."scope") <> 'object')
BEGIN
  SELECT RAISE(ABORT, 'BATCH_DISPOSITION_SCOPE_INVALID');
END;

CREATE TRIGGER "BatchDisposition_scope_write_once_guard"
BEFORE UPDATE OF "scope" ON "BatchDisposition"
WHEN NEW."scope" IS NOT OLD."scope"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_DISPOSITION_SCOPE_IMMUTABLE');
END;
