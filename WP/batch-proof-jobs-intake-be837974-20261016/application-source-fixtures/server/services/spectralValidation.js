/**
 * Spectral Data Validation & Quality Control Service
 * Stage D: Spectroscopist-Grade Measurement Quality Control (SL-17, SL-18, SL-19)
 */

const DEFAULT_RULES = {
    NIR: {
        minWavelength: 350,
        maxWavelength: 2500,
        monotonic: true,
        splicePoints: [1000, 1830], // nm
        spliceTolerance: 0.04
    },
    MIR: {
        minWavenumber: 400, // cm-1: Widened for full-range KBr scans
        maxWavenumber: 4000, // cm-1
        monotonic: true,
        co2Window: [2300, 2400], // cm-1
        silentWindow: [1900, 2200], // cm-1
        waterVaporWindow: [3500, 3900] // cm-1
    }
};

const SEVERITY_LEVELS = { PASS: 0, WARN: 1, FAIL: 2 };
function escalateQCStatus(current, target) {
    const currentLvl = SEVERITY_LEVELS[current] || 0;
    const targetLvl = SEVERITY_LEVELS[target] || 0;
    return targetLvl > currentLvl ? target : current;
}

/**
 * Validates spectral data arrays with instrument-aware and physical-quantity-aware checks
 * @param {Array<number>} wavelengths - Array of numeric wavelengths/wavenumbers
 * @param {Array<number>} values - Array of numeric absorbance/reflectance values
 * @param {String} modality - 'NIR' or 'MIR'
 * @param {Object} [options] - Options: { quantity, equipmentLimits, instrumentRange, resolution }
 * @returns {Object} { isValid: boolean, qcStatus: 'PASS'|'WARN'|'FAIL', flags: [] }
 */
