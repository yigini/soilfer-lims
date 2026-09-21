/**
 * Dashboard Query and Aggregation Service
 * 
 * Provides honest metrics, set-based database aggregations, 40-sample method grouping,
 * lean preview projections, and queue-specific row pagination for all 10 canonical roles.
 * Complies with Section 2 of implementation-plan.md, contracts.md, and Review R1-R6.
 */
'use strict';

const prisma = require('../prisma');
const {
    scopedWhere,
    resolveActorScope,
    buildSampleScopeWhere,
    buildWorkItemScopeWhere
} = require('./dashboardScope');
const { canFinalApprove, GATE_ANALYSES } = require('./workEligibility');

const ALLOWED_ROLE_QUEUES = {
    SAMPLE_RECEPTION: ['reception.attention', 'reception.drafts', 'reception.expected', 'reception.receivedToday'],
    LAB_TECHNICIAN: ['bench.returned', 'bench.continue', 'bench.ready', 'bench.toSubmit', 'bench.waiting', 'bench.submittedToday'],
    LAB_MANAGER: ['manager.exceptions', 'manager.review', 'manager.finalApproval', 'manager.assign', 'manager.intake', 'audit.exceptions', 'audit.qc', 'audit.history'],
    MASTER_USER: ['master.exceptions', 'master.active', 'master.released', 'audit.exceptions', 'audit.qc', 'audit.history'],
    PROJECT_MANAGER: ['project.attention', 'project.active', 'project.expected', 'project.released'],
    AUDIT_USER: ['audit.exceptions', 'audit.qc', 'audit.history'],
    SURVEYOR: ['surveyor.incomplete', 'surveyor.expected', 'surveyor.received'],
    EXTERNAL_VIEWER: ['external.released'],
    VIEWER: ['viewer.active', 'viewer.expected', 'viewer.released'],
    SUPER_ADMIN: ['admin.configuration', 'admin.labs', 'admin.activity', 'manager.exceptions', 'manager.review', 'manager.finalApproval', 'manager.assign', 'manager.intake', 'audit.exceptions', 'audit.qc', 'audit.history']
};

/**
 * Catalogue lookup cache for friendly analysis names
 */
let catalogueCache = null;
let catalogueCacheTime = 0;

async function getAnalysisCatalogueMap() {
    const now = Date.now();
    if (catalogueCache && now - catalogueCacheTime < 60000) {
        return catalogueCache;
    }
    try {
        const analyses = await prisma.analysis.findMany({
            include: { category: true }
        });
        const map = {};
        for (const a of analyses) {
            map[a.code] = {
                code: a.code,
                name: a.name,
                category: a.category?.name || 'Analytical',
                unit: a.unit || ''
            };
        }
        catalogueCache = map;
        catalogueCacheTime = now;
        return map;
    } catch {
        return catalogueCache || {};
    }
}

/**
 * Check if drying operational gate applies to the current lab scope
 */
async function checkDryingApplicable(labId) {
    if (!labId) return true;
    try {
        const dryingGate = await prisma.operationalGate.findFirst({
            where: {
                code: 'DRYING',
                isActive: true,
                OR: [{ labId }, { labId: null }]
            }
        });
        const totalGates = await prisma.operationalGate.count({
            where: { OR: [{ labId }, { labId: null }] }
        });
        if (totalGates > 0 && !dryingGate) {
            return false;
        }
        return true;
    } catch {
        return true;
    }
}

/**
 * Main Home Dashboard Aggregator
 */
