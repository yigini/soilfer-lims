const prisma = require('../prisma');
const { validateSpectra, evaluateReplicateAgreement } = require('../services/spectralValidation');
const { parseSpectralFile } = require('../services/spectralParser');
const { screenScanAgainstLibrary } = require('../services/spectralOutlier');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { broadcastToLab } = require('../wsServer');
const scopeGuard = require('../utils/scopeGuard');

const UPLOADS_SPECTRA_DIR = path.join(__dirname, '..', 'uploads', 'spectra');
if (!fs.existsSync(UPLOADS_SPECTRA_DIR)) {
    try { fs.mkdirSync(UPLOADS_SPECTRA_DIR, { recursive: true }); } catch (e) {}
}

const UPLOADS_STAGING_DIR = path.join(__dirname, '..', 'uploads', 'staging');
if (!fs.existsSync(UPLOADS_STAGING_DIR)) {
    try { fs.mkdirSync(UPLOADS_STAGING_DIR, { recursive: true }); } catch (e) {}
}

const idempotencyReceipts = new Map();

const parseJson = (str) => {
    if (!str) return null;
    try { return JSON.parse(str); } catch (e) { return null; }
};

// Helper: Calculate Checksum
const calculateChecksum = (dataString) => {
    return crypto.createHash('sha256').update(dataString).digest('hex');
};

