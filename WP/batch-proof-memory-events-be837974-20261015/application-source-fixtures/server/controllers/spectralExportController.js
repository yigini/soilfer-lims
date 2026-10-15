const prisma = require('../prisma');

/**
 * Bulk Spectral Export Controller (SL-25)
 * Exports approved spectral scans with acquisition metadata and reference chemistry.
 */
exports.exportSpectra = async (req, res) => {
    try {
        const { modality, qcStatus } = req.query;

        const where = {
            status: { in: ['APPROVED', 'VALIDATED'] },
            isCurrent: true
        };

        if (modality) where.modality = modality.toUpperCase();
        if (qcStatus && qcStatus !== '*') where.qcStatus = qcStatus.toUpperCase();

        // Scope by API key permissions (SL-22)
        const keyLabs = req.sisAuth?.labs;
        const isGlobalLab = Array.isArray(keyLabs) && keyLabs.includes('*');

        if (!isGlobalLab) {
            if (!Array.isArray(keyLabs) || keyLabs.length === 0) {
                return res.status(403).json({ error: 'Access denied: API key lacks laboratory scope.' });
            }
            where.labId = { in: keyLabs };
        }

        const keyCountries = req.sisAuth?.countries || [];
        const hasGlobalCountry = keyCountries.length === 0 || keyCountries.includes('*');
        if (!hasGlobalCountry) {
            const scopedSamples = await prisma.sample.findMany({
                where: { country: { in: keyCountries } },
                select: { id: true, labId: true, originalId: true }
            });
            const allowedIds = [];
            scopedSamples.forEach(s => {
                if (s.id) allowedIds.push(s.id);
                if (s.labId) allowedIds.push(s.labId);
                if (s.originalId) allowedIds.push(s.originalId);
            });
            where.sampleId = { in: allowedIds };
        }

        const records = await prisma.spectralData.findMany({
            where,
            orderBy: { timestamp: 'asc' },
            include: {
                equipment: {
                    select: { id: true, name: true, model: true, manufacturer: true }
                }
            }
        });

        // Fetch paired reference chemistry for all samples
        const sampleIds = [...new Set(records.map(r => r.sampleId).filter(Boolean))];
        const refResults = sampleIds.length > 0 ? await prisma.result.findMany({
            where: {
                sampleId: { in: sampleIds },
                isCurrent: true,
                provenance: 'MEASURED'
            },
            select: {
                id: true,
                sampleId: true,
                param: true,
                value: true,
                numericValue: true,
                unit: true,
                methodologyId: true,
                basis: true,
                provenance: true
            }
        }) : [];

        const refMap = {};
        for (const rf of refResults) {
            if (!refMap[rf.sampleId]) refMap[rf.sampleId] = [];
            const val = rf.numericValue !== null && rf.numericValue !== undefined ? rf.numericValue : (parseFloat(rf.value) || rf.value);
            refMap[rf.sampleId].push({
                param: rf.param,
                value: val,
                unit: rf.unit,
                method: rf.methodologyId,
                basis: rf.basis || 'AIR_DRY',
                provenance: rf.provenance || 'MEASURED',
                resultId: rf.id
            });
        }

        const exportDataset = records.map(r => ({
            id: r.id,
            sha256: r.sha256,
            sampleId: r.sampleId,
            labId: r.labId,
            signal: {
                quantity: r.quantity,
                axisUnit: r.axisUnit,
                axisDirection: r.axisDirection,
                isRaw: r.isRaw
            },
            acquisition: {
                equipmentId: r.equipmentId,
                model: r.equipment ? (r.equipment.model || r.equipment.name) : null,
                accessory: r.accessory,
                resolution: r.resolution,
                coAddedScans: r.coAddedScans,
                background: r.backgroundRef,
                backgroundRef: r.backgroundRef,
                backgroundAt: r.backgroundAt,
                scannedAt: r.timestamp
            },
            preparation: {
                preparation: r.preparation,
                moistureState: r.moistureState,
                windowMaterial: r.windowMaterial,
                replicateNo: r.replicateNo
            },
            qc: {
                status: r.qcStatus,
                flags: r.qcFlags ? JSON.parse(r.qcFlags) : [],
                approvedAt: r.reviewedAt
            },
            reference: refMap[r.sampleId] || [],
            axis: r.wavelengths ? JSON.parse(r.wavelengths) : [],
            values: r.values ? JSON.parse(r.values) : []
        }));

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="spectral_export_${Date.now()}.json"`);
        res.json({
            meta: {
                schema: 'spectra/v1-bulk-export',
                exportedAt: new Date().toISOString(),
                totalScans: exportDataset.length
            },
            data: exportDataset
        });
    } catch (err) {
        console.error('[SPECTRAL_EXPORT_ERR]', err);
        res.status(500).json({ error: 'Bulk export failed: ' + err.message });
    }
};
