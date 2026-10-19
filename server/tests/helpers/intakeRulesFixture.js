// Component fixtures consume the same bounded server definitions and presets.
const registry = require('../../config/policyRegistry');
module.exports = function intakeRulesFixture(isWalkIn = false) {
    const profile = isWalkIn ? 'walkIn' : 'project';
    const definition = registry.definition('reception.intakeRules');
    const value = registry.strict('reception.intakeRules')[profile];
    return { profile, version: 0, ...Object.fromEntries(Object.entries(definition.intakeFields).map(([group, fields]) =>
        [group, Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, { ...field, ...value[group][name] }]))])) };
};
