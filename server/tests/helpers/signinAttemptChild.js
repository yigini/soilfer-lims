// A separate process proves that account counters are shared in the owned DB.
process.env.NODE_ENV = 'test';
// Admit the dedicated new shared fixture before binding the child adapter.
// The inherited configured suite/working DB stays protected by the same guard.
const target = require('./testOwnedDatabase').assertOwnedTestDatabase(process.argv[2], 'system:fixture');
process.env.DATABASE_PATH = target;
process.env.DATABASE_URL = 'file:' + target;
const db = require('../../prisma');
require('../../services/signInService').authenticate(db, process.argv[3], 'synthetic-wrong-password', '198.51.100.99')
    .then(result => process.stdout.write(JSON.stringify({ status: result.status }) + '\n'))
    .catch(() => { process.stderr.write('Synthetic sign-in child failed.\n'); process.exitCode = 1; })
    .finally(() => db.$disconnect());
