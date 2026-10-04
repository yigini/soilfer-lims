'use strict';
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const schema = require('../services/intakeSchema');
function migrateIntakeTemplates(dbPath) {
    const target = dbPath || process.env.DATABASE_PATH || path.join(__dirname,'../prisma/dev.db');
    if (!fs.existsSync(target)) throw new Error('Intake migration requires an existing database');
    const db = new Database(target,{fileMustExist:true,timeout:10000});
    try {
        db.pragma('foreign_keys = ON');
        if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Sample'").get()) throw new Error('Missing supported Sample baseline');
        const counts = () => Object.fromEntries(['Sample','Result','User','Lab'].map(t=>[t,db.prepare(`SELECT count(*) AS n FROM "${t}"`).get().n]));
        const before = counts();
        db.transaction(()=>{
            db.exec(fs.readFileSync(path.join(__dirname,'../prisma/migrations/202610040001_intake_templates/migration.sql'),'utf8'));
            for (const seed of schema.SEEDS) {
                const json=JSON.stringify(schema.validateSchema(seed.schema)),digest=schema.hash(seed.schema);
                db.prepare('INSERT OR IGNORE INTO "IntakeTemplate" (id,name,matrix,createdBy) VALUES (?,?,?,?)').run(seed.id,seed.name,seed.matrix,'SYSTEM_SEED');
                db.prepare('INSERT OR IGNORE INTO "IntakeTemplateRevision" (id,templateId,version,schemaVersion,schemaJson,schemaHash,state,createdBy,publishedBy,publishedAt) VALUES (?,?,1,?,?,?,\'PUBLISHED\',\'SYSTEM_SEED\',\'SYSTEM_SEED\',CURRENT_TIMESTAMP)').run(seed.revisionId,seed.id,schema.SCHEMA_VERSION,json,digest);
                const stored=db.prepare('SELECT schemaHash,schemaJson FROM "IntakeTemplateRevision" WHERE id=?').get(seed.revisionId);
                if (!stored || stored.schemaHash!==digest || schema.hash(JSON.parse(stored.schemaJson))!==digest) throw new Error('Seed revision mismatch; preserve history and review');
            }
            if(JSON.stringify(before)!==JSON.stringify(counts())) throw new Error('Existing row counts changed during intake migration');
            if(db.pragma('foreign_key_check').length) throw new Error('Intake migration foreign-key integrity failure');
        })();
        if(db.pragma('integrity_check',{simple:true})!=='ok') throw new Error('Intake migration integrity failure');
        return {success:true,version:schema.SCHEMA_VERSION,preserved:before,seeded:schema.SEEDS.length};
    } finally {db.close();}
}
module.exports={migrateIntakeTemplates};
if(require.main===module) {
    try {console.log(JSON.stringify(migrateIntakeTemplates()));}
    catch(error) {console.error('Intake template migration failed:',error.message);process.exitCode=1;}
}
