-- #197 pins6080149352/6081599894: context-bound, single-use approvals.
CREATE TABLE "ResultOverrideRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "labId" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "sampleId" TEXT NOT NULL,
  "analysisCode" TEXT NOT NULL,
  "replicateNo" INTEGER NOT NULL,
  "rawValue" TEXT NOT NULL,
  "unit" TEXT,
  "basis" TEXT NOT NULL,
  "methodologyId" TEXT,
  "methodRevision" TEXT,
  "instrumentId" TEXT,
  "rulesSha256" TEXT NOT NULL,
  "flags" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "decidedBy" TEXT,
  "decidedAt" DATETIME,
  "decisionReason" TEXT,
  "cancelledBy" TEXT,
  "cancelledAt" DATETIME,
  "cancelReason" TEXT,
  "consumedResultId" TEXT,
  "consumedAt" DATETIME,
  FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("analysisCode") REFERENCES "Analysis"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("methodologyId") REFERENCES "Methodology"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("instrumentId") REFERENCES "EquipmentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("cancelledBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("consumedResultId") REFERENCES "Result"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ResultOverrideRequest_consumedResultId_key" ON "ResultOverrideRequest"("consumedResultId");
CREATE INDEX "ResultOverrideRequest_labId_status_requestedAt_idx" ON "ResultOverrideRequest"("labId","status","requestedAt");
CREATE INDEX "ResultOverrideRequest_workItemId_replicateNo_idx" ON "ResultOverrideRequest"("workItemId","replicateNo");

-- Contract guards (also installed on an empty fresh Prisma table).
CREATE UNIQUE INDEX "ResultOverrideRequest_one_active_cell" ON "ResultOverrideRequest"("workItemId","replicateNo")
WHERE "status" IN ('REQUESTED','APPROVED');
CREATE TRIGGER "ResultOverrideRequest_insert_guard"
BEFORE INSERT ON "ResultOverrideRequest"
BEGIN
  SELECT CASE WHEN NEW."status" <> 'REQUESTED' OR NEW."replicateNo" < 1 OR typeof(NEW."replicateNo")<>'integer' OR
    length(trim(NEW."reason"))=0 OR length(NEW."rulesSha256")<>64 OR NEW."rulesSha256" GLOB '*[^0-9a-f]*' OR
    NEW."decidedBy" IS NOT NULL OR NEW."decidedAt" IS NOT NULL OR NEW."decisionReason" IS NOT NULL OR
    NEW."cancelledBy" IS NOT NULL OR NEW."cancelledAt" IS NOT NULL OR NEW."cancelReason" IS NOT NULL OR
    NEW."consumedResultId" IS NOT NULL OR NEW."consumedAt" IS NOT NULL
    THEN RAISE(ABORT,'OVERRIDE_REQUEST_SHAPE_INVALID') END;
  SELECT CASE WHEN json_valid(NEW."flags")=0 THEN RAISE(ABORT,'OVERRIDE_FLAGS_INVALID') END;
  SELECT CASE WHEN json_type(NEW."flags")<>'array' OR
    NOT EXISTS(SELECT 1 FROM json_each(NEW."flags") WHERE value IN ('BELOW_MIN','ABOVE_MAX')) OR
    EXISTS(SELECT 1 FROM json_each(NEW."flags") WHERE type<>'text' OR value IN ('INVALID_FORMAT','CENSOR_LIMIT_BELOW_LOQ','VALUE_REQUIRED'))
    THEN RAISE(ABORT,'OVERRIDE_VALUE_INELIGIBLE') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "WorkItem" w JOIN "Sample" s ON s.id=w.sampleId JOIN "Lab" l ON l.id=NEW."labId"
    WHERE w.id=NEW."workItemId" AND w.sampleId=NEW."sampleId" AND w.analysis=NEW."analysisCode"
    AND COALESCE(s.assignedLab,w.assignedLab,s.labId) IN(l.id,l.code))
    THEN RAISE(ABORT,'OVERRIDE_CONTEXT_CHANGED') END;
