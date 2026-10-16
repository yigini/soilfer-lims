const policyService = require('./policyService');
const { clone } = require('../config/policyRegistry');

// Preserve the existing profile selection for compatibility requests. Native
// sequence counts are resolved separately from the method's QC rule.
function resolveRunProfile(analysis, instrument, requestedCapacity, requestedProfile, profiles = policyService.getStrict('qc.runProfiles')) {
    const keys = Object.keys(profiles), fallback = profiles.RACK_40 ? 'RACK_40' : keys[0];
    let selected = requestedProfile && Object.hasOwn(profiles, requestedProfile) ? requestedProfile : null;
    const inst = (instrument || '').toLowerCase();
    if (!selected && (inst.includes('microplate') || inst.includes('elisa') || inst.includes('96') || requestedCapacity === 96)) {
        selected = profiles.MICROPLATE_96 ? 'MICROPLATE_96' : keys.find(key => profiles[key].capacity === requestedCapacity);
    }
    if (!selected && (inst.includes('centrifuge') || inst.includes('digest') || inst.includes('block') || inst.includes('24') || requestedCapacity === 24)) {
        selected = profiles.CENTRIFUGE_24 ? 'CENTRIFUGE_24' : keys.find(key => profiles[key].capacity === requestedCapacity);
    }
    const result = { ...clone(profiles[selected || fallback]), profileKey: selected || fallback };
    if (!selected && typeof requestedCapacity === 'number' && requestedCapacity > 0) result.capacity = requestedCapacity;
    return result;
}
async function resolveBatchRunProfile(batch, db) {
    const profiles = await policyService.get(batch.labId, 'qc.runProfiles', { db, analysisCode: batch.analysis });
    return resolveRunProfile(batch.analysis, batch.instrument, batch.maxCapacity, batch.profile, profiles);
}
module.exports = { resolveRunProfile, resolveBatchRunProfile };
