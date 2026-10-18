const { referenceRows } = require('../../services/calculationReferenceLibrary');

// Entirely new public synthetic records. No file/database/runtime fixture is
// opened. Unknown methods (including all writes) fail at the DB boundary.
function worksheet203Fixture({ samples = 40, mixed = false, missingCode = false, conflictCode = false } = {}) {
    const reads = [], writes = [];
    const lab = { id: 'worksheet-lab-a', code: 'WS-A', name: 'Synthetic worksheet laboratory' };
    const foreign = { id: 'worksheet-lab-b', code: 'WS-B', name: 'Other synthetic laboratory' };
    const actor = { id: 'worksheet-actor', username: 'worksheet-technician', role: 'LAB_TECHNICIAN', labId: lab.id };
    const sampleRows = new Map(), positions = [];
    const add = (kind, fields = {}) => {
        const row = { id: `synthetic-position-${positions.length + 1}`, position: positions.length + 1, kind,
            provenance: 'NATIVE', historicalSnapshotSeq: null, references: [], workItems: [], ...fields };
        positions.push(row); return row;
    };
    add('BLANK');
    add('LRM', { references: [{ id: 'synthetic-reference', analysisCode: 'A', serviceStatus: 'SERVED', supersededById: null,
        referenceMaterialId: 'synthetic-material', referenceSnapshot: JSON.stringify({ methodologyId: 'method-A', expected: 5, lotNumber: 'RM-LOT-17' }) }] });
    for (let index = 1; index <= samples; index++) {
        const sample = { id: `synthetic-sample-${index}`, assignedLab: lab.id, labId: lab.id,
            labSampleCode: `WS-26-${String(index).padStart(3, '0')}A`, originalId: `FIELD-${index}` };
        if (index === 1 && (missingCode || conflictCode)) { sample.labSampleCode = null; if (conflictCode) sample.labId = 'CONFLICTING-OLD-CODE'; }
        sampleRows.set(sample.id, sample);
        const row = add('SAMPLE', { sampleId: sample.id });
        row.workItems = (mixed ? ['A', 'B'] : ['A']).map(analysisCode => ({ workItemId: `synthetic-work-${index}-${analysisCode}`, analysisCode,
            workItem: { id: `synthetic-work-${index}-${analysisCode}`, sampleId: sample.id, analysis: analysisCode, status: 'ASSIGNED',
                rackPosition: row.position, batchId: 'synthetic-worksheet-run', methodologyId: `method-${analysisCode}`, sample } }));
        if (index % 10 === 0) add('DUPLICATE', { sampleId: sample.id, duplicateOfPositionId: row.id });
        if (index === 20) add('BLANK');
    }
    const analyte = analysisCode => ({ id: 'synthetic-analyte-' + analysisCode, analysisCode, labId: lab.id,
        methodologyId: `method-${analysisCode}`, provenance: 'NATIVE', status: 'QC_PENDING', legacyMembershipFrozen: false,
        criteriaSnapshot: JSON.stringify({ analysisUnit: 'mg/kg', methodRevision: { methodologyId: `method-${analysisCode}`,
            name: 'Frozen synthetic method ' + analysisCode, standard: 'Synthetic SOP', version: 1 } }) });
    const batch = { id: 'synthetic-worksheet-run', labId: lab.id, analysis: 'A', status: 'OPEN', instrument: 'Synthetic instrument',
        analystUsername: actor.username, startedAt: '2026-10-18T00:00:00Z', history: '[]', positions,
        analytes: mixed ? [analyte('A'), analyte('B')] : [analyte('A')], measurements: [], evaluations: [], dispositions: [], reagentLots: [], workItems: [],
        events: [{ id: 'synthetic-start-event', type: 'RUN_STARTED', at: '2026-10-18T00:00:00Z',
            payload: JSON.stringify({ positions: positions.map(row => ({ id: row.id, servedAnalytes: ['A'] })) }) }] };
    const template = { ...referenceRows().find(row => row.templateKey === 'olsen-phosphorus'), analysisCode: 'A', labId: null, methodologyId: null };
    const model = (name, methods) => new Proxy(methods, { get(target, key) {
        if (key in target) return async args => { reads.push({ model: name, method: key, args }); return target[key](args); };
        if (typeof key === 'symbol') return target[key];
        return () => { writes.push(`${name}.${key}`); throw Error('Unexpected database operation: ' + name + '.' + key); };
    } });
    const db = {
        batch: model('batch', { findUnique: ({ where }) => where.id === batch.id ? batch : null }),
        lab: model('lab', { findUnique: ({ where }) => [lab, foreign].find(row => row.id === where.id || row.code === where.code), findMany: () => [lab, foreign] }),
        sample: model('sample', { findUnique: ({ where }) => sampleRows.get(where.id) || null, findFirst: () => conflictCode ? { id: 'other-synthetic-owner' } : null }),
        analysis: model('analysis', { findUnique: ({ where }) => ({ code: where.code, name: 'Synthetic analyte ' + where.code, units: 'mg/kg' }) }),
        methodology: model('methodology', { findUnique: () => ({ id: 'method-A', name: 'Live edited method', standard: 'New SOP', version: 99 }) }),
        calcTemplateActivation: model('calcTemplateActivation', { findMany: ({ where }) => where.analysisCode === 'A' ? [{ id: 'synthetic-activation',
            templateId: template.id, templateVersion: template.version, supersedesId: null, action: 'ACTIVATE' }] : [] }),
        calcTemplate: model('calcTemplate', { findUnique: () => template }),
        referenceMaterial: model('referenceMaterial', { findUnique: () => ({ labId: lab.id, lotNumber: 'CURRENT-LOT-NOT-USED' }) })
    };
    return { db, actor, batch, template, reads, writes, sampleRows, lab, foreign };
}
module.exports = { worksheet203Fixture };
