#!/usr/bin/env node
const path=require('node:path'), Database=require('better-sqlite3');
const {loadNonconformityMigrationSource}=require('../services/nonconformityMigrationSource');
const {loadProficiencyMigrationSource}=require('../services/proficiencyMigrationSource');
const e=require('../services/nonconformityInstallationEvidence');
function counts(db,hasNcr) {
    return {roundCount:db.prepare('SELECT count(*) n FROM ProficiencyRound').get().n,
        pendingRoundIds:db.prepare("SELECT id FROM ProficiencyRound WHERE ncrStatus='PENDING' ORDER BY id").all().map(row=>row.id),
        ncrCount:hasNcr?db.prepare('SELECT count(*) n FROM NonconformityReport').get().n:0};
}
function classify(db) {
    const baseDifferences=e.inspectProficiencyBase(db);
    if(baseDifferences.length)throw e.fail('NCR_PREREQUISITE_NOT_INSTALLED','Install the reviewed PT predecessor schema first.',baseDifferences);
    const present=e.extensionPresent(db), original=e.originalPtGuardsMatch(db), ptReceipt=e.receipt(db,e.PT_MARKER);
    if(!present) {
        if(!original||!e.ptReceiptMatches(db))throw e.fail('NCR_PREREQUISITE_NOT_INSTALLED','PRE_193 requires the exact complete #189 predecessor.');
        return {classification:'PRE_193',sources:e.sources(),...counts(db,false)};
    }
    const guardNames=e.objects(loadNonconformityMigrationSource().guardsSql).map(row=>row.name);
    const guards=guardNames.map(name=>Boolean(db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(name)));
    const marker=e.receipt(db,e.MARKER);
    if(marker||guards.some(Boolean))return {...e.assertCompleteNcrEvidence(db),...counts(db,true)};
    const differences=e.inspectNcrSchema(db);
    if(ptReceipt)differences.push('Fresh bootstrap must have no PT receipt');
    if(differences.length)throw e.fail('NCR_SCHEMA_MISMATCH','The fresh NCR bootstrap schema differs.',differences);
    const invalidIds=db.prepare(`SELECT id FROM ProficiencyRound WHERE nonconformityId IS NOT NULL
        OR (ncrStatus IS NOT NULL AND ncrStatus NOT IN ('PENDING'))
        OR (ncrStatus='PENDING' AND outcome IS NOT 'UNSATISFACTORY') ORDER BY id`).all().map(row=>row.id);
    const ncrIds=db.prepare('SELECT id FROM NonconformityReport ORDER BY id').all().map(row=>row.id);
    if(invalidIds.length||ncrIds.length)throw Object.assign(e.fail('NCR_BOOTSTRAP_DATA_REFUSED','Fresh bootstrap data would violate the reviewed guards.',
        [...invalidIds.map(id=>`ProficiencyRound ${id}`),...ncrIds.map(id=>`NonconformityReport ${id}`)]),{invalidRoundIds:invalidIds,ncrIds});
    return {classification:'FRESH_PRISMA_193',sources:e.sources(),...counts(db,true)};
}
function retainedRows(db) {
    const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('NonconformityReport','_schema_migrations') ORDER BY name").all().map(row=>row.name);
    return Object.fromEntries(names.map(name=>[name,db.prepare(`SELECT * FROM "${name.replace(/"/g,'""')}" ORDER BY rowid`).all()]));
}
function installNonconformityReports({dbPath,apply=false}={}) {
    if(typeof dbPath!=='string'||!dbPath.trim())throw e.fail('NCR_DATABASE_REQUIRED','Provide an explicit database path.');
    const target=path.resolve(dbPath),source=loadNonconformityMigrationSource(),ptSource=loadProficiencyMigrationSource();
    const reader=new Database(target,{readonly:true,fileMustExist:true});let plan;
    try {plan=reader.transaction(()=>classify(reader))();}finally{reader.close();}
    if(!apply||plan.classification==='COMPLETE_193')return {...plan,mode:apply?'NO_OP':'DRY_RUN',totalChanges:0,backfilledCount:0};
    const db=new Database(target,{fileMustExist:true,timeout:5000});
    try {
        require('../services/exchangeDbFunctions').registerDbFunctions(db);db.pragma('foreign_keys=ON');
        return db.transaction(()=>{
            const current=classify(db);if(current.classification==='COMPLETE_193')return {...current,mode:'NO_OP',totalChanges:0,backfilledCount:0};
            const before=retainedRows(db),ledger=db.prepare('SELECT * FROM _schema_migrations ORDER BY id').all();
            if(current.classification==='PRE_193')db.exec(source.schemaSql);
            else {
                db.exec(ptSource.guardsSql);
                db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(e.PT_MARKER,JSON.stringify({migrationSha256:ptSource.sha256}));
            }
            db.exec(source.guardsSql);
            const expected={...before,ProficiencyRound:before.ProficiencyRound.map(row=>current.classification==='PRE_193'?{...row,nonconformityId:null}:row)};
            if(e.fingerprint(retainedRows(db))!==e.fingerprint(expected)||db.prepare('SELECT count(*) n FROM NonconformityReport').get().n!==0||
                e.fingerprint(db.prepare('SELECT * FROM _schema_migrations WHERE id NOT IN (?,?) ORDER BY id').all(e.PT_MARKER,e.MARKER))!==
                e.fingerprint(ledger.filter(row=>![e.PT_MARKER,e.MARKER].includes(row.id)))||
                !e.ptReceiptMatches(db)||current.classification==='PRE_193'&&
                e.fingerprint(db.prepare('SELECT * FROM _schema_migrations WHERE id=?').all(e.PT_MARKER))!==e.fingerprint(ledger.filter(row=>row.id===e.PT_MARKER)))
                throw e.fail('NCR_PRESERVATION_REFUSED','NCR installation changed retained evidence or receipts.');
            const receipt={sources:current.sources,originalRowsSha256:e.fingerprint(before),originalRowsAndFieldsPreserved:true,newNcrCount:0,backfilledCount:0};
            receipt.receiptSha256=e.fingerprint(receipt);
            db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(e.MARKER,JSON.stringify(receipt));
            const after=classify(db);
            if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)throw e.fail('NCR_INTEGRITY_REFUSED','NCR installation failed integrity checks.');
            return {...after,previousClassification:current.classification,mode:'APPLIED',newNcrCount:0,backfilledCount:0,
                totalChanges:db.prepare('SELECT total_changes() n').get().n};
        }).immediate();
    }finally{db.close();}
}
function assertNonconformityStartupReady(dbPath) {
    const plan=installNonconformityReports({dbPath});
    if(plan.classification!=='COMPLETE_193')throw e.fail('NCR_NOT_INSTALLED','Install the complete reviewed NCR schema before startup.');
    return plan;
}
function parseArguments(args) {
    const options={apply:false},seen=new Set();
    for(let i=0;i<args.length;i++){
        const arg=args[i];if(seen.has(arg))throw e.fail('NCR_ARGUMENT_INVALID','Repeated argument.');seen.add(arg);
        if(arg==='--apply')options.apply=true;
        else if(arg==='--dry-run')continue;
        else if(arg==='--db'&&args[i+1]&&!args[i+1].startsWith('--'))options.dbPath=args[++i];
        else throw e.fail('NCR_ARGUMENT_INVALID','Unknown or incomplete argument.');
    }
    if(!options.dbPath||seen.has('--apply')&&seen.has('--dry-run'))throw e.fail('NCR_ARGUMENT_INVALID','Provide --db and one execution mode.');
    return options;
}
if(require.main===module){try{process.stdout.write(JSON.stringify(installNonconformityReports(parseArguments(process.argv.slice(2))),null,2)+'\n');}
catch(error){process.stderr.write(JSON.stringify({error:error.code||'NCR_INSTALL_REFUSED',message:error.message,differences:error.differences||[],
    invalidRoundIds:error.invalidRoundIds||[],ncrIds:error.ncrIds||[],totalChanges:error.totalChanges??0})+'\n');process.exitCode=1;}}
module.exports={installNonconformityReports,assertNonconformityStartupReady,parseArguments,classifyNonconformity:classify};
