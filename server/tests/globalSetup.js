const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-12345';

    const tmpDir = path.resolve(__dirname, '.tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const testDbPath = path.resolve(tmpDir, `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.db`);
    const sourceDbPath = path.resolve(__dirname, '../prisma/dev.db');

    // Pin6059793372: CI/local provision the same published, test-only baseline.
    const helpPrerequisite = 'Test template lacks the published help release. Run the existing seed_help_content.cjs and publish_help_release.cjs with NODE_ENV=test against the owned server/prisma/dev.db template.';
    if (!fs.existsSync(sourceDbPath)) throw new Error(helpPrerequisite);
    const TemplateDatabase = require('better-sqlite3');
    const template = new TemplateDatabase(sourceDbPath, { readonly: true, fileMustExist: true });
    try {
        if (!template.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='HelpPublication'").get()) throw new Error(helpPrerequisite);
        const requiredArticles = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/help/content.en.json'), 'utf8')).articles;
        const publications = template.prepare('SELECT articleId, approvedLocales FROM HelpPublication WHERE isCurrent = 1').all();
        const complete = new Set(publications.filter(row => {
            try {
                const locales = JSON.parse(row.approvedLocales);
                return Array.isArray(locales) && ['en', 'es', 'es-419', 'fr', 'pt'].every(locale => locales.includes(locale));
            } catch (_) { return false; }
        }).map(row => row.articleId));
        if (requiredArticles.some(article => !complete.has(article.id))) throw new Error(helpPrerequisite);
        // Pin6060814553: a live SQLite template may have committed WAL pages.
        // The owned destination is new; copy the complete database via SQLite.
        if (fs.existsSync(testDbPath)) throw new Error('Owned test destination already exists.');
        await template.backup(testDbPath);
    } finally { template.close(); }

    if (fs.existsSync(sourceDbPath)) {
        const Database = require('better-sqlite3');
        const db = new Database(testDbPath, { fileMustExist: true });
        try {
            const stateColumns = ['Sample', 'WorkItem'].map(table => {
                const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name);
                return ['holdPriorStatus', 'legacyStatus'].map(column => columns.includes(column));
            }).flat();
            const evidenceTable = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ResultEvidenceEvent'").get();
            if (stateColumns.every(value => !value) && !evidenceTable) {
                db.transaction(() => db.exec(fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261005000000_workflow_state_evidence/migration.sql'), 'utf8')))();
            } else if (!stateColumns.every(Boolean) || !evidenceTable) {
                throw new Error('Disposable test template has a partial workflow-state schema.');
            }
            const guardSql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
            const guardNames = [...guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map(match => match[1]);
            const installed = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name));
            const present = guardNames.map(name => installed.has(name));
            if (present.every(value => !value)) db.transaction(() => db.exec(guardSql))();
            else if (!present.every(Boolean)) throw new Error('Disposable test template has partial workflow-state guards.');
            db.exec(`CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,
                "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)`);
        } finally { db.close(); }
        require('../scripts/install_result_attempt_links').installResultAttemptLinks({ dbPath: testDbPath, apply: true });
        require('../scripts/install_sample_holds').installSampleHolds({ dbPath: testDbPath, apply: true });
        require('../scripts/install_reference_materials').installReferenceMaterials({ dbPath: testDbPath, apply: true });
        require('../scripts/install_qc_rules').installQcRules({ dbPath: testDbPath, apply: true });
        const { installQcRuns } = require('../scripts/install_qc_runs');
        const reviewed = installQcRuns({ dbPath: testDbPath, apply: false });
        installQcRuns({ dbPath: testDbPath, apply: true, planSha256: reviewed.backfillFingerprint });
        require('../scripts/install_qc_gate_scope').installQcGateScope({ dbPath: testDbPath, apply: true });
        require('../scripts/bootstrap_pt_nonconformity').bootstrapPtNonconformity({ dbPath: testDbPath, apply: true });
        require('../scripts/install_result_equipment_evidence').installResultEquipmentEvidence({ dbPath: testDbPath, apply: true });
        require('../scripts/install_workitem_uniqueness').installWorkItemUniqueness({ dbPath: testDbPath, apply: true });
        require('../scripts/install_work_attempt_contract').installWorkAttemptContract({dbPath:testDbPath,apply:true});
        require('../scripts/install_work_repeat_contract').installWorkRepeatContract({dbPath:testDbPath,apply:true});
        require('../scripts/install_reported_value_selections').installReportedValueSelections({dbPath:testDbPath,apply:true});
        require('../scripts/install_batch_reagent_lots').installBatchReagentLots({dbPath:testDbPath,apply:true});
        require('../scripts/install_result_override_requests').installResultOverrideRequests({dbPath:testDbPath,apply:true});
        require('../scripts/install_calculation_templates').installCalculationTemplates({dbPath:testDbPath,apply:true});
        require('../scripts/install_cross_check_evaluations').installCrossCheckEvaluations({dbPath:testDbPath,apply:true});
        require('../scripts/install_sample_amendment_authorisation').installSampleAmendmentAuthorisation({dbPath:testDbPath,apply:true});
        require('../scripts/install_report_revisions').installReportRevisions({dbPath:testDbPath,apply:true});
        require('../scripts/install_bench_credentials').installBenchCredentials({dbPath:testDbPath,apply:true});
        require('../scripts/install_preparation_records').installPreparationRecords({dbPath:testDbPath,apply:true});
    }

    process.env.DATABASE_PATH = testDbPath;
    process.env.DATABASE_URL = `file:${testDbPath}`;

    fs.writeFileSync(path.resolve(tmpDir, 'current_test_db.txt'), testDbPath, 'utf8');
};
