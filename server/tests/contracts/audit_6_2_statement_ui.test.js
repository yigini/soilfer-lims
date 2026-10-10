const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');
const { definition } = require('../../config/policyRegistry');
const { IntlMessageFormat } = require('../../../client/node_modules/intl-messageformat');
const elements = tree => Array.isArray(tree) ? tree.flatMap(elements) : tree && typeof tree === 'object'
    ? [tree, ...elements(tree.props?.children)] : [];
const filename = path.resolve(__dirname, '../../../client/src/components/lab/LabPolicies.jsx');
const moduleObject = { exports: {} };
vm.runInNewContext(esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
    { module: moduleObject, exports: moduleObject.exports, require: name => name === 'react' ? React
        : name === 'axios' ? require('../../../client/node_modules/axios') : {} });
const editor = moduleObject.exports.PolicyValueEditor, rule = definition('report.amendedStatement');

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('the %s template editor shows literal placeholder instructions and preserves the other locale strings', locale => {
    const pack = require('../../../client/src/translations/' + locale + '.json');
    const t = (key, params = {}) => new IntlMessageFormat(key.split('.').reduce((value, part) => value?.[part], pack), locale).format(params);
    const onChange = jest.fn(), initial = structuredClone(rule.localizedDefaults);
    const tree = editor({ definition: rule, value: initial, onChange, t });
    const help = elements(tree).find(node => node.type === 'p').props.children;
    for (const name of ['replacedNumber', 'replacedRevision', 'reason']) expect(help).toContain('{' + name + '}');
    const controls = elements(tree).filter(node => node.type === 'textarea');
    expect(controls.map(node => node.props['aria-label'])).toEqual(rule.allowedLocales);
    controls.find(node => node.props['aria-label'] === locale).props.onChange({ target: { value: 'LOCAL {replacedNumber} {replacedRevision} {reason}' } });
    expect(onChange).toHaveBeenCalledWith({ ...initial, [locale]: 'LOCAL {replacedNumber} {replacedRevision} {reason}' });
    expect(rule.localizedDefaults).toEqual(initial);
});

test('switching between localized defaults and a custom laboratory object makes a copy and restores null explicitly', () => {
    const onChange = jest.fn(), t = key => key;
    const tree = editor({ definition: rule, value: null, onChange, t });
    expect(elements(tree).filter(node => node.type === 'textarea')).toHaveLength(0);
    const select = elements(tree).find(node => node.type === 'select');
    select.props.onChange({ target: { value: 'custom' } });
    expect(onChange).toHaveBeenLastCalledWith(rule.localizedDefaults);
    expect(onChange.mock.calls[0][0]).not.toBe(rule.localizedDefaults);
    select.props.onChange({ target: { value: 'default' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
});
