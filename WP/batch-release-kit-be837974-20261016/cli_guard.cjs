/* Release-owned CLI supervisor. No installer timeout/heap override is added.
 * The parent controller captures final memory.events after child completion,
 * then permits this wrapper to exit. All files stay in its retained /tmp bind.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const output = require('./cli_output.cjs');
const { temporaryDirectory } = require('./sqlite_temp_directory.cjs');
const scripts = new Set([
  'install_sample_containers.js', 'install_control_charts.js',
  'install_order_revisions.js', 'install_lab_policy_schema.js',
  'control_chart_prebinding_impact.js'
]);
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
function requireValue(value, message) { if (!value) throw new Error(message); }
function writeOnce(filename, raw) {
  requireValue(!fs.existsSync(filename), 'Published CLI record already consumed');
  const pending = filename + '.pending';
  const fd = fs.openSync(pending, 'wx', 0o600);
  try { fs.writeFileSync(fd, raw); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.chmodSync(pending, 0o400);
  // The final name appears only after complete bytes are fsynced. Retain the
  // pending hardlink too; no unlink, overwrite or cleanup is performed.
  fs.linkSync(pending, filename);
  if (process.platform !== 'win32') {
    const directoryFd = fs.openSync(path.dirname(filename), 'r');
    try { fs.fsyncSync(directoryFd); }
    finally { fs.closeSync(directoryFd); }
  }
}
function validateMain(argv) {
  requireValue(argv[0] === '/tmp', 'Exact retained control directory required');
  const child = argv.slice(1);
  if (['/release/stopped_integrity.cjs', '/release/live_backup.cjs', '/release/order_impact.cjs'].includes(child[0])) {
    requireValue(child.length === 3 && child[1] === '--db' && child[2] === '/app/server/prisma/dev.db', 'Exact stopped integrity arguments required');
    return { directory: argv[0], child };
  }
  requireValue(child.length >= 3 && child[0].startsWith('/app/server/scripts/') && scripts.has(path.posix.basename(child[0])) && path.posix.dirname(child[0]) === '/app/server/scripts', 'Only bound release CLI scripts permitted');
  requireValue(child[1] === '--db' && child[2] === '/app/server/prisma/dev.db', 'Exact release database path required');
  const impact = child[0].endsWith('_impact.js');
  requireValue(impact ? child.length === 3 : child.length === 4 && ['--dry-run', '--apply'].includes(child[3]), 'Exact installer/impact arguments required');
  requireValue(!child[0].endsWith('/install_lab_policy_schema.js') || child[3] === '--dry-run', 'Existing canonical policy may only be checked read-only');
  return { directory: argv[0], child };
}
async function runChild(directory, child, routing = temporaryDirectory) {
  const complete = path.join(directory, 'cli-child-complete.json');
  const permit = path.join(directory, 'cli-exit-permit.json');
  requireValue(!fs.existsSync(complete) && !fs.existsSync(permit), 'CLI control paths already consumed');
  output.readAdmission(directory, child);
  const temporary = routing(directory);
  const began = process.hrtime.bigint();
  let result;
  try {
    result = await output.capture(directory, child);
    // The scientific child has really closed. Routing failure never signals
    // it or creates a new transaction deadline, and cannot publish success.
    temporary.check();
  } finally { temporary.close(); }
  const record = Buffer.from(JSON.stringify({ childStatus: result.status, childSignal: result.signal,
    childErrorType: result.errorType,
    childSeconds: Number(process.hrtime.bigint() - began) / 1e9,
    argvSha256: hash(Buffer.from(JSON.stringify(child))), neverRetry: true, output: result.output }) + '\n');
  requireValue(record.length <= 8192, 'CLI completion exceeds its pre-create envelope');
  writeOnce(complete, record);
  const timer = setInterval(() => {
    if (!fs.existsSync(permit)) return;
    try {
      const value = JSON.parse(fs.readFileSync(permit, 'utf8'));
      requireValue(value.childCompletionSha256 === hash(record) && value.finalHostMemoryEventsCaptured === true,
        'Final host memory permission differs');
      clearInterval(timer);
      process.exit(result.status === 0 && result.signal === null && !result.errorType && result.output.completeOriginals ? 0 : 1);
    } catch (error) {
      clearInterval(timer);
      process.exit(1);
    }
  }, 50);
}
if (require.main === module) {
  (async () => { const value = validateMain(process.argv.slice(2)); await runChild(value.directory, value.child); })()
    .catch(() => { process.exitCode = 1; });
}
module.exports = { validateMain, runChild };
