const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { createHash } = require('node:crypto');

// #179 pin 5992389337. This resolves two fixed, digest-bound DDL assets;
// it grants no write authority and never accepts an arbitrary SQL loader.
const WORKFLOW_LOADER = 'services/workflowMigrationSources.js';
const WORKFLOW_LOADER_SHA256 = '0b7f6010cc7b69a03ffe5aceb3c467dd5a718f51d25968e5aba07fcf8aaa1733';
const RESULT_LOADER = 'services/resultAttemptMigrationSource.js';
const RESULT_LOADER_SHA256 = '36658af9e2a6fa817ff4938ad08ac6879ff10a2969acf1a395a68cad5f37a655';
const HOLD_LOADER = 'services/sampleHoldMigrationSource.js';
const HOLD_LOADER_SHA256 = '8092708bf3f0f83111d56b00174a6b9dee9f2d996b7a874ad821801abeb37bb9';
const HOLD_SQL_SHA256 = '5fce16e8bc148e07880fe6afcc7f5aec1c94c319a5c98ddaeaf47450906b06a8';
const RESULT_SQL_SHA256 = 'aac7a1fc8e7a19ea993f6995032812e43ee4887bf0683da446438659061b235d';
const REFERENCE_LOADER = 'services/referenceMaterialMigrationSource.js';
const REFERENCE_LOADER_SHA256 = 'aec02b50c02946f7fb35606524ebb5ced033d43107aa810905fa7c8d4b245ae9';
const REFERENCE_SQL_SHA256 = '5da12ca98c6402002ab2701105eb9e2a51539d4421f53d70c60f47ab98bd51e3';
const QC_RULE_LOADER = 'services/qcRuleMigrationSource.js';
const QC_RULE_LOADER_SHA256 = '222ad51af3fe26ea4bddb9e4d522898857c0ec15f31295c0ce5f81b5dbc487fa';
const QC_RULE_SQL_SHA256 = '4ee7f414ae3e6228faf52fe81d32bde2bdaf6ecb975ca62a438494db42e58b06';
const QC_RUN_LOADER = 'services/qcRunMigrationSource.js';
const QC_RUN_LOADER_SHA256 = '9443bc78374817300000410723c97eb7d0d2f18b9f8e1b2fdfa5704c62149436';
const QC_RUN_SQL_SHA256 = '2f3d7a319d6cbb1fb061092d79e29e03358c28aba9e22190f221df71635e2046';
const QC_SCOPE_LOADER = 'services/qcDispositionScopeMigrationSource.js';
const QC_SCOPE_LOADER_SHA256 = 'bbe45a3b77f03082761bd01807baaaf6c8bb803280b5c9a1d3bc9be5df8762e3';
const QC_SCOPE_SQL_SHA256 = 'fac0023cc90f9d5703ec8d722be55727028c7d24398fbfd4a0aa1cd1bd4fe5bf';
const QC_MEMBERSHIP_LOADER = 'services/qcBracketMembershipMigrationSource.js';
const QC_MEMBERSHIP_LOADER_SHA256 = '40c0af827c4d22b6fce1ee5b770f2c0146f456cfeeae85f9afa4d38f4678439f';
const QC_MEMBERSHIP_SQL_SHA256 = '1bc85113a3b6b7da327265bc7005eb4a1c97855943c599b1fe5ed8b126cf8572';
// #189 additive evidence sources are inspected, never exempted as writers.
const QC_EVIDENCE_SOURCES = Object.freeze([
    // #201/6089928620: inspect the exact additive evidence assets, never exempt writes.
    Object.freeze({ functionName: 'loadCrossCheckMigrationSource', loader: 'services/crossCheckMigrationSource.js',
        loaderSha256: 'a9cbb4f46ca24569593b0e7d84bf2d9ac999b428b89f9d5c050023982587425a',
        directory: '20261010000100_cross_check_evaluation', sqlSha256: '7579e84f62aa8561b4746a6360e83757d067046ad97fcadace05660fb6bf44a4',
        boundary: '-- Contract guards', assets: [{ file: 'fresh-prisma-tables.json', sha256: '97cc1f211adb71056ed3c2d82ea94385d63f812071ba44a57674be24c4905de0' }] }),
    // #210: inspect the two exact additive assets; no workflow writer exception.
    Object.freeze({functionName:'loadSampleAmendmentMigrationSource',loader:'services/sampleAmendmentMigrationSource.js',
        loaderSha256:'592da015bcb5344e4c5d7acd86f45bcd8ce53d88158021aa14bb9b26ed3863a4',
        directory:'20261010000000_sample_amendment_authorisation',sqlSha256:'98f180e1fe6464f0fb8e4f23a8d83832994216ff9f8174e205f75320395727f0',
        oracleSha256:'d738c6f76e59daea9b48824bb0dd39eb0ee390e3548c801229e593d3e3914aa2',
        boundary:'-- Contract guards'}),
    // #200: inspect the fixed additive import source; no writer exemption.
    Object.freeze({ functionName: 'loadInstrumentImportMigrationSource', loader: 'services/instrumentImportMigrationSource.js',
        loaderSha256: '66cd5c07954a7c148e241b790e02e45332ed18a14f03c4a003cb3fa9d88789e6',
        directory: '20261010000100_instrument_import_templates', sqlSha256: '68555c0f9901a48c1c87a7d4ccb8320d0c515e388df094a47865064ee0ad6fc8',
        boundary: '-- Contract guards' }),
    // Inspect both exact #197 assets. Existing writer restrictions are unchanged.
    Object.freeze({functionName:'loadResultOverrideMigrationSource',loader:'services/resultOverrideMigrationSource.js',
        loaderSha256:'f59d8614213b1949216d172fd32589da7f1c733c2a63ae2b23a18f41f8365026',
        directory:'20261009000300_result_override_requests',sqlSha256:'35ff44f0bd6b7b61289da296f1929d63a66f1c613d62836100923cd19e69bba9',
        boundary:'-- Contract guards'}),
    // #199: inspect the exact additive source; no runtime writer exemption.
    Object.freeze({ functionName: 'loadCalculationTemplateMigrationSource', loader: 'services/calculationTemplateMigrationSource.js',
        loaderSha256: '25e9302c060d9ffd3a7ed73f1497232e3a04e448201022f5fca373afbb865cbb',
        directory: '20261009000400_calculation_templates', sqlSha256: '84f50f90aaa69f96e8b025b4b5932eb374c26900c1470919025ae4c7bf9c3da8',
        boundary: '-- Contract guards' }),
    // #272 pin6087372517: inspect only the unchanged rawInput additive DDL.
    Object.freeze({ functionName: 'loadResultRawInputMigrationSource', loader: 'services/resultRawInputMigrationSource.js',
        loaderSha256: '9b421ca380840aad87482d52f1f681c861ee0d536016e21a755d488cca090b56',
        directory: '20261004064500_add_result_raw_input',
        sqlSha256: '850a47806543f1e6587641daa918fe586b6cbb4bfece5a6920132e4b74c593cc', wholeSql: true }),
    // Inspect the exact #192 additive DDL; this grants no writer exception.
    Object.freeze({functionName:'loadReportedValueMigrationSource',loader:'services/reportedValueMigrationSource.js',
        loaderSha256:'4a8776908a58c7f07b858f8a80e0e1b182a6409cf2c2b8171704fea8792bb2ec',
        directory:'20261009000100_reported_value_selection',sqlSha256:'52b4df85d07ef6f63b35249e317037b64450ba718fda72c0a9e4df946cb628f7',
        boundary:'-- INSTALLER_GUARDS_AFTER_SCHEMA'}),
    // #193 pin6075820954: inspect the exact additive source; no writer exemption.
    Object.freeze({ functionName: 'loadNonconformityMigrationSource', loader: 'services/nonconformityMigrationSource.js',
        loaderSha256: '0270b9f62a0c9d92d5b6cbe718c5856956f44efcfcc6f6fd11dab608675fdc32',
        directory: '20261009000100_nonconformity_reports', sqlSha256: '3b52e666a829449062b700948d9ccb6ccedb562b631509590f9a8b7cc8b94c47' }),
    // #194 pin6072013517: inspect the exact additive link DDL; no writer exemption.
    Object.freeze({ functionName: 'loadBatchReagentLotMigrationSource', loader: 'services/batchReagentLotMigrationSource.js',
        loaderSha256: '1b2a0ebf0e253063e9c3c7c923132c269f6c276aa40977e83fa1ec96212c66db',
        directory: '20261009000200_batch_reagent_lots', sqlSha256: '6e409e753d9142381a668352be82ca4981e41847914f868cdacc32b7729cb580' }),
    // #191 pin6067875897: inspect the independently byte-bound successor DDL.
    // Existing sources and writer restrictions retain their exact behaviour.
    Object.freeze({ functionName: 'loadWorkRepeatMigrationSource', loader: 'services/workRepeatMigrationSource.js',
        loaderSha256: '65ee6f9f42e45adbd2e66ae34cf04bcba09a40bc251dd411b3c948ab9a7d7e23',
        directory: '20261008000200_repeat_correction_contract', sqlSha256: '600a4d92ef55c91ffcf6f308a14e2591f929ac6299dc0818961a20225771c7dd',
        boundary: '-- INSTALLER_GUARDS_AFTER_SCHEMA' }),
    Object.freeze({ functionName: 'loadProficiencyMigrationSource', loader: 'services/proficiencyMigrationSource.js',
        loaderSha256: 'e4210caee7aa209d3fdc438b268d72e0728eb6b3a7a2ab102e4b9c8eedfdea0f',
        directory: '20261007000300_proficiency_evidence', sqlSha256: 'bab161fb91e649a33454086aff12eca8ad0b56d16b9f5f47c278a7c20e4fc77a' }),
    Object.freeze({ functionName: 'loadResultEquipmentMigrationSource', loader: 'services/resultEquipmentMigrationSource.js',
        loaderSha256: '4b5a2ea2ef7ee02da46336efaa495520f93cecf9056fa91fdef78b30172acad5',
        directory: '20261007000400_result_equipment_evidence', sqlSha256: 'bd409a6e5d4d8aea357991450025601d73c4c4729cb46473d847c17cb66319d4' }),
    // #190 pin6057064901: inspect both byte-bound assets; no writer exception.
    Object.freeze({ functionName: 'loadWorkAttemptMigrationSource', loader: 'services/workAttemptMigrationSource.js',
        loaderSha256: '4f3012693c7f764d3c0cb09fc0b4235c63cd5525b50b6656351a58c68dca6cd4',
        directory: '20261008000100_work_attempt_contract', sqlSha256: '7e7d5679c9aeeea45ac3c2bac09e4db31dd15b52fe37c743080aa0e3473c8fe2',
        boundary: '-- INSTALLER_GUARDS_AFTER_BACKFILL' }),
    // Pins6061135570/6061301340: inspect the two unchanged #178 sources.
    Object.freeze({ functionName: 'loadWorkItemDuplicateMarkerSource', loader: 'services/workItemUniquenessMigrationSource.js',
        loaderSha256: '0d0b17d96c602d69514b9ed38956553ea4c9969726f2a6cafd9b61b7daf689c3',
        directory: '20261004190000_add_workitem_duplicate_marker',
        sqlSha256: '80278c2d318bc47fa92746015ec278a204a7ff08a9e36d24faca0a56ef05fa1e', wholeSql: true }),
    Object.freeze({ functionName: 'loadActiveWorkItemIndexSource', loader: 'services/workItemUniquenessMigrationSource.js',
        loaderSha256: '0d0b17d96c602d69514b9ed38956553ea4c9969726f2a6cafd9b61b7daf689c3',
        directory: '20261004190100_unique_active_workitem',
        sqlSha256: 'a6e1cf6a26319954e35f4008bc4d18e904014f086db0e31d88e42948fac6556e', wholeSql: true })
]);
const WORKFLOW_SOURCES = Object.freeze({
    evidence: { directory: '20261005000000_workflow_state_evidence', sha256: 'ae3accea0c276aab9ea3ed443b44d89ac05e52ef38a39345aa33e8744f019552' },
    guards: { directory: '20261005000100_workflow_state_guards', sha256: '84921ef45fa8609621b38908de5261d716820f2135f2dde1b9a20fafa6fc81ed' }
});
// #179 pin 5993219622. This is reported inventory, not a writer/helper
// exception. A byte change restores failing embedded-write findings.
const deferredSources = Object.freeze([Object.freeze({
    path: 'server/scripts/rehearsal_docker_boundary.cjs',
    sha256: 'c215311a252b83fb95dcf410d4e9c9bc79c24864ca782123d19631472b226f32',
    reason: '#146 synthetic Docker fault adapter; deferred, see #245'
})]);