exports.getLibrary = async (req, res) => {
    try {
        const { status, modality, qcStatus, search, sampleId, page, limit, includeSuperseded } = req.query;
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

        // SL-12: Filter to current non-superseded scans by default
        if (includeSuperseded !== 'true') {
            andConditions.push({ isCurrent: true });
        }

        // Add modality filter
        if (modality) {
            andConditions.push({ modality: modality.toUpperCase() });
        }

        // Add QC status filter
        if (qcStatus) {
            andConditions.push({ qcStatus: qcStatus });
        }

        // Direct sampleId filter (handles sample UUID, labId, or originalId)
        if (sampleId) {
            const matchedSamples = await prisma.sample.findMany({
                where: {
                    OR: [
                        { id: sampleId },
                        { labId: sampleId },
                        { originalId: sampleId }
                    ]
                },
                select: { id: true }
            });
            const sIds = matchedSamples.map(s => s.id);
            if (!sIds.includes(sampleId)) sIds.push(sampleId);
            andConditions.push({ sampleId: { in: sIds } });
        }

        // Add search filter (resolves sample labId / originalId to sampleId, in addition to direct field matches)
        if (search) {
            const searchTrimmed = String(search).trim();
            const searchUpper = searchTrimmed.toUpperCase();
            const searchLower = searchTrimmed.toLowerCase();
            const matchedSamples = await prisma.sample.findMany({
                where: {
                    OR: [
                        { id: searchTrimmed },
                        { labId: searchTrimmed },
                        { labId: searchUpper },
                        { labId: searchLower },
                        { labId: { contains: searchTrimmed } },
                        { originalId: searchTrimmed },
                        { originalId: searchUpper },
                        { originalId: searchLower },
                        { originalId: { contains: searchTrimmed } }
                    ]
                },
                select: { id: true }
            });
            const matchedSampleIds = matchedSamples.map(s => s.id);

            const searchConditions = [
                { sampleId: searchTrimmed },
                { labId: searchTrimmed },
                { filename: { contains: searchTrimmed } }
            ];
            if (matchedSampleIds.length > 0) {
                searchConditions.push({ sampleId: { in: matchedSampleIds } });
            }
            andConditions.push({ OR: searchConditions });
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
                sourceFile: true,
                sourceFormat: true,
                sha256: true,
                quantity: true,
                axisUnit: true,
                axisDirection: true,
                region: true,
                isRaw: true,
                equipmentId: true,
                resolution: true,
                coAddedScans: true,
                accessory: true,
                backgroundRef: true,
                detector: true,
                beamsplitter: true,
                preparation: true,
                moistureState: true,
                windowMaterial: true,
                replicateNo: true,
                isCurrent: true,
                supersedes: true,
                supersededBy: true
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
        const axisDirection = scan.axisDirection || meta.axisDirection || (isDescending ? 'DESCENDING' : 'ASCENDING');
        const quantity = scan.quantity || meta.quantity || 'UNVERIFIED';
        const axisUnit = scan.axisUnit || meta.axisUnit || (scan.modality === 'MIR' ? 'WAVENUMBER_CM1' : 'WAVELENGTH_NM');

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
 * Staged Ingestion Preview (Amendment 5)
 * POST /api/spectral/preview
 * Parses uploaded files into temporary staging, runs QC, checks sample/work item matching,
 * identifies duplicate scans, and returns an immutable StagedManifest with TTL.
 */
exports.previewBatch = async (req, res) => {
    try {
        const user = req.user;
        const { contextSampleId, targetWorkItemId, modality, targetModality, equipmentId } = req.body || {};
        const effectiveModality = (modality || targetModality || '').toUpperCase();

        let files = [];
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            files = req.files;
        } else if (req.body && req.body.scans) {
            let parsedScans = req.body.scans;
            if (typeof parsedScans === 'string') {
                try { parsedScans = JSON.parse(parsedScans); } catch (e) { parsedScans = []; }
            }
            if (Array.isArray(parsedScans) && parsedScans.length > 0) {
                files = parsedScans.map((s, idx) => {
                    const lines = ['wavelength,value'];
                    const w = s.wavelengths || [];
                    const v = s.values || [];
                    for (let i = 0; i < w.length; i++) {
                        lines.push(`${w[i]},${v[i] !== undefined ? v[i] : ''}`);
                    }
                    return {
                        originalname: s.filename || `scan_${idx}.csv`,
                        buffer: Buffer.from(lines.join('\n'), 'utf8'),
                        providedLabId: s.labId,
                        providedSampleId: s.sampleId,
                        providedModality: s.modality
                    };
                });
            }
        }

        if (files.length === 0) {
            return res.status(400).json({ error: 'NO_FILES_PROVIDED', message: 'No spectral files or scans provided for preview.' });
        }

        const manifestId = `manif-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const manifestDir = path.join(UPLOADS_STAGING_DIR, manifestId);
        fs.mkdirSync(manifestDir, { recursive: true });

        // Pre-fetch context sample and work item if provided
        let contextSample = null;
        if (contextSampleId) {
            contextSample = await prisma.sample.findUnique({
                where: { id: contextSampleId },
                include: { workItems: true }
            });
        }

        let contextWorkItem = null;
        if (targetWorkItemId) {
            contextWorkItem = await prisma.workItem.findUnique({
                where: { id: targetWorkItemId },
                include: { sample: true }
            });
            if (contextWorkItem && !contextSample) {
                contextSample = contextWorkItem.sample;
            }
        }

        // Pre-fetch equipment limits if equipmentId given
        let equipmentLimits = null;
        if (equipmentId) {
            const eqAsset = await prisma.equipmentAsset.findUnique({
                where: { id: equipmentId },
                select: { id: true, status: true, qcLimits: true }
            });
            if (eqAsset && eqAsset.qcLimits) {
                try { equipmentLimits = JSON.parse(eqAsset.qcLimits); } catch (e) {}
            }
        }

        const items = [];
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const buffer = f.buffer;
            const originalname = f.originalname;
            const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
            const safeName = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const stagedFilename = `${sha256Hash}_${safeName}`;
            const stagedPath = path.join(manifestDir, stagedFilename);
            fs.writeFileSync(stagedPath, buffer);

            let parsed;
            let parseError = null;
            try {
                parsed = parseSpectralFile(buffer, originalname, {
                    targetModality: effectiveModality || f.providedModality
                });
            } catch (pErr) {
                parseError = pErr.message;
            }

            if (parseError) {
                items.push({
                    id: `item-${i}`,
                    filename: originalname,
                    stagedFilename,
                    sha256: sha256Hash,
                    parseError,
                    qcStatus: 'FAIL',
                    qcFlags: ['PARSE_ERROR'],
                    suggestedAction: 'SKIP'
                });
                continue;
            }

            // Spectroscopist-Grade QC
            const validation = validateSpectra(parsed.wavelengths, parsed.values, parsed.modality || effectiveModality, {
                quantity: parsed.quantity,
                resolution: parsed.resolution,
                equipmentLimits
            });

            // Match Sample
            let matchedSample = null;
            if (contextSample) {
                matchedSample = contextSample;
            } else {
                const ext = path.extname(originalname);
                const baseName = path.basename(originalname, ext);
                const candidateId = f.providedLabId || f.providedSampleId || baseName;

                const userLabScope = user && user.role !== 'SUPER_ADMIN' && user.labId
                    ? { OR: [{ assignedLab: user.labId }, { labId: user.labId }] }
                    : {};

                matchedSample = await prisma.sample.findFirst({
                    where: {
                        AND: [
                            {
                                OR: [
                                    { labId: candidateId },
                                    { originalId: candidateId },
                                    { id: candidateId }
                                ]
                            },
                            userLabScope
                        ]
                    },
                    include: { workItems: true }
                });
            }

            // Match WorkItem
            let matchedWorkItem = null;
            if (contextWorkItem) {
                matchedWorkItem = contextWorkItem;
            } else if (matchedSample && matchedSample.workItems) {
                const mMod = (parsed.modality || effectiveModality || 'NIR').toUpperCase();
                const spectralItems = matchedSample.workItems.filter(w =>
                    !['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'].includes(w.status)
                );
                matchedWorkItem = spectralItems.find(w => {
                    const wa = (w.analysis || '').toUpperCase();
                    if (mMod === 'MIR') return wa === 'SPEC_MIR' || wa === 'SPEC_FTIR' || wa.includes('MIR') || wa.includes('FTIR');
                    if (mMod === 'NIR') return wa === 'SPEC_VIS_NIR' || wa === 'SPEC_NIR' || wa.includes('NIR') || wa.includes('VIS-NIR');
                    return false;
                }) || null;
            }

            // Check duplicates
            const effectiveLabId = matchedSample?.assignedLab || matchedSample?.labId || user?.labId;
            const duplicateByHash = await prisma.spectralData.findFirst({
                where: {
                    labId: effectiveLabId,
                    sha256: sha256Hash,
                    status: { not: 'DELETED' }
                }
            });

            let duplicateByReplicate = null;
            if (matchedSample) {
                duplicateByReplicate = await prisma.spectralData.findFirst({
                    where: {
                        sampleId: matchedSample.id,
                        modality: parsed.modality,
                        replicateNo: 1,
                        isCurrent: true,
                        status: { not: 'DELETED' }
                    }
                });
            }

            let suggestedAction = 'PROCEED';
            let duplicateReason = null;
            let duplicateScanId = null;

            if (duplicateByHash) {
                suggestedAction = 'SKIP';
                duplicateReason = `Identical content hash already exists (Scan: ${duplicateByHash.id})`;
                duplicateScanId = duplicateByHash.id;
            } else if (duplicateByReplicate) {
                suggestedAction = 'REPLACE';
                duplicateReason = `Replicate 1 already exists for this sample (Scan: ${duplicateByReplicate.id})`;
                duplicateScanId = duplicateByReplicate.id;
            }

            // Operational prerequisites check
            let operationalBlocked = false;
            let operationalReason = null;
            if (matchedSample && matchedSample.workItems) {
                const drying = matchedSample.workItems.find(w => w.analysis === 'DRYING');
                const prep = matchedSample.workItems.find(w => w.analysis === 'PREPARATION');
                const isDone = g => g && ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(g.status);
                if (drying && !isDone(drying)) {
                    operationalBlocked = true;
                    operationalReason = 'Drying prerequisite pending';
                } else if (prep && !isDone(prep)) {
                    operationalBlocked = true;
                    operationalReason = 'Preparation prerequisite pending';
                }
            }

            items.push({
                id: `item-${i}`,
                filename: originalname,
                stagedFilename,
                sha256: sha256Hash,
                format: parsed.format,
                instrument: parsed.instrument,
                resolution: parsed.resolution,
                coAddedScans: parsed.coAddedScans,
                wavelengths: parsed.wavelengths,
                values: parsed.values,
                modality: parsed.modality,
                axisUnit: parsed.axisUnit,
                axisDirection: parsed.axisDirection || 'UNORDERED',
                quantity: parsed.quantity,
                qcStatus: validation.qcStatus,
                qcFlags: validation.flags,
                matchedSample: matchedSample ? {
                    id: matchedSample.id,
                    labId: matchedSample.labId,
                    originalId: matchedSample.originalId,
                    sampleDisplayId: matchedSample.labId || matchedSample.originalId || matchedSample.id
                } : null,
                matchedWorkItem: matchedWorkItem ? {
                    id: matchedWorkItem.id,
                    analysis: matchedWorkItem.analysis,
                    status: matchedWorkItem.status,
                    assignedTo: matchedWorkItem.assignedTo
                } : null,
                duplicate: !!(duplicateByHash || duplicateByReplicate),
                duplicateType: duplicateByHash ? 'EXACT_HASH' : (duplicateByReplicate ? 'REPLICATE_EXISTS' : null),
                duplicateReason,
                duplicateScanId,
                operationalBlocked,
                operationalReason,
                suggestedAction
            });
        }

        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const manifest = {
            manifestId,
            createdAt: new Date().toISOString(),
            expiresAt,
            userId: user?.id,
            username: user?.username,
            labId: user?.labId,
            equipmentId: equipmentId || null,
            items
        };

        fs.writeFileSync(path.join(manifestDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

        res.json({
            success: true,
            manifestId,
            expiresAt,
            count: items.length,
            items
        });
    } catch (e) {
        console.error('[SPECTRAL PREVIEW] Error:', e);
        res.status(500).json({ error: e.message });
    }
};

/**
 * Staged Ingestion Atomic Commit (Amendment 5)
 * POST /api/spectral/batch/commit
 * Executes atomic Prisma transaction for staged manifest, verifies operator permissions,
 * checks equipment qualification, evaluates replicate completeness, moves staged files to permanent storage.
 */
exports.commitBatch = async (req, res) => {
    try {
        const user = req.user;
        const { manifestId, idempotencyKey, decisions = {}, equipmentId: bodyEquipmentId, autoApprove } = req.body || {};

        // Idempotency check
        if (idempotencyKey && idempotencyReceipts.has(idempotencyKey)) {
            return res.json(idempotencyReceipts.get(idempotencyKey));
        }

        if (!manifestId) {
            return res.status(400).json({ error: 'MANIFEST_ID_REQUIRED', message: 'manifestId is required for batch commit.' });
        }

        const manifestPath = path.join(UPLOADS_STAGING_DIR, manifestId, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            return res.status(404).json({ error: 'MANIFEST_NOT_FOUND', message: 'Staged manifest not found or expired.' });
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (new Date() > new Date(manifest.expiresAt)) {
            return res.status(410).json({ error: 'MANIFEST_EXPIRED', message: 'Staged manifest has expired. Please re-upload.' });
        }

        // Equipment qualification (Amendment 8: No silent guessing)
        const effectiveEquipmentId = bodyEquipmentId || manifest.equipmentId;
        if (!effectiveEquipmentId) {
            return res.status(400).json({
                error: 'EQUIPMENT_SELECTION_REQUIRED',
                message: 'An active spectrometer must be explicitly selected from the equipment register.'
            });
        }

        const eqAsset = await prisma.equipmentAsset.findUnique({
            where: { id: effectiveEquipmentId },
            select: { id: true, status: true, labId: true, name: true, qcLimits: true }
        });
        if (!eqAsset || eqAsset.status !== 'IN_SERVICE') {
            return res.status(400).json({
                error: 'EQUIPMENT_NOT_IN_SERVICE',
                message: `The selected spectrometer (${effectiveEquipmentId}) is not in service.`
            });
        }

        const canAutoApprove = autoApprove && user && ['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role);
        const results = {
            success: 0,
            failed: 0,
            skipped: 0,
            committedScans: [],
            errors: []
        };

        const manifestDir = path.join(UPLOADS_STAGING_DIR, manifestId);

        for (const item of manifest.items) {
            if (item.parseError) {
                results.failed++;
                results.errors.push({ filename: item.filename, error: item.parseError });
                continue;
            }

            const decisionObj = decisions[item.id] || decisions[item.filename] || {};
            const decision = decisionObj.decision || item.suggestedAction || 'PROCEED';

            if (decision === 'SKIP') {
                results.skipped++;
                continue;
            }

            // Resolve sample
            const targetSampleId = decisionObj.sampleId || item.sampleId || item.matchedSample?.id;
            if (!targetSampleId) {
                results.failed++;
                results.errors.push({ filename: item.filename, error: 'NO_MATCHING_SAMPLE: Spectrum must be bound to a sample.' });
                continue;
            }

            const sample = await prisma.sample.findUnique({
                where: { id: targetSampleId },
                include: { workItems: true }
            });
            if (!sample) {
                results.failed++;
                results.errors.push({ filename: item.filename, error: 'SAMPLE_NOT_FOUND' });
                continue;
            }

            // Operational Gates Prerequisite Check (Amendment 4)
            const dryingGate = sample.workItems.find(w => w.analysis === 'DRYING');
            const prepGate = sample.workItems.find(w => w.analysis === 'PREPARATION');
            const isDone = g => g && ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(g.status);

            if (dryingGate && !isDone(dryingGate)) {
                results.failed++;
                results.errors.push({
                    filename: item.filename,
                    error: `DRYING_PREREQUISITE_INCOMPLETE: Sample ${sample.labId || sample.id} drying gate must be completed.`
                });
                continue;
            }
            if (prepGate && !isDone(prepGate)) {
                results.failed++;
                results.errors.push({
                    filename: item.filename,
                    error: `PREPARATION_PREREQUISITE_INCOMPLETE: Sample ${sample.labId || sample.id} preparation gate must be completed.`
                });
                continue;
            }

            // Target WorkItem
            const targetWorkItemId = decisionObj.targetWorkItemId || item.targetWorkItemId || item.matchedWorkItem?.id;
            let targetWorkItem = null;
            if (targetWorkItemId) {
                targetWorkItem = sample.workItems.find(w => w.id === targetWorkItemId) ||
                    await prisma.workItem.findUnique({ where: { id: targetWorkItemId } });
            }

            if (targetWorkItem && user.role === 'LAB_TECHNICIAN' && targetWorkItem.assignedTo && targetWorkItem.assignedTo !== user.username) {
                results.failed++;
                results.errors.push({
                    filename: item.filename,
                    error: `UNAUTHORIZED_TASK: WorkItem ${targetWorkItem.id} is assigned to ${targetWorkItem.assignedTo}.`
                });
                continue;
            }

            // Determine Replicate and Supersession
            let replicateNo = decisionObj.replicateNo ? parseInt(decisionObj.replicateNo, 10) : 1;
            if (decision === 'ADD_REPLICATE') {
                const existingRepCount = await prisma.spectralData.count({
                    where: { sampleId: sample.id, modality: item.modality, status: { not: 'DELETED' } }
                });
                replicateNo = existingRepCount + 1;
            }

            const newScanId = `spec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const safeName = item.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
            const permanentFilename = `${newScanId}_${safeName}`;
            const permanentFullPath = path.join(UPLOADS_SPECTRA_DIR, permanentFilename);
            const permanentRelativePath = `uploads/spectra/${permanentFilename}`;

            const stagedFilePath = path.join(manifestDir, item.stagedFilename || item.filename);

            try {
                const committedScan = await prisma.$transaction(async (tx) => {
                    let supersedesId = null;
                    if (decision === 'REPLACE' || item.duplicateScanId) {
                        const priorScan = await tx.spectralData.findFirst({
                            where: {
                                sampleId: sample.id,
                                modality: item.modality,
                                replicateNo: replicateNo,
                                isCurrent: true,
                                status: { not: 'DELETED' }
                            }
                        });
                        if (priorScan) {
                            supersedesId = priorScan.id;
                            await tx.spectralData.update({
                                where: { id: priorScan.id },
                                data: {
                                    isCurrent: false,
                                    supersededBy: newScanId,
                                    supersededAt: new Date(),
                                    supersedeReason: decisionObj.rescanReason || 'Replaced by authorized rescan'
                                }
                            });
                        }
                    }

                    // Move file staging -> permanent storage
                    if (fs.existsSync(stagedFilePath)) {
                        fs.copyFileSync(stagedFilePath, permanentFullPath);
                    }

                    const workflowStatus = item.qcStatus === 'FAIL' ? 'PENDING' : (canAutoApprove ? 'APPROVED' : 'VALIDATED');
                    const attemptNo = decisionObj.attemptNo || (supersedesId ? 2 : 1);

                    const created = await tx.spectralData.create({
                        data: {
                            id: newScanId,
                            sampleId: sample.id,
                            labId: sample.assignedLab || sample.labId || user.labId,
                            workItemId: targetWorkItem ? targetWorkItem.id : null,
                            attemptNo: attemptNo,
                            modality: item.modality,
                            filename: item.filename,
                            wavelengths: JSON.stringify(item.wavelengths),
                            values: JSON.stringify(item.values),
                            sourceFile: permanentRelativePath,
                            sourceFormat: item.format || 'CSV',
                            sha256: item.sha256,
                            quantity: item.quantity,
                            axisUnit: item.axisUnit,
                            axisDirection: item.axisDirection || 'UNORDERED',
                            region: item.modality,
                            isRaw: true,
                            equipmentId: effectiveEquipmentId,
                            resolution: item.resolution ? parseFloat(item.resolution) : null,
                            coAddedScans: item.coAddedScans ? parseInt(item.coAddedScans, 10) : null,
                            replicateNo: replicateNo,
                            isCurrent: true,
                            supersedes: supersedesId,
                            metadata: JSON.stringify({
                                filename: item.filename,
                                instrument: eqAsset.name || item.instrument || 'Spectrometer',
                                operator: user.username,
                                scanDate: new Date().toISOString(),
                                manifestId: manifestId,
                                replicateNo: replicateNo,
                                attemptNo: attemptNo
                            }),
                            qcStatus: item.qcStatus,
                            qcFlags: JSON.stringify(item.qcFlags || []),
                            scanType: 'SAMPLE',
                            status: workflowStatus,
                            uploadedBy: user.username,
                            ...(canAutoApprove ? { reviewedBy: user.username, reviewedAt: new Date() } : {})
                        }
                    });

                    // Physical Replicate Completeness Check (Amendment 3 & 6)
                    if (targetWorkItem && item.qcStatus !== 'FAIL') {
                        const requiredReplicates = 1; // standard requirement
                        const validScansCount = await tx.spectralData.count({
                            where: {
                                workItemId: targetWorkItem.id,
                                isCurrent: true,
                                status: { notIn: ['REJECTED', 'DELETED'] },
                                qcStatus: { not: 'FAIL' }
                            }
                        });

                        // validScansCount includes the new scan just created in the transaction
                        if (validScansCount >= requiredReplicates) {
                            const history = Array.isArray(targetWorkItem.history)
                                ? targetWorkItem.history
                                : (typeof targetWorkItem.history === 'string' ? JSON.parse(targetWorkItem.history || '[]') : []);

                            history.push({
                                status: 'COMPLETED',
                                note: `Spectrum acquired (${item.modality} · QC ${item.qcStatus}) by ${user.username}`,
                                changedBy: user.username,
                                timestamp: new Date().toISOString()
                            });

                            // Update WorkItem status to COMPLETED — ZERO Result rows created!
                            await tx.workItem.update({
                                where: { id: targetWorkItem.id },
                                data: {
                                    status: 'COMPLETED',
                                    completedAt: new Date(),
                                    result: `Spectrum Acquired (${item.modality} · QC ${item.qcStatus})`,
                                    equipmentId: effectiveEquipmentId,
                                    history: JSON.stringify(history)
                                }
                            });
                        }
                    }

                    // AuditLog entry
                    await tx.auditLog.create({
                        data: {
                            id: `audit-spec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            entity: 'SPECTRA',
                            entityId: created.id,
                            action: canAutoApprove ? 'SPECTRA_AUTO_APPROVED' : 'SPECTRA_COMMIT',
                            performedBy: user.username,
                            timestamp: new Date(),
                            details: `Committed ${item.modality} scan for sample ${sample.labId || sample.id} (QC: ${item.qcStatus})`
                        }
                    });

                    return created;
                });

                results.success++;
                results.committedScans.push({
                    id: committedScan.id,
                    filename: item.filename,
                    sampleId: sample.id,
                    labId: sample.labId,
                    qcStatus: item.qcStatus,
                    workItemId: targetWorkItem?.id || null
                });
            } catch (itemErr) {
                console.error(`[COMMIT] Error on item ${item.filename}:`, itemErr.message);
                results.failed++;
                results.errors.push({ filename: item.filename, error: itemErr.message });
            }
        }

        // Clean up staged manifest folder on completion
        try {
            if (fs.existsSync(manifestDir)) {
                fs.rmSync(manifestDir, { recursive: true, force: true });
            }
        } catch (cleanupErr) {
            console.warn('[COMMIT] Warning cleaning up manifest staging dir:', cleanupErr.message);
        }

        const responsePayload = {
            success: true,
            manifestId,
            ...results
        };

        if (idempotencyKey) {
            idempotencyReceipts.set(idempotencyKey, responsePayload);
        }

        res.json(responsePayload);
    } catch (e) {
        console.error('[SPECTRAL COMMIT] Error:', e);
        res.status(500).json({ error: e.message });
    }
};

/**
 * Link Existing Spectrum to WorkItem (Amendment 4)
 * POST /api/spectral/link-task
 * Validates assignment, lab scope, drying & preparation gates, and scan eligibility.
 */
exports.linkTask = async (req, res) => {
    try {
        const user = req.user;
        const { scanId, workItemId, managerOverrideReason } = req.body || {};

        if (!scanId || !workItemId) {
            return res.status(400).json({ error: 'MISSING_PARAMETERS', message: 'scanId and workItemId are required.' });
        }

        const scan = await prisma.spectralData.findUnique({ where: { id: scanId } });
        if (!scan || scan.status === 'DELETED') {
            return res.status(404).json({ error: 'SCAN_NOT_FOUND', message: 'Spectral scan not found.' });
        }

        // Historical Scan Eligibility (Amendment 4)
        if (!scan.isCurrent || ['REJECTED', 'SUPERSEDED', 'ARCHIVED'].includes(scan.status)) {
            return res.status(400).json({
                error: 'INELIGIBLE_SCAN_STATUS',
                message: `Cannot link a scan with status ${scan.status} or isCurrent=false.`
            });
        }
        if (scan.qcStatus === 'FAIL') {
            return res.status(400).json({
                error: 'CANNOT_LINK_FAILED_SCAN',
                message: 'Cannot link a scan that has failed QC checks.'
            });
        }
        if (scan.qcStatus === 'WARN' && !managerOverrideReason) {
            if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
                return res.status(400).json({
                    error: 'MANAGER_OVERRIDE_REQUIRED',
                    message: 'Linking a scan with QC warnings requires a manager override reason.'
                });
            }
        }

        const workItem = await prisma.workItem.findUnique({
            where: { id: workItemId },
            include: { sample: true }
        });
        if (!workItem) {
            return res.status(404).json({ error: 'WORK_ITEM_NOT_FOUND', message: 'WorkItem not found.' });
        }

        // Operator authorization
        if (user.role === 'LAB_TECHNICIAN' && workItem.assignedTo && workItem.assignedTo !== user.username) {
            return res.status(403).json({
                error: 'UNAUTHORIZED',
                message: `Task is assigned to ${workItem.assignedTo}.`
            });
        }

        // Modality matching
        const wAnalysis = (workItem.analysis || '').toUpperCase();
        if ((wAnalysis === 'SPEC_MIR' || wAnalysis === 'SPEC_FTIR') && scan.modality !== 'MIR') {
            return res.status(400).json({
                error: 'INCOMPATIBLE_MODALITY',
                message: `Task ${workItem.analysis} requires Mid-Infrared (MIR), but scan is ${scan.modality}.`
            });
        }
        if ((wAnalysis === 'SPEC_VIS_NIR' || wAnalysis === 'SPEC_NIR') && scan.modality !== 'NIR') {
            return res.status(400).json({
                error: 'INCOMPATIBLE_MODALITY',
                message: `Task ${workItem.analysis} requires Vis-NIR, but scan is ${scan.modality}.`
            });
        }

        // Operational gates prerequisite check
        const sample = workItem.sample;
        if (sample) {
            const gates = await prisma.workItem.findMany({
                where: { sampleId: sample.id, analysis: { in: ['DRYING', 'PREPARATION'] } }
            });
            const dryingGate = gates.find(g => g.analysis === 'DRYING');
            const prepGate = gates.find(g => g.analysis === 'PREPARATION');
            const isDone = g => g && ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(g.status);

            if (dryingGate && !isDone(dryingGate)) {
                return res.status(400).json({
                    error: 'DRYING_PREREQUISITE_INCOMPLETE',
                    message: `Sample drying must be completed before linking spectra.`
                });
            }
            if (prepGate && !isDone(prepGate)) {
                return res.status(400).json({
                    error: 'PREPARATION_PREREQUISITE_INCOMPLETE',
                    message: `Sample preparation must be completed before linking spectra.`
                });
            }
        }

        // Link in transaction
        const updated = await prisma.$transaction(async (tx) => {
            const updatedScan = await tx.spectralData.update({
                where: { id: scan.id },
                data: {
                    workItemId: workItem.id,
                    sampleId: sample ? sample.id : scan.sampleId
                }
            });

            // Update WorkItem to COMPLETED
            const history = Array.isArray(workItem.history)
                ? workItem.history
                : (typeof workItem.history === 'string' ? JSON.parse(workItem.history || '[]') : []);

            history.push({
                status: 'COMPLETED',
                note: `Linked existing spectrum (${scan.id}) by ${user.username}${managerOverrideReason ? ` [Override: ${managerOverrideReason}]` : ''}`,
                changedBy: user.username,
                timestamp: new Date().toISOString()
            });

            const updatedWI = await tx.workItem.update({
                where: { id: workItem.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    result: `Spectrum Linked (${scan.modality} · QC ${scan.qcStatus})`,
                    equipmentId: scan.equipmentId || workItem.equipmentId,
                    history: JSON.stringify(history)
                }
            });

            await tx.auditLog.create({
                data: {
                    id: `audit-link-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    entity: 'WORK_ITEM',
                    entityId: workItem.id,
                    action: 'LINK_SPECTRUM',
                    performedBy: user.username,
                    timestamp: new Date(),
                    details: `Linked scan ${scan.id} to workItem ${workItem.id} (${workItem.analysis})`
                }
            });

            return { updatedScan, updatedWI };
        });

        res.json({
            success: true,
            scanId: updated.updatedScan.id,
            workItemId: updated.updatedWI.id,
            workItemStatus: updated.updatedWI.status
        });
    } catch (e) {
        console.error('[SPECTRAL LINK-TASK] Error:', e);
        res.status(500).json({ error: e.message });
    }
};

/**
 * Handle Single or Multipart Upload
 */
exports.uploadBatch = async (req, res) => {
    try {
        if (req.body && req.body.manifestId) {
            return exports.commitBatch(req, res);
        }
        let { batchId, scans, contextSampleId, autoApprove } = req.body || {};
        const user = req.user; // From auth middleware
        const canAutoApprove = autoApprove && user && ['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role);

        // Parse stringified scans if sent via FormData
        if (typeof scans === 'string') {
            try {
                scans = JSON.parse(scans);
            } catch (e) {}
        }

        // SL-06 & SL-13: True Multipart Binary Raw File Support
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            if (Array.isArray(scans) && scans.length > 0) {
                // Wide-format or long-format table parsed into scans array, attach raw file blob
                const firstFile = req.files[0];
                scans.forEach(s => {
                    if (!s.rawBuffer && !s.rawContent) {
                        s.rawBuffer = firstFile.buffer;
                        s.rawContent = firstFile.buffer;
                    }
                });
            } else {
                // Direct instrument files upload
                scans = req.files.map(file => {
                    const ext = path.extname(file.originalname).toLowerCase();
                    let sourceFormat = 'CSV';
                    if (ext === '.dx' || ext === '.jdx' || ext === '.jcamp') sourceFormat = 'JCAMP';
                    else if (ext === '.opus' || /\.[0-9]+$/.test(ext)) sourceFormat = 'OPUS';
                    else if (ext === '.spc') sourceFormat = 'SPC';
                    else if (ext === '.asd') sourceFormat = 'ASD';

                    const nameWithoutExt = path.basename(file.originalname, ext);
                    const fileLabId = (req.body && (req.body.labId || req.body.sampleId)) || nameWithoutExt;

                    return {
                        filename: file.originalname,
                        rawBuffer: file.buffer, // Preserve exact binary bytes
                        rawContent: file.buffer,
                        sourceFormat,
                        labId: fileLabId,
                        modality: req.body?.modality,
                        quantity: req.body?.quantity,
                        equipmentId: req.body?.equipmentId,
                        replicateNo: req.body?.replicateNo ? parseInt(req.body.replicateNo) : 1
                    };
                });
            }
        }

        if (!scans || !Array.isArray(scans) || scans.length === 0) {
            return res.status(400).json({ error: 'Invalid payload: scans array or multipart files required' });
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

            // SL-13 & SL-14: Server-Side Parsing of Raw Files (JCAMP-DX / CSV)
            if (scanItem.rawContent && (!scanItem.wavelengths || scanItem.wavelengths.length === 0)) {
                try {
                    const parsed = parseSpectralFile(scanItem.rawContent, scanItem.filename || '');
                    scanItem.wavelengths = parsed.wavelengths;
                    scanItem.values = parsed.values;
                    if (!scanItem.modality) scanItem.modality = parsed.modality;
                    if (!scanItem.axisUnit) scanItem.axisUnit = parsed.axisUnit;
                    if (!scanItem.quantity) scanItem.quantity = parsed.quantity;
                    if (!scanItem.resolution && parsed.resolution) scanItem.resolution = parsed.resolution;
                    if (!scanItem.instrument && parsed.instrument) scanItem.instrument = parsed.instrument;
                    if (!scanItem.coAddedScans && parsed.coAddedScans) scanItem.coAddedScans = parsed.coAddedScans;
                    if (!scanItem.backgroundRef && parsed.backgroundRef) scanItem.backgroundRef = parsed.backgroundRef;
                    scanItem.sourceFormat = parsed.format;
                    scanItem.sha256 = parsed.sha256;
                } catch (parseErr) {
                    results.failed++;
                    results.errors.push({ filename: scanItem.filename, error: `Parse failure: ${parseErr.message}` });
                    continue;
                }
            }

            // 1. Link to Sample
            let sample = null;
            if (contextSample) {
                sample = contextSample;
                console.log(`[SPECTRAL] Using context sample ${sample.id} (originalId=${sample.originalId}) for upload`);
            } else if (scanItem.labId) {
                const inputLabId = scanItem.labId.trim();
                const userLabScope = user && user.role !== 'SUPER_ADMIN' && user.labId
                    ? { OR: [{ assignedLab: user.labId }, { labId: user.labId }] }
                    : {};

                // SL-15: Indexed lab-scoped lookup without take: 500 memory cap
                sample = await prisma.sample.findFirst({
                    where: {
                        AND: [
                            {
                                OR: [
                                    { labId: inputLabId },
                                    { id: inputLabId },
                                    { originalId: inputLabId }
                                ]
                            },
                            userLabScope
                        ]
                    }
                });
            }
            if (!sample && scanItem.sampleId) {
                sample = await prisma.sample.findUnique({ where: { id: scanItem.sampleId } });
            }

            // --- RBAC ISOLATION CHECK ---
            if (sample && user && user.role !== 'SUPER_ADMIN' && user.labId) {
                const sampleLab = sample.assignedLab || sample.labId || null;

                if (sampleLab && sampleLab !== user.labId) {
                    console.warn(`[SECURITY] User ${user.username} tried to upload scan for Sample ${sample.labId} in Lab ${sampleLab}`);
                    results.failed++;
                    results.errors.push({ filename: scanItem.filename, error: `Permission Denied: Sample ${scanItem.labId} belongs to another laboratory.` });
                    continue;
                }

                if (!sample.assignedLab && user.labId) {
                    await prisma.sample.update({
                        where: { id: sample.id },
                        data: { assignedLab: user.labId }
                    });
                }
            }

            // --- STRICT MATCH: Reject unmatched spectra (unless CONTROL scan) ---
            const isControlScan = scanItem.scanType === 'CONTROL';
            if (!sample && !isControlScan) {
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

            // SL-15: Refuse Lab ID mismatch instead of warning and linking anyway
            if (sample && scanItem.labId && sample.labId) {
                const normInput = scanItem.labId.trim().toUpperCase();
                const normSampleLab = (sample.labId || '').trim().toUpperCase();
                const normSampleOrig = (sample.originalId || '').trim().toUpperCase();
                const normSampleId = (sample.id || '').trim().toUpperCase();
                if (normInput !== normSampleLab && normInput !== normSampleOrig && normInput !== normSampleId) {
                    results.failed++;
                    results.errors.push({
                        filename: scanItem.filename,
                        error: `Laboratory ID mismatch: File specifies "${scanItem.labId}" but matched sample has "${sample.labId}". Upload refused.`
                    });
                    continue;
                }
            }

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

            // Native Axis Ingest & Direction Detection
            const wavelengths = scanItem.wavelengths || [];
            const values = scanItem.values || [];
            let increasing = true;
            let decreasing = true;
            for (let i = 1; i < wavelengths.length; i++) {
                if (wavelengths[i] <= wavelengths[i - 1]) increasing = false;
                if (wavelengths[i] >= wavelengths[i - 1]) decreasing = false;
            }
            const axisDirection = increasing ? 'ASCENDING' : (decreasing ? 'DESCENDING' : 'UNORDERED');

            // SL-11: Checksum Deduplication
            const effectiveLabId = sample ? (sample.assignedLab || sample.labId || (user ? user.labId : null)) : (user ? user.labId : null);
            let sha256Hash = scanItem.sha256;
            if (!sha256Hash) {
                if (scanItem.rawBuffer) {
                    sha256Hash = crypto.createHash('sha256').update(scanItem.rawBuffer).digest('hex');
                } else if (scanItem.rawContent) {
                    const buf = Buffer.isBuffer(scanItem.rawContent) ? scanItem.rawContent : Buffer.from(scanItem.rawContent, 'utf8');
                    sha256Hash = crypto.createHash('sha256').update(buf).digest('hex');
                } else {
                    const arrayString = JSON.stringify(wavelengths) + JSON.stringify(values);
                    sha256Hash = calculateChecksum(arrayString);
                }
            }

            const duplicate = await prisma.spectralData.findFirst({
                where: {
                    labId: effectiveLabId,
                    sha256: sha256Hash,
                    status: { not: 'DELETED' }
                }
            });
            if (duplicate) {
                console.log(`[SPECTRAL] Duplicate detected with sha256=${sha256Hash}. Skipping.`);
                results.skipped++;
                results.errors.push({
                    filename: scanItem.filename,
                    error: `Duplicate spectrum rejected: identical content hash already exists in this lab (Scan ID: ${duplicate.id}).`
                });
                continue;
            }

            // SL-06: Raw File Storage (Byte-identical binary preservation)
            const newScanId = `spec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            let sourceFilePath = null;
            try {
                let rawBuffer = scanItem.rawBuffer;
                if (!rawBuffer) {
                    if (scanItem.rawContent) {
                        rawBuffer = Buffer.isBuffer(scanItem.rawContent)
                            ? scanItem.rawContent
                            : Buffer.from(scanItem.rawContent, 'utf8');
                    } else {
                        const lines = ['wavelength,value'];
                        for (let i = 0; i < wavelengths.length; i++) {
                            lines.push(`${wavelengths[i]},${values[i] !== undefined ? values[i] : ''}`);
                        }
                        rawBuffer = Buffer.from(lines.join('\n'), 'utf8');
                    }
                }
                const safeName = (scanItem.filename || 'scan.csv').replace(/[^a-zA-Z0-9._-]/g, '_');
                const fullFilePath = path.join(UPLOADS_SPECTRA_DIR, `${newScanId}_${safeName}`);
                fs.writeFileSync(fullFilePath, rawBuffer);
                sourceFilePath = path.relative(path.join(__dirname, '..'), fullFilePath).replace(/\\/g, '/');
            } catch (fsErr) {
                console.warn('[SPECTRAL] Warning: Failed to persist raw file blob:', fsErr.message);
            }

            let equipmentId = scanItem.equipmentId || req.body?.equipmentId || null;
            if (!equipmentId && effectiveLabId) {
                const activeEqs = await prisma.equipmentAsset.findMany({
                    where: { labId: effectiveLabId, assetType: 'SPECTROMETER', status: 'IN_SERVICE' }
                });
                if (activeEqs.length > 0) {
                    equipmentId = activeEqs[0].id;
                }
            }

            // SL-17: Load instrument-specific QC tolerances if available
            let equipmentLimits = null;
            if (equipmentId) {
                const eqAsset = await prisma.equipmentAsset.findUnique({
                    where: { id: equipmentId },
                    select: { id: true, qcLimits: true }
                });
                if (eqAsset && eqAsset.qcLimits) {
                    try { equipmentLimits = JSON.parse(eqAsset.qcLimits); } catch (e) {}
                }
            }

            // SL-12: Find prior active scan for supersession
            let priorScan = null;
            let supersedesId = null;
            const replicateNo = scanItem.replicateNo ? parseInt(scanItem.replicateNo) : 1;
            if (sample) {
                priorScan = await prisma.spectralData.findFirst({
                    where: {
                        sampleId: sample.id,
                        modality: scanItem.modality || 'NIR',
                        replicateNo: replicateNo,
                        isCurrent: true,
                        status: { not: 'DELETED' }
                    }
                });
                if (priorScan) supersedesId = priorScan.id;
            }

            // SL-07 & SL-17: Typed physical quantity & signal metadata (never guess; default to UNVERIFIED)
            const quantity = scanItem.quantity || 'UNVERIFIED';
            const axisUnit = scanItem.axisUnit || (scanItem.modality === 'MIR' ? 'WAVENUMBER_CM1' : 'WAVELENGTH_NM');
            const region = scanItem.region || scanItem.modality || 'NIR';

            // SL-17 & SL-18: Spectroscopist-Grade Validation with Artefact Checks
            const validation = validateSpectra(wavelengths, values, scanItem.modality, {
                quantity,
                equipmentLimits,
                instrumentRange: scanItem.instrumentRange,
                resolution: scanItem.resolution
            });

            // SL-19: Replicate Agreement Evaluation
            if (sample && replicateNo > 1) {
                const priorReplicate = await prisma.spectralData.findFirst({
                    where: {
                        sampleId: sample.id,
                        modality: scanItem.modality || 'NIR',
                        replicateNo: { not: replicateNo },
                        isCurrent: true,
                        status: { not: 'DELETED' }
                    }
                });
                if (priorReplicate && priorReplicate.wavelengths && priorReplicate.values) {
                    try {
                        const repW = JSON.parse(priorReplicate.wavelengths);
                        const repV = JSON.parse(priorReplicate.values);
                        const repCheck = evaluateReplicateAgreement(wavelengths, values, repW, repV, {
                            quantity,
                            maxRmsd: equipmentLimits ? equipmentLimits.maxRmsd : undefined
                        });
                        if (!repCheck.pass) {
                            validation.flags.push(`REPLICATE_DISAGREEMENT:${priorReplicate.id}:RMSD=${repCheck.rmsd}`);
                            if (validation.qcStatus !== 'FAIL') validation.qcStatus = 'WARN';
                        }
                    } catch (repErr) {
                        console.warn('[SPECTRAL] Replicate agreement error:', repErr.message);
                    }
                }
            }

            // SL-20: Library Outlier Screening
            if (!isControlScan && validation.qcStatus !== 'FAIL' && effectiveLabId) {
                try {
                    const approvedLibraryScans = await prisma.spectralData.findMany({
                        where: {
                            labId: effectiveLabId,
                            modality: scanItem.modality || 'NIR',
                            status: 'APPROVED',
                            isCurrent: true
                        },
                        select: { values: true },
                        take: 20
                    });
                    const outlierCheck = screenScanAgainstLibrary(wavelengths, values, approvedLibraryScans);
                    if (outlierCheck.isOutlier) {
                        validation.flags.push(`SPECTRAL_OUTLIER:${outlierCheck.reason || 'ANOMALY'}`);
                        if (validation.qcStatus !== 'FAIL') validation.qcStatus = 'WARN';
                    }
                } catch (outlierErr) {
                    console.warn('[SPECTRAL] Outlier check error:', outlierErr.message);
                }
            }

            let workflowStatus;
            if (validation.qcStatus === 'FAIL') {
                workflowStatus = 'PENDING';
            } else if (canAutoApprove) {
                workflowStatus = 'APPROVED';
            } else {
                workflowStatus = 'VALIDATED';
            }

            // Resolve related WorkItem before transaction
            let targetWorkItem = null;
            const explicitWId = scanItem.targetWorkItemId || scanItem.workItemId || req.body?.targetWorkItemId;
            if (explicitWId) {
                targetWorkItem = await prisma.workItem.findUnique({ where: { id: explicitWId } });
            } else if (sample && validation.qcStatus !== 'FAIL') {
                const sModality = (scanItem.modality || 'NIR').toUpperCase();
                const openWorkItems = await prisma.workItem.findMany({
                    where: {
                        sampleId: sample.id,
                        status: { notIn: ['COMPLETED', 'ACCEPTED', 'SUBMITTED', 'WAIVED'] }
                    }
                });

                targetWorkItem = openWorkItems.find(w => {
                    const wAnalysis = (w.analysis || '').toUpperCase();
                    if (sModality === 'NIR') {
                        return wAnalysis === 'SPEC_VIS_NIR' || wAnalysis === 'SPEC_NIR' ||
                            wAnalysis.includes('NIR') || wAnalysis.includes('VIS-NIR') || wAnalysis.includes('SPECTRA');
                    }
                    if (sModality === 'MIR') {
                        return wAnalysis === 'SPEC_MIR' || wAnalysis === 'SPEC_FTIR' ||
                            wAnalysis.includes('MIR') || wAnalysis.includes('FTIR');
                    }
                    return false;
                }) || null;
            }

            // Check operational gates if linking to work item (Amendment 4)
            if (sample && targetWorkItem) {
                const gates = await prisma.workItem.findMany({
                    where: { sampleId: sample.id, analysis: { in: ['DRYING', 'PREPARATION'] } }
                });
                const dryingGate = gates.find(g => g.analysis === 'DRYING');
                const prepGate = gates.find(g => g.analysis === 'PREPARATION');
                const isDone = g => g && ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(g.status);
                if (dryingGate && !isDone(dryingGate)) {
                    results.failed++;
                    results.errors.push({
                        filename: scanItem.filename,
                        error: `DRYING_PREREQUISITE_INCOMPLETE: Sample drying must be completed before recording spectra.`
                    });
                    continue;
                }
                if (prepGate && !isDone(prepGate)) {
                    results.failed++;
                    results.errors.push({
                        filename: scanItem.filename,
                        error: `PREPARATION_PREREQUISITE_INCOMPLETE: Sample preparation must be completed before recording spectra.`
                    });
                    continue;
                }
            }

            // SL-15 & SL-16: Atomic Database Transaction
            let newScan;
            let updatedWorkItemId = null;
            try {
                newScan = await prisma.$transaction(async (tx) => {
                    // Update prior scan supersession
                    if (priorScan) {
                        await tx.spectralData.update({
                            where: { id: priorScan.id },
                            data: {
                                isCurrent: false,
                                supersededBy: newScanId,
                                supersededAt: new Date(),
                                supersedeReason: scanItem.rescanReason || 'New determination/rescan uploaded'
                            }
                        });
                    }

                    // Create new spectral record with workItemId and attemptNo (Amendment 3)
                    const attemptNo = scanItem.attemptNo || (supersedesId ? 2 : 1);
                    const createdScan = await tx.spectralData.create({
                        data: {
                            id: newScanId,
                            sampleId: sample ? sample.id : null,
                            labId: effectiveLabId,
                            workItemId: targetWorkItem ? targetWorkItem.id : null,
                            attemptNo: attemptNo,
                            modality: scanItem.modality || 'NIR',
                            filename: scanItem.filename,
                            wavelengths: JSON.stringify(wavelengths),
                            values: JSON.stringify(values),
                            sourceFile: sourceFilePath,
                            sourceFormat: scanItem.sourceFormat || 'CSV',
                            sha256: sha256Hash,
                            parserVersion: '1.0.0',
                            quantity: quantity,
                            axisUnit: axisUnit,
                            axisDirection: axisDirection,
                            region: region,
                            isRaw: scanItem.isRaw !== undefined ? Boolean(scanItem.isRaw) : true,
                            equipmentId: equipmentId,
                            resolution: scanItem.resolution ? parseFloat(scanItem.resolution) : null,
                            coAddedScans: scanItem.coAddedScans ? parseInt(scanItem.coAddedScans) : null,
                            accessory: scanItem.accessory || null,
                            backgroundRef: scanItem.backgroundRef || null,
                            backgroundAt: scanItem.backgroundAt ? new Date(scanItem.backgroundAt) : null,
                            detector: scanItem.detector || null,
                            beamsplitter: scanItem.beamsplitter || null,
                            preparation: scanItem.preparation || null,
                            moistureState: scanItem.moistureState || 'AIR_DRY',
                            windowMaterial: scanItem.windowMaterial || null,
                            replicateNo: replicateNo,
                            ambientTemp: scanItem.ambientTemp ? parseFloat(scanItem.ambientTemp) : null,
                            ambientRh: scanItem.ambientRh ? parseFloat(scanItem.ambientRh) : null,
                            isCurrent: true,
                            supersedes: supersedesId,
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
                                axisUnit: axisUnit,
                                quantity: quantity,
                                sha256: sha256Hash
                            }),
                            qcStatus: validation.qcStatus,
                            qcFlags: JSON.stringify(validation.flags),
                            scanType: isControlScan ? 'CONTROL' : 'SAMPLE',
                            status: workflowStatus,
                            uploadedBy: user ? user.id : null,
                            ...(canAutoApprove && validation.qcStatus !== 'FAIL' ? {
                                reviewedBy: user.username || user.id,
                                reviewedAt: new Date()
                            } : {})
                        }
                    });

                    // Create Audit Log
                    await tx.auditLog.create({
                        data: {
                            id: `audit-spec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            entity: 'SPECTRA',
                            entityId: createdScan.id,
                            action: canAutoApprove ? 'SPECTRA_AUTO_APPROVED' : 'SPECTRA_UPLOAD',
                            performedBy: user ? user.username : 'system',
                            timestamp: new Date(),
                            details: `Uploaded ${createdScan.modality} scan${sample ? ` for Sample ${sample.labId}` : ` (CSV ID: ${scanItem.labId})`}. Status: ${workflowStatus}`
                        }
                    });

                    // Replicate Completeness Check: Route WorkItem Status (Amendment 3 & 6)
                    if (targetWorkItem && validation.qcStatus !== 'FAIL') {
                        const requiredReplicates = 1; // standard
                        const activeScansCount = await tx.spectralData.count({
                            where: {
                                workItemId: targetWorkItem.id,
                                isCurrent: true,
                                status: { notIn: ['REJECTED', 'DELETED'] },
                                qcStatus: { not: 'FAIL' }
                            }
                        });

                        if (activeScansCount >= requiredReplicates) {
                            updatedWorkItemId = targetWorkItem.id;
                            const history = typeof targetWorkItem.history === 'string'
                                ? JSON.parse(targetWorkItem.history)
                                : (targetWorkItem.history || []);

                            history.push({
                                status: 'COMPLETED',
                                note: `Spectrum uploaded by ${user ? user.username : 'system'}. QC: ${validation.qcStatus}${canAutoApprove ? ' (Auto-Approved)' : ''}`,
                                changedBy: user ? user.username : 'system',
                                timestamp: new Date().toISOString()
                            });

                            // Zero Result rows created!
                            await tx.workItem.update({
                                where: { id: targetWorkItem.id },
                                data: {
                                    status: 'COMPLETED',
                                    result: `Spectrum Uploaded (${validation.qcStatus})${canAutoApprove ? ' - Auto-Approved' : ''}`,
                                    equipmentId: equipmentId,
                                    completedAt: new Date(),
                                    history: JSON.stringify(history)
                                }
                            });
                        }
                    }

                    return createdScan;
                });
            } catch (txErr) {
                console.error('[SPECTRAL] Transaction error:', txErr.message);
                results.failed++;
                results.errors.push({
                    filename: scanItem.filename,
                    error: `Database transaction error: ${txErr.message}`
                });
                continue;
            }

            if (validation.qcStatus === 'FAIL') {
                results.success++;
                results.errors.push({
                    filename: scanItem.filename,
                    error: `Saved with QC Failure: ${validation.flags.join(', ')}. Requires manager review.`
                });
            } else {
                results.success++;
            }

            if (sample && !results.linkedToSample) {
                results.linkedToSample = {
                    id: sample.id,
                    labId: sample.labId,
                    originalId: sample.originalId
                };
            }

            if (updatedWorkItemId && user) {
                broadcastToLab(user.labId, 'WORKITEM_CHANGED', {
                    sampleId: sample.id,
                    workItemId: updatedWorkItemId,
                    status: 'COMPLETED',
                    source: 'spectral_upload'
                });
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

        // C10: Do not allow trashing spectra linked to ACCEPTED or SUBMITTED work items
        if (scan.workItemId) {
            const linkedWi = await prisma.workItem.findUnique({ where: { id: scan.workItemId } });
            if (linkedWi && ['ACCEPTED', 'SUBMITTED'].includes(linkedWi.status)) {
                return res.status(400).json({
                    error: `Cannot delete spectrum linked to a ${linkedWi.status} work item. An authorized amendment or return is required.`,
                    code: 'LINKED_EVIDENCE_IMMUTABLE'
                });
            }
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

        if (action === 'APPROVE') {
            // SL-07: Cannot approve if physical quantity is unconfirmed or UNVERIFIED
            if (!scan.quantity || scan.quantity === 'UNVERIFIED') {
                return res.status(400).json({
                    error: 'Cannot approve spectrum: physical quantity must be confirmed (cannot be empty or UNVERIFIED).'
                });
            }
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

/**
 * SL-06: Download raw instrument file with byte identity and SHA-256 ETag
 */
exports.downloadRawScan = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const scan = await prisma.spectralData.findUnique({ where: { id } });
        if (!scan) return res.status(404).json({ error: 'Spectrum not found' });

        if (!scopeGuard.canAccessEntity(user, scan, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: spectrum outside your laboratory scope.' });
        }

        const filename = scan.filename || `scan_${scan.id}.csv`;

        if (scan.sourceFile) {
            const absolutePath = path.isAbsolute(scan.sourceFile)
                ? scan.sourceFile
                : path.join(__dirname, '..', scan.sourceFile);

            if (fs.existsSync(absolutePath)) {
                if (scan.sha256) res.setHeader('ETag', scan.sha256);
                return res.download(absolutePath, filename);
            }
        }

        // Fallback: Reconstruct from stored JSON arrays
        const wavelengths = parseJson(scan.wavelengths) || [];
        const values = parseJson(scan.values) || [];
        const lines = ['wavelength,value'];
        for (let i = 0; i < wavelengths.length; i++) {
            lines.push(`${wavelengths[i]},${values[i] !== undefined ? values[i] : ''}`);
        }
        const csvContent = lines.join('\n');
        const hash = scan.sha256 || calculateChecksum(csvContent);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('ETag', hash);
        return res.send(csvContent);
    } catch (e) {
        console.error("Download Raw Scan Error:", e);
        res.status(500).json({ error: e.message });
    }
};

// SL-21: Instrument Control Scans & Drift Tracking (ASTM E1421)
exports.getControlDrifts = async (req, res) => {
    try {
        const user = req.user;
        const { equipmentId, days = 30 } = req.query;
        const sinceDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

        let where = {
            scanType: 'CONTROL',
            status: { not: 'DELETED' },
            timestamp: { gte: sinceDate }
        };

        if (equipmentId) where.equipmentId = equipmentId;
        where = scopeGuard.buildScopedWhere(user, where, { entityType: 'Spectral', labField: 'labId' });

        const controlScans = await prisma.spectralData.findMany({
            where,
            orderBy: { timestamp: 'asc' },
            select: {
                id: true,
                equipmentId: true,
                labId: true,
                timestamp: true,
                modality: true,
                quantity: true,
                resolution: true,
                qcStatus: true,
                qcFlags: true,
                sha256: true,
                metadata: true
            }
        });

        res.json({
            success: true,
            count: controlScans.length,
            scans: controlScans
        });
    } catch (e) {
        console.error('getControlDrifts error:', e);
        res.status(500).json({ error: e.message });
    }
};

// SL-06 & SL-13: Dedicated multipart upload handler alias
exports.uploadRawFiles = exports.uploadBatch;

