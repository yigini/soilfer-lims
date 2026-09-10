const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, '../prisma/dev.db');
const db = new Database(dbPath);

console.log(`[MIGRATE_HELP] Applying additive tables to ${dbPath}...`);

db.exec(`
CREATE TABLE IF NOT EXISTS "HelpArticle" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "category" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "feature" TEXT NOT NULL DEFAULT 'core',
  "roles" TEXT NOT NULL,
  "keywords" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL DEFAULT 2,
  "reviewOwner" TEXT NOT NULL DEFAULT 'Lab operations lead',
  "visibility" TEXT NOT NULL DEFAULT 'AUTHENTICATED',
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "HelpArticle_category_idx" ON "HelpArticle"("category");
CREATE INDEX IF NOT EXISTS "HelpArticle_visibility_idx" ON "HelpArticle"("visibility");

CREATE TABLE IF NOT EXISTS "HelpRevision" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "articleId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "steps" TEXT NOT NULL,
  "success" TEXT NOT NULL,
  "caution" TEXT NOT NULL,
  "related" TEXT NOT NULL,
  "sourceLocale" TEXT NOT NULL DEFAULT 'en',
  "sourceHash" TEXT NOT NULL,
  "changeReason" TEXT,
  "authorId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("articleId") REFERENCES "HelpArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "HelpRevision_articleId_revisionNumber_key" ON "HelpRevision"("articleId", "revisionNumber");
CREATE INDEX IF NOT EXISTS "HelpRevision_articleId_idx" ON "HelpRevision"("articleId");

CREATE TABLE IF NOT EXISTS "HelpLocaleRevision" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "revisionId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "steps" TEXT NOT NULL,
  "success" TEXT NOT NULL,
  "caution" TEXT NOT NULL,
  "reviewStatus" TEXT NOT NULL DEFAULT 'TRANSLATION_REQUIRED',
  "reviewedBy" TEXT,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("revisionId") REFERENCES "HelpRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "HelpLocaleRevision_revisionId_locale_key" ON "HelpLocaleRevision"("revisionId", "locale");
CREATE INDEX IF NOT EXISTS "HelpLocaleRevision_locale_idx" ON "HelpLocaleRevision"("locale");

CREATE TABLE IF NOT EXISTS "HelpPublication" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "articleId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "approvedLocales" TEXT NOT NULL,
  "publishedBy" TEXT NOT NULL,
  "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewDue" DATETIME,
  "isCurrent" BOOLEAN NOT NULL DEFAULT 1,
  FOREIGN KEY ("articleId") REFERENCES "HelpArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("revisionId") REFERENCES "HelpRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "HelpPublication_articleId_isCurrent_idx" ON "HelpPublication"("articleId", "isCurrent");

CREATE TABLE IF NOT EXISTS "HelpLabNote" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "articleId" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "noteText" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("articleId") REFERENCES "HelpArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "HelpLabNote_articleId_labId_key" ON "HelpLabNote"("articleId", "labId");
CREATE INDEX IF NOT EXISTS "HelpLabNote_labId_idx" ON "HelpLabNote"("labId");

CREATE TABLE IF NOT EXISTS "HelpFeedback" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "articleId" TEXT NOT NULL,
  "revisionId" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "useful" BOOLEAN NOT NULL,
  "comment" TEXT,
  "category" TEXT,
  "userId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("articleId") REFERENCES "HelpArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "HelpFeedback_articleId_idx" ON "HelpFeedback"("articleId");

CREATE TABLE IF NOT EXISTS "HelpSupportConfig" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "labId" TEXT NOT NULL,
  "supportName" TEXT,
  "contactMethod" TEXT,
  "contactValue" TEXT,
  "instructions" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "HelpSupportConfig_labId_key" ON "HelpSupportConfig"("labId");
CREATE INDEX IF NOT EXISTS "HelpSupportConfig_labId_idx" ON "HelpSupportConfig"("labId");
`);

console.log('[MIGRATE_HELP] Tables created successfully.');
db.close();
