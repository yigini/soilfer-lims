const supplied = value => value !== undefined && value !== null && value !== '' && !(typeof value === 'string' && !value.trim());
const invalid = (field, code = 'INVALID_INTAKE_OBSERVATION') => Object.assign(new Error(`Invalid ${field}.`), { statusCode: 400, code });

function nullableNumber(value, field) {
    if (!supplied(value)) return null;
    if (!['number', 'string'].includes(typeof value)) throw invalid(field);
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw invalid(field);
    return number;
}

function moisture(value) {
    if (!supplied(value)) return null;
    if (!['DRY', 'MOIST', 'WET', 'SATURATED'].includes(value)) throw invalid('moistureOnArrival');
    return value;
}

function normalizeApplications(applications, samples) {
    if (!Array.isArray(applications)) throw invalid('bulkApplications', 'BULK_APPLICATION_INVALID');
    const sampleIds = new Set(samples.map(row => String(row.originalId || row.id || '').trim()));
    return applications.map(action => {
        if (!action || !action.fields || typeof action.fields !== 'object' || Array.isArray(action.fields) ||
            !Object.keys(action.fields).length || Object.keys(action.fields).some(field => !['receivedMass', 'moistureOnArrival'].includes(field)) ||
            !Array.isArray(action.sampleIds) || !action.sampleIds.length || action.sampleIds.some(id => typeof id !== 'string' || !sampleIds.has(id))) {
            throw invalid('bulkApplications', 'BULK_APPLICATION_INVALID');
        }
        const fields = {};
        if ('receivedMass' in action.fields) fields.receivedMass = nullableNumber(action.fields.receivedMass, 'receivedMass');
        if ('moistureOnArrival' in action.fields) fields.moistureOnArrival = moisture(action.fields.moistureOnArrival);
        if (Object.values(fields).some(value => value === null)) throw invalid('bulkApplications', 'BULK_APPLICATION_INVALID');
        return { fields, sampleIds: [...new Set(action.sampleIds)] };
    });
}

function observations(row, applications) {
    const applied = {};
    for (const action of applications) if (action.sampleIds.includes(String(row.originalId || row.id || '').trim())) Object.assign(applied, action.fields);
    const own = field => Object.prototype.hasOwnProperty.call(row, field) ? row[field] : applied[field];
    return { receivedMass: nullableNumber(own('receivedMass'), 'receivedMass'), moistureOnArrival: moisture(own('moistureOnArrival')),
        positionalUncertaintyM: nullableNumber(row.positionalUncertaintyM ?? row.coordinates?.accuracy, 'positionalUncertaintyM') };
}

module.exports = { normalizeApplications, observations, nullableNumber };
