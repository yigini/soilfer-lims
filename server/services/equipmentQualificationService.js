'use strict';

const prisma = require('../prisma');
const { randomUUID: uuidv4 } = require('crypto');

/**
 * Service to manage equipment qualification calculations, schedule policies,
 * event chronology, and readiness consistency across SoilFER LIMS.
 */

const isCalibrationEvent = (eventType) => {
    if (!eventType) return false;
    const t = eventType.toUpperCase();
    return t === 'CALIBRATION' || t.startsWith('CALIBRATION_') || t.endsWith('_CALIBRATION') || t.includes('CALIBRATION');
};

const isVerificationEvent = (eventType) => {
    if (!eventType) return false;
    const t = eventType.toUpperCase();
    return t === 'VERIFICATION' || t.startsWith('VERIFICATION_') || t.endsWith('_VERIFICATION') || t.includes('VERIFICATION');
};

const parseEventDates = (event) => {
    let performedDate = null;
    let nextDueDate = null;

    if (event.details) {
        try {
            const parsed = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
            if (parsed && parsed.performedDate) {
                const pd = new Date(parsed.performedDate);
                if (!isNaN(pd.getTime())) performedDate = pd;
            }
            if (parsed && parsed.nextDueDate) {
                const nd = new Date(parsed.nextDueDate);
                if (!isNaN(nd.getTime())) nextDueDate = nd;
            }
        } catch (_) {}
    }

    if (!performedDate) {
        performedDate = event.ts ? new Date(event.ts) : new Date();
    }

    return { performedDate, nextDueDate };
};

/**
 * Calculate authoritative qualification state from chronological events and configured schedule rules.
 * 
 * Rules:
 * 1. Event Chronology: Evaluates events by performedDate descending (then ts descending).
 * 2. Disposition / Rejection: A manager decision of 'REJECTED' or pending signoff blocks qualification.
 *    A rejection of an old event does NOT invalidate a newer passing calibration performed afterwards.
 * 3. Schedule Policy: Uses the active EquipmentScheduleRule. Does not mark absent schedule data OK.
 * 4. Safety: Failed or rejected calibration on an IN_SERVICE asset sets it OUT_OF_SERVICE.
 *    Never demotes DECOMMISSIONED assets. Passing calibration does not clear unrelated restrictions.
 */
