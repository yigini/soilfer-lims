const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const source = path.resolve(__dirname, '../../../client/src/utils/messageFormatter.js');
const moduleScope = { exports: {} };
vm.runInNewContext(esbuild.buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, {
    module: moduleScope, exports: moduleScope.exports,
    require: name => require(path.resolve(__dirname, '../../../client/node_modules', name))
});
const { formatMessage } = moduleScope.exports;

// Render the real bundled words with the production formatter. Tests can still
// use their old key-only stubs outside the scope they are exercising.
function localeTranslator(locale = 'en') {
    const dictionary = require(`../../../client/src/translations/${locale}.json`);
    const english = require('../../../client/src/translations/en.json');
    const lookup = (pack, key) => key.split('.').reduce((value, part) => value?.[part], pack);
    return (key, second, third) => {
        const params = second && typeof second === 'object' ? second : third && typeof third === 'object' ? third : {};
        const fallback = typeof second === 'string' ? second : typeof third === 'string' ? third : key;
        return formatMessage(lookup(dictionary, key) ?? lookup(english, key) ?? fallback, params, locale);
    };
}
module.exports = { localeTranslator };
