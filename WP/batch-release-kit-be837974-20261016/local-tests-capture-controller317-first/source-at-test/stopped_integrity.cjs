/* Only run in the reviewed owned container with the live data mount READ ONLY.
 * No Prisma, initialization, checkpoint, backup, or write connection.
 */
'use strict';
const { createRequire } = require('node:module');
function check(database, Database) {
  const db = new Database(database, { readonly: true, fileMustExist: true });
  try {
    db.pragma('query_only = ON');
    const integrity = db.pragma('integrity_check');
    const foreign = db.pragma('foreign_key_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || foreign.length !== 0) {
      throw new Error('Stopped integrity or foreign key check refused');
    }
    return { integrity: 'ok', foreignKeyViolations: 0, readonly: true,
      fileMustExist: true, kernelReadOnlyDataMountRequired: true };
  } finally { db.close(); }
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--db' || args[1] !== '/app/server/prisma/dev.db') {
      throw new Error('Exact stopped database required');
    }
    const appRequire = createRequire('/app/server/package.json');
    process.stdout.write(JSON.stringify(check(args[1], appRequire('better-sqlite3'))) + '\n');
  } catch (error) {
    process.stderr.write('Stopped read-only integrity check refused\n');
    process.exitCode = 1;
  }
}
module.exports = { check };
