const crypto = require('crypto');

function calculateChecksum(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Parse JCAMP-DX spectral files (SL-13 & SL-14)
 * Supports continuous (X++(Y..Y)) and table blocks.
 */
function parseJcampDx(content, options = {}) {
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
    const isWavelength = xUnits.includes('NM') || xUnits.includes('NANOMETER');
    const axisUnit = isWavenumber ? 'WAVENUMBER_CM1' : (isWavelength ? 'WAVELENGTH_NM' : 'UNVERIFIED');

    const dataType = (headers['DATA TYPE'] || '').toUpperCase();
    const targetModality = (options && (options.targetModality || options.expectedModality)) || null;
    let modality = 'UNVERIFIED';
    if (dataType.includes('NEAR INFRARED') || dataType.includes('NIR')) {
        modality = 'NIR';
    } else if (dataType.includes('MID INFRARED') || dataType.includes('MIR') || dataType.includes('FTIR') || dataType.includes('INFRARED')) {
        modality = 'MIR';
    } else if (axisUnit === 'WAVELENGTH_NM') {
        modality = 'NIR';
    } else if (targetModality) {
        modality = targetModality;
    }

    if (targetModality === 'MIR' && axisUnit === 'WAVELENGTH_NM') {
        throw new Error('INCOMPATIBLE_MODALITY_UNITS: File with wavelength units (nm) cannot be ingested into a Mid-Infrared (MIR) task context.');
    }

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
function parseCsv(content, options = {}) {
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

    const isWavenumber = headerX.includes('WAVENUMBER') || headerX.includes('CM-1') || headerX.includes('1/CM');
    const isWavelength = headerX.includes('NM') || headerX.includes('WAVELENGTH') || headerX.includes('NANOMETER');
    const axisUnit = isWavenumber ? 'WAVENUMBER_CM1' : (isWavelength ? 'WAVELENGTH_NM' : 'UNVERIFIED');

    const targetModality = (options && (options.targetModality || options.expectedModality)) || null;
    let modality = 'UNVERIFIED';
    if (axisUnit === 'WAVELENGTH_NM') {
        modality = 'NIR';
    } else if (targetModality) {
        modality = targetModality;
    }

    if (targetModality === 'MIR' && axisUnit === 'WAVELENGTH_NM') {
        throw new Error('INCOMPATIBLE_MODALITY_UNITS: CSV file with wavelength units (nm) cannot be ingested into a Mid-Infrared (MIR) task context.');
    }

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
 * Extract parameters from OPUS parameter block
 */
function extractOpusParameters(buffer, blockOffset, byteLength, params) {
    let offset = blockOffset;
    const end = Math.min(blockOffset + byteLength, buffer.length);

    while (offset + 8 < end) {
        const tag = buffer.toString('ascii', offset, offset + 3).trim();
        const type = buffer.readUInt16LE(offset + 4);
        const sizeWords = buffer.readUInt16LE(offset + 6);
        const valOffset = offset + 8;

        if (/^[A-Z0-9]{2,4}$/.test(tag)) {
            if (type === 0 && valOffset + 4 <= end) { // Integer
                params[tag] = buffer.readInt32LE(valOffset);
            } else if (type === 1) { // Real / Float
                if (valOffset + 8 <= end) {
                    params[tag] = buffer.readDoubleLE(valOffset);
                } else if (valOffset + 4 <= end) {
                    params[tag] = buffer.readFloatLE(valOffset);
                }
            } else if (type === 2 && valOffset + 2 <= end) { // String
                const strLen = buffer.readUInt16LE(valOffset);
                const strStart = valOffset + 2;
                if (strStart + strLen <= end) {
                    params[tag] = buffer.toString('ascii', strStart, strStart + strLen).replace(/\0/g, '').trim();
                }
            }
        }
        offset += Math.max(8 + (sizeWords * 2), 8);
    }
}

/**
 * Parse Bruker OPUS Binary Format (SD-13)
 * Native FTIR/NIR binary output from Bruker Alpha, Alpha II, Tensor, MPA, Vertex.
 */
function parseOpus(buffer, options = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 256) {
        throw new Error('Invalid OPUS file: file too small');
    }

    const dirOffset = buffer.readUInt32LE(8);
    let numEntries = buffer.readUInt32LE(16);

    if (dirOffset + numEntries * 12 > buffer.length) {
        numEntries = Math.floor((buffer.length - dirOffset) / 12);
    }

    const dirEntries = [];
    for (let i = 0; i < numEntries; i++) {
        const entryOffset = dirOffset + i * 12;
        if (entryOffset + 12 > buffer.length) break;
        const type = buffer.readUInt32LE(entryOffset);
        const sizeWords = buffer.readUInt32LE(entryOffset + 4);
        const blockOffset = buffer.readUInt32LE(entryOffset + 8);
        if (sizeWords > 0 && blockOffset > 0 && blockOffset + sizeWords * 4 <= buffer.length) {
            dirEntries.push({ type, sizeWords, blockOffset, byteLength: sizeWords * 4 });
        }
    }

    const params = {};
    for (const entry of dirEntries) {
        extractOpusParameters(buffer, entry.blockOffset, entry.byteLength, params);
    }

    // Identify data block (prefer Absorbance = 15, then Reflectance = 31, Transmittance = 23, Single Beam = 7)
    let dataBlock = dirEntries.find(e => (e.type & 0x03FF) === 15) ||
                     dirEntries.find(e => (e.type & 0x03FF) === 31) ||
                     dirEntries.find(e => (e.type & 0x03FF) === 23) ||
                     dirEntries.find(e => (e.type & 0x03FF) === 7) ||
                     dirEntries.find(e => e.sizeWords >= 100);

    if (!dataBlock) {
        throw new Error('No valid spectral data block found in OPUS file');
    }

    const npt = params.NPT || dataBlock.sizeWords;
    const fxv = params.FXV;
    const lxv = params.LXV;

    if (fxv === undefined || lxv === undefined) {
        throw new Error('MISSING_AXIS_CALIBRATION: OPUS file lacks FXV or LXV calibration parameters');
    }

    const step = npt > 1 ? (lxv - fxv) / (npt - 1) : 0;
    const wavelengths = [];
    const values = [];

    for (let i = 0; i < npt; i++) {
        const x = fxv + i * step;
        const bytePos = dataBlock.blockOffset + i * 4;
        if (bytePos + 4 <= buffer.length) {
            wavelengths.push(Math.round(x * 1000) / 1000);
            values.push(buffer.readFloatLE(bytePos));
        }
    }

    const instrument = params.INS || params.INSTRUMENT || null;
    const resolution = params.RES !== undefined ? parseFloat(params.RES) : null;
    const coAddedScans = params.NSS !== undefined ? parseInt(params.NSS, 10) : null;
    const backgroundRef = params.NSR ? `Background (${params.NSR} scans)` : (params.BKM || null);

    let axisUnit = 'UNVERIFIED';
    const dxu = params.DXU !== undefined ? String(params.DXU).trim().toUpperCase() : '';
    if (dxu === 'WN' || dxu.includes('1/CM') || dxu.includes('CM-1') || dxu === '0') {
        axisUnit = 'WAVENUMBER_CM1';
    } else if (dxu === 'NM' || dxu.includes('NANOMETER') || dxu === '2') {
        axisUnit = 'WAVELENGTH_NM';
    } else if (dxu === 'MIC' || dxu === 'UM' || dxu === '1') {
        axisUnit = 'MICROMETERS';
    } else if (fxv !== undefined && (fxv >= 200 && fxv <= 15000)) {
        axisUnit = 'WAVENUMBER_CM1';
    }

    let modality = 'UNVERIFIED';
    const exp = (params.EXP || '').toUpperCase();
    const targetModality = (options && (options.targetModality || options.expectedModality)) || null;
    if (exp.includes('NIR') || ins.includes('MPA') || ins.includes('TANGO') || ins.includes('NIR')) {
        modality = 'NIR';
    } else if (exp.includes('MIR') || exp.includes('DRIFT') || ins.includes('ALPHA') || ins.includes('VERTEX') || ins.includes('TENSOR')) {
        modality = 'MIR';
    } else if (axisUnit === 'WAVELENGTH_NM') {
        modality = 'NIR';
    } else if (targetModality) {
        modality = targetModality;
    }

    if (targetModality === 'MIR' && axisUnit === 'WAVELENGTH_NM') {
        throw new Error('INCOMPATIBLE_MODALITY_UNITS: OPUS file with wavelength units (nm) cannot be ingested into a Mid-Infrared (MIR) task context.');
    }

    const axisDirection = fxv > lxv ? 'DESCENDING' : 'ASCENDING';

    let quantity = 'UNVERIFIED';
    const dyu = (params.DYU || '').toUpperCase();
    if (dyu.includes('AB') || (dataBlock.type & 0x03FF) === 15) quantity = 'ABSORBANCE';
    else if (dyu.includes('TR') || (dataBlock.type & 0x03FF) === 23) quantity = 'TRANSMITTANCE';
    else if (dyu.includes('RF') || dyu.includes('R') || (dataBlock.type & 0x03FF) === 31) quantity = 'REFLECTANCE';

    return {
        format: 'OPUS',
        instrument,
        resolution,
        coAddedScans,
        backgroundRef,
        wavelengths,
        values,
        modality,
        axisUnit,
        axisDirection,
        quantity,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex')
    };
}

/**
 * Parse ASD Binary Format (SD-13)
 * Analytical Spectral Devices (ASD FieldSpec 3 / 4, HandHeld)
 */
function parseAsd(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 484) {
        throw new Error('Invalid ASD file: buffer too small');
    }

    const channels = buffer.readUInt16LE(178) || 2151;
    const wavelenInit = buffer.readFloatLE(180) || 350.0;
    const wavelenStep = buffer.readFloatLE(184) || 1.0;
    const dataType = buffer.readUInt8(188);

    const wavelengths = [];
    const values = [];
    const dataOffset = 484;

    for (let i = 0; i < channels; i++) {
        const bytePos = dataOffset + i * 4;
        if (bytePos + 4 <= buffer.length) {
            wavelengths.push(Math.round((wavelenInit + i * wavelenStep) * 1000) / 1000);
            values.push(buffer.readFloatLE(bytePos));
        }
    }

    let quantity = 'UNVERIFIED';
    if (dataType === 1) quantity = 'REFLECTANCE';
    else if (dataType === 2) quantity = 'RADIANCE';

    return {
        format: 'ASD',
        instrument: 'ASD FieldSpec',
        resolution: wavelenStep,
        coAddedScans: null,
        wavelengths,
        values,
        modality: 'NIR',
        axisUnit: 'WAVELENGTH_NM',
        axisDirection: 'ASCENDING',
        quantity,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex')
    };
}

/**
 * Parse Galactic / Thermo GRAMS .spc Binary Format (SD-13)
 */
function parseSpc(buffer, options = {}) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 512) {
        throw new Error('Invalid SPC file: buffer too small');
    }

    const fnpts = buffer.readUInt32LE(4);
    const ffirst = buffer.readDoubleLE(8);
    const flast = buffer.readDoubleLE(16);
    const fxtype = buffer.readUInt8(28);
    const fytype = buffer.readUInt8(29);

    if (fnpts === 0 || fnpts > 100000) {
        throw new Error('Invalid SPC point count: ' + fnpts);
    }

    const isWavenumber = fxtype === 1;
    const isWavelength = fxtype === 3;
    const axisUnit = isWavenumber ? 'WAVENUMBER_CM1' : (isWavelength ? 'WAVELENGTH_NM' : 'UNVERIFIED');

    let modality = 'UNVERIFIED';
    if (axisUnit === 'WAVELENGTH_NM') {
        modality = 'NIR';
    } else if (options && options.targetModality) {
        modality = options.targetModality;
    }

    if (options && options.targetModality === 'MIR' && axisUnit === 'WAVELENGTH_NM') {
        throw new Error('INCOMPATIBLE_MODALITY_UNITS: SPC file with wavelength units (nm) cannot be ingested into a Mid-Infrared (MIR) task context.');
    }

    const axisDirection = ffirst > flast ? 'DESCENDING' : 'ASCENDING';

    let quantity = 'UNVERIFIED';
    if (fytype === 1) quantity = 'TRANSMITTANCE';
    else if (fytype === 2) quantity = 'REFLECTANCE';
    else if (fytype === 3) quantity = 'ABSORBANCE';

    const step = fnpts > 1 ? (flast - ffirst) / (fnpts - 1) : 0;
    const wavelengths = [];
    const values = [];
    const dataOffset = 512 + 32;

    for (let i = 0; i < fnpts; i++) {
        const bytePos = dataOffset + i * 4;
        if (bytePos + 4 <= buffer.length) {
            wavelengths.push(Math.round((ffirst + i * step) * 1000) / 1000);
            values.push(buffer.readFloatLE(bytePos));
        }
    }

    return {
        format: 'SPC',
        instrument: 'Thermo GRAMS / SPC',
        wavelengths,
        values,
        modality,
        axisUnit,
        axisDirection,
        quantity,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex')
    };
}

