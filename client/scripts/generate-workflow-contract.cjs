const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../../server/workflowContract.js');
const target = path.resolve(__dirname, '../src/utils/workflowContract.js');
const expected = fs.readFileSync(source);
const current = fs.existsSync(target) ? fs.readFileSync(target) : Buffer.alloc(0);
if (process.argv.includes('--check')) {
    if (!expected.equals(current)) {
        console.error('Generated workflow contract differs from the server. Run the client build generator.');
        process.exitCode = 1;
    }
} else if (!expected.equals(current)) {
    fs.writeFileSync(target, expected);
}
