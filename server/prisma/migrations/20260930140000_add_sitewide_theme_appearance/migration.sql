-- AlterTable User: Add additive uiThemeId, uiModePreference, uiAppearanceRevision
-- Versioned additive idempotent schema migration for SoilFER Sitewide Theme Library & Selector
-- Safe for existing databases; does NOT drop or alter existing columns or data

ALTER TABLE "User" ADD COLUMN "uiThemeId" TEXT;
ALTER TABLE "User" ADD COLUMN "uiModePreference" TEXT NOT NULL DEFAULT 'inherit';
ALTER TABLE "User" ADD COLUMN "uiAppearanceRevision" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing users:
-- Existing users keep their legacy themePreference ('light' or 'dark').
-- Backfill uiModePreference to match themePreference for existing users (so they don't get silently converted to inherit).
UPDATE "User" SET "uiModePreference" = CASE
  WHEN "themePreference" = 'dark' THEN 'dark'
  WHEN "themePreference" = 'light' THEN 'light'
  ELSE 'light'
END;

-- CreateTable LabAppearanceSetting
CREATE TABLE IF NOT EXISTS "LabAppearanceSetting" (
    "labId" TEXT NOT NULL PRIMARY KEY,
    "themeId" TEXT,
    "defaultMode" TEXT NOT NULL DEFAULT 'inherit',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    CONSTRAINT "LabAppearanceSetting_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable GlobalAppearanceSetting
CREATE TABLE IF NOT EXISTS "GlobalAppearanceSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "themeId" TEXT NOT NULL DEFAULT 'soilfer-classic',
    "defaultMode" TEXT NOT NULL DEFAULT 'light',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT
);

-- Seed global default if not present
INSERT OR IGNORE INTO "GlobalAppearanceSetting" ("id", "themeId", "defaultMode", "revision", "updatedAt")
VALUES ('global', 'soilfer-classic', 'light', 1, CURRENT_TIMESTAMP);
