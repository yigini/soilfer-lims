// Read-only audit probes: pure utilities only. No app, Prisma, network or DB imports.
const { calculateUsdaTexture } = require('../../server/utils/soilCalculations');
const { evaluateItemReadiness } = require('../../server/services/workbenchReadinessService');
const { validateOperationalTask } = require('../../server/services/workbenchValidationService');
const { checkBatchDisposition } = require('../../server/services/qcService');
const cases = [
  { id: 'texture-loam', input: [50, 35, 15], expected: 'Loam', actual: calculateUsdaTexture(50, 35, 15) },
  { id: 'texture-boundary-silty-clay-loam', input: [20, 50, 30], expected: 'Silty Clay Loam', actual: calculateUsdaTexture(20, 50, 30) },
  { id: 'texture-boundary-clay-loam', input: [45, 20, 35], expected: 'Clay Loam', actual: calculateUsdaTexture(45, 20, 35) },
  { id: 'negative-fraction', input: [-5, 55, 50], expected: 'invalid', actual: calculateUsdaTexture(-5, 55, 50) },
  { id: 'missing-fraction', input: ['', 50, 50], expected: 'invalid', actual: calculateUsdaTexture('', 50, 50) },
  { id: 'implicit-one-check', expected: 'cannot demonstrate required three-step procedure', actual: validateOperationalTask([true], 1) },
  { id: 'open-qc-batch', expected: 'not sufficient evidence for a QC-required method', actual: checkBatchDisposition({ status: 'OPEN', id: 'FIXTURE' }) },
  { id: 'pre-drying-ph', expected: 'not ready', actual: evaluateItemReadiness({ analysis: 'PH_H2O', category: 'Chemical', status: 'ASSIGNED', assignedTo: 'fixture-tech', sample: { status: 'ACCEPTED', dryingStatus: 'PENDING', preparationStatus: 'PENDING' } }, { role: 'LAB_TECHNICIAN', username: 'fixture-tech' }) }
];
console.log(JSON.stringify({ baseline: 'bee0b6e', scope: 'Pure source probes; no production write-path tests', cases }, null, 2));
