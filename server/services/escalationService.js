const prisma = require('../prisma');
const { createNotification } = require('../controllers/notificationController');

const DEFAULT_THRESHOLDS = {
    UNASSIGNED_HOURS: 48,      // 2 days
    IN_PROGRESS_HOURS: 72,     // 3 days
    ON_HOLD_HOURS: 24          // 1 day
};

/**
 * Find managers and super admins for a given laboratory
 */
async function getManagersForLab(labId) {
    return prisma.user.findMany({
        where: {
            role: { in: ['LAB_MANAGER', 'SUPER_ADMIN'] },
            isActive: true,
            ...(labId ? {
                OR: [
                    { labId: labId },
                    { role: 'SUPER_ADMIN' }
                ]
            } : {})
        },
        select: { id: true, username: true, labId: true, role: true }
    });
}

/**
 * Rule 1: Escalate work items or samples unassigned beyond threshold
 * Work sitting in NOT_ASSIGNED longer than UNASSIGNED_HOURS (default 48 hours)
 */
async function escalateUnassignedWork(now = new Date(), thresholds = DEFAULT_THRESHOLDS) {
    const unassignedCutoff = new Date(now.getTime() - thresholds.UNASSIGNED_HOURS * 60 * 60 * 1000);

    const unassignedItems = await prisma.workItem.findMany({
        where: {
            status: 'NOT_ASSIGNED',
            createdAt: { lte: unassignedCutoff }
        },
        include: {
            sample: {
                select: { id: true, labId: true, assignedLab: true, status: true }
            }
        }
    });

    const escalations = [];

    for (const item of unassignedItems) {
        const sampleDisplay = item.sample?.labId && item.sample.labId !== item.sampleId
            ? `${item.sample.labId} (${item.sampleId})`
            : item.sampleId;
        const targetLabId = item.assignedLab || item.labId || item.sample?.assignedLab || item.sample?.labId;
        const managers = await getManagersForLab(targetLabId);

        const ageHours = Math.round((now.getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60));
        const ageDays = Math.floor(ageHours / 24);
        const durationStr = ageDays >= 1 ? `${ageDays} day${ageDays > 1 ? 's' : ''}` : `${ageHours} hours`;

        for (const mgr of managers) {
            // Deduplicate: check if an unread notification for this unassigned work item already exists
            const existing = await prisma.notification.findFirst({
                where: {
                    userId: mgr.id,
                    link: `/samples/${item.sampleId}`,
                    title: { contains: 'Unassigned' },
                    isRead: false
                }
            });

            if (!existing) {
                const notif = await createNotification(
                    mgr.id,
                    'WARNING',
                    `⚠️ Work Item Unassigned: ${sampleDisplay}`,
                    `Work item "${item.analysis}" for sample ${sampleDisplay} has been unassigned for ${durationStr}.`,
                    `/samples/${item.sampleId}`
                );
                escalations.push({
                    type: 'UNASSIGNED',
                    workItemId: item.id,
                    sampleId: item.sampleId,
                    userId: mgr.id,
                    notificationId: notif?.id
                });
            }
        }
    }

    return escalations;
}

/**
 * Rule 2: Escalate stalled work in progress beyond twice the expected duration
 * Work in IN_PROGRESS longer than IN_PROGRESS_HOURS (default 72 hours)
 */
