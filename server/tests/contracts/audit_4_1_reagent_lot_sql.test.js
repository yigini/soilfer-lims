const Database = require('better-sqlite3');
const { loadBatchReagentLotMigrationSource } = require('../../services/batchReagentLotMigrationSource');
const owned = [];
function fixture() {
    const db = new Database(':memory:'); owned.push(db);
    db.pragma('foreign_keys = ON');
    db.exec(`CREATE TABLE Lab(id TEXT PRIMARY KEY);
        CREATE TABLE Batch(id TEXT PRIMARY KEY,labId TEXT,instrumentId TEXT,notes TEXT);
        CREATE TABLE InventoryLot(id TEXT PRIMARY KEY,labId TEXT,currentQuantity REAL,status TEXT,expiryDate DATETIME);
        INSERT INTO Lab VALUES('owned-lab');
        INSERT INTO Batch VALUES('owned-run','owned-lab','owned-instrument','Retained run context');
        INSERT INTO InventoryLot VALUES('owned-lot','owned-lab',17.25,'AVAILABLE',NULL);`);
    const source = loadBatchReagentLotMigrationSource();
    db.exec(source.sql);
    db.prepare('INSERT INTO BatchReagentLot(id,batchId,labId,inventoryLotId,role,linkedBy,linkedAt) VALUES(?,?,?,?,?,?,?)')
        .run('owned-link','owned-run','owned-lab','owned-lot','extractant','owned-analyst','2026-10-09T10:00:00.000Z');
    return db;
}
function snapshot(db) {
    return [db.prepare('SELECT * FROM Lab ORDER BY id').all(),db.prepare('SELECT * FROM Batch ORDER BY id').all(),
        db.prepare('SELECT * FROM InventoryLot ORDER BY id').all(),db.prepare('SELECT * FROM BatchReagentLot ORDER BY id').all()];
}
afterEach(()=>{for(const db of owned.splice(0))db.close();});
test('actual SQL refuses changes to retained reagent-link identity and context with zero writes',()=>{
    const db=fixture(),before=snapshot(db),changes=db.prepare('SELECT total_changes() n').get().n;
    expect(()=>db.prepare('UPDATE BatchReagentLot SET id=?,batchId=?,labId=?,inventoryLotId=?,role=?,linkedBy=?,linkedAt=? WHERE id=?')
        .run('changed','changed','changed','changed','changed','changed','2026-10-10T10:00:00.000Z','owned-link')).toThrow('REAGENT_LOT_LINK_IMMUTABLE');
    expect(snapshot(db)).toEqual(before); expect(db.prepare('SELECT total_changes() n').get().n).toBe(changes);
});
test('actual SQL refuses deletion, including no-op updates, and preserves lot quantity and run context',()=>{
    const db=fixture(),before=snapshot(db);
    expect(()=>db.prepare('DELETE FROM BatchReagentLot WHERE id=?').run('owned-link')).toThrow('REAGENT_LOT_LINK_IMMUTABLE');
    expect(()=>db.prepare('UPDATE BatchReagentLot SET role=role WHERE id=?').run('owned-link')).toThrow('REAGENT_LOT_LINK_IMMUTABLE');
    expect(snapshot(db)).toEqual(before);
});
test('source uniqueness and restrictive foreign keys retain the exact link and its parents',()=>{
    const db=fixture(),before=snapshot(db),insert=db.prepare('INSERT INTO BatchReagentLot(id,batchId,labId,inventoryLotId,linkedBy) VALUES(?,?,?,?,?)');
    expect(()=>insert.run('other-link','owned-run','owned-lab','owned-lot','owned-analyst')).toThrow(/UNIQUE/);
    expect(()=>db.prepare('DELETE FROM Batch').run()).toThrow(/FOREIGN KEY/);
    expect(()=>db.prepare('DELETE FROM Lab').run()).toThrow(/FOREIGN KEY/);
    expect(()=>db.prepare('DELETE FROM InventoryLot').run()).toThrow(/FOREIGN KEY/);
    for(const missing of [1,2,3]) {
        const values=['missing-link','owned-run','owned-lab','owned-lot','owned-analyst'];values[missing]='not-found';
        expect(()=>insert.run(...values)).toThrow(/FOREIGN KEY/);
    }
    expect(snapshot(db)).toEqual(before);
    expect(db.pragma('integrity_check',{simple:true})).toBe('ok');expect(db.pragma('foreign_key_check')).toEqual([]);
});
