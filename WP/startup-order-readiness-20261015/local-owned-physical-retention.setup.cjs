// LOCAL ONLY: ordinary callbacks/assertions remain intact. Retain physical
// owned databases during Jest teardown hooks; intentional test-body probes run.
const fs = require('node:fs'), path = require('node:path'), parser = require('../../server/node_modules/@babel/parser');
const root = path.resolve(__dirname,'../..'), owned = path.join(root,'server/tests/.tmp'), cache = new Map();
const ledger = process.env.LIMS_OWNED_RETENTION_LEDGER;
if (process.env.NODE_ENV !== 'test' || !ledger || !path.resolve(ledger).startsWith(path.join(__dirname,'full-ordinary-once')))
    throw Error('Local physical retention requires the owned evidence directory.');
function ranges(file) {
    if (cache.has(file)) return cache.get(file);
    const result = [], ast = parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'unambiguous'});
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression' && ['afterAll','afterEach'].includes(node.callee?.name)) {
            const callback = node.arguments[0]; if (callback?.loc) result.push([callback.loc.start.line,callback.loc.end.line]);
        }
        // This exact test's finally block only removes its owned DB triple after all assertions.
        // Keep that physical proof; all other deliberate test-body removal probes still execute.
        if (file === path.join(root,'server/tests/contracts/audit_1_2_spectral_state.test.js') &&
            node.type === 'CallExpression' && node.callee?.name === 'test' &&
            node.arguments[0]?.value === 'a literal pre-190 measured orphan refuses the installer and COMPLETE startup without writes') {
            const cleanup = node.arguments[1]?.body?.body?.find(statement => statement.type === 'TryStatement')?.finalizer;
            if (!cleanup || cleanup.body.length !== 2 || cleanup.body[0].type !== 'IfStatement' || cleanup.body[1].type !== 'ForOfStatement')
                throw Error('Owned spectral finalizer structure changed; inspect before retention.');
            result.push([cleanup.loc.start.line,cleanup.loc.end.line]);
        }
        for (const [key,value] of Object.entries(node)) if (!['loc','start','end'].includes(key)) {
            if (Array.isArray(value)) value.forEach(visit); else if (value?.type) visit(value);
        }
    }
    visit(ast); cache.set(file,result); return result;
}
function teardown() {
    for (const line of new Error().stack.split('\n')) {
        const match = line.match(/\(?([A-Z]:\\[^()]+\.test\.js):(\d+):\d+\)?/i);
        if (match && ranges(match[1]).some(([first,last]) => +match[2]>=first && +match[2]<=last)) return true;
    }
    return false;
}
function retain(file) {
    if (typeof file !== 'string' || !teardown()) return false;
    const target = path.resolve(file);
    const local = target === owned || target.startsWith(owned + path.sep);
    const bootstrap = target.split(path.sep).some(part => /^lims_bootstrap_test_\d+_[\w-]+$/.test(part));
    if ((!local && !bootstrap) || !fs.existsSync(target)) return false;
    const stat = fs.lstatSync(target); if (stat.isSymbolicLink()) throw Error('Local retained teardown refuses an alias.');
    if (!stat.isDirectory() && !/\.db(?:-wal|-shm)?$/.test(target)) return false;
    fs.appendFileSync(ledger,JSON.stringify({retainedUtc:new Date().toISOString(),path:target,directory:stat.isDirectory(),bytes:stat.size})+'\n');
    return true;
}
for (const name of ['rmSync','unlinkSync']) {
    const original = fs[name]; fs[name] = function(file,...args) { if (!retain(file)) return original.call(this,file,...args); };
}
for (const name of ['rm','unlink']) {
    const original = fs.promises[name]; fs.promises[name] = async function(file,...args) { if (!retain(file)) return original.call(this,file,...args); };
}
