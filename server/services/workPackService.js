'use strict';

const prisma = require('../prisma');
const scopeGuard = require('../utils/scopeGuard');
const { randomUUID } = require('crypto');

/**
 * SoilFER LIMS - Offline Work Pack Service
 * Generates bounded, scoped snapshots of assigned samples and method runs
 * for offline shifts under a 12-hour lease policy.
 */
class WorkPackService {
    /**
     * Prepare a work pack manifest and data bundle
     */
    static async preparePack(user, { deviceId, labId, methodCodes = [], sampleIds = [] }) {
        const effectiveLabId = user.role === 'SUPER_ADMIN' ? (labId || user.labId) : user.labId;

        if (user.role !== 'SUPER_ADMIN' && !effectiveLabId) {
            const err = new Error('Laboratory scope is required to prepare offline work pack');
            err.status = 403;
            throw err;
        }

        const packId = 'pack_' + Date.now() + '_' + (randomUUID ? randomUUID().substring(0, 8) : Math.random().toString(36).substring(2, 8));
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12-hour shift lease

        // Build sample query scoped to lab
        const sampleWhere = {
            ...(effectiveLabId ? {
                OR: [
                    { labId: effectiveLabId },
                    { assignedLab: effectiveLabId }
                ]
            } : {
                labId: { not: null }
            }),
            status: { in: ['ACCEPTED', 'PROCESSING', 'RECEIVED', 'ANALYSIS', 'PARTIALLY_COMPLETE'] }
        };

        if (sampleIds && sampleIds.length > 0) {
            sampleWhere.id = { in: sampleIds };
        }

        // Fetch scoped samples (bounded to maximum 200 for mobile pack size safety)
        const samples = await prisma.sample.findMany({
            where: sampleWhere,
            take: 200,
            orderBy: { createdAt: 'desc' }
        });

        const fetchedSampleIds = samples.map(s => s.id);

        // Fetch associated work items
        const itemWhere = {
            sampleId: { in: fetchedSampleIds }
        };
        if (methodCodes && methodCodes.length > 0) {
            itemWhere.analysis = { in: methodCodes };
        }
        if (user.role === 'LAB_TECHNICIAN') {
            itemWhere.OR = [
                { assignedTo: user.username },
                { assignedTo: null }
            ];
        }

        const workItems = await prisma.workItem.findMany({
            where: itemWhere,
            include: {
                sample: {
                    select: {
                        id: true,
                        originalId: true,
                        labId: true,
                        status: true,
                        dryingStatus: true,
                        preparationStatus: true
                    }
                }
            },
            take: 500
        });

        // Pack Manifest
        const manifest = {
            packId,
            deviceId,
            userId: user.id || user.username,
            labId: effectiveLabId,
            tokenVersion: user.tokenVersion !== undefined ? user.tokenVersion : 0,
            issuedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            leaseDurationHours: 12,
            sampleCount: samples.length,
            itemCount: workItems.length,
            supportedLocales: ['en', 'es', 'es-419', 'fr', 'pt'],
            schemaRevision: '1.4.0'
        };

        return {
            ...manifest,
            manifest,
            samples,
            workItems
        };
    }
}

module.exports = WorkPackService;
