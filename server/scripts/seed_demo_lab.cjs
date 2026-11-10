'use strict';

/**
 * Practice-Lab Seed Script ("Demo Soil Lab" / code "DEMO")
 *
 * Usage (from server/):
 *   DEMO_SEED=1 npm run seed:demo
 *
 * Safety rules:
 *   1. Refuses unless DEMO_SEED=1 is set in the environment.
 *   2. Refuses when NODE_ENV=production.
 *   3. Refuses when a laboratory named "Demo Soil Lab" or coded "DEMO" already exists.
 *   4. Uses only fake names/places/clients and @example.test email addresses.
 *   5. Generates random one-time passwords and 4-digit bench PINs at runtime and prints them once.
 *   6. Drives every sample, batch, QC, review, report, NCR, and PT state through real app routes/services.
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const bcrypt = require('bcryptjs');

const DEMO_LAB_ID = 'DEMO';
const DEMO_LAB_NAME = 'Demo Soil Lab';
const DEMO_PROJECT_CODE = 'PRJ-DEMO-2026';
const DEMO_PROJECT_NAME = 'National Topsoil Fertility Survey';

function failGuard(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function assertSeedSafetyEnv(env = process.env) {
    if (env.DEMO_SEED !== '1') {
        throw failGuard(
            'DEMO_SEED_REQUIRED',
            'Refusing to run practice-lab seed without DEMO_SEED=1.\n' +
            'Run: DEMO_SEED=1 npm run seed:demo'
        );
    }
    if (String(env.NODE_ENV || '').trim().toLowerCase() === 'production') {
        throw failGuard(
            'DEMO_SEED_PRODUCTION_REFUSED',
            'Refusing to run practice-lab seed when NODE_ENV=production.'
        );
    }
}

function generateRandomPassword() {
    // >= 18 chars, upper + lower + digits + symbol, satisfies ISO17025_STRICT minLength=12.
    const raw = crypto.randomBytes(12).toString('base64url');
    return `Dm9!${raw}aZ2`;
}

function generateRandomPin() {
    const n = crypto.randomInt(1000, 10000);
    return String(n);
}

function runNodeScript(serverDir, scriptRelPath, args = [], env = process.env) {
    execFileSync(process.execPath, [path.join(serverDir, scriptRelPath), ...args], {
        cwd: serverDir,
        env,
        stdio: 'pipe'
    });
}

function ensureDatabaseSchemaInstalled(dbPath, serverDir, env) {
    const needsPush = !fs.existsSync(dbPath) || fs.statSync(dbPath).size < 4096;
    if (needsPush) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        const prismaCli = path.join(serverDir, 'node_modules', 'prisma', 'build', 'index.js');
        execFileSync(process.execPath, [prismaCli, 'db', 'push', '--url', `file:${dbPath}`], {
            cwd: serverDir,
            env,
            stdio: 'pipe'
        });
    }

    if (String(env.NODE_ENV || '').trim().toLowerCase() === 'test' && !needsPush) {
        return;
    }

    // Run idempotent additive migrations and schema installers matching docker-entrypoint.sh.
    runNodeScript(serverDir, 'scripts/migrate_lab_operations_v3.js', ['--apply'], env);
    runNodeScript(serverDir, 'scripts/migrate_appearance_preference.js', [], env);
    runNodeScript(serverDir, 'scripts/migrate_project_templates_and_policy.js', [], env);
    runNodeScript(serverDir, 'scripts/migrate_sitewide_theme_library.js', [], env);
    runNodeScript(serverDir, 'scripts/install_workflow_state_guards.js', ['--apply'], env);
    runNodeScript(serverDir, 'scripts/install_result_attempt_links.js', ['--apply'], env);
    runNodeScript(serverDir, 'scripts/install_sample_holds.js', ['--apply'], env);
    runNodeScript(serverDir, 'scripts/install_reference_materials.js', ['--apply'], env);
    runNodeScript(serverDir, 'scripts/install_qc_rules.js', ['--apply'], env);

    const { installQcRuns } = require('./install_qc_runs');
    const dryPlan = installQcRuns({ dbPath, apply: false });
    installQcRuns({ dbPath, apply: true, planSha256: dryPlan.backfillFingerprint });

    runNodeScript(serverDir, 'scripts/install_qc_gate_scope.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_result_raw_input.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/bootstrap_pt_nonconformity.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_result_equipment_evidence.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_workitem_uniqueness.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_work_attempt_contract.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_work_repeat_contract.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_reported_value_selections.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_batch_reagent_lots.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_calculation_templates.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_result_override_requests.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_cross_check_evaluations.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_sample_amendment_authorisation.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_report_revisions.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_bench_credentials.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_preparation_records.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_instrument_imports.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_sample_code_schema.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_sample_containers.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_lab_policy_schema.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_control_charts.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_order_revisions.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_label_print_events.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_sample_custody.js', ['--db', dbPath, '--apply'], env);
    runNodeScript(serverDir, 'scripts/install_signin_protection.js', ['--db', dbPath, '--apply'], env);
}

async function ensurePublishedHelpInDatabase(prisma) {
    const currentPubCount = await prisma.helpPublication.count({ where: { isCurrent: true } });
    if (currentPubCount >= 40) return;

    const { seedHelpContent } = require('./seed_help_content.cjs');
    await seedHelpContent();

    const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
    const now = new Date();
    const articles = await prisma.helpArticle.findMany({
        include: {
            revisions: {
                orderBy: { revisionNumber: 'desc' },
                take: 1,
                include: { locales: true }
            }
        }
    });

    for (const art of articles) {
        const rev = art.revisions[0];
        if (!rev) continue;
        await prisma.helpLocaleRevision.updateMany({
            where: { revisionId: rev.id },
            data: {
                reviewStatus: 'APPROVED',
                reviewedBy: 'system-app-review',
                reviewedAt: now
            }
        });
        await prisma.helpPublication.updateMany({
            where: { articleId: art.id, isCurrent: true },
            data: { isCurrent: false }
        });
        await prisma.helpPublication.create({
            data: {
                articleId: art.id,
                revisionId: rev.id,
                publishedBy: 'system-app-review',
                publishedAt: now,
                approvedLocales: JSON.stringify(locales),
                isCurrent: true
            }
        });
    }
}

async function ensureBaseCatalogues(prisma, serverDir, env) {
    if ((await prisma.unit.count()) === 0) {
        runNodeScript(serverDir, 'seeds/units.js', [], env);
    }
    if ((await prisma.methodReference.count().catch(() => 1)) === 0) {
        runNodeScript(serverDir, 'seeds/references.js', [], env);
    }
    const { seedCatalogue } = require('../seeds/catalogue');
    if ((await prisma.analysis.count()) === 0) {
        await seedCatalogue({ confirmMatches: true, forceClean: true });
    }

    // Ensure standard global operational gates exist (including Sieving, Grinding, Splitting for Shot 16).
    const defaultGates = [
        { code: 'DRYING', name: 'Air Drying (<= 40 °C)', sortOrder: 1 },
        { code: 'PREPARATION', name: 'Sample Preparation (< 2 mm)', sortOrder: 2 },
        { code: 'SIEVING', name: '2 mm Sieving', sortOrder: 3 },
        { code: 'GRINDING', name: 'Fine Grinding (< 0.5 mm)', sortOrder: 4 },
        { code: 'SPLITTING', name: 'Homogenization & Riffle Splitting', sortOrder: 5 }
    ];
    for (const g of defaultGates) {
        const existing = await prisma.operationalGate.findFirst({
            where: { code: g.code, labId: null }
        });
        if (!existing) {
            await prisma.operationalGate.create({
                data: { code: g.code, name: g.name, sortOrder: g.sortOrder, labId: null, isActive: true }
            });
        }
    }

    await ensurePublishedHelpInDatabase(prisma);
}

function createApiClient(baseUrl) {
    return async function api(token, method, urlPath, body) {
        const headers = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const res = await fetch(`${baseUrl}${urlPath}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { raw: text };
        }
        if (!res.ok) {
            const detail = data ? JSON.stringify(data) : text;
            const err = new Error(`HTTP ${res.status} on ${method} ${urlPath}: ${detail}`);
            err.status = res.status;
            err.response = data;
            throw err;
        }
        return data;
    };
}

function addDaysIso(days) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function seedDemoLab(options = {}) {
    const env = options.env || process.env;
    const silent = Boolean(options.silent);
    const log = (...args) => {
        if (!silent) console.log(...args);
    };

    assertSeedSafetyEnv(env);

    const serverDir = path.resolve(__dirname, '..');
    const dbPath = env.DATABASE_PATH
        ? path.resolve(env.DATABASE_PATH)
        : path.resolve(serverDir, 'prisma', 'dev.db');

    process.env.DATABASE_PATH = dbPath;
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.DISABLE_BACKGROUND_JOBS = 'true';
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    }

    ensureDatabaseSchemaInstalled(dbPath, serverDir, process.env);

    const prisma = require('../prisma');
    const existingDemoLab = await prisma.lab.findFirst({
        where: {
            OR: [
                { name: DEMO_LAB_NAME },
                { id: DEMO_LAB_ID },
                { code: DEMO_LAB_ID }
            ]
        }
    });

    if (existingDemoLab) {
        throw failGuard(
            'DEMO_LAB_ALREADY_EXISTS',
            `Refusing to seed: "${DEMO_LAB_NAME}" (${existingDemoLab.id}) already exists in ${dbPath}.\n` +
            'To start fresh, stop the server, remove or replace the local SQLite database file (and any -wal/-shm files), ' +
            'and run DEMO_SEED=1 npm run seed:demo again.'
        );
    }

    log('[DEMO_SEED] Preparing base catalogues and help publications...');
    await ensureBaseCatalogues(prisma, serverDir, process.env);

    // Ensure the required soil parameters are active in the catalogue.
    const requiredActiveCodes = [
        'PH_H2O', 'EC', 'P_OLSEN', 'SOC', 'TN',
        'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC',
        'SAND', 'SILT', 'CLAY', 'TEXTURE', 'SPEC_MIR'
    ];
    await prisma.analysis.updateMany({
        where: { code: { in: requiredActiveCodes } },
        data: { status: 'active' }
    });

    // Generate runtime-only random credentials (never stored in docs or repo).
    const accountSpecs = [
        { username: 'superadmin', role: 'SUPER_ADMIN', name: 'Alex Morgan', email: 'superadmin@example.test', labId: null, projects: [] },
        { username: 'manager1', role: 'LAB_MANAGER', name: 'amina.diallo', displayName: 'Amina Diallo', email: 'manager1@example.test', labId: DEMO_LAB_ID, projects: [] },
        { username: 'manager2', role: 'LAB_MANAGER', name: 'Carlos Mendez', email: 'manager2@example.test', labId: DEMO_LAB_ID, projects: [] },
        { username: 'qa1', role: 'AUDIT_USER', name: 'Priya Nair', email: 'qa1@example.test', labId: DEMO_LAB_ID, projects: [] },
        { username: 'reception1', role: 'SAMPLE_RECEPTION', name: 'Grace Osei', email: 'reception1@example.test', labId: DEMO_LAB_ID, projects: [] },
        { username: 'tech1', role: 'LAB_TECHNICIAN', name: 'Lukas Novak', email: 'tech1@example.test', labId: DEMO_LAB_ID, projects: [], needsPin: true },
        { username: 'tech2', role: 'LAB_TECHNICIAN', name: 'Mei Lin', email: 'tech2@example.test', labId: DEMO_LAB_ID, projects: [], needsPin: true },
        { username: 'viewer1', role: 'VIEWER', name: 'Samira Farah', email: 'viewer1@example.test', labId: DEMO_LAB_ID, projects: [DEMO_PROJECT_CODE] }
    ];

    const credentials = {};
    for (const spec of accountSpecs) {
        credentials[spec.username] = {
            username: spec.username,
            role: spec.role,
            email: spec.email,
            password: generateRandomPassword(),
            pin: spec.needsPin ? generateRandomPin() : null
        };
    }

    // Bootstrap or refresh superadmin with a runtime random password and @example.test email.
    const superHash = await bcrypt.hash(credentials.superadmin.password, 10);
    await prisma.user.upsert({
        where: { username: 'superadmin' },
        update: {
            password: superHash,
            role: 'SUPER_ADMIN',
            name: 'Alex Morgan',
            email: 'superadmin@example.test',
            isActive: true,
            mustChangePassword: false,
            language: 'en'
        },
        create: {
            id: 'user-superadmin-demo',
            username: 'superadmin',
            password: superHash,
            role: 'SUPER_ADMIN',
            name: 'Alex Morgan',
            email: 'superadmin@example.test',
            isActive: true,
            mustChangePassword: false,
            language: 'en'
        }
    });

    const app = require('../app');
    if (typeof app.stopBackgroundSchedulers === 'function') {
        app.stopBackgroundSchedulers();
    }

    const server = http.createServer(app);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const { port } = server.address();
    const api = createApiClient(`http://127.0.0.1:${port}`);

    try {
        log('[DEMO_SEED] Authenticating superadmin and creating Demo Soil Lab (DEMO)...');
        const tokens = {};
        const superLogin = await api(null, 'POST', '/api/auth/login', {
            username: 'superadmin',
            password: credentials.superadmin.password
        });
        tokens.superadmin = superLogin.token;

        // 1. Create Demo Soil Lab (starts in DRAFT lifecycle state).
        await api(tokens.superadmin, 'POST', '/api/labs', {
            id: DEMO_LAB_ID,
            code: DEMO_LAB_ID,
            name: DEMO_LAB_NAME,
            country: 'INT',
            city: 'Sampleton',
            address: '100 Practice Bench Way',
            location: '0.0000, 0.0000',
            phone: '+000-555-0100',
            email: 'lab@example.test',
            website: 'https://demo.example.test',
            timezone: 'UTC',
            capacity: 250,
            notes: 'Practice laboratory seeded for user manual screenshots and staff training.'
        });

        // 2. Create the 7 active DEMO staff accounts.
        for (const spec of accountSpecs.filter(a => a.username !== 'superadmin')) {
            await api(tokens.superadmin, 'POST', '/api/users', {
                username: spec.username,
                password: credentials[spec.username].password,
                role: spec.role,
                name: spec.displayName || spec.name,
                email: spec.email,
                labId: DEMO_LAB_ID,
                countries: [],
                projects: spec.projects
            });
        }

        // Clear first-login password-change gate so seeded accounts work immediately.
        await prisma.user.updateMany({
            where: { username: { in: accountSpecs.map(a => a.username) } },
            data: { mustChangePassword: false, language: 'en', isActive: true }
        });

        // 3. Activate Demo Soil Lab via two-step lifecycle preview + commit.
        const lifecyclePreview = await api(tokens.superadmin, 'POST', `/api/labs/${DEMO_LAB_ID}/lifecycle-preview`, {
            targetState: 'ACTIVE'
        });
        await api(tokens.superadmin, 'POST', `/api/labs/${DEMO_LAB_ID}/lifecycle`, {
            targetState: 'ACTIVE',
            reason: 'Activate Demo Soil Lab for practice sessions and manual screenshots',
            reviewToken: lifecyclePreview.reviewToken
        });

        // 4. Sign in all 7 DEMO staff accounts.
        for (const spec of accountSpecs.filter(a => a.username !== 'superadmin')) {
            const loginRes = await api(null, 'POST', '/api/auth/login', {
                username: spec.username,
                password: credentials[spec.username].password
            });
            tokens[spec.username] = loginRes.token;
        }

        // 5. Branding, facility policies, bench PINs, and 1 pending staff invitation.
        log('[DEMO_SEED] Configuring branding, ISO 17025 policies, bench PINs, and staff invitation...');
        await api(tokens.superadmin, 'PUT', '/api/admin/settings/branding', {
            title: DEMO_LAB_NAME,
            tagline: 'Practice & Training Facility',
            organization: 'Demo Soil Fertility Network',
            contactEmail: 'lab@example.test',
            defaultLanguage: 'en',
            dateFormat: 'YYYY-MM-DD',
            footerText: 'Demo Soil Lab — Practice Certificate of Analysis',
            colors: { primary: '#1d4ed8', secondary: '#0f172a', accent: '#d97706' },
            logoUrl: '/assets/img/logo-light.png'
        });

        const patchDemoPolicies = async (changes, reason, presetCode) => {
            const current = await api(tokens.manager1, 'GET', `/api/labs/${DEMO_LAB_ID}/policies`);
            return api(tokens.manager1, 'PATCH', `/api/labs/${DEMO_LAB_ID}/policies`, {
                ...(presetCode ? { presetCode } : {}),
                expectedVersion: current.version,
                reason,
                changes
            });
        };

        await patchDemoPolicies([
            { key: 'bench.pinAtRecord', value: true },
            { key: 'bench.idleLockMinutes', value: 15 },
            { key: 'gate.verificationRequired', value: true },
            { key: 'review.secondPersonRequired', value: true },
            { key: 'report.amendmentRequiresSecondPerson', value: true },
            { key: 'sample.retentionDaysAfterReport', value: 365 },
            { key: 'sample.codeFormat', value: '{LAB}-{YY}-{SEQ:4}' },
            { key: 'crossCheck.textureClosureTolerancePct', value: 2 },
            { key: 'qc.controlChartMinPoints', value: 12 }
        ], 'Configure Demo Soil Lab starting rules and practice customizations', 'ISO17025_STRICT');

        for (const techUsername of ['tech1', 'tech2']) {
            await api(tokens[techUsername], 'PUT', '/api/auth/bench/pin', {
                password: credentials[techUsername].password,
                pin: credentials[techUsername].pin
            });
        }

        await api(tokens.manager1, 'POST', '/api/staff/invitations', {
            name: 'Tariq Haddad',
            email: 'tech3@example.test',
            role: 'LAB_TECHNICIAN',
            labId: DEMO_LAB_ID
        });

        // 6. Laboratory methodology choice & two lab-created Analysis Packages.
        log('[DEMO_SEED] Configuring methodology defaults and lab analysis packages...');
        await api(tokens.manager1, 'PUT', `/api/config/lab-defaults/${DEMO_LAB_ID}`, {
            defaults: [
                { analysisCode: 'PH_H2O', methodologyId: 'ISO_10390_H2O' }
            ]
        });

        const routineAnalyses = ['PH_H2O', 'EC', 'P_OLSEN', 'SOC', 'TN'];
        const extendedFertilityAnalyses = [
            'PH_H2O', 'EC', 'P_OLSEN', 'SOC', 'TN',
            'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC'
        ];
        const fullSuiteAnalyses = [
            ...extendedFertilityAnalyses,
            'SAND', 'SILT', 'CLAY', 'TEXTURE', 'SPEC_MIR'
        ];

        await api(tokens.manager1, 'POST', '/api/config/groups', {
            id: 'DEMO_ROUTINE_FERTILITY',
            name: 'Routine Fertility Package',
            analyses: routineAnalyses
        });
        await api(tokens.manager1, 'POST', '/api/config/groups', {
            id: 'DEMO_FULL_SOIL_HEALTH',
            name: 'Full Soil Health & Texture Suite',
            analyses: fullSuiteAnalyses
        });

        // Helper to update QC rule criteria for an analysis in DEMO.
        const setQcRule = async (analysisCode, criteria, reason) => {
            const listRes = await api(
                tokens.manager1,
                'GET',
                `/api/qc/rules?labId=${DEMO_LAB_ID}&analysisCode=${encodeURIComponent(analysisCode)}`
            );
            const expectedVersion = listRes.data?.expectedVersion ?? 0;
            return api(tokens.manager1, 'POST', '/api/qc/rules', {
                labId: DEMO_LAB_ID,
                analysisCode,
                expectedVersion,
                reason,
                criteria
            });
        };

        // Configure clean fixed-window / provisional LRM window so historical runs pass cleanly.
        for (const code of ['PH_H2O', 'EC', 'P_OLSEN', 'SOC', 'TN', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC']) {
            const hasCrmValue = ['PH_H2O', 'P_OLSEN', 'SOC'].includes(code);
            await setQcRule(code, {
                blankPerBatch: 1,
                duplicateEvery: 10,
                lrmPerBatch: 1,
                crmEveryNBatches: hasCrmValue ? 10 : 0,
                lrmMode: 'CONTROL_CHART',
                lrmWindowPct: 10
            }, `Set baseline QC batch structure for ${code}`);
        }
        for (const code of ['SAND', 'SILT', 'CLAY', 'TEXTURE', 'SPEC_MIR']) {
            await setQcRule(code, {
                blankPerBatch: 0,
                duplicateEvery: 0,
                lrmPerBatch: 0,
                crmEveryNBatches: 0
            }, `Disable batch control positions for physical/spectral parameter ${code}`);
        }

        // 7. Equipment (3 assets, 2 Ready/Calibrated + 1 Calibration Expiring Soon in 5 days) + import template.
        log('[DEMO_SEED] Registering 3 instruments, calibration events, and CSV import template...');
        const phMeter = await api(tokens.manager1, 'POST', '/api/equipment', {
            name: 'Bench pH Meter 01',
            assetType: 'PH_METER',
            manufacturer: 'Metrohm Demo',
            model: 'pH-913 Practice',
            serialNumber: 'DEMO-PH-001',
            internalAssetTag: 'EQ-DEMO-01',
            location: 'Wet Chemistry Bench A',
            criticality: 'CRITICAL'
        });
        const uvVis = await api(tokens.manager1, 'POST', '/api/equipment', {
            name: 'UV-Vis Spectrophotometer 01',
            assetType: 'SPECTROPHOTOMETER',
            manufacturer: 'Shimadzu Demo',
            model: 'UV-1900i Practice',
            serialNumber: 'DEMO-UV-001',
            internalAssetTag: 'EQ-DEMO-02',
            location: 'Colorimetry Bench B',
            criticality: 'CRITICAL'
        });
        const dryingOven = await api(tokens.manager1, 'POST', '/api/equipment', {
            name: 'Forced-Air Drying Oven 01',
            assetType: 'OVEN',
            manufacturer: 'Binder Demo',
            model: 'FD-115 Practice',
            serialNumber: 'DEMO-OV-001',
            internalAssetTag: 'EQ-DEMO-03',
            location: 'Sample Preparation Room',
            criticality: 'IMPORTANT'
        });

        const todayIso = new Date().toISOString();
        await api(tokens.manager1, 'POST', '/api/equipment/events', {
            equipmentId: phMeter.id,
            eventType: 'CALIBRATION',
            performedDate: todayIso,
            outcome: 'PASS',
            nextDueDate: addDaysIso(180),
            certificateRef: 'CAL-DEMO-PH-2026',
            summary: 'Three-point buffer calibration (pH 4.01, 7.00, 10.01); slope 98.9%.'
        });
        await api(tokens.manager1, 'POST', '/api/equipment/events', {
            equipmentId: uvVis.id,
            eventType: 'CALIBRATION',
            performedDate: todayIso,
            outcome: 'PASS',
            nextDueDate: addDaysIso(180),
            certificateRef: 'CAL-DEMO-UV-2026',
            summary: 'Photometric accuracy and 882 nm wavelength check passed.'
        });
        await api(tokens.manager1, 'POST', '/api/equipment/events', {
            equipmentId: dryingOven.id,
            eventType: 'CALIBRATION',
            performedDate: addDaysIso(-360),
            outcome: 'PASS',
            nextDueDate: addDaysIso(5),
            certificateRef: 'CAL-DEMO-OV-2025',
            summary: 'Annual 40 °C uniformity verification; recalibration due in 5 days.'
        });

        await api(tokens.manager1, 'POST', '/api/equipment/eligibility', {
            analysisCode: 'PH_H2O',
            eligibleEquipmentIds: [phMeter.id],
            isRequired: true
        });
        await api(tokens.manager1, 'POST', '/api/equipment/eligibility', {
            analysisCode: 'P_OLSEN',
            eligibleEquipmentIds: [uvVis.id],
            isRequired: true
        });
        for (const code of ['EC', 'SOC', 'TN', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC', 'SAND', 'SILT', 'CLAY', 'TEXTURE', 'SPEC_MIR']) {
            await api(tokens.manager1, 'POST', '/api/equipment/eligibility', {
                analysisCode: code,
                eligibleEquipmentIds: [phMeter.id, uvVis.id],
                isRequired: false
            });
        }

        await api(tokens.manager1, 'POST', `/api/workbench/instruments/${uvVis.id}/import-templates`, {
            labId: DEMO_LAB_ID,
            name: 'UV-Vis Olsen P Export',
            supersedesId: null,
            expectedVersion: 0,
            mapping: {
                version: 1,
                delimiter: 'COMMA',
                hasHeader: true,
                idColumn: 0,
                idType: 'LAB_SAMPLE_CODE',
                analytes: [
                    { analysisCode: 'P_OLSEN', valueColumn: 1, unit: 'mg/kg', dilutionColumn: 2 }
                ],
                qcDetector: {
                    positionColumn: 0,
                    prefixes: [
                        { prefix: 'BLK', kind: 'BLANK' },
                        { prefix: 'LRM', kind: 'LRM' },
                        { prefix: 'CCV', kind: 'CCV' }
                    ]
                }
            }
        });

        // 8. Inventory (locations + 3 reagent items: In Stock, Low Stock Warning, Expiring Soon).
        log('[DEMO_SEED] Seeding reagent inventory and storage locations...');
        const reagentCabinet = await api(tokens.manager1, 'POST', '/api/inventory/locations', {
            name: 'Chemical Store Cabinet A1',
            purpose: 'REAGENT',
            description: 'Ventilated reagent storage cabinet'
        });
        await api(tokens.manager1, 'POST', '/api/inventory/locations', {
            name: 'Soil Archive Rack R1',
            purpose: 'SAMPLE',
            description: 'Air-dried soil retention archive shelf'
        });

        const nahco3 = await api(tokens.manager1, 'POST', '/api/inventory/items', {
            name: 'Sodium Bicarbonate 0.5 M (Olsen Extractant)',
            category: 'Extracting Solution',
            itemType: 'REAGENT',
            unitOfMeasure: 'L',
            reorderPoint: 5,
            defaultLocationId: reagentCabinet.id
        });
        await api(tokens.manager1, 'POST', '/api/inventory/lots', {
            inventoryItemId: nahco3.id,
            lotNumber: 'LOT-NAHCO3-26A',
            supplier: 'Demo Lab Supplies',
            receivedDate: addDaysIso(-20),
            expiryDate: addDaysIso(240),
            quantity: 25,
            locationId: reagentCabinet.id
        });

        const kclBuffer = await api(tokens.manager1, 'POST', '/api/inventory/items', {
            name: 'pH 7.00 Certified Calibration Buffer',
            category: 'Calibration Standard',
            itemType: 'REAGENT',
            unitOfMeasure: 'L',
            reorderPoint: 4,
            defaultLocationId: reagentCabinet.id
        });
        await api(tokens.manager1, 'POST', '/api/inventory/lots', {
            inventoryItemId: kclBuffer.id,
            lotNumber: 'LOT-BUF7-26B',
            supplier: 'Demo Lab Supplies',
            receivedDate: addDaysIso(-45),
            expiryDate: addDaysIso(180),
            quantity: 1.5,
            locationId: reagentCabinet.id
        });

        const molybdate = await api(tokens.manager1, 'POST', '/api/inventory/items', {
            name: 'Ammonium Molybdate Color Reagent',
            category: 'Colorimetric Reagent',
            itemType: 'REAGENT',
            unitOfMeasure: 'L',
            reorderPoint: 1,
            defaultLocationId: reagentCabinet.id
        });
        await api(tokens.manager1, 'POST', '/api/inventory/lots', {
            inventoryItemId: molybdate.id,
            lotNumber: 'LOT-MOLYB-26C',
            supplier: 'Demo Lab Supplies',
            receivedDate: addDaysIso(-80),
            expiryDate: addDaysIso(12),
            quantity: 6,
            locationId: reagentCabinet.id
        });

        // 9. Reference Materials (CRM-SOIL-01 & LRM-DEMO-01).
        log('[DEMO_SEED] Registering CRM-SOIL-01 and LRM-DEMO-01 check-soil lots...');
        const crmRes = await api(tokens.manager1, 'POST', '/api/reference-materials', {
            labId: DEMO_LAB_ID,
            code: 'CRM-SOIL-01',
            name: 'GLOSOLAN Certified Agricultural Loam CRM',
            kind: 'CRM',
            matrix: 'SOIL',
            lotNumber: 'CRM-2026-LOT01',
            supplier: 'International Soil Reference Bureau (Demo)',
            certificateRef: 'CERT-CRM-SOIL-01',
            expiryDate: addDaysIso(540),
            status: 'ACTIVE'
        });
        const crmMaterial = crmRes.data || crmRes.material || crmRes;

        for (const v of [
            { analysisCode: 'PH_H2O', assignedValue: 6.50, unit: 'pH_units', expandedUncertainty: 0.08, coverageFactor: 2 },
            { analysisCode: 'P_OLSEN', assignedValue: 22.40, unit: 'mg/kg', expandedUncertainty: 1.40, coverageFactor: 2 },
            { analysisCode: 'SOC', assignedValue: 18.60, unit: 'g/kg', expandedUncertainty: 0.90, coverageFactor: 2 }
        ]) {
            await api(tokens.manager1, 'POST', `/api/reference-materials/${crmMaterial.id}/values`, {
                ...v,
                valueType: 'CERTIFIED'
            });
        }

        const lrmRes = await api(tokens.manager1, 'POST', '/api/reference-materials', {
            labId: DEMO_LAB_ID,
            code: 'LRM-DEMO-01',
            name: 'In-House Homogenized Topsoil Check (LRM)',
            kind: 'LRM',
            matrix: 'SOIL',
            lotNumber: 'LRM-2026-B1',
            supplier: 'Demo Soil Lab Internal QC Pool',
            certificateRef: 'INT-LRM-2026-01',
            expiryDate: addDaysIso(365),
            status: 'ACTIVE'
        });
        const lrmMaterial = lrmRes.data || lrmRes.material || lrmRes;

        const lrmAssignedValues = {
            PH_H2O: { val: 6.45, unit: 'pH_units' },
            EC: { val: 0.42, unit: 'dS/m' },
            P_OLSEN: { val: 18.50, unit: 'mg/kg' },
            SOC: { val: 15.20, unit: 'g/kg' },
            TN: { val: 1.26, unit: 'g/kg' },
            EXCH_CA: { val: 8.10, unit: 'cmol(+)/kg' },
            EXCH_MG: { val: 2.35, unit: 'cmol(+)/kg' },
            EXCH_K: { val: 0.64, unit: 'cmol(+)/kg' },
            EXCH_NA: { val: 0.14, unit: 'cmol(+)/kg' },
            CEC: { val: 14.60, unit: 'cmol(+)/kg' }
        };
        for (const [analysisCode, spec] of Object.entries(lrmAssignedValues)) {
            await api(tokens.manager1, 'POST', `/api/reference-materials/${lrmMaterial.id}/values`, {
                analysisCode,
                assignedValue: spec.val,
                unit: spec.unit,
                valueType: 'CONSENSUS'
            });
        }

        // 10. Project + 3 Expected rows + 1 Draft + 15 Demo Samples.
        log('[DEMO_SEED] Creating project, 3 Expected rows, 1 Draft, and 15 Demo Samples...');
        const project = await api(tokens.manager1, 'POST', '/api/projects', {
            code: DEMO_PROJECT_CODE,
            name: DEMO_PROJECT_NAME,
            description: 'Practice topsoil fertility survey across Demo Valley plots.',
            client: 'Demo Agricultural Extension Service',
            projectType: 'OPEN_INTAKE',
            expectedSampleCount: 19,
            priority: 'NORMAL',
            defaultAnalysisBundle: 'DEMO_ROUTINE_FERTILITY',
            sampleIds: ['FIELD-2026-017', 'FIELD-2026-018', 'FIELD-2026-019']
        });

        // Scope expected rows to DEMO so reception1 sees them in Expected Arrivals.
        const baseChecklistPass = {
            container: 'PASS',
            label: 'PASS',
            quantity: 'PASS',
            condition: 'PASS',
            coc: 'PASS'
        };
        const baseSamplingDetails = {
            landUse: 'CROPLAND',
            samplingDate: '2026-10-15',
            samplingDepth: '0-20 cm',
            composite: 'YES'
        };
        const handoverAt = addDaysIso(-1);

        // Save 1 Incomplete Intake Draft (FIELD-2026-016).
        await api(tokens.reception1, 'POST', '/api/reception/intake', {
            originalId: 'FIELD-2026-016',
            projectId: project.id,
            isDraft: true,
            receivedMass: 495,
            moistureOnArrival: 'MOIST',
            foreignMaterial: 'NONE',
            checklist: { container: 'PASS', label: 'PASS' },
            samplingDetails: { landUse: 'CROPLAND', samplingDepth: '0-20 cm' },
            custodyHandoverAt: handoverAt,
            custodyCarrierName: 'Demo Field Courier'
        });

        // Receive & accept Samples 1..14 in exact sequence so they receive DEMO-26-0001 .. DEMO-26-0014.
        const demoSamples = {};
        for (let idx = 1; idx <= 14; idx++) {
            const fieldId = `FIELD-2026-${String(idx).padStart(3, '0')}`;
            const intakePayload = {
                originalId: fieldId,
                projectId: project.id,
                decision: 'ACCEPTED',
                isDraft: false,
                receivedMass: 520 + idx * 5,
                moistureOnArrival: 'MOIST',
                foreignMaterial: 'NONE',
                checklist: baseChecklistPass,
                samplingDetails: baseSamplingDetails,
                custodyHandoverAt: handoverAt,
                custodyCarrierName: 'Demo Field Courier'
            };
            if (idx === 7) {
                intakePayload.requiredAnalyses = fullSuiteAnalyses;
            } else if (idx === 10 || idx === 12) {
                intakePayload.requiredAnalyses = extendedFertilityAnalyses;
            } else if (idx === 14) {
                intakePayload.requiredAnalyses = [...routineAnalyses, 'SAND', 'SILT', 'CLAY'];
            } else {
                intakePayload.analysisGroupIds = ['DEMO_ROUTINE_FERTILITY'];
            }
            const res = await api(tokens.reception1, 'POST', '/api/reception/intake', intakePayload);
            demoSamples[idx] = res.sample || res;
        }

        // Sample 15 (FIELD-2026-015): Damaged bag rejected at intake (automatically raises INTAKE NCR).
        const s15Res = await api(tokens.reception1, 'POST', '/api/reception/intake', {
            originalId: 'FIELD-2026-015',
            projectId: project.id,
            decision: 'REJECTED',
            isDraft: false,
            receivedMass: 115,
            moistureOnArrival: 'WET',
            foreignMaterial: 'ROOTS_STONES',
            ncReason: 'Sample bag split along bottom seam during transit; cross-contamination risk and insufficient soil mass (115 g).',
            notes: 'Damaged consignment parcel photographed at reception bench; client notified.',
            checklist: {
                container: 'FAIL',
                label: 'PASS',
                quantity: 'FAIL',
                condition: 'FAIL',
                coc: 'PASS'
            },
            samplingDetails: baseSamplingDetails,
            custodyHandoverAt: handoverAt,
            custodyCarrierName: 'Demo Field Courier'
        });
        demoSamples[15] = s15Res.sample || s15Res;

        // Print Sample 1's barcode label once so opening Print Labels displays "Reason for reprint".
        await api(tokens.reception1, 'POST', '/api/samples/labels/print', {
            items: [{ entity: 'SAMPLE', entityId: demoSamples[1].id, count: 1 }],
            format: 'STANDARD'
        });

        // Helper to fetch work items for a sample.
        const getSampleWorkItems = async (sampleNum) => {
            return prisma.workItem.findMany({
                where: { sampleId: demoSamples[sampleNum].id },
                orderBy: { createdAt: 'asc' }
            });
        };

        // Resolve active preparation sub-steps configured for DEMO.
        const gateRows = await prisma.operationalGate.findMany({
            where: {
                code: { in: ['SIEVING', 'GRINDING', 'SPLITTING'] },
                OR: [{ labId: null }, { labId: DEMO_LAB_ID }]
            }
        });
        const effectivePrepSteps = new Map();
        for (const row of gateRows.sort((a, b) => (a.labId ? 1 : 0) - (b.labId ? 1 : 0))) {
            effectivePrepSteps.set(row.code, row);
        }
        const activePrepCodes = [...effectivePrepSteps.values()]
            .filter(r => r.isActive)
            .map(r => r.code);

        // Helper to confirm (and optionally verify) an operational gate work item.
        const completeGate = async (workItem, { verify = true } = {}) => {
            await api(tokens.manager1, 'POST', '/api/work/assign', {
                workItemIds: [workItem.id],
                assignee: 'tech1'
            });
            const nowMs = Date.now();
            const allPrepCandidates = [
                {
                    gateCode: 'SIEVING',
                    sieveMm: 2.0,
                    massBeforeG: 485,
                    massAfterG: 450,
                    coarseFractionG: 35,
                    startedAt: new Date(nowMs - 4 * 60 * 60 * 1000).toISOString(),
                    endedAt: new Date(nowMs - 3 * 60 * 60 * 1000).toISOString(),
                    notes: 'Passed 2.0 mm stainless-steel mesh.'
                },
                {
                    gateCode: 'GRINDING',
                    grindMm: 0.5,
                    massBeforeG: 120,
                    massAfterG: 118,
                    startedAt: new Date(nowMs - 3 * 60 * 60 * 1000).toISOString(),
                    endedAt: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(),
                    notes: 'Sub-sample ground to < 0.5 mm for C/N analysis.'
                },
                {
                    gateCode: 'SPLITTING',
                    massBeforeG: 450,
                    massAfterG: 448,
                    startedAt: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(),
                    endedAt: new Date(nowMs - 60 * 60 * 1000).toISOString(),
                    notes: 'Homogenized and riffle-split into bench jars.'
                }
            ];
            const records = workItem.analysis === 'DRYING'
                ? [{
                    gateCode: 'DRYING',
                    method: 'OVEN_40',
                    temperatureC: 38,
                    massBeforeG: 515,
                    massAfterG: 485,
                    equipmentId: dryingOven.id,
                    startedAt: addDaysIso(-2),
                    endedAt: addDaysIso(-1),
                    notes: 'Constant weight reached in forced-air cabinet at 38 °C.'
                }]
                : allPrepCandidates.filter(r => activePrepCodes.includes(r.gateCode));

            await api(tokens.tech1, 'POST', '/api/workbench/operations/confirm', {
                workItemId: workItem.id,
                checklist: [true, true, true],
                observations: `${workItem.analysis} completed per Demo Soil Lab SOP.`,
                records,
                verificationRequired: true
            });
            if (verify) {
                await api(tokens.manager1, 'POST', '/api/workbench/operations/verify', {
                    workItemId: workItem.id,
                    decision: 'ACCEPT',
                    note: `${workItem.analysis} verified by laboratory manager.`
                });
            }
        };

        // 11. Progress Samples 1..14 through Drying & Preparation gates.
        log('[DEMO_SEED] Advancing samples through Air Drying and Sample Preparation...');
        // Sample 1: stays ACCEPTED, Waiting for drying (unassigned DRYING).
        // Sample 2: ACCEPTED, Air Drying assigned to tech1 and open in Workbench.
        {
            const s2Items = await getSampleWorkItems(2);
            const s2Drying = s2Items.find(w => w.analysis === 'DRYING');
            await api(tokens.manager1, 'POST', '/api/work/assign', {
                workItemIds: [s2Drying.id],
                assignee: 'tech1'
            });
        }

        // Samples 3 & 4: Air Drying completed + verified; Sample Preparation assigned to tech1 and open.
        for (const sNum of [3, 4]) {
            const items = await getSampleWorkItems(sNum);
            await completeGate(items.find(w => w.analysis === 'DRYING'), { verify: true });
            const prep = items.find(w => w.analysis === 'PREPARATION');
            await api(tokens.manager1, 'POST', '/api/work/assign', {
                workItemIds: [prep.id],
                assignee: 'tech1'
            });
        }

        // Sample 5: Prepared + 2 sub-sample containers created; analytical tests left Unassigned.
        {
            const s5Items = await getSampleWorkItems(5);
            await completeGate(s5Items.find(w => w.analysis === 'DRYING'), { verify: true });
            await completeGate(s5Items.find(w => w.analysis === 'PREPARATION'), { verify: true });
            const bulkRes = await api(tokens.reception1, 'POST', `/api/samples/${demoSamples[5].id}/containers`, {
                kind: 'BULK',
                massG: 490
            });
            const bulkContainer = bulkRes.container || bulkRes;
            const fineRes = await api(tokens.reception1, 'POST', `/api/samples/${demoSamples[5].id}/containers`, {
                kind: 'FINE_EARTH',
                parentId: bulkContainer.id,
                massG: 360
            });
            const fineContainer = fineRes.container || fineRes;
            await api(tokens.reception1, 'POST', `/api/samples/${demoSamples[5].id}/containers`, {
                kind: 'GROUND',
                parentId: fineContainer.id,
                massG: 95
            });
        }

        // Sample 6: Air Drying verified; Sample Preparation recorded by tech1 and awaiting manager verification.
        {
            const s6Items = await getSampleWorkItems(6);
            await completeGate(s6Items.find(w => w.analysis === 'DRYING'), { verify: true });
            await completeGate(s6Items.find(w => w.analysis === 'PREPARATION'), { verify: false });
        }

        // Samples 7..14: Both Air Drying and Sample Preparation completed + verified -> sample status PROCESSING ("Prepared").
        for (let sNum = 7; sNum <= 14; sNum++) {
            const items = await getSampleWorkItems(sNum);
            await completeGate(items.find(w => w.analysis === 'DRYING'), { verify: true });
            await completeGate(items.find(w => w.analysis === 'PREPARATION'), { verify: true });
        }

        // Assign all analytical items on Samples 7..14 to tech1.
        const analyticalToAssign = [];
        for (let sNum = 7; sNum <= 14; sNum++) {
            const items = await getSampleWorkItems(sNum);
            for (const w of items) {
                if (!['DRYING', 'PREPARATION'].includes(w.analysis)) {
                    analyticalToAssign.push(w.id);
                }
            }
        }
        await api(tokens.manager1, 'POST', '/api/work/assign', {
            workItemIds: analyticalToAssign,
            assignee: 'tech1'
        });

        const defaultMethods = {
            PH_H2O: 'ISO_10390_H2O',
            EC: 'ISO_11265_EC',
            P_OLSEN: 'GLOSOLAN_P_OLSEN',
            SOC: 'GLOSOLAN_SOC_WB',
            TN: 'GLOSOLAN_TN_KJELDAHL',
            EXCH_CA: 'GLOSOLAN_CA_NH4OAC',
            EXCH_MG: 'GLOSOLAN_MG_NH4OAC',
            EXCH_K: 'GLOSOLAN_K_NH4OAC',
            EXCH_NA: 'GLOSOLAN_NA_NH4OAC',
            CEC: 'GLOSOLAN_CEC_NH4OAC'
        };

        const startTechBatch = async ({ analysisCode, workItemIds, instrumentId = null }) => {
            const methodologyId = defaultMethods[analysisCode];
            const built = await api(tokens.tech1, 'POST', '/api/qc/batches', {
                labId: DEMO_LAB_ID,
                workItemIds,
                ...(instrumentId ? { instrumentId } : {}),
                analysisCode,
                analyses: [{
                    analysisCode,
                    methodologyId,
                    references: [{ positionKind: 'LRM', referenceMaterialLotId: lrmMaterial.id }]
                }]
            });
            const started = await api(tokens.tech1, 'POST', `/api/qc/batches/${built.id}/start`, {
                ...(instrumentId ? { instrumentId } : {})
            });
            return started.batch;
        };

        // Helper: start a workbench run, evaluate QC positions, and optionally close the batch.
        const runAndEvaluateBatch = async ({
            analysisCode,
            workItemIds,
            instrumentId = null,
            blankValues = [0.015],
            lrmValues = null,
            crmValue = null,
            sampleMeasurementValue = null,
            closeBatch = true
        }) => {
            const startedBatch = await startTechBatch({
                analysisCode,
                workItemIds,
                instrumentId
            });
            const batchId = startedBatch.id;
            const detailRes = await api(tokens.tech1, 'GET', `/api/qc/batches/${batchId}`);
            const positions = (detailRes.data.positions || []).filter(p => p.historicalSnapshotSeq == null);

            const expectedLrm = lrmAssignedValues[analysisCode]?.val ?? 10.0;
            const measurements = [];
            const references = [];
            let blankIdx = 0;
            let lrmIdx = 0;

            for (const pos of positions) {
                if (pos.kind === 'BLANK' || pos.kind === 'CCB') {
                    const val = blankValues[blankIdx % blankValues.length];
                    blankIdx++;
                    measurements.push({ positionId: pos.id, value: val });
                } else if (pos.kind === 'LRM') {
                    const val = Array.isArray(lrmValues) ? lrmValues[lrmIdx % lrmValues.length] : expectedLrm;
                    lrmIdx++;
                    references.push({ positionId: pos.id, referenceMaterialId: lrmMaterial.id });
                    measurements.push({ positionId: pos.id, value: val });
                } else if (pos.kind === 'CRM') {
                    const crmExpected = analysisCode === 'PH_H2O' ? 6.50 : (analysisCode === 'P_OLSEN' ? 22.40 : 18.60);
                    references.push({ positionId: pos.id, referenceMaterialId: crmMaterial.id });
                    measurements.push({ positionId: pos.id, value: crmValue ?? crmExpected });
                } else if (pos.kind === 'ICV' || pos.kind === 'CCV') {
                    references.push({ positionId: pos.id, referenceMaterialId: lrmMaterial.id });
                    measurements.push({ positionId: pos.id, value: expectedLrm });
                } else if (pos.kind === 'SAMPLE' || pos.kind === 'DUPLICATE') {
                    const hasDup = positions.some(other => other.kind === 'DUPLICATE' && other.duplicateOfPositionId === pos.id);
                    if (pos.kind === 'DUPLICATE' || hasDup) {
                        measurements.push({ positionId: pos.id, value: sampleMeasurementValue ?? expectedLrm });
                    }
                }
            }

            const evalRes = await api(tokens.tech1, 'POST', `/api/qc/batches/${batchId}/evaluate`, {
                analysisCode,
                references,
                measurements
            });

            if (closeBatch) {
                await api(tokens.manager1, 'PUT', `/api/qc/batches/${batchId}`, {
                    status: 'CLOSED'
                });
            }

            return { batchId, evalRes, positions };
        };

        // 12. Build 15 LRM-DEMO-01 Olsen P control-chart points + 10 method blanks + approved limits + 1 Westgard 1-2s warning!
        log('[DEMO_SEED] Seeding 15 Olsen P control-chart points, 10 method blanks, and approved limits...');
        await setQcRule('P_OLSEN', {
            blankPerBatch: 2,
            duplicateEvery: 10,
            lrmPerBatch: 3,
            crmEveryNBatches: 4,
            lrmMode: 'CONTROL_CHART',
            lrmWindowPct: 10
        }, 'Expand Olsen P batch QC slots to establish 12-point baseline and 10-blank history');

        const findItem = async (sNum, code) => {
            const items = await getSampleWorkItems(sNum);
            const found = items.find(w => w.analysis === code);
            if (!found) throw new Error(`Missing work item ${code} on Sample ${sNum}`);
            return found;
        };

        // 4 baseline passing Olsen P batches on Samples 9, 12, 13, 14 -> 4*3 = 12 LRM points, 4*2 = 8 blanks.
        const baselineOlsenBatches = [
            { sNum: 9, blanks: [0.012, 0.016], lrms: [18.32, 18.54, 18.66], sampleVal: 19.2 },
            { sNum: 12, blanks: [0.014, 0.019], lrms: [18.40, 18.48, 18.62], sampleVal: 24.5 },
            { sNum: 13, blanks: [0.011, 0.018], lrms: [18.35, 18.52, 18.60], sampleVal: 21.8 },
            { sNum: 14, blanks: [0.015, 0.021], lrms: [18.38, 18.50, 18.64], sampleVal: 16.4 }
        ];
        let s14OlsenBatchId = null;
        for (const b of baselineOlsenBatches) {
            const item = await findItem(b.sNum, 'P_OLSEN');
            const out = await runAndEvaluateBatch({
                analysisCode: 'P_OLSEN',
                workItemIds: [item.id],
                instrumentId: uvVis.id,
                blankValues: b.blanks,
                lrmValues: b.lrms,
                sampleMeasurementValue: b.sampleVal,
                closeBatch: b.sNum !== 14
            });
            if (b.sNum === 14) s14OlsenBatchId = out.batchId;
        }

        // Propose (tech1) and approve (manager2) Olsen P control limits on LRM-DEMO-01 (12 in-control points).
        const chartRead = await api(
            tokens.tech1,
            'GET',
            `/api/qc/control-charts?labId=${DEMO_LAB_ID}&analysisCode=P_OLSEN&methodologyId=GLOSOLAN_P_OLSEN&referenceMaterialId=${lrmMaterial.id}`
        );
        const inControlIds = (chartRead.points || []).filter(p => p.inControl).map(p => p.measurementId);
        const proposalRes = await api(tokens.tech1, 'POST', '/api/qc/control-limit-proposals', {
            labId: DEMO_LAB_ID,
            analysisCode: 'P_OLSEN',
            methodologyId: 'GLOSOLAN_P_OLSEN',
            referenceMaterialId: lrmMaterial.id,
            selectedMeasurementIds: inControlIds,
            exclusions: [],
            reason: 'Initial 12-point provisional dataset verified in-control for LRM-DEMO-01 Olsen P.'
        });
        const approvedSetRes = await api(tokens.manager2, 'POST', `/api/qc/control-limit-proposals/${proposalRes.proposal.id}/approve`, {});
        const chartMean = approvedSetRes.set.mean;
        const chartSd = approvedSetRes.set.sd;

        // 5th Olsen P batch on Sample 10: 2 more blanks (-> 10 blanks total!) + 3 LRM points where the 3rd is mean + 2.4*sd (Westgard 1-2s warning -> QC_WARN!).
        {
            const s10Olsen = await findItem(10, 'P_OLSEN');
            const warnVal = Number((chartMean + 2.4 * chartSd).toFixed(3));
            await runAndEvaluateBatch({
                analysisCode: 'P_OLSEN',
                workItemIds: [s10Olsen.id],
                instrumentId: uvVis.id,
                blankValues: [0.013, 0.017],
                lrmValues: [Number(chartMean.toFixed(3)), Number((chartMean + 0.2 * chartSd).toFixed(3)), warnVal],
                sampleMeasurementValue: 20.6,
                closeBatch: false
            });
        }

        // Restore Olsen P QC rule to standard 1 blank, 1 LRM, 1 CRM for active bench runs.
        await setQcRule('P_OLSEN', {
            blankPerBatch: 1,
            duplicateEvery: 2,
            lrmPerBatch: 1,
            crmEveryNBatches: 1,
            ccvEvery: 1,
            lrmMode: 'CONTROL_CHART',
            lrmWindowPct: 10
        }, 'Standardize Olsen P bench run profile with Blank, Duplicate, LRM, and CRM');

        // 13. Run passing batches for remaining completed analytes across Samples 9, 10, 12, 13, 14 + EC on 7 & 8.
        log('[DEMO_SEED] Running passing QC batches for Soil pH, EC, SOC, TN, Exchangeable Bases, and CEC...');
        // Soil pH batch #1 on Samples 9, 10, 12, 13, 14 (left QC_PASS during initial review/repeat triage, then closed).
        const phItemsMain = await Promise.all([9, 10, 12, 13, 14].map(n => findItem(n, 'PH_H2O')));
        const phBatch1 = await runAndEvaluateBatch({
            analysisCode: 'PH_H2O',
            workItemIds: phItemsMain.map(w => w.id),
            instrumentId: phMeter.id,
            blankValues: [0.01],
            lrmValues: [6.45],
            sampleMeasurementValue: 6.42,
            closeBatch: false
        });

        // EC on Samples 10, 12, 13, 14 (closed) AND a bench EC run on Samples 7 & 8 (passing, open for Shot 26!).
        const ecItemsClosed = await Promise.all([10, 12, 13, 14].map(n => findItem(n, 'EC')));
        await runAndEvaluateBatch({
            analysisCode: 'EC',
            workItemIds: ecItemsClosed.map(w => w.id),
            blankValues: [0.005],
            lrmValues: [0.42],
            sampleMeasurementValue: 0.38,
            closeBatch: true
        });

        const ecItemsBench = await Promise.all([7, 8].map(n => findItem(n, 'EC')));
        await runAndEvaluateBatch({
            analysisCode: 'EC',
            workItemIds: ecItemsBench.map(w => w.id),
            blankValues: [0.006],
            lrmValues: [0.42],
            sampleMeasurementValue: 0.44,
            closeBatch: false
        });

        // SOC and TN on Samples 10, 12, 13, 14.
        for (const [code, sampleVal] of [['SOC', 15.4], ['TN', 1.28]]) {
            const items = await Promise.all([10, 12, 13, 14].map(n => findItem(n, code)));
            await runAndEvaluateBatch({
                analysisCode: code,
                workItemIds: items.map(w => w.id),
                blankValues: [0.01],
                sampleMeasurementValue: sampleVal,
                closeBatch: true
            });
        }

        // Exchangeable bases & CEC on Samples 10 & 12 (for agronomic ratings and Cross-parameter plausibility).
        for (const [code, sampleVal] of [
            ['EXCH_CA', 8.2],
            ['EXCH_MG', 2.4],
            ['EXCH_K', 0.65],
            ['EXCH_NA', 0.15],
            ['CEC', 14.8]
        ]) {
            const items = await Promise.all([10, 12].map(n => findItem(n, code)));
            await runAndEvaluateBatch({
                analysisCode: code,
                workItemIds: items.map(w => w.id),
                blankValues: [0.01],
                sampleMeasurementValue: sampleVal,
                closeBatch: true
            });
        }

        // Helper to record analytical results as tech1.
        const recordItems = async (entries) => {
            const res = await api(tokens.tech1, 'POST', '/api/workbench/v2/completion/commit', {
                entries
            });
            if (res.errors?.length) {
                throw new Error(`Workbench completion errors: ${JSON.stringify(res.errors)}`);
            }
            return res;
        };

        // 14. Sample 9: Record & submit Soil pH Try #1 -> manager1 returns it & reassigns to tech1 -> Try #2 open in Workbench (Shot 28).
        log('[DEMO_SEED] Progressing Sample 9 (returned Try #1 -> open Try #2)...');
        {
            const s9Ph = await findItem(9, 'PH_H2O');
            await recordItems([{ workItemId: s9Ph.id, value: 6.18, notes: 'Initial pH extract reading.' }]);
            await api(tokens.tech1, 'POST', '/api/workbench/v2/submissions/commit', {
                sampleIds: [demoSamples[9].id],
                workItemIds: [s9Ph.id],
                note: 'Submitting Sample 9 Soil pH for review.'
            });
            await api(tokens.manager1, 'POST', `/api/work/${s9Ph.id}/review`, {
                decision: 'RETURN',
                reasonCode: 'INSTRUMENT_FAULT',
                reason: 'Re-check extract after meter recalibration',
                note: 'Re-check extract after meter recalibration'
            });
            await api(tokens.manager1, 'POST', '/api/work/assign', {
                workItemIds: [s9Ph.id],
                assignee: 'tech1'
            });
        }

        // 15. Sample 10: Two valid Soil pH tries (6.42 & 6.46) + full C/N/bases/CEC + Olsen P QC_WARN -> left in Review Submissions (Shots 29, 31, 32, 33).
        log('[DEMO_SEED] Progressing Sample 10 (two valid Soil pH tries + Cross-parameter plausibility in Review Submissions)...');
        {
            const s10Ph = await findItem(10, 'PH_H2O');
            await recordItems([{ workItemId: s10Ph.id, value: 6.42, notes: 'Try #1 potentiometric reading.' }]);
            await api(tokens.tech1, 'POST', '/api/workbench/v2/submissions/commit', {
                sampleIds: [demoSamples[10].id],
                workItemIds: [s10Ph.id]
            });
            // Manager1 requests a confirmation repeat and reassigns to tech1 so Sample 10 has two valid tries (6.42 and 6.46) for Final report value comparison!
            await api(tokens.manager1, 'POST', `/api/work/${s10Ph.id}/repeats`, {
                reason: 'CONFIRMATION',
                note: 'Confirm borderline slightly acidic topsoil reading with a second independent measurement.'
            });
            await api(tokens.manager1, 'POST', '/api/work/assign', {
                workItemIds: [s10Ph.id],
                assignee: 'tech1'
            });
            // Run a passing pH batch for Sample 10 Try #2, then record 6.46 and all remaining Sample 10 items and submit!
            await runAndEvaluateBatch({
                analysisCode: 'PH_H2O',
                workItemIds: [s10Ph.id],
                instrumentId: phMeter.id,
                blankValues: [0.01],
                lrmValues: [6.46],
                sampleMeasurementValue: 6.46,
                closeBatch: true
            });

            const s10Values = {
                PH_H2O: 6.46,
                EC: 0.39,
                P_OLSEN: 20.6,
                SOC: 15.4,
                TN: 1.28,
                EXCH_CA: 8.2,
                EXCH_MG: 2.4,
                EXCH_K: 0.65,
                EXCH_NA: 0.15,
                CEC: 14.8
            };
            const s10Items = await getSampleWorkItems(10);
            const toRecord = [];
            for (const [code, val] of Object.entries(s10Values)) {
                const w = s10Items.find(item => item.analysis === code);
                toRecord.push({ workItemId: w.id, value: val });
            }
            await recordItems(toRecord);
            await api(tokens.tech1, 'POST', '/api/workbench/v2/submissions/commit', {
                sampleIds: [demoSamples[10].id],
                note: 'Complete fertility & cation submission for Sample 10.'
            });
        }

        // 16. Sample 12: Complete, submit, and review-accept all 10 tests so Sample 12 sits in Final Approvals (Shots 29, 39, 41).
        log('[DEMO_SEED] Progressing Sample 12 (all tests Approved, ready in Final Approvals)...');
        {
            const s12Values = {
                PH_H2O: 6.68,
                EC: 0.45,
                P_OLSEN: 24.5,
                SOC: 18.2,
                TN: 1.52,
                EXCH_CA: 9.4,
                EXCH_MG: 2.8,
                EXCH_K: 0.78,
                EXCH_NA: 0.12,
                CEC: 16.2
            };
            const s12Items = await getSampleWorkItems(12);
            await recordItems(Object.entries(s12Values).map(([code, val]) => ({
                workItemId: s12Items.find(i => i.analysis === code).id,
                value: val
            })));
            await api(tokens.tech1, 'POST', '/api/workbench/v2/submissions/commit', {
                sampleIds: [demoSamples[12].id]
            });
            for (const code of Object.keys(s12Values)) {
                const w = s12Items.find(i => i.analysis === code);
                await api(tokens.manager1, 'POST', `/api/work/${w.id}/review`, {
                    status: 'ACCEPTED',
                    note: 'Verified within agronomic plausibility and QC limits.'
                });
            }
        }

        // 17. Sample 13: Revision 1 (SUPERSEDED), Revision 2 (PUBLISHED), 1 active share link, and 1 pending REPORT amendment (Shots 38, 39, 40, 41).
        log('[DEMO_SEED] Progressing Sample 13 (Revision 1 Replaced, Revision 2 Published, Share Link, Pending Amendment)...');
        {
            const s13Values = { PH_H2O: 6.55, EC: 0.36, P_OLSEN: 21.8, SOC: 16.1, TN: 1.34 };
            const s13Items = await getSampleWorkItems(13);
            await recordItems(Object.entries(s13Values).map(([code, val]) => ({
                workItemId: s13Items.find(i => i.analysis === code).id,
                value: val
            })));
            await api(tokens.tech1, 'POST', '/api/workbench/v2/submissions/commit', {
                sampleIds: [demoSamples[13].id]
            });
            for (const code of Object.keys(s13Values)) {
                const w = s13Items.find(i => i.analysis === code);
                await api(tokens.manager1, 'POST', `/api/work/${w.id}/review`, {
                    status: 'ACCEPTED',
                    note: 'Reviewed by primary manager.'
                });
            }
            // Second-person final approval by manager2, then generate Revision 1.
            await api(tokens.manager2, 'POST', `/api/samples/${demoSamples[13].id}/approve`, {});
            await api(tokens.manager1, 'POST', `/api/reports/generate/${demoSamples[13].id}`, {});

            // Request & co-sign REPORT amendment #1 -> generate Revision 2 (superseding Revision 1).
            const amd1 = await api(tokens.manager1, 'POST', `/api/samples/${demoSamples[13].id}/amendments`, {
                type: 'REPORT',
                reason: 'Include field plot horizon note (0-20 cm topsoil) on the Certificate of Analysis.'
            });
            const amd1Id = amd1.amendment.id;
            await api(tokens.manager2, 'POST', `/api/samples/${demoSamples[13].id}/amendments/${amd1Id}/authorise`, {
                expectedVersion: amd1.amendment.version
            });
            const rev2Res = await api(tokens.manager1, 'POST', `/api/reports/generate/${demoSamples[13].id}`, {
                amendmentId: amd1Id
            });
            const rev2Id = rev2Res.report?.id || rev2Res.id;

            // Create 1 active public verification share link on Revision 2.
            await api(tokens.manager1, 'POST', `/api/reports/${rev2Id}/share`, {
                expiresInDays: 30
            });

            // Open a second REPORT amendment by manager1 and leave it PENDING for manager2 to co-sign in Shot 40.
            await api(tokens.manager1, 'POST', `/api/samples/${demoSamples[13].id}/amendments`, {
                type: 'REPORT',
                reason: 'Clarify extension officer contact reference in certificate footer.'
            });
        }

        // 18. Sample 14: Released report subsequently marked WITHDRAWN via authorised SCIENTIFIC amendment (Shot 38).
        log('[DEMO_SEED] Progressing Sample 14 (Published report withdrawn for scientific retest)...');
        {
            const s14Values = {
                PH_H2O: 5.95,
                EC: 0.31,
                P_OLSEN: 16.4,
                SOC: 14.0,
                TN: 1.18,
                SAND: 42.0,
                SILT: 36.0,
                CLAY: 22.0
            };
            const s14Items = await getSampleWorkItems(14);
            await recordItems(Object.entries(s14Values).map(([code, val]) => ({
                workItemId: s14Items.find(i => i.analysis === code).id,
                value: val
            })));
            await api(tokens.tech1, 'POST', '/api/workbench/v2/submissions/commit', {
                sampleIds: [demoSamples[14].id]
            });
            for (const code of Object.keys(s14Values)) {
                const w = s14Items.find(i => i.analysis === code);
                await api(tokens.manager1, 'POST', `/api/work/${w.id}/review`, {
                    status: 'ACCEPTED',
                    note: 'Approved for initial release.'
                });
            }
            await api(tokens.manager2, 'POST', `/api/samples/${demoSamples[14].id}/approve`, {});
            await api(tokens.manager1, 'POST', `/api/reports/generate/${demoSamples[14].id}`, {});

            const s14Sand = s14Items.find(i => i.analysis === 'SAND');
            const sciAmd = await api(tokens.manager1, 'POST', `/api/samples/${demoSamples[14].id}/amendments`, {
                type: 'SCIENTIFIC',
                reasonCode: 'CONFIRMATION',
                reason: 'Re-verify sand particle-size fraction on retained sub-sample after client agronomic query.',
                selectedWorkItemIds: [s14Sand.id]
            });
            await api(tokens.manager2, 'POST', `/api/samples/${demoSamples[14].id}/amendments/${sciAmd.amendment.id}/authorise`, {
                expectedVersion: sciAmd.amendment.version
            });

            // Close historical Soil pH batch #1 and Sample 14 baseline Olsen P batch now that repeats/reopens are complete.
            await api(tokens.manager1, 'PUT', `/api/qc/batches/${phBatch1.batchId}`, { status: 'CLOSED' });
            if (s14OlsenBatchId) {
                await api(tokens.manager1, 'PUT', `/api/qc/batches/${s14OlsenBatchId}`, { status: 'CLOSED' });
            }
        }

        // 19. Sample 11: Failed Olsen P batch ("Run 3" scenario) with mid-run CCV drift -> AWAITING_DISPOSITION + REPEAT_BRACKET eligible (Shots 29, 34, 35).
        log('[DEMO_SEED] Creating failed Olsen P batch with mid-run CCV drift on Sample 11...');
        {
            await patchDemoPolicies([
                { key: 'qc.calibrationVerification', value: true, analysisCode: 'P_OLSEN' }
            ], 'Enable CCV bracket verification on Olsen P for calibration drift check');

            const s11Olsen = await findItem(11, 'P_OLSEN');
            const failBatch = await startTechBatch({
                analysisCode: 'P_OLSEN',
                instrumentId: uvVis.id,
                workItemIds: [s11Olsen.id]
            });
            const failBatchId = failBatch.id;
            const failDetail = await api(tokens.tech1, 'GET', `/api/qc/batches/${failBatchId}`);
            const failPositions = (failDetail.data.positions || []).filter(p => p.historicalSnapshotSeq == null);
            const ccvPositions = failPositions.filter(p => p.kind === 'CCV');

            const measurements = [];
            const references = [];
            for (const pos of failPositions) {
                if (pos.kind === 'BLANK' || pos.kind === 'CCB') {
                    measurements.push({ positionId: pos.id, value: 0.015 });
                } else if (pos.kind === 'LRM') {
                    references.push({ positionId: pos.id, referenceMaterialId: lrmMaterial.id });
                    measurements.push({ positionId: pos.id, value: 18.50 });
                } else if (pos.kind === 'CRM') {
                    references.push({ positionId: pos.id, referenceMaterialId: crmMaterial.id });
                    measurements.push({ positionId: pos.id, value: 22.35 });
                } else if (pos.kind === 'ICV') {
                    references.push({ positionId: pos.id, referenceMaterialId: crmMaterial.id });
                    measurements.push({ positionId: pos.id, value: 22.40 });
                } else if (pos.kind === 'CCV') {
                    references.push({ positionId: pos.id, referenceMaterialId: crmMaterial.id });
                    const isClosingCcv = pos.id === ccvPositions[ccvPositions.length - 1]?.id;
                    // Closing CCV drifts +42% out of acceptance range (31.80 vs 22.40) -> REPEAT_BRACKET eligible!
                    measurements.push({ positionId: pos.id, value: isClosingCcv ? 31.80 : 22.42 });
                } else if (pos.kind === 'SAMPLE' || pos.kind === 'DUPLICATE') {
                    measurements.push({ positionId: pos.id, value: 17.90 });
                }
            }

            await api(tokens.tech1, 'POST', `/api/qc/batches/${failBatchId}/evaluate`, {
                analysisCode: 'P_OLSEN',
                references,
                measurements
            });

            // Revert calibrationVerification override so active bench Run 1 stays a clean Standard batch run.
            await patchDemoPolicies([
                { key: 'qc.calibrationVerification', clear: true, analysisCode: 'P_OLSEN' },
                { key: 'results.replicatesRequired', value: 2, analysisCode: 'P_OLSEN' }
            ], 'Set 2 replicates on Olsen P for active bench worksheet');
        }

        // 20. Samples 7 & 8: Active Olsen P "Run 1" in Workbench + Sample 8 EC Recorded ("Ready to Submit") + Sample 7 Texture drafts & open MIR (Shots 19-26).
        log('[DEMO_SEED] Setting up active Workbench Run, Ready to Submit item, and Texture/MIR bench state on Samples 7 & 8...');
        {
            // Record Sample 8 EC so it sits in "Ready to Submit" while Sample 7 EC stays "Ready to Record" (Shot 26).
            const s8Ec = await findItem(8, 'EC');
            await recordItems([{ workItemId: s8Ec.id, value: 0.44, notes: '1:5 water conductivity verified.' }]);

            // Save Sample 7 Particle Size fractions (45.0% Sand, 35.0% Silt, 20.0% Clay = 100.0% closure) as a draft on TEXTURE; keep SPEC_MIR open (Shot 25).
            const s7Texture = await findItem(7, 'TEXTURE');
            await api(tokens.tech1, 'POST', '/api/workbench/batch-save', {
                draft: true,
                entries: [
                    { workItemId: s7Texture.id, values: { sand: 45.0, silt: 35.0, clay: 20.0 } }
                ]
            });

            // Start active Olsen P run on Samples 7 & 8 with UV-Vis Spectrophotometer 01 and LRM-DEMO-01, link CRM-SOIL-01, and save replicate drafts (Shots 19-24).
            const s7Olsen = await findItem(7, 'P_OLSEN');
            const s8Olsen = await findItem(8, 'P_OLSEN');
            const activeBatch = await startTechBatch({
                analysisCode: 'P_OLSEN',
                instrumentId: uvVis.id,
                workItemIds: [s7Olsen.id, s8Olsen.id]
            });
            const activeBatchId = activeBatch.id;
            const activeDetail = await api(tokens.tech1, 'GET', `/api/qc/batches/${activeBatchId}`);
            const activePositions = (activeDetail.data.positions || []).filter(p => p.historicalSnapshotSeq == null);
            const activeRefs = [];
            for (const pos of activePositions) {
                if (pos.kind === 'LRM') activeRefs.push({ positionId: pos.id, referenceMaterialId: lrmMaterial.id });
                if (pos.kind === 'CRM') activeRefs.push({ positionId: pos.id, referenceMaterialId: crmMaterial.id });
            }
            if (activeRefs.length > 0) {
                await api(tokens.tech1, 'PUT', `/api/qc/batches/${activeBatchId}`, {
                    analysisCode: 'P_OLSEN',
                    references: activeRefs,
                    measurements: []
                });
            }

            await api(tokens.tech1, 'POST', '/api/workbench/batch-save', {
                draft: true,
                entries: [
                    {
                        workItemId: s7Olsen.id,
                        value: 19.2,
                        replicateNo: 1,
                        values: { replicates: [19.2, 19.6] },
                        notes: 'Draft replicate readings from UV-Vis run.'
                    },
                    {
                        workItemId: s8Olsen.id,
                        value: 14.7,
                        replicateNo: 1,
                        values: { replicates: [14.7, 14.9] },
                        notes: 'Draft replicate readings from UV-Vis run.'
                    }
                ]
            });
        }

        // 21. Problem Records (1 OPEN intake NCR on Sample 15 + 1 CLOSED QC NCR) & 2 GLOSOLAN Proficiency Testing rounds (Shot 37).
        log('[DEMO_SEED] Raising intake problem record, closing historical QC problem record, and recording 2 GLOSOLAN PT rounds...');
        {
            const reception1User = await prisma.user.findUnique({ where: { username: 'reception1' } });
            const workflowRules = require('../services/workflowStateRules');
            const nonconformityService = require('../services/nonconformityService');
            await workflowRules.inTransaction(prisma, tx =>
                nonconformityService.raise(tx, reception1User, {
                    labId: DEMO_LAB_ID,
                    source: 'INTAKE',
                    refType: 'Sample',
                    refId: demoSamples[15].id,
                    description: 'Damaged consignment parcel FIELD-2026-015 rejected at intake: split bag seam and insufficient soil mass (115 g).'
                })
            );

            // Historical failed EC batch on Sample 9 rejected by manager1 -> raises a QC problem record, then closed after corrective action.
            const s9Ec = await findItem(9, 'EC');
            const s9FailEc = await runAndEvaluateBatch({
                analysisCode: 'EC',
                workItemIds: [s9Ec.id],
                blankValues: [0.85],
                lrmValues: [0.42],
                sampleMeasurementValue: 0.41,
                closeBatch: false
            });
            await api(tokens.manager1, 'POST', `/api/qc/batches/${s9FailEc.batchId}/disposition`, {
                decision: 'REJECT',
                analysisCode: 'EC',
                reason: 'Reagent blank exceeded 0.05 dS/m limit due to unwashed conductivity cell; reject run and repeat.'
            });
            await api(tokens.manager1, 'POST', '/api/work/assign', {
                workItemIds: [s9Ec.id],
                assignee: 'tech1'
            });

            const ncrListRes = await api(tokens.qa1, 'GET', '/api/nonconformities');
            const ncrs = Array.isArray(ncrListRes) ? ncrListRes : (ncrListRes.rows || ncrListRes.records || ncrListRes.data || []);
            const qcNcr = ncrs.find(r => r.source === 'QC' && r.status === 'OPEN');
            if (qcNcr) {
                await api(tokens.manager1, 'POST', `/api/nonconformities/${qcNcr.id}/transitions`, {
                    status: 'ACTION',
                    impactAssessment: 'Contaminated rinse water elevated EC reagent blank to 0.85 dS/m; affected sample DEMO-26-0009 EC rejected for repeat measurement.'
                });
                await api(tokens.manager1, 'POST', `/api/nonconformities/${qcNcr.id}/transitions`, {
                    status: 'CLOSED',
                    correctiveAction: 'Replaced deionized rinse carboy, verified conductivity < 0.005 dS/m, and reassigned DEMO-26-0009 EC for fresh extraction.'
                });
            }

            // Record 2 GLOSOLAN PT rounds: 1 SATISFACTORY (z = +0.50), 1 QUESTIONABLE (z = +2.30).
            await api(tokens.manager1, 'POST', '/api/pt/rounds', {
                labId: DEMO_LAB_ID,
                analysisCode: 'PH_H2O',
                provider: 'GLOSOLAN Proficiency Testing',
                roundRef: 'GLOSOLAN-PT-2026-R1',
                date: addDaysIso(-30),
                assignedValue: 6.50,
                labResult: 6.56,
                uncertainty: 0.12,
                notes: 'Routine inter-laboratory comparison round; z-score +0.50 (Satisfactory).'
            });
            await api(tokens.manager1, 'POST', '/api/pt/rounds', {
                labId: DEMO_LAB_ID,
                analysisCode: 'P_OLSEN',
                provider: 'GLOSOLAN Proficiency Testing',
                roundRef: 'GLOSOLAN-PT-2026-R2',
                date: addDaysIso(-10),
                assignedValue: 18.50,
                labResult: 21.26,
                uncertainty: 1.20,
                notes: 'Slight high bias observed prior to color reagent replacement; z-score +2.30 (Questionable).'
            });
        }

        // Print one-time credentials summary to stdout.
        if (!silent) {
            console.log('\n========================================================================');
            console.log(' Demo Soil Lab (DEMO) — Practice Database Seeded Successfully');
            console.log('========================================================================');
            console.log(` Database : ${dbPath}`);
            console.log(` Project  : ${DEMO_PROJECT_NAME} (${DEMO_PROJECT_CODE})`);
            console.log('------------------------------------------------------------------------');
            console.log(' One-Time Generated Practice Credentials (save these now; not stored in docs):');
            console.log('------------------------------------------------------------------------');
            for (const spec of accountSpecs) {
                const c = credentials[spec.username];
                const pinCol = c.pin ? ` | Bench PIN: ${c.pin}` : '';
                console.log(
                    `  ${c.username.padEnd(11)} | ${spec.role.padEnd(17)} | ${c.email.padEnd(24)} | Password: ${c.password}${pinCol}`
                );
            }
            console.log('------------------------------------------------------------------------');
            console.log(' Pending Staff Invite : tech3@example.test (LAB_TECHNICIAN)');
            console.log(' Samples Seeded       : 15 demo samples (FIELD-2026-001..015) + 1 draft + 3 expected');
            console.log('========================================================================\n');
        }

        return {
            labId: DEMO_LAB_ID,
            labName: DEMO_LAB_NAME,
            projectCode: DEMO_PROJECT_CODE,
            dbPath,
            accounts: Object.values(credentials).map(({ username, role, email, pin }) => ({
                username,
                role,
                email,
                hasBenchPin: Boolean(pin)
            }))
        };
    } finally {
        await new Promise(resolve => server.close(() => resolve()));
    }
}

if (require.main === module) {
    seedDemoLab()
        .then(() => {
            process.exit(0);
        })
        .catch(err => {
            console.error(`\n[DEMO_SEED] ERROR (${err.code || 'SEED_FAILED'}): ${err.message}`);
            process.exit(1);
        });
}

module.exports = {
    seedDemoLab,
    assertSeedSafetyEnv,
    DEMO_LAB_ID,
    DEMO_LAB_NAME,
    DEMO_PROJECT_CODE
};
