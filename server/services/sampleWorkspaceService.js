const prisma = require('../prisma');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');

const TEXTURE_ALIASES = new Set([
    'TEXTURE',
    'SOIL_PSD_TEXTURE',
    'SOIL_TEXTURE',
    'PSA',
    'pSA',
    'Particle Size Analysis'
]);
const DERIVED_TEXTURE_FRACTIONS = ['SAND', 'SILT', 'CLAY'];

/**
 * Sample Workspace Projection Service
 * Provides the unified read model for the 5-tab Sample Workspace:
 * 1. Work & results
 * 2. Review
 * 3. Sample & request
 * 4. Reports
 * 5. History
 * 
 * Complies with Section 4, 15, 16.1 of sample-page-redesign-plan.md
 */
class SampleWorkspaceService {
    /**
     * Build the complete sample workspace projection
     * @param {string} sampleId - Sample ID or originalId
     * @param {object} user - Authenticated user context
     * @returns {Promise<object>} Unified workspace view
     */
    static async getWorkspaceData(sampleId, user) {
        return this.getWorkspace(sampleId, user);
    }

    static async getSampleWorkspace(sampleId, user) {
        return this.getWorkspace(sampleId, user);
    }

    static async getWorkspace(sampleId, user) {
        // 1. Fetch sample with all relations (canonical id match takes precedence over labId/originalId aliases)
        const sampleInclude = {
            project: true,
            workItems: {
                include: {
                    assignee: { select: { id: true, username: true, name: true, role: true } },
                    manager: { select: { id: true, username: true, name: true } },
                    methodology: true,
                    batch: {
                        include: {
                            qcItems: true
                        }
                    },
                    spectralScans: true,
                    draft: true,
                    workAttempts: true
                }
            },
            results: {
                where: { isCurrent: true }
            },
            orderRevisions: {
                include: {
                    lines: true
                },
                orderBy: { version: 'desc' }
            },
            amendments: {
                orderBy: { createdAt: 'desc' }
            }
        };

        let sample = await prisma.sample.findUnique({
            where: { id: String(sampleId) },
            include: sampleInclude
        });

        if (!sample) {
            sample = await prisma.sample.findFirst({
                where: {
                    OR: [
                        { originalId: String(sampleId) },
                        { labId: String(sampleId) }
                    ]
                },
                include: sampleInclude
            });
        }

        if (!sample) {
            const err = new Error(`Sample ${sampleId} not found`);
            err.statusCode = 404;
            err.code = 'SAMPLE_NOT_FOUND';
            throw err;
        }

        // 2. Enforce scope guard
        if (user && user.role && !scopeGuard.canAccessEntity(user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            const err = new Error('Access denied: Sample not in your authorized laboratory scope');
            err.statusCode = 403;
            err.code = 'FORBIDDEN_SCOPE';
            throw err;
        }

        // R1: External viewers may only view samples in their granted projects
        if (user?.role === 'EXTERNAL_VIEWER') {
            let userProjects = [];
            try {
                userProjects = typeof user.projects === 'string' ? JSON.parse(user.projects) : (user.projects || []);
            } catch {
                userProjects = [];
            }
            if (userProjects.length > 0 && (!sample.projectCode || !userProjects.includes(sample.projectCode))) {
                const err = new Error('Access denied: Sample does not belong to your authorized projects');
                err.statusCode = 403;
                err.code = 'FORBIDDEN_PROJECT';
                throw err;
            }
        }

        // 3. Fetch submissions for this sample
        const submissions = user?.role === 'EXTERNAL_VIEWER' ? [] : await prisma.submission.findMany({
            where: { sampleId: sample.id },
            orderBy: { submittedAt: 'desc' }
        });

        // 4. Fetch reports for this sample
        const reports = await prisma.report.findMany({
            where: { sampleId: sample.id },
            include: {
                shareLinks: {
                    where: { isRevoked: false }
                }
            },
            orderBy: { version: 'desc' }
        });

        // 5. Fetch catalogue analyses for friendly names and category mappings
        const catalogueAnalyses = await prisma.analysis.findMany({
            include: { category: true }
        });
        const analysisMap = {};
        for (const a of catalogueAnalyses) {
            analysisMap[a.code] = {
                code: a.code,
                name: a.name,
                category: a.category ? a.category.name : 'Analytical',
                unit: a.unit,
                isGate: ['DRYING', 'PREPARATION', 'SIEVING'].includes(a.code)
            };
        }

        // 6. Identity projection
        const isExpected = sample.status === 'EXPECTED';
        const receivedDateDisplay = sample.receptionDate 
            ? sample.receptionDate.toISOString() 
            : (isExpected ? 'Not yet received' : null);

        let parsedReceptionData = {};
        try {
            if (sample.receptionData) parsedReceptionData = JSON.parse(sample.receptionData);
        } catch (e) {
            parsedReceptionData = { raw: sample.receptionData };
        }

        let parsedFieldMetadata = {};
        try {
            if (sample.fieldMetadata) parsedFieldMetadata = JSON.parse(sample.fieldMetadata);
        } catch (e) {
            parsedFieldMetadata = {};
        }

        let parsedHistory = [];
        try {
            if (sample.history) parsedHistory = JSON.parse(sample.history);
        } catch (e) {
            parsedHistory = [];
        }

        // 7. Process Work Items & Check Evidence / QC
        const enrichedWorkItems = [];
        let historicalGapCount = 0;
        let activeQcFailCount = 0;

        for (const item of sample.workItems) {
            const analysisMeta = analysisMap[item.analysis] || {
                code: item.analysis,
                name: item.analysis,
                category: item.category || 'Analytical',
                unit: null,
                isGate: ['DRYING', 'PREPARATION'].includes(item.analysis)
            };

            // Check linked results
            const itemResults = sample.results.filter(r => r.param === item.analysis || r.param.startsWith(item.analysis + '_'));
            const linkedScans = item.spectralScans.filter(s => s.isCurrent && !s.isDeleted);
            
            // Batch QC status
            let qcStatus = 'QC_PASS';
            let qcDetails = null;
            if (item.batch) {
                if (item.batch.status === 'QC_FAIL') {
                    qcStatus = 'QC_FAIL';
                    activeQcFailCount++;
                } else if (item.batch.status === 'OPEN' || item.batch.status === 'RUNNING') {
                    qcStatus = 'QC_PENDING';
                }
                qcDetails = {
                    batchId: item.batch.id,
                    batchStatus: item.batch.status,
                    notes: item.batch.notes
                };
            }

            // S003 Historical Evidence Gap check:
            // Accepted analytical item with 0 results, 0 valid spectral scans, and no waiveReason
            const hasEvidence = itemResults.length > 0 || linkedScans.length > 0;
            const isOmitted = Boolean(item.waiveReason || item.status === 'WAIVED' || item.status === 'CANCELLED');
            const isGate = analysisMeta.isGate;
            
            let isHistoricalGap = false;
            if (!isGate && item.status === 'ACCEPTED' && !hasEvidence && !isOmitted) {
                isHistoricalGap = true;
                historicalGapCount++;
            }

            // Blocker evaluation
            const blockers = [];
            if (sample.status === 'ON_HOLD') {
                blockers.push('Sample is on administrative hold');
            }
            if (!isGate && sample.dryingStatus !== 'DONE' && ['PH_H2O', 'EC', 'TEXTURE'].includes(item.analysis)) {
                blockers.push('Prerequisite Drying has not been completed');
            }
            if (!isGate && sample.preparationStatus !== 'DONE') {
                blockers.push('Prerequisite Sample Preparation has not been completed');
            }
            if (qcStatus === 'QC_FAIL') {
                blockers.push('Batch QC evaluation failed');
            }
            if (isHistoricalGap) {
                blockers.push('Historical approval — evidence needs verification');
            }

            // Check if current user has private draft
            const userDraft = (item.draft && user && item.draft.userId === user.username) ? {
                id: item.draft.id,
                updatedAt: item.draft.updatedAt
            } : null;

            const isDerived = DERIVED_TEXTURE_FRACTIONS.includes(item.analysis);

            enrichedWorkItems.push({
                id: item.id,
                sampleId: item.sampleId,
                analysis: item.analysis,
                analysisName: analysisMeta.name,
                category: analysisMeta.category,
                isGate,
                isDerived,
                derivedFrom: isDerived ? 'TEXTURE' : null,
                status: item.status,
                priority: item.priority || sample.priority || 'NORMAL',
                assignedTo: item.assignedTo,
                assigneeName: item.assignee ? (item.assignee.name || item.assignee.username) : null,
                assignedBy: item.assignedBy,
                assignedAt: item.assignedAt,
                completedAt: item.completedAt,
                methodology: item.methodology ? {
                    id: item.methodology.id,
                    name: item.methodology.name,
                    code: item.methodology.code
                } : null,
                equipmentId: item.equipmentId,
                result: item.result,
                results: itemResults,
                spectralScans: linkedScans.map(s => ({
                    id: s.id,
                    scanType: s.scanType,
                    rawSpectrumPath: s.rawSpectrumPath,
                    wavenumberStart: s.wavenumberStart,
                    wavenumberEnd: s.wavenumberEnd,
                    isCurrent: s.isCurrent,
                    isValid: s.isValid,
                    createdAt: s.createdAt
                })),
                qcStatus,
                qcDetails,
                isHistoricalGap,
                blockers,
                reanalysisReason: item.reanalysisReason,
                waiveReason: item.waiveReason,
                reviewedBy: item.reviewedBy,
                reviewedAt: item.reviewedAt,
                reviewDecision: item.reviewDecision,
                draft: userDraft,
                attempts: (item.workAttempts || []).map(att => ({
                    id: att.id,
                    attemptNo: att.attemptNo,
                    status: att.status,
                    author: att.author,
                    authorName: att.authorName,
                    materialAliquot: att.materialAliquot,
                    executedMethodRevision: att.executedMethodRevision,
                    createdAt: att.createdAt
                }))
            });
        }

        // 8. Order Lines and Revisions
        // 8. Order Lines and Revisions
        const allRevisions = sample.orderRevisions || [];
        const activeRevisions = allRevisions.filter(r => r.status === 'ACTIVE');
        const activeRevision = activeRevisions.length > 0 ? activeRevisions[0] : null;

        let orderIntegrityWarning = null;
        if (activeRevisions.length > 1) {
            orderIntegrityWarning = {
                code: 'MULTIPLE_ACTIVE_REVISIONS',
                message: `Multiple active order revisions (${activeRevisions.map(r => 'v' + r.version).join(', ')}) detected. Manager review required.`
            };
        } else if (allRevisions.length > 0 && !activeRevision) {
            orderIntegrityWarning = {
                code: 'NO_ACTIVE_REVISION',
                message: `No active order revision found. Latest revision v${allRevisions[0].version} is ${allRevisions[0].status}.`
            };
        }

        let orderLines = [];
        if (activeRevision && activeRevision.lines && activeRevision.lines.length > 0) {
            orderLines = activeRevision.lines.map(line => {
                const meta = analysisMap[line.analysis] || { name: line.analysis, category: 'Analytical' };
                const linkedItem = enrichedWorkItems.find(w => w.analysis === line.analysis);
                return {
                    id: line.id,
                    analysis: line.analysis,
                    name: meta.name,
                    category: meta.category,
                    isRequired: line.isRequired,
                    status: line.status,
                    omissionReason: line.omissionReason,
                    omissionAuthorizedBy: line.omissionAuthorizedBy,
                    workItemId: linkedItem ? linkedItem.id : null,
                    workItemStatus: linkedItem ? linkedItem.status : null
                };
            });

            // Detect mismatch between active order lines and active analytical work items
            const orderAnalyses = activeRevision.lines.map(l => l.analysis).sort();
            const analyticalTasks = enrichedWorkItems
                .filter(w => !['DRYING', 'PREPARATION', 'ARCHIVING', 'ARCH', 'Archive', 'DISPOSAL', 'DISP', 'Dispose'].includes(w.analysis))
                .map(w => w.analysis)
                .sort();

            // When comparing, account for bidirectional texture equivalence:
            // 1. Map any alias to 'TEXTURE'
            let normOrder = orderAnalyses.map(a => TEXTURE_ALIASES.has(a) ? 'TEXTURE' : a);
            let normTasks = analyticalTasks.map(a => TEXTURE_ALIASES.has(a) ? 'TEXTURE' : a);

            // 2. If order has 'TEXTURE' and tasks have all 3 fractions (SAND, SILT, CLAY), fold tasks fractions to 'TEXTURE'
            const orderHasTexture = normOrder.includes('TEXTURE');
            const tasksHaveAllFractions = DERIVED_TEXTURE_FRACTIONS.every(f => normTasks.includes(f));
            if (orderHasTexture && tasksHaveAllFractions) {
                normTasks = normTasks.filter(a => !DERIVED_TEXTURE_FRACTIONS.includes(a));
                if (!normTasks.includes('TEXTURE')) normTasks.push('TEXTURE');
            }

            // 3. If tasks have 'TEXTURE' and order has all 3 fractions (SAND, SILT, CLAY), fold order fractions to 'TEXTURE'
            const tasksHaveTexture = normTasks.includes('TEXTURE');
            const orderHasAllFractions = DERIVED_TEXTURE_FRACTIONS.every(f => normOrder.includes(f));
            if (tasksHaveTexture && orderHasAllFractions) {
                normOrder = normOrder.filter(a => !DERIVED_TEXTURE_FRACTIONS.includes(a));
                if (!normOrder.includes('TEXTURE')) normOrder.push('TEXTURE');
            }

            normOrder.sort();
            normTasks.sort();

            const hasMismatch = normOrder.length !== normTasks.length ||
                normOrder.some((a, i) => a !== normTasks[i]);

            if (hasMismatch && !orderIntegrityWarning) {
                orderIntegrityWarning = {
                    code: 'ORDER_TASK_MISMATCH',
                    message: `Active Order Revision v${activeRevision.version} specifies ${orderAnalyses.length} analyses (${orderAnalyses.slice(0, 3).join(', ')}...) but ${analyticalTasks.length} laboratory tasks are active (${analyticalTasks.slice(0, 3).join(', ')}...). Lab manager reconciliation required.`,
                    orderAnalyses,
                    analyticalTasks
                };
            }
        } else {
            // Synthesize order lines from sample.requiredAnalyses or workItems
            let requiredList = [];
            try {
                if (sample.requiredAnalyses) requiredList = JSON.parse(sample.requiredAnalyses);
            } catch (e) {
                requiredList = [];
            }
            if (!Array.isArray(requiredList) || requiredList.length === 0) {
                requiredList = sample.workItems.filter(w => !['DRYING', 'PREPARATION'].includes(w.analysis)).map(w => w.analysis);
            }

            orderLines = requiredList.map(code => {
                const meta = analysisMap[code] || { name: code, category: 'Analytical' };
                const linkedItem = enrichedWorkItems.find(w => w.analysis === code);
                return {
                    id: `syn-${code}`,
                    analysis: code,
                    name: meta.name,
                    category: meta.category,
                    isRequired: true,
                    status: linkedItem && linkedItem.status === 'CANCELLED' ? 'CANCELLED' : (linkedItem && linkedItem.status === 'WAIVED' ? 'OMITTED' : 'ACTIVE'),
                    omissionReason: linkedItem ? linkedItem.waiveReason : null,
                    workItemId: linkedItem ? linkedItem.id : null,
                    workItemStatus: linkedItem ? linkedItem.status : null
                };
            });
        }

        // 9. Derive Canonical Counters (Parallel Facts per Section 16.5)
        const activeOrderLines = orderLines.filter(l => l.status === 'ACTIVE');
        const analyticalItems = enrichedWorkItems.filter(w => !w.isGate);
        const derivedItems = enrichedWorkItems.filter(w => w.isDerived);
        const gateItems = enrichedWorkItems.filter(w => w.isGate);
        
        const orderedCount = activeOrderLines.length;
        const recordedCount = analyticalItems.filter(w => ['COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(w.status)).length;
        const submittedCount = analyticalItems.filter(w => w.status === 'SUBMITTED').length;
        const acceptedCount = analyticalItems.filter(w => w.status === 'ACCEPTED' && !w.isHistoricalGap).length;
        const omittedCount = orderLines.filter(l => l.status === 'OMITTED' || l.status === 'CANCELLED').length + analyticalItems.filter(w => w.status === 'WAIVED').length;
        const blockedCount = analyticalItems.filter(w => w.blockers.length > 0).length;
        const unassignedCount = enrichedWorkItems.filter(w => !w.assignedTo && ['NOT_ASSIGNED', 'PENDING', 'UNASSIGNED'].includes(w.status)).length;

        // 10. Operational Gates
        const gates = {
            drying: {
                code: 'DRYING',
                label: 'Air Drying (40°C)',
                status: sample.dryingStatus || 'PENDING',
                isDone: sample.dryingStatus === 'DONE',
                isFailed: sample.dryingStatus === 'FAILED'
            },
            preparation: {
                code: 'PREPARATION',
                label: 'Sieving / Milling',
                status: sample.preparationStatus || 'PENDING',
                isDone: sample.preparationStatus === 'DONE'
            },
            allGatesPassed: sample.dryingStatus === 'DONE' && sample.preparationStatus === 'DONE'
        };

        // 11. Reports projection
        const publishedReports = reports.filter(r => r.status === 'PUBLISHED');
        if (user?.role === 'EXTERNAL_VIEWER' && publishedReports.length === 0) {
            const err = new Error('Access denied: Sample does not have an approved released report');
            err.statusCode = 403;
            err.code = 'REPORT_UNPUBLISHED';
            throw err;
        }
        const currentReleasedReport = publishedReports.length > 0 ? publishedReports[0] : null;

        // 12. Material Custody
        const isDisposed = sample.status === 'DISPOSED';
        const isArchived = sample.status === 'ARCHIVED';
        let parsedMetadata = {};
        try {
            if (sample.metadata) parsedMetadata = JSON.parse(sample.metadata);
        } catch (e) {
            parsedMetadata = {};
        }

        const materialCustody = {
            status: isDisposed ? 'DISPOSED' : (isArchived ? 'ARCHIVED' : (sample.status === 'EXPECTED' ? 'NOT_RECEIVED' : 'ACTIVE')),
            isDisposed,
            isArchived,
            receivedMass: sample.receivedMass,
            massWarningAcknowledged: sample.massWarningAcknowledged,
            moistureOnArrival: sample.moistureOnArrival,
            storageLocation: parsedMetadata.archiveLocation || 'Not recorded',
            carrierName: sample.custodyCarrierName || 'Not recorded',
            trackingNumber: sample.custodyTrackingNumber || 'Not recorded',
            handoverAt: sample.custodyHandoverAt,
            receivingOfficerName: sample.receivingOfficerName || sample.receivedBy || 'Not recorded'
        };

        // 13. Integrity issues summary
        const hasHistoricalGap = historicalGapCount > 0;
        const missingTasks = activeOrderLines.filter(l => !l.workItemId).length > 0;
        const integrityIssues = [];

        if (hasHistoricalGap) {
            integrityIssues.push({
                code: 'HISTORICAL_EVIDENCE_GAP',
                severity: 'HIGH',
                message: 'Historical approval — evidence needs verification (accepted results lack recorded raw/spectral data)',
                count: historicalGapCount
            });
        }
        if (missingTasks) {
            integrityIssues.push({
                code: 'MISSING_WORK_ITEMS',
                severity: 'CRITICAL',
                message: 'Active order lines exist without generated laboratory work items'
            });
        }
        if (activeQcFailCount > 0) {
            integrityIssues.push({
                code: 'QC_BATCH_FAIL',
                severity: 'CRITICAL',
                message: 'One or more work items are blocked by a failed QC batch'
            });
        }

        // 14. Action Capabilities (RBAC + Resource State Evaluation)
        const userRole = user?.role || 'VIEWER';
        const isManagerOrAdmin = ['LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(userRole);
        const isTechnician = ['LAB_TECHNICIAN', 'LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(userRole);
        const isReception = ['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(userRole);

        const { canFinalApprove: evaluateFinalApproval } = require('./workEligibility');
        const linkedBatches = (sample.workItems || []).map(w => w.batch).filter(Boolean);
        const finalApprovalEval = evaluateFinalApproval(
            sample,
            sample.workItems,
            activeRevision?.lines || orderLines || [],
            user,
            { qcBatches: linkedBatches, hasHistoricalGap }
        );

        const capabilities = {
            canReceive: {
                allowed: isReception && sample.status === 'EXPECTED',
                reason: sample.status !== 'EXPECTED' ? 'Sample already received' : (isReception ? null : 'Requires reception authority')
            },
            canAcceptIntake: {
                allowed: isReception && ['EXPECTED', 'RECEIVED'].includes(sample.status),
                reason: isReception ? null : 'Requires reception or manager authority'
            },
            canManageAnalyses: {
                allowed: isManagerOrAdmin && !isDisposed,
                reason: isDisposed ? 'Material is disposed and immutable' : (isManagerOrAdmin ? null : 'Requires lab manager authority')
            },
            canAssign: {
                allowed: isManagerOrAdmin && !isDisposed,
                reason: isDisposed ? 'Material is disposed' : (isManagerOrAdmin ? null : 'Requires lab manager authority')
            },
            canSubmit: {
                allowed: isTechnician && !isDisposed && enrichedWorkItems.some(w => ['RECORDED', 'COMPLETED'].includes(w.status)),
                reason: isDisposed ? 'Material is disposed' : (!isTechnician ? 'Requires technician role' : 'No recorded work eligible for submission')
            },
            canReview: {
                allowed: isManagerOrAdmin && submittedCount > 0,
                reason: submittedCount === 0 ? 'No work items currently submitted for review' : (isManagerOrAdmin ? null : 'Requires reviewer authority')
            },
            canFinalApprove: {
                allowed: isManagerOrAdmin && finalApprovalEval.allowed,
                blockers: finalApprovalEval.blockers,
                reason: finalApprovalEval.reason
            },
            canReleaseReport: {
                allowed: isManagerOrAdmin && !isDisposed && acceptedCount > 0 && submittedCount === 0 && !hasHistoricalGap,
                reason: hasHistoricalGap ? 'Historical evidence verification gap blocks release' : (submittedCount > 0 ? 'Pending submitted reviews must be completed' : (acceptedCount === 0 ? 'No accepted results to release' : null))
            },
            canArchive: {
                allowed: isManagerOrAdmin && sample.status === 'APPROVED' && !isDisposed,
                reason: sample.status !== 'APPROVED' ? 'Sample must be APPROVED before archiving' : null
            },
            canDispose: {
                allowed: isManagerOrAdmin && ['APPROVED', 'ARCHIVED'].includes(sample.status) && !isDisposed,
                reason: isDisposed ? 'Material already disposed' : (['APPROVED', 'ARCHIVED'].includes(sample.status) ? null : 'Sample must be Approved or Archived')
            },
            canAmend: {
                allowed: isManagerOrAdmin && ['APPROVED', 'ARCHIVED', 'DISPOSED'].includes(sample.status),
                reason: isManagerOrAdmin ? null : 'Requires lab manager authority'
            },
            canPrintLabel: {
                allowed: sample.status !== 'RECEIVED_REJECTED' && sample.status !== 'REJECTED',
                reason: null
            }
        };

        // Determine Primary Next Action
        let nextAction = { action: 'VIEW', label: 'View sample workspace', role: 'ALL' };
        if (sample.status === 'EXPECTED') {
            nextAction = { action: 'RECEIVE', label: 'Receive physical sample', role: 'SAMPLE_RECEPTION' };
        } else if (sample.status === 'RECEIVED') {
            nextAction = { action: 'ACCEPT_INTAKE', label: 'Accept intake & generate work', role: 'SAMPLE_RECEPTION' };
        } else if (unassignedCount > 0 && isManagerOrAdmin) {
            nextAction = { action: 'ASSIGN', label: `Assign ${unassignedCount} unassigned task(s) to technician`, role: 'LAB_MANAGER' };
        } else if (!gates.allGatesPassed && analyticalItems.length > 0) {
            nextAction = { action: 'PREPARATION', label: 'Complete Drying and Preparation gates', role: 'LAB_TECHNICIAN' };
        } else if (submittedCount > 0) {
            nextAction = { action: 'REVIEW', label: `Review ${submittedCount} submitted result(s)`, role: 'LAB_MANAGER' };
        } else if (recordedCount > 0 && submittedCount === 0 && acceptedCount < orderedCount) {
            nextAction = { action: 'SUBMIT', label: 'Submit recorded results for review', role: 'LAB_TECHNICIAN' };
        } else if (finalApprovalEval.allowed && sample.status !== 'APPROVED') {
            nextAction = { action: 'APPROVE', label: 'Perform final managerial approval', role: 'LAB_MANAGER' };
        } else if (acceptedCount > 0 && acceptedCount >= orderedCount && !currentReleasedReport) {
            nextAction = { action: 'RELEASE_REPORT', label: 'Authorize & release analytical report', role: 'LAB_MANAGER' };
        } else if (currentReleasedReport) {
            nextAction = { action: 'VIEW_REPORT', label: `View Report v${currentReleasedReport.version}`, role: 'ALL' };
        }

        return {
            identity: {
                id: sample.id,
                labSampleCode: sample.labId || 'Not assigned',
                originalId: sample.originalId,
                fieldId: sample.originalId,
                displayId: sample.labId || sample.originalId,
                matrix: sample.matrix || 'SOIL',
                status: sample.status,
                priority: sample.priority || sample.project?.priority || 'NORMAL',
                project: sample.project ? {
                    id: sample.project.id,
                    code: sample.project.code,
                    name: sample.project.name,
                    client: sample.project.client,
                    priority: sample.project.priority
                } : null,
                projectCode: sample.projectCode,
                assignedLab: sample.assignedLab,
                country: sample.country || sample.countryName,
                dates: {
                    createdAt: sample.createdAt,
                    receptionDate: sample.receptionDate,
                    receivedDateDisplay,
                    collectionDate: parsedFieldMetadata.collectionDate || null,
                    acceptedAt: sample.acceptedAt,
                    approvedAt: sample.approvedAt
                },
                clientName: sample.clientName || sample.project?.client || 'Not recorded',
                receptionCondition: {
                    mass: sample.receivedMass,
                    moisture: sample.moistureOnArrival,
                    checklist: parsedReceptionData,
                    photos: sample.intakePhotos ? JSON.parse(sample.intakePhotos) : []
                }
            },
            materialCustody,
            operationalGates: gates,
            order: {
                revisionNumber: activeRevision ? activeRevision.version : 1,
                revisionStatus: activeRevision ? activeRevision.status : 'ACTIVE',
                warning: orderIntegrityWarning,
                lines: orderLines
            },
            workItems: enrichedWorkItems,
            submissions: submissions.map(sub => ({
                id: sub.id,
                type: sub.type,
                status: sub.status,
                submittedBy: sub.submittedBy,
                submittedAt: sub.submittedAt,
                reviewedBy: sub.reviewedBy,
                reviewedAt: sub.reviewedAt,
                note: sub.note,
                reviewNote: sub.reviewNote,
                itemCount: sub.workItemCount
            })),
            reports: reports.map(r => ({
                id: r.id,
                version: r.version,
                status: r.status,
                generatedBy: r.generatedBy,
                generatedAt: r.generatedAt,
                publishedAt: r.publishedAt,
                shareLinksCount: r.shareLinks.length
            })),
            currentReleasedReport: currentReleasedReport ? {
                id: currentReleasedReport.id,
                version: currentReleasedReport.version,
                publishedAt: currentReleasedReport.publishedAt,
                generatedBy: currentReleasedReport.generatedBy
            } : null,
            counters: {
                ordered: orderedCount,
                recorded: recordedCount,
                submitted: submittedCount,
                accepted: acceptedCount,
                omitted: omittedCount,
                blocked: blockedCount,
                unassigned: unassignedCount,
                derived: derivedItems.length,
                gates: gateItems.length,
                totalTasks: enrichedWorkItems.length
            },
            integrity: {
                hasHistoricalGap,
                historicalGapCount,
                orderIntegrityWarning,
                warning: hasHistoricalGap ? 'Historical approval — evidence needs verification' : (orderIntegrityWarning ? orderIntegrityWarning.message : null),
                issues: integrityIssues
            },
            orderIntegrityWarning,
            capabilities,
            nextAction,
            history: parsedHistory
        };
    }
}

module.exports = SampleWorkspaceService;
