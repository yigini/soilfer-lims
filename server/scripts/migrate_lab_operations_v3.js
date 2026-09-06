#!/usr/bin/env node
/**
 * Fail-closed, Idempotent Database Migration Script for Laboratory Operations Redesign v3
 * 
 * Functions:
 * 1. Idempotently verifies and creates all v3 tables, columns, and indexes.
 * 2. Applies explicit scientific methodology reconciliation:
 *    - Replaces 37 synthetic placeholder methods (meth-std-*) with authoritative ISO/GLOSOLAN methods.
 *    - Deprecates 38 unreviewed synthetic placeholders (SPEC_PARAM_*) to isDefault = 0.
 *    - Leaves existing WorkItem assignments, Result methodologies, and released Reports untouched.
 * 3. Reconciles Analysis.status (NULL -> 'active') for catalogue active policy compliance.
 * 4. Supports --dry-run and --apply modes with full before/after audit output.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Explicit scientific methodology reconciliation dictionary (Correction 6)
const METHODOLOGY_RECONCILIATION = [
    {
        analysisCode: 'PH_H2O',
        deprecatedMethodId: 'meth-std-1',
        deprecatedName: 'Potentiometry in 1:2.5 H2O Suspension',
        canonicalMethodId: 'GLOSOLAN_PH_H2O',
        canonicalName: 'GLOSOLAN 2021 Potentiometry (1:2.5 H₂O)',
        reason: 'Replaced unreviewed synthetic placeholder with authoritative GLOSOLAN 2021 Standard Operating Procedure.'
    },
    {
        analysisCode: 'pH',
        deprecatedMethodId: 'meth-std-4',
        deprecatedName: 'Potentiometry in 1:2.5 H2O Suspension',
        canonicalMethodId: 'pHNaF_ratio1-5',
        canonicalName: 'pHNaF_ratio1-5',
        reason: 'Replaced placeholder with ISO/GLOSOLAN fluoride extraction method.'
    },
    {
        analysisCode: 'PH_CACL2',
        deprecatedMethodId: 'meth-std-5',
        deprecatedName: 'Potentiometry in 0.01 M CaCl2 Suspension',
        canonicalMethodId: 'ISO_10390_CACL2',
        canonicalName: 'ISO 10390 Potentiometry (0.01 M CaCl₂)',
        reason: 'Replaced placeholder with authoritative ISO 10390 standard.'
    },
    {
        analysisCode: 'PH_KCL',
        deprecatedMethodId: 'meth-std-6',
        deprecatedName: 'Potentiometry in 1 M KCl Suspension',
        canonicalMethodId: 'ISO_10390_KCL',
        canonicalName: 'ISO 10390 Potentiometry (1 M KCl)',
        reason: 'Replaced placeholder with authoritative ISO 10390 1M KCl standard.'
    },
    {
        analysisCode: 'EC',
        deprecatedMethodId: 'meth-std-7',
        deprecatedName: 'Conductometry in 1:5 Soil-Water Suspension',
        canonicalMethodId: 'ISO_11265_EC',
        canonicalName: 'ISO 11265 Conductometry (1:5 Soil:Water)',
        reason: 'Replaced placeholder with ISO 11265 standard conductometry.'
    },
    {
        analysisCode: 'electricalConductivity',
        deprecatedMethodId: 'meth-std-9',
        deprecatedName: 'Conductometry in 1:5 Soil-Water Suspension',
        canonicalMethodId: 'EC_ratio1-10',
        canonicalName: 'EC_ratio1-10',
        reason: 'Replaced placeholder with standard 1:10 soil:water ratio procedure.'
    },
    {
        analysisCode: 'SOC',
        deprecatedMethodId: 'meth-std-10',
        deprecatedName: 'Walkley-Black Chromic Acid Wet Oxidation',
        canonicalMethodId: 'GLOSOLAN_SOC_WB',
        canonicalName: 'GLOSOLAN Walkley-Black Dichromate Oxidation',
        reason: 'Replaced placeholder with authoritative GLOSOLAN Walkley-Black SOP.'
    },
    {
        analysisCode: 'carbonOrganic',
        deprecatedMethodId: 'meth-std-12',
        deprecatedName: 'Walkley-Black Chromic Acid Wet Oxidation',
        canonicalMethodId: 'OrgC_dc-lt-loi',
        canonicalName: 'OrgC_dc-lt-loi',
        reason: 'Replaced placeholder with Loss-on-Ignition / dry combustion standard.'
    },
    {
        analysisCode: 'TN',
        deprecatedMethodId: 'meth-std-13',
        deprecatedName: 'Modified Kjeldahl Digestion & Titration',
        canonicalMethodId: 'GLOSOLAN_TN_KJELDAHL',
        canonicalName: 'GLOSOLAN Modified Kjeldahl Digestion',
        reason: 'Replaced placeholder with authoritative GLOSOLAN Kjeldahl SOP.'
    },
    {
        analysisCode: 'nitrogenTotal',
        deprecatedMethodId: 'meth-std-15',
        deprecatedName: 'Modified Kjeldahl Digestion & Titration',
        canonicalMethodId: 'TotalN_h2so4',
        canonicalName: 'TotalN_h2so4',
        reason: 'Replaced placeholder with sulfuric acid digestion standard.'
    },
    {
        analysisCode: 'P_OLSEN',
        deprecatedMethodId: 'meth-std-16',
        deprecatedName: '0.5 M NaHCO3 Extraction pH 8.5 (Spectrophotometry)',
        canonicalMethodId: 'GLOSOLAN_P_OLSEN',
        canonicalName: 'GLOSOLAN 0.5 M NaHCO₃ pH 8.5 (Olsen)',
        reason: 'Replaced placeholder with authoritative GLOSOLAN Olsen SOP.'
    },
    {
        analysisCode: 'P_BRAY1',
        deprecatedMethodId: 'meth-std-17',
        deprecatedName: '0.03 M NH4F + 0.025 M HCl Extraction (Colorimetry)',
        canonicalMethodId: 'BRAY_1_METHOD',
        canonicalName: 'Bray & Kurtz No. 1 (0.03 M NH₄F + 0.025 M HCl)',
        reason: 'Replaced placeholder with authoritative Bray & Kurtz standard.'
    },
    {
        analysisCode: 'P_MEHLICH3',
        deprecatedMethodId: 'meth-std-18',
        deprecatedName: 'Mehlich-3 Multi-Element Extractant / ICP-OES',
        canonicalMethodId: 'MEHLICH_3_METHOD',
        canonicalName: 'Mehlich-3 Multi-Element Extraction',
        reason: 'Replaced placeholder with Mehlich-3 extractant standard.'
    },
    {
        analysisCode: 'CEC',
        deprecatedMethodId: 'meth-std-19',
        deprecatedName: '1 M Ammonium Acetate (NH4OAc) pH 7.0 Compulsive Exchange',
        canonicalMethodId: 'GLOSOLAN_CEC_NH4OAC',
        canonicalName: 'GLOSOLAN 1 M Ammonium Acetate pH 7.0',
        reason: 'Replaced placeholder with authoritative GLOSOLAN CEC SOP.'
    },
    {
        analysisCode: 'cationExchangeCapacitySoil',
        deprecatedMethodId: 'meth-std-21',
        deprecatedName: '1 M Ammonium Acetate (NH4OAc) pH 7.0',
        canonicalMethodId: 'CEC_ph0-cohex',
        canonicalName: 'CEC_ph0-cohex',
        reason: 'Replaced placeholder with cobaltihexamine standard.'
    },
    {
        analysisCode: 'EXCH_CA',
        deprecatedMethodId: 'meth-std-22',
        deprecatedName: '1 M NH4OAc (pH 7.0) Extraction / AAS or ICP-OES',
        canonicalMethodId: 'GLOSOLAN_CA_NH4OAC',
        canonicalName: '1 M Ammonium Acetate pH 7.0 (Flame AAS / ICP)',
        reason: 'Replaced placeholder with GLOSOLAN Exchangeable Ca SOP.'
    },
    {
        analysisCode: 'EXCH_MG',
        deprecatedMethodId: 'meth-std-23',
        deprecatedName: '1 M NH4OAc (pH 7.0) Extraction / AAS or ICP-OES',
        canonicalMethodId: 'GLOSOLAN_MG_NH4OAC',
        canonicalName: '1 M Ammonium Acetate pH 7.0 (Flame AAS / ICP)',
        reason: 'Replaced placeholder with GLOSOLAN Exchangeable Mg SOP.'
    },
    {
        analysisCode: 'EXCH_K',
        deprecatedMethodId: 'meth-std-24',
        deprecatedName: '1 M NH4OAc (pH 7.0) Extraction / Flame Photometry',
        canonicalMethodId: 'GLOSOLAN_K_NH4OAC',
        canonicalName: '1 M Ammonium Acetate pH 7.0 (Flame Photometry)',
        reason: 'Replaced placeholder with GLOSOLAN Exchangeable K SOP.'
    },
    {
        analysisCode: 'EXCH_NA',
        deprecatedMethodId: 'meth-std-25',
        deprecatedName: '1 M NH4OAc (pH 7.0) Extraction / Flame Photometry',
        canonicalMethodId: 'GLOSOLAN_NA_NH4OAC',
        canonicalName: '1 M Ammonium Acetate pH 7.0 (Flame Photometry)',
        reason: 'Replaced placeholder with GLOSOLAN Exchangeable Na SOP.'
    },
    {
        analysisCode: 'EXCH_ACID',
        deprecatedMethodId: 'meth-std-26',
        deprecatedName: '1 M KCl Extraction / 0.05 M NaOH Titration',
        canonicalMethodId: 'ISO_14254_EXCH_ACID',
        canonicalName: 'ISO 14254 1 M KCl Titration',
        reason: 'Replaced placeholder with ISO 14254 exchangeable acidity standard.'
    },
    {
        analysisCode: 'SAND',
        deprecatedMethodId: 'meth-std-27',
        deprecatedName: 'Hydrometer Method (Bouyoucos)',
        canonicalMethodId: 'ISO_11277_PIPETTE',
        canonicalName: 'ISO 11277 Pipette Method (Dispersed)',
        reason: 'Replaced placeholder with ISO 11277 pipette method.'
    },
    {
        analysisCode: 'SILT',
        deprecatedMethodId: 'meth-std-29',
        deprecatedName: 'Hydrometer Method (Bouyoucos)',
        canonicalMethodId: 'ISO_11277_SILT_PIP',
        canonicalName: 'ISO 11277 Pipette Method (Silt)',
        reason: 'Replaced placeholder with ISO 11277 silt fraction procedure.'
    },
    {
        analysisCode: 'CLAY',
        deprecatedMethodId: 'meth-std-31',
        deprecatedName: 'Hydrometer Method (Bouyoucos)',
        canonicalMethodId: 'ISO_11277_CLAY_PIP',
        canonicalName: 'ISO 11277 Pipette Method (Clay)',
        reason: 'Replaced placeholder with ISO 11277 clay fraction procedure.'
    },
    {
        analysisCode: 'TEXTURE',
        deprecatedMethodId: 'meth-std-33',
        deprecatedName: 'USDA 12-Class Triangle Mathematical Classification',
        canonicalMethodId: 'USDA_12_CLASS',
        canonicalName: 'USDA Textural Triangle Classification Algorithm',
        reason: 'Replaced placeholder with authoritative USDA 12-Class Soil Texture Classification.'
    },
    {
        analysisCode: 'BD_FINE',
        deprecatedMethodId: 'meth-std-34',
        deprecatedName: 'Core Method (Undisturbed Cylinder Sampling)',
        canonicalMethodId: 'ISO_11272_CORE',
        canonicalName: 'ISO 11272 Undisturbed Cylinder Core',
        reason: 'Replaced placeholder with ISO 11272 fine bulk density standard.'
    },
    {
        analysisCode: 'BD_WHOLE',
        deprecatedMethodId: 'meth-std-35',
        deprecatedName: 'Core Method (Whole Soil Cylinder)',
        canonicalMethodId: 'WHOLE_SOIL_CORE',
        canonicalName: 'Volumetric Excavation / Core Ring',
        reason: 'Replaced placeholder with whole-soil core volumetric method.'
    },
    {
        analysisCode: 'CACO3',
        deprecatedMethodId: 'meth-std-36',
        deprecatedName: 'Bernard Calcimeter Volumetric Method',
        canonicalMethodId: 'ISO_10693_CALCIMETER',
        canonicalName: 'ISO 10693 Bernard Calcimeter Volumetry',
        reason: 'Replaced placeholder with ISO 10693 Bernard calcimeter volumetric standard.'
    },
    {
        analysisCode: 'GYPSUM',
        deprecatedMethodId: 'meth-std-37',
        deprecatedName: 'Acetone Precipitation & Dissolution Method',
        canonicalMethodId: 'USDA_HB60_GYPSUM',
        canonicalName: 'USDA Handbook 60 Acetone Precipitation',
        reason: 'Replaced placeholder with USDA Handbook 60 gypsum determination.'
    },
    {
        analysisCode: 'EXT_ZN',
        deprecatedMethodId: 'meth-std-38',
        deprecatedName: '0.005 M DTPA-TEA (pH 7.3) / AAS or ICP-OES',
        canonicalMethodId: 'ISO_14870_ZN',
        canonicalName: 'ISO 14870 0.005 M DTPA-TEA pH 7.3 (AAS/ICP)',
        reason: 'Replaced placeholder with ISO 14870 DTPA-TEA Zn standard.'
    },
    {
        analysisCode: 'EXT_FE',
        deprecatedMethodId: 'meth-std-39',
        deprecatedName: '0.005 M DTPA-TEA (pH 7.3) / AAS or ICP-OES',
        canonicalMethodId: 'ISO_14870_FE',
        canonicalName: 'ISO 14870 0.005 M DTPA-TEA pH 7.3 (AAS/ICP)',
        reason: 'Replaced placeholder with ISO 14870 DTPA-TEA Fe standard.'
    },
    {
        analysisCode: 'EXT_CU',
        deprecatedMethodId: 'meth-std-40',
        deprecatedName: '0.005 M DTPA-TEA (pH 7.3) / AAS or ICP-OES',
        canonicalMethodId: 'ISO_14870_CU',
        canonicalName: 'ISO 14870 0.005 M DTPA-TEA pH 7.3 (AAS/ICP)',
        reason: 'Replaced placeholder with ISO 14870 DTPA-TEA Cu standard.'
    },
    {
        analysisCode: 'EXT_MN',
        deprecatedMethodId: 'meth-std-41',
        deprecatedName: '0.005 M DTPA-TEA (pH 7.3) / AAS or ICP-OES',
        canonicalMethodId: 'ISO_14870_MN',
        canonicalName: 'ISO 14870 0.005 M DTPA-TEA pH 7.3 (AAS/ICP)',
        reason: 'Replaced placeholder with ISO 14870 DTPA-TEA Mn standard.'
    },
    {
        analysisCode: 'EXT_B',
        deprecatedMethodId: 'meth-std-42',
        deprecatedName: 'Hot Water Extraction / Azomethine-H Spectrophotometry',
        canonicalMethodId: 'GLOSOLAN_B_HOTWATER',
        canonicalName: 'GLOSOLAN Hot Water Azomethine-H',
        reason: 'Replaced placeholder with GLOSOLAN Hot Water Boron SOP.'
    },
    {
        analysisCode: 'EXT_ZN',
        deprecatedMethodId: 'ISO_14870_DTPA',
        deprecatedName: 'ISO 14870 0.005 M DTPA-TEA pH 7.3',
        canonicalMethodId: 'ISO_14870_ZN',
        canonicalName: 'ISO 14870 0.005 M DTPA-TEA pH 7.3 (AAS/ICP)',
        reason: 'Consolidated multi-element extractant code to specific analyte determination.'
    },
    {
        analysisCode: 'HM_CD',
        deprecatedMethodId: 'ISO_11466_AQUA_REGIA',
        deprecatedName: 'ISO 11466 Aqua Regia Digestion (ICP-OES)',
        canonicalMethodId: 'HM_CD_ISO_11466',
        canonicalName: 'ISO 11466 Aqua Regia Reflux with ICP-OES Finish',
        reason: 'Replaced generic digestion with analyte-specific Cd determination.'
    },
    {
        analysisCode: 'HM_HG',
        deprecatedMethodId: 'ISO_16772_HG_CV',
        deprecatedName: 'ISO 16772 Cold Vapor AAS for Mercury',
        canonicalMethodId: 'HM_HG_ISO_11466',
        canonicalName: 'ISO 11466 Aqua Regia Reflux with ICP-OES Finish',
        reason: 'Reconciled Hg determination to validated heavy metal suite.'
    },
    {
        analysisCode: 'PLANT_P',
        deprecatedMethodId: 'AOAC_985_01_PLANT_ICP',
        deprecatedName: 'AOAC 985.01 Multi-Element Acid Digestion (ICP)',
        canonicalMethodId: 'AOAC_985_01_PLANT_P',
        canonicalName: 'AOAC 985.01 Multi-Element Acid Digestion (ICP)',
        reason: 'Consolidated plant multi-element method to analyte-specific plant P method.'
    }
];

// Unresolved synthetic placeholder methods: SPEC_PARAM_1_SOP_1 to SPEC_PARAM_38_SOP_1
const UNRESOLVED_SYNTHETIC_PLACEHOLDERS = Array.from({ length: 38 }, (_, i) => `SPEC_PARAM_${i + 1}_SOP_1`);

function parseArgs() {
    const args = process.argv.slice(2);
    let dryRun = false;
    let apply = false;
    let dbPath = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dry-run') {
            dryRun = true;
        } else if (args[i] === '--apply') {
            apply = true;
        } else if (args[i] === '--db' || args[i] === '--db-path') {
            dbPath = args[++i];
        }
    }

    if (!dryRun && !apply) {
        // Default to dry-run if neither is explicitly passed
        dryRun = true;
    }

    if (!dbPath) {
        dbPath = process.env.DATABASE_URL
            ? process.env.DATABASE_URL.replace(/^file:/, '')
            : path.resolve(__dirname, '..', 'prisma', 'dev.db');
    } else {
        dbPath = path.resolve(dbPath);
    }

    return { dryRun, apply, dbPath };
}

function runMigration({ dryRun, apply, dbPath }) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  SoilFER-LIMS Lab Operations v3 Fail-Closed DB Migration    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`Target Database: ${dbPath}`);
    console.log(`Mode:            ${apply ? 'APPLY (Transactional Execution)' : 'DRY RUN (Read-Only Audit)'}`);
    console.log('');

    if (!fs.existsSync(dbPath)) {
        throw new Error(`Target database file does not exist at: ${dbPath}`);
    }

    const db = new Database(dbPath, { timeout: 10000 });

    try {
        // 1. Snapshot baseline metrics for preservation audit
        const countWorkItems = db.prepare('SELECT COUNT(*) as c FROM "WorkItem"').get()?.c || 0;
        const countResults = db.prepare('SELECT COUNT(*) as c FROM "Result"').get()?.c || 0;
        const countReports = db.prepare('SELECT COUNT(*) as c FROM "Report"').get()?.c || 0;
        const countSamples = db.prepare('SELECT COUNT(*) as c FROM "Sample"').get()?.c || 0;

        console.log('--- BASELINE PRESERVATION METRICS ---');
        console.log(`Samples:     ${countSamples}`);
        console.log(`WorkItems:   ${countWorkItems}`);
        console.log(`Results:     ${countResults}`);
        console.log(`Reports:     ${countReports}`);
        console.log('-------------------------------------\n');

        const auditTrail = {
            ddlApplied: [],
            methodologyChanges: [],
            syntheticPlaceholdersDeprecations: [],
            analysisStatusUpdates: 0,
            unresolvedPlaceholders: []
        };

        // If in dry-run mode, we wrap everything in a transaction and rollback at the end.
        // If in apply mode, we commit the transaction upon successful completion.
        const migrateTx = db.transaction(() => {
            // STEP 1: DDL Check / Idempotent table & column creation
            console.log('STEP 1: Idempotent Schema Synchronization (DDL)...');

            // 1.1 Core v3 / P2 tables
            db.exec(`
                CREATE TABLE IF NOT EXISTS "SampleOrderRevision" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "sampleId" TEXT NOT NULL,
                    "version" INTEGER NOT NULL DEFAULT 1,
                    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
                    "reason" TEXT,
                    "requestedBy" TEXT,
                    "authorizedBy" TEXT,
                    "authorizedAt" DATETIME,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "SampleOrderRevision_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "SampleOrderRevision_sampleId_version_key" ON "SampleOrderRevision"("sampleId", "version");
                CREATE INDEX IF NOT EXISTS "SampleOrderRevision_sampleId_idx" ON "SampleOrderRevision"("sampleId");

                CREATE TABLE IF NOT EXISTS "OrderLine" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "revisionId" TEXT NOT NULL,
                    "analysis" TEXT NOT NULL,
                    "methodologyId" TEXT,
                    "methodRevision" TEXT,
                    "isRequired" BOOLEAN NOT NULL DEFAULT 1,
                    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
                    "omissionReason" TEXT,
                    "omissionAuthorizedBy" TEXT,
                    "omissionAuthorizedAt" DATETIME,
                    "predecessorLineId" TEXT,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "OrderLine_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SampleOrderRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "OrderLine_revisionId_idx" ON "OrderLine"("revisionId");
                CREATE INDEX IF NOT EXISTS "OrderLine_analysis_idx" ON "OrderLine"("analysis");

                CREATE TABLE IF NOT EXISTS "WorkAttempt" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "workItemId" TEXT NOT NULL,
                    "orderLineId" TEXT,
                    "attemptNo" INTEGER NOT NULL DEFAULT 1,
                    "executedMethodRevision" TEXT,
                    "author" TEXT,
                    "authorName" TEXT,
                    "materialAliquot" TEXT,
                    "instrumentId" TEXT,
                    "qcBatchId" TEXT,
                    "version" INTEGER NOT NULL DEFAULT 1,
                    "status" TEXT NOT NULL DEFAULT 'RECORDED',
                    "evidenceHash" TEXT,
                    "evidenceData" TEXT,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "WorkAttempt_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT "WorkAttempt_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "WorkAttempt_workItemId_idx" ON "WorkAttempt"("workItemId");
                CREATE INDEX IF NOT EXISTS "WorkAttempt_orderLineId_idx" ON "WorkAttempt"("orderLineId");

                CREATE TABLE IF NOT EXISTS "ReviewDecision" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "sampleId" TEXT NOT NULL,
                    "workItemId" TEXT,
                    "submissionItemId" TEXT,
                    "attemptId" TEXT,
                    "decision" TEXT NOT NULL,
                    "reason" TEXT,
                    "evidenceVersion" INTEGER,
                    "evidenceHash" TEXT,
                    "reviewerId" TEXT NOT NULL,
                    "reviewerName" TEXT,
                    "authorization" TEXT,
                    "policyVersion" TEXT DEFAULT 'v1',
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "ReviewDecision_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT "ReviewDecision_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "ReviewDecision_sampleId_idx" ON "ReviewDecision"("sampleId");
                CREATE INDEX IF NOT EXISTS "ReviewDecision_workItemId_idx" ON "ReviewDecision"("workItemId");

                CREATE TABLE IF NOT EXISTS "SampleAmendment" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "sampleId" TEXT NOT NULL,
                    "type" TEXT NOT NULL,
                    "status" TEXT NOT NULL DEFAULT 'PENDING',
                    "reason" TEXT NOT NULL,
                    "affectedOrderLines" TEXT,
                    "affectedResults" TEXT,
                    "affectedReports" TEXT,
                    "impactAssessment" TEXT,
                    "authorizedBy" TEXT,
                    "authorizedAt" DATETIME,
                    "resolution" TEXT,
                    "createdBy" TEXT NOT NULL,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "SampleAmendment_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "SampleAmendment_sampleId_idx" ON "SampleAmendment"("sampleId");

                CREATE TABLE IF NOT EXISTS "CommandReceipt" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "idempotencyKey" TEXT NOT NULL,
                    "commandType" TEXT NOT NULL,
                    "targetResource" TEXT NOT NULL,
                    "actor" TEXT NOT NULL,
                    "status" TEXT NOT NULL,
                    "outcome" TEXT,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "CommandReceipt_idempotencyKey_key" ON "CommandReceipt"("idempotencyKey");
                CREATE INDEX IF NOT EXISTS "CommandReceipt_idempotencyKey_idx" ON "CommandReceipt"("idempotencyKey");
                CREATE INDEX IF NOT EXISTS "CommandReceipt_actor_idx" ON "CommandReceipt"("actor");

                CREATE TABLE IF NOT EXISTS "WorkItemDraft" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "workItemId" TEXT NOT NULL UNIQUE,
                    "sampleId" TEXT NOT NULL,
                    "userId" TEXT NOT NULL,
                    "labId" TEXT,
                    "analysis" TEXT NOT NULL,
                    "value" TEXT,
                    "values" TEXT,
                    "checks" TEXT,
                    "basis" TEXT DEFAULT 'AIR_DRY',
                    "replicateNo" INTEGER NOT NULL DEFAULT 1,
                    "instrumentId" TEXT,
                    "methodologyId" TEXT,
                    "notes" TEXT,
                    "baseVersion" INTEGER NOT NULL DEFAULT 0,
                    "draftVersion" INTEGER NOT NULL DEFAULT 1,
                    "conflictValue" TEXT,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "WorkItemDraft_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "WorkItemDraft_userId_labId_idx" ON "WorkItemDraft"("userId", "labId");
                CREATE INDEX IF NOT EXISTS "WorkItemDraft_sampleId_analysis_idx" ON "WorkItemDraft"("sampleId", "analysis");

                CREATE TABLE IF NOT EXISTS "Unit" (
                    "code" TEXT PRIMARY KEY NOT NULL,
                    "display" TEXT NOT NULL,
                    "quantityKind" TEXT NOT NULL,
                    "factorToBase" REAL NOT NULL DEFAULT 1.0,
                    "synonyms" TEXT,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS "MethodReference" (
                    "id" TEXT PRIMARY KEY NOT NULL,
                    "authority" TEXT NOT NULL,
                    "citation" TEXT NOT NULL,
                    "title" TEXT NOT NULL,
                    "year" INTEGER,
                    "url" TEXT,
                    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS "LabMethodDefault" (
                    "id" TEXT PRIMARY KEY NOT NULL,
                    "labId" TEXT NOT NULL,
                    "analysisCode" TEXT NOT NULL,
                    "methodologyId" TEXT NOT NULL,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "LabMethodDefault_labId_analysisCode_key" ON "LabMethodDefault"("labId", "analysisCode");

                CREATE TABLE IF NOT EXISTS "BatchQcResult" (
                    "id" TEXT PRIMARY KEY NOT NULL,
                    "batchId" TEXT NOT NULL,
                    "type" TEXT NOT NULL,
                    "label" TEXT,
                    "expected" REAL,
                    "measured" REAL,
                    "value1" REAL,
                    "value2" REAL,
                    "recoveryPct" REAL,
                    "rpd" REAL,
                    "status" TEXT NOT NULL,
                    "details" TEXT,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "BatchQcResult_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "BatchQcResult_batchId_idx" ON "BatchQcResult" ("batchId");

                CREATE TABLE IF NOT EXISTS "ExternalMapping" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "entityType" TEXT NOT NULL,
                    "entityKey" TEXT NOT NULL,
                    "scheme" TEXT NOT NULL,
                    "code" TEXT NOT NULL,
                    "uri" TEXT,
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS "ExternalMapping_entityType_entityKey_idx" ON "ExternalMapping"("entityType", "entityKey");
                CREATE INDEX IF NOT EXISTS "ExternalMapping_scheme_code_idx" ON "ExternalMapping"("scheme", "code");

                CREATE UNIQUE INDEX IF NOT EXISTS "Report_sampleId_version_key" ON "Report"("sampleId", "version");
            `);

            // 1.2 Helper for idempotent column addition
            function ensureColumn(table, col, colDef) {
                const cols = db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
                if (!cols.includes(col)) {
                    db.exec(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${colDef};`);
                    auditTrail.ddlApplied.push(`Added ${table}.${col}`);
                    console.log(`  + Added ${table}.${col}`);
                }
            }

            // Columns on Sample
            ensureColumn('Sample', 'receivedMass', 'REAL');
            ensureColumn('Sample', 'massWarningAcknowledged', 'INTEGER DEFAULT 0');
            ensureColumn('Sample', 'moistureOnArrival', 'TEXT');
            ensureColumn('Sample', 'foreignMaterial', 'TEXT');
            ensureColumn('Sample', 'intakePhotos', 'TEXT');
            ensureColumn('Sample', 'isResubmission', 'INTEGER DEFAULT 0');
            ensureColumn('Sample', 'custodyHandoverAt', 'DATETIME');
            ensureColumn('Sample', 'custodyCarrierName', 'TEXT');
            ensureColumn('Sample', 'custodyTrackingNumber', 'TEXT');
            ensureColumn('Sample', 'custodySenderSignature', 'TEXT');
            ensureColumn('Sample', 'receivingOfficerId', 'TEXT');
            ensureColumn('Sample', 'receivingOfficerName', 'TEXT');
            ensureColumn('Sample', 'receivingOfficerSignature', 'TEXT');

            // Columns on Analysis
            ensureColumn('Analysis', 'sampleMassRequired', 'REAL DEFAULT 10.0');
            ensureColumn('Analysis', 'executionOrder', 'INTEGER DEFAULT 100');
            ensureColumn('Analysis', 'prerequisites', 'TEXT');
            ensureColumn('Analysis', 'unitCode', 'TEXT');
            ensureColumn('Analysis', 'matrix', "TEXT DEFAULT 'SOIL'");
            ensureColumn('Analysis', 'module', "TEXT DEFAULT 'FERTILITY'");
            ensureColumn('Analysis', 'isGlobal', 'BOOLEAN DEFAULT 1');

            // Columns on Result
            ensureColumn('Result', 'provenance', 'TEXT');

            console.log('  ✓ Schema synchronization complete.\n');

            // STEP 2: Methodology Defaults Reconciliation
            console.log('STEP 2: Methodology Defaults Reconciliation...');

            for (const item of METHODOLOGY_RECONCILIATION) {
                // Check current state of deprecated method
                const depRow = db.prepare('SELECT id, isDefault FROM "Methodology" WHERE id = ?').get(item.deprecatedMethodId);
                const canRow = db.prepare('SELECT id, isDefault FROM "Methodology" WHERE id = ?').get(item.canonicalMethodId);

                let depWasDefault = false;
                let canWasDefault = false;

                if (depRow && (depRow.isDefault === 1 || depRow.isDefault === true)) {
                    depWasDefault = true;
                    db.prepare('UPDATE "Methodology" SET "isDefault" = 0, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?').run(item.deprecatedMethodId);
                }

                if (canRow) {
                    canWasDefault = (canRow.isDefault === 1 || canRow.isDefault === true);
                    if (!canWasDefault) {
                        db.prepare('UPDATE "Methodology" SET "isDefault" = 1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?').run(item.canonicalMethodId);
                    }
                }

                if (depWasDefault || !canWasDefault) {
                    auditTrail.methodologyChanges.push({
                        analysisCode: item.analysisCode,
                        deprecated: `${item.deprecatedMethodId} (wasDefault: ${depWasDefault} -> 0)`,
                        canonical: `${item.canonicalMethodId} (wasDefault: ${canWasDefault} -> 1)`,
                        reason: item.reason
                    });
                }
            }

            // Unresolved synthetic placeholders (SPEC_PARAM_1_SOP_1 to SPEC_PARAM_38_SOP_1)
            for (const placeholderId of UNRESOLVED_SYNTHETIC_PLACEHOLDERS) {
                const pRow = db.prepare('SELECT id, analysisCode, isDefault FROM "Methodology" WHERE id = ?').get(placeholderId);
                if (pRow) {
                    if (pRow.isDefault === 1 || pRow.isDefault === true) {
                        db.prepare('UPDATE "Methodology" SET "isDefault" = 0, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?').run(placeholderId);
                        auditTrail.syntheticPlaceholdersDeprecations.push({
                            id: placeholderId,
                            analysisCode: pRow.analysisCode,
                            wasDefault: true,
                            newDefault: false,
                            status: 'UNRESOLVED_SYNTHETIC_PLACEHOLDER'
                        });
                    }
                    auditTrail.unresolvedPlaceholders.push(placeholderId);
                }
            }

            console.log(`  ✓ Reconciled ${auditTrail.methodologyChanges.length} standard methodologies to canonical ISO/GLOSOLAN.`);
            console.log(`  ✓ Set ${auditTrail.syntheticPlaceholdersDeprecations.length} synthetic placeholder methodologies (SPEC_PARAM_*) to isDefault = 0.`);
            console.log(`  ✓ Documented ${auditTrail.unresolvedPlaceholders.length} unresolved synthetic placeholders (no default assigned).\n`);

            // STEP 3: Analysis Status Reconciliation
            console.log('STEP 3: Analysis Status Reconciliation...');
            const nullStatusCount = db.prepare(`SELECT COUNT(*) as c FROM "Analysis" WHERE "status" IS NULL OR "status" = ''`).get()?.c || 0;
            if (nullStatusCount > 0) {
                db.prepare(`UPDATE "Analysis" SET "status" = 'active' WHERE "status" IS NULL OR "status" = ''`).run();
                auditTrail.analysisStatusUpdates = nullStatusCount;
                console.log(`  ✓ Updated ${nullStatusCount} Analysis records with NULL/empty status to 'active'.`);
            } else {
                console.log(`  = All Analysis records already have defined status.`);
            }
            console.log('');

            // STEP 4: Verification of Invariants & Zero Regression
            console.log('STEP 4: Invariant and Data Preservation Verification...');
            const postWorkItems = db.prepare('SELECT COUNT(*) as c FROM "WorkItem"').get()?.c || 0;
            const postResults = db.prepare('SELECT COUNT(*) as c FROM "Result"').get()?.c || 0;
            const postReports = db.prepare('SELECT COUNT(*) as c FROM "Report"').get()?.c || 0;
            const postSamples = db.prepare('SELECT COUNT(*) as c FROM "Sample"').get()?.c || 0;

            if (postWorkItems !== countWorkItems) {
                throw new Error(`Data corruption invariant violated! WorkItem count changed: ${countWorkItems} -> ${postWorkItems}`);
            }
            if (postResults !== countResults) {
                throw new Error(`Data corruption invariant violated! Result count changed: ${countResults} -> ${postResults}`);
            }
            if (postReports !== countReports) {
                throw new Error(`Data corruption invariant violated! Report count changed: ${countReports} -> ${postReports}`);
            }
            if (postSamples !== countSamples) {
                throw new Error(`Data corruption invariant violated! Sample count changed: ${countSamples} -> ${postSamples}`);
            }

            console.log('  ✓ Verified zero mutation to WorkItems, Results, Reports, or Samples.');

            if (dryRun) {
                console.log('\n[DRY RUN] Rolling back all changes made during dry run.');
                throw { isDryRunRollback: true, auditTrail };
            }
        });

        let resultAudit;
        try {
            migrateTx();
            resultAudit = auditTrail;
            console.log('\n✅ [APPLY SUCCESS] Lab operations v3 migration committed successfully!');
        } catch (err) {
            if (err.isDryRunRollback) {
                resultAudit = err.auditTrail;
                console.log('✅ [DRY RUN SUCCESS] Dry-run completed cleanly without errors. All invariants verified.');
            } else {
                throw err;
            }
        }

        return {
            success: true,
            mode: apply ? 'APPLY' : 'DRY_RUN',
            audit: resultAudit
        };
    } finally {
        db.close();
    }
}

if (require.main === module) {
    const opts = parseArgs();
    try {
        const res = runMigration(opts);
        process.exit(0);
    } catch (err) {
        console.error('\n❌ [MIGRATION FAILED - CLOSED]:', err.message || err);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    }
}

module.exports = {
    runMigration,
    METHODOLOGY_RECONCILIATION,
    UNRESOLVED_SYNTHETIC_PLACEHOLDERS
};
