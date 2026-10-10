const { gateRecords } = require('../helpers/preparationRecords');
const { ensureTestLab } = require('../setup');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { generateToken } = require('../setup');
const { usersDb, workItemsDb, samplesDb, submissionsDb } = require('../../db');
const { setFixtureQcRequirement } = require('../helpers/qcPolicyFixture');

async function completeAnalyticalWork(workItemId, token, value) {
    const res = await request(app).post('/api/workbench/batch-save')
        .set('Authorization', `Bearer ${token}`).send({ draft: false, entries: [{ workItemId, value }] });
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(1);
    const workItem = await prisma.workItem.findUnique({ where: { id: workItemId } });
    const result = await prisma.result.findFirst({ where: {
        sampleId: workItem.sampleId, param: workItem.analysis, isCurrent: true
    } });
    expect(result.value).toBe(value);
    return res;
}

describe('8.2 Integration: Golden Path Scenarios', () => {
    let mgrToken, techToken;
    let mgrUsername, techUsername;
    let mgrSilverToken, techSilverToken;
    let mgrSilverUsername, techSilverUsername;
    let mgrRedToken, techRedToken;
    let mgrRedUsername, techRedUsername;
    let mgrBlueToken, techBlueToken;
    let mgrBlueUsername, techBlueUsername;
    let specEquipId;

    beforeAll(async () => {
        await ensureTestLab('LAB-GOLD', 'GLD');
        await ensureTestLab('LAB-SILVER', 'SLV');
        await ensureTestLab('LAB-RED', 'RED');
        await ensureTestLab('LAB-BLUE', 'BLU');
        const suffix = Date.now();
        mgrUsername = `mgr_gold_${suffix}`;
        techUsername = `tech_gold_${suffix}`;

        specEquipId = `EQ-GOLD-MIR-${suffix}`;
        await prisma.equipmentAsset.create({
            data: {
                id: specEquipId,
                name: 'Gold MIR Spectrometer',
                assetType: 'SPECTROMETER',
                serialNumber: `SN-GOLD-MIR-${suffix}`,
                model: 'ALPHA-II-MIR',
                manufacturer: 'Bruker',
                labId: 'LAB-GOLD',
                status: 'IN_SERVICE',
                criticality: 'HIGH'
            }
        });

        const mgr = usersDb.create({ username: mgrUsername, role: 'LAB_MANAGER', labId: 'LAB-GOLD', countries: ['GLD'] });
        const tech = usersDb.create({ username: techUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-GOLD' });

        mgrToken = generateToken(mgr);
        await setFixtureQcRequirement(prisma, mgrToken, 'LAB-GOLD');
        techToken = generateToken(tech);

        // SILVER LAB Setup for Scenario B
        mgrSilverUsername = `mgr_silver_${suffix}`;
        techSilverUsername = `tech_silver_${suffix}`;
        const mgrSilver = usersDb.create({ username: mgrSilverUsername, role: 'LAB_MANAGER', labId: 'LAB-SILVER', countries: ['SLV'] });
        const techSilver = usersDb.create({ username: techSilverUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-SILVER' });

        mgrSilverToken = generateToken(mgrSilver);
        await setFixtureQcRequirement(prisma, mgrSilverToken, 'LAB-SILVER');
        techSilverToken = generateToken(techSilver);

        // RED LAB Setup for Scenario C
        mgrRedUsername = `mgr_red_${suffix}`;
        techRedUsername = `tech_red_${suffix}`;
        const mgrRed = usersDb.create({ username: mgrRedUsername, role: 'LAB_MANAGER', labId: 'LAB-RED', countries: ['RED'] });
        const techRed = usersDb.create({ username: techRedUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-RED' });

        mgrRedToken = generateToken(mgrRed);
        await setFixtureQcRequirement(prisma, mgrRedToken, 'LAB-RED');
        techRedToken = generateToken(techRed);

        // BLUE LAB Setup for Scenario D
        mgrBlueUsername = `mgr_blue_${suffix}`;
        techBlueUsername = `tech_blue_${suffix}`;
        const mgrBlue = usersDb.create({ username: mgrBlueUsername, role: 'LAB_MANAGER', labId: 'LAB-BLUE', countries: ['BLU'] });
        const techBlue = usersDb.create({ username: techBlueUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-BLUE' });

        mgrBlueToken = generateToken(mgrBlue);
        await setFixtureQcRequirement(prisma, mgrBlueToken, 'LAB-BLUE');
        techBlueToken = generateToken(techBlue);
    });

    const goldenChecklist = {
        items: {
            container: { status: 'PASS' },
            label: { status: 'PASS' },
            quantity: { status: 'PASS' },
            condition: { status: 'PASS' },
            coc: { status: 'PASS' }
        }
    };

    /**
     * SCENARIO A: Project Sample Full Lifecycle
     */
    /**
     * SCENARIO A: Project Sample Lifecycle
     * Partial Submission -> Manager Reject (Reanalysis) -> Full Submission -> Approval -> Archive
     */
    test('Scenario A: Project Sample (Partial + Reanalysis + Approval + Archive)', async () => {
        // 1. Intake
        const receiveRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                originalId: `PROJ-A-${Date.now()}`,
                receivedBy: mgrUsername,
                labId: 'LAB-GOLD',
                requiredAnalyses: ['PH_H2O', 'EC', 'SOC'],
                projectCode: 'GOLD-PROJ',
                isWalkIn: false,
                checklist: goldenChecklist
            });
        expect(receiveRes.status).toBe(200);
        const sampleId = receiveRes.body.id;

        // 2. Gates
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'DRYING', status: 'DONE', checklist: [true, true, true], records: gateRecords('DRYING') });
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'PREPARATION', status: 'DONE', checklist: [true, true, true] });

        // 3. Assign
        const itemsRes = await request(app).get('/api/work').set('Authorization', `Bearer ${mgrToken}`).query({ sampleId });
        const phItem = itemsRes.body.data.find(i => i.analysis === 'PH_H2O');
        const condItem = itemsRes.body.data.find(i => i.analysis === 'EC');
        const socItem = itemsRes.body.data.find(i => i.analysis === 'SOC');

        const assignRes = await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ workItemIds: [phItem.id, condItem.id, socItem.id], assignee: techUsername });
        expect(assignRes.status).toBe(200);

        // 4. Tech Completes partial
        await completeAnalyticalWork(phItem.id, techToken, '7.2');

        // 5. Partial Submission
        const partialSubRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ sampleId, type: 'PARTIAL', workItemIds: [phItem.id] });
        expect(partialSubRes.status).toBe(201);
        const sub1Id = partialSubRes.body.submission.id;

        // 6. Manager Rejects (Reanalysis Loop)
        await request(app)
            .post(`/api/submissions/${sub1Id}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ decisions: [{ workItemId: phItem.id, decision: 'REJECT_REANALYSIS', reasonCode:'REVIEW_OUTLIER', reason: 'Outlier detected' }] });

        const phItemReload = workItemsDb.findById(phItem.id);
        expect(phItemReload.status).toBe('REPEAT_REQUIRED'); // Sent back to technician

        // 7. Tech Fixes and Completes All
        await completeAnalyticalWork(phItem.id, techToken, '7.1');
        await completeAnalyticalWork(condItem.id, techToken, '1.5');

        // 8. Full Submission
        await completeAnalyticalWork(socItem.id, techToken, '15.0');

        const fullSubRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ sampleId, type: 'FULL', workItemIds: [phItem.id, condItem.id, socItem.id] });
        expect(fullSubRes.status).toBe(201);

        // 9. Approve & Archive
        const repeatResult=await prisma.result.findFirst({where:{sampleId,param:'PH_H2O',isCurrent:true}});
        const reviewRes=await request(app)
            .post(`/api/submissions/${fullSubRes.body.submission.id}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ decisions: [{ workItemId: phItem.id, decision: 'ACCEPT',
                reportedValueSelection:{mode:'ATTEMPT',attemptIds:[repeatResult.attemptId]} },
                { workItemId: condItem.id, decision: 'ACCEPT' }, { workItemId: socItem.id, decision: 'ACCEPT' }] });
        expect(reviewRes.status).toBe(200);expect(reviewRes.body.errors).toEqual([]);

        await request(app).post(`/api/samples/${sampleId}/approve`).set('Authorization', `Bearer ${mgrToken}`);
        const archiveRes = await request(app).post(`/api/samples/${sampleId}/archive`).set('Authorization', `Bearer ${mgrToken}`).send({ archiveLocation: 'A1' });
        expect(archiveRes.status).toBe(200);
        const archItem = archiveRes.body.workItem;
        expect(archItem).toBeDefined();
        await request(app).post(`/api/work/${archItem.id}/review`).set('Authorization', `Bearer ${mgrToken}`).send({ status: 'ACCEPTED' });
        expect(samplesDb.findById(sampleId).status).toBe('ARCHIVED');
    });

    /**
     * SCENARIO B: Walk-in Sample + Disposal
     */
    test('Scenario B: Walk-in Sample + Approval + Dispose', async () => {
        // 1. Intake
        const intakeRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${mgrSilverToken}`)
            .send({
                originalId: `WALK-B-${Date.now()}`,
                receivedBy: mgrSilverUsername,
                labId: 'LAB-SILVER',
                requiredAnalyses: ['PH_H2O'],
                isWalkIn: true,
                checklist: goldenChecklist
            });
        const sampleId = intakeRes.body.id;

        // 2. Gates -> Assign -> Complete -> Submit -> Approve
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrSilverToken}`).send({ phase: 'DRYING', status: 'DONE', checklist: [true, true, true], records: gateRecords('DRYING') });
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrSilverToken}`).send({ phase: 'PREPARATION', status: 'DONE', checklist: [true, true, true] });

        const items = await request(app).get('/api/work').set('Authorization', `Bearer ${mgrSilverToken}`).query({ sampleId });
        const phItem = items.body.data.find(i => i.analysis === 'PH_H2O');
        const phId = phItem.id;

        await request(app).post('/api/work/assign').set('Authorization', `Bearer ${mgrSilverToken}`).send({ workItemIds: [phId], assignee: techSilverUsername });
        await completeAnalyticalWork(phId, techSilverToken, '7.0');

        const subRes = await request(app).post('/api/submissions').set('Authorization', `Bearer ${techSilverToken}`).send({ sampleId, type: 'FULL', workItemIds: [phId] });
        if (subRes.status !== 201) console.log('DEBUG Scenario B Submission Failure:', subRes.body);
        expect(subRes.status).toBe(201);
        await request(app).post(`/api/submissions/${subRes.body.submission.id}/review`).set('Authorization', `Bearer ${mgrSilverToken}`).send({ decisions: [{ workItemId: phId, decision: 'ACCEPT' }] });

        const approveRes = await request(app).post(`/api/samples/${sampleId}/approve`).set('Authorization', `Bearer ${mgrSilverToken}`);
        if (approveRes.status !== 200) console.log('DEBUG Scenario B Approval Failure:', approveRes.body);
        expect(approveRes.status).toBe(200);

        // 3. Dispose
        const disposeRes = await request(app)
            .post(`/api/samples/${sampleId}/dispose`)
            .set('Authorization', `Bearer ${mgrSilverToken}`)
            .send({ disposalMethod: 'Standard protocol' });
        expect(disposeRes.status).toBe(200);
        const dispItem = disposeRes.body.workItem;
        expect(dispItem).toBeDefined();
        await request(app).post(`/api/work/${dispItem.id}/review`).set('Authorization', `Bearer ${mgrSilverToken}`).send({ status: 'ACCEPTED' });
        expect(samplesDb.findById(sampleId).status).toBe('DISPOSED');
    });

    /**
     * SCENARIO C: Drying Failure blocks flow
     */
    test('Scenario C: Drying FAILED blocks analysis with required reason', async () => {
        const intakeRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${mgrRedToken}`)
            .send({
                originalId: `FAIL-C-${Date.now()}`,
                receivedBy: mgrRedUsername,
                labId: 'LAB-RED',
                requiredAnalyses: ['PH_H2O'],
                isWalkIn: false,
                checklist: goldenChecklist
            });
        const sampleId = intakeRes.body.id;

        // Assign while intake is accepted; the subsequent hold must block
        // execution of that assigned task, rather than allow a new assignment.
        const items = await request(app).get('/api/work').set('Authorization', `Bearer ${mgrRedToken}`).query({ sampleId });
        const phId = items.body.data.find(i => i.analysis === 'PH_H2O').id;
        const assigned = await request(app).post('/api/work/assign').set('Authorization', `Bearer ${mgrRedToken}`).send({ workItemIds: [phId], assignee: techRedUsername });
        expect(assigned.status).toBe(200);

        // 1. Fail Drying WITHOUT reason (should fail if validation exists, or just verify it blocks)
        const failRes = await request(app)
            .put(`/api/samples/${sampleId}/phase`)
            .set('Authorization', `Bearer ${mgrRedToken}`)
            .send({ phase: 'DRYING', status: 'FAILED', reason: 'High Moisture Alarm' });
        expect(failRes.status).toBe(200);

        // 2. Verify Prep blocked
        const prepRes = await request(app)
            .put(`/api/samples/${sampleId}/phase`)
            .set('Authorization', `Bearer ${mgrRedToken}`)
            .send({ phase: 'PREPARATION', status: 'DONE', checklist: [true, true, true] });
        expect(prepRes.status).toBe(409);
        expect(prepRes.body.code).toBe('DRYING_PREREQUISITE_FAILED');

        // 3. Verify Analysis completion blocked
        const completeRes = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techRedToken}`)
            .send({ draft: false, entries: [{ workItemId: phId, value: '7.0' }] });
        expect(completeRes.status).toBe(422);
        expect(completeRes.body.errors[0].code).toBe('EXECUTION_BLOCKED');
        expect(await prisma.result.count({ where: { sampleId, param: 'PH_H2O' } })).toBe(0);
    });

    /**
     * SCENARIO D: Sample without spectral Flow
     */
    test('Scenario D: Sample without spectral does not require spectral and can be approved', async () => {
        const intakeRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${mgrBlueToken}`)
            .send({
                originalId: `SPEC-D-${Date.now()}`,
                receivedBy: mgrBlueUsername,
                labId: 'LAB-BLUE',
                requiredAnalyses: ['PH_H2O'], // No Spectral
                isWalkIn: false,
                checklist: goldenChecklist
            });
        const sampleId = intakeRes.body.id;

        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrBlueToken}`).send({ phase: 'DRYING', status: 'DONE', checklist: [true, true, true], records: gateRecords('DRYING') });
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrBlueToken}`).send({ phase: 'PREPARATION', status: 'DONE', checklist: [true, true, true] });

        const items = await request(app).get('/api/work').set('Authorization', `Bearer ${mgrBlueToken}`).query({ sampleId });
        const phItem = items.body.data.find(i => i.analysis === 'PH_H2O');
        const phId = phItem.id;

        await request(app).post('/api/work/assign').set('Authorization', `Bearer ${mgrBlueToken}`).send({ workItemIds: [phId], assignee: techBlueUsername });
        await completeAnalyticalWork(phId, techBlueToken, '7.0');

        const subRes = await request(app).post('/api/submissions').set('Authorization', `Bearer ${techBlueToken}`).send({ sampleId, type: 'FULL', workItemIds: [phId] });
        if (subRes.status !== 201) console.log('DEBUG Scenario D Submission Failure:', subRes.body);
        expect(subRes.status).toBe(201);
        await request(app).post(`/api/submissions/${subRes.body.submission.id}/review`).set('Authorization', `Bearer ${mgrBlueToken}`).send({ decisions: [{ workItemId: phId, decision: 'ACCEPT' }] });

        const approveRes = await request(app).post(`/api/samples/${sampleId}/approve`).set('Authorization', `Bearer ${mgrBlueToken}`);
        expect(approveRes.status).toBe(200);
        expect(samplesDb.findById(sampleId).status).toBe('APPROVED');
    });

    afterAll(async () => {
        try {
            if (specEquipId) {
                await prisma.equipmentAsset.deleteMany({ where: { id: specEquipId } });
            }
        } catch (e) {}
    });

    /**
     * SCENARIO E: Genuine Spectroscopy Integration Lifecycle (Mandatory Correction 5)
     * Intake SPEC_MIR -> Reject Scalar -> Stage Scan Fixture -> Link Scan -> Submit -> Review -> Zero Pollution
     */
    test('Scenario E: Genuine Spectroscopy Integration Lifecycle (Correction 5)', async () => {
        // 1. Intake sample requesting SPEC_MIR
        const receiveRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                originalId: `PROJ-SPEC-${Date.now()}`,
                receivedBy: mgrUsername,
                labId: 'LAB-GOLD',
                requiredAnalyses: ['SPEC_MIR'],
                projectCode: 'GOLD-SPEC-PROJ',
                isWalkIn: false,
                checklist: goldenChecklist
            });
        if (receiveRes.status !== 200) {
            console.log('DEBUG Scenario E Intake Failure:', receiveRes.body);
        }
        expect(receiveRes.status).toBe(200);
        const sampleId = receiveRes.body.id;

        // 2. Complete prerequisite gates
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'DRYING', status: 'DONE', checklist: [true, true, true], records: gateRecords('DRYING') });
        await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'PREPARATION', status: 'DONE', checklist: [true, true, true] });

        // 3. Assign to technician
        const itemsRes = await request(app).get('/api/work').set('Authorization', `Bearer ${mgrToken}`).query({ sampleId });
        const specItem = itemsRes.body.data.find(i => i.analysis === 'SPEC_MIR');
        expect(specItem).toBeDefined();
        await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ workItemIds: [specItem.id], assignee: techUsername });

        // 4. Verification: Scalar values are strictly rejected on spectral tasks
        const scalarRes = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                draft: false,
                entries: [{ workItemId: specItem.id, value: '42.5' }]
            });
        expect(scalarRes.body.errors).toBeDefined();
        expect(scalarRes.body.errors.some(e => e.code === 'SPECTRAL_SCALAR_FORBIDDEN')).toBe(true);

        // 5. Genuine Spectral Workflow: Stage and commit a verified MIR scan fixture
        const stagingId = `staging-gold-spec-${Date.now()}`;
        const stagingDir = path.join(__dirname, '../../uploads/staging', stagingId);
        fs.mkdirSync(stagingDir, { recursive: true });

        const scanFileName = `gold_mir_${Date.now()}.csv`;
        const csvContent = 'Wavenumber,Absorbance\n4000,0.12\n3500,0.18\n3000,0.25\n2500,0.22\n2000,0.14\n1500,0.09\n1000,0.06\n500,0.03';
        fs.writeFileSync(path.join(stagingDir, scanFileName), csvContent);

        const manifest = {
            manifestId: stagingId,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7200000).toISOString(),
            createdBy: techUsername,
            equipmentId: specEquipId,
            modality: 'MIR',
            items: [
                {
                    filename: scanFileName,
                    stagedFilename: scanFileName,
                    sampleId,
                    targetWorkItemId: specItem.id,
                    modality: 'MIR',
                    axisUnit: 'WAVENUMBER_CM1',
                    quantity: 'ABSORBANCE',
                    wavelengths: [4000, 3500, 3000, 2500, 2000, 1500, 1000, 500],
                    values: [0.12, 0.18, 0.25, 0.22, 0.14, 0.09, 0.06, 0.03],
                    sha256: 'gold-spec-hash-' + Date.now(),
                    qcStatus: 'PASS',
                    qcFlags: []
                }
            ]
        };
        fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest));

        // Commit batch linking scan to spectral work item
        const commitRes = await request(app)
            .post('/api/spectral/batch/commit')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                manifestId: stagingId,
                equipmentId: specEquipId,
                decisions: {
                    [scanFileName]: {
                        decision: 'ADD_REPLICATE',
                        sampleId,
                        targetWorkItemId: specItem.id
                    }
                }
            });
        expect(commitRes.status).toBe(200);
        expect(commitRes.body.success).toBe(1);

        // 6. Verify zero Result pollution: No scalar row created in Result table
        const pollutedResults = await prisma.result.findMany({
            where: { sampleId, param: 'SPEC_MIR' }
        });
        expect(pollutedResults.length).toBe(0);

        // Verify SpectralData record exists and is linked
        const spectralData = await prisma.spectralData.findFirst({
            where: { sampleId, workItemId: specItem.id }
        });
        expect(spectralData).not.toBeNull();
        expect(spectralData.modality).toBe('MIR');
        expect(spectralData.status).toBe('VALIDATED');

        // 7. Full Submission by Technician
        const fullSubRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ sampleId, type: 'FULL', workItemIds: [specItem.id] });
        expect(fullSubRes.status).toBe(201);
        const subId = fullSubRes.body.submission.id;

        // 8. Manager Review & Approval
        const reviewRes = await request(app)
            .post(`/api/submissions/${subId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ decisions: [{ workItemId: specItem.id, decision: 'ACCEPT' }] });
        expect(reviewRes.status).toBe(200);

        const approveRes = await request(app)
            .post(`/api/samples/${sampleId}/approve`)
            .set('Authorization', `Bearer ${mgrToken}`);
        expect(approveRes.status).toBe(200);

        // 9. Verify Report Assembly reflects clean spectral data without fake scalar result
        const { assembleReport } = require('../../services/reportAssembly');
        const report = await assembleReport(sampleId, { username: mgrUsername, role: 'LAB_MANAGER', labId: 'LAB-GOLD' });
        expect(report).toBeDefined();
        // Check report results contain no fake SPEC_MIR scalar
        const reportItems = Object.values(report.results || {}).flatMap(cat => cat.items || []);
        expect(reportItems.some(r => r.param === 'SPEC_MIR')).toBe(false);

        // Cleanup
        fs.rmSync(stagingDir, { recursive: true, force: true });
    });

});
