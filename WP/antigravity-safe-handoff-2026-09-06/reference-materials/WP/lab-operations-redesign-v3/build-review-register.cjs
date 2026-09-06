// Build a complete source catalogue triage register, not a scientific certification.
const fs = require('node:fs');
const path = require('node:path');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../../server/seeds/data/catalogue.json'), 'utf8'));
const derived = new Set(['TEXTURE','POROSITY','VOL_MOISTURE','AWC','N_MIN','Q_CO2','SAR','ESP','baseSaturation','ECEC']);
const structured = new Set(['BD_FINE','BD_WHOLE','PARTICLE_DENSITY','SOIL_MOISTURE','WATER_RET_FC','WATER_RET_PWP','K_SAT','AGG_STABILITY','MUNSELL_COLOR','LIQUID_LIMIT','PLASTIC_LIMIT','FERT_GRAN','FERT_MOIST']);
const bio = /^(SOIL_RESPIRATION|MBC|MBN|Q_CO2|ENZ_|GLOMALIN)/;
const spectra = new Set(['SPEC_MIR','SPEC_VIS_NIR','SPEC_XRF','SPEC_GRS','SPEC_NIR','SPEC_FTIR']);
function classify(a) {
  if (/^SPEC_PARAM_/.test(a.code)) return ['UNCONFIGURED', 'Quarantine from new ordering after reference reconciliation; preserve historical records'];
  if (['SAND','SILT','CLAY'].includes(a.code)) return ['PANEL_OUTPUT', 'Member of one particle-size determination; preserve analyte code, method and fractions'];
  if (spectra.has(a.code)) return ['SPECTRUM', 'File-backed acquisition with explicit instrument parser/profile; no scalar fallback'];
  if (a.code === 'SOM') return ['METHOD_DEPENDENT', 'Distinguish measured SOM from a named SOC conversion estimate'];
  if (derived.has(a.code)) return ['DERIVED_CANDIDATE', 'Verify selected procedure; require typed compatible input versions and algorithm before automated output'];
  if (a.code === 'MUNSELL_COLOR') return ['STRUCTURED', 'Hue/value/chroma and material moisture condition'];
  if (structured.has(a.code) || bio.test(a.code)) return ['STRUCTURED_METHOD', 'Raw observations, material and procedure-specific calculation; final numeric entry only when approved'];
  if (/^EXCH_(CA|MG|K|NA)$/.test(a.code)) return ['MULTI_OUTPUT_CANDIDATE', 'Compatible shared extraction may create one panel/run; do not merge incompatible methods'];
  if (/^(HM_|EXT_|GRS_)/.test(a.code)) return ['INSTRUMENT_OUTPUT_CANDIDATE', 'Verify extraction/acquisition group, units, censoring, files and output scope'];
  return ['NUMERIC_METHOD_CANDIDATE', 'Verify approved procedure and actual entry schema; this provisional label does not authorize generic numeric fallback'];
}
const counts = {};
const analyses = source.analyses.map(a => {
  const [proposedKind, disposition] = classify(a);
  counts[proposedKind] = (counts[proposedKind] || 0) + 1;
  const methodologies = source.methodologies.filter(m => m.analysisCode === a.code);
  return {
    code: a.code, name: a.name, matrix: a.matrix, unit: a.units,
    sourceStatus: a.status, categoryId: a.categoryId,
    sourceValidation: a.validation || null,
    proposedKind, disposition,
    reviewStatus: 'PENDING_LIVE_CATALOGUE_AND_LAB_PROFILE_RECONCILIATION',
    methodCount: methodologies.length,
    requiredReview: ['orderable vs output identity','active lab procedure revision','material and preparation/preservation','result schema and units/basis','QC and equipment','calculation dependencies','reporting and external mappings','historical orders/results migration'],
    methodologies: methodologies.map(m => ({ ...m, reviewStatus: 'NOT_INDIVIDUALLY_SCIENTIFICALLY_VALIDATED' }))
  };
});
const known = new Set(source.analyses.map(a => a.code));
const report = {
  source: 'server/seeds/data/catalogue.json', baseline: 'bee0b6e', date: '2026-09-06',
  status: 'Complete source inventory with provisional triage; not a production inventory or lab SOP approval',
  analysisCount: analyses.length, methodologyCount: source.methodologies.length,
  placeholderCount: analyses.filter(a => a.proposedKind === 'UNCONFIGURED').length,
  duplicateAnalysisCodes: [...new Set(source.analyses.map(a => a.code).filter((c,i,arr) => arr.indexOf(c) !== i))],
  methodologiesWithoutAnalysis: source.methodologies.filter(m => !known.has(m.analysisCode)),
  proposedKindCounts: counts, analyses
};
fs.writeFileSync(path.join(__dirname, 'catalogue-review-register.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ analysisCount: report.analysisCount, methodologyCount: report.methodologyCount, placeholderCount: report.placeholderCount, duplicateAnalysisCodes: report.duplicateAnalysisCodes, orphanMethods: report.methodologiesWithoutAnalysis.length, proposedKindCounts: counts }, null, 2));
