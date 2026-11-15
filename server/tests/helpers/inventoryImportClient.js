const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const XLSX = require('../../../client/node_modules/xlsx');
const { TextEncoder } = require('node:util');
const { localeTranslator } = require('../helpers/clientTranslation');
function loadUtilities() {
    const file = path.resolve(__dirname, '../../../client/src/utils/inventoryImport.js'), module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'js', format: 'cjs' }).code, {
        module, exports: module.exports, TextEncoder, Uint8Array, ArrayBuffer, Date, require(name) {
            if (name === 'xlsx') return XLSX;
            if (name === '@lims/delimited-text') return require('../../../shared/delimitedText');
            if (name.endsWith('importColumns.json')) return require('../../../shared/importColumns.json');
            throw Error('Unexpected import utility dependency: ' + name);
        }
    });
    return module.exports;
}
const utilities = loadUtilities();
const csv = (text, name = 'practice.csv') => ({ name, size: Buffer.byteLength(text), text: async () => text });
const excel = workbook => { const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }); return { name: 'practice.xlsx', size: bytes.byteLength, arrayBuffer: async () => bytes }; };
const options = { fileName: 'practice.csv', atomic: true, duplicateMode: 'SKIP' };
module.exports = { loadUtilities, utilities, csv, excel, options };
