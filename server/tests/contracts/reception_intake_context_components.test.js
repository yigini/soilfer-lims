const fs = require('fs');
const vm = require('vm');
const path = require('path');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const fixture = require('../helpers/intakeRulesFixture');
const english = require('../../../client/src/translations/en.json');
const language = { useLanguage: () => ({ t: key => key.split('.').reduce((value, part) => value?.[part], english) || key }) };
const moduleObject = { exports: {} };
const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/reception/IntakeContextFields.jsx'), 'utf8');
vm.runInNewContext(esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' }).code, { module: moduleObject, exports: moduleObject.exports,
    require: name => name === 'react' ? { ...React, useId: () => 'context-test' } : name.includes('LanguageContext') ? language : () => null });
const Context = moduleObject.exports.default;
const missing = moduleObject.exports.missingIntakeContext;
function elements(node, predicate) {
    if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate));
    if (!node || typeof node !== 'object') return [];
    return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)];
}
test('#156 context hides disabled fields and records required false as an explicit answer', () => {
    const rules = fixture();
    rules.context.landUse.enabled = false;
    rules.context.composite.required = true;
    let sampling = {};
    const tree = Context({ sampling, rules, setSampling: update => { sampling = update(sampling); } });
    const selects = elements(tree, node => node.type === 'select');
    expect(selects).toHaveLength(1);
    expect(selects[0].props.value).toBe('');
    expect(selects[0].props.required).toBe(true);
    expect(missing(sampling, rules).map(([name]) => name)).toEqual(['composite']);
    selects[0].props.onChange({ target: { value: 'false' } });
    expect(sampling.isComposite).toBe(false);
    expect(missing(sampling, rules)).toEqual([]);
});
test('#156 required depth does not treat Custom or an empty bound as an observation', () => {
    const rules = fixture(); rules.context.samplingDepth.required = true;
    expect(missing({ depthType: 'Custom' }, rules).map(([name]) => name)).toEqual(['samplingDepth']);
    expect(missing({ depthTopCm: 0, depthBottomCm: 20 }, rules)).toEqual([]);
    expect(missing({ depthTopCm: '', depthBottomCm: 20 }, rules).map(([name]) => name)).toEqual(['samplingDepth']);
});
