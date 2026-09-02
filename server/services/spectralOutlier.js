/**
 * Spectral Outlier Screening Service (SL-20)
 * Curational screening against approved laboratory spectral library.
 * Catches empty cups, background scans submitted as samples, and severe spectral anomalies.
 */

/**
 * Screens a candidate spectrum against existing approved spectra in the laboratory
 * @param {Array<number>} wavelengths
 * @param {Array<number>} values
 * @param {Array<Object>} libraryScans - Array of { wavelengths, values } from approved library
 * @param {Object} [options]
 * @returns {Object} { isOutlier: boolean, reason?: string, distance: number }
 */
exports.screenScanAgainstLibrary = (wavelengths, values, libraryScans = [], options = {}) => {
    if (!Array.isArray(values) || values.length === 0) {
        return { isOutlier: true, reason: 'EMPTY_SPECTRUM', distance: 1.0 };
    }

    // 1. Check for pure background / empty cup:
    // Pure background in absorbance is near-zero everywhere (flatline around 0.0)
    // Or flatline reflection
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let variance = 0;
    for (const v of values) variance += Math.pow(v - mean, 2);
    const stdDev = Math.sqrt(variance / values.length);

    // If stdDev is practically zero (flat baseline submitted as sample)
    if (stdDev < 0.005) {
        return { isOutlier: true, reason: 'BACKGROUND_OR_EMPTY_CUP', distance: 0.99 };
    }

    if (!Array.isArray(libraryScans) || libraryScans.length < 3) {
        // Not enough approved scans to establish statistical library bounds
        return { isOutlier: false, distance: 0 };
    }

    // Compare Pearson correlation with library samples
    const step = Math.max(1, Math.floor(values.length / 50));
    const sampledVals = [];
    for (let i = 0; i < values.length; i += step) {
        sampledVals.push(values[i]);
    }

    let avgCorrelations = 0;
    let validCount = 0;

    for (const scan of libraryScans) {
        let otherVals;
        try {
            otherVals = typeof scan.values === 'string' ? JSON.parse(scan.values) : scan.values;
        } catch (e) {
            continue;
        }
        if (!Array.isArray(otherVals) || otherVals.length === 0) continue;

        const otherSampled = [];
        const otherStep = Math.max(1, Math.floor(otherVals.length / 50));
        for (let i = 0; i < otherVals.length; i += otherStep) {
            otherSampled.push(otherVals[i]);
        }

        const len = Math.min(sampledVals.length, otherSampled.length);
        if (len < 5) continue;

        // Pearson correlation
        let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
        for (let i = 0; i < len; i++) {
            const x = sampledVals[i];
            const y = otherSampled[i];
            sum1 += x; sum2 += y;
            sum1Sq += x * x; sum2Sq += y * y;
            pSum += x * y;
        }
        const num = pSum - (sum1 * sum2 / len);
        const den = Math.sqrt((sum1Sq - sum1 * sum1 / len) * (sum2Sq - sum2 * sum2 / len));
        const r = den === 0 ? 0 : num / den;

        avgCorrelations += r;
        validCount++;
    }

    if (validCount >= 3) {
        const meanR = avgCorrelations / validCount;
        if (meanR < 0.15) {
            return {
                isOutlier: true,
                reason: 'LOW_LIBRARY_CORRELATION',
                distance: Math.round((1 - meanR) * 1000) / 1000
            };
        }
    }

    return { isOutlier: false, distance: 0 };
};