const mutations = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'save', 'saveMany', 'bulkUpdate', 'delete', 'deleteMany']);
const sqlMethods = new Set(['prepare', 'exec', 'execute', 'pragma', '$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);
const workflowModels = new Map([['sample', 'Sample'], ['samples', 'Sample'], ['workItem', 'WorkItem'], ['workItems', 'WorkItem'], ['result', 'Result'], ['results', 'Result']]);
const union = sets => [...new Set(sets.flat())];
// Pin6059042857: positive composite setup is confined to these two tests.
// This registry grants no direct Result/WorkItem/SQL writer exemption.
const COMPOSITE_FIXTURE = Object.freeze({
    file: 'tests/helpers/workAttemptFixtures.js', exportName: 'createCompositeTextureExecutionFixture',
    caller: 'tests/contracts/audit_0_3_publication.test.js',
    tests: Object.freeze([
        'composite texture governs sand, silt, clay and texture without duplicating values',
        'RETURN of composite texture invalidates all four current parameters'
    ])
});
// #191 pin6069938801: explicit result sets use one owned execution. Only
// these inventoried tests may import this export; no writer is exempted.
const RESULT_SET_FIXTURE = Object.freeze({
    exportName: 'createExecutionResultsFixture',
    callers: Object.freeze([
        'tests/contracts/audit_0_10_current_result_views.test.js',
        'tests/contracts/audit_0_11_workbench_queue.test.js',
        'tests/contracts/audit_1_4_uuid_transactions.test.js',
        'tests/contracts/audit_1_5_result_writes.test.js',
        'tests/contracts/audit_3_2_repeat_commands.test.js',
        // #210 pin6094281140: the linked accepted-parent replica acceptance
        // test uses this existing owned execution factory, with no new export.
        'tests/contracts/audit_6_1_first_fill.test.js',
        'tests/contracts/nsis_v2_exchange.test.js',
        'tests/contracts/qc_disposition_release_gate.test.js'
    ])
});
// #190 pin6057064901: one byte-bound export, four exact callers. This is a
// fixture authority with an enforced import boundary, never a file exemption.
const ATTEMPT_FIXTURE = Object.freeze({
    file: 'tests/helpers/workAttemptHistoricalFixtures.js', exportName: 'createPre190AttemptFixture',
    sha256: 'ec972abe235214a89c84f6cc2f880286ea3e5cca075338d659bda4a8bbb74aec',
    ddl: 'tests/helpers/fixtures/pre190_full_application_schema.sql',
    ddlSha256: 'e2496a65a9c607e80a82924ff7ed6a4033d1da05fedb907c83dd0918f022923b',
    callers: Object.freeze({
        'tests/contracts/audit_3_1_attempt_backfill_plan.test.js': 'Historical matching and refusal.',
        'tests/contracts/audit_3_1_attempt_install.test.js': 'Atomic migration preservation.',
        'tests/contracts/audit_3_1_attempt_sql_guards.test.js': 'Legacy setup before actual guard probes.',
        'tests/contracts/audit_1_2_spectral_state.test.js': 'One named orphan-refusal rehearsal.'
    }),
    orphanTest: 'a literal pre-190 measured orphan refuses the installer and COMPLETE startup without writes'
});
// #199 pin6088661994: one digest-bound factory/export, one exact caller.
const CALCULATION_FIXTURE = Object.freeze({
    file: 'tests/helpers/calculationHistoricalFixture.js', exportName: 'createPre199CalculationFixture',
    sha256: 'c30a45823719903ffcb0a95326af62955374a5ef58a9ef7b846fc0545b6585ff',
    ddl: 'tests/helpers/fixtures/pre199_full_application_schema.sql',
    ddlSha256: '33f558c18a0b47c806989e6b83eca2ce15923df9c27caf5036cbe11c4420b114',
    caller: 'tests/contracts/audit_4_6_calculation_install.test.js'
 });
// #162 closed-fixture precedent: schema-only, one digest-bound export and caller.
const INSTRUMENT_IMPORT_FIXTURE = Object.freeze({
    file: 'tests/helpers/instrumentImportHistoricalFixture.js', exportName: 'createPre200ImportSchemaFixture',
    sha256: 'efb2f9692ca26a95b410297ccd26eb16ac89b0c3804bcf7e52115b43a6744f0a',
    ddl: 'tests/helpers/fixtures/pre200_full_application_schema.sql',
    ddlSha256: 'c49761af3bab4bc8b822bc94f4f2193c8f3f780b7da6c715fe5a8a424af70aee',
    caller: 'tests/contracts/audit_4_7_instrument_import_install.test.js'
});
// #199 pins6089156077/6090475511: catalogue prerequisites and the real installer only.
const CALCULATION_PREREQUISITES = Object.freeze({
    file: 'tests/helpers/calculationReleasePrerequisites.js', exportName: 'installCalculationReleasePrerequisites',
    sha256: 'c8dcb032ed0a8b8d0cc206bdefb29ccb10dc8a9b4e89926628e20df9ead31e04',
    callers: ['tests/helpers/qcGateFixture.js', 'tests/helpers/normalizedQcFixture.js', 'tests/helpers/repeatQcPredecessors.js',
        'tests/contracts/audit_2_3_native_runs.test.js', 'tests/contracts/audit_1_2_guard_installer.test.js',
        'tests/contracts/deployment_readiness_bootstrap.test.js']
});
// #272 pin6087435363: one closed, no-argument baseline factory and caller.
const RAW_INPUT_FIXTURE = Object.freeze({
    file: 'tests/helpers/rawInputHistoricalFixture.js', exportName: 'createRawInputSupportedBaselineFixture',
    sha256: '2d2e926605ee61d8bf62c8714feea483b3cf7b69368f53b04a8e727c99f2c2b7',
    ddl: 'tests/helpers/fixtures/raw_input_supported_baseline.sql',
    ddlSha256: '6fce034bc43633d55431423ccad8a0e1e81dcdc98ba9b4174c112bef3e672983',
    caller: 'tests/contracts/audit_1_5_raw_input_install.test.js'
});
const CROSS_CHECK_FIXTURE = Object.freeze({
    file: 'tests/helpers/crossCheckHistoricalFixture.js', exportName: 'createPre201CrossCheckFixture',
    sha256: '0ff873e55ee7ed52725eb30c5b7a58d2038fac6e6742201f2cc581939b79dbf2',
    ddl: 'tests/helpers/fixtures/pre201_full_application_schema.sql',
    ddlSha256: '6ae0cc1d26dc3ba301d435d3f332d432a9765c3d30b7fd0725aa119db6f8f622',
    caller: 'tests/contracts/audit_4_8_cross_check_install.test.js'
});
// #210 working agreement6089928620: same closed factory precedent6088661994.
const AMENDMENT_FIXTURE = Object.freeze({
    file: 'tests/helpers/sampleAmendmentHistoricalFixture.js', exportName: 'createPre210AmendmentFixture',
    sha256: 'cd04b289677dead115fa15d86801687a046607302c7ee0603a0f85e9e2ddb1d3',
    ddl: 'tests/helpers/fixtures/pre210_full_application_schema.sql',
    ddlSha256: '6ae0cc1d26dc3ba301d435d3f332d432a9765c3d30b7fd0725aa119db6f8f622',
    caller: 'tests/contracts/audit_6_1_amendment_install.test.js'
});
// Review6095648270: additional literal from main after #201; old binding retained.
const AMENDMENT_MAIN_FIXTURE = Object.freeze({
    file: 'tests/helpers/sampleAmendmentMainHistoricalFixture.js', exportName: 'createPre210After201Fixture',
    sha256: '774f2b135451ef04580be6cef0e566f7c3cdf2185ceab6e6b422d1d06ed6fec6',
    ddl: 'tests/helpers/fixtures/pre210_after201_full_application_schema.sql',
    ddlSha256: 'b7de680237c07ff2454ed27afcc95481ddb45cc24cd80ade943b88291d9ca397',
    caller: 'tests/contracts/audit_6_1_amendment_install.test.js'
});

function scanSource(source, filename, exceptions = []) {
    const violations = [];
    const report = (node, code, detail) => violations.push({ file: filename, line: node?.loc?.start?.line || node?.loc?.line || 1, code, detail });
    let validAttemptFixture = false;
    let validCalculationFixture = false;
    let validInstrumentImportFixture = false;
    if (filename === INSTRUMENT_IMPORT_FIXTURE.file) {
        try {
            validInstrumentImportFixture = createHash('sha256').update(source).digest('hex') === INSTRUMENT_IMPORT_FIXTURE.sha256 &&
                createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', INSTRUMENT_IMPORT_FIXTURE.ddl))).digest('hex') === INSTRUMENT_IMPORT_FIXTURE.ddlSha256;
        } catch { validInstrumentImportFixture = false; }
        if (!validInstrumentImportFixture) report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The pre-200 schema factory or literal DDL differs.');
    }
    if (filename === CALCULATION_PREREQUISITES.file && createHash('sha256').update(source).digest('hex') !== CALCULATION_PREREQUISITES.sha256)
        report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The pinned calculation prerequisite helper differs.');
    if (filename === CALCULATION_FIXTURE.file) {
        try {
            validCalculationFixture = createHash('sha256').update(source).digest('hex') === CALCULATION_FIXTURE.sha256 &&
                createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', CALCULATION_FIXTURE.ddl))).digest('hex') === CALCULATION_FIXTURE.ddlSha256;
        } catch { validCalculationFixture = false; }
        if (!validCalculationFixture) report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The pinned #199 factory or pre-199 DDL digest differs.');
    }
    let validRawInputFixture = false;
    let validCrossCheckFixture = false;
    if (filename === CROSS_CHECK_FIXTURE.file) {
        try {
            validCrossCheckFixture = createHash('sha256').update(source).digest('hex') === CROSS_CHECK_FIXTURE.sha256 &&
                createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', CROSS_CHECK_FIXTURE.ddl))).digest('hex') === CROSS_CHECK_FIXTURE.ddlSha256;
        } catch { validCrossCheckFixture = false; }
        if (!validCrossCheckFixture) report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The closed #201 factory or full pre-201 DDL differs.');
    }
    let validAmendmentFixture = false;
    if (filename === AMENDMENT_FIXTURE.file) {
        try {
            validAmendmentFixture = createHash('sha256').update(source).digest('hex') === AMENDMENT_FIXTURE.sha256 &&
                createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', AMENDMENT_FIXTURE.ddl))).digest('hex') === AMENDMENT_FIXTURE.ddlSha256;
        } catch { validAmendmentFixture = false; }
        if (!validAmendmentFixture) report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The closed #210 factory or pre-210 DDL digest differs.');
    }
    let validAmendmentMainFixture = false;
    if (filename === AMENDMENT_MAIN_FIXTURE.file) {
        try {
            validAmendmentMainFixture = createHash('sha256').update(source).digest('hex') === AMENDMENT_MAIN_FIXTURE.sha256 &&
                createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', AMENDMENT_MAIN_FIXTURE.ddl))).digest('hex') === AMENDMENT_MAIN_FIXTURE.ddlSha256;
        } catch { validAmendmentMainFixture = false; }
        if (!validAmendmentMainFixture) report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The closed #210 current-main factory or DDL digest differs.');
    }
    if (filename === RAW_INPUT_FIXTURE.file) {
        try {
            validRawInputFixture = createHash('sha256').update(source).digest('hex') === RAW_INPUT_FIXTURE.sha256 &&
                createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', RAW_INPUT_FIXTURE.ddl))).digest('hex') === RAW_INPUT_FIXTURE.ddlSha256;
        } catch { validRawInputFixture = false; }
        if (!validRawInputFixture) report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The pinned #272 factory or supported-baseline DDL digest differs.');
    }
    if (filename === ATTEMPT_FIXTURE.file) {
        try {
            validAttemptFixture = createHash('sha256').update(source).digest('hex') === ATTEMPT_FIXTURE.sha256 &&
                createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', ATTEMPT_FIXTURE.ddl))).digest('hex') === ATTEMPT_FIXTURE.ddlSha256;
        } catch { validAttemptFixture = false; }
        if (!validAttemptFixture) report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The pinned #190 factory or pre-190 DDL digest differs.');
    }
    const sqlTable = '(?:["`\\[]?\\w+["`\\]]?\\s*\\.\\s*)?["`\\[]?(?:Sample|WorkItem)(?:["`\\]]|\\b)';
    const rawWrite = text => new RegExp('\\b(?:INSERT\\s+(?:OR\\s+\\w+\\s+)?INTO|REPLACE\\s+INTO|DELETE\\s+FROM)\\s+' + sqlTable, 'i').test(text) ||
        [...text.matchAll(new RegExp('\\bUPDATE(?:\\s+OR\\s+\\w+)?\\s+' + sqlTable + '\\s+SET\\s+([\\s\\S]*?)(?=\\bWHERE\\b|;|$)', 'gi'))]
            .some(match => /(?:^|,)\s*["`\[]?status["`\]]?\s*=|<unknown>/i.test(match[1])) ||
        (/\b(?:INSERT\s+INTO|UPDATE)\s+<unknown>/i.test(text));
    const rawResultCreate = text => /\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|REPLACE\s+INTO)\s+(?:["`\[]?\w+["`\]]?\s*\.\s*)?["`\[]?Result(?:["`\]]|\b)/i.test(text);
    const rawCacheWrite = text => [...text.matchAll(/\bUPDATE(?:\s+OR\s+\w+)?\s+(?:["`\[]?\w+["`\]]?\s*\.\s*)?["`\[]?WorkItem(?:["`\]]|\b)\s+SET\s+([\s\S]*?)(?=\bWHERE\b|;|$)/gi)]
        .some(match => /(?:^|,)\s*["`\[]?result["`\]]?\s*=/i.test(match[1]));
    const disabling = text => /\bDROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?["`\[]?(?:Sample_status_(?:insert|update)_guard|WorkItem_status_(?:insert|update)_guard|Batch_status_(?:insert|update)_guard|ReviewDecision_decision_(?:insert_guard|immutable)|ResultEvidenceEvent_(?:insert_guard|update_immutable|delete_immutable)|Result_attempt_(?:insert|update)_guard|WorkAttempt_result_reference_guard)\b|\bPRAGMA\s+(?:foreign_keys|recursive_triggers)\s*=\s*(?:OFF|0)\b/i.test(text) ||
        (exceptions.some(entry => entry.file === filename) && /\bDROP\s+TRIGGER\b|db\s+push\s+--accept-data-loss/i.test(text));
    if (!/\.(?:js|cjs|mjs)$/.test(filename)) {
        if (rawWrite(source)) report(null, 'RAW_WORKFLOW_SQL', 'Sample/WorkItem SQL write outside the central authority.');
        if (rawResultCreate(source) || rawCacheWrite(source)) report(null, 'RAW_RESULT_SQL', 'Result creation/cache write outside resultWriteService.');
        if (disabling(source)) report(null, 'WORKFLOW_GUARD_DISABLED', 'Workflow enforcement cannot be disabled.');
        return violations;
    }
    let ast;
    try { ast = parser.parse(source, { sourceType: 'unambiguous', allowReturnOutsideFunction: true, plugins: ['jsx'] }); }
    catch (error) { report(error, 'SOURCE_PARSE_FAILED', error.message); return violations; }
    const exportedNames = new Set();
    traverse(ast, { AssignmentExpression(p) {
        const left = p.node.left;
        if (left.type === 'MemberExpression' && left.object.name === 'module' && left.property.name === 'exports' && p.get('right').isObjectExpression()) {
            for (const property of p.node.right.properties) if (property.type === 'ObjectProperty' && property.value.type === 'Identifier' &&
                (property.key.name || property.key.value) === property.value.name) exportedNames.add(property.value.name);
        }
    } });

    function bindingValue(p, seen) {
        const binding = p.scope.getBinding(p.node.name);
        if (!binding || seen.has(binding)) return [];
        const next = new Set([...seen, binding]);
        const declaration = binding.path;
        if (declaration.isVariableDeclarator()) {
            const init = declaration.get('init');
            if (!init.node) return [];
            if (declaration.get('id').isObjectPattern()) {
                const property = declaration.get('id.properties').find(prop => prop.get('value')?.node?.name === p.node.name);
                return property ? [{ path: init, property: property.node.key.name || property.node.key.value, seen: next }] : [];
            }
            return [{ path: init, seen: next }, ...binding.constantViolations.filter(v => v.isAssignmentExpression())
                .map(v => ({ path: v.get('right'), seen: next }))];
        }
        return [];
    }
    function strings(p, seen = new Set()) {
        if (!p?.node) return ['<unknown>'];
        const resolvedMigration = migrationSql(p);
        if (resolvedMigration !== null) return [resolvedMigration];
        if (p.isStringLiteral() || p.isNumericLiteral()) return [String(p.node.value)];
        if (p.isIdentifier()) {
            if (p.node.name === '__dirname' && !p.scope.getBinding('__dirname')) return [path.dirname(path.resolve(__dirname, '../..', filename))];
            const values = bindingValue(p, seen);
            return values.length ? union(values.map(v => v.property ? ['<unknown>'] : strings(v.path, v.seen))) : ['<unknown>'];
        }
        if (p.isConditionalExpression()) return union([strings(p.get('consequent'), seen), strings(p.get('alternate'), seen)]);
        if (p.isBinaryExpression({ operator: '+' })) return strings(p.get('left'), seen).flatMap(left => strings(p.get('right'), seen).map(right => left + right)).slice(0, 32);
        if (p.isTemplateLiteral()) {
            let values = [''];
            for (let i = 0; i < p.node.quasis.length; i++) {
                values = values.map(value => value + p.node.quasis[i].value.cooked);
                if (i < p.node.expressions.length) values = values.flatMap(value => strings(p.get(`expressions.${i}`), seen).map(expression => value + expression)).slice(0, 32);
            }
            return values;
        }
        if (p.isArrayExpression()) return union(p.get('elements').map(element => strings(element, seen)));
        if (p.isCallExpression() && p.get('callee').isMemberExpression() && p.get('callee.object').isIdentifier({ name: 'path' }) &&
            ['resolve', 'join'].includes(p.node.callee.property.name)) {
            return [p.get('arguments').map(argument => strings(argument, seen).join('|')).join('/')];
        }
        if (nodeFsRead(p)) {
            const candidates = strings(p.get('arguments.0'), seen), serverRoot = path.resolve(__dirname, '../..');
            if (candidates.some(file => file.includes('<unknown>') || !path.isAbsolute(file) || !file.endsWith('.sql') ||
                path.relative(serverRoot, path.resolve(file)).startsWith('..') || !fs.existsSync(file))) return ['<unknown>'];
            // Inspect literal checked-in SQL rather than exempting its caller.
            // Loaded workflow writes and disabled guards are still violations.
            return candidates.map(file => fs.readFileSync(file, 'utf8'));
        }
        return ['<unknown>'];
    }
    let validatedSources;
    function verifiedSources() {
        if (validatedSources !== undefined) return validatedSources;
        validatedSources = null;
        const root = path.resolve(__dirname, '../..'), loaderFile = path.join(root, WORKFLOW_LOADER);
        try {
            const bytes = fs.readFileSync(loaderFile);
            if (createHash('sha256').update(bytes).digest('hex') !== WORKFLOW_LOADER_SHA256) return null;
            const loaderAst = parser.parse(bytes.toString('utf8'), { sourceType: 'unambiguous' });
            const declaration = loaderAst.program.body.filter(node => node.type === 'VariableDeclaration')
                .flatMap(node => node.declarations).find(node => node.id.name === 'SOURCES');
            const registry = declaration?.init?.arguments?.[0];
            if (registry?.type !== 'ObjectExpression' || registry.properties.length !== 2) return null;
            for (const property of registry.properties) {
                const key = property.key.name, wanted = WORKFLOW_SOURCES[key];
                const definition = property.value.arguments?.[0];
                if (!wanted || definition?.type !== 'ObjectExpression' || definition.properties.length !== 2 || property.computed) return null;
                const values = Object.fromEntries(definition.properties.map(item => [item.key.name, item.value.value]));
                if (JSON.stringify(values) !== JSON.stringify(wanted)) return null;
            }
            const loaded = {};
            for (const [key, definition] of Object.entries(WORKFLOW_SOURCES)) {
                const sqlBytes = fs.readFileSync(path.join(root, 'prisma/migrations', definition.directory, 'migration.sql'));
                if (createHash('sha256').update(sqlBytes).digest('hex') !== definition.sha256) return null;
                const sql = sqlBytes.toString('utf8');
                if (/\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE\s+["`\[]?\w+["`\]]?\s+SET|DELETE\s+FROM|DROP\s+TRIGGER|ATTACH)\b|\bPRAGMA\s+(?:foreign_keys|ignore_check_constraints|writable_schema)\b/i.test(sql)) return null;
                loaded[key] = sql;
            }
            validatedSources = loaded;
        } catch { return null; }
        return validatedSources;
    }
    function sourceFunction(p, name) {
        if (!p?.isIdentifier({ name })) return false;
        const binding = p.scope.getBinding(name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return false;
        const declaration = binding.path, id = declaration.get('id'), init = declaration.get('init');
        if (!id.isObjectPattern() || !init.isCallExpression() || !init.get('callee').isIdentifier({ name: 'require' }) || init.scope.getBinding('require')) return false;
        const property = id.get('properties').find(item => item.isObjectProperty() && !item.node.computed &&
            item.node.key.name === name && item.get('value').isIdentifier({ name }));
        if (!property || init.node.arguments.length !== 1 || !init.get('arguments.0').isStringLiteral()) return false;
        const root = path.resolve(__dirname, '../..');
        let literal = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, WORKFLOW_LOADER)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!literal.startsWith('.')) literal = `./${literal}`;
        return init.node.arguments[0].value === literal;
    }
    function sourceObject(p) {
        if (p?.isCallExpression()) return p.node.arguments.length === 0 && sourceFunction(p.get('callee'), 'loadWorkflowMigrationSources');
        if (!p?.isIdentifier()) return false;
        const binding = p.scope.getBinding(p.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator() ||
            !binding.path.get('id').isIdentifier() || !binding.path.get('init').isCallExpression() || !sourceObject(binding.path.get('init'))) return false;
        return binding.referencePaths.every(reference => {
            let end = reference;
            const members = [];
            while (end.parentPath?.isMemberExpression() && end.parentPath.get('object').node === end.node) {
                if (end.parentPath.node.computed) return false;
                end = end.parentPath; members.push(end.node.property.name);
            }
            // The object or one of its objects cannot be aliased, spread or
            // passed to another function. Its immutable scalar fields may be read.
            if (members.length < 2 || !['evidence', 'guards'].includes(members[0]) ||
                !['sql', 'sha256', 'directory', 'file'].includes(members[1]) ||
                members.slice(2).some(name => !['matchAll', 'indexOf', 'slice'].includes(name))) return false;
            return !(end.parentPath?.isAssignmentExpression() && end.parentPath.get('left').node === end.node) &&
                !end.parentPath?.isUpdateExpression() && !(end.parentPath?.isUnaryExpression({ operator: 'delete' }));
        });
    }
    function migrationSql(p) {
        const qcEvidenceSql = qcEvidenceMigrationSql(p);
        if (qcEvidenceSql !== null) return qcEvidenceSql;
        const holdSql = holdMigrationSql(p);
        if (holdSql !== null) return holdSql;
        const referenceSql = referenceMigrationSql(p);
        if (referenceSql !== null) return referenceSql;
        const qcRuleSql = referenceMigrationSql(p, true);
        if (qcRuleSql !== null) return qcRuleSql;
        const qcRunSql = referenceMigrationSql(p, false, true);
        if (qcRunSql !== null) return qcRunSql;
        const qcScopeSql = referenceMigrationSql(p, false, false, true);
        if (qcScopeSql !== null) return qcScopeSql;
        const qcMembershipSql = referenceMigrationSql(p, false, false, false, true);
        if (qcMembershipSql !== null) return qcMembershipSql;
        const resultSql = resultMigrationSql(p);
        if (resultSql !== null) return resultSql;
        if (p?.isCallExpression() && sourceFunction(p.get('callee'), 'evidenceCreates') && p.node.arguments.length === 1) {
            const argument = p.get('arguments.0');
            if (!argument.isMemberExpression() || argument.node.computed || argument.node.property.name !== 'sql' ||
                !argument.get('object').isMemberExpression() || argument.node.object.computed || argument.node.object.property.name !== 'evidence') return null;
            const sql = migrationSql(argument), sliced = sql?.slice(sql.indexOf('CREATE TABLE'));
            if (!sliced || sliced.split(';').filter(statement => statement.trim()).some(statement => !/^\s*CREATE (?:TABLE|INDEX)\b/.test(statement))) return null;
            return sliced;
        }
        if (!p?.isMemberExpression() || p.node.computed || p.node.property.name !== 'sql') return null;
        const member = p.get('object');
        if (!member.isMemberExpression() || member.node.computed || !Object.hasOwn(WORKFLOW_SOURCES, member.node.property.name) || !sourceObject(member.get('object'))) return null;
        return verifiedSources()?.[member.node.property.name] || null;
    }
    function resultMigrationSql(p) {
        if (!p?.isMemberExpression() || p.node.computed || !['sql', 'guardsSql'].includes(p.node.property.name)) return null;
        const object = p.get('object');
        if (!object.isIdentifier()) return null;
        const binding = object.scope.getBinding(object.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return null;
        const init = binding.path.get('init');
        if (!init.isCallExpression() || init.node.arguments.length || !init.get('callee').isIdentifier({ name: 'loadResultAttemptMigrationSource' })) return null;
        const loaderBinding = init.scope.getBinding('loadResultAttemptMigrationSource');
        const declaration = loaderBinding?.path;
        if (!loaderBinding || loaderBinding.kind !== 'const' || loaderBinding.constantViolations.length || !declaration?.isVariableDeclarator() || !declaration.get('id').isObjectPattern()) return null;
        const imported = declaration.get('init');
        if (!imported.isCallExpression() || !imported.get('callee').isIdentifier({ name: 'require' }) || imported.scope.getBinding('require') || imported.node.arguments.length !== 1) return null;
        const root = path.resolve(__dirname, '../..');
        const specifier = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, RESULT_LOADER)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!imported.get('arguments.0').isStringLiteral({ value: specifier.startsWith('.') ? specifier : `./${specifier}` })) return null;
        const properties = declaration.node.id.properties;
        if (!properties.some(property => property.type === 'ObjectProperty' && !property.computed && property.key.name === 'loadResultAttemptMigrationSource' && property.value.name === property.key.name)) return null;
        if (binding.referencePaths.some(reference => !reference.parentPath.isMemberExpression() || reference.parentPath.node.computed ||
            !['sql', 'guardsSql', 'sha256'].includes(reference.parentPath.node.property.name) || reference.parentPath.parentPath.isAssignmentExpression())) return null;
        try {
            if (createHash('sha256').update(fs.readFileSync(path.join(root, RESULT_LOADER))).digest('hex') !== RESULT_LOADER_SHA256) return null;
            const bytes = fs.readFileSync(path.join(root, 'prisma/migrations/20261006000000_result_attempt_link/migration.sql'));
            if (createHash('sha256').update(bytes).digest('hex') !== RESULT_SQL_SHA256) return null;
            const sql = bytes.toString('utf8');
            return p.node.property.name === 'guardsSql' ? sql.slice(sql.indexOf('CREATE TRIGGER')) : sql;
        } catch { return null; }
    }
    function holdMigrationSql(p) {
        if (!p?.isMemberExpression() || p.node.computed || !['sql', 'guardsSql', 'indexSql'].includes(p.node.property.name)) return null;
        const object = p.get('object');
        if (!object.isIdentifier()) return null;
        const binding = object.scope.getBinding(object.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return null;
        const init = binding.path.get('init');
        if (!init.isCallExpression() || init.node.arguments.length || !init.get('callee').isIdentifier({ name: 'loadSampleHoldMigrationSource' })) return null;
        const loaderBinding = init.scope.getBinding('loadSampleHoldMigrationSource');
        const declaration = loaderBinding?.path;
        if (!loaderBinding || loaderBinding.kind !== 'const' || loaderBinding.constantViolations.length || !declaration?.isVariableDeclarator() || !declaration.get('id').isObjectPattern()) return null;
        const imported = declaration.get('init');
        if (!imported.isCallExpression() || !imported.get('callee').isIdentifier({ name: 'require' }) || imported.scope.getBinding('require') || imported.node.arguments.length !== 1) return null;
        const root = path.resolve(__dirname, '../..');
        const specifier = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, HOLD_LOADER)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!imported.get('arguments.0').isStringLiteral({ value: specifier.startsWith('.') ? specifier : `./${specifier}` })) return null;
        const properties = declaration.node.id.properties;
        if (!properties.some(property => property.type === 'ObjectProperty' && !property.computed && property.key.name === 'loadSampleHoldMigrationSource' && property.value.name === property.key.name)) return null;
        if (binding.referencePaths.some(reference => !reference.parentPath.isMemberExpression() || reference.parentPath.node.computed ||
            !['sql', 'guardsSql', 'indexSql', 'sha256'].includes(reference.parentPath.node.property.name) || reference.parentPath.parentPath.isAssignmentExpression())) return null;
        try {
            if (createHash('sha256').update(fs.readFileSync(path.join(root, HOLD_LOADER))).digest('hex') !== HOLD_LOADER_SHA256) return null;
            const bytes = fs.readFileSync(path.join(root, 'prisma/migrations/20261006000100_sample_holds_cancellation/migration.sql'));
            if (createHash('sha256').update(bytes).digest('hex') !== HOLD_SQL_SHA256) return null;
            const sql = bytes.toString('utf8');
            return p.node.property.name === 'guardsSql' ? sql.slice(sql.indexOf('CREATE TRIGGER')) :
                p.node.property.name === 'indexSql' ? sql.slice(sql.indexOf('CREATE UNIQUE INDEX'), sql.indexOf('-- Fresh Prisma')) : sql;
        } catch { return null; }
    }
    function referenceMigrationSql(p, qcRule = false, qcRun = false, qcScope = false, qcMembership = false) {
        if (!p?.isMemberExpression() || p.node.computed || !(qcMembership ? ['sql', 'guardSql', 'supersededGuardSql'] : qcRun ? ['sql', 'schemaSql', 'guardsSql', 'bootstrapSql'] : ['sql', 'guardsSql']).includes(p.node.property.name)) return null;
        const object = p.get('object');
        if (!object.isIdentifier()) return null;
        const binding = object.scope.getBinding(object.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return null;
        const init = binding.path.get('init');
        const functionName = qcMembership ? 'loadBracketMembershipSource' : qcScope ? 'loadScopeMigrationSource' : qcRun ? 'loadQcRunMigrationSource' : qcRule ? 'loadQcRuleMigrationSource' : 'loadReferenceMaterialMigrationSource';
        const loader = qcMembership ? QC_MEMBERSHIP_LOADER : qcScope ? QC_SCOPE_LOADER : qcRun ? QC_RUN_LOADER : qcRule ? QC_RULE_LOADER : REFERENCE_LOADER;
        if (!init.isCallExpression() || init.node.arguments.length || !init.get('callee').isIdentifier({ name: functionName })) return null;
        const loaderBinding = init.scope.getBinding(functionName), declaration = loaderBinding?.path;
        if (!loaderBinding || loaderBinding.kind !== 'const' || loaderBinding.constantViolations.length || !declaration?.isVariableDeclarator() || !declaration.get('id').isObjectPattern()) return null;
        const imported = declaration.get('init');
        if (!imported.isCallExpression() || !imported.get('callee').isIdentifier({ name: 'require' }) || imported.scope.getBinding('require') || imported.node.arguments.length !== 1) return null;
        const root = path.resolve(__dirname, '../..');
        const specifier = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, loader)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!imported.get('arguments.0').isStringLiteral({ value: specifier.startsWith('.') ? specifier : `./${specifier}` })) return null;
        if (!declaration.node.id.properties.some(property => property.type === 'ObjectProperty' && !property.computed && property.key.name === functionName && property.value.name === functionName)) return null;
        if (binding.referencePaths.some(reference => {
            const member = reference.parentPath;
            if (!member.isMemberExpression() || member.node.computed || !(qcMembership ? ['sql', 'sha256', 'name', 'guardSql', 'supersededGuardSql', 'guardSha256', 'supersededGuardSha256'] : qcScope ? ['sql', 'guardsSql', 'sha256'] : qcRun ? ['sql', 'schemaSql', 'guardsSql', 'bootstrapSql', 'sha256', 'oracleSha256', 'freshTables'] : ['sql', 'guardsSql', 'sha256', 'oracleSha256', 'freshTables']).includes(member.node.property.name)) return true;
            let end = member;
            while (end.parentPath?.isMemberExpression() && end.parentPath.get('object').node === end.node) end = end.parentPath;
            return (end.parentPath?.isAssignmentExpression() && end.parentPath.get('left').node === end.node) || end.parentPath?.isUpdateExpression() || end.parentPath?.isUnaryExpression({ operator: 'delete' });
        })) return null;
        try {
            if (createHash('sha256').update(fs.readFileSync(path.join(root, loader))).digest('hex') !== (qcMembership ? QC_MEMBERSHIP_LOADER_SHA256 : qcScope ? QC_SCOPE_LOADER_SHA256 : qcRun ? QC_RUN_LOADER_SHA256 : qcRule ? QC_RULE_LOADER_SHA256 : REFERENCE_LOADER_SHA256)) return null;
            const bytes = fs.readFileSync(path.join(root, qcMembership ? 'prisma/migrations/20261007000200_qc_bracket_membership/migration.sql' : qcScope ? 'prisma/migrations/20261007000100_qc_gate_scope/migration.sql' : qcRun ? 'prisma/migrations/20261006000400_normalized_qc_runs/migration.sql' : qcRule ? 'prisma/migrations/20261006000300_qc_rules/migration.sql' : 'prisma/migrations/20261006000200_reference_material_catalogue/migration.sql'));
            if (createHash('sha256').update(bytes).digest('hex') !== (qcMembership ? QC_MEMBERSHIP_SQL_SHA256 : qcScope ? QC_SCOPE_SQL_SHA256 : qcRun ? QC_RUN_SQL_SHA256 : qcRule ? QC_RULE_SQL_SHA256 : REFERENCE_SQL_SHA256)) return null;
            const sql = bytes.toString('utf8');
            if (qcMembership) return p.node.property.name === 'sql' ? sql : require(path.join(root, loader)).loadBracketMembershipSource()[p.node.property.name];
            if (qcScope) return p.node.property.name === 'guardsSql' ? sql.slice(sql.indexOf('CREATE TRIGGER')) : sql;
            if (qcRun) {
                if (p.node.property.name === 'bootstrapSql') return require(path.join(root, loader)).loadQcRunMigrationSource().bootstrapSql;
                const boundary = sql.indexOf('CREATE UNIQUE INDEX "BatchAnalyte_crm_ordinal_unique"');
                return p.node.property.name === 'schemaSql' ? sql.slice(0, boundary) : p.node.property.name === 'guardsSql' ? sql.slice(boundary) : sql;
            }
            return p.node.property.name === 'guardsSql' ? sql.slice(sql.indexOf('CREATE UNIQUE INDEX')) : sql;
        } catch { return null; }
    }
    function qcEvidenceMigrationSql(p) {
        if (!p?.isMemberExpression() || p.node.computed || !['sql', 'schemaSql', 'guardsSql'].includes(p.node.property.name)) return null;
        const object = p.get('object');
        if (!object.isIdentifier()) return null;
        const binding = object.scope.getBinding(object.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return null;
        const init = binding.path.get('init');
        if (!init.isCallExpression() || init.node.arguments.length || !init.get('callee').isIdentifier()) return null;
        const source = QC_EVIDENCE_SOURCES.find(row => init.node.callee.name === row.functionName);
        if (!source) return null;
        const loaderBinding = init.scope.getBinding(source.functionName), declaration = loaderBinding?.path;
        if (!loaderBinding || loaderBinding.kind !== 'const' || loaderBinding.constantViolations.length || !declaration?.isVariableDeclarator() || !declaration.get('id').isObjectPattern()) return null;
        const imported = declaration.get('init');
        if (!imported.isCallExpression() || !imported.get('callee').isIdentifier({ name: 'require' }) || imported.scope.getBinding('require') || imported.node.arguments.length !== 1) return null;
        const root = path.resolve(__dirname, '../..');
        const specifier = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, source.loader)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!imported.get('arguments.0').isStringLiteral({ value: specifier.startsWith('.') ? specifier : `./${specifier}` })) return null;
        if (!declaration.node.id.properties.some(property => property.type === 'ObjectProperty' && !property.computed && property.key.name === source.functionName && property.value.name === source.functionName)) return null;
        if (binding.referencePaths.some(reference => {
            const member = reference.parentPath;
            if (!member.isMemberExpression() || member.node.computed || !['sql', 'schemaSql', 'guardsSql', 'sha256'].includes(member.node.property.name)) return true;
            let end = member;
            while (end.parentPath?.isMemberExpression() && end.parentPath.get('object').node === end.node) end = end.parentPath;
            return (end.parentPath?.isAssignmentExpression() && end.parentPath.get('left').node === end.node) || end.parentPath?.isUpdateExpression() || end.parentPath?.isUnaryExpression({ operator: 'delete' });
        })) return null;
        try {
            if (createHash('sha256').update(fs.readFileSync(path.join(root, source.loader))).digest('hex') !== source.loaderSha256) return null;
            const bytes = fs.readFileSync(path.join(root, 'prisma/migrations', source.directory, 'migration.sql'));
            if (createHash('sha256').update(bytes).digest('hex') !== source.sqlSha256) return null;
            for (const asset of source.assets || []) {
                if (createHash('sha256').update(fs.readFileSync(path.join(root, 'prisma/migrations', source.directory, asset.file))).digest('hex') !== asset.sha256) return null;
            }
            if (source.oracleSha256 && createHash('sha256').update(fs.readFileSync(path.join(root, 'prisma/migrations', source.directory,
                'fresh-prisma-tables.json'))).digest('hex') !== source.oracleSha256) return null;
            const sql = bytes.toString('utf8');
            if (source.wholeSql) return p.node.property.name === 'sql' ? sql : null;
            const marker = source.boundary || 'CREATE TRIGGER', boundary = sql.indexOf(marker);
            if (boundary < 0 || source.boundary && sql.indexOf(marker, boundary + 1) !== -1) return null;
            return p.node.property.name === 'schemaSql' ? sql.slice(0, boundary) : p.node.property.name === 'guardsSql' ? sql.slice(boundary) : sql;
        } catch { return null; }
    }
    function nodeFsRead(p) {
        if (!p?.isCallExpression() || !p.get('callee').isMemberExpression() ||
            !p.get('callee.object').isIdentifier({ name: 'fs' }) || p.node.callee.property.name !== 'readFileSync') return false;
        const binding = p.scope.getBinding('fs');
        if (!binding || binding.constantViolations.length) return false;
        if (binding.path.isImportDefaultSpecifier() || binding.path.isImportNamespaceSpecifier()) {
            return ['fs', 'node:fs'].includes(binding.path.parentPath.node.source?.value);
        }
        const init = binding.path.isVariableDeclarator() && binding.path.get('init');
        return init?.isCallExpression() && init.get('callee').isIdentifier({ name: 'require' }) &&
            strings(init.get('arguments.0')).every(name => ['fs', 'node:fs'].includes(name));
    }
    function schemaFileRead(p, seen = new Set()) {
        if (p?.isIdentifier()) return bindingValue(p, seen).some(value => !value.property && schemaFileRead(value.path, value.seen));
        return nodeFsRead(p) &&
            strings(p.get('arguments.0')).some(value => /(?:prisma\/migrations\/.+\/migration\.sql|scripts\/schema\/[^/]+\.sql)$/.test(value));
    }
    function regularExpression(p, seen = new Set()) {
        return p?.isRegExpLiteral() || (p?.isIdentifier() && bindingValue(p, seen).some(value => regularExpression(value.path, value.seen)));
    }
    function keys(p) { return p.node.computed ? strings(p.get('property')) : [p.node.property.name]; }
    function databaseRoot(p, seen = new Set()) {
        if (!p?.node) return false;
        if (p.isIdentifier()) {
            if (/^(?:prisma|tx|client|db|database|delegate|model)$/.test(p.node.name)) return true;
            return bindingValue(p, seen).some(value => databaseRoot(value.path, value.seen));
        }
        if (p.isMemberExpression() || p.isOptionalMemberExpression()) return databaseRoot(p.get('object'), seen);
        if (p.isCallExpression() && p.get('callee').isIdentifier({ name: 'require' })) return strings(p.get('arguments.0')).some(value => /(?:prisma|\/db)$/.test(value));
        return false;
    }
    function models(p, seen = new Set()) {
        if (!p?.node) return [];
        if (p.isMemberExpression() || p.isOptionalMemberExpression()) {
            const names = keys(p), known = names.filter(name => workflowModels.has(name)).map(name => workflowModels.get(name));
            if (known.length) return known;
            if (names.includes('<unknown>') && databaseRoot(p.get('object'))) return ['Sample', 'WorkItem'];
            return [];
        }
        if (p.isIdentifier()) return union(bindingValue(p, seen).map(value => value.property
            ? [workflowModels.get(value.property)].filter(Boolean) : models(value.path, value.seen)));
        if (p.isConditionalExpression()) return union([models(p.get('consequent'), seen), models(p.get('alternate'), seen)]);
        return [];
    }
    function method(p, seen = new Set()) {
        if (!p?.node) return [];
        if (p.isMemberExpression() || p.isOptionalMemberExpression()) return keys(p).map(name => ({ name, object: p.get('object') }));
        if (p.isIdentifier()) return bindingValue(p, seen).flatMap(value => value.property
            ? [{ name: value.property, object: value.path }] : method(value.path, value.seen));
        if (p.isCallExpression() && p.get('callee').isMemberExpression() && keys(p.get('callee')).includes('bind')) return method(p.get('callee.object'), seen);
        return [];
    }
    function hasStatus(p, seen = new Set(), field = 'status') {
        if (!p?.node) return true;
        if (p.isObjectExpression()) return p.get('properties').some(property => {
            if (property.isSpreadElement()) return hasStatus(property.get('argument'), seen, field);
            const names = property.node.computed ? strings(property.get('key')) : [property.node.key.name || property.node.key.value];
            return names.includes(field) || names.includes('<unknown>');
        });
        if (p.isIdentifier()) {
            const binding = p.scope.getBinding(p.node.name), values = bindingValue(p, seen);
            if (binding?.path.isVariableDeclarator() && binding.path.get('id').isObjectPattern() &&
                binding.path.node.id.properties.some(property => property.type === 'RestElement' && property.argument.name === p.node.name) &&
                binding.path.node.id.properties.some(property => property.type === 'ObjectProperty' && !property.computed && (property.key.name || property.key.value) === field)) return false;
            if (binding?.referencePaths.some(reference => reference.parentPath.isMemberExpression() && reference.key === 'object' &&
                (keys(reference.parentPath).includes(field) || keys(reference.parentPath).includes('<unknown>')) &&
                reference.parentPath.parentPath.isAssignmentExpression())) return true;
            return values.length ? values.some(value => value.property || hasStatus(value.path, value.seen, field)) : true;
        }
        if (p.isConditionalExpression()) return hasStatus(p.get('consequent'), seen, field) || hasStatus(p.get('alternate'), seen, field);
        if (p.isCallExpression() && p.get('callee').isMemberExpression() && p.get('callee.object').isIdentifier({ name: 'Object' }) && keys(p.get('callee')).includes('assign')) {
            return p.get('arguments').some(argument => hasStatus(argument, seen, field));
        }
        return true;
    }
    function dataArgument(p) {
        if (p?.isObjectExpression()) {
            const properties = p.get('properties');
            const data = properties.find(property => property.isObjectProperty() && (property.node.key.name || property.node.key.value) === 'data');
            if (data) return data.get('value');
        }
        if (p?.isIdentifier()) {
            const values = bindingValue(p, new Set());
            if (values.length === 1 && !values[0].property) return dataArgument(values[0].path);
        }
        return null;
    }
    const relationCommands = new Set(['create', 'createMany', 'connectOrCreate', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'connect', 'set', 'disconnect']);
    function hasRelationCommand(p, seen = new Set()) {
        if (!p?.node) return false;
        if (p.isIdentifier()) return bindingValue(p, seen).some(value => hasRelationCommand(value.path, value.seen));
        if (p.isConditionalExpression()) return hasRelationCommand(p.get('consequent'), seen) || hasRelationCommand(p.get('alternate'), seen);
        if (!p.isObjectExpression()) return false;
        return p.get('properties').some(property => property.isSpreadElement() ? hasRelationCommand(property.get('argument'), seen)
            : property.isObjectProperty() && (property.node.computed ? strings(property.get('key'), seen)
                : [property.node.key.name || property.node.key.value]).some(key => relationCommands.has(key)));
    }
    function relationWrites(p, seen = new Set()) {
        if (!p?.node) return [];
        if (p.isIdentifier()) return union(bindingValue(p, seen).map(value => relationWrites(value.path, value.seen)));
        if (p.isArrayExpression()) return union(p.get('elements').map(value => relationWrites(value, seen)));
        if (p.isConditionalExpression()) return union([relationWrites(p.get('consequent'), seen), relationWrites(p.get('alternate'), seen)]);
        if (!p.isObjectExpression()) return [];
        return union(p.get('properties').map(property => {
            if (property.isSpreadElement()) return relationWrites(property.get('argument'), seen);
            if (!property.isObjectProperty()) return [];
            const names = property.node.computed ? strings(property.get('key'), seen) : [property.node.key.name || property.node.key.value];
            const value = property.get('value');
            return union([hasRelationCommand(value, seen) ? names.filter(name => workflowModels.has(name)).map(name => workflowModels.get(name)) : [],
                relationWrites(value, seen)]);
        }));
    }
    function owner(p) {
        for (let current = p.parentPath; current; current = current.parentPath) {
            if (current.isFunctionDeclaration() && current.node.id) return current.node.id.name;
            if ((current.isFunctionExpression() || current.isArrowFunctionExpression()) && current.parentPath.isVariableDeclarator() && current.parentPath.node.id.type === 'Identifier') return current.parentPath.node.id.name;
            if (current.isObjectMethod()) return current.node.key.name || current.node.key.value;
        }
        return null;
    }
    function authorized(p, entities, operation) {
        const name = owner(p);
        if (!exportedNames.has(name)) return false;
        if (validCalculationFixture && name === CALCULATION_FIXTURE.exportName) return true;
        if (validInstrumentImportFixture && name === INSTRUMENT_IMPORT_FIXTURE.exportName) return true;
        if (validAttemptFixture && name === ATTEMPT_FIXTURE.exportName) return true;
        if (validRawInputFixture && name === RAW_INPUT_FIXTURE.exportName) return true;
        if (validCrossCheckFixture && name === CROSS_CHECK_FIXTURE.exportName) return true;
        if (validAmendmentFixture && name === AMENDMENT_FIXTURE.exportName) return true;
        if (validAmendmentMainFixture && name === AMENDMENT_MAIN_FIXTURE.exportName) return true;
        const removal = ['delete', 'deleteMany'].includes(operation);
        if (filename === 'services/sampleStateService.js' && (['createSample', 'transitionSample', 'writeSampleHoldCompatibility'].includes(name) || removal && name === 'removePreAnalyticSample') && entities.every(entity => entity === 'Sample')) return true;
        if (filename === 'services/workItemStateService.js' && (['createWorkItem', 'transitionWorkItem'].includes(name) || removal && name === 'removeUnstartedWorkItems') && entities.every(entity => entity === 'WorkItem')) return true;
        if (removal && filename === 'tests/helpers/workflowFixtures.js' && name === 'cleanupWorkflowFixtures') return true;
        return exceptions.some(entry => entry.file === filename && entry.exportName === name);
    }
    function resultProbe(p) {
        const name = owner(p);
        if (validCalculationFixture && name === CALCULATION_FIXTURE.exportName && exportedNames.has(name)) return true;
        if (validAttemptFixture && name === ATTEMPT_FIXTURE.exportName && exportedNames.has(name)) return true;
        if (validRawInputFixture && name === RAW_INPUT_FIXTURE.exportName && exportedNames.has(name)) return true;
        if (validCrossCheckFixture && name === CROSS_CHECK_FIXTURE.exportName && exportedNames.has(name)) return true;
        if (validAmendmentFixture && name === AMENDMENT_FIXTURE.exportName && exportedNames.has(name)) return true;
        if (validAmendmentMainFixture && name === AMENDMENT_MAIN_FIXTURE.exportName && exportedNames.has(name)) return true;
        return exportedNames.has(name) && exceptions.some(entry => entry.file === filename && entry.exportName === name);
    }
    function pinnedCorruptProjectConnection(p, sql) {
        if (!/^PRAGMA\s+foreign_keys\s*=\s*OFF$/i.test(sql.trim()) || owner(p) !== 'beforeGuards' || !exportedNames.has('beforeGuards') ||
            !exceptions.some(entry => entry.file === filename && entry.exportName === 'beforeGuards' && entry.foreignKeysOffVariant === 'PROJECT_FK_CORRUPT_SYNTHETIC')) return false;
        for (let current = p; current.parentPath; current = current.parentPath) {
            const parent = current.parentPath;
            if (parent.isIfStatement() && current.key === 'consequent') {
                const condition = parent.get('test');
                if (condition.isBinaryExpression({ operator: '===' }) && condition.get('left').isIdentifier({ name: 'schemaVariant' }) &&
                    condition.get('right').isStringLiteral({ value: 'PROJECT_FK_CORRUPT_SYNTHETIC' })) return true;
            }
        }
        return false;
    }
    function helperImport(p, specifiers) {
        const rehearsalLauncher = /^scripts\/(?:run_manager_dashboard_tasklist_side_by_side|run_test_rehearsal|verify_issue149_[^/]+)\.cjs$/.test(filename);
        for (const specifier of specifiers) {
            if (specifier.includes('<unknown>')) continue;
            const root = path.resolve(__dirname, '../..');
            const resolved = path.relative(root, path.resolve(root, path.dirname(filename), specifier))
                .replace(/\\/g, '/').replace(/\.(?:js|cjs)$/, '');
            if (resolved === CALCULATION_PREREQUISITES.file.replace(/\.js$/, '')) {
                const declaration = p.parentPath;
                const allowed = CALCULATION_PREREQUISITES.callers.includes(filename) && declaration.isVariableDeclarator() &&
                    declaration.get('id').isObjectPattern() && declaration.get('id.properties').length === 1 &&
                    declaration.get('id.properties').every(property => {
                        if (!property.isObjectProperty() || property.node.computed || !property.get('value').isIdentifier() ||
                            (property.node.key.name || property.node.key.value) !== CALCULATION_PREREQUISITES.exportName) return false;
                        const binding = declaration.scope.getBinding(property.node.value.name);
                        return binding && binding.constantViolations.length === 0 && binding.referencePaths.length > 0 &&
                            binding.referencePaths.every(reference => reference.key === 'callee' && reference.parentPath.isCallExpression() &&
                                reference.parentPath.get('arguments').length === 1 && reference.parentPath.get('arguments.0').isIdentifier());
                    });
                if (!allowed) report(p.node, filename.startsWith('tests/') ? 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' : 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
            }
            if (resolved === COMPOSITE_FIXTURE.file.replace(/\.js$/, '')) {
                if (!filename.startsWith('tests/')) {
                    report(p.node, 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
                } else {
                    const resultSetImport = name => name === RESULT_SET_FIXTURE.exportName && RESULT_SET_FIXTURE.callers.includes(filename);
                    const inNamedTest = reference => filename === COMPOSITE_FIXTURE.caller && Boolean(reference.findParent(parent =>
                        parent.isCallExpression() && parent.get('callee').isIdentifier({ name: 'test' }) &&
                        parent.get('arguments.0').isStringLiteral() && COMPOSITE_FIXTURE.tests.includes(parent.node.arguments[0].value)));
                    const directCallsOnly = binding => binding && binding.constantViolations.length === 0 &&
                        binding.referencePaths.length > 0 && binding.referencePaths.every(reference =>
                            reference.parentPath.isCallExpression() && reference.key === 'callee' && inNamedTest(reference));
                    let allowed = false;
                    const declaration = p.parentPath;
                    if (declaration.isVariableDeclarator() && declaration.get('id').isObjectPattern()) {
                        allowed = declaration.get('id.properties').every(property => {
                            if (!property.isObjectProperty() || property.node.computed || !property.get('value').isIdentifier()) return false;
                            const name = property.node.key.name || property.node.key.value;
                            if (name === 'createExecutionResultFixture' || resultSetImport(name)) return true;
                            return name === COMPOSITE_FIXTURE.exportName && inNamedTest(p) &&
                                directCallsOnly(declaration.scope.getBinding(property.node.value.name));
                        });
                    } else if (p.isImportDeclaration()) {
                        allowed = p.get('specifiers').every(property => property.isImportSpecifier() &&
                            (property.node.imported.name === 'createExecutionResultFixture' || resultSetImport(property.node.imported.name) ||
                            property.node.imported.name === COMPOSITE_FIXTURE.exportName &&
                            directCallsOnly(p.scope.getBinding(property.node.local.name))));
                    } else if (declaration.isMemberExpression() && !declaration.node.computed &&
                        (declaration.node.property.name === 'createExecutionResultFixture' || resultSetImport(declaration.node.property.name))) allowed = true;
                    if (!allowed) report(p.node, 'POSITIVE_FIXTURE_CALLER_NOT_ALLOWED', specifier);
                }
            }
            if (resolved === ATTEMPT_FIXTURE.file.replace(/\.js$/, '')) {
                const callerAllowed = Object.hasOwn(ATTEMPT_FIXTURE.callers, filename);
                const namedOrphan = filename !== 'tests/contracts/audit_1_2_spectral_state.test.js' || Boolean(p.findParent(parent =>
                    parent.isCallExpression() && parent.get('callee').isIdentifier({ name: 'test' }) &&
                    parent.get('arguments.0').isStringLiteral({ value: ATTEMPT_FIXTURE.orphanTest })));
                if (!callerAllowed || !namedOrphan) report(p.node,
                    filename.startsWith('tests/') ? 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' : 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
            }
            if (resolved === CALCULATION_FIXTURE.file.replace(/\.js$/, '') && filename !== CALCULATION_FIXTURE.caller)
                report(p.node, filename.startsWith('tests/') ? 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' : 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
            if (resolved === INSTRUMENT_IMPORT_FIXTURE.file.replace(/\.js$/, '') && filename !== INSTRUMENT_IMPORT_FIXTURE.caller)
                report(p.node, filename.startsWith('tests/') ? 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' : 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
            if (resolved === RAW_INPUT_FIXTURE.file.replace(/\.js$/, '') && filename !== RAW_INPUT_FIXTURE.caller) {
                report(p.node, filename.startsWith('tests/') ? 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' : 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
            }
            if ((resolved === CROSS_CHECK_FIXTURE.file.replace(/\.js$/, '') && filename !== CROSS_CHECK_FIXTURE.caller) ||
                (resolved === AMENDMENT_FIXTURE.file.replace(/\.js$/, '') && filename !== AMENDMENT_FIXTURE.caller) ||
                (resolved === AMENDMENT_MAIN_FIXTURE.file.replace(/\.js$/, '') && filename !== AMENDMENT_MAIN_FIXTURE.caller)) {
                report(p.node, filename.startsWith('tests/') ? 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' : 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
            }
            if (filename.startsWith('tests/')) continue;
            if (exceptions.some(entry => resolved === entry.file.replace(/\.js$/, '')) || (rehearsalLauncher && resolved.startsWith('tests/'))) {
                report(p.node, 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
            }
        }
    }
    function embeddedProgram(p) {
        function childProcessModule(object, seen = new Set()) {
            if (object?.isImportSpecifier()) return ['child_process', 'node:child_process'].includes(object.parentPath.node.source.value);
            if (object?.isCallExpression() && object.get('callee').isIdentifier({ name: 'require' })) {
                return strings(object.get('arguments.0')).some(name => ['child_process', 'node:child_process'].includes(name));
            }
            if (object?.isIdentifier()) {
                const binding = object.scope.getBinding(object.node.name);
                if (binding?.path.isImportNamespaceSpecifier() || binding?.path.isImportDefaultSpecifier()) {
                    return ['child_process', 'node:child_process'].includes(binding.path.parentPath.node.source.value);
                }
                return bindingValue(object, seen).some(value => childProcessModule(value.path, value.seen));
            }
            return false;
        }
        const argumentsToCheck = [];
        if (p.get('callee').isIdentifier({ name: 'Function' })) argumentsToCheck.push(...p.get('arguments'));
        const targets = method(p.get('callee'));
        if (p.get('callee').isIdentifier()) {
            const imported = p.scope.getBinding(p.node.callee.name)?.path;
            if (imported?.isImportSpecifier() && ['child_process', 'node:child_process', 'fs', 'node:fs', 'vm', 'node:vm']
                .includes(imported.parentPath.node.source.value)) targets.push({
                name: imported.node.imported.name || imported.node.imported.value, object: imported });
        }
        for (const target of targets) {
            if (['spawn', 'spawnSync', 'execFile', 'execFileSync'].includes(target.name) ||
                (['exec', 'execSync'].includes(target.name) && childProcessModule(target.object))) {
                argumentsToCheck.push(...p.get('arguments'));
            }
            if (/^writeFile(?:Sync)?$/.test(target.name) &&
                strings(p.get('arguments.0')).some(file => /\.(?:js|cjs|mjs)$/.test(file))) argumentsToCheck.push(p.get('arguments.1'));
            if (['Script', 'runInContext', 'runInNewContext', 'runInThisContext', 'compileFunction'].includes(target.name)) {
                argumentsToCheck.push(p.get('arguments.0'));
            }
        }
        const embeddedDml = new RegExp('\\b(?:INSERT\\s+(?:OR\\s+\\w+\\s+)?INTO|REPLACE\\s+INTO|UPDATE(?:\\s+OR\\s+\\w+)?|DELETE\\s+FROM)\\s+\\\\*' + sqlTable, 'i');
        if (!argumentsToCheck.some(argument => strings(argument).some(text => embeddedDml.test(text)))) return;
        const entry = deferredSources.find(record => record.path === `server/${filename}` &&
            record.sha256 === createHash('sha256').update(source).digest('hex'));
        report(p.node, entry ? 'DEFERRED_SYNTHETIC_FAULT_FIXTURE' : 'EMBEDDED_WORKFLOW_WRITE',
            entry?.reason || 'Embedded Sample/WorkItem DML cannot bypass the workflow source inventory.');
    }
    function inspectCall(p) {
            embeddedProgram(p);
            if (p.get('callee').isIdentifier({ name: 'require' }) || p.node.callee.type === 'Import') helperImport(p, strings(p.get('arguments.0')));
            for (const target of method(p.get('callee'))) {
                if (target.name === 'reactivateCancelledIntakeWork' && filename !== 'services/sampleStateService.js') {
                    report(p.node, 'INTAKE_REACTIVATION_CALLER_FORBIDDEN', 'Only the sample re-acceptance transaction may reactivate cancelled work.');
                }
                if (target.name === 'writeSampleHoldCompatibility' && filename !== 'services/sampleHoldService.js') {
                    report(p.node, 'HOLD_MARKER_CALLER_FORBIDDEN', 'Only the hold service may update compatibility markers.');
                }
                const entities = union([models(target.object), relationWrites(p.get('arguments.0'))]);
                if (['removePreAnalyticSample', 'removeUnstartedWorkItems'].includes(target.name) && !p.get('arguments.0')?.isIdentifier({ name: 'tx' })) {
                    report(p.node, 'WORKFLOW_REMOVAL_WITHOUT_TRANSACTION', target.name);
                }
                if (mutations.has(target.name) && entities.length) {
                    const stateEntities = entities.filter(entity => entity !== 'Result');
                    const writes = relationWrites(p.get('arguments.0')).filter(entity => entity !== 'Result').length || !['update', 'updateMany', 'updateManyAndReturn'].includes(target.name) || hasStatus(dataArgument(p.get('arguments.0')));
                    if (stateEntities.length && writes && !authorized(p, stateEntities, target.name)) report(p.node, 'WORKFLOW_WRITE_OUTSIDE_AUTHORITY', `${stateEntities.join('/')} ${target.name}`);
                    if (filename !== 'services/resultWriteService.js') {
                        if (entities.includes('Result') && (['create', 'createMany', 'createManyAndReturn', 'upsert'].includes(target.name) || relationWrites(p.get('arguments.0')).includes('Result'))) report(p.node, 'RESULT_CREATE_OUTSIDE_AUTHORITY', target.name);
                        if (entities.includes('WorkItem') && !['delete', 'deleteMany'].includes(target.name) && hasStatus(dataArgument(p.get('arguments.0')), new Set(), 'result')) report(p.node, 'RESULT_CACHE_OUTSIDE_AUTHORITY', target.name);
                    }
                }
                if (sqlMethods.has(target.name) && !(target.name === 'exec' && regularExpression(target.object))) for (const sql of strings(p.get('arguments.0'))) {
                    const statement = target.name === 'pragma' ? `PRAGMA ${sql}` : sql;
                    if (disabling(statement) && !pinnedCorruptProjectConnection(p, statement)) report(p.node, 'WORKFLOW_GUARD_DISABLED', target.name);
                    if (rawWrite(sql) && !authorized(p, ['Sample', 'WorkItem'])) report(p.node, 'RAW_WORKFLOW_SQL', target.name);
                    if ((rawResultCreate(sql) || rawCacheWrite(sql)) && filename !== 'services/resultWriteService.js' && !resultProbe(p)) report(p.node, 'RAW_RESULT_SQL', target.name);
                    if (sql === '<unknown>' && !schemaFileRead(p.get('arguments.0')) && !authorized(p, ['Sample', 'WorkItem'])) {
                        report(p.node, 'UNRESOLVED_WORKFLOW_SQL', target.name);
                    }
                }
            }
    }
    function resultOption(p, names, values) {
        if (names.includes('source')) {
            if (filename !== 'controllers/importController.js' && values.includes('legacy-import')) {
                report(p.node, 'HISTORICAL_IMPORT_CALLER_FORBIDDEN', 'Only importController may request historical result entry.');
            }
            if (values.includes('derived') && !(filename === 'services/resultWriteService.js' &&
                ['deriveTextureResult', 'writeTextureDetermination'].includes(owner(p)))) {
                report(p.node, 'DERIVED_RESULT_CALLER_FORBIDDEN', 'Only texture derivation may request derived result readiness.');
            }
            if (values.includes('spectral-prediction') && !(filename === 'services/resultWriteService.js' && owner(p) === 'writeSpectralPrediction')) {
                report(p.node, 'PREDICTED_RESULT_CALLER_FORBIDDEN', 'Use the internal spectral prediction writer.');
            }
        }
        if (names.includes('syncResult') && filename !== 'services/syncService.js') {
            report(p.node, 'SYNC_RESULT_CALLER_FORBIDDEN', 'Only offline sync may supply Result identity and payload flags.');
        }
    }
    traverse(ast, {
        ObjectProperty(p) {
            const names = p.node.computed ? strings(p.get('key')) : [p.node.key.name || p.node.key.value];
            resultOption(p, names, strings(p.get('value')));
        },
        AssignmentExpression(p) {
            const left = p.get('left');
            if (left.isMemberExpression()) resultOption(p, keys(left), strings(p.get('right')));
        },
        ImportDeclaration(p) { helperImport(p, [p.node.source.value]); },
        NewExpression(p) { embeddedProgram(p); },
        CallExpression: inspectCall,
        OptionalCallExpression: inspectCall,
        TaggedTemplateExpression(p) {
            for (const target of method(p.get('tag'))) if (sqlMethods.has(target.name)) for (const sql of strings(p.get('quasi'))) {
                if (rawWrite(sql) && !authorized(p, ['Sample', 'WorkItem'])) report(p.node, 'RAW_WORKFLOW_SQL', target.name);
                if ((rawResultCreate(sql) || rawCacheWrite(sql)) && filename !== 'services/resultWriteService.js' && !resultProbe(p)) report(p.node, 'RAW_RESULT_SQL', target.name);
                if (disabling(sql)) report(p.node, 'WORKFLOW_GUARD_DISABLED', target.name);
                if (sql === '<unknown>' && !authorized(p, ['Sample', 'WorkItem'])) report(p.node, 'UNRESOLVED_WORKFLOW_SQL', target.name);
            }
        }
    });
    return [...new Map(violations.map(violation => [JSON.stringify(violation), violation])).values()];
}

function scanFiles(serverRoot, files, exceptions) {
    return files.flatMap(file => scanSource(fs.readFileSync(path.resolve(serverRoot, file), 'utf8'), file.replace(/\\/g, '/'), exceptions));
}

module.exports = { scanSource, scanFiles, deferredSources };
