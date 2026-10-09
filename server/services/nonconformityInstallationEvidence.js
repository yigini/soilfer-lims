const Database=require('better-sqlite3');
const {createHash}=require('node:crypto');
const {loadNonconformityMigrationSource}=require('./nonconformityMigrationSource');
const {loadProficiencyMigrationSource}=require('./proficiencyMigrationSource');
const MARKER='193_nonconformity_reports', PT_MARKER='189_proficiency_evidence';
const normalize=sql=>(sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g)||[]).filter(token=>!/^\s+$/.test(token)).join('').replace(/;$/,'');
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,differences=[])=>Object.assign(new Error(message),{code,differences,totalChanges:0});
const objects=sql=>[...sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match=>({name:match[1],sql:match[0]}));
function sources() {
    return {migrationSha256:loadNonconformityMigrationSource().sha256,proficiencyMigrationSha256:loadProficiencyMigrationSource().sha256};
}
function receipt(db,id) {return db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(id);}
function inspectProficiencyBase(db) {
    const differences=[], columns=db.prepare('PRAGMA table_xinfo("ProficiencyRound")').all();
    for(const name of ['id','labId','analysisCode','uncertainty','zScore','outcome'])if(!columns.some(row=>row.name===name))differences.push(`ProficiencyRound.${name} absent`);
    for(const [,name,type] of loadProficiencyMigrationSource().sql.matchAll(/^ALTER TABLE "ProficiencyRound" ADD COLUMN "([^"]+)" (\w+);/gm)) {
        const actual=columns.find(row=>row.name===name);
        if(!actual||actual.type!==type||actual.notnull||actual.pk||actual.hidden||actual.dflt_value!==null)differences.push(`ProficiencyRound.${name} differs`);
    }
    if(!db.prepare('PRAGMA table_xinfo("_schema_migrations")').all().some(row=>row.name==='details'))differences.push('Migration ledger absent');
    return differences;
}
function ptReceiptMatches(db) {
    const actual=receipt(db,PT_MARKER);
    try {return JSON.stringify(JSON.parse(actual?.details))===JSON.stringify({migrationSha256:loadProficiencyMigrationSource().sha256});}
    catch {return false;}
}
function originalPtGuardsMatch(db) {
    return objects(loadProficiencyMigrationSource().guardsSql).every(row=>normalize(db.prepare('SELECT sql FROM sqlite_master WHERE type=\'trigger\' AND name=?').get(row.name)?.sql||'')===normalize(row.sql));
}
let expected;
function expectedSchema() {
    if(expected)return expected;
    const db=new Database(':memory:');
    try {
        db.exec('CREATE TABLE Lab(id TEXT PRIMARY KEY); CREATE TABLE ProficiencyRound(id TEXT PRIMARY KEY,ncrStatus TEXT);');
        const source=loadNonconformityMigrationSource();
        db.exec(source.schemaSql);
        const columns=db.prepare('PRAGMA table_xinfo("NonconformityReport")').all();
        const foreignKeys=db.prepare('PRAGMA foreign_key_list("NonconformityReport")').all();
        const indexes=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='NonconformityReport' AND sql IS NOT NULL ORDER BY name").all();
        expected={columns,foreignKeys,indexes};return expected;
    } finally {db.close();}
}
const columnContract=rows=>rows.map(({name,type,notnull,dflt_value,pk,hidden})=>({name,type,notnull,dflt_value,pk,hidden}));
const fkContract=rows=>rows.map(({table,from,to,on_update,on_delete,match})=>({table,from,to,on_update,on_delete,match}));
function inspectNcrSchema(db) {
    const differences=[], e=expectedSchema();
    if(JSON.stringify(columnContract(db.prepare('PRAGMA table_xinfo("NonconformityReport")').all()))!==JSON.stringify(columnContract(e.columns)))differences.push('NonconformityReport column contract differs');
    if(JSON.stringify(fkContract(db.prepare('PRAGMA foreign_key_list("NonconformityReport")').all()))!==JSON.stringify(fkContract(e.foreignKeys)))differences.push('NonconformityReport foreign key differs');
    const actual=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='NonconformityReport' AND sql IS NOT NULL ORDER BY name").all();
    if(JSON.stringify(actual.map(row=>({name:row.name,sql:normalize(row.sql)})))!==JSON.stringify(e.indexes.map(row=>({name:row.name,sql:normalize(row.sql)}))))differences.push('NonconformityReport indexes differ');
    const column=db.prepare('PRAGMA table_xinfo("ProficiencyRound")').all().find(row=>row.name==='nonconformityId');
    if(!column||column.type!=='TEXT'||column.notnull||column.pk||column.hidden||column.dflt_value!==null)differences.push('ProficiencyRound.nonconformityId differs');
    const fks=db.prepare('PRAGMA foreign_key_list("ProficiencyRound")').all().filter(row=>row.from==='nonconformityId');
    if(fks.length!==1||JSON.stringify(fkContract(fks))!==JSON.stringify([{table:'NonconformityReport',from:'nonconformityId',to:'id',on_update:'CASCADE',on_delete:'RESTRICT',match:'NONE'}]))differences.push('ProficiencyRound NCR foreign key differs');
    return differences;
}
function extensionPresent(db) {
    return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name='NonconformityReport'").get())||
        db.prepare('PRAGMA table_xinfo("ProficiencyRound")').all().some(row=>row.name==='nonconformityId')||
        Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name LIKE 'NonconformityReport_%'").get())||
        Boolean(receipt(db,MARKER));
}
function assertCompleteNcrEvidence(db) {
    const differences=[...inspectProficiencyBase(db),...inspectNcrSchema(db)];
    for(const row of objects(loadNonconformityMigrationSource().guardsSql)) {
        const actual=db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(row.name);
        if(actual?.type!=='trigger'||normalize(actual.sql)!==normalize(row.sql))differences.push(`${row.name} differs`);
    }
    if(!ptReceiptMatches(db))differences.push('Original PT receipt differs');
    let parsed;try{parsed=JSON.parse(receipt(db,MARKER)?.details);}catch{/* Refuse absent or changed receipt. */}
    const fields=['sources','originalRowsSha256','originalRowsAndFieldsPreserved','newNcrCount','backfilledCount','receiptSha256'];
    if(!parsed||JSON.stringify(Object.keys(parsed).sort())!==JSON.stringify(fields.sort())||
        JSON.stringify(parsed.sources)!==JSON.stringify(sources())||!/^([a-f0-9]{64})$/.test(parsed.originalRowsSha256)||
        parsed.originalRowsAndFieldsPreserved!==true||parsed.newNcrCount!==0||parsed.backfilledCount!==0||
        parsed.receiptSha256!==fingerprint(Object.fromEntries(Object.entries(parsed).filter(([key])=>key!=='receiptSha256'))))differences.push('NCR migration receipt differs');
    if(differences.length)throw fail('NCR_SCHEMA_MISMATCH','The NCR installation differs from its reviewed release.',differences);
    return {classification:'COMPLETE_193',sources:sources(),receipt:parsed};
}
module.exports={MARKER,PT_MARKER,normalize,fingerprint,fail,objects,sources,receipt,inspectProficiencyBase,
    ptReceiptMatches,originalPtGuardsMatch,inspectNcrSchema,extensionPresent,assertCompleteNcrEvidence};
