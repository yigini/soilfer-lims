-- #189 part 2: additive, insert-only equipment evidence. No historical backfill.
ALTER TABLE "Result" ADD COLUMN "equipmentReadiness" TEXT;

CREATE TRIGGER "Result_equipmentReadiness_insert" BEFORE INSERT ON "Result"
WHEN NEW."equipmentReadiness" IS NOT NULL AND CASE
    WHEN json_valid(NEW."equipmentReadiness") = 0 THEN 1
    ELSE json_type(NEW."equipmentReadiness") IS NOT 'object'
END
BEGIN
    SELECT RAISE(ABORT, 'RESULT_EQUIPMENT_READINESS_INVALID');
END;

CREATE TRIGGER "Result_equipmentReadiness_update" BEFORE UPDATE OF "equipmentReadiness" ON "Result"
WHEN NEW."equipmentReadiness" IS NOT OLD."equipmentReadiness"
BEGIN
    SELECT RAISE(ABORT, 'RESULT_EQUIPMENT_READINESS_IMMUTABLE');
END;
