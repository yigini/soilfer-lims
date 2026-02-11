const prisma = require('../prisma');

// Helper: Scoping
// Note: Prisma 'where' clause usually handles scoping better than array filtering

// GET /api/exports/history
exports.getExportHistory = async (req, res) => {
    const user = req.user;
    try {
        const where = {};
        if (user.role !== 'SUPER_ADMIN') {
            where.user = user.username;
        }

        const logs = await prisma.exportLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: 50 // Limit history
        });

        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch export history' });
    }
};

exports.getExportData = async (req, res) => {
    try {
        const {
            type, // 'WET_CHEM', 'REGISTER', 'LIST'
            project,
            lab,
            startDate,
            endDate,
            includeUnapproved,
            signOffName,
            signOffReason,
            viewFilters // { search, ...filters } from client
        } = req.body;

        const user = req.user;

        // 0. Permission Check
        if (includeUnapproved && !['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Permission denied: Cannot export unapproved data.' });
        }

        const exportId = `EXP-${Date.now()}`;
        const timestamp = new Date();

        // 1. Build Query (Scope + Filters)
        const scopeGuard = require('../utils/scopeGuard');
        // 1. Build Scope (Secure Base)

        const scopeWhere = scopeGuard.buildScopedWhere(user, {}, {
            labField: 'labId',
            altLabField: 'assignedLab'
        });

        // 2. Build Filters (User Input)
        const filterWhere = {};
        const vf = viewFilters || {};

        // Search Logic
        if (vf.search) {
            const search = vf.search;
            const isLabId = /^[A-Z]{2,3}\d{4}-\d+/.test(search) || /^[A-Z]{3}-LAB-\d+/.test(search);
            if (isLabId) {
                filterWhere.OR = [
                    { labId: { contains: search } },
                    { originalId: { contains: search } }
                ];
            } else {
                filterWhere.OR = [
                    { clientRef: { contains: search, mode: 'insensitive' } },
                    { projectCode: { contains: search, mode: 'insensitive' } },
                    { originalId: { contains: search, mode: 'insensitive' } },
                    { labId: { contains: search, mode: 'insensitive' } },
                    { metadata: { contains: search, mode: 'insensitive' } }
                ];
            }
        }

        // Facet Filters
        if (vf.projects && Object.keys(vf.projects).length > 0) {
            filterWhere.projectCode = { in: Object.keys(vf.projects) };
        } else if (project) {
            filterWhere.projectCode = project;
        }

        if (vf.countries && Object.keys(vf.countries).length > 0) {
            filterWhere.country = { in: Object.keys(vf.countries) };
        }

        if (lab) filterWhere.labId = lab;

        // Date Filter
        if (startDate || endDate) {
            filterWhere.createdAt = {};
            if (startDate) filterWhere.createdAt.gte = new Date(startDate);
            if (endDate) filterWhere.createdAt.lte = new Date(endDate);
        }

        // Status Filter
        if (vf.status && Object.keys(vf.status).length > 0) {
            filterWhere.status = { in: Object.keys(vf.status) };
        }

        // 3. COMBINE Securely
        // Trigger AND logic to ensure Scope is NEVER overridden by Filter ORs
        const where = {
            AND: [
                scopeWhere,
                filterWhere
            ]
        };

        // 3. Fetch Data based on Type
        let data = [];
        let columns = [];
        let analysisMetadata = {};

        if (type === 'LIST') {
            const samples = await prisma.sample.findMany({
                where,
                include: {
                    workItems: true // Needed for progress calculation if we want it in export?
                },
                orderBy: { createdAt: 'desc' }
            });

            // Columns matching the grid
            columns = ['ID', 'Lab ID', 'Project', 'Country', 'State', 'Attention', 'Progress', 'Updated'];

            data = samples.map(s => {
                // Progress Logic
                let progressStr = '-';
                if (s.workItems && s.workItems.length > 0) {
                    const total = s.workItems.filter(wi => wi.status !== 'WAIVED').length;
                    const completed = s.workItems.filter(wi => ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(wi.status)).length;
                    progressStr = `${completed}/${total}`;
                }

                return {
                    'ID': s.originalId || s.id,
                    'Lab ID': s.labId || '-',
                    'Project': s.projectCode,
                    'Country': s.country,
                    'State': s.status, // Raw status, maybe map to human readable if needed
                    'Attention': 'OK', // Complex logic to replicate exactly, keeping simple for CSV
                    'Progress': progressStr,
                    'Updated': s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : ''
                };
            });

        } else if (type === 'WET_CHEM' || type === 'SPECTRAL') {
            // ... existing Wet Chem logic (preserved for future or if user switches back)
            if (!includeUnapproved) where.status = 'APPROVED';

            const samples = await prisma.sample.findMany({
                where,
                include: { results: true }
            });

            // Metadata map...
            const allAnalyses = await prisma.analysis.findMany();
            const analysesMap = {};
            allAnalyses.forEach(a => { analysesMap[a.code] = a; });

            data = samples.map(sample => {
                const row = {
                    'Sample ID': sample.originalId || sample.id,
                    'Lab ID': sample.labId || 'N/A',
                    'Project': sample.projectCode || 'N/A',
                    'Country': sample.country || 'N/A',
                    'Lab': sample.labId ? sample.labId.split('-')[1] : 'N/A',
                    'GPS X': '', 'GPS Y': '', 'Depth': '', 'Sampling Date': '', 'Land Use': '',
                    'Status': sample.status
                };

                if (sample.metadata) {
                    try {
                        const meta = JSON.parse(sample.metadata);
                        row['GPS X'] = meta.gpsX || '';
                        row['GPS Y'] = meta.gpsY || '';
                        row['Depth'] = meta.depth || '';
                        row['Sampling Date'] = meta.collectionDate || '';
                        row['Land Use'] = meta.landUse || meta.crop || '';
                    } catch (e) { }
                }

                if (sample.results) {
                    sample.results.forEach(r => {
                        const colKey = r.param;
                        row[colKey] = r.value;
                        if (!columns.includes(colKey)) columns.push(colKey);
                        if (!analysisMetadata[colKey]) {
                            const config = analysesMap[colKey] || {};
                            analysisMetadata[colKey] = {
                                name: config.name || colKey,
                                unit: config.units || '-',
                                method: 'Internal'
                            };
                        }
                    });
                }
                return row;
            });

            const staticCols = ['Sample ID', 'Lab ID', 'Project', 'Country', 'Lab', 'GPS X', 'GPS Y', 'Depth', 'Sampling Date', 'Land Use', 'Status'];
            columns = [...staticCols, ...columns.sort()];

        } else if (type === 'REGISTER') {
            // ... existing Register logic
            const samples = await prisma.sample.findMany({ where });
            columns = ['Sample ID', 'Lab ID', 'Status', 'Project', 'Country', 'Received At', 'Received By', 'GPS X', 'GPS Y'];
            data = samples.map(s => {
                let meta = {};
                try { meta = JSON.parse(s.metadata || '{}'); } catch (e) { }
                return {
                    'Sample ID': s.originalId || s.id,
                    'Lab ID': s.labId,
                    'Status': s.status,
                    'Project': s.projectCode,
                    'Country': s.country,
                    'Received At': s.createdAt,
                    'Received By': 'System',
                    'GPS X': meta.gpsX,
                    'GPS Y': meta.gpsY
                };
            });
        }

        // Audit Log
        await prisma.auditLog.create({
            data: {
                id: exportId,
                entity: 'EXPORT',
                entityId: exportId,
                action: type,
                performedBy: user.username,
                timestamp: new Date(),
                details: JSON.stringify({
                    filters: { project, lab, startDate, endDate, viewFilters },
                    count: data.length,
                    signOff: { name: signOffName, reason: signOffReason }
                })
            }
        });

        res.json({
            success: true,
            meta: {
                exportId,
                generatedAt: timestamp,
                generatedBy: signOffName || user.name,
                recordCount: data.length,
                analysisMetadata
            },
            columns,
            data
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Export generation failed', details: e.message });
    }
};
