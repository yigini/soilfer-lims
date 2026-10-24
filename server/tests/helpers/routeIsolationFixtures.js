const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { createHash } = require('node:crypto');
const { createSampleFixture, createWorkItemFixture, createAuthTokenFixture } = require('./workflowFixtures');
const { createExecutionResultFixture } = require('./workAttemptFixtures');
const rules = require('../../services/workflowStateRules');

async function assertOwnedRouteDatabase(db) {
    rules.assertFixtureContext();
    const databases = await db.$queryRawUnsafe('PRAGMA database_list');
    const file = databases.find(row => row.name === 'main')?.file;
    const relative = file && path.relative(path.resolve(__dirname, '../..'), fs.realpathSync(file)).replace(/\\/g, '/');
    if (!/^tests\/\.tmp\/test_[^/]+\.db$/.test(relative || '')) {
        throw Error('Route isolation fixtures require a fresh test-owned database.');
    }
}

// Each suite uses its own guarded, synthetic database. These are real domain
// rows, never mocks of authentication, scope checks, controllers or the ORM.
async function createRouteIsolationFixtures(db) {
    await assertOwnedRouteDatabase(db);
    const ids = {};
    for (const suffix of ['A', 'B']) {
        for (const entity of ['lab', 'project', 'sample', 'draft', 'expected', 'workItem', 'batch', 'result', 'report',
            'kobo', 'ncr', 'amendment', 'container', 'location', 'label', 'policy', 'hold', 'method', 'publishedReport',
            'share', 'inventoryItem', 'inventoryLot', 'reference', 'proposal', 'evaluation', 'controlReview',
            'reagentLocation', 'methodRequirement', 'equipment', 'equipmentEvent', 'eligibility', 'transaction', 'consignment', 'submission', 'override',
            'dryingWork', 'importSample', 'importWork', 'completedSample', 'completedWork', 'completedResult', 'scan', 'deletedScan', 'purgedScan',
            'analysis', 'group', 'category', 'helpNote']) {
            ids[entity + suffix] = `R2-${entity.toUpperCase()}-${suffix}`;
        }
        const labId = ids['lab' + suffix], projectId = ids['project' + suffix];
        const uploads = require('../../utils/uploadFiles');
        if (!process.env.LIMS_OWNED_UPLOAD_ROOT) throw Error('Route media fixtures require an exclusive owned upload root.');
        const intakeRoot = path.join(uploads.uploadsRoot(), 'intake');
        fs.mkdirSync(intakeRoot, { recursive: true });
        ids['upload' + suffix] = `/uploads/intake/r2-fixture-${suffix}.png`;
        fs.writeFileSync(path.join(intakeRoot, path.basename(ids['upload' + suffix])),
            Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64'), { flag: 'wx' });
        await db.lab.create({ data: { id: labId, code: labId, name: `Synthetic laboratory ${suffix}`, country: 'GTM' } });
        await db.project.create({ data: { id: projectId, code: projectId, name: `Synthetic project ${suffix}`, status: 'ACTIVE', labId } });
        await db.projectLab.create({ data: { projectCode: projectId, labId } });
        await db.labPolicy.create({ data: { id: ids['policy' + suffix], labId, updatedBy: 'system:fixture' } });
        await db.methodology.create({ data: { id: ids['method' + suffix], analysisCode: 'PH_H2O', labId,
            name: `Synthetic pH method ${suffix}`, loq: 0.1 } });
        await db.analysisCategory.create({ data: { id: ids['category' + suffix], labId, name: `Synthetic private category ${suffix}` } });
        await db.analysis.create({ data: { code: ids['analysis' + suffix], labId, name: `Synthetic private parameter ${suffix}`,
            categoryId: ids['category' + suffix], isGlobal: false } });
        await db.analysisGroup.create({ data: { id: ids['group' + suffix], labId, name: `Synthetic private group ${suffix}`, analyses: JSON.stringify([ids['analysis' + suffix]]) } });
        for (const [entity, status] of [['sample', 'PROCESSING'], ['draft', 'DRAFT'], ['expected', 'EXPECTED']]) {
            await createSampleFixture(db, { data: { id: ids[entity + suffix], originalId: `R2-ORIGINAL-${entity}-${suffix}`,
                projectId, projectCode: projectId, labId, assignedLab: labId, country: 'GTM', countryName: 'Guatemala',
                latitude: 14.5 + (entity === 'draft' ? 0.01 : entity === 'expected' ? 0.02 : 0), longitude: -90.5,
                status, ...(entity === 'sample' && { requiredAnalyses: '["PH_H2O"]', labSampleCode: `R2-SAMPLE-CODE-${suffix}`,
                    intakePhotos: JSON.stringify([ids['upload' + suffix]]) }) } });
        }
        await db.batch.create({ data: { id: ids['batch' + suffix], labId, analysis: 'PH_H2O', status: 'OPEN', createdBy: 'system:fixture' } });
        await createWorkItemFixture(db, { data: { id: ids['workItem' + suffix], sampleId: ids['sample' + suffix],
            analysis: 'PH_H2O', status: 'IN_PROGRESS', methodologyId: ids['method' + suffix],
            labId, assignedLab: labId, batchId: ids['batch' + suffix] } });
    }
    const tokens = {};
    for (const [name, role, labId, countries] of [
        ['managerA', 'LAB_MANAGER', ids.labA, []], ['managerB', 'LAB_MANAGER', ids.labB, []],
        ['technicianB', 'LAB_TECHNICIAN', ids.labB, []], ['globalAdmin', 'SUPER_ADMIN', null, []],
        ['nationalUser', 'MASTER_USER', ids.labB, ['GTM']],
    ]) tokens[name] = await createAuthTokenFixture(db, role, labId, countries, []);
    const actor = await db.user.findUnique({ where: { id: jwt.decode(tokens.managerA).id } });
    const globalActor = await db.user.findUnique({ where: { id: jwt.decode(tokens.globalAdmin).id } });
    ids.technicianBUsername = jwt.decode(tokens.technicianB).username;
    ids.managerIdA = actor.id;
    ids.managerIdB = jwt.decode(tokens.managerB).id;
    const helpArticle = await db.helpArticle.findFirst({ where: { archivedAt: null, visibility: 'AUTHENTICATED' },
        include: { revisions: { orderBy: { revisionNumber: 'desc' }, take: 1 } } });
    if (!helpArticle?.revisions.length) throw Error('Route matrix requires the canonical published help fixtures.');
    ids.helpArticle = helpArticle.id; ids.helpRevision = String(helpArticle.revisions[0].revisionNumber);
    for (const suffix of ['A', 'B']) await db.helpLabNote.create({ data: { id: ids['helpNote' + suffix], articleId: ids.helpArticle,
        labId: ids['lab' + suffix], authorId: suffix === 'A' ? actor.id : ids.managerIdB,
        noteText: ids['helpNote' + suffix], isActive: true } });
    for (const suffix of ['A', 'B']) {
        ids['discrepancyProject' + suffix] = `R2-DISCREPANCY-PROJECT-${suffix}`;
        await db.project.create({ data: { id: ids['discrepancyProject' + suffix], code: ids['discrepancyProject' + suffix],
            name: 'Synthetic retained membership discrepancy', labId: ids['lab' + suffix], status: 'ACTIVE' } });
    }
    ids.invitationA = 'R2-INVITATION-A'; ids.messageA = 'R2-MESSAGE-A'; ids.messageDraftA = 'R2-MESSAGE-DRAFT-A';
    ids.receivedMessageA = 'R2-RECEIVED-MESSAGE-A'; ids.notificationA = 'R2-NOTIFICATION-A';
    await db.staffInvitation.create({ data: { id: ids.invitationA, labId: ids.labA, role: 'LAB_TECHNICIAN',
        name: 'Synthetic private invitation', email: 'synthetic-private-a@example.test', createdBy: globalActor.username,
        tokenHash: createHash('sha256').update('public-synthetic-invitation-fixture').digest('hex'), expiresAt: new Date('2099-01-01') } });
    ids.recoveryA = 'R2-RECOVERY-A';
    await db.passwordRecoveryGrant.create({ data: { id: ids.recoveryA, userId: actor.id, createdBy: globalActor.username,
        tokenHash: createHash('sha256').update('public-synthetic-recovery-fixture').digest('hex'), expiresAt: new Date('2099-01-01') } });
    for (const id of [ids.messageA, ids.messageDraftA, ids.receivedMessageA]) await db.message.create({ data: {
        id, senderId: actor.id, recipientId: actor.id, subject: 'Synthetic private labA correspondence', body: 'Synthetic private message body',
        status: id === ids.receivedMessageA ? 'SENT' : 'DRAFT', folderSender: 'DRAFT', folderRecipient: 'INBOX' } });
    await db.notification.create({ data: { id: ids.notificationA, userId: actor.id, title: 'Synthetic private labA notice',
        message: 'Synthetic private notice body', type: 'INFO' } });
    for (const suffix of ['A', 'B']) {
        const labId = ids['lab' + suffix], sampleId = ids['sample' + suffix];
        const sample = await db.sample.findUnique({ where: { id: sampleId } });
        const order = await rules.inTransaction(db, tx => require('../../services/orderService').createInitialOrder(tx, sample, ['PH_H2O'], globalActor));
        ids['order' + suffix] = order.revision.id;
        ids['orderLine' + suffix] = (await db.orderLine.findFirst({ where: { revisionId: order.revision.id } })).id;
        await require('../../services/qcRuleService').change(globalActor, { labId, analysisCode: 'PH_H2O',
            methodologyId: ids['method' + suffix], expectedVersion: 0, reason: 'Synthetic lab isolation QC run',
            criteria: { blankPerBatch: 1, duplicateEvery: 0, lrmPerBatch: 0, crmEveryNBatches: 0, ccvEvery: 0 } }, { db });
        await require('../../services/qcNativeRunService').buildNativeRun(db, globalActor,
            { workItemIds: [ids['workItem' + suffix]], labId, methodologyId: ids['method' + suffix],
                analysis: 'PH_H2O', seed: 'route-isolation-native-run' }, { existingBatchId: ids['batch' + suffix] });
        ids['analyte' + suffix] = (await db.batchAnalyte.findFirst({ where: { batchId: ids['batch' + suffix] } })).id;
        ids['position' + suffix] = (await db.batchPosition.findFirst({ where: { batchId: ids['batch' + suffix], kind: 'SAMPLE' } })).id;
        ids['blankPosition' + suffix] = (await db.batchPosition.findFirst({ where: { batchId: ids['batch' + suffix], kind: 'BLANK' } })).id;
        await require('../../services/qcNativeRunService').startNativeRun(db, ids['batch' + suffix], globalActor);
        const result = await createExecutionResultFixture(db, { data: { id: ids['result' + suffix], sampleId,
            param: 'PH_H2O', value: '7.0', numericValue: 7, methodologyId: ids['method' + suffix], batchId: ids['batch' + suffix] } });
        ids['attempt' + suffix] = result.attemptId;
        // Retained synthetic read models for their owner boundary. These do
        // not claim a new submission or hard-range approval through the UI.
        await db.submission.create({ data: { id: ids['submission' + suffix], sampleId, labId, assignedLab: labId,
            type: 'FULL', status: 'PENDING_REVIEW', submittedBy: globalActor.username,
            workItemIds: JSON.stringify([ids['workItem' + suffix]]), workItemCount: 1 } });
        await db.resultOverrideRequest.create({ data: { id: ids['override' + suffix], labId, workItemId: ids['workItem' + suffix], sampleId,
            analysisCode: 'PH_H2O', replicateNo: 1, rawValue: '99', basis: 'AIR_DRY', methodologyId: ids['method' + suffix],
            methodRevision: '1', rulesSha256: 'a'.repeat(64), flags: '["ABOVE_MAX"]', reason: 'Synthetic retained range request', requestedBy: globalActor.id } });
        await db.consignment.create({ data: { id: ids['consignment' + suffix], code: `R2-CONSIGNMENT-CODE-${suffix}`,
            labId, projectCode: ids['project' + suffix], receivedBy: globalActor.username } });
        for (const [kind, status] of [['scan', 'PENDING_REVIEW'], ['deletedScan', 'DELETED'], ['purgedScan', 'DELETED']]) {
            await db.spectralData.create({ data: { id: ids[kind + suffix], sampleId, labId, modality: 'MIR',
                filename: `synthetic-${kind}-${suffix}.csv`, wavelengths: '[4000,3000,2000,1000,500]', values: '[0.2,0.25,0.3,0.22,0.2]',
                quantity: 'ABSORBANCE', axisDirection: 'DESCENDING', status, uploadedBy: globalActor.username } });
        }
        ids['ptRound' + suffix] = (await require('../../services/proficiencyRoundService').record(globalActor, {
            labId, analysisCode: 'PH_H2O', provider: 'Synthetic provider', roundRef: `Synthetic ${suffix}`, assignedValue: 7,
            labResult: 7.01, uncertainty: 0.1, date: '2026-01-01' }, { db })).id;
        await db.report.create({ data: { id: ids['report' + suffix], sampleId, labId, projectCode: ids['project' + suffix],
            generatedBy: 'system:fixture', status: 'DRAFT', content: JSON.stringify({ sampleId }) } });
        // A retained historical publication predates the current open work.
        // It uses the existing historical report shape with no modern number;
        // all normal report revision guards remain installed.
        await db.report.create({ data: { id: ids['publishedReport' + suffix], sampleId, labId, version: 2,
            projectCode: ids['project' + suffix], generatedBy: 'system:fixture', status: 'PUBLISHED',
            generatedAt: new Date('2020-01-01T12:00:00Z'), publishedAt: new Date('2020-01-01T12:00:00Z'),
            content: JSON.stringify({ sample: { id: sampleId }, results: [] }) } });
        await db.reportShareLink.create({ data: { id: ids['share' + suffix], reportId: ids['publishedReport' + suffix],
            tokenHash: createHash('sha256').update(`synthetic-report-share-${suffix}`).digest('hex'), createdBy: 'system:fixture' } });
        await db.koboConfig.create({ data: { id: ids['kobo' + suffix], labId, projectCode: ids['project' + suffix],
            formId: `synthetic-form-${suffix}`, apiToken: 'synthetic-test-only', koboServerUrl: 'https://example.invalid', isActive: false } });
        await db.nonconformityReport.create({ data: { id: ids['ncr' + suffix], labId, source: 'OTHER', refType: 'SAMPLE',
            refId: sampleId, description: `Synthetic NCR ${suffix}`, raisedBy: 'system:fixture' } });
        await db.sampleAmendment.create({ data: { id: ids['amendment' + suffix], sampleId, type: 'CLERICAL', status: 'PENDING',
            reason: 'Synthetic pending correction', requestPayload: '{"contract":"210-v1"}', selectedWorkItemIds: '[]', version: 1, createdBy: 'system:fixture' } });
        await db.inventoryLocation.create({ data: { id: ids['location' + suffix], labId, name: `R2-STORAGE-${suffix}`, purpose: 'SAMPLE' } });
        await db.inventoryLocation.create({ data: { id: ids['reagentLocation' + suffix], labId, name: `R2-REAGENT-STORAGE-${suffix}`, purpose: 'REAGENT' } });
        await db.inventoryItem.create({ data: { id: ids['inventoryItem' + suffix], labId, itemType: 'REAGENT',
            name: `R2-REAGENT-${suffix}`, unitOfMeasure: 'g' } });
        await db.inventoryLot.create({ data: { id: ids['inventoryLot' + suffix], inventoryItemId: ids['inventoryItem' + suffix],
            labId, lotNumber: `R2-LOT-${suffix}`, initialQuantity: 1000, currentQuantity: 1000, unitOfMeasure: 'g', locationId: ids['reagentLocation' + suffix] } });
        await db.inventoryTransaction.create({ data: { id: ids['transaction' + suffix], labId, userId: globalActor.id,
            actionType: 'RECEIVE', inventoryLotId: ids['inventoryLot' + suffix], deltaQuantity: 1000, unit: 'g' } });
        // A retained requirement with NULL labId still points to a privately
        // owned item. The item's lab remains authoritative for this legacy row.
        await db.methodRequirement.create({ data: { id: ids['methodRequirement' + suffix], labId: suffix === 'A' ? null : labId,
            analysisCode: 'PH_H2O', methodId: ids['method' + suffix], inventoryItemId: ids['inventoryItem' + suffix], defaultConsumption: 1, unit: 'g' } });
        await db.equipmentAsset.create({ data: { id: ids['equipment' + suffix], labId, name: `R2-INSTRUMENT-${suffix}`,
            assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'NON_CRITICAL' } });
        await db.equipmentEvent.create({ data: { id: ids['equipmentEvent' + suffix], equipmentId: ids['equipment' + suffix],
            labId, userId: globalActor.username, eventType: 'VERIFICATION_PERFORMED', summary: 'Synthetic pending verification',
            outcome: 'PASS', requiresManagerSignoff: true } });
        await db.equipmentMethodEligibility.create({ data: { id: ids['eligibility' + suffix], labId, analysisCode: 'PH_H2O',
            methodId: ids['method' + suffix], eligibleEquipmentIds: JSON.stringify([ids['equipment' + suffix]]), isRequired: true } });
        await createWorkItemFixture(db, { data: { id: ids['dryingWork' + suffix], sampleId, analysis: 'DRYING',
            status: 'IN_PROGRESS', assignedLab: labId, labId } });
        await db.workItemDraft.create({ data: { workItemId: ids['workItem' + suffix], sampleId, labId,
            userId: suffix === 'A' ? actor.username : jwt.decode(tokens.managerB).username,
            analysis: 'PH_H2O', value: '7.1', methodologyId: ids['method' + suffix], conflictValue: '7.0' } });
        await createSampleFixture(db, { data: { id: ids['importSample' + suffix], originalId: ids['importSample' + suffix],
            assignedLab: labId, labId, country: 'GTM', status: 'PROCESSING', projectId: ids['project' + suffix], projectCode: ids['project' + suffix] } });
        await createWorkItemFixture(db, { data: { id: ids['importWork' + suffix], sampleId: ids['importSample' + suffix],
            analysis: 'PH_H2O', methodologyId: ids['method' + suffix], status: 'IN_PROGRESS', assignedLab: labId, labId } });
        const importRun = await require('../../services/qcNativeRunService').buildNativeRun(db, globalActor, {
            workItemIds: [ids['importWork' + suffix]], labId, methodologyId: ids['method' + suffix], analysis: 'PH_H2O', seed: 'synthetic-import-run' });
        ids['importBatch' + suffix] = importRun.id;
        await require('../../services/qcNativeRunService').startNativeRun(db, importRun.id, globalActor, { instrumentId: ids['equipment' + suffix] });
        const template = await require('../../services/instrumentImportTemplateService').saveTemplate(db, globalActor, {
            labId, instrumentId: ids['equipment' + suffix], name: 'Synthetic import mapping', expectedVersion: 0, supersedesId: null,
            mapping: { version: 1, delimiter: 'COMMA', hasHeader: true, idColumn: 0, idType: 'LAB_SAMPLE_CODE',
                analytes: [{ analysisCode: 'PH_H2O', valueColumn: 1, unit: 'pH units' }] } });
        ids['importTemplate' + suffix] = template.id;
        ids['importPreview' + suffix] = (await require('../../services/instrumentImportService').preview(db, globalActor, {
            batchId: importRun.id, templateId: template.id, sourceName: 'synthetic-source.csv',
            bytes: Buffer.from('Sample,pH\nUNMATCHED-SYNTHETIC,7.1\n') })).previewToken;
        await createSampleFixture(db, { data: { id: ids['completedSample' + suffix], originalId: ids['completedSample' + suffix],
            assignedLab: labId, labId, country: 'GTM', status: 'PROCESSING', requiredAnalyses: '["PH_H2O"]' } });
        await createWorkItemFixture(db, { data: { id: ids['completedWork' + suffix], sampleId: ids['completedSample' + suffix],
            analysis: 'PH_H2O', status: 'COMPLETED', result: '7.0', methodologyId: ids['method' + suffix], assignedLab: labId, labId } });
        const completedSample = await db.sample.findUnique({ where: { id: ids['completedSample' + suffix] } });
        await rules.inTransaction(db, tx => require('../../services/orderService').createInitialOrder(tx, completedSample, ['PH_H2O'], globalActor));
        await createExecutionResultFixture(db, { data: { id: ids['completedResult' + suffix], sampleId: completedSample.id,
            param: 'PH_H2O', value: '7.0', numericValue: 7, methodologyId: ids['method' + suffix] } });
        await db.referenceMaterial.create({ data: { id: ids['reference' + suffix], labId, code: `R2-REFERENCE-${suffix}`,
            name: `Synthetic reference ${suffix}`, kind: 'LRM', matrix: 'SOIL', lotNumber: `R2-REFERENCE-LOT-${suffix}`,
            inventoryLotId: ids['inventoryLot' + suffix], status: 'ACTIVE', createdBy: 'system:fixture' } });
        const analysis = await db.analysis.findUnique({ where: { code: 'PH_H2O' } });
        if (!analysis.unitCode) throw Error('Synthetic pH reference needs its controlled analysis unit.');
        ids['referenceUnit' + suffix] = analysis.unitCode;
        ids['referenceValue' + suffix] = (await require('../../services/referenceMaterialService').addValue(db, globalActor,
            ids['reference' + suffix], { analysisCode: 'PH_H2O', methodologyId: ids['method' + suffix],
                assignedValue: 7, unit: analysis.unitCode, valueType: 'LAB_ASSIGNED' })).id;
        // Synthetic frozen read/approval records exercise their owner boundary,
        // not a live control-chart calculation or approval. Keep the complete
        // guard-valid statistics and frozen native criteria; bypass no guards.
        const offset = 0.1 * Math.sqrt(19 / 20);
        const selected = Array.from({ length: 20 }, (_, index) => ({ selected: true,
            measurementId: `R2-SYNTHETIC-HISTORIC-READING-${suffix}-${index}`,
            value: 7 + (index < 10 ? -offset : offset) }));
        await db.controlLimitProposal.create({ data: { id: ids['proposal' + suffix], labId, analysisCode: 'PH_H2O',
            methodologyId: ids['method' + suffix], referenceMaterialId: ids['reference' + suffix], mean: 7, sd: 0.1, n: 20,
            selectionSnapshot: JSON.stringify(selected), policySnapshot: '{"values":{"qc.controlChartMinPoints":20}}',
            reason: 'Synthetic retained proposal', proposedBy: globalActor.username } });
        const analyte = await db.batchAnalyte.findUnique({ where: { id: ids['analyte' + suffix] } });
        const reviewRule = 'R2-SYNTHETIC-REVIEW';
        await db.qcEvaluation.create({ data: { id: ids['evaluation' + suffix], batchId: ids['batch' + suffix],
            analysisCode: 'PH_H2O', version: 1, verdict: 'WARN', ruleId: analyte.qcRuleId,
            ruleVersion: analyte.qcRuleVersion, policyVersion: analyte.policyVersion,
            details: JSON.stringify({ criteriaSnapshot: JSON.parse(analyte.criteriaSnapshot),
                evaluation: { controlCharts: [{ review: [reviewRule] }] }, syntheticRetainedReview: true }),
            evaluatedBy: globalActor.username, evaluatedAt: new Date() } });
        await db.qcReviewObligation.create({ data: { id: ids['controlReview' + suffix], labId,
            evaluationId: ids['evaluation' + suffix], rule: reviewRule, evidenceSnapshot: '[]' } });
        await db.sampleContainer.create({ data: { id: ids['container' + suffix], sampleId, kind: 'BULK',
            code: `R2-CONTAINER-CODE-${suffix}`, massG: 250, createdBy: 'system:fixture' } });
        const custody = await require('../../services/custodyService').record(db, sampleId, globalActor,
            { type: 'MOVED', containerId: ids['container' + suffix], toLocationId: ids['location' + suffix], reason: 'Synthetic storage fixture' });
        ids['custody' + suffix] = custody.event.id;
        await db.labelPrintEvent.create({ data: { id: ids['label' + suffix], entity: 'SAMPLE', entityId: sampleId,
            sampleId, code: `R2-SAMPLE-CODE-${suffix}`, count: 1, ordinal: 1, format: 'STANDARD', by: 'system:fixture' } });
    }
    // A hold is a separate foreign-owned fixture; it does not block the normal
    // material fixture used by the positive container/custody requests.
    await db.sampleHold.create({ data: { id: ids.holdA, sampleId: ids.expectedA, type: 'PROVENANCE',
        reason: 'Synthetic provenance review', raisedBy: actor.username, raisedAt: new Date(), attributionSource: 'LIVE' } });
    // The review reader reconstructs its retained history from AuditLog rather
    // than a Review model. Seed that actual read model, not a mocked response.
    ids.reviewA = 'R2-REVIEW-A';
    await db.auditLog.create({ data: { id: ids.reviewA, entity: 'WORKITEM', entityId: ids.workItemA, sampleId: ids.sampleA,
        labId: ids.labA, action: 'REVIEW_ACCEPT', performedBy: actor.username, details: 'Synthetic retained review history' } });
    ids.labC = 'R2-LAB-C'; ids.batchC = 'R2-BATCH-C';
    await db.lab.create({ data: { id: ids.labC, code: ids.labC, name: 'Synthetic out-of-country laboratory', country: 'HND' } });
    await db.batch.create({ data: { id: ids.batchC, labId: ids.labC, analysis: 'PH_H2O', status: 'OPEN', createdBy: 'system:fixture' } });
    ids.ncrC = 'R2-NCR-C';
    await db.nonconformityReport.create({ data: { id: ids.ncrC, labId: ids.labC, source: 'OTHER', refType: 'LAB',
        refId: ids.labC, description: 'Synthetic out-of-country NCR', raisedBy: 'system:fixture' } });
    ids.sampleC = 'R2-SAMPLE-C'; ids.submissionC = 'R2-SUBMISSION-C';
    await createSampleFixture(db, { data: { id: ids.sampleC, originalId: ids.sampleC, assignedLab: ids.labC, country: 'HND', status: 'EXPECTED' } });
    ids.scanC = 'R2-SCAN-C';
    await db.spectralData.create({ data: { id: ids.scanC, sampleId: ids.sampleC, labId: ids.labC, modality: 'MIR', filename: 'synthetic-C.csv',
        wavelengths: '[4000,3000,2000,1000,500]', values: '[0.2,0.25,0.3,0.22,0.2]', status: 'PENDING_REVIEW' } });
    ids.ptRoundC = (await require('../../services/proficiencyRoundService').record(globalActor, {
        labId: ids.labC, analysisCode: 'PH_H2O', provider: 'Synthetic provider', roundRef: 'Synthetic C', assignedValue: 7,
        labResult: 7.01, uncertainty: 0.1, date: '2026-01-01' }, { db })).id;
    await db.submission.create({ data: { id: ids.submissionC, sampleId: ids.sampleC, assignedLab: ids.labC, labId: ids.labC,
        type: 'FULL', status: 'PENDING_REVIEW', submittedBy: globalActor.username, workItemIds: '[]', workItemCount: 0 } });
    // Exchange state uses a second SQLite handle. Refuse its default path and
    // prove that it opens exactly this suite's already validated owned file.
    const ownFile = (await db.$queryRawUnsafe('PRAGMA database_list')).find(row => row.name === 'main').file;
    if (!process.env.DATABASE_PATH || fs.realpathSync(process.env.DATABASE_PATH) !== fs.realpathSync(ownFile)) {
        throw Error('Exchange fixture requires the exact current test-owned SQLite file.');
    }
    const exchangeDb = require('../../services/exchangeStateService').getDb();
    const http = require('supertest')(require('../../app'));
    for (const suffix of ['A', 'B']) {
        const labId = ids['lab' + suffix], token = tokens['manager' + suffix];
        ids['exportSample' + suffix] = `R2-EXPORT-SAMPLE-${suffix}`;
        ids['exportWork' + suffix] = `${ids['exportSample' + suffix]}-PH_H2O`;
        await createSampleFixture(db, { data: { id: ids['exportSample' + suffix], originalId: `R2-EXPORT-ORIGINAL-${suffix}`,
            labId: `R2-EXPORT-ACCESSION-${suffix}`, assignedLab: labId, labSampleCode: `R2-EXPORT-ACCESSION-${suffix}`,
            projectId: ids['project' + suffix], projectCode: ids['project' + suffix], country: 'GTM', status: 'APPROVED',
            latitude: 14.5, longitude: -90.5, requiredAnalyses: '["PH_H2O"]' } });
        await createWorkItemFixture(db, { data: { id: ids['exportWork' + suffix], sampleId: ids['exportSample' + suffix],
            analysis: 'PH_H2O', assignedLab: labId, status: 'ACCEPTED' } });
        rules.assertFixtureContext();
        await db.sampleOrderRevision.create({ data: { sampleId: ids['exportSample' + suffix], version: 1, status: 'ACTIVE',
            reason: 'Owned accepted reference order context', requestedBy: 'system:fixture',
            lines: { create: [{ analysis: 'PH_H2O', workItemId: null, status: 'ACTIVE', isRequired: true }] } } });
        await createExecutionResultFixture(db, { attemptStatus: 'ACCEPTED', data: { id: `R2-EXPORT-RESULT-${suffix}`, sampleId: ids['exportSample' + suffix],
            param: 'PH_H2O', value: '6.8', numericValue: 6.8, unit: 'pH_units', isCurrent: true } });
        // Explicit retained publication fixture, using the normal QC policy
        // and selection authorities; the evaluated native runs remain guarded.
        await require('./qcPolicyFixture').setFixtureQcRequirement(db, token, labId);
        await require('./reportedSelectionFixture').selectReviewedFixtureItem(db, ids['exportWork' + suffix], token);
        const source = await db.calcTemplate.findFirst({ where: { labId: null, analysisCode: 'EXCH_CA' } });
        if (!source) throw Error('Canonical calculation reference fixture missing.');
        const calc = await require('../../services/calculationTemplateService').clone(db, globalActor, source.id, {
            labId, expectedVersion: source.version, methodologyId: null, outputDecimals: 2,
            reason: 'Synthetic laboratory isolation fixture', sopCitation: 'Synthetic local SOP, two decimals' });
        ids['calc' + suffix] = calc.id;
    }
    ids.apiKeyA = 'R2-API-KEY-A'; ids.connectionA = 'R2-CONNECTION-A';
    await db.apiKey.create({ data: { id: ids.apiKeyA, name: 'Synthetic private A connection key',
        keyHash: createHash('sha256').update('public-synthetic-exchange-key-fixture').digest('hex'), keyPrefix: 'synthetic-only',
        connectionId: ids.connectionA, labs: JSON.stringify([ids.labA]), countries: '["GTM"]', projects: JSON.stringify([ids.projectA]),
        capabilities: '["SNAPSHOT","RECEIPT"]' } });
    exchangeDb.prepare(`INSERT INTO _exchange_connections (id,name,capabilities,countries,projects,labs,auth_version,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,1,'ACTIVE',datetime('now'),datetime('now'))`).run(ids.connectionA, 'Synthetic private A connection',
        '["SNAPSHOT","RECEIPT"]', '["GTM"]', JSON.stringify([ids.projectA]), JSON.stringify([ids.labA]));
    const snapshot = await http.post('/api/v2/data-exchange/snapshots').set('Authorization', `Bearer ${tokens.globalAdmin}`)
        .send({ profile: 'core-lossless-v2', filter: { labId: ids.labA }, ttlHours: 1 });
    if (snapshot.status !== 201 || !snapshot.body.snapshotId || !snapshot.body.totalSamples) {
        throw Error(`Nonempty owned exchange snapshot refused: ${snapshot.status}/${snapshot.body.code || snapshot.body.error}`);
    }
    ids.snapshotA = snapshot.body.snapshotId;
    const pack = await http.post('/api/offline/packs/prepare').set('Authorization', `Bearer ${tokens.managerA}`)
        .send({ deviceId: 'synthetic-owned-device', labId: ids.labA, sampleIds: [ids.sampleA], methodCodes: ['PH_H2O'] });
    if (pack.status !== 200 || !pack.body.samples?.some(row => row.id === ids.sampleA)) throw Error('Nonempty owned offline pack refused.');
    ids.offlinePackA = pack.body.packId;
    ids.exportAuditA = 'R2-EXPORT-AUDIT-A';
    await db.auditLog.create({ data: { id: ids.exportAuditA, entity: 'EXPORT', entityId: ids.exportAuditA, action: 'LIST',
        performedBy: actor.username, labId: ids.labA, details: JSON.stringify({ count: 1, filters: { lab: ids.labA } }) } });
    const preview = await require('supertest')(require('../../app')).post('/api/spectral/preview')
        .set('Authorization', `Bearer ${tokens.managerA}`).send({ contextSampleId: ids.sampleA, modality: 'MIR', scans: [{
            labId: 'R2-SAMPLE-CODE-A', filename: 'synthetic-spectrum.csv', modality: 'MIR', quantity: 'ABSORBANCE',
            wavelengths: [4000,3000,2000,1000,500], values: [0.2,0.25,0.3,0.22,0.2] }] });
    if (preview.status !== 200 || !preview.body.manifestId) throw Error(`Synthetic spectral preview refused: ${preview.status}/${preview.body.code || preview.body.error}`);
    ids.spectralManifestA = preview.body.manifestId;
    const foreignMarkers = [...Object.entries(ids).filter(([key]) => key.endsWith('A') && !['referenceUnitA', 'importPreviewA'].includes(key)).map(([, value]) => value),
        'R2-SAMPLE-CODE-A', 'R2-CONTAINER-CODE-A', 'R2-STORAGE-A', 'R2-ORIGINAL-sample-A', 'R2-ORIGINAL-draft-A', 'R2-ORIGINAL-expected-A'];
    return { ids, tokens, foreignMarkers, actor };
}

// Capture all rows owned by lab A in the entity families, including related
// immutable evidence and newly inserted rows. A write is checked even when its
// HTTP response is a denial, so a mutation followed by an error cannot pass.
async function snapshotLabA(db, ids) {
    const samples = [ids.sampleA, ids.draftA, ids.expectedA, ids.importSampleA, ids.completedSampleA, ids.exportSampleA].filter(Boolean);
    const batches = [ids.batchA, ids.importBatchA].filter(Boolean);
    const filters = {
        lab: { id: ids.labA }, user: { labId: ids.labA }, project: { OR: [{ id: ids.projectA }, { labId: ids.labA }, { assignedLabIds: { contains: ids.labA } }] },
        projectLab: { OR: [{ projectCode: ids.projectA }, { labId: ids.labA }] },
        sample: { id: { in: samples } }, workItem: { sampleId: { in: samples } }, batch: { labId: ids.labA },
        result: { sampleId: { in: samples } }, workAttempt: { workItem: { is: { sampleId: { in: samples } } } }, report: { sampleId: { in: samples } },
        reportedValueSelection: { workItem: { is: { sampleId: { in: samples } } } },
        calcTemplate: { labId: ids.labA }, calcTemplateActivation: { labId: ids.labA },
        apiKey: { OR: [{ id: ids.apiKeyA }, { labs: { contains: ids.labA } }] },
        auditLog: { OR: [{ labId: ids.labA }, { sampleId: { in: samples } }, { performedBy: (await db.user.findUnique({ where: { id: ids.managerIdA } })).username }] },
        workItemDraft: { labId: ids.labA }, importTemplate: { labId: ids.labA }, instrumentImportReceipt: { labId: ids.labA },
        sampleOrderRevision: { sampleId: { in: samples } }, orderLine: { revision: { is: { sampleId: { in: samples } } } },
        koboConfig: { labId: ids.labA }, nonconformityReport: { labId: ids.labA }, sampleAmendment: { sampleId: { in: samples } },
        consignment: { labId: ids.labA }, submission: { assignedLab: ids.labA }, resultOverrideRequest: { labId: ids.labA },
        spectralData: { labId: ids.labA }, proficiencyRound: { labId: ids.labA },
        staffInvitation: { labId: ids.labA }, passwordRecoveryGrant: { userId: ids.managerIdA },
        message: { id: { in: [ids.messageA, ids.messageDraftA, ids.receivedMessageA].filter(Boolean) } }, notification: { id: ids.notificationA },
        sampleContainer: { sampleId: { in: samples } }, inventoryLocation: { labId: ids.labA },
        custodyEvent: { labId: ids.labA }, labelPrintEvent: { sampleId: { in: samples } }, labPolicy: { labId: ids.labA },
        labPolicyOverride: { labId: ids.labA },
        sampleHold: { sampleId: { in: samples } }, batchAnalyte: { batchId: { in: batches } }, batchPosition: { batchId: { in: batches } },
        batchPositionWorkItem: { workItemId: { in: [ids.workItemA, ids.importWorkA].filter(Boolean) } }, qcMeasurement: { batchId: { in: batches } },
        qcEvaluation: { batchId: { in: batches } }, batchDisposition: { batchId: { in: batches } }, batchEvent: { batchId: { in: batches } },
        reportShareLink: { reportId: { in: [ids.reportA, ids.publishedReportA] } },
        methodology: { OR: [{ id: ids.methodA }, { labId: ids.labA }] }, qcRule: { labId: ids.labA },
        analysis: { labId: ids.labA }, analysisGroup: { labId: ids.labA }, analysisCategory: { labId: ids.labA },
        labMethodDefault: { labId: ids.labA }, helpLabNote: { labId: ids.labA },
        inventoryItem: { OR: [{ labId: ids.labA }, { defaultLocationId: ids.reagentLocationA }] },
        inventoryLot: { labId: ids.labA }, referenceMaterial: { labId: ids.labA },
        referenceValue: { referenceMaterialId: ids.referenceA },
        methodRequirement: { OR: [{ labId: ids.labA }, { inventoryItemId: ids.inventoryItemA }, { methodId: ids.methodA }] },
        inventoryTransaction: { labId: ids.labA }, inventoryReservation: { labId: ids.labA },
        equipmentAsset: { labId: ids.labA }, equipmentEvent: { equipmentId: ids.equipmentA }, equipmentQualification: { labId: ids.labA },
        equipmentMethodEligibility: { OR: [{ labId: ids.labA }, { methodId: ids.methodA }, { eligibleEquipmentIds: { contains: ids.equipmentA } }] },
        controlLimitProposal: { labId: ids.labA }, controlLimitSet: { labId: ids.labA }, qcReviewObligation: { labId: ids.labA },
        qcReviewResolution: { obligationId: ids.controlReviewA }, batchReagentLot: { batchId: { in: batches } },
    };
    const snapshot = {};
    for (const [model, where] of Object.entries(filters)) snapshot[model] = await db[model].findMany({ where, orderBy: model === 'analysis' ? { code: 'asc' } : { id: 'asc' } });
    const exchangeDb = require('../../services/exchangeStateService').getDb();
    snapshot.exchangeConnections = exchangeDb.prepare('SELECT * FROM _exchange_connections WHERE id = ? OR labs LIKE ? ORDER BY id').all(ids.connectionA, '%' + ids.labA + '%');
    snapshot.exchangeSnapshot = exchangeDb.prepare('SELECT * FROM _exchange_snapshots WHERE id = ?').all(ids.snapshotA);
    snapshot.exchangeSnapshotItems = exchangeDb.prepare('SELECT * FROM _exchange_snapshot_items WHERE snapshot_id = ? ORDER BY item_order').all(ids.snapshotA);
    snapshot.exchangeReceipts = exchangeDb.prepare('SELECT * FROM _exchange_receipts WHERE snapshot_id = ? OR connection_id = ? ORDER BY id').all(ids.snapshotA, ids.connectionA);
    const file = path.join(require('../../utils/uploadFiles').uploadsRoot(), 'intake', path.basename(ids.uploadA));
    snapshot.ownedUpload = fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
    return snapshot;
}

module.exports = { assertOwnedRouteDatabase, createRouteIsolationFixtures, snapshotLabA };
