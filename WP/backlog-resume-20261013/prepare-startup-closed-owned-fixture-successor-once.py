"""Close the new impact fixture authority and remove opaque test SQL forwarding."""
import hashlib,json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/startup-order-readiness-20261015/closed-owned-fixture-successor-once'
assert not D.exists();D.mkdir()
query=R/'server/tests/contracts/order_revision_impact_set_query.test.js';text=query.read_text(encoding='utf-8')
start=text.index('function fixture(samples, { orphan = false } = {}) {');end=text.index('\nfunction readImpact(',start)
old=text[start:end]
seed=old[old.index('    db.exec(`'):old.index('    return db;')]
helper=R/'server/tests/helpers/startupImpactFixture.js';assert not helper.exists()
body="""const path = require('node:path');
const Database = require('better-sqlite3');

// A closed synthetic impact-query fixture. No caller-supplied database, path,
// SQL, connection or callback is accepted; all writes are to this new memory DB.
function createStartupImpactFixture(options) {
    const caller = path.relative(path.resolve(__dirname, '../..'), globalThis.expect?.getState?.().testPath || '').replace(/\\\\/g, '/');
    if (arguments.length !== 1 || process.env.NODE_ENV !== 'test' ||
        caller !== 'tests/contracts/order_revision_impact_set_query.test.js' ||
        !options || typeof options !== 'object' || Array.isArray(options) ||
        Object.keys(options).some(key => !['samples', 'orphan'].includes(key)) ||
        ![0, 1, 240, 12000].includes(options.samples) ||
        (Object.hasOwn(options, 'orphan') && typeof options.orphan !== 'boolean'))
        throw new Error('The closed startup impact fixture requires its exact test caller and declared synthetic cases.');
    require('../../services/workflowStateRules').assertFixtureContext();
    const { samples, orphan = false } = options;
    const statements = [];
    const db = new Database(':memory:', { verbose: sql => statements.push(sql) });
    try {
"""+seed+"""        db.pragma('query_only = ON');
        statements.length = 0;
        return { db, statements };
    } catch (error) { db.close(); throw error; }
}
module.exports = { createStartupImpactFixture };
"""
helper.write_bytes(body.encode())
text=text.replace("const Database = require('better-sqlite3');", "const { createStartupImpactFixture } = require('../helpers/startupImpactFixture');")
text=text[:text.index('function fixture(samples, { orphan = false } = {}) {')]+"""function fixture(samples, options = {}) {
    const declared = { samples, ...options };
    return createStartupImpactFixture(declared);
}
"""+text[text.index('\nfunction readImpact('):]
start=text.index('function readImpact(');end=text.index("\ntest('all nonzero",start)
text=text[:start]+"""function readImpact(fn, { db, statements }) {
    const before = db.prepare('SELECT total_changes() n').get().n;
    statements.length = 0;
    const began = performance.now();
    const report = fn(db);
    const elapsedMs = performance.now() - began;
    // SQLite's passive statement trace observes actual execution. No SQL is
    // forwarded, rewritten or hidden; the fixture is query_only after seeding.
    const executed = [...statements];
    expect(executed.every(sql => /^(SELECT|PRAGMA)\\b/.test(sql))).toBe(true);
    const pointLookups = executed.filter(sql => sql.startsWith('SELECT requiredAnalyses FROM Sample WHERE id=')).length;
    const ownerSetQueries = executed.filter(sql => sql.includes('s.id AS storedSampleId')).length;
    expect(db.prepare('SELECT total_changes() n').get().n).toBe(before);
    return { report: JSON.parse(JSON.stringify(report)), pointLookups, ownerSetQueries, elapsedMs };
}
"""+text[end:]
text=text.replace('try { fn(db); return { unexpectedSuccess: true }; }','try { fn(db.db); return { unexpectedSuccess: true }; }').replace('db.close();','db.db.close();')
text += """
test('the synthetic fixture refuses extra capabilities, undeclared cases and another caller', () => {
    for (const options of [{ samples: 2 }, { samples: 1, sql: 'SELECT 1' },
        { samples: 1, db: {} }, { samples: 1, file: ':memory:' }, { samples: 1, orphan: 1 }])
        expect(() => createStartupImpactFixture(options)).toThrow('closed startup impact fixture');
    const getState = jest.spyOn(expect, 'getState');
    const state = getState();
    try {
        getState.mockReturnValue({ ...state, testPath: path.join(__dirname, 'unlisted.test.js') });
        const options = { samples: 0 };
        expect(() => createStartupImpactFixture(options)).toThrow('exact test caller');
    } finally { getState.mockRestore(); }
});

test('the fixture scanner binding refuses changed source, runtime callers and unrelated tests', () => {
    const { scanSource } = require('../helpers/workflowWriteScanner');
    const filename = 'tests/helpers/startupImpactFixture.js';
    const source = fs.readFileSync(path.join(__dirname, '../helpers/startupImpactFixture.js'), 'utf8');
    expect(scanSource(source, filename)).toEqual([]);
    expect(scanSource(source + '\\n', filename)).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'HISTORICAL_FIXTURE_SOURCE_MISMATCH' }),
        expect.objectContaining({ code: 'RAW_WORKFLOW_SQL' })]));
    expect(scanSource(source, 'controllers/canary.js')).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'RAW_WORKFLOW_SQL' })]));
    const imported = "const { createStartupImpactFixture } = require('../helpers/startupImpactFixture'); const options={samples:0}; createStartupImpactFixture(options);";
    expect(scanSource(imported, 'tests/contracts/unlisted.test.js')).toEqual([
        expect.objectContaining({ code: 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' })]);
    expect(scanSource(imported.replace('../helpers/', '../tests/helpers/'), 'controllers/canary.js')).toEqual([
        expect.objectContaining({ code: 'TEST_HELPER_IMPORTED_BY_RUNTIME' })]);
});
"""
query.write_bytes(text.encode())
scanner=R/'server/tests/helpers/workflowWriteScanner.js';text=scanner.read_text(encoding='utf-8')
anchor='const mutations = new Set('
binding="""// Performance-only startup impact equivalence: one closed in-memory builder,
// digest-bound export and explicit test caller. No runtime writer exemption.
const STARTUP_IMPACT_FIXTURE = Object.freeze({
    file: 'tests/helpers/startupImpactFixture.js', exportName: 'createStartupImpactFixture',
    sha256: '"""+hashlib.sha256(helper.read_bytes()).hexdigest()+"""',
    caller: 'tests/contracts/order_revision_impact_set_query.test.js'
});

"""
assert text.count(anchor)==1;text=text.replace(anchor,binding+anchor)
anchor='    let validAttemptFixture = false;'
addition="""    const validStartupImpactFixture = filename === STARTUP_IMPACT_FIXTURE.file &&
        createHash('sha256').update(source).digest('hex') === STARTUP_IMPACT_FIXTURE.sha256;
    if (filename === STARTUP_IMPACT_FIXTURE.file && !validStartupImpactFixture)
        report(null, 'HISTORICAL_FIXTURE_SOURCE_MISMATCH', 'The closed startup impact builder differs.');
"""
assert text.count(anchor)==1;text=text.replace(anchor,addition+anchor)
anchor='        if (validCalculationFixture && name === CALCULATION_FIXTURE.exportName) return true;'
assert text.count(anchor)==1;text=text.replace(anchor,"        if (validStartupImpactFixture && name === STARTUP_IMPACT_FIXTURE.exportName) return true;\n"+anchor)
anchor="            if (resolved === CALCULATION_PREREQUISITES.file.replace(/\\.js$/, '')) {"
addition="""            if (resolved === STARTUP_IMPACT_FIXTURE.file.replace(/\\.js$/, '')) {
                const declaration = p.parentPath;
                const allowed = filename === STARTUP_IMPACT_FIXTURE.caller && declaration.isVariableDeclarator() &&
                    declaration.get('id').isObjectPattern() && declaration.get('id.properties').length === 1 &&
                    declaration.get('id.properties').every(property => {
                        if (!property.isObjectProperty() || property.node.computed || !property.get('value').isIdentifier() ||
                            (property.node.key.name || property.node.key.value) !== STARTUP_IMPACT_FIXTURE.exportName) return false;
                        const binding = declaration.scope.getBinding(property.node.value.name);
                        return binding && binding.constantViolations.length === 0 && binding.referencePaths.length > 0 &&
                            binding.referencePaths.every(reference => reference.key === 'callee' && reference.parentPath.isCallExpression() &&
                                reference.parentPath.get('arguments').length === 1 && reference.parentPath.get('arguments.0').isIdentifier());
                    });
                if (!allowed) report(p.node, filename.startsWith('tests/') ? 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' : 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
            }
"""
assert text.count(anchor)==1;text=text.replace(anchor,addition+anchor);scanner.write_bytes(text.encode())
(D/'preparation.json').write_text(json.dumps({'newFixture':helper.relative_to(R).as_posix(),'fixtureSha256':hashlib.sha256(helper.read_bytes()).hexdigest(),
    'literalClosedMemoryDatabase':True,'soleCaller':'tests/contracts/order_revision_impact_set_query.test.js',
    'passiveSqliteTraceNotSqlForwarder':True,'existingScannerPredicatesAndNegativeAssertionsUnchanged':True,
    'newDigestAndCallerNegativeGuards':True,'testsNotRunYet':True,'productionOperations':0},indent=2),encoding='utf-8')
print(json.dumps({'status':'CLOSED_FIXTURE_AND_SCANNER_BINDING_PREPARED_NOT_TESTED','helperSha256':hashlib.sha256(helper.read_bytes()).hexdigest()}))
