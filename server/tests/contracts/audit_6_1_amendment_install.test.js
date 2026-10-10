const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const Database=require('better-sqlite3');
const {PrismaClient}=require('../../prisma_client');
const {PrismaBetterSqlite3}=require('@prisma/adapter-better-sqlite3');
const {beforeGuards}=require('../helpers/legacyWorkflowDatabase');
const {assertOwnedTestDatabase}=require('../helpers/testOwnedDatabase');
const {createSampleFixture}=require('../helpers/workflowFixtures');
const {installWorkflowStateGuards}=require('../../scripts/install_workflow_state_guards');
const {installSampleAmendmentAuthorisation,parseArguments}=require('../../scripts/install_sample_amendment_authorisation');
const {loadSampleAmendmentMigrationSource}=require('../../services/sampleAmendmentMigrationSource');
const {createPre210AmendmentFixture}=require('../helpers/sampleAmendmentHistoricalFixture');
const {scanSource}=require('../helpers/workflowWriteScanner');
const files=[],hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function fixture(){
 const directory=path.resolve(__dirname,'../.tmp');fs.mkdirSync(directory,{recursive:true});
 const file=assertOwnedTestDatabase(path.join(directory,'audit_legacy_amendment_'+randomUUID()+'.db'),'system:fixture');files.push(file);
 beforeGuards({actor:'system:fixture',file,qcBootstrap:'CREATE_PRISMA'});
 const client=new PrismaClient({adapter:new PrismaBetterSqlite3({url:'file:'+file})});
 try{
  const sample=await createSampleFixture(client,{data:{id:randomUUID(),originalId:randomUUID(),status:'APPROVED'}});
  await client.sampleAmendment.create({data:{id:'legacy-'+randomUUID(),sampleId:sample.id,type:'CLERICAL',status:'APPROVED',
   reason:'Historical correction',affectedOrderLines:'["historical-line"]',affectedResults:'["historical-result"]',
   affectedReports:'["historical-report"]',impactAssessment:'{"historical":"assessment"}',authorizedBy:'historical-approver',
   authorizedAt:new Date('2026-09-02T03:04:05.123Z'),resolution:'Retained historical resolution',createdBy:'historical-requester',
   createdAt:new Date('2026-09-01T02:03:04.123Z'),updatedAt:new Date('2026-09-03T04:05:06.123Z')}});
 }finally{await client.$disconnect();}
 installWorkflowStateGuards({dbPath:file,apply:true});
 return file;
}
function snapshot(db){
 return{objects:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
  rows:Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
   .map(({name})=>[name,db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()]))};
}
afterAll(()=>{for(const file of files)fs.rmSync(assertOwnedTestDatabase(file,'system:fixture'),{force:true});});