const calculateQualification = (asset, events = [], scheduleRules = [], now = new Date()) => {
    const calibRule = scheduleRules.find(r => r.scheduleType === 'CALIBRATION' && r.active !== false);
    const verifRule = scheduleRules.find(r => r.scheduleType === 'VERIFICATION' && r.active !== false);

    // Map and sort events
    const enrichedEvents = events.map(e => {
        const { performedDate, nextDueDate } = parseEventDates(e);
        const isRejected = e.managerDecision === 'REJECTED';
        const isApproved = e.managerDecision === 'APPROVED';
        const isPendingSignoff = Boolean(e.requiresManagerSignoff) && !isApproved;
        const isPass = (e.outcome === 'PASS') && !isRejected && !isPendingSignoff;
        const isFail = (e.outcome === 'FAIL') || isRejected;

        return {
            ...e,
            parsedPerformedDate: performedDate,
            parsedNextDueDate: nextDueDate,
            isPass,
            isFail,
            isPendingSignoff
        };
    }).sort((a, b) => {
        const diff = b.parsedPerformedDate.getTime() - a.parsedPerformedDate.getTime();
        if (diff !== 0) return diff;
        return new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime();
    });

    const calibEvents = enrichedEvents.filter(e => isCalibrationEvent(e.eventType));
    const verifEvents = enrichedEvents.filter(e => isVerificationEvent(e.eventType));

    // Determine calibration qualification
    let lastCalibrationDate = asset.qualification?.lastCalibrationDate || null;
    let nextCalibrationDueDate = asset.qualification?.nextCalibrationDueDate || null;
    let calibrationStatus = asset.qualification?.calibrationStatus || 'NOT_CONFIGURED';
    let calibFailed = false;

    if (calibEvents.length > 0) {
        const latestCalib = calibEvents[0];
        if (latestCalib.isFail) {
            lastCalibrationDate = latestCalib.parsedPerformedDate;
            calibrationStatus = 'OVERDUE'; // Represents blocked/failed
            calibFailed = true;
        } else if (latestCalib.isPass) {
            lastCalibrationDate = latestCalib.parsedPerformedDate;
            if (latestCalib.parsedNextDueDate) {
                nextCalibrationDueDate = latestCalib.parsedNextDueDate;
            } else if (calibRule?.frequencyDays) {
                nextCalibrationDueDate = new Date(latestCalib.parsedPerformedDate.getTime() + calibRule.frequencyDays * 86400000);
            }

            if (!calibRule && !nextCalibrationDueDate) {
                // No schedule policy and no due date configured: keep NOT_CONFIGURED
                calibrationStatus = 'NOT_CONFIGURED';
            } else if (nextCalibrationDueDate && nextCalibrationDueDate < now) {
                calibrationStatus = 'OVERDUE';
            } else if (nextCalibrationDueDate && calibRule?.dueSoonDays && (nextCalibrationDueDate.getTime() - now.getTime()) <= (calibRule.dueSoonDays * 86400000)) {
                calibrationStatus = 'DUE_SOON';
            } else {
                calibrationStatus = 'OK';
            }
        }
    }

    // Determine verification qualification
    let lastVerificationDate = asset.qualification?.lastVerificationDate || null;
    let nextVerificationDueDate = asset.qualification?.nextVerificationDueDate || null;
    let verificationStatus = asset.qualification?.verificationStatus || 'NOT_CONFIGURED';
    let verifFailed = false;

    if (verifEvents.length > 0) {
        const latestVerif = verifEvents[0];
        if (latestVerif.isFail) {
            lastVerificationDate = latestVerif.parsedPerformedDate;
            verificationStatus = 'OVERDUE';
            verifFailed = true;
        } else if (latestVerif.isPass) {
            lastVerificationDate = latestVerif.parsedPerformedDate;
            if (latestVerif.parsedNextDueDate) {
                nextVerificationDueDate = latestVerif.parsedNextDueDate;
            } else if (verifRule?.frequencyDays) {
                nextVerificationDueDate = new Date(latestVerif.parsedPerformedDate.getTime() + verifRule.frequencyDays * 86400000);
            }

            if (!verifRule && !nextVerificationDueDate) {
                verificationStatus = 'NOT_CONFIGURED';
            } else if (nextVerificationDueDate && nextVerificationDueDate < now) {
                verificationStatus = 'OVERDUE';
            } else if (nextVerificationDueDate && verifRule?.dueSoonDays && (nextVerificationDueDate.getTime() - now.getTime()) <= (verifRule.dueSoonDays * 86400000)) {
                verificationStatus = 'DUE_SOON';
            } else {
                verificationStatus = 'OK';
            }
        }
    }

    // Should asset be placed OUT_OF_SERVICE?
    // Only if currently IN_SERVICE and latest calibration/verification failed or was rejected
    const shouldSetOutOfService = (calibFailed || verifFailed) && asset.status === 'IN_SERVICE';

    return {
        lastCalibrationDate,
        nextCalibrationDueDate,
        calibrationStatus,
        lastVerificationDate,
        nextVerificationDueDate,
        verificationStatus,
        shouldSetOutOfService
    };
};

/**
 * Authoritative equipment readiness calculation.
 */
const getReadiness = (asset) => {
    if (!asset) return 'BLOCKED';
    if (asset.status === 'OUT_OF_SERVICE' || asset.status === 'DECOMMISSIONED') return 'BLOCKED';

    const q = asset.qualification;
    if (!q) return 'NOT_CONFIGURED';

    if (['OVERDUE', 'FAILED'].includes(q.calibrationStatus) || ['OVERDUE', 'FAILED'].includes(q.verificationStatus)) {
        return 'BLOCKED';
    }
    if (q.calibrationStatus === 'DUE_SOON' || q.verificationStatus === 'DUE_SOON') {
        return 'WARNING';
    }
    if (q.calibrationStatus === 'OK' || q.verificationStatus === 'OK') {
        return 'READY';
    }
    return 'READY';
};

/**
 * Recompute qualification state from database records and persist atomically.
 */
