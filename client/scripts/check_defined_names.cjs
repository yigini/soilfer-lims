#!/usr/bin/env node
'use strict';
const path = require('node:path');
const { ESLint } = require('eslint');
const config = require('../.eslintrc.cjs');

function checker() {
    if (config.rules['no-undef'] !== 'error') throw new Error('The defined-name check requires no-undef: error.');
    // Existing lint still runs unchanged first. This additional pass includes JSX
    // and enforces the newly requested rule without changing other rule baselines.
    return new ESLint({
        cwd: path.resolve(__dirname, '..'), useEslintrc: false,
        overrideConfig: {
            env: config.env, globals: config.globals,
            plugins: [...new Set(['react', 'react-hooks', ...(config.plugins || [])])],
            parserOptions: { ...config.parserOptions, ecmaFeatures: { jsx: true } },
            rules: { 'no-undef': config.rules['no-undef'] }
        }
    });
}
async function lintSource(source, filename = 'src/defined-name-probe.jsx') {
    return checker().lintText(source, { filePath: filename });
}
async function run() {
    const eslint = checker(), results = await eslint.lintFiles(['src/**/*.js', 'src/**/*.jsx']);
    const formatter = await eslint.loadFormatter('stylish'), output = formatter.format(results);
    if (output) process.stdout.write(output);
    const errors = results.reduce((sum, row) => sum + row.errorCount, 0);
    process.stdout.write(`Defined-name check: ${results.length} JavaScript/JSX files, ${errors} errors.\n`);
    return errors ? 1 : 0;
}
module.exports = { lintSource, run };
if (require.main === module) run().then(code => { process.exitCode = code; }).catch(() => {
    process.stderr.write('Defined-name check failed.\n'); process.exitCode = 1;
});
