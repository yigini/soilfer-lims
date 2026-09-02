const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { getAuthToken } = require('../setup');

describe('Spectral Multipart Raw Ingest & Byte-Identical Preservation Contract (SL-06 & SL-13)', () => {
    let techToken;
    const sampleId = 'TEST-MULTIPART-SMP-01';

    beforeAll(async () => {
        // Cleanup
        await prisma.spectralData.deleteMany({
            where: { sampleId }
        });
        await prisma.sample.deleteMany({
            where: { id: sampleId }
        });

        techToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Create sample
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                status: 'PROCESSING',
                matrix: 'SOIL'
            }
        });
    });

    afterAll(async () => {
        await prisma.spectralData.deleteMany({
            where: { sampleId }
        });
        await prisma.sample.deleteMany({
            where: { id: sampleId }
        });
    });

    test('1. Multipart raw JCAMP-DX upload preserves exact binary bytes and downloads back byte-identical', async () => {
        // Construct raw JCAMP-DX buffer with arbitrary bytes
        const rawJcampString = [
            '##TITLE=Soil Scan 01',
            '##JCAMP-DX=5.00',
            '##DATA TYPE=INFRARED SPECTRUM',
            '##XUNITS=1/CM',
            '##YUNITS=ABSORBANCE',
            '##FIRSTX=4000.0',
            '##LASTX=400.0',
            '##NPOINTS=5',
            '##XYDATA=(X++(Y..Y))',
            '4000.0 0.1234 0.2345 0.3456 0.4567 0.5678',
            '##END='
        ].join('\r\n');

        const rawBuffer = Buffer.from(rawJcampString, 'utf8');
        const expectedSha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');

        // Multipart upload via .attach('files', buffer, filename)
        const uploadRes = await request(app)
            .post('/api/spectral/upload-raw')
            .set('Authorization', `Bearer ${techToken}`)
            .field('sampleId', sampleId)
            .field('labId', sampleId)
            .field('modality', 'MIR')
            .attach('files', rawBuffer, `${sampleId}_scan.dx`);

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body.results.success).toBe(1);

        // Verify database record
        const scan = await prisma.spectralData.findFirst({
            where: { sampleId, filename: `${sampleId}_scan.dx` }
        });
        expect(scan).toBeDefined();
        expect(scan.sha256).toBe(expectedSha256);
        expect(scan.sourceFormat).toBe('JCAMP-DX');
        expect(scan.quantity).toBe('ABSORBANCE'); // Extracted from ##YUNITS=ABSORBANCE
        expect(scan.axisUnit).toBe('WAVENUMBER_CM1');
        expect(scan.sourceFile).toBeDefined();

        // Verify disk file is 100% byte-identical
        const fullDiskPath = path.isAbsolute(scan.sourceFile)
            ? scan.sourceFile
            : path.join(__dirname, '..', '..', scan.sourceFile);
        expect(fs.existsSync(fullDiskPath)).toBe(true);
        const diskBytes = fs.readFileSync(fullDiskPath);
        expect(diskBytes.equals(rawBuffer)).toBe(true);

        // Verify GET /:id/raw downloads back byte-identical file
        const downloadRes = await request(app)
            .get(`/api/spectral/${scan.id}/raw`)
            .set('Authorization', `Bearer ${techToken}`);

        expect(downloadRes.status).toBe(200);
        expect(downloadRes.body.length).toBe(rawBuffer.length);
        expect(Buffer.from(downloadRes.body).equals(rawBuffer)).toBe(true);
    });

    test('2. Multipart duplicate upload is rejected by checksum', async () => {
        const rawJcampString = [
            '##TITLE=Soil Scan 01',
            '##JCAMP-DX=5.00',
            '##DATA TYPE=INFRARED SPECTRUM',
            '##XUNITS=1/CM',
            '##YUNITS=ABSORBANCE',
            '##FIRSTX=4000.0',
            '##LASTX=400.0',
            '##NPOINTS=5',
            '##XYDATA=(X++(Y..Y))',
            '4000.0 0.1234 0.2345 0.3456 0.4567 0.5678',
            '##END='
        ].join('\r\n');

        const rawBuffer = Buffer.from(rawJcampString, 'utf8');

        const dupRes = await request(app)
            .post('/api/spectral/batch')
            .set('Authorization', `Bearer ${techToken}`)
            .field('sampleId', sampleId)
            .attach('files', rawBuffer, 'duplicate.dx');

        expect(dupRes.status).toBe(200);
        expect(dupRes.body.results.skipped).toBe(1);
        expect(dupRes.body.results.errors[0].error).toMatch(/Duplicate spectrum rejected/);
    });
});
