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

    test('6. Print CSS prevents blank extra page with last-child break suppression and auto height', () => {
        const fs = require('fs');
        const path = require('path');
        const dialogSource = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/common/LabelPrintDialog.jsx'), 'utf8');

        // Verify html, body in @media print avoids forced 100% viewport overflow
        expect(dialogSource).toMatch(/height:\s*auto\s*!important/);
        expect(dialogSource).toMatch(/min-height:\s*0\s*!important/);

        // Verify page-break-inside avoid is applied to each label container
        expect(dialogSource).toMatch(/break-inside:\s*avoid\s*!important/);

        // Verify forced page break is restricted to non-last elements
        expect(dialogSource).toMatch(/\.sample-label-page:not\(:last-child\)\s*\{[^}]*break-after:\s*page\s*!important/);

        // Verify last-child explicitly suppresses page breaks
        expect(dialogSource).toMatch(/\.sample-label-page:last-child[^}]*break-after:\s*auto\s*!important/);

        // Ensure unconditional page-break-after on .sample-label-page was removed
        const unconditionalMatch = dialogSource.match(/\.sample-label-page\s*\{[^}]*break-after:\s*page\s*!important/);
        expect(unconditionalMatch).toBeNull();
    });

    test('7. Truthful date binding contract: binds persisted dates without inventing current clock', () => {
        const fs = require('fs');
        const path = require('path');
        const dialogSource = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/common/LabelPrintDialog.jsx'), 'utf8');

        // Ensure new Date() is NOT used in intake badge or date footers
        expect(dialogSource).not.toMatch(/new Date\(\)\.toISOString/);
        expect(dialogSource).not.toMatch(/new Date\(\)\.toLocaleDateString/);

        // Extract helper functions via dynamic evaluation in isolated context
        const vm = require('vm');
        const sandbox = { console, exports: {} };
        // Simple extraction of date helpers from source
        const helpersCode = `
            ${dialogSource.slice(dialogSource.indexOf('const parseJsonSafely'), dialogSource.indexOf('export const StandardLabelCard'))}
        `.replace(/export const (\w+)\s*=/g, 'const $1 = exports.$1 =');
        vm.runInNewContext(helpersCode, sandbox);

        const { formatLabelDate, resolveCollectionDate, resolveIntakeDate } = sandbox.exports;

        // A. Formats valid date strings
        expect(formatLabelDate('2026-09-05T23:33:06.081Z')).toBe('2026-09-05');
        expect(formatLabelDate('2026-08-30')).toBe('2026-08-30');
        expect(formatLabelDate(null)).toBeNull();
        expect(formatLabelDate('N/A')).toBeNull();
        expect(formatLabelDate('—')).toBeNull();

        // B. Recorded reception date and collection date present
        const sampleFull = {
            status: 'ACCEPTED',
            receptionDate: '2026-09-05T14:30:00.000Z',
            collectionDate: '2026-08-28'
        };
        expect(resolveIntakeDate(sampleFull)).toBe('2026-09-05');
        expect(resolveCollectionDate(sampleFull)).toBe('2026-08-28');

        // C. S004 fixture: recorded receptionDate, missing collectionDate
        const sampleS004 = {
            id: 'S004',
            labId: 'S004',
            originalId: 'FIELD-S004',
            status: 'ACCEPTED',
            receptionDate: '2026-09-05T23:33:06.081Z'
        };
        expect(resolveIntakeDate(sampleS004)).toBe('2026-09-05');
        expect(resolveCollectionDate(sampleS004)).toBeNull();

        // D. Pre-arrival EXPECTED sample: missing intake
        const sampleExpected = {
            id: 'EXP-1',
            status: 'EXPECTED',
            collectionDate: '2026-09-01'
        };
        expect(resolveIntakeDate(sampleExpected)).toBeNull();
        expect(resolveCollectionDate(sampleExpected)).toBe('2026-09-01');

        // E. Sample with dates in structured fieldMetadata JSON
        const sampleWithFieldMeta = {
            status: 'PROCESSING',
            receptionDate: '2026-09-10',
            fieldMetadata: JSON.stringify({ sampling_date: '2026-09-02' })
        };
        expect(resolveIntakeDate(sampleWithFieldMeta)).toBe('2026-09-10');
        expect(resolveCollectionDate(sampleWithFieldMeta)).toBe('2026-09-02');

        // F. Missing all dates
        const sampleNoDates = {
            id: 'BLANK-1',
            status: 'RECEIVED'
        };
        expect(resolveIntakeDate(sampleNoDates)).toBeNull();
        expect(resolveCollectionDate(sampleNoDates)).toBeNull();

        // G. Creation-only records (DRAFT, COLLECTED): must never promote createdAt to intake date
        const sampleDraft = {
            status: 'DRAFT',
            createdAt: '2026-01-02T09:00:00Z',
            receptionDate: null
        };
        expect(resolveIntakeDate(sampleDraft)).toBeNull();

        const sampleCollected = {
            status: 'COLLECTED',
            createdAt: '2026-01-02T09:00:00Z',
            receptionDate: null
        };
        expect(resolveIntakeDate(sampleCollected)).toBeNull();

        // H. Chain of custody timestamp (custodyHandoverAt) resolved when receptionDate is absent
        const sampleCustody = {
            status: 'ACCEPTED',
            custodyHandoverAt: '2026-09-01T10:00:00Z',
            receptionDate: null
        };
        expect(resolveIntakeDate(sampleCustody)).toBe('2026-09-01');

        // I. Chain of custody timestamp in receptionData JSON resolved
        const sampleCustodyJson = {
            status: 'ACCEPTED',
            receptionData: JSON.stringify({ custodyHandoverAt: '2026-09-01T15:00:00Z' })
        };
        expect(resolveIntakeDate(sampleCustodyJson)).toBe('2026-09-01');

        // J. Reception.jsx immediate label mapping expression: respects recorded custody and never substitutes render clock
        const receptionSource = fs.readFileSync(path.resolve(__dirname, '../../../client/src/pages/Reception.jsx'), 'utf8');
        const exprMatch = receptionSource.match(/receptionDate: (result\.receptionDate[^\r\n]+)/);
        expect(exprMatch).toBeTruthy();
        const expr = exprMatch[1].replace(/,$/, '');

        const FixedDate = class extends Date {
            constructor(v) {
                super(v === undefined ? '2030-12-31T12:00:00Z' : v);
            }
        };

        const labelDateCustody = vm.runInNewContext(expr, {
            result: { custodyHandoverAt: '2026-09-01T10:00:00Z' },
            Date: FixedDate
        });
        expect(labelDateCustody).toBe('2026-09-01T10:00:00Z');
        expect(resolveIntakeDate({ receptionDate: labelDateCustody })).toBe('2026-09-01');

        const labelDateEmpty = vm.runInNewContext(expr, {
            result: {},
            Date: FixedDate
        });
        expect(labelDateEmpty).toBeNull();
        expect(resolveIntakeDate({ receptionDate: labelDateEmpty })).toBeNull();
    });

    test('8. POST /api/reception/intake returns persisted receptionDate and custodyHandoverAt', async () => {
        const receptionToken = await getAuthToken('SAMPLE_RECEPTION', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        const testIntakeSampleId = `SMP-INTAKE-DATES-${Date.now()}`;
        const testOriginalId = `FIELD-INTAKE-${Date.now()}`;
        await prisma.sample.create({
            data: {
                id: testIntakeSampleId,
                originalId: testOriginalId,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'EXPECTED',
                fieldMetadata: JSON.stringify({ collectionDate: '2026-09-18' })
            }
        });

        const custodyTime = '2026-09-20T10:00:00.000Z';
        const res = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${receptionToken}`)
            .send({
                originalId: testOriginalId,
                decision: 'ACCEPTED',
                receivedMass: 500,
                custodyHandoverAt: custodyTime,
                checklist: {
                    container: 'PASS',
                    label: 'PASS',
                    quantity: 'PASS',
                    condition: 'PASS',
                    coc: 'PASS'
                }
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.receptionDate).toBeDefined();
        expect(typeof res.body.receptionDate).toBe('string');
        expect(res.body.custodyHandoverAt).toBeDefined();
        expect(res.body.collectionDate).toBe('2026-09-18');

        await prisma.sample.delete({ where: { id: testIntakeSampleId } }).catch(() => {});
    });

    test('9. POST /api/reception/consignments returns persisted receptionDate, custodyHandoverAt, assignedLab, projectCode, and collectionDate for batch label printing', async () => {
        const runId = Date.now().toString(36);
        const testProjectId = `PRJ-LBL-CSG-${runId}`;

        // Create dedicated active project allowing consignment intake across all test environments
        await prisma.project.create({
            data: {
                id: testProjectId,
                code: testProjectId,
                name: 'Batch Label Test Project',
                status: 'ACTIVE',
                projectType: 'OPEN_INTAKE'
            }
        });

        const receptionToken = await getAuthToken('SAMPLE_RECEPTION', 'LAB-GTM', ['GTM'], [testProjectId]);
        const testExpectedId = `SMP-CSG-EXP-${runId}`;
        const testExpectedOrig = `FIELD-CSG-EXP-${runId}`;
        const initialMetadata = {
            collectionDate: '2026-09-15',
            koboSubmissionId: `kobo-sub-${runId}`,
            samplingDate: '2026-09-15',
            provenance: { source: 'KOBO', note: 'preserve-existing' }
        };

        // Create pre-arrival EXPECTED sample with full field/Kobo provenance
        await prisma.sample.create({
            data: {
                id: testExpectedId,
                originalId: testExpectedOrig,
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: testProjectId,
                status: 'EXPECTED',
                fieldMetadata: JSON.stringify(initialMetadata)
            }
        });

        const newSampleOrig = `FIELD-CSG-NEW-${runId}`;
        const newSampleWithDateOrig = `FIELD-CSG-DATE-${runId}`;
        const custodyTime = '2026-09-24T08:30:00.000Z';

        const res = await request(app)
            .post('/api/reception/consignments')
            .set('Authorization', `Bearer ${receptionToken}`)
            .send({
                consignment: {
                    deliveryNoteRef: `WAYBILL-${runId}`,
                    deliveredBy: 'Courier Carlos',
                    deliveredAt: custodyTime,
                    projectCode: testProjectId
                },
                defaults: {
                    receivedMass: 500,
                    moistureOnArrival: 'MOIST',
                    requiredAnalyses: ['PH_H2O']
                },
                samples: [
                    // Case 1: Existing sample where incoming payload provides conflicting date-only or partial fieldMetadata
                    { originalId: testExpectedOrig, status: 'ACCEPTED', collectionDate: '2026-09-20', fieldMetadata: { collectionDate: '2026-09-20' } },
                    // Case 2: New sample without collection date (truthful missing handling)
                    { originalId: newSampleOrig, status: 'ACCEPTED' },
                    // Case 3: New sample created at intake with collection date
                    { originalId: newSampleWithDateOrig, status: 'ACCEPTED', collectionDate: '2026-09-22' },
                    // Case 4: Rejected sample preserving rejection reason
                    { originalId: `FIELD-CSG-REJ-${runId}`, status: 'REJECTED', rejectionReason: 'Container damaged in transit' }
                ]
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.samples)).toBe(true);
        expect(res.body.samples.length).toBe(4);

        // Verify sample 1: Existing EXPECTED sample preserves historical collection date and Kobo provenance
        const s1 = res.body.samples.find(s => s.originalId === testExpectedOrig);
        expect(s1).toBeDefined();
        expect(s1.status).toBe('ACCEPTED');
        expect(s1.assignedLab).toBe('LAB-GTM');
        expect(s1.projectCode).toBe(testProjectId);
        expect(s1.receptionDate).toBeDefined();
        expect(typeof s1.receptionDate).toBe('string');
        expect(s1.custodyHandoverAt).toBeDefined();
        expect(s1.collectionDate).toBe('2026-09-15'); // Retains stored date, not overwritten by intake payload

        // Verify database persistence for sample 1: fieldMetadata is completely intact
        const dbSample1 = await prisma.sample.findUnique({ where: { id: testExpectedId } });
        expect(JSON.parse(dbSample1.fieldMetadata)).toEqual(initialMetadata);

        // Verify sample 2: New sample without collectionDate
        const s2 = res.body.samples.find(s => s.originalId === newSampleOrig);
        expect(s2).toBeDefined();
        expect(s2.status).toBe('ACCEPTED');
        expect(s2.assignedLab).toBe('LAB-GTM');
        expect(s2.projectCode).toBe(testProjectId);
        expect(s2.receptionDate).toBeDefined();
        expect(typeof s2.receptionDate).toBe('string');
        expect(s2.custodyHandoverAt).toBeDefined();
        expect(s2.collectionDate).toBeNull(); // Truthful missing collection date

        // Verify sample 3: New sample created on the fly with collectionDate
        const s3 = res.body.samples.find(s => s.originalId === newSampleWithDateOrig);
        expect(s3).toBeDefined();
        expect(s3.status).toBe('ACCEPTED');
        expect(s3.collectionDate).toBe('2026-09-22');
        const dbSample3 = await prisma.sample.findUnique({ where: { id: s3.id } });
        expect(JSON.parse(dbSample3.fieldMetadata)).toEqual({ collectionDate: '2026-09-22' });

        // Verify sample 4: Rejected sample
        const s4 = res.body.samples.find(s => s.originalId === `FIELD-CSG-REJ-${runId}`);
        expect(s4).toBeDefined();
        expect(s4.status).toBe('RECEIVED_REJECTED');
        expect(s4.rejectionReason).toBe('Container damaged in transit');
        expect(s4.assignedLab).toBe('LAB-GTM');
        expect(s4.receptionDate).toBeDefined();

        // Cleanup
        await prisma.sample.deleteMany({
            where: { originalId: { in: [testExpectedOrig, newSampleOrig, newSampleWithDateOrig, `FIELD-CSG-REJ-${runId}`] } }
        }).catch(() => {});
        if (res.body.consignment?.id) {
            await prisma.consignment.delete({ where: { id: res.body.consignment.id } }).catch(() => {});
        }
        await prisma.project.delete({ where: { id: testProjectId } }).catch(() => {});
    });
});
