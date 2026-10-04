CREATE TABLE IF NOT EXISTS "IntakeTemplate" (
  "id" TEXT PRIMARY KEY NOT NULL, "labId" TEXT REFERENCES "Lab"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL, "matrix" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "IntakeTemplateRevision" (
  "id" TEXT PRIMARY KEY NOT NULL, "templateId" TEXT NOT NULL REFERENCES "IntakeTemplate"("id") ON DELETE RESTRICT,
  "version" INTEGER NOT NULL, "schemaVersion" TEXT NOT NULL, "schemaJson" TEXT NOT NULL, "schemaHash" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT', "editVersion" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedBy" TEXT, "publishedAt" DATETIME, "retiredBy" TEXT, "retiredAt" DATETIME, "reason" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "IntakeTemplateRevision_templateId_version_key" ON "IntakeTemplateRevision"("templateId", "version");
CREATE TABLE IF NOT EXISTS "IntakeTemplateBinding" (
  "id" TEXT PRIMARY KEY NOT NULL, "selectorKey" TEXT NOT NULL UNIQUE,
  "labId" TEXT NOT NULL REFERENCES "Lab"("id") ON DELETE RESTRICT,
  "projectId" TEXT REFERENCES "Project"("id") ON DELETE RESTRICT,
  "matrix" TEXT NOT NULL, "origin" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL REFERENCES "IntakeTemplateRevision"("id") ON DELETE RESTRICT,
  "editVersion" INTEGER NOT NULL DEFAULT 1, "updatedBy" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "IntakeTemplateBinding_labId_projectId_matrix_origin_idx" ON "IntakeTemplateBinding"("labId", "projectId", "matrix", "origin");
CREATE TRIGGER IF NOT EXISTS intake_revision_immutable
BEFORE UPDATE OF "schemaJson", "schemaHash", "schemaVersion", "templateId", "version" ON "IntakeTemplateRevision"
WHEN OLD."state" <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Published intake schema is immutable'); END;
CREATE TRIGGER IF NOT EXISTS intake_revision_preserve
BEFORE DELETE ON "IntakeTemplateRevision"
WHEN OLD."state" <> 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Published intake history cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS intake_revision_no_downgrade
BEFORE UPDATE OF "state" ON "IntakeTemplateRevision"
WHEN OLD."state" <> 'DRAFT' AND NEW."state" = 'DRAFT'
BEGIN SELECT RAISE(ABORT, 'Published intake revision cannot become an editable draft'); END;
