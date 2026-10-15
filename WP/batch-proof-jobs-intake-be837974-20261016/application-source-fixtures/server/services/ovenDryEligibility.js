'use strict';
// #205 pin 6099330444: pH, conductivity, texture fractions and ratios are not
// mass contents of the soil, so no policy may move them to an oven-dry basis.
const EXCLUDED_TOKENS = new Set(['PH', 'EC', 'SAND', 'SILT', 'CLAY', 'TEXTURE', 'PSA', 'RATIO', 'SATURATION', 'BS', 'ESP', 'SAR', 'MOISTURE']);
// Only contents per mass of soil scale with the dry mass: per kg, g or 100 g, percent or ppm.
const MASS_CONTENT_UNIT = /\/\s*(?:100\s*)?k?g(?=$|\s*\/|\s+(?:soil|dry)\b)|\bk?g\s*(?:-1|⁻¹)|^%(?:\s*(?:w\/w|m\/m))?$|^ppm$/i;

function analysisEligible(code) {
    if (typeof code !== 'string' || !code.trim()) return false;
    return !code.toUpperCase().split(/[^A-Z0-9]+/).some(token => EXCLUDED_TOKENS.has(token));
}

function unitEligible(unit) {
    return typeof unit === 'string' && MASS_CONTENT_UNIT.test(unit.trim());
}

module.exports = { analysisEligible, unitEligible };
