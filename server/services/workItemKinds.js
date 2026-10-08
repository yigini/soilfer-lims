// Pure entry classifiers shared by execution, review, and additive SQL-source
// verification. Loading migration sources must never initialize Prisma.
const GATE_CODES=new Set(['DRYING','PREPARATION','ARCHIVING','DISPOSAL']);
const PREP_CODES=new Set(['PREP','SAMPLE_PREP','SIEVING','MILLING','HOMOGENIZATION']);
const SPECTRAL_CODES=new Set(['SPEC_MIR','SPEC_VIS_NIR','SPEC_NIR','SPEC_FTIR']);
const NON_MEASUREMENT_CODES=Object.freeze([...new Set([...GATE_CODES,...PREP_CODES,...SPECTRAL_CODES,
    ...require('../workflowContract').CLOSURE_TASK_ANALYSES,...Object.keys(require('../data/operationalChecklists.json'))])].sort());
function isNonMeasurement(item) {return NON_MEASUREMENT_CODES.includes(item.analysis);}
module.exports={GATE_CODES,PREP_CODES,SPECTRAL_CODES,NON_MEASUREMENT_CODES,isNonMeasurement};