function isOpusFormat(buffer, filename) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 256) return false;
    const ext = filename.toLowerCase();
    if (ext.endsWith('.opus') || /\.[0-9]+$/.test(ext)) return true;
    if (buffer[0] === 0x0A && buffer[1] === 0x0A) return true;
    const dirPtr = buffer.readUInt32LE(8);
    return dirPtr >= 12 && dirPtr < buffer.length && buffer.readUInt32LE(16) > 0 && buffer.readUInt32LE(16) < 500;
}

function isAsdFormat(buffer, filename) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 484) return false;
    const ext = filename.toLowerCase();
    if (ext.endsWith('.asd')) return true;
    const sig = buffer.toString('ascii', 0, 3);
    return sig === 'ASD' || sig === 'FS3';
}

function isSpcFormat(buffer, filename) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 512) return false;
    const ext = filename.toLowerCase();
    if (ext.endsWith('.spc')) return true;
    const fversn = buffer.readUInt8(1);
    if (fversn === 0x4B || fversn === 0x4D) {
        const pts = buffer.readUInt32LE(4);
        return pts > 0 && pts < 100000;
    }
    return false;
}

/**
 * Universal Spectral File Parser (Supports Buffer or string)
 */
exports.parseSpectralFile = (rawInput, filename = '', options = {}) => {
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

    // Binary format detection
    if (isOpusFormat(buffer, filename)) {
        return parseOpus(buffer, options);
    }
    if (isAsdFormat(buffer, filename)) {
        return parseAsd(buffer, options);
    }
    if (isSpcFormat(buffer, filename)) {
        return parseSpc(buffer, options);
    }

    const trimmed = content.trim();
    const isJcamp = trimmed.startsWith('##TITLE') || trimmed.includes('##JCAMP-DX') ||
        filename.endsWith('.dx') || filename.endsWith('.jdx') || filename.endsWith('.jcamp');

    const result = isJcamp ? parseJcampDx(content, options) : parseCsv(content, options);
    result.sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    return result;
};

exports.calculateChecksum = calculateChecksum;
exports.parseOpus = parseOpus;
exports.parseAsd = parseAsd;
exports.parseSpc = parseSpc;