const recomputeAndPersist = async (equipmentId, txOrPrisma = prisma, actorUsername = 'system') => {
    const asset = await txOrPrisma.equipmentAsset.findUnique({
        where: { id: equipmentId },
        include: {
            qualification: true,
            scheduleRules: { where: { active: true } },
            events: {
                orderBy: { ts: 'desc' }
            }
        }
    });

    if (!asset) {
        throw new Error(`Equipment not found: ${equipmentId}`);
    }

    const projected = calculateQualification(asset, asset.events, asset.scheduleRules);

    const qualData = {
        lastCalibrationDate: projected.lastCalibrationDate,
        nextCalibrationDueDate: projected.nextCalibrationDueDate,
        calibrationStatus: projected.calibrationStatus,
        lastVerificationDate: projected.lastVerificationDate,
        nextVerificationDueDate: projected.nextVerificationDueDate,
        verificationStatus: projected.verificationStatus,
        lastUpdatedBy: actorUsername
    };

    const updatedQual = await txOrPrisma.equipmentQualification.upsert({
        where: { equipmentId },
        create: {
            id: uuidv4(),
            equipmentId,
            labId: asset.labId,
            ...qualData
        },
        update: qualData
    });

    if (projected.shouldSetOutOfService && asset.status === 'IN_SERVICE') {
        await txOrPrisma.equipmentAsset.update({
            where: { id: equipmentId },
            data: { status: 'OUT_OF_SERVICE' }
        });
    }

    return {
        ...asset,
        status: projected.shouldSetOutOfService && asset.status === 'IN_SERVICE' ? 'OUT_OF_SERVICE' : asset.status,
        qualification: updatedQual,
        readiness: getReadiness({
            ...asset,
            status: projected.shouldSetOutOfService && asset.status === 'IN_SERVICE' ? 'OUT_OF_SERVICE' : asset.status,
            qualification: updatedQual
        })
    };
};

/**
 * Read-only diagnostic: audit equipment registry for discrepancies between events and qualifications.
 */
const generateMismatchReport = async (labId = null) => {
    const where = labId ? { labId } : {};
    const assets = await prisma.equipmentAsset.findMany({
        where,
        include: {
            qualification: true,
            scheduleRules: { where: { active: true } },
            events: { orderBy: { ts: 'desc' } }
        }
    });

    const mismatches = [];

    for (const asset of assets) {
        const projected = calculateQualification(asset, asset.events, asset.scheduleRules);
        const currentQ = asset.qualification;

        const calibDateMismatch = (projected.lastCalibrationDate?.toISOString() !== currentQ?.lastCalibrationDate?.toISOString());
        const calibStatusMismatch = (projected.calibrationStatus !== currentQ?.calibrationStatus);

        // Also check if any MAINTENANCE event mentions calibration in summary
        const mislabeledEvents = asset.events.filter(e =>
            e.eventType === 'MAINTENANCE' &&
            /calib/i.test(e.summary || '')
        );

        if (calibDateMismatch || calibStatusMismatch || mislabeledEvents.length > 0) {
            mismatches.push({
                equipmentId: asset.id,
                name: asset.name,
                internalAssetTag: asset.internalAssetTag,
                labId: asset.labId,
                current: {
                    status: asset.status,
                    lastCalibrationDate: currentQ?.lastCalibrationDate,
                    calibrationStatus: currentQ?.calibrationStatus
                },
                projected: {
                    lastCalibrationDate: projected.lastCalibrationDate,
                    calibrationStatus: projected.calibrationStatus
                },
                mislabeledEventsCount: mislabeledEvents.length,
                mislabeledEvents: mislabeledEvents.map(e => ({
                    id: e.id,
                    summary: e.summary,
                    outcome: e.outcome,
                    ts: e.ts
                }))
            });
        }
    }

    return {
        timestamp: new Date().toISOString(),
        totalAssetsChecked: assets.length,
        mismatchCount: mismatches.length,
        mismatches
    };
};

module.exports = {
    isCalibrationEvent,
    isVerificationEvent,
    parseEventDates,
    calculateQualification,
    getReadiness,
    recomputeAndPersist,
    generateMismatchReport
};
