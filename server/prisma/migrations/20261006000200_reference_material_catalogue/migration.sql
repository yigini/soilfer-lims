-- #184: additive catalogue; no existing batch, QC or analytical row is rewritten.
CREATE TABLE "ReferenceMaterial" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "labId" TEXT NOT NULL REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "matrix" TEXT NOT NULL,
  "supplier" TEXT,
  "certificateRef" TEXT,
  "inventoryLotId" TEXT REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "lotNumber" TEXT NOT NULL,
  "expiryDate" DATETIME,
  "openedAt" DATETIME,
  "status" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ReferenceValue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "referenceMaterialId" TEXT NOT NULL REFERENCES "ReferenceMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "analysisCode" TEXT NOT NULL REFERENCES "Analysis"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  "methodologyId" TEXT REFERENCES "Methodology"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "assignedValue" REAL NOT NULL,
  "unit" TEXT NOT NULL REFERENCES "Unit"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  "expandedUncertainty" REAL,
  "coverageFactor" REAL,
  "valueType" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededById" TEXT,
  "supersededAt" DATETIME,
  "supersededBy" TEXT,
  "correctionReason" TEXT
);
ALTER TABLE "BatchQcResult" ADD COLUMN "referenceMaterialId" TEXT REFERENCES "ReferenceMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchQcResult" ADD COLUMN "referenceValueId" TEXT REFERENCES "ReferenceValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ReferenceMaterial_labId_code_idx" ON "ReferenceMaterial"("labId","code");
CREATE INDEX "ReferenceValue_referenceMaterialId_analysisCode_idx" ON "ReferenceValue"("referenceMaterialId","analysisCode");
CREATE UNIQUE INDEX "ReferenceValue_current_generic" ON "ReferenceValue"("referenceMaterialId","analysisCode")
  WHERE "supersededById" IS NULL AND "methodologyId" IS NULL;
CREATE UNIQUE INDEX "ReferenceValue_current_method" ON "ReferenceValue"("referenceMaterialId","analysisCode","methodologyId")
  WHERE "supersededById" IS NULL AND "methodologyId" IS NOT NULL;

-- Fresh Prisma schemas receive the same partial indexes and guards.
CREATE TRIGGER "ReferenceMaterial_insert_guard" BEFORE INSERT ON "ReferenceMaterial"
WHEN NEW."kind" NOT IN ('CRM','LRM','CHECK_STANDARD','CALIBRATION_STANDARD','BLANK_MATRIX')
  OR NEW."status" NOT IN ('ACTIVE','QUARANTINED','EXPIRED','RETIRED')
  OR COALESCE(length(trim(NEW."code")),0)=0 OR COALESCE(length(trim(NEW."name")),0)=0
  OR COALESCE(length(trim(NEW."matrix")),0)=0 OR COALESCE(length(trim(NEW."lotNumber")),0)=0
  OR COALESCE(length(trim(NEW."createdBy")),0)=0
  OR (NEW."inventoryLotId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "InventoryLot" lot JOIN "Lab" lab ON lab.id=NEW."labId"
    WHERE lot.id=NEW."inventoryLotId" AND lot.labId IN (lab.id,lab.code)))
BEGIN
  SELECT RAISE(ABORT, 'INVALID_REFERENCE_MATERIAL');
END;
CREATE TRIGGER "ReferenceMaterial_update_guard" BEFORE UPDATE ON "ReferenceMaterial"
WHEN NEW."id" IS NOT OLD."id" OR NEW."labId" IS NOT OLD."labId"
  OR NEW."code" IS NOT OLD."code" OR NEW."name" IS NOT OLD."name"
  OR NEW."kind" IS NOT OLD."kind" OR NEW."matrix" IS NOT OLD."matrix"
  OR NEW."supplier" IS NOT OLD."supplier" OR NEW."certificateRef" IS NOT OLD."certificateRef"
  OR NEW."inventoryLotId" IS NOT OLD."inventoryLotId" OR NEW."lotNumber" IS NOT OLD."lotNumber"
  OR NEW."expiryDate" IS NOT OLD."expiryDate" OR NEW."openedAt" IS NOT OLD."openedAt"
  OR NEW."createdBy" IS NOT OLD."createdBy" OR NEW."createdAt" IS NOT OLD."createdAt"
  OR NEW."status" NOT IN ('ACTIVE','QUARANTINED','EXPIRED','RETIRED')
BEGIN
  SELECT RAISE(ABORT, 'REFERENCE_MATERIAL_IMMUTABLE');
END;
CREATE TRIGGER "ReferenceValue_insert_guard" BEFORE INSERT ON "ReferenceValue"
WHEN NEW."valueType" NOT IN ('CERTIFIED','INDICATIVE','CONSENSUS','LAB_ASSIGNED')
  OR COALESCE(length(trim(NEW."createdBy")),0)=0
  OR (NEW."expandedUncertainty" IS NOT NULL AND (NEW."expandedUncertainty" < 0 OR NEW."coverageFactor" IS NULL))
  OR (NEW."coverageFactor" IS NOT NULL AND NEW."coverageFactor" <= 0)
  OR NEW."supersededById" IS NOT NULL OR NEW."supersededAt" IS NOT NULL
  OR NEW."supersededBy" IS NOT NULL OR NEW."correctionReason" IS NOT NULL
  OR (NEW."methodologyId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Methodology" m WHERE m.id=NEW."methodologyId" AND m.analysisCode=NEW."analysisCode"))
