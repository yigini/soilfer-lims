/**
 * Deployment Readiness Bootstrap & Packaging Verification
 * File: server/tests/contracts/deployment_readiness_bootstrap.test.js
 *
 * Verifies installer and packaging scripts in disposable test environments:
 * 1. setup.sh node version rejection and mode validation.
 * 2. setup.sh fail-fast on database push failure (zero error swallowing).
 * 3. setup.sh .env creation and missing-JWT auto-population.
 * 4. docker-entrypoint.sh empty volume detection vs populated database preservation.
 * 5. docker compose configuration parsing across local, global, and nginx overrides.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const { createHash } = require('node:crypto');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installCalculationReleasePrerequisites } = require('../helpers/calculationReleasePrerequisites');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');

describe('Deployment Readiness Bootstrap & Packaging Verification', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const bashPath = os.platform() === 'win32'
        ? (fs.existsSync('C:/Program Files/Git/bin/bash.exe') ? 'C:/Program Files/Git/bin/bash.exe' : 'bash')
        : 'bash';

    const TS = Date.now();
    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), `lims_bootstrap_test_${TS}_`));
    const ownedSchemaDatabases = [];

    afterAll(() => {
        for (const file of ownedSchemaDatabases) fs.rmSync(assertOwnedTestDatabase(file, 'system:fixture'), { force: true });
        try {
            fs.rmSync(scratchDir, { recursive: true, force: true });
        } catch (_) {}
    });

    test('setup.sh rejects invalid mode with exit 1', () => {
        const res = cp.spawnSync(bashPath, [path.join(repoRoot, 'setup.sh'), 'invalid_mode'], {
            encoding: 'utf8',
            cwd: repoRoot
        });

        expect(res.status).toBe(1);
        expect(res.stdout + res.stderr).toMatch(/Invalid mode: invalid_mode/i);
    });

    test('setup.sh rejects Node 18 runtime with clear guidance', () => {
        const testDir = path.join(scratchDir, 'node18_test');
        fs.mkdirSync(testDir, { recursive: true });
        const stubBin = path.join(testDir, 'bin');
        fs.mkdirSync(stubBin, { recursive: true });

        // Node stub returning v18.20.0
        fs.writeFileSync(path.join(stubBin, 'node'), '#!/bin/sh\nif [ "$1" = "-v" ]; then echo v18.20.0; else exec node "$@"; fi\n');
        fs.chmodSync(path.join(stubBin, 'node'), '755');

        const env = { ...process.env, PATH: `${stubBin}${path.delimiter}${process.env.PATH}` };
        const res = cp.spawnSync(bashPath, [path.join(repoRoot, 'setup.sh'), 'local'], {
            encoding: 'utf8',
            cwd: testDir,
            env
        });

        expect(res.status).toBe(1);
        expect(res.stdout + res.stderr).toMatch(/Supported Node\.js (LTS )?required/i);
    });

    test('setup.sh fails fast and aborts if schema push fails (no error swallowing)', () => {
        const testDir = path.join(scratchDir, 'push_fail_test');
        fs.mkdirSync(testDir, { recursive: true });
        fs.mkdirSync(path.join(testDir, 'server'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'client'), { recursive: true });
        fs.copyFileSync(path.join(repoRoot, 'setup.sh'), path.join(testDir, 'setup.sh'));

        const stubBin = path.join(testDir, 'bin');
        fs.mkdirSync(stubBin, { recursive: true });

        const traceLog = path.join(testDir, 'trace.log');
        const stub = `#!/bin/sh
set -e
cmd="\${0##*/}"
echo "$cmd $*" >> "${traceLog.replace(/\\/g, '/')}"
case "$cmd:$*" in
  node:-v) echo v24.13.0 ;;
  npm:ci*|npm:install*|npx:prisma\\ generate|npm:run\\ build) : ;;
  npx:prisma\\ db\\ push) echo "Prisma simulated database connection error" >&2; exit 1 ;;
  node:seed.js) echo "SEED SHOULD NOT BE CALLED" >> "${traceLog.replace(/\\/g, '/')}"; exit 0 ;;
  *) exit 0 ;;
