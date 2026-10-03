const Database = require('better-sqlite3');
const policy = require('../../services/exchangePolicyService');

describe('Narrow publication hold candidates preserve conservative exclusions',()=>{
    let db;
    beforeEach(()=>{db=new Database(':memory:');db.exec('CREATE TABLE Sample (id TEXT PRIMARY KEY,status TEXT,approvedAt TEXT,metadata TEXT,fieldMetadata TEXT)');});
    afterEach(()=>db.close());
    test.each(['APPROVED','RELEASED','ARCHIVED','DISPOSED'])('malformed, non-object and actual holds are excluded in %s',status=>{
        const insert=db.prepare('INSERT INTO Sample VALUES (?,?,?,?,?)');
        insert.run('malformed',status,'2026-10-03','{broken',null);
        insert.run('array',status,'2026-10-03',null,'[]');
        insert.run('hold',status,'2026-10-03',JSON.stringify({provenanceHold:{status:'AMBIGUOUS_PROVENANCE_HOLD'}}),null);
        insert.run('clean',status,'2026-10-03','{}','{}');
        expect(policy.getHeldSampleIds(db,{publicationOnly:true}).sort()).toEqual(['array','hold','malformed']);
    });
    test('unpublished rows and never-approved archived rows are not scanned for restricted publication',()=>{
        db.prepare('INSERT INTO Sample VALUES (?,?,?,?,?)').run('expected','EXPECTED',null,'{broken',null);
        db.prepare('INSERT INTO Sample VALUES (?,?,?,?,?)').run('unapproved-archived','ARCHIVED',null,'{broken',null);
        expect(policy.getHeldSampleIds(db,{publicationOnly:true})).toEqual([]);
        expect(policy.getHeldSampleIds(db).sort()).toEqual(['expected','unapproved-archived']);
    });
    test('missing publication columns retain broad conservative discovery',()=>{
        db.exec('DROP TABLE Sample; CREATE TABLE Sample(id TEXT PRIMARY KEY, metadata TEXT); INSERT INTO Sample VALUES (\'old\',\'[]\')');
        expect(policy.getHeldSampleIds(db,{publicationOnly:true})).toEqual(['old']);
    });
    test('a database failure remains an error, never a successful empty list',()=>{
        db.close();
        expect(()=>policy.getHeldSampleIds(db,{publicationOnly:true})).toThrow();
        db=new Database(':memory:');
    });
});
