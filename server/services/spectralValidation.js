/**
 * Spectral Data Validation Service
 * Enforces scientific and data integrity rules for spectral scans.
 */

const VALIDATION_RULES = {
    NIR: {
        minWavelength: 350,
        maxWavelength: 2500,
        minValue: 0,
        maxValue: 1.5, // Allow some overshoot for reflectance, but >1 is suspicious
        monotonic: true // Wavelengths must strictly increase
    },
    MIR: {
        minWavenumber: 600,
        maxWavenumber: 4000, // cm-1
        monotonic: true // Usually decreasing for cm-1, handled dynamically
    }
};

/**
 * Validates spectral data arrays
 * @param {Array} wavelengths - Array of numeric wavelengths/wavenumbers
 * @param {Array} values - Array of numeric absorbance/reflectance values
 * @param {String} modality - 'NIR' or 'MIR'
 * @returns {Object} { isValid: boolean, qcStatus: 'PASS'|'WARN'|'FAIL', flags: [] }
 */
exports.validateSpectra = (wavelengths, values, modality) => {
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

    // 2. Wavelength Monotonicity
    let increasing = true;
    let decreasing = true;
    for (let i = 1; i < wavelengths.length; i++) {
        if (wavelengths[i] <= wavelengths[i - 1]) increasing = false;
        if (wavelengths[i] >= wavelengths[i - 1]) decreasing = false;
    }
    if (!increasing && !decreasing) {
        flags.push('NON_MONOTONIC_WAVELENGTHS');
        qcStatus = 'FAIL';
    }

    // 3. Range Checks
    const config = VALIDATION_RULES[modality] || VALIDATION_RULES.NIR;
    const minW = Math.min(...wavelengths);
    const maxW = Math.max(...wavelengths);

    if (modality === 'NIR') {
        if (minW < config.minWavelength || maxW > config.maxWavelength) {
            flags.push('WAVELENGTH_OUT_OF_RANGE');
            qcStatus = 'WARN';
        }
    } else if (modality === 'MIR') {
        // MIR usually 4000-600 cm-1
        if (minW < config.minWavenumber || maxW > config.maxWavenumber) {
            flags.push('WAVENUMBER_OUT_OF_RANGE'); // Warn mostly, unexpected instrument range
            qcStatus = 'WARN';
        }
    }

    // 4. Value Sanity
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    // Check for Flatline (Zero variance)
    if (maxVal === minVal) {
        flags.push('FLAT_SIGNAL');
        qcStatus = 'FAIL';
    }

    // Check negatives (Physical impossibility for Reflectance, maybe baseline error for Abs)
    if (minVal < -0.05) { // Tolerance for noise
        flags.push('NEGATIVE_VALUES_DETECTED');
        qcStatus = 'WARN';
    }

    if (modality === 'NIR' && maxVal > 1.2) { // Reflectance > 1.0 is rare/wrong ref
        flags.push('HIGH_REFLECTANCE_VALUES');
        qcStatus = 'WARN';
    }

    // 5. Noise Detection (Simple neighbour diff)
    // Calculate Mean Absolute Difference
    let diffSum = 0;
    for (let i = 1; i < values.length; i++) {
        diffSum += Math.abs(values[i] - values[i - 1]);
    }
    const mad = diffSum / (values.length - 1);

    // If MAD is extremely high, might be noisy
    // Threshold is heuristic
    if (mad > 0.05) {
        flags.push('HIGH_NOISE_LEVEL');
        qcStatus = 'WARN';
    }

    // Determine Final Status
    if (qcStatus === 'FAIL') return { isValid: false, qcStatus, flags };

    // If we have WARN flags, status is WARN, otherwise PASS
    if (flags.length > 0 && qcStatus !== 'FAIL') qcStatus = 'WARN';

    return { isValid: true, qcStatus, flags };
};
