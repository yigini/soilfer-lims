const fs = require('node:fs');
const path = require('node:path');
const { scanSource } = require('../helpers/workflowWriteScanner');
const root = path.resolve(__dirname, '../..');
const filename = 'scripts/install_workflow_state_guards.js';
const header = "const { loadWorkflowMigrationSources, evidenceCreates } = require('../services/workflowMigrationSources'); ";
const positive = header + 'const sources=loadWorkflowMigrationSources(); db.exec(sources.guards.sql);';

test.each([
    'db.exec(loadWorkflowMigrationSources().evidence.sql);',
    'db.exec(loadWorkflowMigrationSources().guards.sql);',
    'const sources=loadWorkflowMigrationSources(); db.exec(sources.evidence.sql);',
    'const sources=loadWorkflowMigrationSources(); db.exec(evidenceCreates(sources.evidence.sql));'
])('only the pinned immutable migration sources resolve: %s', body => {
    expect(scanSource(header + body, filename)).toEqual([]);
});

test.each([
    [header.replace('../services/workflowMigrationSources', '../scripts/workflowMigrationSources'), 'const sources=loadWorkflowMigrationSources(); db.exec(sources.guards.sql);'],
    [header.replace('loadWorkflowMigrationSources', 'loadOtherSql'), 'const sources=loadOtherSql(); db.exec(sources.guards.sql);'],
    ["const loader = require('../services/workflowMigrationSources');", 'const sources=loader.loadWorkflowMigrationSources(); db.exec(sources.guards.sql);'],
    [header, 'const sources=loadWorkflowMigrationSources(); db.exec(sources.unknown.sql);'],
    [header, 'const sources=loadWorkflowMigrationSources(); db.exec(sources.evidence.other);'],
    [header, "const sources=loadWorkflowMigrationSources(); db.exec(sources['guards'].sql);"],
    [header, 'let sources=loadWorkflowMigrationSources(); db.exec(sources.guards.sql);'],
    [header, 'var sources=loadWorkflowMigrationSources(); db.exec(sources.guards.sql);'],
    [header, 'let sources=loadWorkflowMigrationSources(); sources={}; db.exec(sources.guards.sql);'],
    [header, 'const sources=loadWorkflowMigrationSources(); const alias=sources; db.exec(alias.guards.sql);'],
    [header, 'const sources=loadWorkflowMigrationSources(); const alias={...sources}; db.exec(alias.guards.sql);'],
    [header, 'const sources=loadWorkflowMigrationSources(); consume(sources); db.exec(sources.guards.sql);'],
    [header, 'const sources=loadWorkflowMigrationSources(); consume(sources.guards); db.exec(sources.guards.sql);'],
    [header, "const sources=loadWorkflowMigrationSources(); sources.guards.sql='different'; db.exec(sources.guards.sql);"],
    [header, 'const sources=loadWorkflowMigrationSources(); db.exec(evidenceCreates(sources.guards.sql));'],
    [header, 'const sources=loadWorkflowMigrationSources(); db.exec(sources.evidence.sql.slice(sources.evidence.sql.indexOf("CREATE TABLE")));'],
    [header, 'const sources=loadWorkflowMigrationSources("other path"); db.exec(sources.guards.sql);']
])('unknown imports, members or aliases remain unresolved', (importText, body) => {
    expect(scanSource(importText + body, filename)).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })
    ]));
});

test.each([
    ['prisma/migrations/20261005000000_workflow_state_evidence/migration.sql', '\n-- altered bytes\n'],
    ['prisma/migrations/20261005000100_workflow_state_guards/migration.sql', '\n-- altered bytes\n'],
    ['prisma/migrations/20261005000000_workflow_state_evidence/migration.sql', '\nUPDATE "Sample" SET status=\'PROCESSING\';'],
    ['prisma/migrations/20261005000100_workflow_state_guards/migration.sql', '\nINSERT INTO "WorkItem" (id,status) VALUES (\'x\',\'ASSIGNED\');'],
    ['prisma/migrations/20261005000000_workflow_state_evidence/migration.sql', '\nDROP TRIGGER Sample_status_insert_guard;'],
    ['prisma/migrations/20261005000100_workflow_state_guards/migration.sql', '\nPRAGMA foreign_keys=OFF;'],
    ['prisma/migrations/20261005000000_workflow_state_evidence/migration.sql', '\nPRAGMA ignore_check_constraints=ON;'],
    ['prisma/migrations/20261005000100_workflow_state_guards/migration.sql', '\nPRAGMA writable_schema=ON;'],
    ['prisma/migrations/20261005000000_workflow_state_evidence/migration.sql', '\nATTACH DATABASE \'other.db\' AS other;'],
    ['prisma/migrations/20261005000000_workflow_state_evidence/migration.sql', '\nSELECT 1;'],
    ['services/workflowMigrationSources.js', '\n// changed loader body\n']
])('tampered %s bytes never become a SQL exemption', (file, append) => {
    const actualRead = fs.readFileSync.bind(fs), target = path.resolve(root, file);
    const replacement = Buffer.from(actualRead(target).toString('utf8') + append);
    const read = jest.spyOn(fs, 'readFileSync').mockImplementation((requested, options) => {
        if (path.resolve(requested) === target) return options === 'utf8' ? replacement.toString('utf8') : replacement;
        return actualRead(requested, options);
    });
    try { expect(scanSource(positive, filename)).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })
    ])); } finally { read.mockRestore(); }
});

test('a third registry entry changes the loader digest and stays unresolved', () => {
    const actualRead = fs.readFileSync.bind(fs), target = path.join(root, 'services/workflowMigrationSources.js');
    const replacement = Buffer.from(actualRead(target).toString('utf8').replace('const SOURCES = Object.freeze({',
        "const SOURCES = Object.freeze({ extra: {directory:'other',sha256:'other'},"));
    const read = jest.spyOn(fs, 'readFileSync').mockImplementation((requested, options) => {
        if (path.resolve(requested) === target) return options === 'utf8' ? replacement.toString('utf8') : replacement;
        return actualRead(requested, options);
    });
    try { expect(scanSource(positive, filename)).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })
    ])); } finally { read.mockRestore(); }
});
