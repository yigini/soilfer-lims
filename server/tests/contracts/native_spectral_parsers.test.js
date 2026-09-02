const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { parseSpectralFile, parseOpus, parseAsd, parseSpc } = require('../../services/spectralParser');

/**
 * Helper to construct a synthetic valid Bruker OPUS binary file buffer
 */
function createSyntheticOpusBuffer({
    instrument = 'Bruker Alpha FTIR',
    resolution = 4.0,
    scans = 32,
    bgScans = 32,
    firstX = 4000.0,
    lastX = 400.0,
    points = 50
} = {}) {
    const buf = Buffer.alloc(2048, 0);

    // Magic bytes
    buf[0] = 0x0A;
    buf[1] = 0x0A;
    buf[2] = 0xFE;
    buf[3] = 0xFE;

    const dirOffset = 24;
    buf.writeUInt32LE(dirOffset, 8); // dirOffset
    buf.writeUInt32LE(10, 12);        // maxEntries
    buf.writeUInt32LE(2, 16);         // numEntries

    const paramOffset = 64;
    const paramBytes = 300;
    const paramWords = Math.ceil(paramBytes / 4);

    const dataOffset = paramOffset + paramBytes;
    const dataWords = points;

    // Entry 0: Parameter Block (type 1)
    buf.writeUInt32LE(1, dirOffset);
    buf.writeUInt32LE(paramWords, dirOffset + 4);
    buf.writeUInt32LE(paramOffset, dirOffset + 8);

    // Entry 1: Absorbance Data Block (type 15)
    buf.writeUInt32LE(15, dirOffset + 12);
    buf.writeUInt32LE(dataWords, dirOffset + 16);
    buf.writeUInt32LE(dataOffset, dirOffset + 20);

    // Write parameters into paramOffset
    let p = paramOffset;

    // Tag: INS (string, type 2)
    buf.write('INS', p, 3, 'ascii');
    buf.writeUInt16LE(2, p + 4); // type String
    buf.writeUInt16LE(10, p + 6); // sizeWords
    buf.writeUInt16LE(instrument.length, p + 8);
    buf.write(instrument, p + 10, instrument.length, 'ascii');
    p += 8 + 20;

    // Tag: RES (double, type 1)
    buf.write('RES', p, 3, 'ascii');
    buf.writeUInt16LE(1, p + 4); // type Float
    buf.writeUInt16LE(4, p + 6);
    buf.writeDoubleLE(resolution, p + 8);
    p += 8 + 8;

    // Tag: NSS (int32, type 0)
    buf.write('NSS', p, 3, 'ascii');
    buf.writeUInt16LE(0, p + 4); // type Int
    buf.writeUInt16LE(2, p + 6);
    buf.writeInt32LE(scans, p + 8);
    p += 8 + 4;

    // Tag: NSR (int32, type 0)
    buf.write('NSR', p, 3, 'ascii');
    buf.writeUInt16LE(0, p + 4);
    buf.writeUInt16LE(2, p + 6);
    buf.writeInt32LE(bgScans, p + 8);
    p += 8 + 4;

    // Tag: FXV (double, type 1)
    buf.write('FXV', p, 3, 'ascii');
    buf.writeUInt16LE(1, p + 4);
    buf.writeUInt16LE(4, p + 6);
    buf.writeDoubleLE(firstX, p + 8);
    p += 8 + 8;

    // Tag: LXV (double, type 1)
    buf.write('LXV', p, 3, 'ascii');
    buf.writeUInt16LE(1, p + 4);
    buf.writeUInt16LE(4, p + 6);
    buf.writeDoubleLE(lastX, p + 8);
    p += 8 + 8;

    // Tag: NPT (int32, type 0)
    buf.write('NPT', p, 3, 'ascii');
    buf.writeUInt16LE(0, p + 4);
    buf.writeUInt16LE(2, p + 6);
    buf.writeInt32LE(points, p + 8);
    p += 8 + 4;

    // Write Float32 spectral values into dataOffset
    for (let i = 0; i < points; i++) {
        const y = 0.125 + Math.sin(i / 5) * 0.05;
        buf.writeFloatLE(y, dataOffset + i * 4);
    }

    return buf;
}

/**
 * Helper to construct synthetic ASD binary buffer
 */
function createSyntheticAsdBuffer(points = 100) {
    const buf = Buffer.alloc(484 + points * 4, 0);
    buf.write('ASD', 0, 3, 'ascii');
    buf.writeUInt16LE(points, 178);     // channels
    buf.writeFloatLE(350.0, 180);       // wavelenInit
    buf.writeFloatLE(1.0, 184);         // wavelenStep
    buf.writeUInt8(1, 188);             // dataType = 1 (Reflectance)

    for (let i = 0; i < points; i++) {
        buf.writeFloatLE(0.45 + (i * 0.001), 484 + i * 4);
    }
    return buf;
}

/**
 * Helper to construct synthetic Galactic SPC binary buffer
 */
