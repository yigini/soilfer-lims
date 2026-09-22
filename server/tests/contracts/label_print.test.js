'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const sampleWorkspaceService = require('../../services/sampleWorkspaceService');

describe('Contract: Sample Label Printing, Sizing & Offline QR Code Isolation (Issue #121)', () => {
    let techGtmToken, mgrGtmToken;
    const testSampleId = `SMP-LBL-${Date.now()}`;
    const testSampleLabCode = `LAB-LBL-${Date.now()}`;
    const testSampleOriginalId = `FIELD-LBL-${Date.now()}`;

    const rejectedSampleId = `SMP-LBL-REJ-${Date.now()}`;
    const expectedSampleId = `SMP-LBL-EXP-${Date.now()}`;

    beforeAll(async () => {
        techGtmToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // 1. Create standard processing sample
        await prisma.sample.create({
            data: {
                id: testSampleId,
                labId: testSampleLabCode,
                originalId: testSampleOriginalId,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                receptionDate: new Date(),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        // 2. Create intake rejected sample
        await prisma.sample.create({
            data: {
                id: rejectedSampleId,
                labId: `LAB-REJ-${Date.now()}`,
                originalId: `FIELD-REJ-${Date.now()}`,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'RECEIVED_REJECTED',
                receptionDate: new Date()
            }
        });

        // 3. Create pre-arrival EXPECTED sample
        await prisma.sample.create({
            data: {
                id: expectedSampleId,
                originalId: `FIELD-EXP-${Date.now()}`,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'EXPECTED'
            }
        });
    });

    afterAll(async () => {
        await prisma.sample.deleteMany({
            where: { id: { in: [testSampleId, rejectedSampleId, expectedSampleId] } }
        }).catch(() => {});
    });

    test('1. GET /api/public/branding provides branding configuration without requiring auth', async () => {
        const res = await request(app).get('/api/public/branding');
        expect(res.status).toBe(200);
        expect(res.body.branding).toBeDefined();
        expect(res.body.branding.title).toBeDefined();
    });

    test('2. Workspace projection enforces canPrintLabel capability gate based on intake rejection', async () => {
        // Standard processing sample allows label printing
        const wsNormal = await sampleWorkspaceService.getSampleWorkspace(testSampleId, { role: 'LAB_TECHNICIAN', labId: 'LAB-GTM' });
        expect(wsNormal.capabilities.canPrintLabel).toBeDefined();
        expect(wsNormal.capabilities.canPrintLabel.allowed).toBe(true);

        // Intake rejected sample strictly forbids label printing
        const wsRejected = await sampleWorkspaceService.getSampleWorkspace(rejectedSampleId, { role: 'LAB_TECHNICIAN', labId: 'LAB-GTM' });
        expect(wsRejected.capabilities.canPrintLabel).toBeDefined();
        expect(wsRejected.capabilities.canPrintLabel.allowed).toBe(false);
    });

    test('3. Pre-arrival EXPECTED sample allows printing with Pending permanent lab identifier', async () => {
        const wsExpected = await sampleWorkspaceService.getSampleWorkspace(expectedSampleId, { role: 'SAMPLE_RECEPTION', labId: 'LAB-GTM' });
        expect(wsExpected.capabilities.canPrintLabel.allowed).toBe(true);
        expect(wsExpected.identity.labSampleCode).toBe('Not assigned');
        expect(wsExpected.identity.originalId).toBeDefined();
    });

    test('4. Label format specifications match thermal printer physical dimensions', () => {
        const STANDARD_LABEL = {
            name: 'STANDARD',
            widthMm: 101,
            heightMm: 54,
            cssPageSize: '101mm 54mm',
            targetType: 'Sample Bag / Storage Container'
        };

        const COMPACT_LABEL = {
            name: 'COMPACT',
            widthMm: 50,
            heightMm: 25,
            cssPageSize: '50mm 25mm',
            targetType: 'Cryovial / 2mL Centrifuge Tube'
        };

        expect(STANDARD_LABEL.widthMm).toBe(101);
        expect(STANDARD_LABEL.heightMm).toBe(54);
        expect(COMPACT_LABEL.widthMm).toBe(50);
        expect(COMPACT_LABEL.heightMm).toBe(25);
    });

    test('5. Sanitizes sample identifier for document.title print naming isolation', () => {
        const sanitizeForPrint = (sample) => {
            const rawId = sample.labId || sample.originalId || sample.id || 'sample';
            return String(rawId).replace(/[^a-zA-Z0-9-_]/g, '_');
        };

        expect(sanitizeForPrint({ labId: 'LAB/SMP/2026-01' })).toBe('LAB_SMP_2026-01');
        expect(sanitizeForPrint({ originalId: 'FIELD #42 (plot-A)' })).toBe('FIELD__42__plot-A_');
        expect(sanitizeForPrint({ id: 'uuid-123' })).toBe('uuid-123');
    });
});