END;
CREATE TRIGGER "ResultOverrideRequest_update_guard"
BEFORE UPDATE ON "ResultOverrideRequest"
BEGIN
  SELECT CASE WHEN NEW."id" IS NOT OLD."id" OR NEW."labId" IS NOT OLD."labId" OR
    NEW."workItemId" IS NOT OLD."workItemId" OR NEW."sampleId" IS NOT OLD."sampleId" OR
    NEW."analysisCode" IS NOT OLD."analysisCode" OR NEW."replicateNo" IS NOT OLD."replicateNo" OR
    NEW."rawValue" IS NOT OLD."rawValue" OR NEW."unit" IS NOT OLD."unit" OR NEW."basis" IS NOT OLD."basis" OR
    NEW."methodologyId" IS NOT OLD."methodologyId" OR NEW."methodRevision" IS NOT OLD."methodRevision" OR
    NEW."instrumentId" IS NOT OLD."instrumentId" OR NEW."rulesSha256" IS NOT OLD."rulesSha256" OR
    NEW."flags" IS NOT OLD."flags" OR NEW."reason" IS NOT OLD."reason" OR NEW."requestedBy" IS NOT OLD."requestedBy" OR
    NEW."requestedAt" IS NOT OLD."requestedAt"
    THEN RAISE(ABORT,'OVERRIDE_CONTEXT_IMMUTABLE') END;
  SELECT CASE WHEN NOT (OLD."status"='REQUESTED' AND NEW."status" IN ('APPROVED','REJECTED','CANCELLED') OR
    OLD."status"='APPROVED' AND NEW."status" IN ('CONSUMED','CANCELLED'))
    THEN RAISE(ABORT,'OVERRIDE_STATE_REFUSED') END;
  SELECT CASE WHEN OLD."status"='APPROVED' AND
    (NEW."decidedBy" IS NOT OLD."decidedBy" OR NEW."decidedAt" IS NOT OLD."decidedAt" OR NEW."decisionReason" IS NOT OLD."decisionReason")
    THEN RAISE(ABORT,'OVERRIDE_DECISION_IMMUTABLE') END;
  SELECT CASE WHEN OLD."status"='REQUESTED' AND NEW."status" IN ('APPROVED','REJECTED') AND
    (NEW."decidedBy" IS NULL OR NEW."decidedAt" IS NULL OR NEW."decisionReason" IS NULL OR
    length(trim(NEW."decisionReason"))=0 OR NEW."decidedBy"=NEW."requestedBy")
    THEN RAISE(ABORT,'OVERRIDE_DECISION_REQUIRED') END;
  SELECT CASE WHEN OLD."status"='REQUESTED' AND NEW."status"='CANCELLED' AND
    (NEW."decidedBy" IS NOT NULL OR NEW."decidedAt" IS NOT NULL OR NEW."decisionReason" IS NOT NULL)
    THEN RAISE(ABORT,'OVERRIDE_DECISION_IMMUTABLE') END;
  SELECT CASE WHEN NEW."status"='CANCELLED' AND
    (NEW."cancelledBy" IS NULL OR NEW."cancelledAt" IS NULL OR NEW."cancelReason" IS NULL OR length(trim(NEW."cancelReason"))=0)
    THEN RAISE(ABORT,'OVERRIDE_CANCEL_REASON_REQUIRED') END;
  SELECT CASE WHEN NEW."status"<>'CANCELLED' AND
    (NEW."cancelledBy" IS NOT NULL OR NEW."cancelledAt" IS NOT NULL OR NEW."cancelReason" IS NOT NULL)
    THEN RAISE(ABORT,'OVERRIDE_CANCEL_FIELDS_REFUSED') END;
  SELECT CASE WHEN NEW."status"='CONSUMED' AND (NEW."consumedResultId" IS NULL OR NEW."consumedAt" IS NULL)
    THEN RAISE(ABORT,'OVERRIDE_CONSUMPTION_REQUIRED') END;
  SELECT CASE WHEN NEW."status"<>'CONSUMED' AND (NEW."consumedResultId" IS NOT NULL OR NEW."consumedAt" IS NOT NULL)
    THEN RAISE(ABORT,'OVERRIDE_CONSUMPTION_REFUSED') END;
  SELECT CASE WHEN NEW."status"='CONSUMED' AND NOT EXISTS(SELECT 1 FROM "Result" r
    WHERE r.id=NEW."consumedResultId" AND r.sampleId=NEW."sampleId" AND r.param=NEW."analysisCode"
    AND r.replicateNo=NEW."replicateNo" AND r.rawInput=NEW."rawValue" AND r.unit IS NEW."unit" AND r.basis IS NEW."basis"
    AND r.methodologyId IS NEW."methodologyId" AND r.equipmentId IS NEW."instrumentId"
    AND json_valid(r.flags)=1 AND EXISTS(SELECT 1 FROM json_each(r.flags) WHERE value='OVERRIDE_APPROVED'))
    THEN RAISE(ABORT,'OVERRIDE_CONTEXT_CHANGED') END;
END;
CREATE TRIGGER "ResultOverrideRequest_delete_refused"
BEFORE DELETE ON "ResultOverrideRequest"
BEGIN
  SELECT RAISE(ABORT,'OVERRIDE_REQUEST_IMMUTABLE');
END;
