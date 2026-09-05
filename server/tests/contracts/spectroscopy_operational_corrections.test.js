const prisma = require('../../prisma');
const spectralController = require('../../controllers/spectralController');
const workbenchController = require('../../controllers/workbenchController');
const { escalateQCStatus, validateSpectra } = require('../../services/spectralValidation');
const { parseSpectralFile } = require('../../services/spectralParser');
const fs = require('fs');
const path = require('path');

describe('Spectroscopy Operational Corrections Contract & Regression', () => {
    let testSampleId;
    let testWorkItemId;
    let testPrepItemId;
    let testDryingItemId;
    let testEquipmentId;
    const testUser = { username: 'tech_marcos', role: 'LAB_TECHNICIAN', labId: 'LAB-DEFAULT' };
    const managerUser = { username: 'mgr_sarah', role: 'LAB_MANAGER', labId: 'LAB-DEFAULT' };

    beforeAll(async () => {
        const timestamp = Date.now();
        testSampleId = `SMP-SPEC-OP-${timestamp}`;
        testWorkItemId = `WI-SPEC-OP-${timestamp}`;
        testPrepItemId = `WI-PREP-OP-${timestamp}`;
        testDryingItemId = `WI-DRY-OP-${timestamp}`;
        testEquipmentId = `EQ-SPECTRO-${timestamp}`;

        // Ensure users exist
        await prisma.user.upsert({
            where: { username: testUser.username },
            update: {},
            create: {
                id: `USR-${testUser.username}`,
                username: testUser.username,
                email: `${testUser.username}@example.com`,
                password: 'hash',
                role: testUser.role,
                labId: testUser.labId
            }
        });

        await prisma.user.upsert({
            where: { username: managerUser.username },
            update: {},
            create: {
                id: `USR-${managerUser.username}`,
                username: managerUser.username,
                email: `${managerUser.username}@example.com`,
                password: 'hash',
                role: managerUser.role,
                labId: managerUser.labId
            }
        });

        // Ensure equipment exists
        await prisma.equipmentAsset.create({
            data: {
                id: testEquipmentId,
                name: 'Alpha II FTIR Spectrometer',
                assetType: 'SPECTROMETER',
                model: 'Alpha II',
                labId: 'LAB-DEFAULT',
                status: 'IN_SERVICE',
                criticality: 'HIGH'
            }
        });

        // Create test sample
        await prisma.sample.create({
            data: {
                id: testSampleId,
                originalId: `ORIG-SMP-${timestamp}`,
                labId: `SMP-OP-${timestamp}`,
                status: 'PROCESSING',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                assignedLab: 'LAB-DEFAULT'
            }
        });

        // Create gate work items (DRYING, PREPARATION) as DONE
        await prisma.workItem.create({
            data: {
                id: testDryingItemId,
                sampleId: testSampleId,
                analysis: 'DRYING',
                category: 'Operational Gates',
                status: 'COMPLETED',
                labId: 'LAB-DEFAULT'
            }
        });

        await prisma.workItem.create({
            data: {
                id: testPrepItemId,
                sampleId: testSampleId,
                analysis: 'PREPARATION',
                category: 'Operational Gates',
                status: 'COMPLETED',
                labId: 'LAB-DEFAULT'
            }
        });

        // Create spectral work item for SPEC_MIR assigned to tech_marcos
        await prisma.workItem.create({
            data: {
                id: testWorkItemId,
                sampleId: testSampleId,
                analysis: 'SPEC_MIR',
                category: 'Spectral Analysis',
                status: 'ASSIGNED',
                assignedTo: testUser.username,
                labId: 'LAB-DEFAULT'
            }
        });
    });

    afterAll(async () => {
        // Clean up test records
        await prisma.spectralData.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.result.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.sample.deleteMany({ where: { id: testSampleId } });
        await prisma.equipmentAsset.deleteMany({ where: { id: testEquipmentId } });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: Monotonic QC Severity Helper & Escalation
    // ─────────────────────────────────────────────────────────────────────────
    describe('Monotonic QC Severity (Amendment 5)', () => {
        test('escalateQCStatus escalates PASS -> WARN -> FAIL monotonically', () => {
            expect(escalateQCStatus('PASS', 'PASS')).toBe('PASS');
            expect(escalateQCStatus('PASS', 'WARN')).toBe('WARN');
            expect(escalateQCStatus('PASS', 'FAIL')).toBe('FAIL');
            expect(escalateQCStatus('WARN', 'PASS')).toBe('WARN');
            expect(escalateQCStatus('WARN', 'WARN')).toBe('WARN');
            expect(escalateQCStatus('WARN', 'FAIL')).toBe('FAIL');
            expect(escalateQCStatus('FAIL', 'PASS')).toBe('FAIL');
            expect(escalateQCStatus('FAIL', 'WARN')).toBe('FAIL');
            expect(escalateQCStatus('FAIL', 'FAIL')).toBe('FAIL');
        });

        test('validateSpectra retains FAIL when saturated or flat signal occurs', () => {
            // Flat signal (zero variance)
            const wavelengths = Array.from({ length: 100 }, (_, i) => 4000 - i * 30);
            const flatValues = Array.from({ length: 100 }, () => 0.0);
            const res = validateSpectra(wavelengths, flatValues, 'MIR');
            expect(res.qcStatus).toBe('FAIL');
            expect(res.flags).toContain('FLAT_SIGNAL');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: Scalar Lockout on Spectral Tasks (Amendment 2)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Scalar Lockout on Spectral Tasks', () => {
        test('batchSave blocks scalar value entry on SPEC_MIR task', async () => {
            const req = {
                user: testUser,
                body: {
                    entries: [
                        {
                            workItemId: testWorkItemId,
                            value: 42.5,
                            draft: true
                        }
                    ]
                }
            };
            let responseStatus = 200;
            let responseJson = null;
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return {
                        json: (data) => { responseJson = data; }
                    };
                },
                json: (data) => { responseJson = data; }
            };

            await workbenchController.batchSave(req, res);
            expect(responseJson.errors).toBeDefined();
            expect(responseJson.errors.some(e => e.code === 'SPECTRAL_SCALAR_FORBIDDEN')).toBe(true);
        });

        test('previewCompletion excludes spectral items from scalar completion', async () => {
            const req = {
                user: testUser,
                body: {
                    entries: [
                        {
                            workItemId: testWorkItemId,
                            value: 99.9
                        }
                    ]
                }
            };
            let responseStatus = 200;
            let responseJson = null;
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return {
                        json: (data) => { responseJson = data; }
                    };
                },
                json: (data) => { responseJson = data; }
            };

            await workbenchController.previewCompletion(req, res);
            expect(responseJson.excluded).toBeDefined();
            const excludedItem = responseJson.excluded.find(e => e.workItemId === testWorkItemId);
            expect(excludedItem).toBeDefined();
            expect(excludedItem.blockers).toContain('SPECTRAL_SCAN_REQUIRED');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: Spectral Parser Strictness (Amendment 1)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Spectral Parser Strictness', () => {
        test('throws INCOMPATIBLE_MODALITY_UNITS when wavelength file is fed into MIR context', () => {
            const wavelengthCsv = 'Wavelength,Absorbance\n400,0.1\n450,0.2\n500,0.3';
            expect(() => {
                parseSpectralFile(Buffer.from(wavelengthCsv), 'test.csv', { targetModality: 'MIR' });
            }).toThrow('INCOMPATIBLE_MODALITY_UNITS');
        });

        test('parses valid MIR CSV with wavenumber units and preserves axis metadata', () => {
            const mirCsv = 'Wavenumber,Absorbance\n4000,0.05\n3950,0.06\n3900,0.07\n3850,0.08';
            const parsed = parseSpectralFile(Buffer.from(mirCsv), 'mir_test.csv', { targetModality: 'MIR' });
            expect(parsed.modality).toBe('MIR');
            expect(parsed.axisUnit).toBe('WAVENUMBER_CM1');
            expect(parsed.wavelengths.length).toBe(4);
            expect(parsed.wavelengths[0]).toBe(4000);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 4: Batch Commit & Zero Result Pollution (Amendment 3 & 6)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Batch Commit & Replicate Completeness with Zero Result Rows', () => {
        test('commitBatch fails if equipmentId is missing', async () => {
            const stagingId = `staging-noeq-${Date.now()}`;
            const stagingDir = path.join(__dirname, '../../uploads/staging', stagingId);
            fs.mkdirSync(stagingDir, { recursive: true });
            fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify({
                manifestId: stagingId,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                items: []
            }));

            const req = {
                user: testUser,
                body: {
                    manifestId: stagingId
                    // equipmentId omitted!
                }
            };
            let responseStatus = null;
            let responseJson = null;
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return { json: (d) => { responseJson = d; } };
                },
                json: (d) => { responseJson = d; }
            };

            await spectralController.commitBatch(req, res);
            expect(responseStatus).toBe(400);
            expect(responseJson.error).toBe('EQUIPMENT_SELECTION_REQUIRED');

            // Cleanup
            fs.rmSync(stagingDir, { recursive: true, force: true });
        });

        test('commitBatch saves spectrum, completes workItem, and leaves Result table untouched', async () => {
            // First stage a manifest manually
            const stagingId = `staging-test-${Date.now()}`;
            const stagingDir = path.join(__dirname, '../../uploads/staging', stagingId);
            fs.mkdirSync(stagingDir, { recursive: true });

            const fakeFileName = `test_${Date.now()}.csv`;
            const fakeFilePath = path.join(stagingDir, fakeFileName);
            const csvData = 'Wavenumber,Absorbance\n4000,0.1\n3500,0.2\n3000,0.3\n2500,0.25\n2000,0.15\n1500,0.1\n1000,0.05\n500,0.02';
            fs.writeFileSync(fakeFilePath, csvData);

            const manifest = {
                manifestId: stagingId,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7200000).toISOString(),
                createdBy: testUser.username,
                equipmentId: testEquipmentId,
                modality: 'MIR',
                items: [
                    {
                        filename: fakeFileName,
                        stagedFilename: fakeFileName,
                        sampleId: testSampleId,
                        targetWorkItemId: testWorkItemId,
                        modality: 'MIR',
                        axisUnit: 'WAVENUMBER_CM1',
                        quantity: 'ABSORBANCE',
                        wavelengths: [4000, 3500, 3000, 2500, 2000, 1500, 1000, 500],
                        values: [0.1, 0.2, 0.3, 0.25, 0.15, 0.1, 0.05, 0.02],
                        sha256: 'fake-hash-' + Date.now(),
                        qcStatus: 'PASS',
                        qcFlags: []
                    }
                ]
            };
            fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest));

            const req = {
                user: testUser,
                body: {
                    manifestId: stagingId,
                    equipmentId: testEquipmentId,
                    decisions: {
                        [fakeFileName]: {
                            decision: 'ADD_REPLICATE',
                            sampleId: testSampleId,
                            targetWorkItemId: testWorkItemId
                        }
                    }
                }
            };
            let responseStatus = null;
            let responseJson = null;
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return { json: (d) => { responseJson = d; } };
                },
                json: (d) => { responseJson = d; }
            };

            await spectralController.commitBatch(req, res);
            expect(responseJson.success).toBe(1);

            // Verify SpectralData record in DB
            const createdScan = await prisma.spectralData.findFirst({
                where: { sampleId: testSampleId, workItemId: testWorkItemId }
            });
            expect(createdScan).toBeDefined();
            expect(createdScan.status).toBe('VALIDATED'); // PASS qcStatus -> VALIDATED
            expect(createdScan.workItemId).toBe(testWorkItemId);
            expect(createdScan.equipmentId).toBe(testEquipmentId);

            // Verify WorkItem is now COMPLETED
            const updatedWorkItem = await prisma.workItem.findUnique({
                where: { id: testWorkItemId }
            });
            expect(updatedWorkItem.status).toBe('COMPLETED');
            expect(updatedWorkItem.result).toContain('Spectrum Acquired');

            // CRITICAL CHECK: ZERO Result rows created!
            const resultsInDb = await prisma.result.findMany({
                where: { sampleId: testSampleId, param: 'SPEC_MIR' }
            });
            expect(resultsInDb.length).toBe(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 5: Task Linking Rules (Amendment 4)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Task Linking Rules', () => {
        test('cannot link scan with FAIL qcStatus', async () => {
            const failScan = await prisma.spectralData.create({
                data: {
                    id: `spec-fail-${Date.now()}`,
                    sampleId: testSampleId,
                    modality: 'MIR',
                    filename: 'fail.csv',
                    wavelengths: '[]',
                    values: '[]',
                    qcStatus: 'FAIL',
                    status: 'PENDING',
                    isCurrent: true
                }
            });

            const req = {
                user: testUser,
                body: {
                    scanId: failScan.id,
                    workItemId: testWorkItemId
                }
            };
            let responseStatus = null;
            let responseJson = null;
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return { json: (d) => { responseJson = d; } };
                }
            };

            await spectralController.linkTask(req, res);
            expect(responseStatus).toBe(400);
            expect(responseJson.error).toBe('CANNOT_LINK_FAILED_SCAN');
        });

        test('cannot link incompatible modality', async () => {
            const nirScan = await prisma.spectralData.create({
                data: {
                    id: `spec-nir-${Date.now()}`,
                    sampleId: testSampleId,
                    modality: 'NIR',
                    filename: 'nir.csv',
                    wavelengths: '[]',
                    values: '[]',
                    qcStatus: 'PASS',
                    status: 'VALIDATED',
                    isCurrent: true
                }
            });

            const req = {
                user: testUser,
                body: {
                    scanId: nirScan.id,
                    workItemId: testWorkItemId // SPEC_MIR task
                }
            };
            let responseStatus = null;
            let responseJson = null;
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return { json: (d) => { responseJson = d; } };
                }
            };

            await spectralController.linkTask(req, res);
            expect(responseStatus).toBe(400);
            expect(responseJson.error).toBe('INCOMPATIBLE_MODALITY');
        });
    });
});
