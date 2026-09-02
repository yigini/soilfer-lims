/**
 * FAO SoilFER Scientific & Agronomic Interpretation Engine
 * 
 * Implements standard controlled unit vocabulary, automated unit conversions,
 * individual parameter agronomic classifications (FAO GLOSOLAN standards),
 * and holistic soil stoichiometry (Texture, C:N, Base Saturation, Ca:Mg, SAR/ESP).
 */

const { calculateUsdaTexture, evaluateCnRatio, evaluateCecAndBases } = require('../utils/soilCalculations');

// =============================================================================
// 1. CONTROLLED UNIT VOCABULARY & CONVERSION FACTORS (WP-16, WP-05)
// =============================================================================
const UNIT_REGISTRY = {
    // Routine Acidity
    'PH_H2O': { standard: 'pH units', method: 'Potentiometry in 1:2.5 or 1:5 soil:water suspension', synonyms: ['pH', 'units', 'dimensionless', ''] },
    'PH_CACL2': { standard: 'pH units', method: 'Potentiometry in 0.01 M CaCl2 (1:5 soil:solution)', synonyms: ['pH', 'units', 'dimensionless', ''] },
    'PH_KCL': { standard: 'pH units', method: 'Potentiometry in 1 M KCl reserve acidity', synonyms: ['pH', 'units', 'dimensionless', ''] },
    'pH': { standard: 'pH units', method: 'Potentiometry in soil:water suspension', synonyms: ['pH', 'units', 'dimensionless', ''] },

    // Salinity
    'EC': { standard: 'µS/cm', method: 'Conductometry in 1:5 soil:water suspension', synonyms: ['uS/cm', 'µS/cm', 'microS/cm', 'us/cm'], conversions: { 'dS/m': 1000, 'mS/cm': 1000, 'mS/m': 10 } },
    'electricalConductivity': { standard: 'µS/cm', method: 'Conductometry in 1:5 soil:water suspension', synonyms: ['uS/cm'], conversions: { 'dS/m': 1000, 'mS/cm': 1000 } },
    'EC_E': { standard: 'dS/m', method: 'Conductometry in saturated paste extract (USDA Handbook 60)', synonyms: ['mS/cm', 'dS/m'], conversions: { 'µS/cm': 0.001, 'uS/cm': 0.001 } },

    // Organic Carbon & Nitrogen
    'SOC': { standard: 'g/kg', method: 'Walkley-Black chromic acid wet oxidation or dry combustion', synonyms: ['g/kg', 'g kg-1', 'g C/kg'], conversions: { '%': 10, 'mg/g': 1, 'mg/kg': 0.001 } },
    'carbonOrganic': { standard: 'g/kg', method: 'Walkley-Black or dry combustion', synonyms: ['g/kg'], conversions: { '%': 10 } },
    'SOM': { standard: 'g/kg', method: 'Soil organic matter estimated or LOI', synonyms: ['g/kg'], conversions: { '%': 10 } },
    'organicMatter': { standard: 'g/kg', method: 'Soil organic matter estimated or LOI', synonyms: ['g/kg'], conversions: { '%': 10 } },
    'POXC': { standard: 'mg/kg', method: 'Permanganate-oxidizable active carbon (Weil et al. 2003)', synonyms: ['mg/kg', 'ppm'] },
    'TN': { standard: 'g/kg', method: 'Macro/micro Kjeldahl digestion or Dumas dry combustion', synonyms: ['g/kg', 'g N/kg'], conversions: { '%': 10, 'mg/kg': 0.001 } },
    'nitrogenTotal': { standard: 'g/kg', method: 'Kjeldahl digestion or Dumas combustion', synonyms: ['g/kg'], conversions: { '%': 10 } },
    'N_NO3': { standard: 'mg/kg', method: '2 M KCl extraction with cadmium reduction / automated segmented flow', synonyms: ['mg/kg', 'ppm', 'mg N/kg'] },
    'N_NH4': { standard: 'mg/kg', method: '2 M KCl extraction with Berthelot reaction colorimetry', synonyms: ['mg/kg', 'ppm', 'mg N/kg'] },
    'N_MIN': { standard: 'mg/kg', method: 'Sum of inorganic ammonium and nitrate nitrogen', synonyms: ['mg/kg', 'ppm'] },

    // Phosphorus
    'P_OLSEN': { standard: 'mg/kg', method: 'Olsen 0.5 M NaHCO3 extraction at pH 8.5 (1:20 ratio)', synonyms: ['mg/kg', 'ppm', 'mg P/kg'], conversions: { 'mg/100g': 10 } },
    'P_BRAY1': { standard: 'mg/kg', method: 'Bray & Kurtz No. 1 dilute acid fluoride (0.03 M NH4F + 0.025 M HCl, 1:7 ratio)', synonyms: ['mg/kg', 'ppm', 'mg P/kg'], conversions: { 'mg/100g': 10 } },
    'P_BRAY2': { standard: 'mg/kg', method: 'Bray & Kurtz No. 2 acid fluoride (0.03 M NH4F + 0.1 M HCl, 1:7 ratio)', synonyms: ['mg/kg', 'ppm'], conversions: { 'mg/100g': 10 } },
    'P_MEHLICH3': { standard: 'mg/kg', method: 'Mehlich 3 multi-nutrient extractant (1:10 ratio)', synonyms: ['mg/kg', 'ppm'], conversions: { 'mg/100g': 10 } },
    'P_MEHLICH1': { standard: 'mg/kg', method: 'Mehlich 1 double acid extractant (0.05 M HCl + 0.0125 M H2SO4, 1:5 ratio)', synonyms: ['mg/kg', 'ppm'], conversions: { 'mg/100g': 10 } },
    'P_TOTAL': { standard: 'mg/kg', method: 'Aqua regia or perchloric acid digestion', synonyms: ['mg/kg', 'ppm'], conversions: { '%': 10000, 'g/kg': 1000 } },

    // Exchangeable Cations & CEC (WP-05 conversion factors: atomic mass / charge * 10)
    'EXCH_CA': { standard: 'cmol(+)/kg', method: '1 M NH4OAc extraction at pH 7.0 (1:10 ratio)', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g', 'meq/100 g', 'cmoL/kg'], conversions: { 'mg/kg': 1/200.4, 'ppm': 1/200.4 } },
    'EXCH_MG': { standard: 'cmol(+)/kg', method: '1 M NH4OAc extraction at pH 7.0 (1:10 ratio)', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'], conversions: { 'mg/kg': 1/121.6, 'ppm': 1/121.6 } },
    'EXCH_K': { standard: 'cmol(+)/kg', method: '1 M NH4OAc extraction at pH 7.0 (1:10 ratio)', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'], conversions: { 'mg/kg': 1/391, 'ppm': 1/391 } },
    'EXCH_NA': { standard: 'cmol(+)/kg', method: '1 M NH4OAc extraction at pH 7.0 (1:10 ratio)', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'], conversions: { 'mg/kg': 1/229.9, 'ppm': 1/229.9 } },
    'EXCH_AL': { standard: 'cmol(+)/kg', method: '1 M unbuffered KCl extraction with NaF titration', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'EXCH_ACID': { standard: 'cmol(+)/kg', method: '1 M unbuffered KCl extraction with 0.05 M NaOH titration', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'CEC': { standard: 'cmol(+)/kg', method: 'Compulsive exchange in 1 M NH4OAc at pH 7.0 (ISO 11260)', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'ECEC': { standard: 'cmol(+)/kg', method: 'Effective CEC sum of basic cations and exchangeable acidity at soil pH', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'baseSaturation': { standard: '%', method: 'Calculated base saturation: (Ca + Mg + K + Na) / CEC * 100', synonyms: ['%', 'percent', 'percentage'] },

    // Texture & Particle Size
    'SAND': { standard: '%', method: 'Sedimentation pipette or Bouyoucos hydrometer', synonyms: ['%', 'percent'], conversions: { 'g/kg': 0.1 } },
    'SILT': { standard: '%', method: 'Sedimentation pipette or Bouyoucos hydrometer', synonyms: ['%', 'percent'], conversions: { 'g/kg': 0.1 } },
    'CLAY': { standard: '%', method: 'Sedimentation pipette (<2µm) or Bouyoucos hydrometer', synonyms: ['%', 'percent'], conversions: { 'g/kg': 0.1 } },
    'COARSE_FRAG': { standard: '%', method: 'Sieve separation (>2 mm gravimetric)', synonyms: ['%'] },
    'BD_FINE': { standard: 'g/cm³', method: 'Undisturbed cylinder core 105°C oven-dried', synonyms: ['g/cm3', 'g/cm^3', 'g/ml', 'kg/dm3', 'Mg/m3', 'g/cm³'] },
    'bulkDensityFineEarth': { standard: 'g/cm³', method: 'Undisturbed core cylinder', synonyms: ['g/cm3', 'g/cm³'] },

    // Micronutrients & Secondary
    'EXT_S': { standard: 'mg/kg', method: 'Monocalcium phosphate extraction with turbidimetric or ICP finish', synonyms: ['mg/kg', 'ppm', 'mg S/kg'] },
    'EXT_ZN': { standard: 'mg/kg', method: '0.005 M DTPA-TEA extraction at pH 7.3 (ISO 14870)', synonyms: ['mg/kg', 'ppm', 'mg Zn/kg'] },
    'EXT_FE': { standard: 'mg/kg', method: '0.005 M DTPA-TEA extraction at pH 7.3 (ISO 14870)', synonyms: ['mg/kg', 'ppm', 'mg Fe/kg'] },
    'EXT_CU': { standard: 'mg/kg', method: '0.005 M DTPA-TEA extraction at pH 7.3 (ISO 14870)', synonyms: ['mg/kg', 'ppm', 'mg Cu/kg'] },
    'EXT_MN': { standard: 'mg/kg', method: '0.005 M DTPA-TEA extraction at pH 7.3 (ISO 14870)', synonyms: ['mg/kg', 'ppm', 'mg Mn/kg'] },
    'EXT_B': { standard: 'mg/kg', method: 'Hot water reflux with azomethine-H spectrophotometry', synonyms: ['mg/kg', 'ppm', 'mg B/kg'] },
    'EXT_MO': { standard: 'mg/kg', method: 'Acid ammonium oxalate extraction', synonyms: ['mg/kg', 'ppm'] },

    // Carbonates & Lime
    'CACO3': { standard: '%', method: 'Bernard calcimeter volumetric CO2 evolution with 4 M HCl', synonyms: ['%', 'percent'], conversions: { 'g/kg': 0.1 } },
    'totalCarbonateEquivalent': { standard: '%', method: 'Bernard calcimeter volumetric CO2 evolution', synonyms: ['%'], conversions: { 'g/kg': 0.1 } },
    'ACTIVE_CACO3': { standard: '%', method: 'Drouineau ammonium oxalate reactive lime', synonyms: ['%'], conversions: { 'g/kg': 0.1 } },
    'LIME_REQ': { standard: 't/ha', method: 'SMP or Woodruff buffer method', synonyms: ['t/ha', 'ton/ha', 'tonne/ha'] },

    // Heavy Metals
    'HM_CD': { standard: 'mg/kg', method: 'Aqua regia microwave digestion (ISO 11466)', synonyms: ['mg/kg', 'ppm'] },
    'HM_PB': { standard: 'mg/kg', method: 'Aqua regia microwave digestion (ISO 11466)', synonyms: ['mg/kg', 'ppm'] },
    'HM_AS': { standard: 'mg/kg', method: 'Hydride generation / ICP-OES', synonyms: ['mg/kg', 'ppm'] },
    'HM_CR': { standard: 'mg/kg', method: 'Aqua regia microwave digestion (ISO 11466)', synonyms: ['mg/kg', 'ppm'] },
    'HM_NI': { standard: 'mg/kg', method: 'Aqua regia microwave digestion (ISO 11466)', synonyms: ['mg/kg', 'ppm'] }
};

// =============================================================================
// 2. UNIT NORMALIZATION HELPER (WP-04 Fail-Closed)
// =============================================================================
/**
 * Normalizes an input value and unit to standard controlled unit.
 * Refuses unrecognised units and returns null normalizedValue (WP-04).
 * @param {string} param - Analysis code
 * @param {number|string} value - Numerical result
 * @param {string} [inputUnit] - Provided unit
 * @returns {{ normalizedValue: number|null, standardUnit: string, wasConverted: boolean, factor: number, unrecognizedUnit?: string }}
 */
function normalizeUnit(param, value, inputUnit = '') {
    const pCode = String(param || '').toUpperCase();
    const num = Number(value);
    if (isNaN(num)) {
        return { normalizedValue: null, standardUnit: '', wasConverted: false, factor: 1 };
    }

    const rule = UNIT_REGISTRY[pCode] || UNIT_REGISTRY[param];
    if (!rule) {
        return { normalizedValue: null, standardUnit: inputUnit || '', wasConverted: false, factor: 1, unrecognizedUnit: inputUnit };
    }

    const trimmedUnit = String(inputUnit || '').trim();
    if (!trimmedUnit || rule.synonyms.includes(trimmedUnit) || trimmedUnit.toLowerCase() === rule.standard.toLowerCase()) {
        return { normalizedValue: num, standardUnit: rule.standard, wasConverted: false, factor: 1 };
    }

    if (rule.conversions && rule.conversions[trimmedUnit] !== undefined) {
        const factor = rule.conversions[trimmedUnit];
        const converted = Number((num * factor).toFixed(4));
        return { normalizedValue: converted, standardUnit: rule.standard, wasConverted: true, factor };
    }

    // WP-04: Fail closed on unrecognised unit
    return {
        normalizedValue: null,
        standardUnit: rule.standard,
        wasConverted: false,
        factor: 1,
        unrecognizedUnit: trimmedUnit
    };
}

// =============================================================================
// 3. AGRONOMIC INTERPRETATION RULES (WP-18, WP-23, FAO Tier-5 Standards)
// =============================================================================
const PARAMETER_EVALUATORS = {
    'PH_H2O': (v) => {
        const method = 'Potentiometry in 1:2.5 or 1:5 Soil:Water Suspension (ISO 10390)';
        if (v < 4.5) return { rating: 'VERY_LOW', label: 'Extremely Acidic', advisory: 'Severe Al toxicity risk; critical lime application required.', method };
        if (v < 5.5) return { rating: 'LOW', label: 'Strongly Acidic', advisory: 'P-fixation likely; liming recommended for acid-sensitive crops.', method };
        if (v < 6.5) return { rating: 'MODERATE', label: 'Moderately Acidic', advisory: 'Adequate for most acid-tolerant crops; light liming beneficial.', method };
        if (v <= 7.3) return { rating: 'OPTIMAL', label: 'Neutral (Optimal)', advisory: 'Optimal nutrient availability for most agronomic crops.', method };
        if (v <= 8.4) return { rating: 'HIGH', label: 'Moderately Alkaline', advisory: 'Calcareous condition; micronutrient availability (Fe, Zn) may be restricted.', method };
        return { rating: 'VERY_HIGH', label: 'Strongly Alkaline / Sodic', advisory: 'Potential sodicity or high carbonate hazard; gypsum/acid amendment indicated.', method };
    },
    'PH_CACL2': (v) => {
        const method = 'Potentiometry in 0.01 M CaCl2 (1:5 soil:solution ratio)';
        if (v < 4.0) return { rating: 'VERY_LOW', label: 'Extremely Acidic (CaCl₂)', advisory: 'Severe aluminum toxicity hazard; immediate agricultural liming required.', method };
        if (v < 5.0) return { rating: 'LOW', label: 'Strongly Acidic (CaCl₂)', advisory: 'P and Mo availability restricted; lime application recommended.', method };
        if (v < 6.0) return { rating: 'MODERATE', label: 'Moderately Acidic (CaCl₂)', advisory: 'Suitable for acid-tolerant crops; maintenance liming indicated.', method };
        if (v <= 6.8) return { rating: 'OPTIMAL', label: 'Neutral / Optimal (CaCl₂)', advisory: 'Optimal nutrient availability for standard field crops.', method };
        if (v <= 7.9) return { rating: 'HIGH', label: 'Moderately Alkaline (CaCl₂)', advisory: 'Calcareous or alkaline condition; monitor micronutrient uptake.', method };
        return { rating: 'VERY_HIGH', label: 'Strongly Alkaline / Calcareous (CaCl₂)', advisory: 'Severe alkaline hazard; consider acidifying amendments.', method };
    },
    'SOC': (v) => {
        const method = 'Walkley-Black Wet Oxidation / Dry Combustion (g/kg)';
        if (v < 6.0) return { rating: 'VERY_LOW', label: 'Very Low SOC (< 0.6%)', advisory: 'Depleted soil organic matter; incorporate compost, biochar, or cover crops.', method };
        if (v < 12.0) return { rating: 'LOW', label: 'Low SOC (0.6 - 1.2%)', advisory: 'Sub-optimal organic carbon; regular organic residue retention recommended.', method };
        if (v < 20.0) return { rating: 'MODERATE', label: 'Moderate SOC (1.2 - 2.0%)', advisory: 'Adequate for conventional cropping systems.', method };
        if (v <= 35.0) return { rating: 'OPTIMAL', label: 'High SOC (2.0 - 3.5%)', advisory: 'High biological activity and moisture retention.', method };
        return { rating: 'VERY_HIGH', label: 'Very High SOC (> 3.5%)', advisory: 'Rich humic or volcanic soil.', method };
    },
    'SOM': (v) => {
        const method = 'Soil Organic Matter Estimated (g/kg)';
        if (v < 10.0) return { rating: 'VERY_LOW', label: 'Very Low SOM (< 1%)', advisory: 'Critically depleted organic matter.', method };
        if (v < 20.0) return { rating: 'LOW', label: 'Low SOM (1 - 2%)', advisory: 'Low organic buffer capacity.', method };
        if (v <= 40.0) return { rating: 'OPTIMAL', label: 'Moderate/Optimal SOM (2 - 4%)', advisory: 'Balanced organic matter.', method };
        return { rating: 'HIGH', label: 'High SOM (> 4%)', advisory: 'Excellent organic structure.', method };
    },
    'TN': (v, options = {}) => {
        const matrix = String(options.matrix || 'SOIL').toUpperCase();
        if (matrix === 'PLANT') {
            const method = 'Total Nitrogen in Plant Tissue (Kjeldahl / Dumas Combustion)';
            if (v < 20.0) return { rating: 'LOW', label: 'Deficient Plant Tissue N (< 2.0%)', advisory: 'Nitrogen deficiency detected in plant tissue; foliar or soil N topdress indicated.', method };
            if (v <= 40.0) return { rating: 'OPTIMAL', label: 'Adequate Plant Tissue N (2.0 - 4.0%)', advisory: 'Balanced foliar nitrogen status within target sufficiency range.', method };
            return { rating: 'HIGH', label: 'Excessive Plant Tissue N (> 4.0%)', advisory: 'Elevated nitrogen; risk of vegetative overgrowth or nitrate accumulation.', method };
        }
        const method = 'Total Soil Nitrogen (Macro/Micro Kjeldahl or Dumas Combustion)';
        if (v < 0.8) return { rating: 'LOW', label: 'Low Nitrogen (< 0.08%)', advisory: 'Nitrogen deficiency likely; supplemental N fertilizer recommended.', method };
        if (v <= 2.5) return { rating: 'OPTIMAL', label: 'Adequate Nitrogen (0.08 - 0.25%)', advisory: 'Balanced nitrogen status.', method };
        return { rating: 'HIGH', label: 'High Nitrogen (> 0.25%)', advisory: 'High available N; avoid excess synthetic application to prevent leaching.', method };
    },
    'P_OLSEN': (v) => {
        const method = 'Olsen Sodium Bicarbonate Extraction 0.5 M NaHCO3 at pH 8.5 (1:20 ratio)';
        if (v < 7.0) return { rating: 'VERY_LOW', label: 'Deficient (< 7 mg/kg)', advisory: 'Severe P deficiency; apply starter/broadcast P fertilizer.', method };
        if (v <= 15.0) return { rating: 'LOW', label: 'Marginal (7 - 15 mg/kg)', advisory: 'Moderate P supply; maintenance P fertilization recommended.', method };
        if (v <= 25.0) return { rating: 'OPTIMAL', label: 'Adequate (15 - 25 mg/kg)', advisory: 'Optimal soil phosphorus status.', method };
        return { rating: 'HIGH', label: 'High / Excessive (> 25 mg/kg)', advisory: 'High phosphorus reserve; omit P fertilization to minimize runoff risks.', method };
    },
    'P_BRAY1': (v) => {
        const method = 'Bray & Kurtz No. 1 Acid Fluoride (0.03 M NH4F + 0.025 M HCl, 1:7 ratio)';
        if (v < 10.0) return { rating: 'LOW', label: 'Deficient (< 10 mg/kg)', advisory: 'P fertilization required.', method };
        if (v <= 25.0) return { rating: 'OPTIMAL', label: 'Adequate (10 - 25 mg/kg)', advisory: 'Optimal available P.', method };
        return { rating: 'HIGH', label: 'High (> 25 mg/kg)', advisory: 'High available P.', method };
    },
    'P_BRAY2': (v) => {
        const method = 'Bray & Kurtz No. 2 Acid Fluoride (0.03 M NH4F + 0.1 M HCl, 1:7 ratio)';
        if (v < 15.0) return { rating: 'LOW', label: 'Deficient (< 15 mg/kg)', advisory: 'Available P deficient for crops; broadcast P fertilizer recommended.', method };
        if (v <= 40.0) return { rating: 'OPTIMAL', label: 'Adequate (15 - 40 mg/kg)', advisory: 'Optimal available phosphorus reserve under Bray-2 extractant.', method };
        return { rating: 'HIGH', label: 'High (> 40 mg/kg)', advisory: 'Abundant phosphorus; omit additional P fertilizer.', method };
    },
    'P_MEHLICH3': (v) => {
        const method = 'Mehlich-3 Multi-Element Reagent (1:10 ratio)';
        if (v < 15.0) return { rating: 'LOW', label: 'Low (< 15 mg/kg)', advisory: 'P addition recommended.', method };
        if (v <= 35.0) return { rating: 'OPTIMAL', label: 'Optimum (15 - 35 mg/kg)', advisory: 'Optimum plant-available P.', method };
        return { rating: 'HIGH', label: 'High (> 35 mg/kg)', advisory: 'Sufficient P.', method };
    },
    'P_MEHLICH1': (v) => {
        const method = 'Mehlich-1 Double Acid (0.05 M HCl + 0.0125 M H2SO4, 1:5 ratio)';
        if (v < 10.0) return { rating: 'LOW', label: 'Deficient (< 10 mg/kg)', advisory: 'Phosphorus deficiency; band or broadcast phosphate fertilizer.', method };
        if (v <= 25.0) return { rating: 'OPTIMAL', label: 'Optimum (10 - 25 mg/kg)', advisory: 'Adequate available P for standard row crops.', method };
        return { rating: 'HIGH', label: 'High (> 25 mg/kg)', advisory: 'High phosphorus status under Mehlich-1 extraction.', method };
    },
    'EXCH_K': (v) => {
        const method = '1 M Ammonium Acetate (NH4OAc) pH 7.0 Extraction (1:10 ratio)';
        if (v < 0.2) return { rating: 'LOW', label: 'Deficient Potassium (< 0.2 cmol/kg)', advisory: 'Potassium fertilization required to avoid leaf chlorosis.', method };
        if (v <= 0.6) return { rating: 'OPTIMAL', label: 'Adequate Potassium (0.2 - 0.6 cmol/kg)', advisory: 'Optimal potassium reserve.', method };
        return { rating: 'HIGH', label: 'High Potassium (> 0.6 cmol/kg)', advisory: 'Abundant K; monitor Mg:K ratio to prevent Mg uptake inhibition.', method };
    },
    'EXCH_CA': (v) => {
        const method = '1 M Ammonium Acetate (NH4OAc) pH 7.0 Extraction (1:10 ratio)';
        if (v < 2.0) return { rating: 'LOW', label: 'Low Calcium (< 2.0 cmol/kg)', advisory: 'Low calcium; gypsum or agricultural lime recommended.', method };
        if (v <= 10.0) return { rating: 'OPTIMAL', label: 'Moderate / Optimal (2 - 10 cmol/kg)', advisory: 'Balanced exchangeable calcium.', method };
        return { rating: 'HIGH', label: 'High Calcium (> 10 cmol/kg)', advisory: 'Dominated by calcium; high soil aggregation stability.', method };
    },
    'EXCH_MG': (v) => {
        const method = '1 M Ammonium Acetate (NH4OAc) pH 7.0 Extraction (1:10 ratio)';
        if (v < 0.5) return { rating: 'LOW', label: 'Low Magnesium (< 0.5 cmol/kg)', advisory: 'Magnesium deficiency risk; apply dolomitic limestone or Epsom salts.', method };
        if (v <= 3.0) return { rating: 'OPTIMAL', label: 'Optimal Magnesium (0.5 - 3.0 cmol/kg)', advisory: 'Adequate magnesium status.', method };
        return { rating: 'HIGH', label: 'High Magnesium (> 3.0 cmol/kg)', advisory: 'High Mg; ensure Ca:Mg balance remains above 2:1.', method };
    },
    'CEC': (v) => {
        const method = '1 M Ammonium Acetate Compulsive Exchange at pH 7.0 (ISO 11260)';
        if (v < 10.0) return { rating: 'LOW', label: 'Low CEC (< 10 cmol/kg)', advisory: 'Sandy or highly weathered soil with low nutrient retention; split fertilizer doses.', method };
        if (v <= 25.0) return { rating: 'OPTIMAL', label: 'Moderate CEC (10 - 25 cmol/kg)', advisory: 'Good nutrient buffering capacity.', method };
        return { rating: 'HIGH', label: 'High CEC (> 25 cmol/kg)', advisory: 'High clay or humus content; excellent nutrient retention.', method };
    },
    'EC': (v) => {
        const method = 'Conductometry in 1:5 Soil:Water Suspension (ISO 11265)';
        if (v < 200) return { rating: 'OPTIMAL', label: 'Non-Saline (< 200 µS/cm)', advisory: 'No salinity restriction for crops.', method };
        if (v <= 400) return { rating: 'MODERATE', label: 'Slightly Saline (200 - 400 µS/cm)', advisory: 'Sensitive crops may experience mild yield depression.', method };
        return { rating: 'HIGH', label: 'Saline (> 400 µS/cm)', advisory: 'Salinity hazard; improve drainage and leach root zone with quality irrigation water.', method };
    },
    'EC_E': (v) => {
        const method = 'Conductometry in Saturated Paste Extract (USDA Agriculture Handbook 60)';
        if (v < 2.0) return { rating: 'OPTIMAL', label: 'Non-Saline (< 2 dS/m)', advisory: 'Salinity effects mostly negligible across crops.', method };
        if (v <= 4.0) return { rating: 'MODERATE', label: 'Slightly Saline (2 - 4 dS/m)', advisory: 'Yields of very sensitive crops may be restricted.', method };
        if (v <= 8.0) return { rating: 'HIGH', label: 'Moderately Saline (4 - 8 dS/m)', advisory: 'Yield of many field crops restricted; salinity management required.', method };
        return { rating: 'VERY_HIGH', label: 'Strongly Saline (> 8 dS/m)', advisory: 'Only tolerant crops yield satisfactorily; severe osmotic stress.', method };
    },
    'EXT_ZN': (v) => {
        const method = '0.005 M DTPA-TEA Extraction at pH 7.3 (ISO 14870)';
        if (v < 0.8) return { rating: 'LOW', label: 'Deficient Zinc (< 0.8 mg/kg)', advisory: 'Zinc application (ZnSO₄ or foliar chelate) recommended.', method };
        if (v <= 3.0) return { rating: 'OPTIMAL', label: 'Adequate Zinc (0.8 - 3.0 mg/kg)', advisory: 'Optimal zinc availability.', method };
        return { rating: 'HIGH', label: 'High Zinc (> 3.0 mg/kg)', advisory: 'Sufficient zinc.', method };
    },
    'EXT_FE': (v) => {
        const method = '0.005 M DTPA-TEA Extraction at pH 7.3 (ISO 14870)';
        if (v < 4.5) return { rating: 'LOW', label: 'Deficient Iron (< 4.5 mg/kg)', advisory: 'Iron chlorosis risk; check soil pH and apply foliar iron.', method };
        return { rating: 'OPTIMAL', label: 'Adequate Iron (≥ 4.5 mg/kg)', advisory: 'Optimal iron supply.', method };
    }
};

/**
 * Interpret single analytical result.
 * @param {string} param - Analysis code
 * @param {number|string} value - Numerical result
 * @param {string} [unit] - Measured unit
 * @param {Object} [options] - Matrix and sample context options (e.g. { matrix: 'SOIL' | 'PLANT' })
 * @returns {{ param: string, normalizedValue: number|null, unit: string, rating: string, label: string, advisory: string, method?: string }}
 */
function interpretParameter(param, value, unit = '', options = {}) {
    const pCode = String(param || '').toUpperCase();
    const norm = normalizeUnit(pCode, value, unit);

    if (norm.normalizedValue === null || isNaN(norm.normalizedValue)) {
        return {
            param: pCode,
            normalizedValue: null,
            unit: norm.standardUnit || unit,
            rating: 'NORMAL',
            label: 'Normal',
            advisory: norm.unrecognizedUnit ? `Unrecognized unit '${norm.unrecognizedUnit}'; raw result presented without interpretation.` : 'No numerical result recorded.'
        };
    }

    const evaluator = PARAMETER_EVALUATORS[pCode] || PARAMETER_EVALUATORS[param];
    if (evaluator) {
        const evalResult = evaluator(norm.normalizedValue, options);
        return {
            param: pCode,
            normalizedValue: norm.normalizedValue,
            unit: norm.standardUnit,
            rating: evalResult.rating,
            label: evalResult.label,
            advisory: evalResult.advisory,
            method: evalResult.method || null
        };
    }

    return {
        param: pCode,
        normalizedValue: norm.normalizedValue,
        unit: norm.standardUnit,
        rating: 'NORMAL',
        label: 'Normal',
        advisory: 'Measured within standard physiological expectations.'
    };
}

// =============================================================================
// 4. COMPREHENSIVE MULTI-PARAMETER METROLOGY EVALUATOR
// =============================================================================
/**
 * Evaluates an entire array of sample results.
 * Computes USDA Texture, C:N ratio, Base Saturation, Ca:Mg, and SAR/ESP.
 * @param {Array<{ param: string, value: any, unit?: string }>} resultsArray
 * @returns {Object} Full diagnostic metrological evaluation payload
 */
function evaluateSoilProfile(resultsArray = []) {
    const map = {};
    resultsArray.forEach(r => {
        if (r && r.param) {
            const pCode = String(r.param).toUpperCase();
            const { normalizedValue, standardUnit } = normalizeUnit(pCode, r.value, r.unit);
            map[pCode] = { rawValue: r.value, value: normalizedValue, unit: standardUnit };
        }
    });

    const diagnostics = {
        parameters: {},
        texture: null,
        stoichiometry: null,
        cationExchange: null,
        salinitySodicity: null,
        summaryAlerts: []
    };

    // 1. Evaluate all individual parameters
    Object.keys(map).forEach(pCode => {
        const item = map[pCode];
        diagnostics.parameters[pCode] = interpretParameter(pCode, item.value, item.unit);
    });

    // 2. USDA Soil Texture Evaluation
    const sand = map['SAND']?.value;
    const silt = map['SILT']?.value;
    const clay = map['CLAY']?.value;
    if (sand !== undefined && silt !== undefined && clay !== undefined) {
        const tex = calculateUsdaTexture(sand, silt, clay);
        diagnostics.texture = {
            sand, silt, clay,
            className: tex.className,
            code: tex.code,
            isValid: tex.isValid,
            closureError: tex.closureError
        };
        if (!tex.isValid) {
            diagnostics.summaryAlerts.push(`Texture closure failed (Total = ${(Number(sand)+Number(silt)+Number(clay)).toFixed(1)}%, error > 2.0%).`);
        }
    }

    // 3. C:N Ratio Evaluation
    const soc = map['SOC']?.value ?? (map['SOM']?.value ? map['SOM'].value * 0.58 : undefined);
    const tn = map['TN']?.value;
    if (soc !== undefined && tn !== undefined) {
        const cn = evaluateCnRatio(soc, tn, 'g/kg', 'g/kg');
        diagnostics.stoichiometry = {
            soc, tn,
            cnRatio: cn.cnRatio,
            status: cn.status,
            warning: cn.warning
        };
        if (cn.warning) {
            diagnostics.summaryAlerts.push(cn.warning);
        }
    }

    // 4. Cation Exchange Balance & Ca:Mg / Mg:K ratios
    const cec = map['CEC']?.value;
    const ca = map['EXCH_CA']?.value;
    const mg = map['EXCH_MG']?.value;
    const k = map['EXCH_K']?.value;
    const na = map['EXCH_NA']?.value || 0;
    const ph = map['PH_H2O']?.value || map['PH']?.value || null;

    if (ca !== undefined || mg !== undefined || k !== undefined || cec !== undefined) {
        const cecEval = evaluateCecAndBases(cec, ca, mg, k, na, ph);

        // Ca:Mg ratio
        let caMgRatio = null;
        if (ca !== undefined && mg !== undefined && mg > 0) {
            caMgRatio = Number((ca / mg).toFixed(1));
        }

        // Mg:K ratio
        let mgKRatio = null;
        if (mg !== undefined && k !== undefined && k > 0) {
            mgKRatio = Number((mg / k).toFixed(1));
        }

        diagnostics.cationExchange = {
            cec: cec ?? null,
            ca: ca ?? null,
            mg: mg ?? null,
            k: k ?? null,
            na: na ?? null,
            sumOfBases: cecEval.sumOfBases,
            baseSaturation: cecEval.baseSaturation,
            caMgRatio,
            mgKRatio,
            warnings: cecEval.warnings
        };

        if (caMgRatio !== null && caMgRatio < 2.0) {
            diagnostics.summaryAlerts.push(`Narrow Ca:Mg ratio (${caMgRatio}:1). Excess Mg or Ca deficiency may impede soil aggregation.`);
        }
        if (mgKRatio !== null && mgKRatio < 1.0) {
            diagnostics.summaryAlerts.push(`High potassium relative to magnesium (Mg:K = ${mgKRatio}:1). Potential grass tetany / Mg deficiency.`);
        }
        cecEval.warnings.forEach(w => diagnostics.summaryAlerts.push(w));
    }

    // 5. Salinity & Sodicity Risk (SAR / ESP)
    if (na !== undefined && ca !== undefined && mg !== undefined) {
        const denom = Math.sqrt((ca + mg) / 2);
        const sar = denom > 0 ? Number((na / denom).toFixed(1)) : null;
        let esp = null;
        if (cec !== undefined && cec > 0) {
            esp = Number(((na / cec) * 100).toFixed(1));
        }

        diagnostics.salinitySodicity = {
            sar,
            esp,
            isSodic: (sar !== null && sar >= 13) || (esp !== null && esp >= 15),
            rating: (sar !== null && sar >= 13) ? 'SODIC_HAZARD' : 'SAFE'
        };

        if (diagnostics.salinitySodicity.isSodic) {
            diagnostics.summaryAlerts.push(`Sodicity hazard detected (SAR = ${sar}, ESP = ${esp}%). Soil dispersion and poor permeability likely.`);
        }
    }

    return diagnostics;
}

module.exports = {
    UNIT_REGISTRY,
    normalizeUnit,
    interpretParameter,
    evaluateSoilProfile
};
