const policy = require('./policyService');
const registry = require('../config/policyRegistry');
const origin = require('./sampleOriginService');

const KEY = 'reception.intakeRules';
function profileFor({ sample, projectReference, isWalkIn }) {
    // Persisted provenance always wins over a request's walk-in/profile flags.
    return sample ? (origin.detectSampleOrigin(sample) === 'DESK_WALKIN' ? 'walkIn' : 'project')
        : (!projectReference && isWalkIn === true ? 'walkIn' : 'project');
}
async function resolve(db, input) {
    const reference = input.sample?.assignedLab || input.labId;
    const resolved = await policy.resolve(reference, KEY, { db });
    const profile = profileFor(input);
    const fields = registry.definition(KEY).intakeFields;
    return { profile, version: resolved.version, ...Object.fromEntries(Object.entries(fields).map(([group, definitions]) =>
        [group, Object.fromEntries(Object.entries(definitions).map(([name, definition]) =>
            [name, { ...definition, ...resolved.value[profile][group][name] }]))])) };
}
function object(value) {
    if (typeof value === 'string') { try { return JSON.parse(value) || {}; } catch { return {}; } }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
const present = value => value !== undefined && value !== null && value !== '';
function evaluateContext(body = {}, sample, rules) {
    const field = Object.fromEntries(Object.entries(object(sample?.fieldMetadata)).map(([key, value]) =>
        [key, value && typeof value === 'object' && Object.hasOwn(value, 'value') ? value.value : value]));
    const stored = { ...field, ...object(object(sample?.receptionData).samplingDetails) };
    const sampling = { ...stored, ...object(body.samplingDetails) };
    const first = (...values) => values.find(value => value !== undefined);
    const top = first(body.depthTopCm, sampling.depthTopCm, sampling.depthMin, sample?.depthTopCm);
    const bottom = first(body.depthBottomCm, sampling.depthBottomCm, sampling.depthMax, sample?.depthBottomCm);
    const range = typeof sampling.depthType === 'string' && /^\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(sampling.depthType);
    const date = first(sampling.date, sampling.collectionDate, sampling.samplingDate);
    const answered = {
        landUse: typeof sampling.landUse === 'string' && !!sampling.landUse.trim(),
        samplingDate: present(date) && Number.isFinite(new Date(date).getTime()),
        samplingDepth: Boolean(range) || present(top) && present(bottom) && Number.isFinite(Number(top)) &&
            Number.isFinite(Number(bottom)) && Number(top) >= 0 && Number(bottom) >= Number(top),
        composite: typeof sampling.isComposite === 'boolean'
    };
    const unansweredItems = Object.entries(rules.context).filter(([name, rule]) => rule.enabled && rule.required && !answered[name]).map(([name]) => name);
    return { isComplete: unansweredItems.length === 0, unansweredItems };
}
module.exports = { resolve, profileFor, evaluateContext };