BEGIN
  SELECT RAISE(ABORT, 'INVALID_REFERENCE_VALUE');
END;
CREATE TRIGGER "ReferenceValue_immutable_guard" BEFORE UPDATE ON "ReferenceValue"
WHEN NEW."id" IS NOT OLD."id" OR NEW."referenceMaterialId" IS NOT OLD."referenceMaterialId"
  OR NEW."analysisCode" IS NOT OLD."analysisCode" OR NEW."methodologyId" IS NOT OLD."methodologyId"
  OR NEW."assignedValue" IS NOT OLD."assignedValue" OR NEW."unit" IS NOT OLD."unit"
  OR NEW."expandedUncertainty" IS NOT OLD."expandedUncertainty" OR NEW."coverageFactor" IS NOT OLD."coverageFactor"
  OR NEW."valueType" IS NOT OLD."valueType" OR NEW."createdBy" IS NOT OLD."createdBy" OR NEW."createdAt" IS NOT OLD."createdAt"
  OR (OLD."supersededById" IS NOT NULL AND (NEW."supersededById" IS NOT OLD."supersededById"
    OR NEW."supersededAt" IS NOT OLD."supersededAt" OR NEW."supersededBy" IS NOT OLD."supersededBy" OR NEW."correctionReason" IS NOT OLD."correctionReason"))
  OR (NEW."supersededById" IS NULL AND (NEW."supersededAt" IS NOT NULL OR NEW."supersededBy" IS NOT NULL OR NEW."correctionReason" IS NOT NULL))
  OR (NEW."supersededById" IS NOT NULL AND (NEW."supersededById"=NEW."id" OR NEW."supersededAt" IS NULL
    OR COALESCE(length(trim(NEW."supersededBy")),0)=0 OR COALESCE(length(trim(NEW."correctionReason")),0)=0))
BEGIN
  SELECT RAISE(ABORT, 'REFERENCE_VALUE_IMMUTABLE');
END;
CREATE TRIGGER "ReferenceValue_delete_guard" BEFORE DELETE ON "ReferenceValue"
WHEN EXISTS (SELECT 1 FROM "BatchQcResult" q WHERE q.referenceValueId=OLD.id)
  OR EXISTS (SELECT 1 FROM "ReferenceValue" v WHERE v.supersededById=OLD.id)
  OR EXISTS (SELECT 1 FROM "AuditLog" a, json_tree(CASE WHEN json_valid(a.details) THEN a.details ELSE '{}' END) j
    WHERE a.entity='BATCH' AND a.action='QC_EVIDENCE_SNAPSHOT' AND j.key='referenceValueId' AND j.value=OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'REFERENCE_VALUE_REFERENCED');
END;
CREATE TRIGGER "BatchQcResult_reference_insert_guard" BEFORE INSERT ON "BatchQcResult"
WHEN (NEW."referenceMaterialId" IS NULL) != (NEW."referenceValueId" IS NULL)
  OR (NEW."referenceMaterialId" IS NOT NULL AND (NEW."type" <> 'CONTROL' OR NOT EXISTS (
    SELECT 1 FROM "ReferenceValue" v JOIN "ReferenceMaterial" r ON r.id=v.referenceMaterialId
    JOIN "Batch" b ON b.id=NEW.batchId JOIN "Lab" lab ON lab.id=r.labId
    WHERE v.id=NEW.referenceValueId AND r.id=NEW.referenceMaterialId AND v.analysisCode=b.analysis AND b.labId IN (lab.id,lab.code))))
BEGIN
  SELECT RAISE(ABORT, 'INVALID_QC_REFERENCE_LINK');
END;
CREATE TRIGGER "BatchQcResult_reference_update_guard" BEFORE UPDATE ON "BatchQcResult"
WHEN (NEW."referenceMaterialId" IS NULL) != (NEW."referenceValueId" IS NULL)
  OR (NEW."referenceMaterialId" IS NOT NULL AND (NEW."type" <> 'CONTROL' OR NOT EXISTS (
    SELECT 1 FROM "ReferenceValue" v JOIN "ReferenceMaterial" r ON r.id=v.referenceMaterialId
    JOIN "Batch" b ON b.id=NEW.batchId JOIN "Lab" lab ON lab.id=r.labId
    WHERE v.id=NEW.referenceValueId AND r.id=NEW.referenceMaterialId AND v.analysisCode=b.analysis AND b.labId IN (lab.id,lab.code))))
BEGIN
  SELECT RAISE(ABORT, 'INVALID_QC_REFERENCE_LINK');
END;
