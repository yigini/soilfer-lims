// Read-only baseline comparison; no checkout, index or source mutation.
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { ESLint } = require('../../client/node_modules/eslint');
const root = path.resolve(__dirname, '../..'), client = path.join(root, 'client');
const additions = new Set(['src/components/sample/SampleContainersPanel.jsx', 'src/components/sample/ContainerLabelDialog.jsx', 'src/components/sample/AliquotSelect.jsx']);
async function run() {
    const eslint = new ESLint({ cwd: client }), current = await eslint.lintFiles(['.']);
    const counts = { current: { errors: 0, warnings: 0 }, baseline: { errors: 0, warnings: 0 } }, introduced = [];
    for (const result of current) {
        const relative = path.relative(client, result.filePath).replace(/\\/g, '/');
        let baseline = [];
        if (!additions.has(relative)) {
            let original;
            try { original = execFileSync('git', ['show', 'HEAD:client/' + relative], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
            catch { original = fs.readFileSync(result.filePath, 'utf8'); }
            baseline = (await eslint.lintText(original, { filePath: result.filePath }))[0]?.messages || [];
        }
        const key = row => row.severity + ':' + row.ruleId + ':' + row.message;
        const available = new Map();
        for (const row of baseline) { counts.baseline[row.severity === 2 ? 'errors' : 'warnings']++; available.set(key(row), (available.get(key(row)) || 0) + 1); }
        for (const row of result.messages) {
            counts.current[row.severity === 2 ? 'errors' : 'warnings']++;
            if (available.get(key(row))) available.set(key(row), available.get(key(row)) - 1);
            else introduced.push({ file: relative, severity: row.severity, rule: row.ruleId, message: row.message, line: row.line });
        }
    }
    const outcome = { baselineHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), ...counts, introduced };
    fs.writeFileSync(path.join(__dirname, 'client-lint-baseline-comparison.json'), JSON.stringify(outcome, null, 2) + '\n');
    process.stdout.write(JSON.stringify(outcome, null, 2) + '\n');
    if (introduced.some(row => row.severity === 2)) process.exitCode = 1;
}
run().catch(error => { console.error(error); process.exitCode = 1; });
