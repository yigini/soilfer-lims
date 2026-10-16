#!/usr/bin/env node
// Fresh Prisma #193 must be one atomic install, never the #189 half alone.
const path=require('node:path'),Database=require('better-sqlite3');
const ncr=require('./install_nonconformity_reports');
const pt=require('./install_proficiency_evidence');
function bootstrapPtNonconformity(options) {
    if(typeof options?.dbPath!=='string'||!options.dbPath.trim())throw Object.assign(new Error('Provide an explicit database path.'),{code:'NCR_DATABASE_REQUIRED'});
    const db=new Database(path.resolve(options.dbPath),{readonly:true,fileMustExist:true});let present;
    try {present=Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name='NonconformityReport'").get())||
        db.prepare('PRAGMA table_xinfo("ProficiencyRound")').all().some(row=>row.name==='nonconformityId');}finally{db.close();}
    if(!present) {
        const predecessor=pt.installProficiencyEvidence(options);
        if(predecessor.classification!=='COMPLETE')return {classification:'PT_PREDECESSOR_REQUIRED',mode:'DRY_RUN',totalChanges:0,predecessor};
    }
    return ncr.installNonconformityReports(options);
}
if(require.main===module){try{process.stdout.write(JSON.stringify(bootstrapPtNonconformity(ncr.parseArguments(process.argv.slice(2))),null,2)+'\n');}
catch(error){process.stderr.write(JSON.stringify({error:error.code||'NCR_INSTALL_REFUSED',message:error.message,differences:error.differences||[],totalChanges:error.totalChanges??0})+'\n');process.exitCode=1;}}
module.exports={bootstrapPtNonconformity};
