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
const { beginReadinessStage, readinessTelemetry } = require('./utils/startupReadinessTelemetry');
const { createStartupReadinessContext } = require('./utils/startupReadinessContext');
const startupContext = createStartupReadinessContext();

// Direct npm/node startup gets the same fail-closed outcome as Docker, using
// only a read-only gate. No app, scheduler or writable adapter is loaded first.
try {
    const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, 'prisma', 'dev.db');
    const readyBegan = beginReadinessStage();
    const ready = require('./scripts/install_workflow_state_guards').assertWorkflowStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({ event: 'WORKFLOW_STARTUP_READY', ...ready , ...readinessTelemetry(readyBegan)}));
    const resultsReadyBegan = beginReadinessStage();
    const resultsReady = require('./scripts/install_result_attempt_links').assertResultAttemptStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({ event: 'RESULT_ATTEMPT_STARTUP_READY', ...resultsReady , ...readinessTelemetry(resultsReadyBegan)}));
    const holdsReadyBegan = beginReadinessStage();
    const holdsReady = require('./scripts/install_sample_holds').assertSampleHoldStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({ event: 'SAMPLE_HOLD_STARTUP_READY', ...holdsReady , ...readinessTelemetry(holdsReadyBegan)}));
    const referencesReadyBegan = beginReadinessStage();
    const referencesReady = require('./scripts/install_reference_materials').assertReferenceStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({ event: 'REFERENCE_STARTUP_READY', ...referencesReady , ...readinessTelemetry(referencesReadyBegan)}));
    const qcRulesReadyBegan = beginReadinessStage();
    const qcRulesReady = require('./scripts/install_qc_rules').assertQcRuleStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({ event: 'QC_RULE_STARTUP_READY', ...qcRulesReady , ...readinessTelemetry(qcRulesReadyBegan)}));
    const qcRunsReadyBegan = beginReadinessStage();
    const qcRunsReady = require('./scripts/install_qc_runs').assertQcRunStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({ event: 'QC_RUN_STARTUP_READY', ...qcRunsReady , ...readinessTelemetry(qcRunsReadyBegan)}));
    const qcScopeReadyBegan = beginReadinessStage();
    const qcScopeReady = require('./scripts/install_qc_gate_scope').assertQcGateScopeStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({ event: 'QC_GATE_SCOPE_STARTUP_READY', ...qcScopeReady , ...readinessTelemetry(qcScopeReadyBegan)}));
    const ptReadyBegan = beginReadinessStage();
    const ptReady = require('./scripts/install_proficiency_evidence').assertProficiencyStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({ event: 'PT_STARTUP_READY', ...ptReady , ...readinessTelemetry(ptReadyBegan)}));
    const ncrReadyBegan = beginReadinessStage();
    const ncrReady = require('./scripts/install_nonconformity_reports').assertNonconformityStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'NCR_STARTUP_READY',classification:ncrReady.classification,sources:ncrReady.sources,totalChanges:ncrReady.totalChanges, ...readinessTelemetry(ncrReadyBegan)}));
    const equipmentReadyBegan = beginReadinessStage();
    const equipmentReady = require('./scripts/install_result_equipment_evidence').assertResultEquipmentStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({ event: 'RESULT_EQUIPMENT_STARTUP_READY', ...equipmentReady , ...readinessTelemetry(equipmentReadyBegan)}));
    const attemptsReadyBegan = beginReadinessStage();
    const attemptsReady=require('./scripts/install_work_attempt_contract').assertWorkAttemptStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'WORK_ATTEMPT_STARTUP_READY',classification:attemptsReady.classification,
        sources:attemptsReady.sources,totalChanges:attemptsReady.totalChanges, ...readinessTelemetry(attemptsReadyBegan)}));
    const repeatsReadyBegan = beginReadinessStage();
    const repeatsReady=require('./scripts/install_work_repeat_contract').assertWorkRepeatStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'WORK_REPEAT_STARTUP_READY',classification:repeatsReady.classification,
        sources:repeatsReady.sources,totalChanges:repeatsReady.totalChanges, ...readinessTelemetry(repeatsReadyBegan)}));
    const selectionsReadyBegan = beginReadinessStage();
    const selectionsReady=require('./scripts/install_reported_value_selections').assertReportedValueStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'REPORTED_VALUE_STARTUP_READY',...selectionsReady, ...readinessTelemetry(selectionsReadyBegan)}));
    const reagentLotsReadyBegan = beginReadinessStage();
    const reagentLotsReady=require('./scripts/install_batch_reagent_lots').assertBatchReagentLotsStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'REAGENT_LOT_STARTUP_READY',...reagentLotsReady, ...readinessTelemetry(reagentLotsReadyBegan)}));
    const overrideRequestsReadyBegan = beginReadinessStage();
    const overrideRequestsReady=require('./scripts/install_result_override_requests').assertResultOverrideRequestsStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'RESULT_OVERRIDE_STARTUP_READY',...overrideRequestsReady, ...readinessTelemetry(overrideRequestsReadyBegan)}));
    const calculationsReadyBegan = beginReadinessStage();
    const calculationsReady=require('./scripts/install_calculation_templates').assertCalculationStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'CALCULATION_STARTUP_READY',...calculationsReady, ...readinessTelemetry(calculationsReadyBegan)}));
    const crossChecksReadyBegan = beginReadinessStage();
    const crossChecksReady=require('./scripts/install_cross_check_evaluations').assertCrossCheckStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'CROSS_CHECK_STARTUP_READY',...crossChecksReady, ...readinessTelemetry(crossChecksReadyBegan)}));
    const amendmentsReadyBegan = beginReadinessStage();
    const amendmentsReady=require('./scripts/install_sample_amendment_authorisation').assertAmendmentStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'AMENDMENT_STARTUP_READY',...amendmentsReady, ...readinessTelemetry(amendmentsReadyBegan)}));
    const revisionsReadyBegan = beginReadinessStage();
    const revisionsReady=require('./scripts/install_report_revisions').assertReportRevisionStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'REPORT_REVISION_STARTUP_READY',...revisionsReady, ...readinessTelemetry(revisionsReadyBegan)}));
    const benchReadyBegan = beginReadinessStage();
    const benchReady=require('./scripts/install_bench_credentials').assertBenchCredentialStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'BENCH_CREDENTIAL_STARTUP_READY',...benchReady, ...readinessTelemetry(benchReadyBegan)}));
    const preparationReadyBegan = beginReadinessStage();
    const preparationReady=require('./scripts/install_preparation_records').assertPreparationRecordStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'PREPARATION_RECORD_STARTUP_READY',...preparationReady, ...readinessTelemetry(preparationReadyBegan)}));
    const importsReadyBegan = beginReadinessStage();
    const importsReady=require('./scripts/install_instrument_imports').assertInstrumentImportStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'INSTRUMENT_IMPORT_STARTUP_READY',...importsReady, ...readinessTelemetry(importsReadyBegan)}));
    const containersReadyBegan = beginReadinessStage();
    const containersReady=require('./scripts/install_sample_containers').assertSampleContainerStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'SAMPLE_CONTAINER_STARTUP_READY',...containersReady, ...readinessTelemetry(containersReadyBegan)}));
    const policyReadyBegan = beginReadinessStage();
    const policyReady=require('./scripts/install_lab_policy_schema').assertLabPolicyStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'LAB_POLICY_STARTUP_READY',...policyReady, ...readinessTelemetry(policyReadyBegan)}));
    const chartsReadyBegan = beginReadinessStage();
    const chartsReady=require('./scripts/install_control_charts').assertControlChartStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'CONTROL_CHART_STARTUP_READY',...chartsReady, ...readinessTelemetry(chartsReadyBegan)}));
    const labelsReadyBegan = beginReadinessStage();
    const labelsReady = require('./scripts/install_label_print_events').assertLabelPrintStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'LABEL_PRINT_STARTUP_READY', ...labelsReady, ...readinessTelemetry(labelsReadyBegan)}));
    const orderReadyBegan = beginReadinessStage();
    const orderReady=require('./scripts/install_order_revisions').assertOrderRevisionStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'ORDER_REVISION_STARTUP_READY',...orderReady, ...readinessTelemetry(orderReadyBegan)}));
    const custodyReadyBegan = beginReadinessStage();
    const custodyReady = require('./scripts/install_sample_custody').assertSampleCustodyStartupReady(dbPath, startupContext);
    console.log(JSON.stringify({event:'SAMPLE_CUSTODY_STARTUP_READY',...custodyReady, ...readinessTelemetry(custodyReadyBegan)}));
} catch (error) {
    console.error(JSON.stringify({ error: error.code || 'WORKFLOW_STARTUP_REFUSED', message: error.message,
        nextStep: error.code?.startsWith('QC_GATE_SCOPE_') ? 'Keep the lab stopped and follow docs/audit/2.4-qc-gate.md.'
            : error.code?.startsWith('CROSS_CHECK_') ? 'Keep the lab stopped and follow docs/audit/201-cross-parameter-checks.md.'
            : error.code?.startsWith('AMENDMENT_') || error.code?.startsWith('REPORT_WITHDRAWAL_') ? 'Keep the lab stopped and follow docs/audit/210-amendment-authorisation.md.'
            : error.code?.startsWith('IMPORT_') ? 'Keep the lab stopped and follow docs/audit/200-instrument-import.md.'
            : error.code?.startsWith('LABEL_PRINT_') ? 'Keep the lab stopped and follow docs/audit/208-labels.md.'
            : error.code?.startsWith('SAMPLE_CONTAINER_') ? 'Keep the lab stopped and follow docs/audit/206-containers-and-aliquots.md.'
            : error.code?.startsWith('CUSTODY_') ? 'Keep the lab stopped and follow docs/audit/207-custody-and-retention.md.'
            : error.code?.startsWith('ORDER_REVISION_') || error.code === 'ORDER_LINE_REQUIRED' ? 'Keep the lab stopped and follow docs/audit/209-order-revisions.md.'
            : error.code?.startsWith('QC_CHART_') || error.code?.startsWith('LAB_POLICY_') ? 'Keep the lab stopped and follow docs/audit/214-control-charts.md.'
            : error.code?.startsWith('OVERRIDE_') ? 'Keep the lab stopped and follow docs/audit/197-value-validation.md.'
            : error.code?.startsWith('CALC_') || error.code?.startsWith('CALIBRATION_') || error.code === 'UNIT_CATALOGUE_CONFLICT' ? 'Keep the lab stopped and follow docs/audit/199-calculation-templates.md.'
            : error.code?.startsWith('REAGENT_LOT_') ? 'Keep the lab stopped and follow docs/audit/194-run-first.md.'
            : error.code?.startsWith('REPORTED_VALUE_') ? 'Keep the lab stopped and follow docs/audit/192-reported-value.md.'
            : error.code?.startsWith('NCR_') ? 'Keep the lab stopped and follow docs/audit/193-nonconformity.md.'
            : error.code?.startsWith('WORK_REPEAT_') ? 'Keep the lab stopped and follow docs/audit/191-repeat-correction.md.'
            : error.code?.startsWith('WORK_ATTEMPT_') ? 'Keep the lab stopped and follow docs/audit/3.1-work-attempts.md.'
            : error.code?.startsWith('PT_') || error.code?.startsWith('RESULT_EQUIPMENT_') ? 'Keep the lab stopped and follow docs/audit/2.6-qc-audit-pt-equipment.md.'
            : error.code?.startsWith('QC_RUN_') ? 'Keep the lab stopped and follow docs/audit-2.3-normalized-qc-migration.md.'
            : error.code?.startsWith('SAMPLE_HOLD_') ? 'Keep the lab stopped and follow docs/audit/1.6-sample-holds.md.'
            : error.code?.startsWith('REFERENCE_') ? 'Keep the lab stopped and follow docs/audit/2.1-reference-materials.md.'
            : error.code?.startsWith('QC_RULE_') ? 'Keep the lab stopped and follow docs/audit/2.2-qc-rules.md.'
            : 'Keep the lab stopped and follow docs/audit/1.2-state-machine.md.', differences: error.differences || [] }));
    startupContext.close();
    process.exit(1);
} finally {
    startupContext.close();
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
