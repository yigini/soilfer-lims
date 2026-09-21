'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('Reception Compliance Checklist & Manager Exception Contracts (#117, #113)', () => {
    const SUFFIX = 'COMPL-' + Date.now();
    const testLab = 'LAB-' + SUFFIX;
    let authReception;
    let authManager;
    let authAdmin;
    const trackedSampleIds = new Set();
    const trackedProjectIds = new Set();

    beforeAll(async () => {
        // Create active lab
        await prisma.lab.create({
            data: {
                id: testLab,
                code: SUFFIX.slice(-4),
                name: 'Lab ' + SUFFIX,
                country: 'Guatemala',
                isActive: true
            }
        });

        // Setup tokens for Reception, Manager, and Admin
        const tokenReception = await getAuthToken('SAMPLE_RECEPTION', testLab, ['GTM']);
        authReception = `Bearer ${tokenReception}`;

        const tokenManager = await getAuthToken('LAB_MANAGER', testLab, ['GTM']);
        authManager = `Bearer ${tokenManager}`;

        const tokenAdmin = await getAuthToken('SUPER_ADMIN', testLab, ['GTM']);
        authAdmin = `Bearer ${tokenAdmin}`;

        // Ensure users do not have mustChangePassword flag
        await prisma.user.updateMany({
            where: { role: { in: ['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'] } },
            data: { mustChangePassword: false }
        });
    });

    afterAll(async () => {
        if (trackedSampleIds.size > 0) {
            await prisma.workItem.deleteMany({ where: { sampleId: { in: Array.from(trackedSampleIds) } } });
            await prisma.result.deleteMany({ where: { sampleId: { in: Array.from(trackedSampleIds) } } });
            await prisma.sample.deleteMany({ where: { id: { in: Array.from(trackedSampleIds) } } });
        }
        if (trackedProjectIds.size > 0) {
            await prisma.project.deleteMany({ where: { id: { in: Array.from(trackedProjectIds) } } });
        }
        await prisma.lab.deleteMany({ where: { id: testLab } });
    });

    // 1. All-pass checklist accepted routinely by reception staff
    it('routinely accepts sample when all compliance criteria pass', async () => {
        const sampleId = 'SMP-PASS-' + SUFFIX;
        trackedSampleIds.add(sampleId);

        const checklist = {
            items: {
                container: { status: 'PASS', note: 'Sealed plastic container intact' },
                label: { status: 'PASS', note: 'Barcode legible and matches' },
                quantity: { status: 'PASS', note: '500g sufficient' },
                condition: { status: 'PASS', note: 'Dry and free of roots' },
                coc: { status: 'PASS', note: 'Signed transfer document attached' }
            },
            nonConformance: false
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                isWalkIn: true,
                decision: 'ACCEPTED',
                receivedMass: 350.0,
                checklist
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const sample = await prisma.sample.findFirst({ where: { originalId: sampleId } });
        expect(sample).not.toBeNull();
        expect(sample.status).toBe('ACCEPTED');

        const history = JSON.parse(sample.history || '[]');
        expect(history.some(h => h.status === 'RECEIVED')).toBe(true);
        expect(history.some(h => h.status === 'ADMITTED_WITH_EXCEPTION')).toBe(false);
    });

    // 2. Allowed N/A (coc on walk-in) accepted
    it('accepts walk-in intake with N/A for chain of custody', async () => {
        const sampleId = 'SMP-NA-COC-' + SUFFIX;
        trackedSampleIds.add(sampleId);

        const checklist = {
            items: {
                container: { status: 'PASS' },
                label: { status: 'PASS' },
                quantity: { status: 'PASS' },
                condition: { status: 'PASS' },
                coc: { status: 'NA', note: 'Walk-in direct drop-off by farmer' }
            },
            nonConformance: false
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                isWalkIn: true,
                decision: 'ACCEPTED',
                receivedMass: 300.0,
                checklist
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const sample = await prisma.sample.findFirst({ where: { originalId: sampleId } });
        expect(sample.status).toBe('ACCEPTED');
    });

    // 3. Prohibited N/A (label or container) rejected with 400 INVALID_CHECKLIST_NA
    it('rejects intake with 400 INVALID_CHECKLIST_NA when container or label is marked N/A', async () => {
        const sampleId = 'SMP-INVALID-NA-' + SUFFIX;
        trackedSampleIds.add(sampleId);

        const checklist = {
            items: {
                container: { status: 'NA', note: 'Not inspected' },
                label: { status: 'PASS' },
                quantity: { status: 'PASS' },
                condition: { status: 'PASS' },
                coc: { status: 'PASS' }
            },
            nonConformance: false
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                isWalkIn: true,
                decision: 'ACCEPTED',
                receivedMass: 250.0,
                checklist
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_CHECKLIST_NA');
        expect(res.body.invalidItems).toContain('container');
    });

    // 4. Incomplete checklist rejected with 400 INCOMPLETE_COMPLIANCE_CHECKLIST
    it('rejects intake with 400 INCOMPLETE_COMPLIANCE_CHECKLIST when checklist items are unanswered', async () => {
        const sampleId = 'SMP-INCOMPLETE-' + SUFFIX;
        trackedSampleIds.add(sampleId);

        const checklist = {
            items: {
                container: { status: 'PASS' },
                label: { status: 'PASS' },
                // condition and quantity omitted
                coc: { status: 'PASS' }
            },
            nonConformance: false
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                isWalkIn: true,
                decision: 'ACCEPTED',
                receivedMass: 250.0,
                checklist
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INCOMPLETE_COMPLIANCE_CHECKLIST');
        expect(res.body.unansweredItems).toContain('quantity');
        expect(res.body.unansweredItems).toContain('condition');
    });

    // 5. Failed check blocked for reception staff with 403 COMPLIANCE_FAILURE_EXCEPTION_REQUIRED
    it('blocks reception staff with 403 COMPLIANCE_FAILURE_EXCEPTION_REQUIRED when checklist has failed criteria', async () => {
        const sampleId = 'SMP-FAIL-RECEPT-' + SUFFIX;
        trackedSampleIds.add(sampleId);

        const checklist = {
            items: {
                container: { status: 'FAIL', note: 'Bag punctured and leaking soil' },
                label: { status: 'PASS' },
                quantity: { status: 'PASS' },
                condition: { status: 'PASS' },
                coc: { status: 'PASS' }
            },
            nonConformance: true,
            reason: 'Torn bag in transit'
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                isWalkIn: true,
                decision: 'ACCEPTED',
                receivedMass: 250.0,
                checklist
            });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('COMPLIANCE_FAILURE_EXCEPTION_REQUIRED');
        expect(res.body.failedChecks).toBeDefined();
        expect(res.body.failedChecks.some(f => f.key === 'container')).toBe(true);
    });

    // 6. Reception staff cannot self-authorize admission exception
    it('prohibits reception staff from self-authorizing admission exceptions on failed checks', async () => {
        const sampleId = 'SMP-NO-SELFAUTH-' + SUFFIX;
        trackedSampleIds.add(sampleId);

        const checklist = {
            items: {
                container: { status: 'FAIL', note: 'Contaminated container' },
                label: { status: 'PASS' },
                quantity: { status: 'PASS' },
                condition: { status: 'PASS' },
                coc: { status: 'PASS' }
            },
            nonConformance: true,
            reason: 'Contaminated container'
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                isWalkIn: true,
                decision: 'ACCEPTED',
                receivedMass: 250.0,
                checklist,
                exceptionReason: 'Receptionist approving exception on personal authority',
                hasException: true
            });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('COMPLIANCE_FAILURE_EXCEPTION_REQUIRED');
    });

    // 7. Authorized manager exception admits sample with ADMITTED_WITH_EXCEPTION in history
    it('permits authorized laboratory manager to grant admission exception on failed check', async () => {
        const sampleId = 'SMP-MGR-AUTH-' + SUFFIX;
        trackedSampleIds.add(sampleId);

        const checklist = {
            items: {
                container: { status: 'FAIL', note: 'Bag torn on corner but soil intact in secondary lining' },
                label: { status: 'PASS' },
                quantity: { status: 'PASS' },
                condition: { status: 'PASS' },
                coc: { status: 'PASS' }
            },
            nonConformance: true,
            reason: 'Secondary lining preserved integrity; authorized by lab manager'
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authManager)
            .send({
                originalId: sampleId,
                isWalkIn: true,
                decision: 'ACCEPTED',
                receivedMass: 300.0,
                checklist,
                exceptionReason: 'Lab Manager approved exception: secondary containment is sound'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const sample = await prisma.sample.findFirst({ where: { originalId: sampleId } });
        expect(sample).not.toBeNull();
        expect(sample.status).toBe('ACCEPTED');

        const history = JSON.parse(sample.history || '[]');
        const excEntry = history.find(h => h.status === 'ADMITTED_WITH_EXCEPTION');
        expect(excEntry).toBeDefined();
        expect(excEntry.note).toContain('secondary containment is sound');

        const meta = JSON.parse(sample.metadata || '{}');
        expect(meta.complianceException).toBeDefined();
        expect(meta.complianceException.isStoredApprovalVerified).toBe(true);
    });

    // 8. Rejecting sample persists checklist in receptionData and transitions to RECEIVED_REJECTED
    it('persists compliance checklist and non-conformance reason when sample is rejected', async () => {
        const sampleId = 'SMP-REJ-PERSIST-' + SUFFIX;
        trackedSampleIds.add(sampleId);

        const checklist = {
            items: {
                container: { status: 'FAIL', note: 'Container smashed and contents spilled' },
                label: { status: 'FAIL', note: 'Label missing entirely' },
                quantity: { status: 'FAIL', note: 'Under 10g remaining' },
                condition: { status: 'FAIL', note: 'Severely soaked with unknown liquid' },
                coc: { status: 'PASS' }
            },
            nonConformance: true,
            reason: 'Catastrophic transit damage and sample contamination'
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                isWalkIn: true,
                decision: 'REJECTED',
                checklist,
                ncReason: 'Catastrophic transit damage and sample contamination',
                notes: 'Courier informed upon delivery'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('RECEIVED_REJECTED');

        const sample = await prisma.sample.findFirst({ where: { originalId: sampleId } });
        expect(sample).not.toBeNull();
        expect(sample.status).toBe('RECEIVED_REJECTED');
        expect(sample.rejectionReason).toBe('Catastrophic transit damage and sample contamination');

        const recData = JSON.parse(sample.receptionData || '{}');
        expect(recData.checklist).toBeDefined();
        expect(recData.checklist.items.container.status).toBe('FAIL');
        expect(recData.checklist.items.label.status).toBe('FAIL');
        expect(recData.ncReason).toBe('Catastrophic transit damage and sample contamination');
    });

    // 9. Draft save preserves partial/failed checklist without exception
    it('preserves incomplete or failed checklist when saving as DRAFT without requiring exception', async () => {
        const sampleId = 'SMP-DRAFT-SAVE-' + SUFFIX;
        trackedSampleIds.add(sampleId);

        const partialChecklist = {
            items: {
                container: { status: 'FAIL', note: 'Pending manager review' },
                label: { status: 'PASS' }
            },
            nonConformance: true,
            reason: 'Requires manager assessment tomorrow morning'
        };

        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', authReception)
            .send({
                originalId: sampleId,
                isWalkIn: true,
                decision: 'DRAFT',
                isDraft: true,
                checklist: partialChecklist,
                notes: 'Draft saved mid-inspection'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('DRAFT');

        const sample = await prisma.sample.findFirst({ where: { originalId: sampleId } });
        expect(sample).not.toBeNull();
        expect(sample.status).toBe('DRAFT');

        const recData = JSON.parse(sample.receptionData || '{}');
        expect(recData.checklist).toBeDefined();
        expect(recData.checklist.items.container.status).toBe('FAIL');
        expect(recData.checklist.items.label.status).toBe('PASS');
    });
});
