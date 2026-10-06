-- #185: additive, immutable QC rule revisions. No seeding or history backfill.
CREATE TABLE "QcRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "methodologyId" TEXT,
    "version" INTEGER NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxBatchSize" INTEGER,
    "blankPerBatch" INTEGER,
    "blankLimitMode" TEXT,
    "blankAbsLimit" REAL,
    "duplicateEvery" INTEGER,
    "duplicateRpdMax" REAL,
    "duplicateMode" TEXT,
    "duplicateAbsMax" REAL,
    "duplicateAbsMaxBelow5LOQ" REAL,
    "lrmPerBatch" INTEGER,
    "lrmMode" TEXT,
    "lrmWindowPct" REAL,
    "crmEveryNBatches" INTEGER,
    "crmMode" TEXT,
    "crmRecoveryMin" REAL,
    "crmRecoveryMax" REAL,
    "crmAbsWindow" REAL,
    "ccvEvery" INTEGER,
    "ccvMin" REAL,
    "ccvMax" REAL,
    "curveMinPoints" INTEGER,
    "curveMinR" REAL,
    "repeatabilityLimit" REAL,
    "blankCorrection" TEXT,
    "failAction" TEXT,
    CONSTRAINT "QcRule_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QcRule_analysisCode_fkey" FOREIGN KEY ("analysisCode") REFERENCES "Analysis" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QcRule_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "Methodology" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "QcRule_labId_analysisCode_methodologyId_effectiveFrom_idx" ON "QcRule"("labId", "analysisCode", "methodologyId", "effectiveFrom");
CREATE UNIQUE INDEX "QcRule_scope_version_unique" ON "QcRule"("labId", "analysisCode", COALESCE("methodologyId", ''), "version");

CREATE TRIGGER "QcRule_immutable_update" BEFORE UPDATE ON "QcRule"
BEGIN
    SELECT RAISE(ABORT, 'QC_RULE_IMMUTABLE');
END;
CREATE TRIGGER "QcRule_immutable_delete" BEFORE DELETE ON "QcRule"
BEGIN
    SELECT RAISE(ABORT, 'QC_RULE_IMMUTABLE');
END;
CREATE TRIGGER "QcRule_version_guard" BEFORE INSERT ON "QcRule"
BEGIN
    SELECT CASE WHEN typeof(NEW.version) <> 'integer' OR NEW.version <> COALESCE((SELECT MAX(version) FROM "QcRule"
        WHERE labId=NEW.labId AND analysisCode=NEW.analysisCode AND methodologyId IS NEW.methodologyId), 0) + 1
        THEN RAISE(ABORT, 'QC_RULE_VERSION_CONFLICT') END;
END;
CREATE TRIGGER "QcRule_scope_guard" BEFORE INSERT ON "QcRule"
BEGIN
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM "Lab" l JOIN "Analysis" a ON a.code=NEW.analysisCode WHERE l.id=NEW.labId
        AND (a.labId IS NULL OR a.labId IN (l.id,l.code))) OR
        (NEW.methodologyId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Methodology" m JOIN "Lab" l ON l.id=NEW.labId
        WHERE m.id=NEW.methodologyId AND m.analysisCode=NEW.analysisCode AND (m.labId IS NULL OR m.labId IN (l.id,l.code))))
        THEN RAISE(ABORT, 'QC_RULE_SCOPE_INVALID') END;
