const prisma = require('../prisma');

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
                // Location? Not in root schema, probably in metadata or fieldMetadata?
                // Legacy said s.location.lat. Schema has fieldMetadata.
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

                    if (spectralExists || (item && item.result && ['ACCEPTED', 'COMPLETED', 'APPROVED', 'SUBMITTED', 'SUBMITTED_PARTIAL'].includes(item.status))) {
                        resultObj[analysisCode] = item?.result || (spectralExists ? 'Spectrum Uploaded' : 'Done');
                    } else if (item && ['CANCELLED', 'N/A'].includes(item.status)) {
                        resultObj[analysisCode] = 'N/A';
                    } else if (item) {
                        resultObj[analysisCode] = { status: 'PENDING', assignedTo: item.assignedTo || 'Unassigned', lastUpdated: item.updatedAt };
                    } else {
                        // No item, check spectral again?
                        if (spectralExists) resultObj[analysisCode] = 'Spectrum Uploaded';
                        else resultObj[analysisCode] = { status: 'PENDING', assignedTo: 'Pending Intake' };
                    }
                }
            });

            // Extra items
            sItems.forEach(item => {
                if (!EXCLUDED_ANALYSES.includes(item.analysis) && !required.includes(item.analysis)) {
                    analysisKeys.add(item.analysis);
                    if (item.result && ['ACCEPTED', 'COMPLETED', 'APPROVED', 'SUBMITTED'].includes(item.status)) {
                        resultObj[item.analysis] = item.result;
                    } // else ignore pending extra items to not clutter
                }
            });

            return resultObj;
        });

        const sortedKeys = Array.from(analysisKeys).sort();

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
                ...sortedKeys.map(k => ({ key: k, label: k, isResult: true }))
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
