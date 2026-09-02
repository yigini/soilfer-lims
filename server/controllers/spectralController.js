const prisma = require('../prisma');
const { validateSpectra } = require('../services/spectralValidation');
const crypto = require('crypto');
const { broadcastToLab } = require('../wsServer');
const scopeGuard = require('../utils/scopeGuard');

// Helper: Calculate Checksum
const calculateChecksum = (dataString) => {
    return crypto.createHash('sha256').update(dataString).digest('hex');
};

exports.getLibrary = async (req, res) => {
    try {
        const { status, modality, qcStatus, search, page, limit } = req.query;
        const user = req.user;

        // Build the query conditions
        let where = {};
        let andConditions = [];

        // Status filter: exclude DELETED by default, include when explicitly requested
        if (status) {
            andConditions.push({ status: status });
        } else {
            andConditions.push({ status: { not: 'DELETED' } });
        }

        // Add modality filter
        if (modality) {
            andConditions.push({ modality: modality.toUpperCase() });
        }

        // Add QC status filter
        if (qcStatus) {
            andConditions.push({ qcStatus: qcStatus });
        }

        // Add search filter
        if (search) {
            andConditions.push({
                OR: [
                    { sampleId: search },
                    { labId: search },
                    { filename: { contains: search } }
                ]
            });
        }

        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        // Apply Scope Guard for Lab Isolation
        where = scopeGuard.buildScopedWhere(user, where, { entityType: 'Spectral', labField: 'labId' });

        console.log('[getLibrary] Query:', JSON.stringify(where, null, 2));

        const total = await prisma.spectralData.count({ where });

        let findQuery = {
            where,
            orderBy: { timestamp: 'desc' },
            select: {
                id: true,
                sampleId: true,
                labId: true,
                modality: true,
                filename: true,
                scanIp: true,
                uploadedBy: true,
                timestamp: true,
                metadata: true,
                qcStatus: true,
                qcFlags: true,
                status: true,
                reviewedBy: true,
                reviewedAt: true,
                reviewNotes: true,
            }
        };

        let pageNum = null;
        let limitNum = null;
        let totalPages = 1;

        if (limit !== 'all') {
            pageNum = parseInt(page) || 1;
            limitNum = parseInt(limit) || 50;
            findQuery.skip = (pageNum - 1) * limitNum;
            findQuery.take = limitNum;
            totalPages = Math.ceil(total / limitNum) || 1;
        }

        // Return summary (exclude huge data arrays), ordered by most recent first
        const scans = await prisma.spectralData.findMany(findQuery);

        // Fetch sample labIds for display
        const sampleIds = [...new Set(scans.map(s => s.sampleId).filter(Boolean))];
        const samples = await prisma.sample.findMany({
            where: { id: { in: sampleIds } },
            select: { id: true, labId: true, originalId: true }
        });
        const sampleMap = new Map(samples.map(s => [s.id, s]));

        const summary = scans.map(s => {
            const sample = sampleMap.get(s.sampleId);
            return {
                ...s,
                // Use sample's labId for display, fallback to spectral record's labId
                labId: sample?.labId || sample?.originalId || s.labId || s.sampleId,
                metadata: parseJson(s.metadata),
                qcFlags: parseJson(s.qcFlags)
            };
        });

        res.json({
            success: true,
            count: summary.length,
            total,
            page: pageNum || 1,
            totalPages,
            data: summary
        });
    } catch (e) {
        console.error("Spectral Library Error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.getLibraryStats = async (req, res) => {
    try {
        const user = req.user;
        let baseWhere = { status: { not: 'DELETED' } };
        baseWhere = scopeGuard.buildScopedWhere(user, baseWhere, { entityType: 'Spectral', labField: 'labId' });

        const [total, nir, mir, pending, validated, approved, rejected] = await Promise.all([
            prisma.spectralData.count({ where: baseWhere }),
            prisma.spectralData.count({ where: { ...baseWhere, modality: 'NIR' } }),
            prisma.spectralData.count({ where: { ...baseWhere, modality: 'MIR' } }),
            prisma.spectralData.count({ where: { ...baseWhere, status: 'PENDING' } }),
            prisma.spectralData.count({ where: { ...baseWhere, status: 'VALIDATED' } }),
            prisma.spectralData.count({ where: { ...baseWhere, status: 'APPROVED' } }),
            prisma.spectralData.count({ where: { ...baseWhere, status: 'REJECTED' } })
        ]);

        res.json({
            success: true,
            data: { total, nir, mir, pending, validated, approved, rejected }
        });
    } catch (e) {
        console.error("Spectral Stats Error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.getScan = async (req, res) => {
    try {
        const user = req.user;
        const scan = await prisma.spectralData.findUnique({ where: { id: req.params.id } });
        if (!scan) return res.status(404).json({ error: 'Scan not found' });

        // Lab Isolation Check (Phase 1 - Scope Guard)
        if (!scopeGuard.canAccessEntity(user, scan, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Security Violation: Access denied to spectral data outside of your lab context.' });
        }

        const wavelengths = parseJson(scan.wavelengths);
        const values = parseJson(scan.values);

        // Safety Checks
        if (!Array.isArray(wavelengths) || !Array.isArray(values)) {
            console.error(`[ERROR] Corrupt Scan Data for ${req.params.id}: Missing arrays`);
            return res.status(500).json({ error: 'Corrupt spectral data' });
        }

        const meta = parseJson(scan.metadata) || {};
        const isDescending = wavelengths.length > 1 ? wavelengths[0] > wavelengths[wavelengths.length - 1] : false;
        const axisDirection = meta.axisDirection || (isDescending ? 'DESCENDING' : 'ASCENDING');
        const quantity = meta.quantity || (scan.modality === 'MIR' ? 'ABSORBANCE' : 'REFLECTANCE');
        const axisUnit = meta.axisUnit || (scan.modality === 'MIR' ? 'WAVENUMBER_CM1' : 'WAVELENGTH_NM');

        // Transform for UI Chart
        const chartData = wavelengths.map((w, i) => ({
            wavelength: w,
            absorbance: values ? values[i] : 0,
            value: values ? values[i] : 0
        }));

        res.json({
            ...scan,
            metadata: meta,
            qcFlags: parseJson(scan.qcFlags),
            wavelengths,
            values,
            chartData,
            axisDirection,
            quantity,
            axisUnit
        });
    } catch (e) {
        console.error("[ERROR] getScan failed:", e);
        res.status(500).json({ error: e.message });
    }
};

/**
 * Pre-upload check: verify which lab IDs match existing samples
 */
exports.checkMatches = async (req, res) => {
    try {
        const { labIds } = req.body;
        if (!labIds || !Array.isArray(labIds)) {
            return res.status(400).json({ error: 'labIds array required' });
        }

        // Helper: Normalize ID for loose matching
        const uniqueIds = [...new Set(labIds.map(id => id?.trim()).filter(Boolean))];
        const matched = [];
        const unmatched = [];

        const user = req.user; // Ensure you have authMiddleware in route

        // Build base scope (e.g. { labId: 'GTM-LAB1' })
        // We use 'labId' as the primary field for the sample.
        // We do NOT use altLabField here because we want to check OWNERSHIP or ASSIGNMENT.
        // Actually, samples have 'labId' (owner) and 'assignedLab' (current holder).
        // Let's use buildScopedWhere with our standard logic.
        // But wait, the query below uses OR for id/labId. 
        // We need to merge the scope into the query carefully.

        let where = {
            OR: [
                { labId: { in: uniqueIds } }, // removed mode: 'insensitive' (not supported with in)
                { id: { in: uniqueIds } }
            ]
        };

        // Apply Scope
        where = scopeGuard.buildScopedWhere(user, where, { labField: 'labId', altLabField: 'assignedLab' });

        // Bulk fetch all matching samples
        const existingSamples = await prisma.sample.findMany({
            where,
            select: { id: true, labId: true, originalId: true }
        });

        // Map for fast lookup (normalize keys to uppercase)
        const sampleMap = new Map();
        existingSamples.forEach(s => {
            if (s.labId) sampleMap.set(s.labId.toUpperCase(), s);
            if (s.id) sampleMap.set(s.id.toUpperCase(), s);
            if (s.originalId) sampleMap.set(s.originalId.toUpperCase(), s);
        });

        for (const labId of uniqueIds) {
            const normalizedId = labId.toUpperCase().trim();
            const sample = sampleMap.get(normalizedId);

            if (sample) {
                matched.push({ labId, sampleId: sample.id, sampleLabId: sample.labId });
            } else {
                unmatched.push(labId);
            }
        }

        res.json({
            success: true,
            total: uniqueIds.length,
            matchedCount: matched.length,
            unmatchedCount: unmatched.length,
            matched,
            unmatched
        });
    } catch (e) {
        console.error("Check Matches Error:", e);
        res.status(500).json({ error: e.message });
    }
};

/**
 * Handle Single or Multipary Upload
 */
exports.uploadBatch = async (req, res) => {
    try {
        const { batchId, scans, contextSampleId, autoApprove } = req.body;
        const user = req.user; // From auth middleware
        const canAutoApprove = autoApprove && user && ['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role);

        if (!scans || !Array.isArray(scans)) {
            return res.status(400).json({ error: 'Invalid payload: scans array required' });
        }

        // If we have a context sample ID (from sample details page), pre-fetch it
        let contextSample = null;
        if (contextSampleId) {
            contextSample = await prisma.sample.findUnique({ where: { id: contextSampleId } });
            console.log(`[SPECTRAL] Context sample: ${contextSample?.id} (labId=${contextSample?.labId}, originalId=${contextSample?.originalId})`);
        }

        const results = {
            success: 0,
            failed: 0,
            skipped: 0,  // Spectra skipped because no matching sample found
            skippedLabIds: [],
            errors: [],
            linkedToSample: null
        };

        // We process in loop to handle complex dependency logic per scan
        for (const scanItem of scans) {
            console.log(`[DEBUG] Processing Scan: Name=${scanItem.filename}, LabID=${scanItem.labId}, Modality=${scanItem.modality}`);

            // 1. Link to Sample
            // If we have a context sample (from sample details page), use it as the primary match
            // This ensures spectra uploaded from a sample page always link to that sample
            let sample = null;

            if (contextSample) {
                // Use context sample directly - user explicitly opened this sample's page
                sample = contextSample;
                console.log(`[SPECTRAL] Using context sample ${sample.id} (originalId=${sample.originalId}) for upload`);
            } else if (scanItem.labId) {
                const inputLabId = scanItem.labId.trim();
                const normalizedLabId = inputLabId.toUpperCase();

                // Primary lookup: Lab ID (exact match)
                sample = await prisma.sample.findFirst({
                    where: { labId: inputLabId }
                });

                // If not found, try by sample ID field (some samples use id = labId)
                if (!sample) {
                    sample = await prisma.sample.findUnique({ where: { id: inputLabId } });
                }

                // If still not found, try case-insensitive search
                if (!sample) {
                    const candidates = await prisma.sample.findMany({
                        take: 500
                    });
                    sample = candidates.find(s =>
                        s.labId?.toUpperCase() === normalizedLabId ||
                        s.id?.toUpperCase() === normalizedLabId ||
                        s.originalId?.toUpperCase() === normalizedLabId
                    );
                }
            }
            // Fallback: try internal sample ID (exact match from payload)
            if (!sample && scanItem.sampleId) {
                sample = await prisma.sample.findUnique({ where: { id: scanItem.sampleId } });
            }

            // --- RBAC ISOLATION CHECK ---
            // Allow upload if:
            // 1. User is SUPER_ADMIN
            // 2. User has no lab restriction (user.labId is null)
            // 3. Sample is unassigned (assignedLab is null) - user's lab can claim it
            // 4. Sample belongs to user's lab
            if (sample && user && user.role !== 'SUPER_ADMIN' && user.labId) {
                const sampleLab = sample.assignedLab || null;

                // If sample has an assigned lab and it's NOT the user's lab, deny
                if (sampleLab && sampleLab !== user.labId) {
                    console.warn(`[SECURITY] User ${user.username} tried to upload scan for Sample ${sample.labId} in Lab ${sampleLab}`);
                    results.failed++;
                    results.errors.push({ filename: scanItem.filename, error: `Permission Denied: Sample ${scanItem.labId} belongs to another laboratory.` });
                    continue;
                }

                // Auto-assign sample to user's lab if unassigned
                if (!sampleLab && user.labId) {
                    console.log(`[AUTO-ASSIGN] Assigning sample ${sample.labId} to lab ${user.labId}`);
                    await prisma.sample.update({
                        where: { id: sample.id },
                        data: { assignedLab: user.labId }
                    });
                }
            }

            // --- STRICT MATCH: Reject unmatched spectra ---
            // Only accept spectra that can be linked to an existing sample
            if (!sample) {
                console.log(`[SPECTRAL] No matching sample for LabID=${scanItem.labId}. Skipping upload.`);
                results.skipped++;
                if (scanItem.labId && !results.skippedLabIds.includes(scanItem.labId)) {
                    results.skippedLabIds.push(scanItem.labId);
                }
                results.errors.push({
                    filename: scanItem.filename,
                    error: `No matching sample found for Lab ID "${scanItem.labId || '(empty)'}". Spectrum was NOT uploaded.`
                });
                continue;
            }

            // 1.4 Validate Lab ID Match (only warn, don't block)
            if (sample && scanItem.labId && sample.labId && scanItem.labId.toUpperCase() !== sample.labId.toUpperCase()) {
                console.log(`[SPECTRAL] Lab ID mismatch: CSV has "${scanItem.labId}" but sample has "${sample.labId}". Proceeding with context sample.`);
                results.errors.push({
                    filename: scanItem.filename,
                    error: `Warning: CSV Lab ID "${scanItem.labId}" differs from sample Lab ID "${sample.labId}". Linked to sample anyway.`
                });
            }

            // 1.5 Count existing scans for versioning (multi-scan: no overwrite)
            let scanVersion = 1;
            if (sample) {
                const existingCount = await prisma.spectralData.count({
                    where: {
                        sampleId: sample.id,
                        modality: scanItem.modality || 'NIR',
                        status: { not: 'DELETED' }
                    }
                });
                scanVersion = existingCount + 1;
            }

            // 1.6 Native Axis Ingest & Direction Detection (SL-02)
            const wavelengths = scanItem.wavelengths;
            const values = scanItem.values;
            let increasing = true;
            let decreasing = true;
            for (let i = 1; i < wavelengths.length; i++) {
                if (wavelengths[i] <= wavelengths[i - 1]) increasing = false;
                if (wavelengths[i] >= wavelengths[i - 1]) decreasing = false;
            }
            const axisDirection = increasing ? 'ASCENDING' : (decreasing ? 'DESCENDING' : 'UNORDERED');

            // 2. Validate Data in native delivered order
            const validation = validateSpectra(wavelengths, values, scanItem.modality);

            // Determine workflow status based on QC and autoApprove
            let workflowStatus;
            if (validation.qcStatus === 'FAIL') {
                workflowStatus = 'PENDING';
            } else if (canAutoApprove) {
                workflowStatus = 'APPROVED';
            } else {
                workflowStatus = 'VALIDATED';
            }

            // 3. Create Record
            const newScan = await prisma.spectralData.create({
                data: {
                    id: `spec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    sampleId: sample ? sample.id : null,
                    labId: sample ? (sample.assignedLab || (user ? user.labId : null)) : (user ? user.labId : null),
                    modality: scanItem.modality || 'NIR',
                    filename: scanItem.filename,
                    wavelengths: JSON.stringify(wavelengths),
                    values: JSON.stringify(values),
                    metadata: JSON.stringify({
                        filename: scanItem.filename,
                        instrument: scanItem.instrument || 'Unknown',
                        operator: user ? user.username : 'system',
                        scanDate: scanItem.scanDate || new Date().toISOString(),
                        importBatchId: batchId,
                        scanVersion: scanVersion,
                        csvLabId: scanItem.labId,
                        linkedSampleId: sample ? sample.id : null,
                        autoApproved: canAutoApprove ? true : undefined,
                        axisDirection: axisDirection,
                        axisUnit: scanItem.axisUnit || (scanItem.modality === 'MIR' ? 'WAVENUMBER_CM1' : 'WAVELENGTH_NM'),
                        quantity: scanItem.quantity || (scanItem.modality === 'MIR' ? 'ABSORBANCE' : 'REFLECTANCE'),
                        sha256: calculateChecksum(JSON.stringify(wavelengths) + JSON.stringify(values))
                    }),
                    qcStatus: validation.qcStatus,
                    qcFlags: JSON.stringify(validation.flags),
                    status: workflowStatus,
                    uploadedBy: user ? user.id : null,
                    ...(canAutoApprove && validation.qcStatus !== 'FAIL' ? {
                        reviewedBy: user.id,
                        reviewedAt: new Date()
                    } : {})
                }
            });

            if (validation.qcStatus === 'FAIL') {
                results.success++;
                results.errors.push({
                    filename: scanItem.filename,
                    error: `Saved with QC Failure: ${validation.flags.join(', ')}. Requires manager review.`
                });
            } else {
                results.success++;
            }

            // (unmatched spectra are rejected earlier — this point is only reached for matched samples)

            // Track linked sample info for frontend display
            if (sample && !results.linkedToSample) {
                results.linkedToSample = {
                    id: sample.id,
                    labId: sample.labId,
                    originalId: sample.originalId
                };
            }

            await prisma.auditLog.create({
                data: {
                    id: `audit-spec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    entity: 'SPECTRA',
                    entityId: newScan.id,
                    action: canAutoApprove ? 'SPECTRA_AUTO_APPROVED' : 'SPECTRA_UPLOAD',
                    performedBy: user ? user.username : 'system',
                    timestamp: new Date(),
                    details: `Uploaded ${newScan.modality} scan${sample ? ` for Sample ${sample.labId}` : ` (CSV ID: ${scanItem.labId})`}. Status: ${workflowStatus}`
                }
            });

            // 6. Update WorkItem Status to COMPLETED
            if (sample && validation.qcStatus !== 'FAIL') {
                const sModality = (scanItem.modality || 'NIR').toUpperCase();

                const openWorkItems = await prisma.workItem.findMany({
                    where: {
                        sampleId: sample.id,
                        status: { notIn: ['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'] }
                    }
                });

                const relatedItem = openWorkItems.find(w => {
                    const wAnalysis = (w.analysis || '').toUpperCase();
                    if (sModality === 'NIR') {
                        return wAnalysis === 'SPEC_VIS_NIR' || wAnalysis === 'SPEC_NIR' ||
                            wAnalysis.includes('NIR') || wAnalysis.includes('VIS-NIR') || wAnalysis.includes('SPECTRA');
                    }
                    if (sModality === 'MIR') {
                        return wAnalysis === 'SPEC_MIR' || wAnalysis.includes('MIR');
                    }
                    return false;
                });

                if (relatedItem) {
                    const history = typeof relatedItem.history === 'string'
                        ? JSON.parse(relatedItem.history)
                        : (relatedItem.history || []);

                    history.push({
                        status: 'COMPLETED',
                        note: `Spectrum uploaded by ${user ? user.username : 'system'}. QC: ${validation.qcStatus}${canAutoApprove ? ' (Auto-Approved)' : ''}`,
                        changedBy: user ? user.username : 'system',
                        timestamp: new Date().toISOString()
                    });

                    await prisma.workItem.update({
                        where: { id: relatedItem.id },
                        data: {
                            status: 'COMPLETED',
                            result: `Spectrum Uploaded (${validation.qcStatus})${canAutoApprove ? ' - Auto-Approved' : ''}`,
                            completedAt: new Date(),
                            history: JSON.stringify(history)
                        }
                    });
                    // Broadcast work item change
                    broadcastToLab(user.labId,'WORKITEM_CHANGED', {
                        sampleId: sample.id,
                        workItemId: relatedItem.id,
                        status: 'COMPLETED',
                        source: 'spectral_upload'
                    });
                }
            }
        }

        const skippedMsg = results.skipped > 0
            ? ` ${results.skipped} skipped (no matching sample).`
            : '';

        // Broadcast spectral update for all affected samples
        if (results.success > 0) {
            broadcastToLab(user.labId,'SPECTRAL_UPDATE', { action: 'UPLOAD', count: results.success });
        }

        res.json({
            message: `Batch processing complete: ${results.success} uploaded, ${results.failed} failed.${skippedMsg}`,
            results
        });

    } catch (e) {
        console.error("Upload Error:", e);
        res.status(500).json({ error: e.message });
    }
};

// Batch review — approve/reject multiple spectra at once
exports.batchReview = async (req, res) => {
    try {
        const { ids, action } = req.body; // ids: string[], action: 'APPROVE' | 'REJECT'
        const user = req.user;

        if (!['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role)) {
            return res.status(403).json({ error: 'Only managers can batch review spectra.' });
        }
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No spectrum IDs provided.' });
        }
        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ error: 'Action must be APPROVE or REJECT.' });
        }

        const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        const results = { succeeded: 0, failed: 0, errors: [] };

        for (const id of ids) {
            try {
                const scan = await prisma.spectralData.findUnique({ where: { id } });
                if (!scan) { results.failed++; results.errors.push({ id, error: 'Not found' }); continue; }
                if (!['PENDING', 'VALIDATED'].includes(scan.status)) { results.failed++; results.errors.push({ id, error: `Cannot review in ${scan.status} status` }); continue; }

                await prisma.spectralData.update({
                    where: { id },
                    data: { status: newStatus, reviewedBy: user.username, reviewedAt: new Date(), reviewNotes: `Batch ${action.toLowerCase()}d` }
                });

                // If approved, complete the work item
                if (newStatus === 'APPROVED' && scan.sampleId) {
                    const sModality = (scan.modality || 'NIR').toUpperCase();
                    const workItems = await prisma.workItem.findMany({
                        where: { sampleId: scan.sampleId, status: { notIn: ['COMPLETED', 'ACCEPTED', 'SUBMITTED'] } }
                    });
                    const relatedItem = workItems.find(w => {
                        const wA = (w.analysis || '').toUpperCase();
                        if (sModality === 'NIR') return wA.includes('NIR');
                        if (sModality === 'MIR') return wA.includes('MIR');
                        return false;
                    });
                    if (relatedItem) {
                        const history = typeof relatedItem.history === 'string' ? JSON.parse(relatedItem.history) : (relatedItem.history || []);
                        history.push({ status: 'COMPLETED', note: `Spectrum batch-approved by ${user.username}`, changedBy: user.username, timestamp: new Date().toISOString() });
                        await prisma.workItem.update({ where: { id: relatedItem.id }, data: { status: 'COMPLETED', result: `Spectrum Approved (${scan.qcStatus})`, completedAt: new Date(), history: JSON.stringify(history) } });
                        broadcastToLab(user.labId,'WORKITEM_CHANGED', { sampleId: scan.sampleId, workItemId: relatedItem.id, status: 'COMPLETED', source: 'spectral_batch_review' });
                    }
                }

                results.succeeded++;
            } catch (err) {
                results.failed++;
                results.errors.push({ id, error: err.message });
            }
        }

        // Single audit log for the batch
        await prisma.auditLog.create({
            data: {
                id: `audit-spec-batch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                entity: 'SPECTRA', entityId: ids.join(',').substring(0, 200), action: `SPECTRA_BATCH_${action}`,
                performedBy: user.username, timestamp: new Date(),
                details: `Batch ${action.toLowerCase()}: ${results.succeeded} succeeded, ${results.failed} failed out of ${ids.length} spectra.`
            }
        });

        broadcastToLab(user.labId,'SPECTRAL_UPDATE', { action: `BATCH_${action}`, count: results.succeeded });
        res.json({ success: true, message: `Batch ${action.toLowerCase()} complete: ${results.succeeded}/${ids.length} succeeded.`, results });
    } catch (e) {
        console.error("Batch Review Error:", e);
        res.status(500).json({ error: e.message });
    }
};

// Batch delete — move multiple spectra to trash at once
exports.batchDelete = async (req, res) => {
    try {
        const { ids } = req.body;
        const user = req.user;

        if (!['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role)) {
            return res.status(403).json({ error: 'Only managers can batch delete spectra.' });
        }
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No spectrum IDs provided.' });
        }

        const results = { succeeded: 0, failed: 0, errors: [] };

        for (const id of ids) {
            try {
                const scan = await prisma.spectralData.findUnique({ where: { id } });
                if (!scan) { results.failed++; results.errors.push({ id, error: 'Not found' }); continue; }
                if (scan.status === 'DELETED') { results.failed++; results.errors.push({ id, error: 'Already in trash' }); continue; }

                const previousStatus = scan.status;
                const meta = parseJson(scan.metadata) || {};
                meta._deletedPreviousStatus = previousStatus;
                meta._deletedBy = user.username;
                meta._deletedAt = new Date().toISOString();

                await prisma.spectralData.update({
                    where: { id },
                    data: { status: 'DELETED', metadata: JSON.stringify(meta) }
                });

                // Revert work item if it was COMPLETED
                if (scan.sampleId) {
                    const sModality = (scan.modality || 'NIR').toUpperCase();
                    const workItems = await prisma.workItem.findMany({
                        where: { sampleId: scan.sampleId, status: 'COMPLETED' }
                    });
                    const relatedItem = workItems.find(w => {
                        const wA = (w.analysis || '').toUpperCase();
                        if (sModality === 'NIR') return wA.includes('NIR');
                        if (sModality === 'MIR') return wA.includes('MIR');
                        return false;
                    });
                    if (relatedItem) {
                        const history = typeof relatedItem.history === 'string' ? JSON.parse(relatedItem.history) : (relatedItem.history || []);
                        history.push({ status: 'IN_PROGRESS', note: `Spectrum batch-trashed by ${user.username}. Task reverted.`, changedBy: user.username, timestamp: new Date().toISOString() });
                        await prisma.workItem.update({ where: { id: relatedItem.id }, data: { status: 'IN_PROGRESS', result: null, completedAt: null, history: JSON.stringify(history) } });
                        broadcastToLab(user.labId,'WORKITEM_CHANGED', { sampleId: scan.sampleId, workItemId: relatedItem.id, status: 'IN_PROGRESS', source: 'spectral_batch_trash' });
                    }
                }

                results.succeeded++;
            } catch (err) {
                results.failed++;
                results.errors.push({ id, error: err.message });
            }
        }

        await prisma.auditLog.create({
            data: {
                id: `audit-spec-batchdel-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                entity: 'SPECTRA', entityId: ids.join(',').substring(0, 200), action: 'SPECTRA_BATCH_TRASH',
                performedBy: user.username, timestamp: new Date(),
                details: `Batch trash: ${results.succeeded} moved to trash, ${results.failed} failed out of ${ids.length} spectra.`
            }
        });

        broadcastToLab(user.labId,'SPECTRAL_UPDATE', { action: 'BATCH_TRASH', count: results.succeeded });
        res.json({ success: true, message: `${results.succeeded}/${ids.length} spectra moved to trash.`, results });
    } catch (e) {
        console.error("Batch Delete Error:", e);
        res.status(500).json({ error: e.message });
    }
};

// Soft delete — moves spectrum to trash (status: DELETED)
exports.deleteScan = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const scan = await prisma.spectralData.findUnique({ where: { id } });
        if (!scan) return res.status(404).json({ error: 'Scan not found' });

        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const isLabManager = user.role === 'LAB_MANAGER' && user.labId === scan.labId;
        if (!isSuperAdmin && !isLabManager) {
            return res.status(403).json({ error: 'Permission Denied: Only Admins or Lab Managers can delete spectral records.' });
        }

        if (scan.status === 'DELETED') {
            return res.status(400).json({ error: 'Spectrum is already in trash.' });
        }

        const previousStatus = scan.status;
        const meta = parseJson(scan.metadata) || {};
        meta._deletedPreviousStatus = previousStatus;
        meta._deletedBy = user.username;
        meta._deletedAt = new Date().toISOString();

        // Soft delete: set status to DELETED
        await prisma.spectralData.update({
            where: { id },
            data: {
                status: 'DELETED',
                metadata: JSON.stringify(meta)
            }
        });

        // Revert work item if it was COMPLETED
        if (scan.sampleId) {
            const sModality = (scan.modality || 'NIR').toUpperCase();
            const workItems = await prisma.workItem.findMany({
                where: { sampleId: scan.sampleId, status: 'COMPLETED' }
            });
            const relatedItem = workItems.find(w => {
                const wAnalysis = (w.analysis || '').toUpperCase();
                if (sModality === 'NIR') return wAnalysis.includes('NIR');
                if (sModality === 'MIR') return wAnalysis.includes('MIR');
                return false;
            });
            if (relatedItem) {
                const history = typeof relatedItem.history === 'string' ? JSON.parse(relatedItem.history) : (relatedItem.history || []);
                history.push({ status: 'IN_PROGRESS', note: `Spectrum moved to trash by ${user.username}. Task reverted.`, changedBy: user.username, timestamp: new Date().toISOString() });
                await prisma.workItem.update({ where: { id: relatedItem.id }, data: { status: 'IN_PROGRESS', result: null, completedAt: null, history: JSON.stringify(history) } });
                broadcastToLab(user.labId,'WORKITEM_CHANGED', { sampleId: scan.sampleId, workItemId: relatedItem.id, status: 'IN_PROGRESS', source: 'spectral_trash' });
            }
        }

        await prisma.auditLog.create({
            data: {
                id: `audit-spec-del-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                entity: 'SPECTRA', entityId: id, action: 'SPECTRA_TRASH',
                performedBy: user.username, timestamp: new Date(), labId: scan.labId,
                details: `Moved ${scan.modality} spectrum to trash (was ${previousStatus}). Sample: ${scan.sampleId || 'unlinked'}`
            }
        });

        broadcastToLab(user.labId,'SPECTRAL_UPDATE', { sampleId: scan.sampleId, action: 'TRASH' });
        res.json({ success: true, message: 'Spectrum moved to trash.' });
    } catch (e) {
        console.error("Delete Scan Error:", e);
        res.status(500).json({ error: e.message });
    }
};

// Restore a trashed spectrum back to its previous status
exports.restoreScan = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role)) {
            return res.status(403).json({ error: 'Only managers can restore spectra.' });
        }

        const scan = await prisma.spectralData.findUnique({ where: { id } });
        if (!scan) return res.status(404).json({ error: 'Scan not found' });
        if (scan.status !== 'DELETED') return res.status(400).json({ error: 'Scan is not in trash.' });

        const meta = parseJson(scan.metadata) || {};
        const restoreTo = meta._deletedPreviousStatus || 'VALIDATED';
        delete meta._deletedPreviousStatus;
        delete meta._deletedBy;
        delete meta._deletedAt;

        await prisma.spectralData.update({
            where: { id },
            data: { status: restoreTo, metadata: JSON.stringify(meta) }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-spec-restore-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                entity: 'SPECTRA', entityId: id, action: 'SPECTRA_RESTORED',
                performedBy: user.username, timestamp: new Date(), labId: scan.labId,
                details: `Restored ${scan.modality} spectrum from trash to ${restoreTo}.`
            }
        });

        broadcastToLab(user.labId,'SPECTRAL_UPDATE', { sampleId: scan.sampleId, action: 'RESTORE' });
        res.json({ success: true, message: `Spectrum restored to ${restoreTo}.` });
    } catch (e) {
        console.error("Restore Scan Error:", e);
        res.status(500).json({ error: e.message });
    }
};

// Permanently delete a spectrum (only from trash)
exports.permanentlyDeleteScan = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role)) {
            return res.status(403).json({ error: 'Only managers can permanently delete spectra.' });
        }

        const scan = await prisma.spectralData.findUnique({ where: { id } });
        if (!scan) return res.status(404).json({ error: 'Scan not found' });
        if (scan.status !== 'DELETED') return res.status(400).json({ error: 'Only trashed spectra can be permanently deleted. Move to trash first.' });

        await prisma.spectralData.delete({ where: { id } });

        await prisma.auditLog.create({
            data: {
                id: `audit-spec-permdel-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                entity: 'SPECTRA', entityId: id, action: 'SPECTRA_PERMANENT_DELETE',
                performedBy: user.username, timestamp: new Date(), labId: scan.labId,
                details: `Permanently deleted ${scan.modality} spectrum. Sample: ${scan.sampleId || 'unlinked'}`
            }
        });

        res.json({ success: true, message: 'Spectrum permanently deleted.' });
    } catch (e) {
        console.error("Permanent Delete Error:", e);
        res.status(500).json({ error: e.message });
    }
};

/**
 * Manager review endpoint - approve or reject pending spectra
 */
exports.reviewSpectrum = async (req, res) => {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'APPROVE' or 'REJECT'
    const user = req.user;

    try {
        // 1. Authorization - only managers
        if (!['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role)) {
            return res.status(403).json({ error: 'Only Lab Managers can review spectral data.' });
        }

        const scan = await prisma.spectralData.findUnique({ where: { id } });
        if (!scan) return res.status(404).json({ error: 'Spectrum not found' });

        // 2. Check status — allow undo for REJECTED spectra
        if (action === 'UNDO') {
            if (scan.status !== 'REJECTED') {
                return res.status(400).json({ error: 'Can only undo rejection on REJECTED spectra.' });
            }
            await prisma.spectralData.update({
                where: { id },
                data: { status: 'VALIDATED', reviewedBy: null, reviewedAt: null, reviewNotes: null }
            });
            await prisma.auditLog.create({
                data: {
                    id: `audit-spec-undo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    entity: 'SPECTRA', entityId: id, action: 'SPECTRA_UNDO_REJECT',
                    performedBy: user.username, timestamp: new Date(), sampleId: scan.sampleId,
                    details: `Undid rejection of ${scan.modality} spectrum. Returned to VALIDATED.`
                }
            });
            return res.json({ success: true, message: 'Rejection undone. Spectrum returned to Awaiting Review.', status: 'VALIDATED' });
        }

        if (!['PENDING', 'VALIDATED'].includes(scan.status)) {
            return res.status(400).json({ error: `Cannot review spectrum in ${scan.status} status.` });
        }

        const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

        // 3. Update spectrum
        await prisma.spectralData.update({
            where: { id },
            data: {
                status: newStatus,
                reviewedBy: user.username,
                reviewedAt: new Date(),
                reviewNotes: notes || null
            }
        });

        // 4. If approved, complete the work item
        if (newStatus === 'APPROVED') {
            const sModality = (scan.modality || 'NIR').toUpperCase();
            const workItems = await prisma.workItem.findMany({
                where: {
                    sampleId: scan.sampleId,
                    status: { notIn: ['COMPLETED', 'ACCEPTED', 'SUBMITTED'] }
                }
            });

            const relatedItem = workItems.find(w => {
                const wAnalysis = (w.analysis || '').toUpperCase();
                if (sModality === 'NIR') {
                    return wAnalysis === 'SPEC_VIS_NIR' || wAnalysis === 'SPEC_NIR' || wAnalysis.includes('NIR');
                }
                if (sModality === 'MIR') {
                    return wAnalysis === 'SPEC_MIR' || wAnalysis.includes('MIR');
                }
                return false;
            });

            if (relatedItem) {
                const history = typeof relatedItem.history === 'string'
                    ? JSON.parse(relatedItem.history)
                    : (relatedItem.history || []);

                history.push({
                    status: 'COMPLETED',
                    note: `Spectrum approved by ${user.username}. QC: ${scan.qcStatus}`,
                    changedBy: user.username,
                    timestamp: new Date().toISOString()
                });

                await prisma.workItem.update({
                    where: { id: relatedItem.id },
                    data: {
                        status: 'COMPLETED',
                        result: `Spectrum Approved (${scan.qcStatus})`,
                        completedAt: new Date(),
                        history: JSON.stringify(history)
                    }
                });
                broadcastToLab(user.labId,'WORKITEM_CHANGED', { sampleId: scan.sampleId, workItemId: relatedItem.id, status: 'COMPLETED', source: 'spectral_review_approve' });
            }
        }

        // 5. Audit log
        await prisma.auditLog.create({
            data: {
                id: `audit-spec-review-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                entity: 'SPECTRA',
                entityId: id,
                action: newStatus === 'APPROVED' ? 'SPECTRA_APPROVED' : 'SPECTRA_REJECTED',
                performedBy: user.username,
                timestamp: new Date(),
                sampleId: scan.sampleId,
                details: `${scan.modality} spectrum ${newStatus.toLowerCase()} by manager. ${notes || ''}`
            }
        });

        broadcastToLab(user.labId,'SPECTRAL_UPDATE', { sampleId: scan.sampleId, action: newStatus });
        res.json({ success: true, message: `Spectrum ${newStatus.toLowerCase()}.`, status: newStatus });

    } catch (e) {
        console.error("Review Spectrum Error:", e);
        res.status(500).json({ error: e.message });
    }
};

const parseJson = (str) => {
    try { return str ? JSON.parse(str) : null; } catch (e) { return null; }
};
