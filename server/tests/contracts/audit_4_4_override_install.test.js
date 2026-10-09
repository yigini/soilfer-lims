const Database=require('better-sqlite3');
const {qcGateFixture}=require('../helpers/qcGateFixture');
const {loadResultOverrideMigrationSource}=require('../../services/resultOverrideMigrationSource');
const {installResultOverrideRequests,assertResultOverrideRequestsStartupReady}=require('../../scripts/install_result_override_requests');
const owned=[];
afterEach(async()=>{for(const f of owned.splice(0))await f.close();});
test.each([false,true])('actual installer dry-runs/applies/no-ops empty pre/fresh schema, fresh=%s, retaining every row',async fresh=>{
    const f=await qcGateFixture();owned.push(f);const before=await f.snapshot(),db=new Database(f.file);
    try{if(fresh)db.exec(loadResultOverrideMigrationSource().schemaSql);}finally{db.close();}
    const dry=installResultOverrideRequests({dbPath:f.file});
    expect(()=>assertResultOverrideRequestsStartupReady(f.file)).toThrow('Install the reviewed override-request schema before startup.');
    expect(dry).toMatchObject({classification:fresh?'FRESH_PRISMA_197':'PRE_197',mode:'DRY_RUN',totalChanges:0,backfilledCount:0});
    expect(await f.snapshot()).toEqual(before);
    const applied=installResultOverrideRequests({dbPath:f.file,apply:true});
    expect(applied).toMatchObject({classification:'COMPLETE_197',mode:'APPLIED',newRequestCount:0,backfilledCount:0});
    expect(applied.receipt.originalRowsPreserved).toBe(true);expect(await f.snapshot()).toEqual(before);
    expect(assertResultOverrideRequestsStartupReady(f.file)).toMatchObject({classification:'COMPLETE_197',totalChanges:0});
    expect(installResultOverrideRequests({dbPath:f.file,apply:true})).toMatchObject({classification:'COMPLETE_197',mode:'NO_OP',totalChanges:0});
    expect(await f.snapshot()).toEqual(before);
});
test('partial guard installations refuse instead of repairing or overwriting evidence',async()=>{
    const f=await qcGateFixture();owned.push(f);
    installResultOverrideRequests({dbPath:f.file,apply:true});const db=new Database(f.file);
    try{db.exec('DROP TRIGGER ResultOverrideRequest_delete_refused');}finally{db.close();}
    const before=await f.snapshot();
    expect(()=>installResultOverrideRequests({dbPath:f.file,apply:true})).toThrow(/installation differs/);
    expect(await f.snapshot()).toEqual(before);
});
