const fs = require('node:fs'), path = require('node:path');
const { scanSource } = require('../helpers/workflowWriteScanner');
const sources = [
    ['loadProficiencyMigrationSource', 'proficiencyMigrationSource', '20261007000300_proficiency_evidence'],
    ['loadResultEquipmentMigrationSource', 'resultEquipmentMigrationSource', '20261007000400_result_equipment_evidence']
];
const code = (name, module, extra = '') => `const { ${name} } = require('../services/${module}'); const source = ${name}(); ${extra} db.exec(source.sql);`;

test.each(sources)('closed %s SQL is inspected while appended workflow writes remain rejected', (name, module) => {
    for (const field of ['sql', 'schemaSql', 'guardsSql']) expect(scanSource(code(name, module).replace('exec(source.sql)', `exec(source.${field})`), 'scripts/canary.js')).toEqual([]);
    expect(scanSource(code(name, module) + `db.exec('UPDATE WorkItem SET status="ACCEPTED"');`, 'scripts/canary.js'))
        .toEqual([expect.objectContaining({ code: 'RAW_WORKFLOW_SQL' })]);
});
test.each(sources)('shadowed, escaped and mutated %s sources are still unknown SQL', (name, module) => {
    for (const source of [code(name, module, 'source.sql = "UPDATE Sample SET status=APPROVED";'),
        code(name, module, 'external(source);'), code(name, module).replace(`= ${name}()`, '= arbitraryLoader()'),
        code(name, module).replace(`../services/${module}`, '../services/not-the-closed-source'),
        `function example(require) { ${code(name, module)} }`]) {
        expect(scanSource(source, 'scripts/canary.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    }
});
test.each(sources)('changed %s loader or DDL bytes restore the failing unknown-SQL finding', (name, module, directory) => {
    const read = fs.readFileSync.bind(fs);
    for (const target of [path.resolve(__dirname, '../../services', `${module}.js`), path.resolve(__dirname, '../../prisma/migrations', directory, 'migration.sql')]) {
        const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...options) => {
            const value = read(file, ...options);
            return typeof file === 'string' && path.resolve(file) === target ? Buffer.concat([Buffer.from(value), Buffer.from('\n-- changed bytes')]) : value;
        });
        try { expect(scanSource(code(name, module), 'scripts/canary.js')).toEqual([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]); }
        finally { spy.mockRestore(); }
    }
});
