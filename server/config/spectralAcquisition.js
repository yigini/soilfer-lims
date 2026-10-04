// These work items record scans rather than scalar Results. GRS and XRF still
// use the scalar batch-save path and are deliberately not acquisition-only.
const SPECTRAL_ACQUISITION_CODES = Object.freeze(['SPEC_MIR', 'SPEC_VIS_NIR', 'SPEC_NIR', 'SPEC_FTIR']);

module.exports = { SPECTRAL_ACQUISITION_CODES };
