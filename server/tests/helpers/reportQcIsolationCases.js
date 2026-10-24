const cases = [];
function add(key, path, body, query) { cases.push({ key, path, ...(body && { body }), ...(query && { query }) }); }
const report = '/api/reports/{reportA}', published = '/api/reports/{publishedReportA}', run = '/api/qc/batches/{batchA}';
add('GET /api/reports/:reportId', report);
add('GET /api/reports/:reportId/pdf', `${report}/pdf`);
cases[cases.length - 1].mustDeny = true;
add('GET /api/reports/:reportId/links', `${published}/links`);
add('GET /api/reports/sample/:sampleId', '/api/reports/sample/{sampleA}');
add('GET /api/reports/sample/:sampleId/pdf', '/api/reports/sample/{sampleA}/pdf');
cases[cases.length - 1].mustDeny = true;
add('GET /api/reports/search', '/api/reports/search', null, { q: '{sampleA}', projectCode: '{projectA}', labId: '{labA}' });
add('POST /api/reports/generate/:sampleId', '/api/reports/generate/{sampleA}', {});
add('POST /api/reports/:reportId/share', `${published}/share`, { expiresInDays: 1 });
add('POST /api/reports/links/:linkId/revoke', '/api/reports/links/{shareA}/revoke', {});
for (const suffix of ['', '/pdf']) cases.push({ key: `GET /api/reports/public/:token${suffix}`,
    path: `/api/reports/public/{sampleA}${suffix}`, expectedStatus: 404,
    globalReason: 'Public reports require an explicit share capability; a real private sample ID cannot act as that capability.' });

const series = { labId: '{labA}', analysisCode: 'PH_H2O', methodologyId: '{methodA}', referenceMaterialId: '{referenceA}' };
const blankSeries = { labId: '{labA}', analysisCode: 'PH_H2O', methodologyId: '{methodA}', methodRevision: 1, analysisUnit: 'pH' };
add('GET /api/qc/batches', '/api/qc/batches', null, { labId: '{labA}', analysis: 'PH_H2O' });
add('GET /api/qc/batches/:id', run);
add('GET /api/qc/batches/:id/calibration-curves', `${run}/calibration-curves`, null, { analysisCode: 'PH_H2O' });
add('GET /api/qc/batches/:id/reagent-lot-options', `${run}/reagent-lot-options`, null, { inventoryLotId: '{inventoryLotA}' });
add('GET /api/qc/run-options', '/api/qc/run-options', null, { labId: '{labA}', analysisCode: 'PH_H2O', methodologyId: '{methodA}', workItemIds: '["{workItemA}"]' });
add('GET /api/qc/rules', '/api/qc/rules', null, series);
add('POST /api/qc/rules', '/api/qc/rules', { ...series, criteria: { blankPerBatch: 1 }, expectedVersion: 1, reason: 'Synthetic QC rule revision' });
add('POST /api/qc/batches', '/api/qc/batches', { workItemIds: ['{workItemA}'], labId: '{labA}', analysis: 'PH_H2O', methodologyId: '{methodA}' });
add('POST /api/qc/runs/start', '/api/qc/runs/start', { labId: '{labA}', analysisCode: 'PH_H2O', methodologyId: '{methodA}', workItemIds: ['{workItemA}'] });
add('PUT /api/qc/batches/:id', run, { analysisCode: 'PH_H2O' });
add('POST /api/qc/batches/:id/evaluate', `${run}/evaluate`, { analysisCode: 'PH_H2O' });
add('POST /api/qc/batches/:id/preview', `${run}/preview`, [{ analysisCode: 'PH_H2O', positionId: '{blankPositionA}', rawInput: '0.01' }]);
add('POST /api/qc/batches/:id/corrections', `${run}/corrections`, { analysisCode: 'PH_H2O', mode: 'REVIEWED_CORRECTION', reason: 'Synthetic reviewed correction' });
add('POST /api/qc/batches/:id/start', `${run}/start`, {});
add('POST /api/qc/batches/:id/rebuild', `${run}/rebuild`, { labId: '{labA}', analysis: 'PH_H2O', methodologyId: '{methodA}', workItemIds: ['{workItemA}'] });
add('POST /api/qc/batches/:id/reorder', `${run}/reorder`, { positionIds: ['{blankPositionA}', '{positionA}'] });
for (const method of ['POST', 'DELETE']) add(`${method} /api/qc/batches/:id/items`, `${run}/items`, { workItemIds: ['{workItemA}'] });
add('POST /api/qc/batches/:id/calibration-curves', `${run}/calibration-curves`, { analysisCode: 'PH_H2O', expectedCurveId: null,
    points: [{ concentration: 1, response: 2 }, { concentration: 2, response: 4 }, { concentration: 3, response: 6 }], reason: 'Synthetic calibration curve' });
add('POST /api/qc/batches/:id/reagent-lots', `${run}/reagent-lots`, { inventoryLotId: '{inventoryLotA}', role: 'Synthetic reagent' });
add('POST /api/qc/batches/:id/reagent-lots/:lotId/withdraw', `${run}/reagent-lots/{inventoryLotA}/withdraw`, { reason: 'Synthetic reagent withdrawal' });
add('POST /api/qc/batches/:id/disposition', `${run}/disposition`, { decision: 'REPEAT_BATCH', analysisCode: 'PH_H2O', reason: 'Synthetic QC disposition' });
add('GET /api/qc/control-charts/series', '/api/qc/control-charts/series', null, series);
add('GET /api/qc/control-charts', '/api/qc/control-charts', null, series);
add('GET /api/qc/control-reviews', '/api/qc/control-reviews', null, { labId: '{labA}' });
add('POST /api/qc/control-limit-proposals', '/api/qc/control-limit-proposals', { ...series,
    selectedMeasurementIds: [], exclusions: [], reason: 'Synthetic control-chart proposal' });
add('POST /api/qc/control-limit-proposals/:id/approve', '/api/qc/control-limit-proposals/{proposalA}/approve', {});
add('POST /api/qc/control-reviews/:id/resolve', '/api/qc/control-reviews/{controlReviewA}/resolve', { outcome: 'NO_ACTION', note: 'Synthetic retained review' });
add('GET /api/qc/blank-history/series', '/api/qc/blank-history/series', null, blankSeries);
add('GET /api/qc/blank-history', '/api/qc/blank-history', null, blankSeries);
add('POST /api/qc/lod-loq-proposals', '/api/qc/lod-loq-proposals', { ...blankSeries, selectedMeasurementIds: [], exclusions: [],
    fingerprint: 'synthetic-owned-history', requestId: '11111111-1111-4111-8111-111111111111', reason: 'Synthetic LOD proposal' });

module.exports = cases;