async function getDashboardHome(user, options = {}) {
    const actorScope = await resolveActorScope(user, options);
    const role = actorScope.role;

    if (!ALLOWED_ROLE_QUEUES[role]) {
        const err = new Error(`Access denied: Unrecognized or legacy role '${role}' cannot access dashboard home`);
        err.statusCode = 403;
        err.code = 'UNRECOGNIZED_ROLE';
        throw err;
    }

    const catMap = await getAnalysisCatalogueMap();
    const isDryingApplicable = await checkDryingApplicable(actorScope.activeLabId);

    const asOf = new Date().toISOString();
    const sampleWhere = buildSampleScopeWhere(actorScope);
    const workWhere = buildWorkItemScopeWhere(actorScope);

    let metrics = [];
    let priorityQueues = [];
    let preview = { queueKey: '', unit: '', rows: [], total: 0, page: 1, pageSize: 10, hasMore: false };
    let recommendedQueue = '';
    let capabilities = {};

    // ── 1. SAMPLE_RECEPTION ──
    if (role === 'SAMPLE_RECEPTION') {
        priorityQueues = ['reception.attention', 'reception.drafts', 'reception.expected', 'reception.receivedToday'];
        capabilities = { openIntake: true, receiveSample: true, assignLabId: true };

        const [attentionCount, draftsCount, expectedCount, receivedTodayCount] = await Promise.all([
            prisma.sample.count({
                where: scopedWhere(sampleWhere, {
                    OR: [
                        { status: 'RECEIVED_REJECTED' },
                        { status: 'RECEIVED', receptionDate: { lt: actorScope.dayStart } }
                    ]
                })
            }),
            prisma.sample.count({
                where: scopedWhere(sampleWhere, { status: 'DRAFT' })
            }),
            prisma.sample.count({
                where: scopedWhere(sampleWhere, { status: 'EXPECTED' })
            }),
            prisma.sample.count({
                where: scopedWhere(sampleWhere, {
                    receptionDate: { gte: actorScope.dayStart, lt: actorScope.dayEnd },
                    status: { notIn: ['EXPECTED', 'DRAFT'] }
                })
            })
        ]);

        metrics = [
            { key: 'reception.attention', label: 'Needs attention', value: attentionCount, unit: 'samples', availability: 'available', queueKey: 'reception.attention', tone: attentionCount > 0 ? 'problem' : '' },
            { key: 'reception.drafts', label: 'My drafts', value: draftsCount, unit: 'drafts', availability: 'available', queueKey: 'reception.drafts' },
            { key: 'reception.expected', label: 'Expected samples', value: expectedCount, unit: 'samples', availability: 'available', queueKey: 'reception.expected', hint: 'Field records awaiting receipt; not a processing backlog' },
            { key: 'reception.receivedToday', label: 'Received today', value: receivedTodayCount, unit: 'samples', availability: 'available', queueKey: 'reception.receivedToday', hint: 'Physical receipts in lab local day' }
        ];

        recommendedQueue = priorityQueues.find(q => {
            const m = metrics.find(x => x.queueKey === q);
            return m && m.value > 0;
        }) || priorityQueues[0];

        const queueData = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap, isDryingApplicable });
        preview = queueData;
    }

    // ── 2. LAB_TECHNICIAN ──
    else if (role === 'LAB_TECHNICIAN') {
        priorityQueues = ['bench.returned', 'bench.continue', 'bench.ready', 'bench.toSubmit', 'bench.waiting'];
        capabilities = { openWorkbench: true, enterResults: true, submitResults: true };

        // 1. Returned determinations
        const returnedCount = await prisma.workItem.count({
            where: scopedWhere(workWhere, { status: 'REANALYSIS_REQUIRED' })
        });

        // 2. Open runs / in-progress work
        const continueCount = await prisma.workItem.count({
            where: scopedWhere(workWhere, {
                status: 'IN_PROGRESS',
                sample: {
                    receptionDate: { not: null },
                    status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING'] }
                }
            })
        });

        // 3. Ready analytical work & checklists
        // Physical receipt verified, gates satisfied, status in ASSIGNED or PENDING
        const readyAnalyticalCount = await prisma.workItem.count({
            where: scopedWhere(workWhere, {
                status: { in: ['ASSIGNED', 'PENDING'] },
                analysis: { notIn: GATE_ANALYSES },
                sample: {
                    receptionDate: { not: null },
                    status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING'] },
                    preparationStatus: 'DONE',
                    ...(isDryingApplicable ? { dryingStatus: 'DONE' } : {})
                }
            })
        });

        const readyOperationalCount = await prisma.workItem.count({
            where: scopedWhere(workWhere, {
                status: { in: ['ASSIGNED', 'PENDING'] },
                analysis: { in: GATE_ANALYSES },
                sample: {
                    receptionDate: { not: null },
                    status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'PREPARATION'] }
                }
            })
        });

        const readyTotal = readyAnalyticalCount + readyOperationalCount;

        // 4. Completed / recorded work to submit
        const toSubmitCount = await prisma.workItem.count({
            where: scopedWhere(workWhere, { status: { in: ['RECORDED', 'COMPLETED'] } })
        });

        // 5. Work waiting for prerequisites (drying/prep)
        const waitingCount = await prisma.workItem.count({
            where: scopedWhere(workWhere, {
                status: { in: ['ASSIGNED', 'PENDING'] },
                analysis: { notIn: GATE_ANALYSES },
                sample: {
                    receptionDate: { not: null },
                    status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'PREPARATION'] },
                    OR: [
                        { preparationStatus: { not: 'DONE' } },
                        ...(isDryingApplicable ? [{ dryingStatus: { not: 'DONE' } }] : [])
                    ]
                }
            })
        });

        metrics = [
            { key: 'bench.returned', label: 'Returned', value: returnedCount, unit: 'determinations', availability: 'available', queueKey: 'bench.returned', tone: returnedCount > 0 ? 'problem' : '' },
            { key: 'bench.continue', label: 'Continue', value: continueCount > 0 ? 1 : 0, unit: 'runs', availability: 'available', queueKey: 'bench.continue' },
            { key: 'bench.ready', label: 'Ready work', value: readyTotal, unit: 'tasks', availability: 'available', queueKey: 'bench.ready', hint: `${readyAnalyticalCount} determinations, ${readyOperationalCount} checklists` },
            { key: 'bench.toSubmit', label: 'To submit', value: toSubmitCount, unit: 'determinations', availability: 'available', queueKey: 'bench.toSubmit' },
            { key: 'bench.waiting', label: 'Waiting', value: waitingCount, unit: 'tasks', availability: 'available', queueKey: 'bench.waiting', hint: 'Prerequisites (drying/preparation) pending' }
        ];

        recommendedQueue = priorityQueues.find(q => {
            const m = metrics.find(x => x.queueKey === q);
            return m && m.value > 0;
        }) || 'bench.ready';

        preview = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap, isDryingApplicable });
    }

    // ── 3. LAB_MANAGER / SUPER_ADMIN ──
    else if (role === 'LAB_MANAGER' || (role === 'SUPER_ADMIN' && actorScope.activeLabId)) {
        priorityQueues = ['manager.exceptions', 'manager.review', 'manager.finalApproval', 'manager.assign', 'manager.intake'];
        capabilities = { openManagerQueue: true, approveResults: true, assignWork: true, manageAnalyses: true };

        // 1. Exceptions (QC batches failed/pending in lab without disposition)
        const exceptionBatchCount = await prisma.batch.count({
            where: {
                status: { in: ['QC_FAIL', 'FAILED'] },
                disposition: null,
                ...(actorScope.activeLabId ? {
                    OR: [
                        { labId: actorScope.activeLabId },
                        { workItems: { some: { labId: actorScope.activeLabId } } }
                    ]
                } : {})
            }
        });

        // 2. Submissions awaiting review (grouped by sample)
        const reviewSamples = await prisma.submission.findMany({
            where: {
                status: 'PENDING_REVIEW',
                ...(actorScope.activeLabId ? {
                    OR: [
                        { assignedLab: actorScope.activeLabId },
                        { labId: actorScope.activeLabId }
                    ]
                } : {})
            },
            select: { sampleId: true },
            distinct: ['sampleId']
        });
        const reviewCount = reviewSamples.length;

        // 3. Final approval eligible samples
        // Strictly evaluates: physically received, accepted/processing, non-zero analytical items, all accepted
        const candidates = await prisma.sample.findMany({
            where: scopedWhere(sampleWhere, {
                status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING'] },
                receptionDate: { not: null }
            }),
            include: {
                workItems: true,
                orderRevisions: {
                    include: { lines: true },
                    orderBy: { version: 'desc' },
                    take: 1
                }
            },
            take: 200
        });

        let approvalEligibleCount = 0;
        for (const s of candidates) {
            const orderLines = s.orderRevisions?.[0]?.lines || [];
            const evalResult = canFinalApprove(s, s.workItems, orderLines, user);
            if (evalResult.allowed) approvalEligibleCount++;
        }

        // 4. Unassigned tasks
        const unassignedTasksCount = await prisma.workItem.count({
            where: scopedWhere(workWhere, {
                assignedTo: null,
                status: { in: ['NOT_ASSIGNED', 'PENDING'] }
            })
        });

        // 5. Intake acceptance
        const pendingIntakeCount = await prisma.sample.count({
            where: scopedWhere(sampleWhere, {
                status: 'RECEIVED'
            })
        });

        metrics = [
            { key: 'manager.exceptions', label: 'Needs a decision', value: exceptionBatchCount, unit: 'exceptions', availability: 'available', queueKey: 'manager.exceptions', tone: exceptionBatchCount > 0 ? 'problem' : '' },
            { key: 'manager.review', label: 'Submitted work', value: reviewCount, unit: 'samples', availability: 'available', queueKey: 'manager.review' },
            { key: 'manager.finalApproval', label: 'Final approval', value: approvalEligibleCount, unit: 'samples', availability: 'available', queueKey: 'manager.finalApproval' },
            { key: 'manager.assign', label: 'Assign work', value: unassignedTasksCount, unit: 'tasks', availability: 'available', queueKey: 'manager.assign' },
            { key: 'manager.intake', label: 'Intake acceptance', value: pendingIntakeCount, unit: 'samples', availability: 'available', queueKey: 'manager.intake' }
        ];

        recommendedQueue = priorityQueues.find(q => {
            const m = metrics.find(x => x.queueKey === q);
            return m && m.value > 0;
        }) || 'manager.review';

        preview = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap, isDryingApplicable, candidates });
    }

    // ── 4. MASTER_USER ──
    else if (role === 'MASTER_USER') {
        priorityQueues = ['master.exceptions', 'master.active', 'master.released'];
        capabilities = { viewLaboratories: true, viewReports: true, chooseLaboratory: true };

        const [exceptionsCount, activeSamplesCount, releasedReportsCount] = await Promise.all([
            prisma.batch.count({ where: { status: { in: ['QC_FAIL', 'FAILED'] }, disposition: null } }),
            prisma.sample.count({
                where: scopedWhere(sampleWhere, {
                    status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'PREPARATION'] },
                    receptionDate: { not: null }
                })
            }),
            prisma.report.count({
                where: { status: 'PUBLISHED' }
            })
        ]);

        metrics = [
            { key: 'master.exceptions', label: 'Needs attention', value: exceptionsCount, unit: 'laboratories', availability: 'available', queueKey: 'master.exceptions', tone: exceptionsCount > 0 ? 'problem' : '' },
            { key: 'master.active', label: 'Active work', value: activeSamplesCount, unit: 'samples', availability: 'available', queueKey: 'master.active' },
            { key: 'master.released', label: 'Released reports', value: releasedReportsCount, unit: 'reports', availability: 'available', queueKey: 'master.released' }
        ];

        recommendedQueue = priorityQueues.find(q => {
            const m = metrics.find(x => x.queueKey === q);
            return m && m.value > 0;
        }) || 'master.active';

        preview = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap });
    }

    // ── 5. PROJECT_MANAGER ──
    else if (role === 'PROJECT_MANAGER') {
        priorityQueues = ['project.attention', 'project.active', 'project.expected', 'project.released'];
        capabilities = { viewProject: true, viewSamples: true, viewReports: true };

        const [attentionCount, activeCount, expectedCount, releasedCount] = await Promise.all([
            prisma.sample.count({
                where: scopedWhere(sampleWhere, {
                    OR: [
                        { status: 'RECEIVED_REJECTED' },
                        { latitude: null, longitude: null, status: { not: 'DRAFT' } }
                    ]
                })
            }),
            prisma.sample.count({
                where: scopedWhere(sampleWhere, {
                    status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'PREPARATION'] },
                    receptionDate: { not: null }
                })
            }),
            prisma.sample.count({
                where: scopedWhere(sampleWhere, { status: 'EXPECTED' })
            }),
            prisma.report.count({
                where: {
                    status: 'PUBLISHED',
                    ...(actorScope.projects.length > 0 ? { projectCode: { in: actorScope.projects } } : {})
                }
            })
        ]);

        metrics = [
            { key: 'project.attention', label: 'Needs follow-up', value: attentionCount, unit: 'samples', availability: 'available', queueKey: 'project.attention', tone: attentionCount > 0 ? 'problem' : '' },
            { key: 'project.active', label: 'At the laboratory', value: activeCount, unit: 'samples', availability: 'available', queueKey: 'project.active' },
            { key: 'project.expected', label: 'Not received', value: expectedCount, unit: 'samples', availability: 'available', queueKey: 'project.expected' },
            { key: 'project.released', label: 'Published reports', value: releasedCount, unit: 'reports', availability: 'available', queueKey: 'project.released' }
        ];

        recommendedQueue = priorityQueues.find(q => {
            const m = metrics.find(x => x.queueKey === q);
            return m && m.value > 0;
        }) || 'project.active';

        preview = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap });
    }

    // ── 6. AUDIT_USER ──
    else if (role === 'AUDIT_USER') {
        priorityQueues = ['audit.exceptions', 'audit.qc', 'audit.history'];
        capabilities = { viewAudit: true, viewQuality: true, viewReports: true, readOnly: true };

        const [exceptionsCount, qcFailedCount, amendmentsCount] = await Promise.all([
            prisma.sample.count({
                where: scopedWhere(sampleWhere, { status: 'APPROVED', results: { none: {} } })
            }),
            prisma.batch.count({
                where: { status: { in: ['QC_FAIL', 'FAILED', 'PENDING'] }, disposition: null }
            }),
            prisma.sampleAmendment.count()
        ]);

        metrics = [
            { key: 'audit.exceptions', label: 'Evidence exceptions', value: exceptionsCount, unit: 'samples', availability: 'available', queueKey: 'audit.exceptions', tone: exceptionsCount > 0 ? 'problem' : '' },
            { key: 'audit.qc', label: 'QC requiring attention', value: qcFailedCount, unit: 'batches', availability: 'available', queueKey: 'audit.qc', tone: qcFailedCount > 0 ? 'problem' : '' },
            { key: 'audit.history', label: 'Recent amendments', value: amendmentsCount, unit: 'amendments', availability: 'available', queueKey: 'audit.history' }
        ];

        recommendedQueue = priorityQueues.find(q => {
            const m = metrics.find(x => x.queueKey === q);
            return m && m.value > 0;
        }) || 'audit.qc';

        preview = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap });
    }

    // ── 7. SURVEYOR ──
    else if (role === 'SURVEYOR') {
        priorityQueues = ['surveyor.incomplete', 'surveyor.expected', 'surveyor.received'];
        capabilities = { createSample: true, viewMaps: true, viewCustody: true };

        const [incompleteCount, expectedCount, receivedCount] = await Promise.all([
            prisma.sample.count({
                where: scopedWhere(sampleWhere, {
                    OR: [
                        { depthTopCm: null },
                        { latitude: null, longitude: null }
                    ],
                    status: { in: ['EXPECTED', 'COLLECTED'] }
                })
            }),
            prisma.sample.count({
                where: scopedWhere(sampleWhere, {
                    status: 'EXPECTED'
                })
            }),
            prisma.sample.count({
                where: scopedWhere(sampleWhere, {
                    receptionDate: { not: null },
                    status: { notIn: ['EXPECTED', 'DRAFT'] }
                })
            })
        ]);

        metrics = [
            { key: 'surveyor.incomplete', label: 'Details to complete', value: incompleteCount, unit: 'records', availability: 'available', queueKey: 'surveyor.incomplete', tone: incompleteCount > 0 ? 'problem' : '' },
            { key: 'surveyor.expected', label: 'Awaiting receipt', value: expectedCount, unit: 'samples', availability: 'available', queueKey: 'surveyor.expected' },
            { key: 'surveyor.received', label: 'Receipt confirmed', value: receivedCount, unit: 'samples', availability: 'available', queueKey: 'surveyor.received' }
        ];

        recommendedQueue = priorityQueues.find(q => {
            const m = metrics.find(x => x.queueKey === q);
            return m && m.value > 0;
        }) || 'surveyor.incomplete';

        preview = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap });
    }

    // ── 8. EXTERNAL_VIEWER ──
    else if (role === 'EXTERNAL_VIEWER') {
        priorityQueues = ['external.released'];
        capabilities = { viewReports: true, downloadPdf: true };

        const releasedCount = await prisma.report.count({
            where: {
                status: 'PUBLISHED',
                ...(actorScope.projects.length > 0 ? { projectCode: { in: actorScope.projects } } : {})
            }
        });

        metrics = [
            { key: 'external.released', label: 'Available reports', value: releasedCount, unit: 'reports', availability: 'available', queueKey: 'external.released' }
        ];

        recommendedQueue = 'external.released';
        preview = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap });
    }

    // ── 9. VIEWER ──
    else if (role === 'VIEWER') {
        priorityQueues = ['viewer.active', 'viewer.expected', 'viewer.released'];
        capabilities = { viewSamples: true, viewReports: true };

        const [activeCount, expectedCount, releasedCount] = await Promise.all([
            prisma.sample.count({
                where: scopedWhere(sampleWhere, {
                    status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'PREPARATION'] },
                    receptionDate: { not: null }
                })
            }),
            prisma.sample.count({
                where: scopedWhere(sampleWhere, { status: 'EXPECTED' })
            }),
            prisma.report.count({
                where: {
                    status: 'PUBLISHED',
                    ...(actorScope.projects.length > 0 ? { projectCode: { in: actorScope.projects } } : {})
                }
            })
        ]);

        metrics = [
            { key: 'viewer.active', label: 'In laboratory work', value: activeCount, unit: 'samples', availability: 'available', queueKey: 'viewer.active' },
            { key: 'viewer.expected', label: 'Not received', value: expectedCount, unit: 'samples', availability: 'available', queueKey: 'viewer.expected' },
            { key: 'viewer.released', label: 'Published reports', value: releasedCount, unit: 'reports', availability: 'available', queueKey: 'viewer.released' }
        ];

        recommendedQueue = priorityQueues.find(q => {
            const m = metrics.find(x => x.queueKey === q);
            return m && m.value > 0;
        }) || 'viewer.active';

        preview = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap });
    }

    // ── 10. SUPER_ADMIN (Global View) ──
    else if (role === 'SUPER_ADMIN' && !actorScope.activeLabId) {
        priorityQueues = ['admin.configuration', 'admin.labs', 'admin.activity'];
        capabilities = { superAdmin: true, manageLabs: true, manageUsers: true, viewAudit: true };

        const labs = await prisma.lab.findMany({ select: { id: true, name: true, country: true, timezone: true } });
        const invalidTzCount = labs.filter(l => !l.timezone || l.timezone === 'null' || l.timezone.trim() === '').length;
        const totalLabs = labs.length;
        const totalAudit = await prisma.auditLog.count();

        metrics = [
            { key: 'admin.configuration', label: 'Configuration issues', value: invalidTzCount, unit: 'issues', availability: 'available', queueKey: 'admin.configuration', tone: invalidTzCount > 0 ? 'problem' : '' },
            { key: 'admin.labs', label: 'Laboratories', value: totalLabs, unit: 'laboratories', availability: 'available', queueKey: 'admin.labs' },
            { key: 'admin.activity', label: 'Configuration changes', value: totalAudit, unit: 'events', availability: 'available', queueKey: 'admin.activity' }
        ];

        recommendedQueue = priorityQueues.find(q => {
            const m = metrics.find(x => x.queueKey === q);
            return m && m.value > 0;
        }) || 'admin.labs';

        preview = await getQueueRowsInternal(actorScope, recommendedQueue, { page: 1, pageSize: 10, catMap });
    }

    return {
        schemaVersion: 1,
        asOf,
        role,
        scope: {
            key: actorScope.activeLabId || 'global',
            label: actorScope.displayLabel,
            timezone: actorScope.timezone,
            isUtcFallback: actorScope.isUtcFallback,
            localDate: actorScope.localDate
        },
        view: role.toLowerCase(),
        capabilities,
        recommendedQueue,
        metrics,
        preview,
        sections: {
            queue: 'available',
            activity: 'available'
        }
    };
}

