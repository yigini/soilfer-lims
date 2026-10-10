-- #205: structured preparation evidence for confirmed DRYING and PREPARATION
-- gates. Additive only; rows are append-only and never edited or removed.
CREATE TABLE "PreparationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "gateCode" TEXT NOT NULL,
    "equipmentId" TEXT,
    "method" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "temperatureC" REAL,
    "massBeforeG" REAL,
    "massAfterG" REAL,
    "coarseFractionG" REAL,
    "coarseFractionPct" REAL,
    "sieveMm" REAL,
    "grindMm" REAL,
    "performedBy" TEXT NOT NULL,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PreparationRecord_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PreparationRecord_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PreparationRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PreparationRecord_sampleId_idx" ON "PreparationRecord"("sampleId");
CREATE INDEX "PreparationRecord_workItemId_idx" ON "PreparationRecord"("workItemId");
CREATE UNIQUE INDEX "PreparationRecord_receiptId_gateCode_key" ON "PreparationRecord"("receiptId", "gateCode");

-- Contract guards
CREATE TRIGGER "PreparationRecord_validate_insert" BEFORE INSERT ON "PreparationRecord"
WHEN NEW."gateCode" NOT IN ('DRYING','SIEVING','GRINDING','SPLITTING')
  OR (NEW."gateCode" = 'DRYING' AND (NEW."method" IS NULL OR NEW."method" NOT IN ('AIR','OVEN_40','OVEN_105','OTHER') OR NEW."temperatureC" IS NULL))
  OR (NEW."gateCode" <> 'DRYING' AND (NEW."method" IS NOT NULL OR NEW."temperatureC" IS NOT NULL))
  OR (NEW."gateCode" = 'SIEVING' AND (NEW."sieveMm" IS NULL OR NEW."sieveMm" <= 0 OR NEW."massBeforeG" IS NULL OR NEW."massBeforeG" <= 0
      OR NEW."coarseFractionG" IS NULL OR NEW."coarseFractionG" < 0 OR NEW."coarseFractionG" > NEW."massBeforeG" OR NEW."coarseFractionPct" IS NULL))
  OR (NEW."gateCode" = 'GRINDING' AND (NEW."grindMm" IS NULL OR NEW."grindMm" <= 0))
  OR (NEW."massAfterG" IS NOT NULL AND NEW."massAfterG" <= 0)
  OR length(trim(NEW."performedBy")) = 0
BEGIN
  SELECT RAISE(ABORT, 'PREPARATION_RECORD_INVALID');
END;
CREATE TRIGGER "PreparationRecord_no_update" BEFORE UPDATE ON "PreparationRecord"
BEGIN
  SELECT RAISE(ABORT, 'PREPARATION_RECORD_IMMUTABLE');
END;
CREATE TRIGGER "PreparationRecord_no_delete" BEFORE DELETE ON "PreparationRecord"
BEGIN
  SELECT RAISE(ABORT, 'PREPARATION_RECORD_IMMUTABLE');
END;
