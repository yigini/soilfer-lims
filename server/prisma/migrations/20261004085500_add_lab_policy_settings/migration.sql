CREATE TABLE "LabPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "labId" TEXT NOT NULL,
  "presetCode" TEXT CHECK ("presetCode" IS NULL OR "presetCode" IN ('ISO17025_STRICT','BASIC','ADVISORY')),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" >= 1),
  "updatedBy" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LabPolicy_labId_key" ON "LabPolicy"("labId");
CREATE TABLE "LabPolicyOverride" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "labId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "analysisCode" TEXT,
  "methodologyId" TEXT,
  "value" TEXT NOT NULL CHECK (json_valid("value")),
  "reason" TEXT NOT NULL CHECK (length(trim("reason")) > 0),
  "setBy" TEXT NOT NULL,
  "setAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME,
  "revokedBy" TEXT,
  FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "LabPolicyOverride_labId_key_idx" ON "LabPolicyOverride"("labId","key");
CREATE UNIQUE INDEX "LabPolicyOverride_one_current_scope" ON "LabPolicyOverride"(
  "labId","key",COALESCE("analysisCode",''),COALESCE("methodologyId",'')
) WHERE "revokedAt" IS NULL;
ALTER TABLE "Report" ADD COLUMN "policyVersion" INTEGER;
