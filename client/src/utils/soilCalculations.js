/**
 * SoilFER-LIMS Scientific Calculations & Soil Metrology
 * Standards-compliant algorithms for USDA texture classification, ternary coordinates,
 * C:N ratio plausibility, and cation exchange capacity (CEC) validation.
 */

/**
 * Classify soil texture into the 12 standard USDA texture classes.
 * @param {number} sand - Sand fraction (0-100%)
 * @param {number} silt - Silt fraction (0-100%)
 * @param {number} clay - Clay fraction (0-100%)
 * @param {number} [tolerance=2.0] - Allowed closure error in %
 * @returns {{ className: string, code: string, closureError: number, isValid: boolean, normalized: { sand: number, silt: number, clay: number } }}
 */
function calculateUsdaTexture(sand, silt, clay, tolerance = 2.0) {
    const s = Number(sand) || 0;
    const si = Number(silt) || 0;
    const c = Number(clay) || 0;
    const total = s + si + c;
    const closureError = Math.abs(100 - total);

    if (total <= 0 || closureError > tolerance) {
        return {
            className: 'Invalid Texture (Closure Failed)',
            code: 'INVALID',
            closureError: Number(closureError.toFixed(2)),
            isValid: false,
            normalized: { sand: s, silt: si, clay: c }
        };
    }

    // Normalize to exact 100%
    const normSand = (s / total) * 100;
    const normSilt = (si / total) * 100;
    const normClay = (c / total) * 100;

    let className = 'Loam';
    let code = 'L';

    // 1. Clay: >= 40% clay, <= 45% sand, < 40% silt
    if (normClay >= 40 && normSand <= 45 && normSilt < 40) {
        className = 'Clay';
        code = 'C';
    }
    // 2. Silty Clay: >= 40% clay, >= 40% silt
    else if (normClay >= 40 && normSilt >= 40) {
        className = 'Silty Clay';
        code = 'SiC';
    }
    // 3. Sandy Clay: >= 35% clay, >= 45% sand
    else if (normClay >= 35 && normSand >= 45) {
        className = 'Sandy Clay';
        code = 'SC';
    }
    // 4. Clay Loam: 27-40% clay, 20-45% sand, < 53% silt
    else if (normClay >= 27 && normClay < 40 && normSand >= 20 && normSand <= 45 && normSilt < 53) {
        className = 'Clay Loam';
        code = 'CL';
    }
    // 5. Silty Clay Loam: 27-40% clay, < 20% sand
    else if (normClay >= 27 && normClay < 40 && normSand < 20) {
        className = 'Silty Clay Loam';
        code = 'SiCL';
    }
    // 6. Sandy Clay Loam: 20-35% clay, < 28% silt, >= 45% sand
    else if (normClay >= 20 && normClay < 35 && normSilt < 28 && normSand >= 45) {
        className = 'Sandy Clay Loam';
        code = 'SCL';
    }
    // 7. Sand: sand >= 85% and (silt + 1.5*clay < 15%)
    else if (normSand >= 85 && (normSilt + 1.5 * normClay < 15)) {
        className = 'Sand';
        code = 'S';
    }
    // 8. Loamy Sand: sand >= 70% and sand <= 90% and (silt + 1.5*clay >= 15%) and (silt + 2*clay < 30%)
    else if (normSand >= 70 && normSand <= 90 && (normSilt + 1.5 * normClay >= 15) && (normSilt + 2 * normClay < 30)) {
        className = 'Loamy Sand';
        code = 'LS';
    }
    // 9. Sandy Loam: (clay < 20% and sand > 52% and (silt + 2*clay >= 30%)) OR (7 <= clay < 20% and sand >= 43% and sand <= 52% and silt < 50%)
    else if ((normClay < 20 && normSand > 52 && (normSilt + 2 * normClay >= 30)) ||
             (normClay >= 7 && normClay < 20 && normSand >= 43 && normSand <= 52 && normSilt < 50) ||
             (normClay < 7 && normSand >= 43 && normSand < 52 && normSilt < 50)) {
        className = 'Sandy Loam';
        code = 'SL';
    }
    // 10. Silt: >= 80% silt, < 12% clay
    else if (normSilt >= 80 && normClay < 12) {
        className = 'Silt';
        code = 'Si';
    }
    // 11. Silt Loam: (silt >= 50% and 12 <= clay < 27%) OR (50 <= silt < 80% and clay < 12%)
    else if ((normSilt >= 50 && normClay >= 12 && normClay < 27) || (normSilt >= 50 && normSilt < 80 && normClay < 12)) {
        className = 'Silt Loam';
        code = 'SiL';
    }
    // 12. Loam: 7-27% clay, 28-50% silt, < 52% sand
    else if (normClay >= 7 && normClay < 27 && normSilt >= 28 && normSilt < 50 && normSand < 52) {
        className = 'Loam';
        code = 'L';
    }

    return {
        className,
        code,
        closureError: Number(closureError.toFixed(2)),
        isValid: true,
        normalized: {
            sand: Number(normSand.toFixed(1)),
            silt: Number(normSilt.toFixed(1)),
            clay: Number(normClay.toFixed(1))
        }
    };
}