exports.validateSpectra = (wavelengths, values, modality = 'NIR', options = {}) => {
    const flags = [];
    let qcStatus = 'PASS';

    // 1. Basic Array Integrity
    if (!Array.isArray(wavelengths) || !Array.isArray(values)) {
        return { isValid: false, qcStatus: 'FAIL', flags: ['INVALID_DATA_FORMAT'] };
    }
    if (wavelengths.length !== values.length) {
        return { isValid: false, qcStatus: 'FAIL', flags: ['LENGTH_MISMATCH'] };
    }
    if (wavelengths.length < 10) {
        return { isValid: false, qcStatus: 'FAIL', flags: ['INSUFFICIENT_DATA_POINTS'] };
    }

    const n = wavelengths.length;
    const quantity = (options.quantity || (modality === 'MIR' ? 'ABSORBANCE' : 'REFLECTANCE')).toUpperCase();
    const limits = {
        ...(DEFAULT_RULES[modality] || DEFAULT_RULES.NIR),
        ...(options.instrumentRange || {}),
        ...(options.equipmentLimits || {})
    };

    // 2. Wavelength Monotonicity
    let increasing = true;
    let decreasing = true;
    for (let i = 1; i < n; i++) {
        if (wavelengths[i] <= wavelengths[i - 1]) increasing = false;
        if (wavelengths[i] >= wavelengths[i - 1]) decreasing = false;
    }
    if (!increasing && !decreasing) {
        flags.push('NON_MONOTONIC_WAVELENGTHS');
        qcStatus = escalateQCStatus(qcStatus, 'FAIL');
    }

    // 3. Instrument Range Checks (SL-17)
    const minW = Math.min(...wavelengths);
    const maxW = Math.max(...wavelengths);

    if (modality === 'NIR') {
        if (minW < limits.minWavelength || maxW > limits.maxWavelength) {
            flags.push('WAVELENGTH_OUT_OF_RANGE');
            qcStatus = escalateQCStatus(qcStatus, 'WARN');
        }
    } else if (modality === 'MIR') {
        if (minW < limits.minWavenumber || maxW > limits.maxWavenumber) {
            flags.push('WAVENUMBER_OUT_OF_RANGE');
            qcStatus = escalateQCStatus(qcStatus, 'WARN');
        }
    }

    // 4. Quantity-Aware Value Bounds (SL-17)
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    if (quantity === 'ABSORBANCE') {
        if (minVal < -0.1) {
            flags.push('NEGATIVE_VALUES_DETECTED');
            qcStatus = escalateQCStatus(qcStatus, 'WARN');
        }
        if (maxVal > 4.0) {
            flags.push('ABSORBANCE_SATURATION');
            qcStatus = escalateQCStatus(qcStatus, 'WARN');
        }
    } else if (quantity === 'REFLECTANCE') {
        if (minVal < -0.05) {
            flags.push('NEGATIVE_VALUES_DETECTED');
            qcStatus = escalateQCStatus(qcStatus, 'WARN');
        }
        if (maxVal > 1.2) {
            flags.push('HIGH_REFLECTANCE_VALUES');
            qcStatus = escalateQCStatus(qcStatus, 'WARN');
        }
    } else {
        if (minVal < -0.1) {
            flags.push('NEGATIVE_VALUES_DETECTED');
            qcStatus = escalateQCStatus(qcStatus, 'WARN');
        }
    }

    // 5. Artifact: Local Saturation / Detector Clipping (SL-18)
    // Entire spectrum flatline
    if (maxVal === minVal) {
        flags.push('FLAT_SIGNAL');
        qcStatus = escalateQCStatus(qcStatus, 'FAIL');
    } else {
        // Run of >= 5 consecutive identical values
        let identicalRun = 1;
        let saturated = false;
        for (let i = 1; i < n; i++) {
            if (Math.abs(values[i] - values[i - 1]) < 1e-7) {
                identicalRun++;
                if (identicalRun >= 5) {
                    saturated = true;
                    break;
                }
            } else {
                identicalRun = 1;
            }
        }
        if (saturated || (quantity === 'ABSORBANCE' && maxVal >= 3.99)) {
            flags.push('LOCAL_SATURATION');
            qcStatus = escalateQCStatus(qcStatus, 'FAIL');
        }
    }

    // 6. Artifact: Atmospheric CO2 & Water Vapor Residuals in MIR (SL-18)
    if (modality === 'MIR') {
        // CO2 band ~2350 cm-1 (2300 - 2400 cm-1) vs silent baseline (2000 - 2200 cm-1)
        const co2Indices = [];
        const baselineIndices = [];

        for (let i = 0; i < n; i++) {
            const w = wavelengths[i];
            if (w >= 2280 && w <= 2420) co2Indices.push(i);
            if (w >= 2000 && w <= 2250) baselineIndices.push(i);
        }

        if (co2Indices.length >= 2 && baselineIndices.length >= 2) {
            const co2Values = co2Indices.map(idx => values[idx]);
            const baseValues = baselineIndices.map(idx => values[idx]);

            const co2P2P = Math.max(...co2Values) - Math.min(...co2Values);
            const baseP2P = Math.max(...baseValues) - Math.min(...baseValues);

            // Flag if CO2 doublet exceeds 0.08 AU or >4x baseline variance
            if (co2P2P > 0.08 || (baseP2P > 0 && co2P2P > 4 * baseP2P && co2P2P > 0.03)) {
                flags.push('ATMOSPHERIC_CO2_RESIDUAL');
                qcStatus = escalateQCStatus(qcStatus, 'WARN');
            }
        }

        // Water vapor in 3600-3850 cm-1: check for high-frequency jaggedness
        const wvIndices = [];
        for (let i = 0; i < n; i++) {
            if (wavelengths[i] >= 3600 && wavelengths[i] <= 3850) wvIndices.push(i);
        }
        if (wvIndices.length >= 6) {
            let secondDiffSum = 0;
            for (let j = 2; j < wvIndices.length; j++) {
                const d2 = values[wvIndices[j]] - 2 * values[wvIndices[j - 1]] + values[wvIndices[j - 2]];
                secondDiffSum += Math.abs(d2);
            }
            const avgSecondDiff = secondDiffSum / (wvIndices.length - 2);
            if (avgSecondDiff > 0.035) {
                flags.push('WATER_VAPOR_RESIDUAL');
                qcStatus = escalateQCStatus(qcStatus, 'WARN');
            }
        }
    }

    // 7. Artifact: Detector Splice Step Discontinuity in Vis-NIR (SL-18)
    if (modality === 'NIR') {
        const splicePoints = limits.splicePoints || [1000, 1830];
        const spliceTol = limits.spliceTolerance || 0.05;

        for (const sp of splicePoints) {
            for (let i = 0; i < n - 1; i++) {
                const w1 = wavelengths[i];
                const w2 = wavelengths[i + 1];
                if ((w1 <= sp && w2 >= sp) || (w2 <= sp && w1 >= sp)) {
                    const step = Math.abs(values[i + 1] - values[i]);
                    if (step > spliceTol) {
                        flags.push('DETECTOR_SPLICE_STEP');
                        qcStatus = escalateQCStatus(qcStatus, 'WARN');
                        break;
                    }
                }
            }
        }
    }

    // 8. Artifact: Baseline Slope and Excessive Drift (SL-18)
    if (n >= 20) {
        // Check baseline endpoints
        const startVal = values.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
        const endVal = values.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const baselineSpan = Math.abs(endVal - startVal);

        if (quantity === 'ABSORBANCE' && (startVal < -0.1 || endVal < -0.1)) {
            flags.push('BASELINE_DRIFT_EXCESSIVE');
            qcStatus = escalateQCStatus(qcStatus, 'WARN');
        } else if (baselineSpan > 2.8) {
            flags.push('BASELINE_DRIFT_EXCESSIVE');
            qcStatus = escalateQCStatus(qcStatus, 'WARN');
        }
    }

    // 9. Noise in Silent Window (SL-18)
    let mad = 0;
    if (modality === 'MIR') {
        // Measure noise in silent window 1900 - 2200 cm-1
        const silentVals = [];
        for (let i = 0; i < n; i++) {
            if (wavelengths[i] >= 1900 && wavelengths[i] <= 2200) {
                silentVals.push(values[i]);
            }
        }
        if (silentVals.length >= 3) {
            let diffSum = 0;
            for (let i = 1; i < silentVals.length; i++) {
                diffSum += Math.abs(silentVals[i] - silentVals[i - 1]);
            }
            mad = diffSum / (silentVals.length - 1);
        }
    }

    if (mad === 0 && n >= 30) {
        let diffSum = 0;
        for (let i = 1; i < n; i++) {
            diffSum += Math.abs(values[i] - values[i - 1]);
        }
        mad = diffSum / (n - 1);
    }

    const noiseThreshold = limits.maxNoise || (modality === 'MIR' ? 0.04 : 0.05);
    if (mad > noiseThreshold) {
        flags.push('HIGH_NOISE_LEVEL');
        qcStatus = escalateQCStatus(qcStatus, 'WARN');
    }

    // Determine Final Status
    if (qcStatus === 'FAIL') return { isValid: false, qcStatus, flags };
    if (flags.length > 0 && qcStatus !== 'FAIL') qcStatus = 'WARN';

    return { isValid: true, qcStatus, flags };
};