END;
CREATE TRIGGER "QcRule_value_guard" BEFORE INSERT ON "QcRule"
BEGIN
    SELECT CASE WHEN trim(NEW.reason)='' OR trim(NEW.approvedBy)='' THEN RAISE(ABORT, 'QC_RULE_REASON_REQUIRED') END;
    SELECT CASE WHEN
        COALESCE(CASE WHEN typeof(NEW.effectiveFrom) IN ('integer','real') THEN julianday(NEW.effectiveFrom/1000.0,'unixepoch') ELSE julianday(NEW.effectiveFrom) END, -1) <
        COALESCE(CASE WHEN typeof(NEW.createdAt) IN ('integer','real') THEN julianday(NEW.createdAt/1000.0,'unixepoch') ELSE julianday(NEW.createdAt) END, 1e99)
        THEN RAISE(ABORT, 'QC_RULE_EFFECTIVE_FROM_INVALID') END;
    SELECT CASE WHEN NEW.blankLimitMode IS NOT NULL AND NEW.blankLimitMode NOT IN ('ABSOLUTE','LT_LOQ','LT_HALF_LOQ') OR
        NEW.duplicateMode IS NOT NULL AND NEW.duplicateMode NOT IN ('RPD','ABS_DIFF') OR
        NEW.lrmMode IS NOT NULL AND NEW.lrmMode NOT IN ('CONTROL_CHART','FIXED_WINDOW') OR
        NEW.crmMode IS NOT NULL AND NEW.crmMode NOT IN ('RECOVERY','ABS_WINDOW') OR
        NEW.blankCorrection IS NOT NULL AND NEW.blankCorrection <> 'NONE'
        THEN RAISE(ABORT, 'QC_RULE_MODE_UNSUPPORTED') END;
    SELECT CASE WHEN NEW.crmRecoveryMin > NEW.crmRecoveryMax OR NEW.ccvMin > NEW.ccvMax
        THEN RAISE(ABORT, 'QC_RULE_VALUE_INVALID') END;
    SELECT CASE WHEN NEW.failAction IS NOT NULL AND NOT json_valid(NEW.failAction) THEN RAISE(ABORT,'QC_RULE_VALUE_INVALID') END;
    SELECT CASE WHEN NEW.failAction IS NOT NULL AND (json_type(NEW.failAction)<>'object' OR (SELECT COUNT(*) FROM json_each(NEW.failAction))<>4 OR
        (SELECT COUNT(DISTINCT key) FROM json_each(NEW.failAction))<>4 OR
        EXISTS (SELECT 1 FROM json_each(NEW.failAction) WHERE key NOT IN ('BLANK','DUPLICATE','LRM','CRM') OR value NOT IN ('FAIL_BATCH','WARN') OR type<>'text'))
        THEN RAISE(ABORT,'QC_RULE_VALUE_INVALID') END;
    -- Finite, nonnegative criteria; integers retain their declared cardinality.
    SELECT CASE WHEN EXISTS (SELECT 1 FROM json_each(json_object(
        'maxBatchSize',NEW.maxBatchSize,'blankPerBatch',NEW.blankPerBatch,'duplicateEvery',NEW.duplicateEvery,'lrmPerBatch',NEW.lrmPerBatch,
        'crmEveryNBatches',NEW.crmEveryNBatches,'ccvEvery',NEW.ccvEvery,'curveMinPoints',NEW.curveMinPoints))
        WHERE type<>'null' AND (type<>'integer' OR value<0 OR value>9007199254740991 OR (key IN ('maxBatchSize','curveMinPoints') AND value<1)))
        OR EXISTS (SELECT 1 FROM json_each(json_object(
        'blankAbsLimit',NEW.blankAbsLimit,'duplicateRpdMax',NEW.duplicateRpdMax,'duplicateAbsMax',NEW.duplicateAbsMax,
        'duplicateAbsMaxBelow5LOQ',NEW.duplicateAbsMaxBelow5LOQ,'lrmWindowPct',NEW.lrmWindowPct,'crmRecoveryMin',NEW.crmRecoveryMin,
        'crmRecoveryMax',NEW.crmRecoveryMax,'crmAbsWindow',NEW.crmAbsWindow,'ccvMin',NEW.ccvMin,'ccvMax',NEW.ccvMax,
        'curveMinR',NEW.curveMinR,'repeatabilityLimit',NEW.repeatabilityLimit))
        WHERE type<>'null' AND (type NOT IN ('integer','real') OR value<0 OR value>1.7976931348623157e308 OR (key='curveMinR' AND value>1)))
        THEN RAISE(ABORT,'QC_RULE_VALUE_INVALID') END;
END;