esac
`;
        for (const binName of ['node', 'npm', 'npx']) {
            const file = path.join(stubBin, binName);
            fs.writeFileSync(file, stub);
            fs.chmodSync(file, '755');
        }

        const env = { ...process.env, PATH: `${stubBin}${path.delimiter}${process.env.PATH}` };
        const res = cp.spawnSync(bashPath, ['./setup.sh', 'local'], {
            encoding: 'utf8',
            cwd: testDir,
            env
        });

        // Script must exit with failure
        expect(res.status).not.toBe(0);
        // It must NOT print "Database ready"
        expect(res.stdout).not.toMatch(/Database ready/i);
        // It must NOT print "Setup Complete"
        expect(res.stdout).not.toMatch(/Setup Complete/i);

        // Trace log must NOT contain seed invocation
        const trace = fs.existsSync(traceLog) ? fs.readFileSync(traceLog, 'utf8') : '';
        expect(trace).not.toMatch(/SEED SHOULD NOT BE CALLED/);
    });

    test('setup.sh auto-populates JWT_SECRET into existing .env with blank secret', () => {
        const testDir = path.join(scratchDir, 'jwt_populate_test');
        fs.mkdirSync(testDir, { recursive: true });
        fs.mkdirSync(path.join(testDir, 'server'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'client'), { recursive: true });
        fs.copyFileSync(path.join(repoRoot, 'setup.sh'), path.join(testDir, 'setup.sh'));

        // Pre-create .env with empty JWT_SECRET (as in .env.example)
        fs.writeFileSync(path.join(testDir, '.env'), 'PORT=3000\nJWT_SECRET=\nNODE_ENV=production\nDEPLOYMENT_MODE=local\n');

        const stubBin = path.join(testDir, 'bin');
        fs.mkdirSync(stubBin, { recursive: true });

        const stub = `#!/bin/sh
set -e
cmd="\${0##*/}"
case "$cmd:$*" in
  node:-v) echo v24.13.0 ;;
  node:-e*) echo "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" ;;
  *) : ;;