/**
 * Evaluates replicate agreement between two or more determinations (SL-19)
 * Calculates Root Mean Square Difference (RMSD) on a common linear grid
 * @param {Array<number>} w1
 * @param {Array<number>} v1
 * @param {Array<number>} w2
 * @param {Array<number>} v2
 * @param {Object} [options]
 * @returns {Object} { pass: boolean, rmsd: number, limit: number }
 */
exports.evaluateReplicateAgreement = (w1, v1, w2, v2, options = {}) => {
    if (!Array.isArray(w1) || !Array.isArray(v1) || !Array.isArray(w2) || !Array.isArray(v2)) {
        return { pass: true, rmsd: 0, limit: 0.05 };
    }

    const minX = Math.max(Math.min(...w1), Math.min(...w2));
    const maxX = Math.min(Math.max(...w1), Math.max(...w2));

    if (minX >= maxX) {
        return { pass: true, rmsd: 0, limit: 0.05 };
    }

    // Create 50 grid points for comparison
    const numPoints = 50;
    const step = (maxX - minX) / (numPoints - 1);

    const interp = (x, xs, ys) => {
        if (x <= xs[0]) return ys[0];
        if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
        for (let i = 0; i < xs.length - 1; i++) {
            const xA = xs[i], xB = xs[i + 1];
            if ((xA <= x && x <= xB) || (xB <= x && x <= xA)) {
                const t = (x - xA) / (xB - xA);
                return ys[i] + t * (ys[i + 1] - ys[i]);
            }
        }
        return ys[0];
    };

    let sumSquaredDiff = 0;
    for (let i = 0; i < numPoints; i++) {
        const x = minX + i * step;
        const val1 = interp(x, w1, v1);
        const val2 = interp(x, w2, v2);
        sumSquaredDiff += Math.pow(val1 - val2, 2);
    }

    const rmsd = Math.round(Math.sqrt(sumSquaredDiff / numPoints) * 10000) / 10000;
    const limit = options.maxRmsd || (options.quantity === 'REFLECTANCE' ? 0.08 : 0.05);

    return {
        pass: rmsd <= limit,
        rmsd,
        limit
    };
};

exports.escalateQCStatus = escalateQCStatus;