function createSyntheticSpcBuffer(points = 60) {
    const buf = Buffer.alloc(512 + 32 + points * 4, 0);
    buf.writeUInt8(0x00, 0);
    buf.writeUInt8(0x4B, 1);            // fversn = 0x4B ('K')
    buf.writeUInt8(1, 2);               // fexper
    buf.writeUInt32LE(points, 4);       // fnpts
    buf.writeDoubleLE(4000.0, 8);       // ffirst
    buf.writeDoubleLE(400.0, 16);       // flast
    buf.writeUInt8(1, 28);              // fxtype = cm-1
    buf.writeUInt8(3, 29);              // fytype = Absorbance

    const dataStart = 512 + 32;
    for (let i = 0; i < points; i++) {
        buf.writeFloatLE(0.22, dataStart + i * 4);
    }
    return buf;
}

describe('SD-13: Native Binary Spectral Parsers (Bruker OPUS, ASD, SPC)', () => {
    let mgrGtmToken;
    const sampleId = 'SMP-SD13-TEST-01';

    beforeAll(async () => {
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        await prisma.spectralData.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });

        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                assignedLab: 'LAB-GTM',
                labId: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL'
            }
        });
    });

    afterAll(async () => {
        await prisma.spectralData.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });
    });

    test('1. parseSpectralFile identifies and parses Bruker OPUS binary buffer', () => {
        const opusBuffer = createSyntheticOpusBuffer({
            instrument: 'Bruker Tensor 27',
            resolution: 4.0,
            scans: 64,
            bgScans: 32,
            points: 50
        });

        const parsed = parseSpectralFile(opusBuffer, 'soil_sample_01.0');
        expect(parsed.format).toBe('OPUS');
        expect(parsed.instrument).toBe('Bruker Tensor 27');
        expect(parsed.resolution).toBe(4.0);
        expect(parsed.coAddedScans).toBe(64);
        expect(parsed.backgroundRef).toMatch(/32 scans/);
        expect(parsed.quantity).toBe('ABSORBANCE');
        expect(parsed.axisUnit).toBe('WAVENUMBER_CM1');
        expect(parsed.axisDirection).toBe('DESCENDING');
        expect(parsed.wavelengths.length).toBe(50);
        expect(parsed.values.length).toBe(50);
        expect(parsed.wavelengths[0]).toBe(4000);
        expect(parsed.wavelengths[49]).toBe(400);
    });

    test('2. parseSpectralFile identifies and parses ASD binary buffer', () => {
        const asdBuffer = createSyntheticAsdBuffer(80);
        const parsed = parseSpectralFile(asdBuffer, 'field_spec_01.asd');

        expect(parsed.format).toBe('ASD');
        expect(parsed.instrument).toBe('ASD FieldSpec');
        expect(parsed.quantity).toBe('REFLECTANCE');
        expect(parsed.axisUnit).toBe('WAVELENGTH_NM');
        expect(parsed.axisDirection).toBe('ASCENDING');
        expect(parsed.wavelengths.length).toBe(80);
        expect(parsed.wavelengths[0]).toBe(350);
    });

    test('3. parseSpectralFile identifies and parses Galactic SPC binary buffer', () => {
        const spcBuffer = createSyntheticSpcBuffer(60);
        const parsed = parseSpectralFile(spcBuffer, 'grams_scan.spc');

        expect(parsed.format).toBe('SPC');
        expect(parsed.instrument).toBe('Thermo GRAMS / SPC');
        expect(parsed.quantity).toBe('ABSORBANCE');
        expect(parsed.axisUnit).toBe('WAVENUMBER_CM1');
        expect(parsed.wavelengths.length).toBe(60);
    });

    test('4. Uploading an OPUS binary file populates acquisition fields without manual entry', async () => {
        const opusBuffer = createSyntheticOpusBuffer({
            instrument: 'Bruker Alpha II',
            resolution: 4.0,
            scans: 32,
            bgScans: 16,
            points: 50
        });

        const res = await request(app)
            .post('/api/spectral/upload-raw')
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .field('sampleId', sampleId)
            .field('labId', 'LAB-GTM')
            .field('modality', 'MIR')
            .attach('files', opusBuffer, 'sample_alpha.0');

        expect(res.status).toBe(200);
        expect(res.body.results.success).toBe(1);

        const savedScan = await prisma.spectralData.findFirst({
            where: { sampleId },
            orderBy: { timestamp: 'desc' }
        });

        expect(savedScan).not.toBeNull();
        expect(savedScan.sourceFormat).toBe('OPUS');
        expect(savedScan.resolution).toBe(4.0);
        expect(savedScan.coAddedScans).toBe(32);
        expect(savedScan.backgroundRef).toMatch(/16 scans/);
        expect(savedScan.quantity).toBe('ABSORBANCE');
        expect(savedScan.axisUnit).toBe('WAVENUMBER_CM1');
    });
});
