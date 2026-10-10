const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const Database=require('better-sqlite3');
const {assertOwnedTestDatabase}=require('./testOwnedDatabase');
// #210 review6095648270: closed, no-argument current-main predecessor.
// Schema from main e7259dd8108330155ad29225087abdc17e00aa50 (90 models).
// git show e7259dd8108330155ad29225087abdc17e00aa50:server/prisma/schema.prisma
// Schema SHA256 5e27d096f83f86efa51f17cfdfb8baf80f1871d6d4c1ec7f1d2e037d8a8d1c90.
// Own Prisma7.10 migrate diff --from-empty --to-schema <captured-schema> --script
// --config <owned-checkout>/server/prisma.config.ts; unmodified stdout.
// Exact command and digests: fixtures/pre210_after201_provenance.json.
// The earlier literal/factory remain byte-for-byte unchanged.
const DDL_SHA256="b7de680237c07ff2454ed27afcc95481ddb45cc24cd80ade943b88291d9ca397";
const CALLER='tests/contracts/audit_6_1_amendment_install.test.js';
function createPre210After201Fixture(){
 if(arguments.length)throw Error('The pre-210 factory accepts no arguments.');
 if(path.relative(path.resolve(__dirname,'../..'),globalThis.expect?.getState?.().testPath||'').replace(/\\/g,'/')!==CALLER)
  throw Error('The pre-210 factory refuses an unlisted caller.');
 const bytes=fs.readFileSync(path.join(__dirname,'fixtures/pre210_after201_full_application_schema.sql'));
 if(bytes.length!==77186||createHash('sha256').update(bytes).digest('hex')!==DDL_SHA256)throw Error('The literal pre-210 DDL differs.');
 const directory=path.resolve(__dirname,'../.tmp');fs.mkdirSync(directory,{recursive:true});
 const file=assertOwnedTestDatabase(path.join(directory,'audit_legacy_pre210_after201_'+randomUUID()+'.db'),'system:fixture');
 fs.closeSync(fs.openSync(file,'wx'));const db=new Database(file,{fileMustExist:true});
 try{
  db.pragma('foreign_keys=ON');
  db.transaction(()=>{
   db.exec(bytes.toString('utf8'));
   db.prepare('INSERT INTO Sample(id,originalId,status,metadata,history,approvedBy,approvedAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?)')
    .run('pre210-sample','PRE210-ORIGINAL','APPROVED','{"preserve":"é精确"}','[{"old":"history"}]','prior-approver',100,
     '2026-09-01T10:00:00.123Z','2026-09-02T11:00:00.456Z');
   const amendment=db.prepare('INSERT INTO SampleAmendment(id,sampleId,type,status,reason,affectedOrderLines,affectedResults,affectedReports,impactAssessment,authorizedBy,authorizedAt,resolution,createdBy,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
   amendment.run('pre210-approved','pre210-sample','CLERICAL','APPROVED','Retained reason','["old-line"]','["pre210-result"]','["old-report"]',
    '{"old":"assessment"}','prior-requester',123,'Retained resolution','prior-requester',100,150);
   amendment.run('pre210-pending','pre210-sample','SCIENTIFIC','PENDING','Historical request','["old-line"]','["pre210-result"]','["old-report"]',
    '{"old":"pending assessment"}',null,null,null,'second-requester',151,152);
   db.prepare('INSERT INTO Result(id,sampleId,param,value,numericValue,rawInput,unit,flags,isValid,censoring,basis,provenance,methodologyId,replicateNo,isCurrent,supersededBy,enteredBy,analysedAt,equipmentId,equipmentReadiness,batchId,attemptId,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('pre210-result','pre210-sample','SOC',' 6,7500 ',6.75,' 6,7500 ','g/kg','["HISTORICAL_QC_FLAG"]',0,'BELOW_LOQ','OVEN_DRY','IMPORTED',
     'old-method',2,0,'old-successor','old-analyst',111,'old-instrument','{"old":"equipment evidence"}','old-batch','old-attempt',112,113);
   db.prepare('INSERT INTO AuditLog(id,entity,entityId,action,details,performedBy,timestamp) VALUES(?,?,?,?,?,?,?)')
    .run('pre210-audit','SampleAmendment','pre210-approved','AMENDMENT_CREATED','{"old":"audit evidence"}','prior-requester',123);
  })();
 }finally{db.close();}
 // Existing installer creates its genuine receipt; this factory fabricates none.
 require('../../scripts/install_workflow_state_guards').installWorkflowStateGuards({dbPath:file,apply:true});
 return{file};
}
module.exports={createPre210After201Fixture};