esac
`;
        for (const binName of ['node', 'npm', 'npx']) {
            const file = path.join(stubBin, binName);
            fs.writeFileSync(file, stub);
            fs.chmodSync(file, '755');
        }

        const env = { ...process.env, PATH: `${stubBin}${path.delimiter}${process.env.PATH}` };
        const res = cp.spawnSync(bashPath, ['./setup.sh', 'local'], {
            encoding: 'utf8',
            cwd: testDir,
            env
        });

        expect(res.status).toBe(0);

        // .env must now contain a non-empty 128-char hex JWT_SECRET
        const updatedEnv = fs.readFileSync(path.join(testDir, '.env'), 'utf8');
        const match = updatedEnv.match(/JWT_SECRET=([0-9a-f]{128})/i);
        expect(match).not.toBeNull();
    });

    test('entrypoint persists auto-generated JWT_SECRET across container restarts', () => {
        const testDir = path.join(scratchDir, 'jwt_entrypoint_persist_test');
        fs.mkdirSync(path.join(testDir, 'prisma'), { recursive: true });

        // Extract secret-handling block from docker-entrypoint.sh
        const entryContent = fs.readFileSync(path.join(repoRoot, 'docker-entrypoint.sh'), 'utf8');
        const secretBlock = entryContent.slice(
            entryContent.indexOf('if [ -z "$JWT_SECRET"'),
            entryContent.indexOf('# Ensure schema')
        );

        const testScript = path.join(testDir, 'test_secret.sh');
        fs.writeFileSync(testScript, `#!/bin/sh\nset -e\ncd "${testDir.replace(/\\/g, '/')}"\n${secretBlock}\nnode -e "console.log(require('crypto').createHash('sha256').update(process.env.JWT_SECRET).digest('hex'))"\n`);
        fs.chmodSync(testScript, '755');

        function runSecret(secretEnv) {
            const res = cp.spawnSync(bashPath, [testScript], {
                cwd: testDir,
                env: { ...process.env, JWT_SECRET: secretEnv },
                encoding: 'utf8'
            });
            expect(res.status).toBe(0);
            return res.stdout.trim().split(/\r?\n/).pop();
        }

        // Two blank invocations MUST yield the exact same persisted secret
        const emptyHash1 = runSecret('');
        const emptyHash2 = runSecret('');
        expect(emptyHash1).toBe(emptyHash2);

        // Pre-configured invocation preserves explicit secret
        const configuredHash1 = runSecret('test-configured-secret-1234');
        const configuredHash2 = runSecret('test-configured-secret-1234');
        expect(configuredHash1).toBe(configuredHash2);
        expect(emptyHash1).not.toBe(configuredHash1);
    });

    test('entrypoint recovers from interrupted initial setup on restart without reseeding populated installations', () => {
        const testDir = path.join(scratchDir, 'resumable_boot_test');
        fs.mkdirSync(path.join(testDir, 'prisma'), { recursive: true });
        fs.writeFileSync(path.join(testDir, 'prisma', 'schema.prisma'), '// test fixture\n');

        const entryContent = fs.readFileSync(path.join(repoRoot, 'docker-entrypoint.sh'), 'utf8');
        // Adapt container path to testDir
        const adaptedEntry = entryContent.replace('cd /app/server', `cd "${testDir.replace(/\\/g, '/')}"`);
        const entryScript = path.join(testDir, 'entrypoint.sh');
        fs.writeFileSync(entryScript, adaptedEntry);
        fs.chmodSync(entryScript, '755');

        const traceFile = path.join(testDir, 'boot-trace.log');
        const driverScript = path.join(testDir, 'boot-driver.sh');
        fs.writeFileSync(driverScript, `#!/bin/sh
export JWT_SECRET=test-fixed-secret-for-driver
export ALLOW_AUTO_SEED=false ALLOW_PRISMA_DB_PUSH=false
npx() { echo "npx $*" >> "${traceFile.replace(/\\/g, '/')}"; printf 'nonempty-schema' > prisma/dev.db; }
node() {
    echo "node $*" >> "${traceFile.replace(/\\/g, '/')}";
    if [ "$1" = "seed.js" ]; then
        if [ "$FAIL_SEED" = "1" ]; then return 77; fi
        touch "${testDir.replace(/\\/g, '/')}/prisma/.seeded"
        return 0
    fi
    if [ "$1" = "-e" ]; then
        if echo "$2" | grep -q "better-sqlite3"; then
            if [ -f "${testDir.replace(/\\/g, '/')}/prisma/.seeded" ]; then
                echo '{"ok":true,"schemaReady":true,"userCount":1}'
            else
                echo '{"ok":true,"schemaReady":true,"userCount":0}'
            fi
            return 0
        fi
        if echo "$2" | grep -q "userCount"; then
            if [ -f "${testDir.replace(/\\/g, '/')}/prisma/.seeded" ]; then
                echo '1'
            else
                echo '0'
            fi
            return 0
        fi
        if echo "$2" | grep -q "schemaReady"; then
            echo '1'
            return 0
        fi
    fi
    return 0
}
export -f npx node
bash "${entryScript.replace(/\\/g, '/')}"
`);
        fs.chmodSync(driverScript, '755');

        function runDriver(failSeed) {
            return cp.spawnSync(bashPath, [driverScript], {
                cwd: testDir,
                env: { ...process.env, FAIL_SEED: failSeed },
                encoding: 'utf8'
            });
        }

        // Run 1: First installation attempt where seed.js fails (exit 77)
        const first = runDriver('1');
        expect(first.status).toBe(77);
        const firstTrace = fs.readFileSync(traceFile, 'utf8');
        expect(firstTrace).toMatch(/npx prisma db push/);
        expect(firstTrace).toMatch(/node seed\.js/);
        fs.writeFileSync(traceFile, '');

        // Run 2: Container restarts after crash (FAIL_SEED=0)
        // MUST resume and retry seed.js because database was not yet seeded!
        const second = runDriver('0');
        const secondTrace = fs.readFileSync(traceFile, 'utf8');
        expect(secondTrace).toMatch(/node seed\.js/); // Retried seed!
        expect(secondTrace).not.toMatch(/npx prisma db push/); // Did not re-push schema!
        fs.writeFileSync(traceFile, '');

        // Run 3: Subsequent normal restart on already-seeded database
        // MUST NOT re-run seed.js or schema push!
        const third = runDriver('0');
        const thirdTrace = fs.readFileSync(traceFile, 'utf8');
        expect(thirdTrace).not.toMatch(/node seed\.js/); // Skipped seed!
        expect(thirdTrace).not.toMatch(/npx prisma db push/);
    });

    test('docker-entrypoint.sh database inspection fails closed on corrupt or unreadable database', () => {
        const testDir = path.join(scratchDir, 'corrupt_db_test');
        fs.mkdirSync(path.join(testDir, 'prisma'), { recursive: true });

        // Write corrupt garbage to dev.db
        fs.writeFileSync(path.join(testDir, 'prisma', 'dev.db'), 'NOT_A_VALID_SQLITE_DATABASE_HEADER_CORRUPT');

        const entryContent = fs.readFileSync(path.join(repoRoot, 'docker-entrypoint.sh'), 'utf8');
        const adaptedEntry = entryContent
            .replace('cd /app/server', `cd "${testDir.replace(/\\/g, '/')}"`)
            .replace('cp /app/server/.schema-backup/schema.prisma', '# noop')
            .replace('exec node index.js', 'echo "LIMS_STARTED_SUCCESS"')
            .replace(/node scripts\/migrate_[^\n]+/g, '# noop migration');

        const entryScript = path.join(testDir, 'entrypoint.sh');
        fs.writeFileSync(entryScript, adaptedEntry);
        fs.chmodSync(entryScript, '755');

        const res = cp.spawnSync(bashPath, [entryScript], {
            cwd: testDir,
            env: {
                ...process.env,
                JWT_SECRET: 'test-secret',
                NODE_PATH: path.join(repoRoot, 'server', 'node_modules')
            },
            encoding: 'utf8'
        });

        // MUST fail closed with non-zero exit code and fatal error message!
        expect(res.status).not.toBe(0);
        expect(res.stdout + res.stderr).toMatch(/Database inspection failed/i);
        expect(res.stdout).not.toMatch(/LIMS_STARTED_SUCCESS/);
    });

    test('docker-entrypoint.sh database inspection passes cleanly on valid populated database', async () => {
        const testDir = path.join(scratchDir, 'valid_db_inspect_test');
        fs.mkdirSync(path.join(testDir, 'prisma'), { recursive: true });

        const serverDir = path.resolve(__dirname, '..', '..');
        const targetDb = path.join(testDir, 'prisma', 'dev.db');
        // Pin6061301340: generate an actually fresh Prisma shape. A schema-only
        // copy of the installed test DB would inherit its index without receipts.
        const fixture = beforeGuards({ actor: 'system:fixture',
            file: path.resolve(__dirname, '../.tmp', `audit_legacy_bootstrap_${TS}.db`), qcBootstrap: 'CREATE_PRISMA' });
        ownedSchemaDatabases.push(fixture.file);
        require('../../scripts/install_workflow_state_guards').installWorkflowStateGuards({ dbPath: fixture.file, apply: true });
        const calculationDatabase = fixture.file;
        installCalculationReleasePrerequisites(calculationDatabase);
        // The inspection uses a fresh guarded schema, never working specimens.
        const Database = require('better-sqlite3');
        if (fs.existsSync(targetDb)) throw new Error('Owned startup target already exists.');
        const template = new Database(fixture.file, { readonly: true, fileMustExist: true });
        try { await template.backup(targetDb); } finally { template.close(); }
        const db = new Database(targetDb);
        const existing = db.prepare('SELECT count(*) as count FROM User').get();
        if (!existing || existing.count === 0) {
            const now = new Date().toISOString();
            db.prepare('INSERT INTO User (id, username, password, email, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run('u-inspect-test', 'inspectadmin', 'hashedpass', 'inspect@soilfer.local', 'LAB_MANAGER', 1, now, now);
        }
        db.close();
        require('../../scripts/install_result_attempt_links').installResultAttemptLinks({ dbPath: targetDb, apply: true });
        require('../../scripts/install_sample_holds').installSampleHolds({ dbPath: targetDb, apply: true });
        require('../../scripts/install_reference_materials').installReferenceMaterials({ dbPath: targetDb, apply: true });
        require('../../scripts/install_qc_rules').installQcRules({ dbPath: targetDb, apply: true });
        require('../../scripts/install_qc_runs').installQcRuns({ dbPath: targetDb, apply: true });
        require('../../scripts/install_qc_gate_scope').installQcGateScope({ dbPath: targetDb, apply: true });
        require('../../scripts/bootstrap_pt_nonconformity').bootstrapPtNonconformity({ dbPath: targetDb, apply: true });
        require('../../scripts/install_result_equipment_evidence').installResultEquipmentEvidence({ dbPath: targetDb, apply: true });
        require('../../scripts/install_workitem_uniqueness').installWorkItemUniqueness({ dbPath: targetDb, apply: true });
        require('../../scripts/install_work_attempt_contract').installWorkAttemptContract({ dbPath: targetDb, apply: true });
        require('../../scripts/install_work_repeat_contract').installWorkRepeatContract({ dbPath: targetDb, apply: true });
        require('../../scripts/install_reported_value_selections').installReportedValueSelections({ dbPath: targetDb, apply: true });
        require('../../scripts/install_nonconformity_reports').installNonconformityReports({ dbPath: targetDb, apply: true });
        require('../../scripts/install_batch_reagent_lots').installBatchReagentLots({ dbPath: targetDb, apply: true });
        require('../../scripts/install_result_override_requests').installResultOverrideRequests({ dbPath: targetDb, apply: true });
        require('../../scripts/install_cross_check_evaluations').installCrossCheckEvaluations({ dbPath: targetDb, apply: true });
        expect(require('../../scripts/install_sample_amendment_authorisation').installSampleAmendmentAuthorisation({dbPath:targetDb,apply:true}))
            .toMatchObject({classification:'COMPLETE_210',newAmendmentCount:0,newAttemptLinkCount:0,newWithdrawalCount:0,backfilledCount:0});
        require('../../scripts/install_instrument_imports').installInstrumentImports({ dbPath: targetDb, apply: true });
        const hashDb = () => createHash('sha256').update(fs.readFileSync(targetDb)).digest('hex');
        const beforeSha = hashDb();
        fs.writeFileSync(path.join(testDir, 'prisma', '.seed_complete'), 'done');

        const entryContent = fs.readFileSync(path.join(repoRoot, 'docker-entrypoint.sh'), 'utf8');
        const adaptedEntry = entryContent
            .replace('cd /app/server', `cd "${testDir.replace(/\\/g, '/')}"`)
            .replace('cp /app/server/.schema-backup/schema.prisma', '# noop')
            .replace('exec node index.js', 'echo "LIMS_STARTED_SUCCESS"')
            .replace('node scripts/install_workflow_state_guards.js --apply',
                `node "${path.join(serverDir, 'scripts/install_workflow_state_guards.js').replace(/\\/g, '/')}" --apply`)
            .replace('node scripts/install_result_attempt_links.js --apply',
                `node "${path.join(serverDir, 'scripts/install_result_attempt_links.js').replace(/\\/g, '/')}" --apply`)
            .replace('node scripts/install_sample_holds.js --apply',
                `node "${path.join(serverDir, 'scripts/install_sample_holds.js').replace(/\\/g, '/')}" --apply`)
            .replace('node scripts/install_reference_materials.js --apply',
                `node "${path.join(serverDir, 'scripts/install_reference_materials.js').replace(/\\/g, '/')}" --apply`)
            .replace('node scripts/install_qc_rules.js --apply',
                `node "${path.join(serverDir, 'scripts/install_qc_rules.js').replace(/\\/g, '/')}" --apply`)
            .replaceAll('node scripts/install_qc_runs.js',
                `node "${path.join(serverDir, 'scripts/install_qc_runs.js').replace(/\\/g, '/')}"`)
            .replace('node scripts/install_qc_gate_scope.js --db "${DATABASE_PATH:-/app/server/prisma/dev.db}" --apply',
                `node "${path.join(serverDir, 'scripts/install_qc_gate_scope.js').replace(/\\/g, '/')}" --db "\${DATABASE_PATH:-/app/server/prisma/dev.db}" --apply`)
            .replaceAll('node scripts/install_proficiency_evidence.js',
                `node "${path.join(serverDir, 'scripts/install_proficiency_evidence.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/bootstrap_pt_nonconformity.js',
                `node "${path.join(serverDir, 'scripts/bootstrap_pt_nonconformity.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_result_equipment_evidence.js',
                `node "${path.join(serverDir, 'scripts/install_result_equipment_evidence.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_workitem_uniqueness.js',
                `node "${path.join(serverDir, 'scripts/install_workitem_uniqueness.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_work_attempt_contract.js',
                `node "${path.join(serverDir, 'scripts/install_work_attempt_contract.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_work_repeat_contract.js',
                `node "${path.join(serverDir, 'scripts/install_work_repeat_contract.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_reported_value_selections.js',
                `node "${path.join(serverDir, 'scripts/install_reported_value_selections.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_batch_reagent_lots.js',
                `node "${path.join(serverDir, 'scripts/install_batch_reagent_lots.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_result_override_requests.js',
                `node "${path.join(serverDir, 'scripts/install_result_override_requests.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_calculation_templates.js',
                `node "${path.join(serverDir, 'scripts/install_calculation_templates.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_cross_check_evaluations.js',
                `node "${path.join(serverDir, 'scripts/install_cross_check_evaluations.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_sample_amendment_authorisation.js',
                `node "${path.join(serverDir, 'scripts/install_sample_amendment_authorisation.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_instrument_imports.js',
                `node "${path.join(serverDir, 'scripts/install_instrument_imports.js').replace(/\\/g, '/')}"`)
            .replaceAll('node scripts/install_result_raw_input.js',
                `node "${path.join(serverDir, 'scripts/install_result_raw_input.js').replace(/\\/g, '/')}"`)
            .replace(/node scripts\/migrate_[^\n]+/g, '# noop migration');

        const entryScript = path.join(testDir, 'entrypoint.sh');
        fs.writeFileSync(entryScript, adaptedEntry);
        fs.chmodSync(entryScript, '755');

        const res = cp.spawnSync(bashPath, [entryScript], {
            cwd: testDir,
            env: {
                ...process.env,
                JWT_SECRET: 'test-secret',
                DATABASE_PATH: targetDb,
                DATABASE_URL: `file:${targetDb}`,
                NODE_PATH: path.join(repoRoot, 'server', 'node_modules')
            },
            encoding: 'utf8'
        });

        expect(res.status).toBe(0);
        expect(res.stdout).toMatch(/LIMS_STARTED_SUCCESS/);
        expect(res.stdout + res.stderr).not.toMatch(/Database inspection failed/i);
        expect(res.stdout).toContain('"mode": "NO_OP"');
        expect(res.stdout).toContain('"classification": "COMPLETE"');
        expect(res.stdout).toContain('"totalChanges": 0');
        expect(res.stdout).toContain('Installing retained raw input column');
        expect(res.stdout).toContain('"classification": "ALREADY_PRESENT"');
        expect(res.stdout).toContain('850a47806543f1e6587641daa918fe586b6cbb4bfece5a6920132e4b74c593cc');
        expect(res.stdout).toContain('Installing duplicate-marker prerequisite');
        expect(res.stdout).toContain('20261004190000_add_workitem_duplicate_marker');
        expect(res.stdout).toContain('20261004190100_unique_active_workitem');
        expect(res.stdout).toContain('COMPLETE_210');
        expect(hashDb()).toBe(beforeSha);
    });

    test('seed.js recovers from real partial state ({ labs: 1, users: 0 }) and does not duplicate LAB01', () => {
        const Database = require('better-sqlite3');
        const testDbPath = beforeGuards({ actor: 'system:fixture' }).file;
        ownedSchemaDatabases.push(testDbPath);
        const serverDir = path.resolve(__dirname, '..', '..');

        // A fresh schema-only owned fixture starts with no labs/users/settings.
        // The real additive state guards and all foreign keys remain enabled.
        const db = new Database(testDbPath);
        for (const table of ['User', 'Lab', 'SystemSetting']) expect(db.prepare(`SELECT count(*) n FROM ${table}`).get().n).toBe(0);
        db.prepare('INSERT INTO Lab (id, name, code, country, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run('lab-preexisting', 'My Laboratory', 'LAB01', 'INT', 1, new Date().toISOString(), new Date().toISOString());
        db.close();

        // Run seed.js against the partial database
        const res = cp.spawnSync(process.execPath, [path.join(serverDir, 'seed.js')], {
            cwd: serverDir,
            env: {
                ...process.env,
                DATABASE_PATH: testDbPath,
                DEPLOYMENT_MODE: 'local',
                ADMIN_INITIAL_PASSWORD: 'resumed-password-123'
            },
            encoding: 'utf8'
        });

        expect(res.status).toBe(0);
        expect(res.stdout).toMatch(/Using existing default laboratory/);
        expect(res.stdout).toMatch(/Created user: admin/);

        const verifyDb = new Database(testDbPath, { readonly: true });
        const labCount = verifyDb.prepare('SELECT count(*) n FROM Lab').get().n;
        const userCount = verifyDb.prepare('SELECT count(*) n FROM User').get().n;
        const adminUser = verifyDb.prepare('SELECT * FROM User WHERE username=?').get('admin');
        verifyDb.close();

        expect(labCount).toBe(1);
        expect(userCount).toBe(1);
        expect(adminUser.role).toBe('LAB_MANAGER');
        expect(adminUser.labId).toBe('lab-preexisting');
    });

    test('docker compose configuration validates cleanly across local, global, and nginx overlays', () => {
        const envFile = path.join(scratchDir, 'test.env');
        fs.writeFileSync(envFile, 'PORT=3000\nJWT_SECRET=\nNODE_ENV=production\nDEPLOYMENT_MODE=local\nADMIN_INITIAL_PASSWORD=testPass\n');

        // Check if docker CLI exists
        const checkDocker = cp.spawnSync('docker', ['--version'], { encoding: 'utf8' });
        if (checkDocker.error && checkDocker.error.code === 'ENOENT') {
            console.log('NOTICE: Docker executable not found in PATH; skipping compose CLI tests.');
            return;
        }

        // 1. Base compose config
        const baseRes = cp.spawnSync('docker', ['compose', '--env-file', envFile, '-f', path.join(repoRoot, 'docker-compose.yml'), 'config', '--format', 'json'], {
            encoding: 'utf8',
            cwd: repoRoot
        });

        expect(baseRes.status).toBe(0);
        const baseConfig = JSON.parse(baseRes.stdout);
        expect(baseConfig.services.lims).toBeDefined();
        expect(baseConfig.services.lims.image).toMatch(/soilfer-lims/);
        expect(baseConfig.services.lims.environment.DEPLOYMENT_MODE).toBe('local');

        // 2. Global overlay
        const globalRes = cp.spawnSync('docker', [
            'compose', '--env-file', envFile,
            '-f', path.join(repoRoot, 'docker-compose.yml'),
            '-f', path.join(repoRoot, 'docker-compose.global.yml'),
            'config', '--format', 'json'
        ], { encoding: 'utf8', cwd: repoRoot });

        expect(globalRes.status).toBe(0);
        const globalConfig = JSON.parse(globalRes.stdout);
        expect(globalConfig.services.lims.environment.DEPLOYMENT_MODE).toBe('global');

        // 3. NGINX overlay
        const nginxRes = cp.spawnSync('docker', [
            'compose', '--env-file', envFile,
            '-f', path.join(repoRoot, 'docker-compose.yml'),
            '-f', path.join(repoRoot, 'docker-compose.nginx.yml'),
            'config', '--format', 'json'
        ], { encoding: 'utf8', cwd: repoRoot });

        expect(nginxRes.status).toBe(0);
        const nginxConfig = JSON.parse(nginxRes.stdout);
        expect(nginxConfig.services.nginx).toBeDefined();
        expect(nginxConfig.services.lims.environment.DEPLOYMENT_MODE).toBe('local'); // Mode remains local!
    });
});
