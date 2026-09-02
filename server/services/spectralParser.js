const crypto = require('crypto');

function calculateChecksum(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Parse JCAMP-DX spectral files (SL-13 & SL-14)
 * Supports continuous (X++(Y..Y)) and table blocks.
 */
function parseJcampDx(content) {
    const lines = content.split(/\r?\n/);
    const headers = {};
    let inData = false;
    const rawDataLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('##')) {
            const eqIdx = line.indexOf('=');
            if (eqIdx !== -1) {
                const key = line.slice(2, eqIdx).trim().toUpperCase();
                const val = line.slice(eqIdx + 1).trim();
                headers[key] = val;

                if (key.includes('XYDATA') || key.includes('PEAK TABLE') || key.includes('DATA TABLE')) {
                    inData = true;
                    continue;
                }
            }
            if (line.startsWith('##END')) {
                inData = false;
            }
        } else if (inData && line.length > 0) {
            rawDataLines.push(line);
        }
    }

    const wavelengths = [];
    const values = [];

    const deltaX = headers['DELTAX'] ? parseFloat(headers['DELTAX']) : null;
    const firstX = headers['FIRSTX'] ? parseFloat(headers['FIRSTX']) : null;

    for (const dLine of rawDataLines) {
        if (dLine.startsWith('$$')) continue; // comments

        const tokens = dLine.replace(/[,;]/g, ' ').trim().split(/\s+/);
        if (tokens.length >= 2) {
            const startX = parseFloat(tokens[0]);
            if (isNaN(startX)) continue;

            const yTokens = tokens.slice(1);
            for (let j = 0; j < yTokens.length; j++) {
                const yVal = parseFloat(yTokens[j]);
                if (!isNaN(yVal)) {
                    let currentX = startX;
                    if (deltaX !== null) {
                        currentX = startX + (j * deltaX);
                    } else if (firstX !== null && wavelengths.length > 0) {
                        currentX = wavelengths[wavelengths.length - 1];
                    }
                    wavelengths.push(Math.round(currentX * 1000) / 1000);
                    values.push(yVal);
                }
            }
        }
    }

    // Determine axis unit and modality
    const xUnits = (headers['XUNITS'] || '').toUpperCase();
    const isWavenumber = xUnits.includes('1/CM') || xUnits.includes('CM-1') || xUnits.includes('WAVENUMBER');
    const axisUnit = isWavenumber ? 'WAVENUMBER_CM1' : 'WAVELENGTH_NM';
    const modality = isWavenumber ? 'MIR' : 'NIR';

    // Determine physical    // Quantity
    const yUnits = headers['YUNITS'] ? headers['YUNITS'].toUpperCase() : '';
    let quantity = 'UNVERIFIED';
    if (yUnits.includes('ABSORB') || yUnits.includes('AU')) quantity = 'ABSORBANCE';
    else if (yUnits.includes('REFLECT') || yUnits.includes('%R')) quantity = 'REFLECTANCE';
    else if (yUnits.includes('LOG') || yUnits.includes('1/R')) quantity = 'LOG_1_R';
    else if (yUnits.includes('TRANSMIT') || yUnits.includes('%T')) quantity = 'TRANSMITTANCE';
    else if (yUnits.includes('KUBELKA')) quantity = 'KUBELKA_MUNK';

    // Resolution & Instrument
    const resolution = headers['RESOLUTION'] ? parseFloat(headers['RESOLUTION']) : null;
    const instrument = headers['SPECTROMETER/DATA SYSTEM'] || headers['INSTRUMENT'] || headers['ORIGIN'] || null;

    return {
        format: 'JCAMP-DX',
        headers,
        wavelengths,
        values,
        modality,
        axisUnit,
        quantity,
        resolution,
        instrument,
        sha256: calculateChecksum(content)
    };
}

/**
 * Parse Delimited CSV / TSV spectral files (SL-13)
 */
function parseCsv(content) {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
    if (lines.length === 0) {
        throw new Error('Empty CSV spectral content');
    }

    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';')) delimiter = ';';

    let startIndex = 0;
    let headerX = '';
    let headerY = '';

    const firstParts = firstLine.split(delimiter).map(s => s.trim());
    if (isNaN(parseFloat(firstParts[0])) || isNaN(parseFloat(firstParts[1]))) {
        headerX = firstParts[0].toUpperCase();
        headerY = firstParts[1] ? firstParts[1].toUpperCase() : '';
        startIndex = 1;
    }

    const wavelengths = [];
    const values = [];

    for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map(s => s.trim());
        if (parts.length >= 2) {
            const w = parseFloat(parts[0]);
            const v = parseFloat(parts[1]);
            if (!isNaN(w) && !isNaN(v)) {
                wavelengths.push(w);
                values.push(v);
            }
        }
    }

    if (wavelengths.length === 0) {
        throw new Error('No numeric spectral coordinate pairs found in CSV');
    }

    const isWavenumber = headerX.includes('WAVENUMBER') || headerX.includes('CM-1') ||
        (wavelengths[0] > 2500 || wavelengths[wavelengths.length - 1] > 2500 || (wavelengths[0] >= 400 && wavelengths[0] <= 4000 && wavelengths[wavelengths.length - 1] <= 4000 && wavelengths[0] > wavelengths[wavelengths.length - 1]));

    const axisUnit = isWavenumber ? 'WAVENUMBER_CM1' : 'WAVELENGTH_NM';
    const modality = isWavenumber ? 'MIR' : 'NIR';

    let quantity = 'UNVERIFIED';
    if (headerY.includes('REFLECTANCE') || headerY.includes('%R') || headerY.includes('//R')) quantity = 'REFLECTANCE';
    else if (headerY.includes('ABSORBANCE') || headerY.includes('AU')) quantity = 'ABSORBANCE';
    else if (headerY.includes('TRANSMITTANCE') || headerY.includes('%T')) quantity = 'TRANSMITTANCE';
    else if (headerY.includes('LOG') || headerY.includes('1/R')) quantity = 'LOG_1_R';
    else if (headerY.includes('KUBELKA')) quantity = 'KUBELKA_MUNK';

    return {
        format: 'CSV',
        wavelengths,
        values,
        modality,
        axisUnit,
        quantity,
        sha256: calculateChecksum(content)
    };
}

/**
 * Universal Spectral File Parser (Supports Buffer or string)
 */
exports.parseSpectralFile = (rawInput, filename = '') => {
    let content;
    let buffer;
    if (Buffer.isBuffer(rawInput)) {
        buffer = rawInput;
        content = rawInput.toString('utf8');
    } else if (typeof rawInput === 'string') {
        content = rawInput;
        buffer = Buffer.from(rawInput, 'utf8');
    } else {
        throw new Error('Invalid raw content: Buffer or string expected');
    }

    const trimmed = content.trim();
    const isJcamp = trimmed.startsWith('##TITLE') || trimmed.includes('##JCAMP-DX') ||
        filename.endsWith('.dx') || filename.endsWith('.jdx') || filename.endsWith('.jcamp');

    const result = isJcamp ? parseJcampDx(content) : parseCsv(content);
    result.sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    return result;
};

exports.calculateChecksum = calculateChecksum;
