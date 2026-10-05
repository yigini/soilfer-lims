ALTER TABLE "Result" ADD COLUMN "attemptId" TEXT;
CREATE INDEX "Result_attemptId_idx" ON "Result"("attemptId");

CREATE TRIGGER "Result_attempt_insert_guard"
BEFORE INSERT ON "Result"
WHEN NEW."attemptId" IS NOT NULL
BEGIN
    SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM "WorkAttempt" WHERE "id" = NEW."attemptId")
            THEN RAISE(ABORT, 'RESULT_ATTEMPT_NOT_FOUND')
        WHEN NOT EXISTS (SELECT 1 FROM "WorkAttempt" a JOIN "WorkItem" w ON w."id" = a."workItemId"
            WHERE a."id" = NEW."attemptId" AND w."sampleId" = NEW."sampleId")
            THEN RAISE(ABORT, 'RESULT_ATTEMPT_SAMPLE_MISMATCH')
    END;
END;

CREATE TRIGGER "Result_attempt_update_guard"
BEFORE UPDATE OF "attemptId" ON "Result"
WHEN NEW."attemptId" IS NOT NULL
BEGIN
    SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM "WorkAttempt" WHERE "id" = NEW."attemptId")
            THEN RAISE(ABORT, 'RESULT_ATTEMPT_NOT_FOUND')
        WHEN NOT EXISTS (SELECT 1 FROM "WorkAttempt" a JOIN "WorkItem" w ON w."id" = a."workItemId"
            WHERE a."id" = NEW."attemptId" AND w."sampleId" = NEW."sampleId")
            THEN RAISE(ABORT, 'RESULT_ATTEMPT_SAMPLE_MISMATCH')
    END;
END;

CREATE TRIGGER "WorkAttempt_result_reference_guard"
BEFORE DELETE ON "WorkAttempt"
WHEN EXISTS (SELECT 1 FROM "Result" WHERE "attemptId" = OLD."id")
BEGIN
    SELECT RAISE(ABORT, 'RESULT_ATTEMPT_REFERENCED');
END;
