#!/usr/bin/env node
const path=require('node:path'),Database=require('better-sqlite3');
const {randomUUID}=require('node:crypto');
const scopeGuard=require('../utils/scopeGuard');
const {hasPermission}=require('../config/roles');
const e=require('../services/nonconformityInstallationEvidence');
const {assertNonconformityStartupReady}=require('./install_nonconformity_reports');
function plan(db) {
    const rounds=db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all(),reports=db.prepare('SELECT * FROM NonconformityReport ORDER BY id').all();
    const pending=rounds.filter(row=>row.ncrStatus==='PENDING').map(row=>{
        const retained=reports.find(report=>report.source==='PT'&&report.refType==='ProficiencyRound'&&report.refId===row.id);
        if(retained&&retained.labId!==row.labId)throw e.fail('NCR_SOURCE_SCOPE_MISMATCH','A retained PT NCR belongs to another laboratory.',[row.id,retained.id]);
        return {round:row,retained};
    });
    const receipts=db.prepare('SELECT * FROM _schema_migrations WHERE id IN (?,?) ORDER BY id').all(e.MARKER,e.PT_MARKER);
    return {pending,roundCount:rounds.length,pendingRoundIds:pending.map(row=>row.round.id),
        alreadyRaisedRoundIds:rounds.filter(row=>row.ncrStatus==='RAISED').map(row=>row.id),
        nullRoundIds:rounds.filter(row=>row.ncrStatus==null).map(row=>row.id),
        newNcrCount:pending.filter(row=>!row.retained).length,reusedNcrCount:pending.filter(row=>row.retained).length,
        planSha256:e.fingerprint({sources:e.sources(),rounds,reports,receipts})};
}
function retainedOtherRows(db) {
    const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('ProficiencyRound','NonconformityReport','AuditLog') ORDER BY name").all().map(row=>row.name);
    return Object.fromEntries(names.map(name=>[name,db.prepare(`SELECT * FROM "${name.replace(/"/g,'""')}" ORDER BY rowid`).all()]));
}
function receipt(current,mode,links=[],totalChanges=0) {
    return {mode,planSha256:current.planSha256,totalChanges,roundCount:current.roundCount,pendingRoundIds:current.pendingRoundIds,
        alreadyRaisedRoundIds:current.alreadyRaisedRoundIds,nullRoundIds:current.nullRoundIds,newNcrCount:mode==='APPLIED'?current.newNcrCount:0,
        plannedNewNcrCount:current.newNcrCount,reusedNcrCount:current.reusedNcrCount,linkedCount:links.length,links,
        newAuditCount:mode==='APPLIED'?current.pending.length+current.newNcrCount:0,otherRowsAndClassificationFieldsPreserved:true};
}
function backfillPtNonconformity({dbPath,apply=false,planSha256=null,by=null}={}) {
    if(typeof dbPath!=='string'||!dbPath.trim())throw e.fail('NCR_DATABASE_REQUIRED','Provide an explicit database path.');
    const target=path.resolve(dbPath);assertNonconformityStartupReady(target);
    const reader=new Database(target,{readonly:true,fileMustExist:true});let reviewed;
    try {reviewed=reader.transaction(()=>plan(reader))();}finally{reader.close();}
    if(!apply)return receipt(reviewed,'DRY_RUN');
    if(!reviewed.pending.length)return receipt(reviewed,'NO_OP');
    if(!planSha256||planSha256!==reviewed.planSha256)throw e.fail('NCR_PLAN_STALE','Review the current dry-run fingerprint before applying PT NCR links.');
    const db=new Database(target,{fileMustExist:true,timeout:5000});
    try {
        require('../services/exchangeDbFunctions').registerDbFunctions(db);db.pragma('foreign_keys=ON');
        return db.transaction(()=>{
            e.assertCompleteNcrEvidence(db);const current=plan(db);
            if(current.planSha256!==planSha256)throw e.fail('NCR_PLAN_STALE','PT or NCR evidence changed after the reviewed dry-run.');
            const actor=typeof by==='string'?db.prepare('SELECT username,role,labId,isActive FROM User WHERE username=?').get(by):null;
            if(!actor?.isActive||!scopeGuard.hasGlobalAccess(actor)||!hasPermission(actor,'APPROVE_RESULTS'))
                throw e.fail('NCR_BACKFILL_ACTOR_REQUIRED','A named active administrator with global approval authority is required.');
            const other=e.fingerprint(retainedOtherRows(db)),rounds=db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all(),
                reports=db.prepare('SELECT * FROM NonconformityReport ORDER BY id').all(),oldAudits=db.prepare('SELECT * FROM AuditLog ORDER BY id').all();
            const now=new Date().toISOString(),links=[],addedReports=[],addedAudits=[];
            const audit=(entity,entityId,action,before,after,labId,analysisCode)=>{
                const id=randomUUID();addedAudits.push(id);
                db.prepare('INSERT INTO AuditLog(id,entity,entityId,action,details,before,after,performedBy,timestamp,labId,analysisCode) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
                    .run(id,entity,entityId,action,JSON.stringify({source:'PT_PENDING_BACKFILL',planSha256}),before?JSON.stringify(before):null,
                        JSON.stringify(after),actor.username,now,labId,analysisCode);
            };
            for(const change of current.pending) {
                scopeGuard.ensureScope(actor,change.round,{labField:'labId',altLabField:null});
                let report=change.retained;
                if(!report) {
                    const id=randomUUID();
                    db.prepare(`INSERT INTO NonconformityReport(id,labId,source,refType,refId,description,status,raisedBy,createdAt,updatedAt)
                        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id,change.round.labId,'PT','ProficiencyRound',change.round.id,
                        `Historical PENDING PT round ${change.round.roundRef} (${change.round.provider}), analysis ${change.round.analysisCode}.`,'OPEN',actor.username,now,now);
                    report=db.prepare('SELECT * FROM NonconformityReport WHERE id=?').get(id);addedReports.push(id);
                    audit('NONCONFORMITY_REPORT',id,'NCR_RAISED',null,report,report.labId,change.round.analysisCode);
                }
                const updated=db.prepare("UPDATE ProficiencyRound SET ncrStatus='RAISED',nonconformityId=? WHERE id=? AND ncrStatus='PENDING' AND nonconformityId IS NULL").run(report.id,change.round.id);
                if(updated.changes!==1)throw e.fail('NCR_PLAN_STALE','A PT round changed before it could be linked.',[change.round.id]);
                const after=db.prepare('SELECT * FROM ProficiencyRound WHERE id=?').get(change.round.id);
                links.push({roundId:change.round.id,nonconformityId:report.id,created:!change.retained});
                audit('PROFICIENCY_ROUND',change.round.id,'PT_NCR_BACKFILLED',change.round,after,after.labId,after.analysisCode);
            }
            const expected=rounds.map(row=>{
                const link=links.find(link=>link.roundId===row.id);return link?{...row,ncrStatus:'RAISED',nonconformityId:link.nonconformityId}:row;
            });
            if(e.fingerprint(db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all())!==e.fingerprint(expected)||
                e.fingerprint(retainedOtherRows(db))!==other||
                e.fingerprint(db.prepare('SELECT * FROM NonconformityReport ORDER BY id').all().filter(row=>!addedReports.includes(row.id)))!==e.fingerprint(reports)||
                e.fingerprint(db.prepare('SELECT * FROM AuditLog ORDER BY id').all().filter(row=>!addedAudits.includes(row.id)))!==e.fingerprint(oldAudits)||
                db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)
                throw e.fail('NCR_BACKFILL_PRESERVATION_REFUSED','PT NCR backfill changed retained evidence.');
            return receipt(current,'APPLIED',links,db.prepare('SELECT total_changes() n').get().n);
        }).immediate();
    }finally{db.close();}
}
function parseArguments(args) {
    const options={apply:false},seen=new Set();
    for(let i=0;i<args.length;i++){
        const arg=args[i];if(seen.has(arg))throw e.fail('NCR_ARGUMENT_INVALID','Repeated argument.');seen.add(arg);
        if(arg==='--apply')options.apply=true;else if(arg==='--dry-run')continue;
        else if(['--db','--plan-sha256','--by'].includes(arg)&&args[i+1]&&!args[i+1].startsWith('--'))
            options[{'--db':'dbPath','--plan-sha256':'planSha256','--by':'by'}[arg]]=args[++i];
        else throw e.fail('NCR_ARGUMENT_INVALID','Unknown or incomplete argument.');
    }
    if(!options.dbPath||seen.has('--apply')&&seen.has('--dry-run'))throw e.fail('NCR_ARGUMENT_INVALID','Provide --db and one execution mode.');
    return options;
}
if(require.main===module){try{process.stdout.write(JSON.stringify(backfillPtNonconformity(parseArguments(process.argv.slice(2))),null,2)+'\n');}
catch(error){process.stderr.write(JSON.stringify({error:error.code||'NCR_BACKFILL_REFUSED',message:error.message,differences:error.differences||[],totalChanges:error.totalChanges??0})+'\n');process.exitCode=1;}}
module.exports={backfillPtNonconformity,parseArguments};
