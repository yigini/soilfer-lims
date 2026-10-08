const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables independent of working directory:
// 1. process.env (externally supplied, e.g. Docker, CI, process exports) is preserved by dotenv default.
// 2. Project-root .env (canonical location created by setup.sh / .env.example) supplies configuration.
// 3. server/.env (if present) is loaded for backward compatibility without overriding existing variables.
const rootEnv = path.resolve(__dirname, '..', '.env');
const serverEnv = path.resolve(__dirname, '.env');
if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
}
if (fs.existsSync(serverEnv)) {
    dotenv.config({ path: serverEnv });
}
// Direct npm/node startup gets the same fail-closed outcome as Docker, using
// only a read-only gate. No app, scheduler or writable adapter is loaded first.
try {
    const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, 'prisma', 'dev.db');
    const ready = require('./scripts/install_workflow_state_guards').assertWorkflowStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'WORKFLOW_STARTUP_READY', ...ready }));
    const resultsReady = require('./scripts/install_result_attempt_links').assertResultAttemptStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'RESULT_ATTEMPT_STARTUP_READY', ...resultsReady }));
    const holdsReady = require('./scripts/install_sample_holds').assertSampleHoldStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'SAMPLE_HOLD_STARTUP_READY', ...holdsReady }));
    const referencesReady = require('./scripts/install_reference_materials').assertReferenceStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'REFERENCE_STARTUP_READY', ...referencesReady }));
    const qcRulesReady = require('./scripts/install_qc_rules').assertQcRuleStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'QC_RULE_STARTUP_READY', ...qcRulesReady }));
    const qcRunsReady = require('./scripts/install_qc_runs').assertQcRunStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'QC_RUN_STARTUP_READY', ...qcRunsReady }));
    const qcScopeReady = require('./scripts/install_qc_gate_scope').assertQcGateScopeStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'QC_GATE_SCOPE_STARTUP_READY', ...qcScopeReady }));
    const ptReady = require('./scripts/install_proficiency_evidence').assertProficiencyStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'PT_STARTUP_READY', ...ptReady }));
    const equipmentReady = require('./scripts/install_result_equipment_evidence').assertResultEquipmentStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'RESULT_EQUIPMENT_STARTUP_READY', ...equipmentReady }));
    const attemptsReady=require('./scripts/install_work_attempt_contract').assertWorkAttemptStartupReady(dbPath);
    console.log(JSON.stringify({event:'WORK_ATTEMPT_STARTUP_READY',classification:attemptsReady.classification,
        sources:attemptsReady.sources,totalChanges:attemptsReady.totalChanges}));
    const repeatsReady=require('./scripts/install_work_repeat_contract').assertWorkRepeatStartupReady(dbPath);
    console.log(JSON.stringify({event:'WORK_REPEAT_STARTUP_READY',classification:repeatsReady.classification,
        sources:repeatsReady.sources,totalChanges:repeatsReady.totalChanges}));
} catch (error) {
    console.error(JSON.stringify({ error: error.code || 'WORKFLOW_STARTUP_REFUSED', message: error.message,
        nextStep: error.code?.startsWith('QC_GATE_SCOPE_') ? 'Keep the lab stopped and follow docs/audit/2.4-qc-gate.md.'
            : error.code?.startsWith('WORK_REPEAT_') ? 'Keep the lab stopped and follow docs/audit/191-repeat-correction.md.'
            : error.code?.startsWith('WORK_ATTEMPT_') ? 'Keep the lab stopped and follow docs/audit/3.1-work-attempts.md.'
            : error.code?.startsWith('PT_') || error.code?.startsWith('RESULT_EQUIPMENT_') ? 'Keep the lab stopped and follow docs/audit/2.6-qc-audit-pt-equipment.md.'
            : error.code?.startsWith('QC_RUN_') ? 'Keep the lab stopped and follow docs/audit-2.3-normalized-qc-migration.md.'
            : error.code?.startsWith('SAMPLE_HOLD_') ? 'Keep the lab stopped and follow docs/audit/1.6-sample-holds.md.'
            : error.code?.startsWith('REFERENCE_') ? 'Keep the lab stopped and follow docs/audit/2.1-reference-materials.md.'
            : error.code?.startsWith('QC_RULE_') ? 'Keep the lab stopped and follow docs/audit/2.2-qc-rules.md.'
            : 'Keep the lab stopped and follow docs/audit/1.2-state-machine.md.', differences: error.differences || [] }));
    process.exit(1);
}
const http = require('http');
const app = require('./app');
const wsServer = require('./wsServer');
const { startEscalationScheduler } = require('./services/escalationService');

const PORT = process.env.PORT || 3000;

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
wsServer.init(server);

// Issue #111: Ensure Node.js keep-alive timeout exceeds reverse proxy timeout (Apache/Nginx)
// Default Node keepAliveTimeout is 5000ms. If Apache reuses pooled sockets after 5s of inactivity,
// Node resets the connection, causing AH01102 500 error responses on concurrent bursts.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// SD-14: Start background escalation scheduler (MAP-19)
startEscalationScheduler();

server.listen(PORT, () => {
    console.log(`Enterprise Server running on http://localhost:${PORT}`);
});
