const fs = require('node:fs');
const path = require('node:path');
const defaults = require('../../shared/publicSupport.json');
const target = path.resolve(__dirname, '../../docs/book/src/_includes/pilot-support.md');
const expected = `<!-- Generated from shared/publicSupport.json; run node tools/docs/generate_support_contact.cjs. -->
*Pilot support:* [${defaults.contactEmail}](mailto:${defaults.contactEmail}).
`;
if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) {
        console.error('Pilot support text is out of date. Run node tools/docs/generate_support_contact.cjs.');
        process.exitCode = 1;
    }
} else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, expected, 'utf8');
}
