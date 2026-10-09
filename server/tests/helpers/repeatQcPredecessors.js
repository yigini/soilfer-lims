const {assertOwnedTestDatabase}=require('./testOwnedDatabase');
function installRepeatQcPredecessors(file) {
    assertOwnedTestDatabase(file,'system:fixture');
    const {installQcRuns}=require('../../scripts/install_qc_runs');
    const plan=installQcRuns({dbPath:file});
    installQcRuns({dbPath:file,apply:true,planSha256:plan.backfillFingerprint});
    require('../../scripts/install_qc_gate_scope').installQcGateScope({dbPath:file,apply:true});
    require('../../scripts/install_batch_reagent_lots').installBatchReagentLots({dbPath:file,apply:true});
}
module.exports={installRepeatQcPredecessors};
