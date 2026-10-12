// #205: structured preparation evidence that gate confirmations must carry.
function dryingRecord(overrides = {}) {
    const ended = Date.now() - 60 * 60 * 1000;
    return { gateCode: 'DRYING', method: 'OVEN_40', temperatureC: 40,
        startedAt: new Date(ended - 48 * 60 * 60 * 1000).toISOString(), endedAt: new Date(ended).toISOString(), ...overrides };
}
/** Records for a gate when the lab has no extra preparation steps configured. */
function gateRecords(gate) {
    return String(gate).toUpperCase() === 'DRYING' ? [dryingRecord()] : [];
}
module.exports = { dryingRecord, gateRecords };
