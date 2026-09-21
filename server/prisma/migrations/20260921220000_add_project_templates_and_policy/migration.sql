-- AlterTable Project: Add additive templateId, templateVersion, policyConfig, programmeCode, parentProjectId
-- Versioned additive idempotent schema migration for SoilFER Project Templates & Policy
-- Safe for existing databases; does NOT drop or alter existing columns or data

ALTER TABLE "Project" ADD COLUMN "templateId" TEXT DEFAULT 'GENERIC_OPEN_INTAKE';
ALTER TABLE "Project" ADD COLUMN "templateVersion" TEXT DEFAULT '1.0.0';
ALTER TABLE "Project" ADD COLUMN "policyConfig" TEXT;
ALTER TABLE "Project" ADD COLUMN "programmeCode" TEXT;
ALTER TABLE "Project" ADD COLUMN "parentProjectId" TEXT REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Project_parentProjectId_idx" ON "Project"("parentProjectId");
