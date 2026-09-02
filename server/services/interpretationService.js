/**
 * FAO SoilFER Scientific & Agronomic Interpretation Engine
 * 
 * Implements standard controlled unit vocabulary, automated unit conversions,
 * individual parameter agronomic classifications (FAO GLOSOLAN standards),
 * and holistic soil stoichiometry (Texture, C:N, Base Saturation, Ca:Mg, SAR/ESP).
 */

const { calculateUsdaTexture, evaluateCnRatio, evaluateCecAndBases } = require('../utils/soilCalculations');

// =============================================================================
// 1. CONTROLLED UNIT VOCABULARY & CONVERSION FACTORS
// =============================================================================
const CONTROLLED_UNITS = {
    // Routine Acidity
    'PH_H2O': { standard: 'pH units', synonyms: ['pH', 'units', 'dimensionless', ''] },
    'PH_CACL2': { standard: 'pH units', synonyms: ['pH', 'units', 'dimensionless', ''] },
    'PH_KCL': { standard: 'pH units', synonyms: ['pH', 'units', 'dimensionless', ''] },
    'pH': { standard: 'pH units', synonyms: ['pH', 'units', 'dimensionless', ''] },

    // Salinity
    'EC': { standard: 'µS/cm', synonyms: ['uS/cm', 'µS/cm', 'microS/cm'], conversions: { 'dS/m': 1000, 'mS/cm': 1000, 'mS/m': 10 } },
    'electricalConductivity': { standard: 'µS/cm', synonyms: ['uS/cm'], conversions: { 'dS/m': 1000, 'mS/cm': 1000 } },
    'EC_E': { standard: 'dS/m', synonyms: ['mS/cm'], conversions: { 'µS/cm': 0.001, 'uS/cm': 0.001 } },

    // Organic Carbon & Nitrogen
    'SOC': { standard: 'g/kg', synonyms: ['g/kg', 'g kg-1', 'g C/kg'], conversions: { '%': 10, 'mg/g': 1, 'mg/kg': 0.001 } },
    'carbonOrganic': { standard: 'g/kg', synonyms: ['g/kg'], conversions: { '%': 10 } },
    'SOM': { standard: 'g/kg', synonyms: ['g/kg'], conversions: { '%': 10 } },
    'organicMatter': { standard: 'g/kg', synonyms: ['g/kg'], conversions: { '%': 10 } },
    'POXC': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'] },
    'TN': { standard: 'g/kg', synonyms: ['g/kg', 'g N/kg'], conversions: { '%': 10, 'mg/kg': 0.001 } },
    'nitrogenTotal': { standard: 'g/kg', synonyms: ['g/kg'], conversions: { '%': 10 } },
    'N_NO3': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg N/kg'] },
    'N_NH4': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg N/kg'] },
    'N_MIN': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'] },

    // Phosphorus
    'P_OLSEN': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg P/kg'], conversions: { 'mg/100g': 10 } },
    'P_BRAY1': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg P/kg'], conversions: { 'mg/100g': 10 } },
    'P_BRAY2': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'], conversions: { 'mg/100g': 10 } },
    'P_MEHLICH3': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'], conversions: { 'mg/100g': 10 } },
    'P_MEHLICH1': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'], conversions: { 'mg/100g': 10 } },
    'P_TOTAL': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'], conversions: { '%': 10000, 'g/kg': 1000 } },

    // Exchangeable Cations & CEC
    'EXCH_CA': { standard: 'cmol(+)/kg', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g', 'meq/100 g', 'cmoL/kg'] },
    'EXCH_MG': { standard: 'cmol(+)/kg', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'EXCH_K': { standard: 'cmol(+)/kg', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'EXCH_NA': { standard: 'cmol(+)/kg', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'EXCH_AL': { standard: 'cmol(+)/kg', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'EXCH_ACID': { standard: 'cmol(+)/kg', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'CEC': { standard: 'cmol(+)/kg', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'ECEC': { standard: 'cmol(+)/kg', synonyms: ['cmol(+)/kg', 'cmol/kg', 'cmol+/kg', 'meq/100g'] },
    'baseSaturation': { standard: '%', synonyms: ['%', 'percent', 'percentage'] },

    // Texture & Particle Size
    'SAND': { standard: '%', synonyms: ['%', 'percent'], conversions: { 'g/kg': 0.1 } },
    'SILT': { standard: '%', synonyms: ['%', 'percent'], conversions: { 'g/kg': 0.1 } },
    'CLAY': { standard: '%', synonyms: ['%', 'percent'], conversions: { 'g/kg': 0.1 } },
    'COARSE_FRAG': { standard: '%', synonyms: ['%'] },
    'BD_FINE': { standard: 'g/cm³', synonyms: ['g/cm3', 'g/cm^3', 'g/ml', 'kg/dm3', 'Mg/m3', 'g/cm³'] },
    'bulkDensityFineEarth': { standard: 'g/cm³', synonyms: ['g/cm3', 'g/cm³'] },

    // Micronutrients & Secondary
    'EXT_S': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg S/kg'] },
    'EXT_ZN': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg Zn/kg'] },
    'EXT_FE': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg Fe/kg'] },
    'EXT_CU': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg Cu/kg'] },
    'EXT_MN': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg Mn/kg'] },
    'EXT_B': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm', 'mg B/kg'] },
    'EXT_MO': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'] },

    // Carbonates & Lime
    'CACO3': { standard: '%', synonyms: ['%', 'percent'], conversions: { 'g/kg': 0.1 } },
    'totalCarbonateEquivalent': { standard: '%', synonyms: ['%'], conversions: { 'g/kg': 0.1 } },
    'ACTIVE_CACO3': { standard: '%', synonyms: ['%'], conversions: { 'g/kg': 0.1 } },
    'LIME_REQ': { standard: 't/ha', synonyms: ['t/ha', 'ton/ha', 'tonne/ha'] },

    // Heavy Metals
    'HM_CD': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'] },
    'HM_PB': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'] },
    'HM_AS': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'] },
    'HM_CR': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'] },
    'HM_NI': { standard: 'mg/kg', synonyms: ['mg/kg', 'ppm'] }
};

// =============================================================================
// 2. UNIT NORMALIZATION HELPER
// =============================================================================
/**
 * Normalizes an input value and unit to standard controlled unit.
 * @param {string} param - Analysis code
 * @param {number|string} value - Numerical result
 * @param {string} [inputUnit] - Provided unit
 * @returns {{ normalizedValue: number, standardUnit: string, wasConverted: boolean, factor: number }}
 */
function normalizeUnit(param, value, inputUnit = '') {
    const pCode = String(param || '').toUpperCase();
    const num = Number(value);
    if (isNaN(num)) {
        return { normalizedValue: null, standardUnit: '', wasConverted: false, factor: 1 };
    }

    const rule = CONTROLLED_UNITS[pCode] || CONTROLLED_UNITS[param];
    if (!rule) {
        return { normalizedValue: num, standardUnit: inputUnit || '', wasConverted: false, factor: 1 };
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

    return { normalizedValue: num, standardUnit: rule.standard, wasConverted: false, factor: 1 };
}

// =============================================================================
// 3. AGRONOMIC INTERPRETATION RULES (FAO Tier-5 Standards)
// =============================================================================
const PARAMETER_EVALUATORS = {
    'PH_H2O': (v) => {
        if (v < 4.5) return { rating: 'VERY_LOW', label: 'Extremely Acidic', advisory: 'Severe Al toxicity risk; critical lime application required.' };
        if (v < 5.5) return { rating: 'LOW', label: 'Strongly Acidic', advisory: 'P-fixation likely; liming recommended for acid-sensitive crops.' };
        if (v < 6.5) return { rating: 'MODERATE', label: 'Moderately Acidic', advisory: 'Adequate for most acid-tolerant crops; light liming beneficial.' };
        if (v <= 7.3) return { rating: 'OPTIMAL', label: 'Neutral (Optimal)', advisory: 'Optimal nutrient availability for most agronomic crops.' };
        if (v <= 8.4) return { rating: 'HIGH', label: 'Moderately Alkaline', advisory: 'Calcareous condition; micronutrient availability (Fe, Zn) may be restricted.' };
        return { rating: 'VERY_HIGH', label: 'Strongly Alkaline / Sodic', advisory: 'Potential sodicity or high carbonate hazard; gypsum/acid amendment indicated.' };
    },
    'SOC': (v) => {
        if (v < 6.0) return { rating: 'VERY_LOW', label: 'Very Low SOC (< 0.6%)', advisory: 'Depleted soil organic matter; incorporate compost, biochar, or cover crops.' };
        if (v < 12.0) return { rating: 'LOW', label: 'Low SOC (0.6 - 1.2%)', advisory: 'Sub-optimal organic carbon; regular organic residue retention recommended.' };
        if (v < 20.0) return { rating: 'MODERATE', label: 'Moderate SOC (1.2 - 2.0%)', advisory: 'Adequate for conventional cropping systems.' };
        if (v <= 35.0) return { rating: 'OPTIMAL', label: 'High SOC (2.0 - 3.5%)', advisory: 'High biological activity and moisture retention.' };
        return { rating: 'VERY_HIGH', label: 'Very High SOC (> 3.5%)', advisory: 'Rich humic or volcanic soil.' };
    },
    'SOM': (v) => {
        if (v < 10.0) return { rating: 'VERY_LOW', label: 'Very Low SOM (< 1%)', advisory: 'Critically depleted organic matter.' };
        if (v < 20.0) return { rating: 'LOW', label: 'Low SOM (1 - 2%)', advisory: 'Low organic buffer capacity.' };
        if (v <= 40.0) return { rating: 'OPTIMAL', label: 'Moderate/Optimal SOM (2 - 4%)', advisory: 'Balanced organic matter.' };
        return { rating: 'HIGH', label: 'High SOM (> 4%)', advisory: 'Excellent organic structure.' };
    },
    'TN': (v) => {
        if (v < 0.8) return { rating: 'LOW', label: 'Low Nitrogen (< 0.08%)', advisory: 'Nitrogen deficiency likely; supplemental N fertilizer recommended.' };
        if (v <= 2.5) return { rating: 'OPTIMAL', label: 'Adequate Nitrogen (0.08 - 0.25%)', advisory: 'Balanced nitrogen status.' };
        return { rating: 'HIGH', label: 'High Nitrogen (> 0.25%)', advisory: 'High available N; avoid excess synthetic application to prevent leaching.' };
    },
    'P_OLSEN': (v) => {
        if (v < 7.0) return { rating: 'VERY_LOW', label: 'Deficient (< 7 mg/kg)', advisory: 'Severe P deficiency; apply starter/broadcast P fertilizer.' };
        if (v <= 15.0) return { rating: 'LOW', label: 'Marginal (7 - 15 mg/kg)', advisory: 'Moderate P supply; maintenance P fertilization recommended.' };
        if (v <= 25.0) return { rating: 'OPTIMAL', label: 'Adequate (15 - 25 mg/kg)', advisory: 'Optimal soil phosphorus status.' };
        return { rating: 'HIGH', label: 'High / Excessive (> 25 mg/kg)', advisory: 'High phosphorus reserve; omit P fertilization to minimize runoff risks.' };
    },
    'P_BRAY1': (v) => {
        if (v < 10.0) return { rating: 'LOW', label: 'Deficient (< 10 mg/kg)', advisory: 'P fertilization required.' };
        if (v <= 25.0) return { rating: 'OPTIMAL', label: 'Adequate (10 - 25 mg/kg)', advisory: 'Optimal available P.' };
        return { rating: 'HIGH', label: 'High (> 25 mg/kg)', advisory: 'High available P.' };
    },
    'P_MEHLICH3': (v) => {
        if (v < 15.0) return { rating: 'LOW', label: 'Low (< 15 mg/kg)', advisory: 'P addition recommended.' };
        if (v <= 35.0) return { rating: 'OPTIMAL', label: 'Optimum (15 - 35 mg/kg)', advisory: 'Optimum plant-available P.' };
        return { rating: 'HIGH', label: 'High (> 35 mg/kg)', advisory: 'Sufficient P.' };
    },
    'EXCH_K': (v) => {
        if (v < 0.2) return { rating: 'LOW', label: 'Deficient Potassium (< 0.2 cmol/kg)', advisory: 'Potassium fertilization required to avoid leaf chlorosis.' };
        if (v <= 0.6) return { rating: 'OPTIMAL', label: 'Adequate Potassium (0.2 - 0.6 cmol/kg)', advisory: 'Optimal potassium reserve.' };
        return { rating: 'HIGH', label: 'High Potassium (> 0.6 cmol/kg)', advisory: 'Abundant K; monitor Mg:K ratio to prevent Mg uptake inhibition.' };
    },
    'EXCH_CA': (v) => {
        if (v < 2.0) return { rating: 'LOW', label: 'Low Calcium (< 2.0 cmol/kg)', advisory: 'Low calcium; gypsum or agricultural lime recommended.' };
        if (v <= 10.0) return { rating: 'OPTIMAL', label: 'Moderate / Optimal (2 - 10 cmol/kg)', advisory: 'Balanced exchangeable calcium.' };
        return { rating: 'HIGH', label: 'High Calcium (> 10 cmol/kg)', advisory: 'Dominated by calcium; high soil aggregation stability.' };
    },
    'EXCH_MG': (v) => {
        if (v < 0.5) return { rating: 'LOW', label: 'Low Magnesium (< 0.5 cmol/kg)', advisory: 'Magnesium deficiency risk; apply dolomitic limestone or Epsom salts.' };
        if (v <= 3.0) return { rating: 'OPTIMAL', label: 'Optimal Magnesium (0.5 - 3.0 cmol/kg)', advisory: 'Adequate magnesium status.' };
        return { rating: 'HIGH', label: 'High Magnesium (> 3.0 cmol/kg)', advisory: 'High Mg; ensure Ca:Mg balance remains above 2:1.' };
    },
    'CEC': (v) => {
        if (v < 10.0) return { rating: 'LOW', label: 'Low CEC (< 10 cmol/kg)', advisory: 'Sandy or highly weathered soil with low nutrient retention; split fertilizer doses.' };
        if (v <= 25.0) return { rating: 'OPTIMAL', label: 'Moderate CEC (10 - 25 cmol/kg)', advisory: 'Good nutrient buffering capacity.' };
        return { rating: 'HIGH', label: 'High CEC (> 25 cmol/kg)', advisory: 'High clay or humus content; excellent nutrient retention.' };
    },
    'EC': (v) => {
        if (v < 200) return { rating: 'OPTIMAL', label: 'Non-Saline (< 200 µS/cm)', advisory: 'No salinity restriction for crops.' };
        if (v <= 400) return { rating: 'MODERATE', label: 'Slightly Saline (200 - 400 µS/cm)', advisory: 'Sensitive crops may experience mild yield depression.' };
        return { rating: 'HIGH', label: 'Saline (> 400 µS/cm)', advisory: 'Salinity hazard; improve drainage and leach root zone with quality irrigation water.' };
    },
    'EXT_ZN': (v) => {
        if (v < 0.8) return { rating: 'LOW', label: 'Deficient Zinc (< 0.8 mg/kg)', advisory: 'Zinc application (ZnSO₄ or foliar chelate) recommended.' };
        if (v <= 3.0) return { rating: 'OPTIMAL', label: 'Adequate Zinc (0.8 - 3.0 mg/kg)', advisory: 'Optimal zinc availability.' };
        return { rating: 'HIGH', label: 'High Zinc (> 3.0 mg/kg)', advisory: 'Sufficient zinc.' };
    },
    'EXT_FE': (v) => {
        if (v < 4.5) return { rating: 'LOW', label: 'Deficient Iron (< 4.5 mg/kg)', advisory: 'Iron chlorosis risk; check soil pH and apply foliar iron.' };
        return { rating: 'OPTIMAL', label: 'Adequate Iron (≥ 4.5 mg/kg)', advisory: 'Optimal iron supply.' };
    }
};

/**
 * Interpret single analytical result.
 * @param {string} param - Analysis code
 * @param {number|string} value - Numerical result
 * @param {string} [unit] - Measured unit
 * @returns {{ param: string, normalizedValue: number, unit: string, rating: string, label: string, advisory: string }}
 */
function interpretParameter(param, value, unit = '') {
    const pCode = String(param || '').toUpperCase();
    const { normalizedValue, standardUnit } = normalizeUnit(pCode, value, unit);

    if (normalizedValue === null || isNaN(normalizedValue)) {
        return {
            param: pCode,
            normalizedValue: null,
            unit: standardUnit || unit,
            rating: 'NORMAL',
            label: 'Normal',
            advisory: 'No numerical result recorded.'
        };
    }

    const evaluator = PARAMETER_EVALUATORS[pCode] || PARAMETER_EVALUATORS[param];
    if (evaluator) {
        const evalResult = evaluator(normalizedValue);
        return {
            param: pCode,
            normalizedValue,
            unit: standardUnit,
            rating: evalResult.rating,
            label: evalResult.label,
            advisory: evalResult.advisory
        };
    }

    return {
        param: pCode,
        normalizedValue,
        unit: standardUnit,
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
    CONTROLLED_UNITS,
    normalizeUnit,
    interpretParameter,
    evaluateSoilProfile
};