/**
 * Internal Queue Rows Fetcher supporting 40-sample method grouping,
 * lean entity projection, and proper pagination.
 */
async function getQueueRowsInternal(actorScope, queueKey, options = {}) {
    const { page = 1, pageSize = 25, catMap = {}, isDryingApplicable = true, search = '' } = options;
    const skip = (page - 1) * pageSize;
    const sampleWhere = buildSampleScopeWhere(actorScope);
    const workWhere = buildWorkItemScopeWhere(actorScope);

    // ─── RECEPTION QUEUES ───
    if (queueKey === 'reception.attention') {
        const where = scopedWhere(sampleWhere, {
            OR: [
                { status: 'RECEIVED_REJECTED' },
                { status: 'RECEIVED', receptionDate: { lt: actorScope.dayStart } }
            ]
        });
        const [total, samples] = await Promise.all([
            prisma.sample.count({ where }),
            prisma.sample.findMany({
                where,
                orderBy: { receptionDate: 'desc' },
                skip,
                take: pageSize,
                select: { id: true, originalId: true, labId: true, projectCode: true, receptionDate: true, status: true, rejectionReason: true }
            })
        ]);
        return {
            queueKey,
            unit: 'samples',
            rows: samples.map(s => ({
                key: s.id,
                title: s.labId || s.originalId,
                context: `${s.projectCode || 'Project'} · Received ${s.receptionDate ? new Date(s.receptionDate).toLocaleTimeString() : 'N/A'}`,
                status: s.status === 'RECEIVED_REJECTED' ? 'Rejected' : 'Awaiting disposition',
                count: 1,
                unit: 'sample',
                action: 'Inspect',
                route: `/samples/${s.id}?tab=request`,
                note: s.rejectionReason || 'Record authorized disposition before proceeding.',
                tone: 'problem'
            })),
            total,
            page,
            pageSize,
            hasMore: skip + samples.length < total
        };
    }

    if (queueKey === 'reception.drafts') {
        const where = scopedWhere(sampleWhere, { status: 'DRAFT' });
        const [total, drafts] = await Promise.all([
            prisma.sample.count({ where }),
            prisma.sample.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip,
                take: pageSize,
                select: { id: true, originalId: true, projectCode: true, updatedAt: true }
            })
        ]);
        return {
            queueKey,
            unit: 'drafts',
            rows: drafts.map(d => ({
                key: d.id,
                title: d.originalId,
                context: `${d.projectCode || 'Project'} · Draft`,
                status: 'Draft saved',
                count: 1,
                unit: 'draft',
                action: 'Resume',
                route: `/reception?sampleId=${d.id}`,
                note: 'Resume draft with project, location and analyses intact.',
                tone: ''
            })),
            total,
            page,
            pageSize,
            hasMore: skip + drafts.length < total
        };
    }

    if (queueKey === 'reception.expected') {
        const where = scopedWhere(sampleWhere, { status: 'EXPECTED' });
        const [total, samples] = await Promise.all([
            prisma.sample.count({ where }),
            prisma.sample.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
                select: { id: true, originalId: true, projectCode: true, createdAt: true, latitude: true, longitude: true }
            })
        ]);
        return {
            queueKey,
            unit: 'samples',
            rows: samples.map(s => ({
                key: s.id,
                title: s.originalId,
                context: `${s.projectCode || 'Project'} · Manifest entry`,
                status: 'Not received',
                count: 1,
                unit: 'sample',
                action: 'Open intake',
                route: `/reception?sampleId=${s.id}`,
                note: 'Field record awaiting physical receipt.',
                tone: 'waiting'
            })),
            total,
            page,
            pageSize,
            hasMore: skip + samples.length < total
        };
    }

    if (queueKey === 'reception.receivedToday') {
        const where = scopedWhere(sampleWhere, {
            receptionDate: { gte: actorScope.dayStart, lt: actorScope.dayEnd },
            status: { notIn: ['EXPECTED', 'DRAFT'] }
        });
        const [total, samples] = await Promise.all([
            prisma.sample.count({ where }),
            prisma.sample.findMany({
                where,
                orderBy: { receptionDate: 'desc' },
                skip,
                take: pageSize,
                select: { id: true, originalId: true, labId: true, projectCode: true, receptionDate: true, status: true }
            })
        ]);
        return {
            queueKey,
            unit: 'samples',
            rows: samples.map(s => ({
                key: s.id,
                title: s.labId || s.originalId,
                context: `${s.originalId} · ${s.projectCode || 'Project'}`,
                status: s.status,
                count: 1,
                unit: 'sample',
                action: 'View receipt',
                route: `/samples/${s.id}?tab=request`,
                note: 'Sample physically received today.',
                tone: ''
            })),
            total,
            page,
            pageSize,
            hasMore: skip + samples.length < total
        };
    }

    // ─── TECHNICIAN QUEUES (Method-first grouping, 40 samples per run) ───
    if (queueKey === 'bench.returned') {
        const where = scopedWhere(workWhere, { status: 'REANALYSIS_REQUIRED' });
        const [total, items] = await Promise.all([
            prisma.workItem.count({ where }),
            prisma.workItem.findMany({
                where,
                include: { sample: { select: { id: true, labId: true, originalId: true } } },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: pageSize
            })
        ]);
        return {
            queueKey,
            unit: 'determinations',
            rows: items.map(item => {
                const meta = catMap[item.analysis] || { name: item.analysis };
                return {
                    key: item.id,
                    title: meta.name,
                    context: `${item.sample?.labId || item.sample?.originalId} · SOP revision ${item.methodRevision || 1}`,
                    status: 'Repeat requested',
                    count: 1,
                    unit: 'determination',
                    action: 'Review reason',
                    route: `/workbench?sampleId=${item.sampleId}&analysis=${item.analysis}&workItemId=${item.id}`,
                    note: item.reanalysisReason || 'Duplication tolerance exceeded; repeat analysis requested.',
                    tone: 'problem'
                };
            }),
            total,
            page,
            pageSize,
            hasMore: skip + items.length < total
        };
    }

    if (queueKey === 'bench.continue') {
        // Group open saved runs
        const where = scopedWhere(workWhere, {
            status: 'IN_PROGRESS',
            sample: {
                receptionDate: { not: null },
                status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING'] }
            }
        });
        const items = await prisma.workItem.findMany({
            where,
            include: { sample: { select: { id: true, labId: true, originalId: true } } },
            orderBy: { updatedAt: 'desc' }
        });

        // Group by analysis + runId/batchId
        const runGroups = new Map();
        for (const item of items) {
            const runKey = item.batchId || item.analysis;
            if (!runGroups.has(runKey)) {
                runGroups.set(runKey, {
                    runKey,
                    analysis: item.analysis,
                    batchId: item.batchId,
                    items: []
                });
            }
            runGroups.get(runKey).items.push(item);
        }

        const totalGroups = runGroups.size;
        const pagedGroups = Array.from(runGroups.values()).slice(skip, skip + pageSize);

        return {
            queueKey,
            unit: 'runs',
            rows: pagedGroups.map(g => {
                const meta = catMap[g.analysis] || { name: g.analysis };
                const determinationCount = g.items.length;
                return {
                    key: g.runKey,
                    title: meta.name,
                    context: `Run ${g.batchId || g.runKey} · ${determinationCount} samples`,
                    status: 'Draft saved',
                    count: 1,
                    unit: 'run',
                    action: 'Continue run',
                    route: `/workbench?analysis=${g.analysis}${g.batchId ? `&runId=${g.batchId}` : ''}`,
                    note: `Saved run retains sample positions, instrument and QC context.`,
                    tone: ''
                };
            }),
            total: totalGroups,
            page,
            pageSize,
            hasMore: skip + pagedGroups.length < totalGroups
        };
    }

    if (queueKey === 'bench.ready') {
        // Ready work grouped by method/revision/run: e.g. 40 pH determinations in 1 group
        const where = scopedWhere(workWhere, {
            status: { in: ['ASSIGNED', 'PENDING'] },
            sample: {
                receptionDate: { not: null },
                status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'PREPARATION'] }
            }
        });

        const allItems = await prisma.workItem.findMany({
            where,
            include: { sample: { select: { id: true, labId: true, originalId: true, dryingStatus: true, preparationStatus: true } } },
            orderBy: { createdAt: 'asc' }
        });

        // Filter eligible items
        const eligibleItems = allItems.filter(w => {
            const isGate = GATE_ANALYSES.includes(w.analysis);
            if (isGate) return true;
            if (isDryingApplicable && w.sample?.dryingStatus !== 'DONE') return false;
            if (w.sample?.preparationStatus !== 'DONE') return false;
            return true;
        });

        // Group by analysis + methodologyId + methodRevision + inputMode
        const methodGroups = new Map();
        for (const item of eligibleItems) {
            const isGate = GATE_ANALYSES.includes(item.analysis);
            const groupKey = isGate ? item.analysis : `${item.analysis}:${item.methodologyId || 'default'}:${item.methodRevision || 1}`;
            if (!methodGroups.has(groupKey)) {
                methodGroups.set(groupKey, {
                    groupKey,
                    analysis: item.analysis,
                    methodologyId: item.methodologyId,
                    methodRevision: item.methodRevision || 1,
                    isGate,
                    items: []
                });
            }
            methodGroups.get(groupKey).items.push(item);
        }

        const totalGroups = methodGroups.size;
        const pagedGroups = Array.from(methodGroups.values()).slice(skip, skip + pageSize);

        return {
            queueKey,
            unit: 'tasks',
            rows: pagedGroups.map(g => {
                const meta = catMap[g.analysis] || { name: g.analysis };
                const count = g.items.length;
                const unit = g.isGate ? 'checklists' : 'determinations';
                const action = g.isGate ? 'Open checklist' : (g.analysis === 'TEXTURE' ? 'Open group' : (g.analysis.includes('SPEC') ? 'Open spectral work' : 'Open worksheet'));
                return {
                    key: g.groupKey,
                    title: meta.name,
                    context: g.isGate ? 'Operational checklist' : `SOP revision ${g.methodRevision}`,
                    status: 'Ready to record',
                    count,
                    unit,
                    action,
                    route: `/workbench?analysis=${g.analysis}&queue=bench.ready`,
                    note: `${count} assigned, received and prepared samples ready for entry.`,
                    tone: ''
                };
            }),
            total: totalGroups,
            page,
            pageSize,
            hasMore: skip + pagedGroups.length < totalGroups
        };
    }

    if (queueKey === 'bench.toSubmit') {
        const where = scopedWhere(workWhere, { status: { in: ['RECORDED', 'COMPLETED'] } });
        const [total, items] = await Promise.all([
            prisma.workItem.count({ where }),
            prisma.workItem.findMany({
                where,
                include: { sample: { select: { id: true, labId: true, originalId: true } } },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: pageSize
            })
        ]);
        return {
            queueKey,
            unit: 'determinations',
            rows: items.map(item => {
                const meta = catMap[item.analysis] || { name: item.analysis };
                return {
                    key: item.id,
                    title: meta.name,
                    context: `${item.sample?.labId || item.sample?.originalId} · Recorded`,
                    status: 'Ready for review',
                    count: 1,
                    unit: 'determination',
                    action: 'Review and submit',
                    route: `/workbench?analysis=${item.analysis}&queue=bench.toSubmit`,
                    note: 'Review recorded evidence and QC before submitting to manager.',
                    tone: ''
                };
            }),
            total,
            page,
            pageSize,
            hasMore: skip + items.length < total
        };
    }

    if (queueKey === 'bench.waiting') {
        const where = scopedWhere(workWhere, {
            status: { in: ['ASSIGNED', 'PENDING'] },
            analysis: { notIn: GATE_ANALYSES },
            sample: {
                receptionDate: { not: null },
                status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'PREPARATION'] },
                OR: [
                    { preparationStatus: { not: 'DONE' } },
                    ...(isDryingApplicable ? [{ dryingStatus: { not: 'DONE' } }] : [])
                ]
            }
        });
        const [total, items] = await Promise.all([
            prisma.workItem.count({ where }),
            prisma.workItem.findMany({
                where,
                include: { sample: { select: { id: true, labId: true, originalId: true, dryingStatus: true, preparationStatus: true } } },
                orderBy: { createdAt: 'asc' },
                skip,
                take: pageSize
            })
        ]);
        return {
            queueKey,
            unit: 'tasks',
            rows: items.map(item => {
                const meta = catMap[item.analysis] || { name: item.analysis };
                const reason = item.sample?.dryingStatus !== 'DONE' && isDryingApplicable ? 'Waiting for drying' : 'Waiting for preparation';
                return {
                    key: item.id,
                    title: meta.name,
                    context: `${item.sample?.labId || item.sample?.originalId} · SOP revision ${item.methodRevision || 1}`,
                    status: reason,
                    count: 1,
                    unit: 'determination',
                    action: 'See dependency',
                    route: `/workbench?analysis=${item.analysis}&queue=bench.waiting`,
                    note: 'Worksheet locked until operational preparation gate completes.',
                    tone: 'waiting'
                };
            }),
            total,
            page,
            pageSize,
            hasMore: skip + items.length < total
        };
    }

    // ─── MANAGER QUEUES ───
    if (queueKey === 'manager.exceptions') {
        const batchWhere = {
            status: { in: ['QC_FAIL', 'FAILED'] },
            disposition: null,
            ...(actorScope.activeLabId ? {
                OR: [
                    { labId: actorScope.activeLabId },
                    { workItems: { some: { labId: actorScope.activeLabId } } }
                ]
            } : {})
        };
        const batches = await prisma.batch.findMany({
            where: batchWhere,
            include: { workItems: { select: { id: true, sampleId: true, analysis: true } } },
            skip,
            take: pageSize
        });
        const total = await prisma.batch.count({
            where: batchWhere
        });
        return {
            queueKey,
            unit: 'exceptions',
            rows: batches.map(b => ({
                key: b.id,
                title: `Batch ${b.id}`,
                context: `${b.workItems.length} affected work items`,
                status: 'QC failed',
                count: 1,
                unit: 'exception',
                action: 'Inspect QC',
                route: `/manager-queue?lane=review&batchId=${b.id}`,
                note: 'Review actual QC control values and disposition before accepting work.',
                tone: 'problem'
            })),
            total,
            page,
            pageSize,
            hasMore: skip + batches.length < total
        };
    }

    if (queueKey === 'manager.review') {
        // Group submissions by sample before pagination
        const subWhere = {
            status: 'PENDING_REVIEW',
            ...(actorScope.activeLabId ? {
                OR: [
                    { assignedLab: actorScope.activeLabId },
                    { labId: actorScope.activeLabId }
                ]
            } : {})
        };

        const distinctSamples = await prisma.submission.findMany({
            where: subWhere,
            select: { sampleId: true },
            distinct: ['sampleId']
        });

        const total = distinctSamples.length;
        const pagedSampleIds = distinctSamples.slice(skip, skip + pageSize).map(s => s.sampleId);

        const submissions = await prisma.submission.findMany({
            where: { ...subWhere, sampleId: { in: pagedSampleIds } },
            orderBy: { submittedAt: 'desc' }
        });

        // Group by sampleId
        const groups = new Map();
        for (const sub of submissions) {
            if (!groups.has(sub.sampleId)) {
                groups.set(sub.sampleId, {
                    sampleId: sub.sampleId,
                    labId: sub.labId,
                    submittedBy: sub.submittedBy,
                    submittedAt: sub.submittedAt,
                    types: [sub.type],
                    submissions: [sub]
                });
            } else {
                const g = groups.get(sub.sampleId);
                g.types.push(sub.type);
                g.submissions.push(sub);
            }
        }

        return {
            queueKey,
            unit: 'samples',
            rows: Array.from(groups.values()).map(g => ({
                key: g.sampleId,
                title: g.labId || g.sampleId,
                context: `${g.types.join(', ')} · Submitted by ${g.submittedBy}`,
                status: 'Ready for review',
                count: 1,
                unit: 'sample',
                action: 'Review',
                route: `/samples/${g.sampleId}?tab=review&submissionId=${g.submissions[0]?.id}`,
                note: 'Inspect submitted determination results and linked QC evidence.',
                tone: ''
            })),
            total,
            page,
            pageSize,
            hasMore: skip + groups.size < total
        };
    }

    if (queueKey === 'manager.finalApproval') {
        const candidates = options.candidates || await prisma.sample.findMany({
            where: scopedWhere(sampleWhere, {
                status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING'] },
                receptionDate: { not: null }
            }),
            include: {
                workItems: true,
                orderRevisions: {
                    include: { lines: true },
                    orderBy: { version: 'desc' },
                    take: 1
                }
            }
        });

        const eligible = [];
        for (const s of candidates) {
            const orderLines = s.orderRevisions?.[0]?.lines || [];
            const evalResult = canFinalApprove(s, s.workItems, orderLines, null);
            if (evalResult.allowed) eligible.push(s);
        }

        const total = eligible.length;
        const pagedSamples = eligible.slice(skip, skip + pageSize);

        return {
            queueKey,
            unit: 'samples',
            rows: pagedSamples.map(s => ({
                key: s.id,
                title: s.labId || s.originalId,
                context: `${s.projectCode || 'Project'} · All ordered analyses accepted`,
                status: 'Ready for final check',
                count: 1,
                unit: 'sample',
                action: 'Open final review',
                route: `/samples/${s.id}?tab=review`,
                note: 'Final approval authorizes completion. Report release is a distinct subsequent action.',
                tone: ''
            })),
            total,
            page,
            pageSize,
            hasMore: skip + pagedSamples.length < total
        };
    }

    if (queueKey === 'manager.assign') {
        const where = scopedWhere(workWhere, {
            assignedTo: null,
            status: { in: ['NOT_ASSIGNED', 'PENDING'] }
        });

        const items = await prisma.workItem.findMany({
            where,
            orderBy: { createdAt: 'asc' }
        });

        // Group by analysis
        const groups = new Map();
        for (const item of items) {
            if (!groups.has(item.analysis)) {
                groups.set(item.analysis, {
                    analysis: item.analysis,
                    isGate: GATE_ANALYSES.includes(item.analysis),
                    count: 0
                });
            }
            groups.get(item.analysis).count++;
        }

        const total = groups.size;
        const paged = Array.from(groups.values()).slice(skip, skip + pageSize);

        return {
            queueKey,
            unit: 'tasks',
            rows: paged.map(g => {
                const meta = catMap[g.analysis] || { name: g.analysis };
                return {
                    key: g.analysis,
                    title: meta.name,
                    context: g.isGate ? 'Operational gate' : 'Analytical method',
                    status: 'Unassigned',
                    count: g.count,
                    unit: g.isGate ? 'checklists' : 'determinations',
                    action: 'Assign by method',
                    route: `/manager-queue?lane=assign&analysis=${g.analysis}`,
                    note: `${g.count} unassigned work items ready for allocation to bench technicians.`,
                    tone: ''
                };
            }),
            total,
            page,
            pageSize,
            hasMore: skip + paged.length < total
        };
    }

    if (queueKey === 'manager.intake') {
        const where = scopedWhere(sampleWhere, { status: 'RECEIVED' });
        const [total, samples] = await Promise.all([
            prisma.sample.count({ where }),
            prisma.sample.findMany({
                where,
                orderBy: { receptionDate: 'desc' },
                skip,
                take: pageSize,
                select: { id: true, originalId: true, labId: true, projectCode: true, receptionDate: true }
            })
        ]);
        return {
            queueKey,
            unit: 'samples',
            rows: samples.map(s => ({
                key: s.id,
                title: s.labId || s.originalId,
                context: `${s.projectCode || 'Project'} · Received ${s.receptionDate ? new Date(s.receptionDate).toLocaleDateString() : ''}`,
                status: 'Awaiting acceptance',
                count: 1,
                unit: 'sample',
                action: 'Inspect intake',
                route: `/manager-queue?lane=intake&sampleId=${s.id}`,
                note: 'Verify sample condition and accept intake to generate laboratory work items.',
                tone: 'waiting'
            })),
            total,
            page,
            pageSize,
            hasMore: skip + samples.length < total
        };
    }

    // ─── REPORT & VIEWER QUEUES ───
    if (queueKey === 'external.released' || queueKey === 'viewer.released' || queueKey === 'project.released' || queueKey === 'master.released') {
        const where = {
            status: 'PUBLISHED',
            ...(actorScope.projects.length > 0 && ['EXTERNAL_VIEWER', 'VIEWER', 'PROJECT_MANAGER'].includes(actorScope.role)
                ? { projectCode: { in: actorScope.projects } }
                : {})
        };
        const [total, reports] = await Promise.all([
            prisma.report.count({ where }),
            prisma.report.findMany({
                where,
                orderBy: { publishedAt: 'desc' },
                skip,
                take: pageSize,
                select: { id: true, sampleId: true, sampleLabId: true, version: true, publishedAt: true, projectCode: true }
            })
        ]);
        return {
            queueKey,
            unit: 'reports',
            rows: reports.map(r => ({
                key: r.id,
                title: r.sampleLabId || r.sampleId,
                context: `${r.projectCode || 'Project'} · Version ${r.version} · Issued ${r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : ''}`,
                status: 'Published',
                count: 1,
                unit: 'report',
                action: 'Open report',
                route: `/result-reports?reportId=${r.id}`,
                note: 'Current published analytical certificate.',
                tone: ''
            })),
            total,
            page,
            pageSize,
            hasMore: skip + reports.length < total
        };
    }

    // ─── SUPER_ADMIN / GLOBAL ADMIN QUEUES ───
    if (queueKey === 'admin.configuration') {
        const labs = await prisma.lab.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, country: true, timezone: true }
        });
        const issues = [];
        for (const lab of labs) {
            const hasTz = lab.timezone && lab.timezone !== 'null' && lab.timezone.trim() !== '';
            if (!hasTz) {
                issues.push({
                    key: `config-tz-${lab.id}`,
                    title: lab.name || lab.id,
                    context: `${lab.id} · ${lab.country || 'National Lab'} · Timezone missing`,
                    status: 'Timezone not configured',
                    count: 1,
                    unit: 'issue',
                    action: 'Configure laboratory',
                    route: `/admin/labs?labId=${lab.id}`,
                    note: 'Configure an IANA timezone before showing this laboratory’s daily metrics.',
                    tone: 'problem'
                });
            }
        }
        let filteredIssues = issues;
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            filteredIssues = issues.filter(i =>
                (i.title && i.title.toLowerCase().includes(q)) ||
                (i.context && i.context.toLowerCase().includes(q)) ||
                (i.key && i.key.toLowerCase().includes(q))
            );
        }
        const total = filteredIssues.length;
        const paged = filteredIssues.slice(skip, skip + pageSize);
        return {
            queueKey,
            unit: 'issues',
            rows: paged,
            total,
            page,
            pageSize,
            hasMore: skip + paged.length < total
        };
    }

    if (queueKey === 'admin.labs') {
        let where = {};
        if (search && search.trim()) {
            const q = search.trim();
            where = {
                OR: [
                    { id: { contains: q } },
                    { name: { contains: q } },
                    { country: { contains: q } }
                ]
            };
        }
        const [total, labs] = await Promise.all([
            prisma.lab.count({ where }),
            prisma.lab.findMany({
                where,
                orderBy: { name: 'asc' },
                skip,
                take: pageSize,
                select: { id: true, name: true, country: true, timezone: true, isActive: true }
            })
        ]);
        return {
            queueKey,
            unit: 'laboratories',
            rows: labs.map(lab => {
                const hasTz = lab.timezone && lab.timezone !== 'null' && lab.timezone.trim() !== '';
                return {
                    key: lab.id,
                    title: lab.name || lab.id,
                    context: `${lab.id} · ${lab.country || 'National Lab'} · ${hasTz ? lab.timezone : 'Timezone missing'}`,
                    status: hasTz ? 'Operational' : 'Configuration required',
                    count: 1,
                    unit: 'laboratory',
                    action: 'View laboratory',
                    route: `/admin/labs?labId=${lab.id}`,
                    note: hasTz ? 'Laboratory active and operational.' : 'Timezone configuration required.',
                    tone: hasTz ? '' : 'waiting'
                };
            }),
            total,
            page,
            pageSize,
            hasMore: skip + labs.length < total
        };
    }

    if (queueKey === 'admin.activity') {
        let where = {};
        if (search && search.trim()) {
            const q = search.trim();
            where = {
                OR: [
                    { entity: { contains: q } },
                    { action: { contains: q } },
                    { performedBy: { contains: q } },
                    { details: { contains: q } }
                ]
            };
        }
        const [total, events] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: pageSize,
                select: { id: true, entity: true, entityId: true, action: true, details: true, performedBy: true, timestamp: true }
            })
        ]);
        return {
            queueKey,
            unit: 'events',
            rows: events.map(ev => ({
                key: ev.id,
                title: `${ev.entity} ${ev.action}`,
                context: `${ev.performedBy || 'System'} · ${ev.timestamp ? new Date(ev.timestamp).toLocaleDateString() + ' ' + new Date(ev.timestamp).toLocaleTimeString() : 'N/A'}`,
                status: 'Audit recorded',
                count: 1,
                unit: 'event',
                action: 'Inspect audit',
                route: `/admin/audit?id=${ev.id}`,
                note: ev.details || `${ev.entity} ${ev.action} performed by ${ev.performedBy}`,
                tone: ''
            })),
            total,
            page,
            pageSize,
            hasMore: skip + events.length < total
        };
    }

    // ─── AUDIT & QUALITY ASSURANCE QUEUES ───
    if (queueKey === 'audit.qc') {
        const batchWhere = {};
        if (actorScope.activeLabId) {
            batchWhere.OR = [
                { labId: actorScope.activeLabId },
                { labId: null }
            ];
        }
        if (search && search.trim()) {
            const q = search.trim();
            const searchClause = {
                OR: [
                    { id: { contains: q } },
                    { analysis: { contains: q } },
                    { instrument: { contains: q } },
                    { notes: { contains: q } },
                    { status: { contains: q } }
                ]
            };
            if (batchWhere.OR) {
                batchWhere.AND = [searchClause];
            } else {
                Object.assign(batchWhere, searchClause);
            }
        }

        const [total, qcFailedCount, batches] = await Promise.all([
            prisma.batch.count({ where: batchWhere }),
            prisma.batch.count({
                where: {
                    ...batchWhere,
                    status: { in: ['QC_FAIL', 'FAILED'] }
                }
            }),
            prisma.batch.findMany({
                where: batchWhere,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
                include: {
                    _count: {
                        select: { workItems: true, qcItems: true }
                    }
                }
            })
        ]);

        return {
            queueKey,
            unit: 'batches',
            qcFailedCount,
            rows: batches.map(b => {
                const analysisName = catMap[b.analysis]?.name || b.analysis;
                const isFailed = String(b.status || '').toUpperCase().includes('FAIL');
                return {
                    key: b.id,
                    title: b.id,
                    context: `${analysisName} · ${b.labId || 'Global'} · ${b.instrument || 'Bench Run'}`,
                    status: b.status || 'OPEN',
                    count: b._count?.workItems || 0,
                    unit: 'samples',
                    action: 'Inspect batch',
                    route: `/qa?tab=qc&batchId=${b.id}`,
                    note: b.notes || (isFailed ? 'Batch failed QC thresholds; review required.' : 'Batch within acceptable tolerances.'),
                    tone: isFailed ? 'problem' : ''
                };
            }),
            total,
            page,
            pageSize,
            hasMore: skip + batches.length < total
        };
    }

    if (queueKey === 'audit.history') {
        const amendWhere = {};
        if (actorScope.activeLabId) {
            amendWhere.sample = { assignedLab: actorScope.activeLabId };
        }
        if (search && search.trim()) {
            const q = search.trim();
            const searchClause = {
                OR: [
                    { sampleId: { contains: q } },
                    { reason: { contains: q } },
                    { type: { contains: q } },
                    { status: { contains: q } },
                    { createdBy: { contains: q } }
                ]
            };
            if (amendWhere.sample) {
                amendWhere.AND = [searchClause];
            } else {
                Object.assign(amendWhere, searchClause);
            }
        }

        const [total, amendments] = await Promise.all([
            prisma.sampleAmendment.count({ where: amendWhere }),
            prisma.sampleAmendment.findMany({
                where: amendWhere,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
                include: {
                    sample: {
                        select: { id: true, assignedLab: true, matrix: true }
                    }
                }
            })
        ]);

        return {
            queueKey,
            unit: 'amendments',
            rows: amendments.map(a => ({
                key: a.id,
                title: `${a.sampleId} · ${a.type || 'AMENDMENT'}`,
                context: `${a.reason || 'No justification provided'} · by ${a.createdBy || 'System'}`,
                status: a.status || 'RECORDED',
                count: 1,
                unit: 'amendment',
                action: 'View dossier',
                route: `/samples/${a.sampleId}`,
                note: a.impactAssessment || `Amendment recorded at ${new Date(a.createdAt).toLocaleString()}`,
                tone: a.status === 'PENDING' ? 'waiting' : ''
            })),
            total,
            page,
            pageSize,
            hasMore: skip + amendments.length < total
        };
    }

    if (queueKey === 'audit.exceptions') {
        const excWhere = scopedWhere(sampleWhere, { status: 'APPROVED', results: { none: {} } });
        if (search && search.trim()) {
            const q = search.trim();
            excWhere.AND = [
                {
                    OR: [
                        { id: { contains: q } },
                        { originalId: { contains: q } },
                        { matrix: { contains: q } }
                    ]
                }
            ];
        }

        const [total, samples] = await Promise.all([
            prisma.sample.count({ where: excWhere }),
            prisma.sample.findMany({
                where: excWhere,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
                select: {
                    id: true,
                    originalId: true,
                    matrix: true,
                    assignedLab: true,
                    createdAt: true
                }
            })
        ]);

        return {
            queueKey,
            unit: 'samples',
            rows: samples.map(s => ({
                key: s.id,
                title: s.id,
                context: `${s.assignedLab || 'Unassigned'} · ${s.matrix || 'SOIL'} · Approved with zero analytical results`,
                status: 'Missing Results',
                count: 1,
                unit: 'sample',
                action: 'Inspect sample',
                route: `/samples/${s.id}`,
                note: 'Sample was approved without recorded test measurements.',
                tone: 'problem'
            })),
            total,
            page,
            pageSize,
            hasMore: skip + samples.length < total
        };
    }

    // Default fallback empty queue
    return {
        queueKey,
        unit: 'items',
        rows: [],
        total: 0,
        page,
        pageSize,
        hasMore: false
    };
}

/**
 * Public Queue Rows Fetcher with Role Authorization Guard
 */
async function getQueueRows(user, queueKey, options = {}) {
    const allowed = ALLOWED_ROLE_QUEUES[user.role] || [];
    if (!allowed.includes(queueKey) && user.role !== 'SUPER_ADMIN') {
        const err = new Error(`Access denied: Queue ${queueKey} is not authorized for role ${user.role}`);
        err.statusCode = 403;
        err.code = 'FORBIDDEN_QUEUE';
        throw err;
    }

    const actorScope = await resolveActorScope(user, options);
    const catMap = await getAnalysisCatalogueMap();
    const isDryingApplicable = await checkDryingApplicable(actorScope.activeLabId);

    const pageSize = Math.min(Math.max(parseInt(options.pageSize || 25), 1), 100);
    const page = Math.max(parseInt(options.page || 1), 1);

    return getQueueRowsInternal(actorScope, queueKey, {
        page,
        pageSize,
        catMap,
        isDryingApplicable,
        search: options.search || ''
    });
}

module.exports = {
    ALLOWED_ROLE_QUEUES,
    getDashboardHome,
    getQueueRows
};