test('the real pre-210 schema upgrades additively while retaining every historical field, schema object, foreign key and receipt',()=>{
 const {file}=createPre210AmendmentFixture();files.push(file);const db=new Database(file);db.pragma('foreign_keys=ON');
 try{
  const before=snapshot(db),initialHash=hash(file),source=loadSampleAmendmentMigrationSource();
  const shapes=Object.fromEntries(Object.keys(before.rows).map(table=>[table,{
   columns:db.prepare('PRAGMA table_xinfo("'+table+'")').all(),foreignKeys:db.prepare('PRAGMA foreign_key_list("'+table+'")').all()}]));
  expect(shapes.SampleAmendment.columns.map(row=>row.name)).not.toEqual(expect.arrayContaining(['version','requestPayload','priorApprovedBy','priorApprovedAt','selectedWorkItemIds']));
  expect(before.rows.SampleAmendment).toHaveLength(2);expect(before.rows.Result).toHaveLength(1);expect(before.rows.AuditLog).toHaveLength(1);
  expect(before.rows.SampleAmendment.find(row=>row.id==='pre210-approved')).toMatchObject({status:'APPROVED',createdBy:'prior-requester',authorizedBy:'prior-requester'});
  expect(installSampleAmendmentAuthorisation({dbPath:file})).toMatchObject({classification:'PRE_210',mode:'DRY_RUN',totalChanges:0,backfilledCount:0});
  expect(snapshot(db)).toEqual(before);expect(hash(file)).toBe(initialHash);
  expect(installSampleAmendmentAuthorisation({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE_210',previousClassification:'PRE_210',
   mode:'APPLIED',newAmendmentCount:0,backfilledCount:0,receipt:{originalRowsPreserved:true}});
  const after=snapshot(db),newNames=new Set([...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"/gm)].map(row=>row[1]));
  newNames.add('SampleAmendmentAttempt');newNames.add('SampleAmendmentAttempt_childAttemptId_key');
  expect(after.objects.find(row=>row.name==='SampleAmendmentAttempt')).toMatchObject({type:'table',
   sql:source.freshTables.SampleAmendmentAttempt.replace(/;$/,'')});
  expect(after.objects.find(row=>row.name==='SampleAmendmentAttempt_childAttemptId_key')).toMatchObject({type:'index',
   sql:'CREATE UNIQUE INDEX "SampleAmendmentAttempt_childAttemptId_key" ON "SampleAmendmentAttempt"("childAttemptId")'});
  expect(after.objects.filter(row=>!newNames.has(row.name)&&row.name!=='SampleAmendment')).toEqual(before.objects.filter(row=>row.name!=='SampleAmendment'));
  expect(Object.keys(after.rows)).toEqual([...Object.keys(before.rows),'SampleAmendmentAttempt'].sort());
  expect(after.rows.SampleAmendmentAttempt).toEqual([]);
  const linkForeignKeys=db.prepare('PRAGMA foreign_key_list("SampleAmendmentAttempt")').all();
  expect(linkForeignKeys).toHaveLength(4);
  for(const foreignKey of linkForeignKeys)expect(foreignKey).toMatchObject({on_delete:'RESTRICT',on_update:'RESTRICT'});
  for(const [table,rows]of Object.entries(before.rows)){
   const columnNames=shapes[table].columns.map(row=>row.name);
   const retained=after.rows[table].filter(row=>table!=='_schema_migrations'||row.id!=='210_sample_amendment_authorisation')
    .map(row=>Object.fromEntries(columnNames.map(name=>[name,row[name]])));
   expect(retained).toEqual(rows);
   expect(db.prepare('PRAGMA table_xinfo("'+table+'")').all().filter(row=>columnNames.includes(row.name))).toEqual(shapes[table].columns);
   expect(db.prepare('PRAGMA foreign_key_list("'+table+'")').all()).toEqual(shapes[table].foreignKeys);
  }
  expect(after.rows._schema_migrations).toHaveLength(before.rows._schema_migrations.length+1);
  for(const row of after.rows.SampleAmendment)expect(row).toMatchObject({requestPayload:null,version:null,priorApprovedBy:null,priorApprovedAt:null,selectedWorkItemIds:null});
  for(const row of after.rows.SampleAmendment){
   expect(()=>db.prepare('UPDATE SampleAmendment SET version=1 WHERE id=?').run(row.id)).toThrow('AMENDMENT_VERSION_CONFLICT');
   expect(db.prepare('SELECT * FROM SampleAmendment WHERE id=?').get(row.id)).toEqual(row);
  }
  expect(db.pragma('integrity_check',{simple:true})).toBe('ok');expect(db.pragma('foreign_key_check')).toEqual([]);
  const completeHash=hash(file);expect(installSampleAmendmentAuthorisation({dbPath:file,apply:true})).toMatchObject({mode:'NO_OP',totalChanges:0});
  expect(snapshot(db)).toEqual(after);expect(hash(file)).toBe(completeHash);
 }finally{db.close();}
});

test('the pre-210 factory has one no-argument caller and exact source and DDL boundaries',()=>{
 expect(()=>createPre210AmendmentFixture({file:'arbitrary'})).toThrow('accepts no arguments');
 const root=path.resolve(__dirname,'../..'),factory='tests/helpers/sampleAmendmentHistoricalFixture.js',source=fs.readFileSync(path.join(root,factory),'utf8');
 expect(scanSource(source,factory)).toEqual([]);
 expect(scanSource(source+'\n// changed\n',factory)).toEqual(expect.arrayContaining([expect.objectContaining({code:'HISTORICAL_FIXTURE_SOURCE_MISMATCH'})]));
 const allowed="require('../helpers/sampleAmendmentHistoricalFixture')";
 expect(scanSource(allowed,'tests/contracts/audit_6_1_amendment_install.test.js')).toEqual([]);
 expect(scanSource(allowed,'tests/contracts/second_caller.test.js')).toEqual([expect.objectContaining({code:'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED'})]);
 expect(scanSource("require('../tests/helpers/sampleAmendmentHistoricalFixture')",'services/probe.js')).toEqual([expect.objectContaining({code:'TEST_HELPER_IMPORTED_BY_RUNTIME'})]);
 const read=fs.readFileSync,literal=path.join(root,'tests/helpers/fixtures/pre210_full_application_schema.sql');
 const spy=jest.spyOn(fs,'readFileSync').mockImplementation((target,...args)=>{
  const bytes=read(target,...args);return path.resolve(String(target))===literal?Buffer.concat([Buffer.from(bytes),Buffer.from('\n')]):bytes;
 });
 try{
  expect(scanSource(source,factory)).toEqual(expect.arrayContaining([expect.objectContaining({code:'HISTORICAL_FIXTURE_SOURCE_MISMATCH'})]));
  expect(()=>createPre210AmendmentFixture()).toThrow('literal pre-210 DDL differs');
 }finally{spy.mockRestore();}
 const originalState=expect.getState,callerSpy=jest.spyOn(expect,'getState').mockImplementation(()=>({...originalState(),testPath:path.join(root,'tests/contracts/second_caller.test.js')}));
 try{expect(()=>createPre210AmendmentFixture()).toThrow('unlisted caller');}finally{callerSpy.mockRestore();}
});

test('only the exact amendment loader and DDL resolve; aliases and changed bytes grant no SQL authority',()=>{
 const root=path.resolve(__dirname,'../..'),header="const {loadSampleAmendmentMigrationSource}=require('../services/sampleAmendmentMigrationSource'); const source=loadSampleAmendmentMigrationSource();";
 expect(scanSource(header+'db.exec(source.sql)','scripts/probe.js')).toEqual([]);
 expect(scanSource(header+'db.exec(source.guardsSql)','scripts/probe.js')).toEqual([]);
 expect(scanSource(header+'const alias=source;db.exec(alias.sql)','scripts/probe.js')).toEqual([expect.objectContaining({code:'UNRESOLVED_WORKFLOW_SQL'})]);
 for(const file of ['services/sampleAmendmentMigrationSource.js','prisma/migrations/20261010000000_sample_amendment_authorisation/migration.sql',
  'prisma/migrations/20261010000000_sample_amendment_authorisation/fresh-prisma-tables.json']){
  const target=path.join(root,file),read=fs.readFileSync,spy=jest.spyOn(fs,'readFileSync').mockImplementation((requested,...args)=>{
   const bytes=read(requested,...args);return path.resolve(String(requested))===target?Buffer.concat([Buffer.from(bytes),Buffer.from('\n')]):bytes;
  });
  try{expect(scanSource(header+'db.exec(source.sql)','scripts/probe.js')).toEqual([expect.objectContaining({code:'UNRESOLVED_WORKFLOW_SQL'})]);}
  finally{spy.mockRestore();}
 }
});

test('fresh generated Prisma receives guards with every historical field and prior receipt retained; repeat is byte-preserving NO_OP',async()=>{
 const file=await fixture(),db=new Database(file);db.pragma('foreign_keys=ON');
 try{
  const before=snapshot(db),initialHash=hash(file),source=loadSampleAmendmentMigrationSource();
  expect(installSampleAmendmentAuthorisation({dbPath:file})).toMatchObject({classification:'FRESH_PRISMA_210',mode:'DRY_RUN',totalChanges:0,backfilledCount:0});
  expect(snapshot(db)).toEqual(before);expect(hash(file)).toBe(initialHash);
  expect(installSampleAmendmentAuthorisation({dbPath:file,apply:true})).toMatchObject({classification:'COMPLETE_210',mode:'APPLIED',
   newAmendmentCount:0,backfilledCount:0,receipt:{originalRowsPreserved:true}});
  const after=snapshot(db),names=new Set([...source.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"/gm)].map(row=>row[1]));
  expect(after.objects.filter(row=>!names.has(row.name))).toEqual(before.objects);
  for(const [table,rows]of Object.entries(before.rows))expect(table==='_schema_migrations'?
   after.rows[table].filter(row=>row.id!=='210_sample_amendment_authorisation'):after.rows[table]).toEqual(rows);
  expect(after.rows.SampleAmendment[0]).toMatchObject({requestPayload:null,version:null,priorApprovedBy:null,priorApprovedAt:null,selectedWorkItemIds:null});
  expect(after.rows.SampleAmendmentAttempt).toEqual([]);
  expect(db.prepare('PRAGMA foreign_key_list("SampleAmendmentAttempt")').all()).toHaveLength(4);
  for(const foreignKey of db.prepare('PRAGMA foreign_key_list("SampleAmendmentAttempt")').all())
   expect(foreignKey).toMatchObject({on_delete:'RESTRICT',on_update:'RESTRICT'});
  expect(db.pragma('integrity_check',{simple:true})).toBe('ok');expect(db.pragma('foreign_key_check')).toEqual([]);
  const completeHash=hash(file);expect(installSampleAmendmentAuthorisation({dbPath:file,apply:true})).toMatchObject({mode:'NO_OP',totalChanges:0});
  expect(snapshot(db)).toEqual(after);expect(hash(file)).toBe(completeHash);
 }finally{db.close();}
});

test.each([['partial'],['foreign'],['late-receipt-fault']])('a %s installation refuses with zero persisted writes',async variant=>{
 const file=await fixture(),db=new Database(file);
 try{
  if(variant==='partial'){
   const firstGuard='CREATE TRIGGER "SampleAmendment_request_evidence_immutable"\nBEFORE UPDATE OF "requestPayload", "selectedWorkItemIds" ON "SampleAmendment"\nWHEN NEW.requestPayload IS NOT OLD.requestPayload OR NEW.selectedWorkItemIds IS NOT OLD.selectedWorkItemIds\nBEGIN SELECT RAISE(ABORT, \'AMENDMENT_REQUEST_IMMUTABLE\');\nEND;';
   expect(loadSampleAmendmentMigrationSource().guardsSql.match(/^CREATE TRIGGER "[^"]+"[\s\S]*?^END;/m)[0]).toBe(firstGuard);
   db.exec(firstGuard);
  }
  else if(variant==='foreign')db.exec('CREATE TRIGGER "SampleAmendment_delete_immutable" BEFORE DELETE ON SampleAmendment BEGIN SELECT RAISE(ABORT, \'FOREIGN_GUARD\'); END;');
  else db.exec("CREATE TRIGGER owned_amendment_receipt_failure BEFORE INSERT ON _schema_migrations WHEN NEW.id='210_sample_amendment_authorisation' BEGIN SELECT RAISE(ABORT,'OWNED_AMENDMENT_RECEIPT_FAILURE'); END;");
  const before=snapshot(db),beforeHash=hash(file);
  expect(()=>installSampleAmendmentAuthorisation({dbPath:file,apply:true})).toThrow(variant==='late-receipt-fault'?
   'OWNED_AMENDMENT_RECEIPT_FAILURE':expect.objectContaining({statusCode:409,code:'AMENDMENT_SCHEMA_MISMATCH'}));
  expect(snapshot(db)).toEqual(before);expect(hash(file)).toBe(beforeHash);
 }finally{db.close();}
});

test('the actual guards preserve immutable request evidence, require one CAS increment and seal prior approval after authorisation',async()=>{
 const file=await fixture();installSampleAmendmentAuthorisation({dbPath:file,apply:true});const db=new Database(file);
 try{
  const sampleId=db.prepare('SELECT id FROM Sample LIMIT 1').get().id,id=randomUUID();
  const insert=db.prepare('INSERT INTO SampleAmendment(id,sampleId,type,status,reason,createdBy,createdAt,updatedAt,requestPayload,selectedWorkItemIds,version) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  const values=[id,sampleId,'CLERICAL','PENDING','Owned new request','requester',Date.now(),Date.now(),'{"profileRevision":1}','[]',1];
  expect(()=>insert.run(...values.slice(0,8),'broken-json','[]',1)).toThrow('AMENDMENT_REQUEST_INVALID');
  expect(()=>insert.run(...values.slice(0,8),'{}','{}',1)).toThrow('AMENDMENT_REQUEST_INVALID');
  insert.run(...values);
  const pending=db.prepare('SELECT * FROM SampleAmendment WHERE id=?').get(id);
  for(const [probe,code] of [
   [()=>db.prepare('UPDATE SampleAmendment SET requestPayload=\'{}\',version=2 WHERE id=?').run(id),'AMENDMENT_REQUEST_IMMUTABLE'],
   [()=>db.prepare('UPDATE SampleAmendment SET selectedWorkItemIds=\'["other"]\',version=2 WHERE id=?').run(id),'AMENDMENT_REQUEST_IMMUTABLE'],
   [()=>db.prepare('UPDATE SampleAmendment SET status=\'APPROVED\' WHERE id=?').run(id),'AMENDMENT_VERSION_CONFLICT'],
   [()=>db.prepare('UPDATE SampleAmendment SET priorApprovedBy=\'other\',priorApprovedAt=123,version=2 WHERE id=?').run(id),'AMENDMENT_PRIOR_APPROVAL_IMMUTABLE'],
   [()=>db.prepare('DELETE FROM SampleAmendment WHERE id=?').run(id),'AMENDMENT_DELETE_REFUSED']
  ]){expect(probe).toThrow(code);expect(db.prepare('SELECT * FROM SampleAmendment WHERE id=?').get(id)).toEqual(pending);}
  db.prepare("UPDATE SampleAmendment SET status='APPROVED',authorizedBy='other-approver',authorizedAt=123,priorApprovedBy='prior-approver',priorApprovedAt=100,version=2 WHERE id=?").run(id);
  const approved=db.prepare('SELECT * FROM SampleAmendment WHERE id=?').get(id);
  expect(approved).toMatchObject({status:'APPROVED',version:2,priorApprovedBy:'prior-approver',priorApprovedAt:100});
  expect(()=>db.prepare("UPDATE SampleAmendment SET priorApprovedBy='replacement',version=3 WHERE id=?").run(id)).toThrow('AMENDMENT_PRIOR_APPROVAL_IMMUTABLE');
  const historical=db.prepare("SELECT * FROM SampleAmendment WHERE version IS NULL LIMIT 1").get();
  expect(()=>db.prepare('UPDATE SampleAmendment SET version=1 WHERE id=?').run(historical.id)).toThrow('AMENDMENT_VERSION_CONFLICT');
  expect(db.prepare('SELECT * FROM SampleAmendment WHERE id=?').get(historical.id)).toEqual(historical);
 }finally{db.close();}
});

test.each([[],['--db','owned.db','--apply','--dry-run'],['--db','owned.db','--apply','--apply'],['--db','owned.db','--unknown']].map(args=>[args]))('installer arguments require an explicit unambiguous mode: %j',args=>{
 expect(()=>parseArguments(args)).toThrow(expect.objectContaining({code:'AMENDMENT_ARGUMENT_INVALID'}));
});

test('managed amendment attempt table matches the actual independently emitted fresh Prisma oracle',()=>{
 const source=loadSampleAmendmentMigrationSource();
 expect(source.schemaSql.match(/CREATE TABLE "SampleAmendmentAttempt" \([\s\S]*?\n\);/)[0]).toBe(source.freshTables.SampleAmendmentAttempt);
 expect(source.guardsSql.match(/CREATE TRIGGER/g)).toHaveLength(8);
 expect(source.freshTables.SampleAmendmentAttempt).not.toMatch(/CHECK|TRIGGER/);
});