async function escalateStalledWork(now = new Date(), thresholds = DEFAULT_THRESHOLDS) {
    const stalledCutoff = new Date(now.getTime() - thresholds.IN_PROGRESS_HOURS * 60 * 60 * 1000);

    const inProgressItems = await prisma.workItem.findMany({
        where: {
            status: 'IN_PROGRESS',
            updatedAt: { lte: stalledCutoff }
        },
        include: {
            sample: {
                select: { id: true, labId: true, assignedLab: true }
            }
        }
    });

    const escalations = [];

    for (const item of inProgressItems) {
        const sampleDisplay = item.sample?.labId && item.sample.labId !== item.sampleId
            ? `${item.sample.labId} (${item.sampleId})`
            : item.sampleId;
        const targetLabId = item.assignedLab || item.labId || item.sample?.assignedLab || item.sample?.labId;
        const managers = await getManagersForLab(targetLabId);

        const ageHours = Math.round((now.getTime() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60));
        const ageDays = Math.floor(ageHours / 24);
        const durationStr = ageDays >= 1 ? `${ageDays} day${ageDays > 1 ? 's' : ''}` : `${ageHours} hours`;

        for (const mgr of managers) {
            const existing = await prisma.notification.findFirst({
                where: {
                    userId: mgr.id,
                    link: `/samples/${item.sampleId}`,
                    title: { contains: 'Stalled' },
                    isRead: false
                }
            });

            if (!existing) {
                const notif = await createNotification(
                    mgr.id,
                    'WARNING',
                    `⚠️ Work Item Stalled: ${sampleDisplay}`,
                    `Analysis "${item.analysis}" for sample ${sampleDisplay} has been in progress for ${durationStr} (assigned to ${item.assignedTo || 'technician'}).`,
                    `/samples/${item.sampleId}`
                );
                escalations.push({
                    type: 'STALLED',
                    workItemId: item.id,
                    sampleId: item.sampleId,
                    userId: mgr.id,
                    notificationId: notif?.id
                });
            }
        }
    }

    return escalations;
}

/**
 * Rule 3: Escalate work on hold beyond its reason's limit
 * Work on ON_HOLD longer than ON_HOLD_HOURS (default 24 hours)
 */
async function escalateOnHoldWork(now = new Date(), thresholds = DEFAULT_THRESHOLDS) {
    const holdCutoff = new Date(now.getTime() - thresholds.ON_HOLD_HOURS * 60 * 60 * 1000);

    const onHoldItems = await prisma.workItem.findMany({
        where: {
            status: 'ON_HOLD',
            updatedAt: { lte: holdCutoff }
        },
        include: {
            sample: {
                select: { id: true, labId: true, assignedLab: true }
            }
        }
    });

    const escalations = [];

    for (const item of onHoldItems) {
        const sampleDisplay = item.sample?.labId && item.sample.labId !== item.sampleId
            ? `${item.sample.labId} (${item.sampleId})`
            : item.sampleId;
        const targetLabId = item.assignedLab || item.labId || item.sample?.assignedLab || item.sample?.labId;
        const managers = await getManagersForLab(targetLabId);

        const ageHours = Math.round((now.getTime() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60));

        for (const mgr of managers) {
            const existing = await prisma.notification.findFirst({
                where: {
                    userId: mgr.id,
                    link: `/samples/${item.sampleId}`,
                    title: { contains: 'On Hold' },
                    isRead: false
                }
            });

            if (!existing) {
                const notif = await createNotification(
                    mgr.id,
                    'WARNING',
                    `⚠️ Work Item On Hold: ${sampleDisplay}`,
                    `Analysis "${item.analysis}" for sample ${sampleDisplay} has been on hold for ${ageHours} hours.`,
                    `/samples/${item.sampleId}`
                );
                escalations.push({
                    type: 'ON_HOLD',
                    workItemId: item.id,
                    sampleId: item.sampleId,
                    userId: mgr.id,
                    notificationId: notif?.id
                });
            }
        }
    }

    return escalations;
}

/**
 * Main routine: Run all escalation checks
 */
async function runEscalationChecks(now = new Date(), customThresholds = {}) {
    const thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
    const unassigned = await escalateUnassignedWork(now, thresholds);
    const stalled = await escalateStalledWork(now, thresholds);
    const onHold = await escalateOnHoldWork(now, thresholds);

    return {
        timestamp: now,
        escalatedCount: unassigned.length + stalled.length + onHold.length,
        unassigned,
        stalled,
        onHold
    };
}

let schedulerInterval = null;

function startEscalationScheduler(intervalMs = 60 * 60 * 1000) {
    if (schedulerInterval) return;
    schedulerInterval = setInterval(async () => {
        try {
            await runEscalationChecks();
        } catch (err) {
            console.error('[ESCALATION] Error running escalation checks:', err.message);
        }
    }, intervalMs);
    if (schedulerInterval.unref) schedulerInterval.unref();
}

function stopEscalationScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
}

module.exports = {
    DEFAULT_THRESHOLDS,
    runEscalationChecks,
    escalateUnassignedWork,
    escalateStalledWork,
    escalateOnHoldWork,
    startEscalationScheduler,
    stopEscalationScheduler
};
