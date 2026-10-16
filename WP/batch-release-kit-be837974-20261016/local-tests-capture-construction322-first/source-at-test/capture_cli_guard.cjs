/* Fresh review capture on a retained clone. No release/209 APPLY/startup route. */
'use strict';
const { runChild } = require('./cli_guard.cjs');
const commands = new Map([
  ['capture-integrity', ['/release/stopped_integrity.cjs', '--db', '/app/server/prisma/dev.db']],
  ['capture-canonical-policy', ['/app/server/scripts/install_lab_policy_schema.js', '--db', '/app/server/prisma/dev.db', '--dry-run']],
  ['capture-206-prepare', ['/app/server/scripts/install_sample_containers.js', '--db', '/app/server/prisma/dev.db', '--apply']],
  ['capture-214-prepare', ['/app/server/scripts/install_control_charts.js', '--db', '/app/server/prisma/dev.db', '--apply']],
  ['capture-chart-impact', ['/app/server/scripts/control_chart_prebinding_impact.js', '--db', '/app/server/prisma/dev.db']],
  ['capture-order-impact', ['/release/order_impact.cjs', '--db', '/app/server/prisma/dev.db']]
]);
function validateMain(argv) {
  const [directory, label, ...child] = argv;
  if (directory !== '/tmp' || !commands.has(label) || JSON.stringify(child) !== JSON.stringify(commands.get(label)))
    throw Error('Exact retained-clone capture command required');
  return { directory, label, child };
}
if (require.main === module) {
  (async () => { const value = validateMain(process.argv.slice(2)); await runChild(value.directory, value.child); })()
    .catch(() => { process.exitCode = 1; });
}
module.exports = { validateMain };