/**
 * Calculate Cartesian (x, y) coordinates on an equilateral ternary diagram.
 * Triangle layout: Top vertex (50, 13.4) = 100% Clay; Bottom Left (0, 100) = 100% Sand; Bottom Right (100, 100) = 100% Silt.
 * @param {number} sand - Sand % (0-100)
 * @param {number} silt - Silt % (0-100)
 * @param {number} clay - Clay % (0-100)
 * @returns {{ x: number, y: number }} Coordinates in % viewport (0-100)
 */
function calculateTernaryCoordinates(sand, silt, clay) {
    const s = Number(sand) || 0;
    const si = Number(silt) || 0;
    const c = Number(clay) || 0;
    const total = s + si + c || 100;

    const normSilt = (si / total) * 100;
    const normClay = (c / total) * 100;

    // x coordinate: 0 at Sand, 100 at Silt, 50 at Clay apex
    const x = normSilt + (normClay / 2);
    // y coordinate: 100 at base, (100 - 86.6025 = 13.4) at top apex
    const y = 100 - (normClay * 0.866025);

    return {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2))
    };
}

/**
 * Validate C:N ratio plausibility.
 * @param {number} soc - Soil Organic Carbon (g/kg or %)
 * @param {number} tn - Total Nitrogen (g/kg or %)
 * @param {string} [socUnit='g/kg']
 * @param {string} [tnUnit='g/kg']
 * @returns {{ cnRatio: number|null, status: 'OPTIMAL'|'LOW'|'HIGH'|'IMPLAUSIBLE', warning: string|null }}
 */
function evaluateCnRatio(soc, tn, socUnit = 'g/kg', tnUnit = 'g/kg') {
    if (soc === null || soc === undefined || tn === null || tn === undefined) {
        return { cnRatio: null, status: 'OPTIMAL', warning: null };
    }

    let c = Number(soc);
    let n = Number(tn);
    if (isNaN(c) || isNaN(n) || c <= 0 || n <= 0) {
        return { cnRatio: null, status: 'IMPLAUSIBLE', warning: 'Invalid non-positive carbon or nitrogen measurement' };
    }

    // Normalize units if needed (e.g. % vs g/kg)
    if (socUnit === '%' && tnUnit === 'g/kg') c = c * 10;
    if (socUnit === 'g/kg' && tnUnit === '%') n = n * 10;

    const ratio = Number((c / n).toFixed(1));

    if (ratio < 4.0) {
        return {
            cnRatio: ratio,
            status: 'IMPLAUSIBLE',
            warning: `C:N ratio (${ratio}) is unusually low (< 4.0). Check for Total N contamination or underreported Organic Carbon.`
        };
    }
    if (ratio > 40.0) {
        return {
            cnRatio: ratio,
            status: 'HIGH',
            warning: `C:N ratio (${ratio}) is very wide (> 40.0). Typical of undecomposed residues or peaty soils; check Total N.`
        };
    }
    if (ratio >= 8.0 && ratio <= 25.0) {
        return { cnRatio: ratio, status: 'OPTIMAL', warning: null };
    }
    return { cnRatio: ratio, status: ratio < 8.0 ? 'LOW' : 'HIGH', warning: null };
}

/**
 * Evaluate Base Saturation and Cation Exchange Capacity consistency.
 * @param {number} cec - Cation Exchange Capacity (cmol(+)/kg)
 * @param {number} ca - Exchangeable Calcium (cmol(+)/kg)
 * @param {number} mg - Exchangeable Magnesium (cmol(+)/kg)
 * @param {number} k - Exchangeable Potassium (cmol(+)/kg)
 * @param {number} [na=0] - Exchangeable Sodium (cmol(+)/kg)
 * @param {number} [ph=null] - Soil pH
 * @returns {{ sumOfBases: number, baseSaturation: number|null, status: 'OPTIMAL'|'WARNING', warnings: string[] }}
 */
function evaluateCecAndBases(cec, ca, mg, k, na = 0, ph = null) {
    const cCa = Number(ca) || 0;
    const cMg = Number(mg) || 0;
    const cK = Number(k) || 0;
    const cNa = Number(na) || 0;
    const sumOfBases = Number((cCa + cMg + cK + cNa).toFixed(2));

    const warnings = [];
    let baseSaturation = null;

    if (cec !== null && cec !== undefined && Number(cec) > 0) {
        const cCec = Number(cec);
        baseSaturation = Number(((sumOfBases / cCec) * 100).toFixed(1));

        if (baseSaturation > 120.0) {
            warnings.push(`Sum of exchangeable bases (${sumOfBases} cmol/kg) exceeds CEC (${cCec} cmol/kg) by > 20% (Base Saturation ${baseSaturation}%). Likely free calcium carbonates (calcareous soil) dissolving during extraction.`);
        }

        if (ph !== null && ph < 5.5 && baseSaturation > 90.0) {
            warnings.push(`Acidic soil (pH ${ph}) has unexpectedly high base saturation (${baseSaturation}%). Check for exchangeable aluminum / acidity.`);
        }
    }

    return {
        sumOfBases,
        baseSaturation,
        status: warnings.length > 0 ? 'WARNING' : 'OPTIMAL',
        warnings
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateUsdaTexture,
        calculateTernaryCoordinates,
        evaluateCnRatio,
        evaluateCecAndBases
    };
}
