const prisma = require('../prisma');
const { normalizeUnit } = require('../services/interpretationService');

exports.getAnalyticalResults = async (req, res) => {
    try {
        const { project, country, startDate, endDate, analysisType } = req.query;
        const user = req.user;

        // 1. Build Sample Query
        const where = {};

        // RBAC - THE ISOLATION FORGE
        if (user && user.role !== 'SUPER_ADMIN') {
            const userLabId = user.labId;
            const isLabStaff = ['LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION'].includes(user.role);

            if (isLabStaff && userLabId) {
                // FORCE: Lab Staff ONLY see their lab's data. Period.
                where.assignedLab = userLabId;
            } else {
                // Scoped Roles (Country/Project Managers)
                const orConditions = [];
                if (user.countries && user.countries.length > 0) {
                    orConditions.push({ countryName: { in: user.countries } });
                    orConditions.push({ country: { in: user.countries } });
                }
                if (user.projects && user.projects.length > 0) {
                    orConditions.push({ projectCode: { in: user.projects } });
                }

                if (orConditions.length > 0) {
                    where.OR = orConditions;
                } else {
                    return res.json({ data: [], columns: [] });
                }
            }
        }

        // Filters
        if (project) {
            const list = project.toUpperCase().split(',');
            where.projectCode = { in: list };
        }
        if (country) {
            where.countryName = country;
        }
        if (startDate) {
            where.receptionDate = { gte: new Date(startDate) };
        }
        if (endDate) {
            where.receptionDate = { lte: new Date(endDate) };
        }

        // Status Filter - Exclude Expected, Received (unprocessed), and Drafts
        where.status = { notIn: ['EXPECTED', 'RECEIVED', 'DRAFT'] };

        // Fetch Samples + Relations
        const samples = await prisma.sample.findMany({
            where,
            include: {
                workItems: true, // Fetch Work Items
                // SpectralData? We need presence check.
                // We can't include SpectralData easily if relation not defined.
                // Schema has SpectralData but relation to Sample might not be defined in Prism file?
                // Checked Schema: SpectralData has `sampleId`, but Sample model (Lines 49-77) does NOT have `spectralData SpectralData[]` relation field.
                // So we can't include it. We must fetch separately.
            },
            orderBy: { receptionDate: 'desc' },
            take: 500 // Limit for safety
        });

        const sampleIds = samples.map(s => s.id);

        // Fetch Spectral Index
        const spectralIndex = await prisma.spectralData.findMany({
            where: { sampleId: { in: sampleIds } },
            select: { sampleId: true, modality: true }
        });

        // 5. Aggregate
        const analysisKeys = new Set();
        const EXCLUDED_ANALYSES = ['DRYING', 'PREPARATION', 'ARCHIVING', 'DISPOSAL', 'ARCH', 'DISP', 'DISPOSAL_PENDING'];

        // Preload analysis definitions for unit normalization
        const allDefs = await prisma.analysis.findMany({
            select: { code: true, name: true, units: true }
        });
        const defMap = {};
        allDefs.forEach(d => { defMap[d.code] = d; });

        const flattenedData = samples.map(s => {
            const resultObj = {
                id: s.id,
                labId: s.labId || 'Pending...',
                originalId: s.originalId,
                project: s.projectCode,
                country: s.countryName,
                status: s.status,
                submitter: s.submitter || parseJson(s.metadata)?.submitterName || '',
                collectionDate: s.collectionDate,
                receptionDate: s.receptionDate,
                latitude: '',
                longitude: '',
            };

            const sItems = s.workItems || [];
            const required = parseJson(s.requiredAnalyses) || [];

            // Helper to check spectral
            const hasSpectral = (modality) => spectralIndex.some(idx => idx.sampleId === s.id && idx.modality === modality);

            required.forEach(analysisCode => {
                if (EXCLUDED_ANALYSES.includes(analysisCode)) return;

                // Filter Analysis Type
                let shouldInclude = true;
                if (analysisType) {
                    if (analysisType === 'SPECTRAL') {
                        if (!['SPEC_VIS_NIR', 'SPEC_MIR', 'Vis-NIR Soil Spectra', 'MIR Soil Spectra'].includes(analysisCode)) shouldInclude = false;
                    } else if (analysisType === 'WET_CHEM') {
                        if (['SPEC_VIS_NIR', 'SPEC_MIR', 'Vis-NIR Soil Spectra', 'MIR Soil Spectra'].includes(analysisCode)) shouldInclude = false;
                    } else if (analysisType === 'TEXTURE') {
                        if (!['SAND', 'SILT', 'CLAY'].includes(analysisCode)) shouldInclude = false;
                    } else if (analysisType !== 'ALL') {
                        if (analysisCode !== analysisType) shouldInclude = false;
                    }
                }

                if (shouldInclude) {
                    analysisKeys.add(analysisCode);
                    const item = sItems.find(w => w.analysis === analysisCode);

                    // Spectral Fallback
                    const isSpectral = ['SPEC_VIS_NIR', 'SPEC_MIR'].includes(analysisCode);
                    const requiredModality = analysisCode === 'SPEC_MIR' ? 'MIR' : 'NIR';
                    const spectralExists = isSpectral && hasSpectral(requiredModality);

                    // Spectral: show checkmark ONLY if WI is completed/accepted/approved
                    const spectralDoneStatuses = ['ACCEPTED', 'COMPLETED', 'APPROVED', 'SUBMITTED', 'SUBMITTED_PARTIAL'];
                    if (item && item.result && spectralDoneStatuses.includes(item.status)) {
                        const rawUnit = defMap[analysisCode]?.units || '';
                        const norm = normalizeUnit(analysisCode, item.result, rawUnit);
                        const asMeasured = isNaN(Number(item.result)) ? item.result : Number(item.result);
                        const normalized = norm.normalizedValue !== null ? norm.normalizedValue : asMeasured;
                        const pLower = analysisCode.toLowerCase();

                        resultObj[`${pLower}_as_measured`] = asMeasured;
                        resultObj[`${pLower}_unit`] = rawUnit;
                        resultObj[`${pLower}_normalized`] = normalized;
                        resultObj[`${pLower}_controlled_unit`] = norm.standardUnit || rawUnit;

                        // For approved results, return plain value; for submitted/completed, wrap with status
                        if (['APPROVED', 'ACCEPTED'].includes(item.status)) {
                            resultObj[analysisCode] = normalized;
                        } else {
                            resultObj[analysisCode] = { status: 'SUBMITTED', value: normalized, assignedTo: item.assignedTo || 'Unknown' };
                        }
                    } else if (spectralExists && item && spectralDoneStatuses.includes(item.status)) {
                        resultObj[analysisCode] = 'Spectrum Uploaded';
                    } else if (item && ['CANCELLED', 'N/A'].includes(item.status)) {
                        resultObj[analysisCode] = 'N/A';
                    } else if (item && item.result && item.status === 'IN_PROGRESS') {
                        // Phase 4: Surface draft values instead of suppressing them
                        resultObj[analysisCode] = { status: 'DRAFT', value: item.result, assignedTo: item.assignedTo || 'Unknown', lastUpdated: item.updatedAt };
                    } else if (spectralExists && item) {
                        // Spectrum uploaded but work item not yet completed — show as in-progress
                        resultObj[analysisCode] = { status: 'PENDING', assignedTo: item.assignedTo || 'Unassigned', lastUpdated: item.updatedAt, note: 'Spectrum uploaded, awaiting review' };
                    } else if (item) {
                        resultObj[analysisCode] = { status: 'PENDING', assignedTo: item.assignedTo || 'Unassigned', lastUpdated: item.updatedAt };
                    } else {
                        if (spectralExists) resultObj[analysisCode] = { status: 'PENDING', assignedTo: 'Pending Intake', note: 'Spectrum uploaded, no work item' };
                        else resultObj[analysisCode] = { status: 'PENDING', assignedTo: 'Pending Intake' };
                    }
                }
            });

            // Extra items
            sItems.forEach(item => {
                if (!EXCLUDED_ANALYSES.includes(item.analysis) && !required.includes(item.analysis)) {
                    analysisKeys.add(item.analysis);
                    if (item.result && ['ACCEPTED', 'COMPLETED', 'APPROVED', 'SUBMITTED'].includes(item.status)) {
                        if (['APPROVED', 'ACCEPTED'].includes(item.status)) {
                            resultObj[item.analysis] = item.result;
                        } else {
                            resultObj[item.analysis] = { status: 'SUBMITTED', value: item.result, assignedTo: item.assignedTo || 'Unknown' };
                        }
                    } // else ignore pending extra items to not clutter
                }
            });

            return resultObj;
        });

        const sortedKeys = Array.from(analysisKeys).sort();

        const { getAnalysisName } = require('../services/analysisService');

        const resultCols = await Promise.all(sortedKeys.map(async k => {
            const def = defMap[k];
            const name = def?.name || await getAnalysisName(k);
            const unitSuffix = def?.units ? ` (${def.units})` : '';
            return {
                key: k,
                label: `${name}${unitSuffix}`,
                shortLabel: name,
                unit: def?.units || null,
                isResult: true
            };
        }));

        res.json({
            data: flattenedData,
            columns: [
                { key: 'labId', label: 'Lab ID', frozen: true },
                { key: 'originalId', label: 'Original ID' },
                { key: 'project', label: 'Project' },
                { key: 'country', label: 'Country' },
                { key: 'status', label: 'Status' },
                { key: 'collectionDate', label: 'Collected' },
                { key: 'receptionDate', label: 'Received' },
                ...resultCols
            ]
        });

    } catch (e) {
        console.error("Data Results Error:", e);
        res.status(500).json({ error: e.message });
    }
};

const parseJson = (str) => {
    try { return str ? JSON.parse(str) : null; } catch (e) { return null; }
};
