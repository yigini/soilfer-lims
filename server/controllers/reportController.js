/**
 * Report Controller
 * Handles report generation, retrieval, search, sharing, and public access.
 */
const crypto = require('crypto');
const prisma = require('../prisma');
const { assembleReport } = require('../services/reportAssembly');
const { generateReportPdfBuffer } = require('../services/pdfGenerator');

// ─── HELPERS ─────────────────────────────────────────────

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ─── INTERNAL ENDPOINTS ──────────────────────────────────

/**
 * POST /api/reports/generate/:sampleId
 * Generate a report for a sample. Creates a PUBLISHED report.
 */
async function generateReport(req, res) {
    try {
        const { sampleId } = req.params;

        // Check if sample exists
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        if (!sample) {
            return res.status(404).json({ error: 'Sample not found' });
        }

        // S06: Lab Scope Check
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample not in your Lab scope' });
        }

        // R1: Enforce publication authority & sample approval state
        const { canPublish } = require('../services/workEligibility');
        const publishCheck = canPublish(sample, null, req.user);
        if (!publishCheck.allowed) {
            return res.status(403).json({ error: publishCheck.reason, code: 'PUBLISH_DENIED' });
        }

        // S13: Find max historical version across ALL reports for this sample to ensure strictly monotonic versioning
        const maxReport = await prisma.report.findFirst({
            where: { sampleId },
            orderBy: { version: 'desc' }
        });
        const version = (maxReport?.version || 0) + 1;

        // Assemble the report
        const { content, searchKeys } = await assembleReport(sampleId, req.user);

        // Append version to report number
        if (content.reportNumber) {
            content.reportNumber = `${content.reportNumber}-v${version}`;
        }

        // S13: Supersede existing published reports and create new report atomically under transaction
        const [_, report] = await prisma.$transaction([
            prisma.report.updateMany({
                where: { sampleId, status: 'PUBLISHED' },
                data: { status: 'SUPERSEDED' }
            }),
            prisma.report.create({
                data: {
                    sampleId,
                    labId: sample.assignedLab || sample.labId || null,
                    version,
                    status: 'PUBLISHED',
                    content: JSON.stringify(content),
                    generatedBy: req.user?.username || 'system',
                    publishedAt: new Date(),
                    ...searchKeys
                }
            })
        ]);

        // Audit log
        try {
            await prisma.auditLog.create({
                data: {
                    id: `audit-rpt-${Date.now()}`,
                    entity: 'REPORT',
                    entityId: report.id,
                    sampleId,
                    action: 'REPORT_GENERATED',
                    performedBy: req.user?.id || 'system',
                    performedByName: req.user?.name || req.user?.username || 'System',
                    details: `Official Certificate of Analysis report version ${report.version} generated.`
                }
            });
        } catch (e) { /* audit is best-effort */ }

        res.json({
            id: report.id,
            version: report.version,
            status: report.status,
            sampleId: report.sampleId,
            sampleLabId: report.sampleLabId,
            generatedAt: report.generatedAt,
            generatedBy: report.generatedBy
        });
    } catch (err) {
        console.error('[Report] Generate error:', err);
        res.status(500).json({ error: err.message || 'Failed to generate report' });
    }
}

/**
 * GET /api/reports/:reportId
 * Fetch a report with its full content.
 */
async function getReport(req, res) {
    try {
        const { reportId } = req.params;
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: {
                shareLinks: {
                    where: { isRevoked: false },
                    select: { id: true, expiresAt: true, createdAt: true, createdBy: true }
                }
            }
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // S24: Lab Scope Check
        const scopeGuard = require('../utils/scopeGuard');
        const sample = await prisma.sample.findUnique({ where: { id: report.sampleId } });
        if (sample && !scopeGuard.canAccessEntity(req.user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Report not in your Lab scope' });
        }

        // R1: External and general viewers can only view PUBLISHED reports
        if (['EXTERNAL_VIEWER', 'VIEWER'].includes(req.user?.role) && report.status !== 'PUBLISHED') {
            return res.status(403).json({ error: 'Access denied: Only published reports are viewable by external viewers' });
        }

        res.json({
            ...report,
            content: report.content ? (typeof report.content === 'string' ? JSON.parse(report.content) : report.content) : null
        });
    } catch (err) {
        console.error('[Report] Get error:', err);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
}

/**
 * GET /api/reports/sample/:sampleId
 * Get latest published report for a sample.
 */
async function getReportBySample(req, res) {
    try {
        const { sampleId } = req.params;

        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        if (!sample) {
            return res.status(404).json({ error: 'Sample not found' });
        }

        // S24: Lab Scope Check
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample not in your Lab scope' });
        }

        let report = await prisma.report.findFirst({
            where: { sampleId, status: { in: ['PUBLISHED', 'APPROVED'] } },
            orderBy: { version: 'desc' }
        });

        // Non-external users can fall back to latest draft report
        if (!report && !['EXTERNAL_VIEWER', 'VIEWER'].includes(req.user?.role)) {
            report = await prisma.report.findFirst({
                where: { sampleId },
                orderBy: { version: 'desc' }
            });
        }

        if (!report) {
            return res.json(null);
        }

        res.json({
            ...report,
            content: report.content ? (typeof report.content === 'string' ? JSON.parse(report.content) : report.content) : null
        });
    } catch (err) {
        console.error('[Report] Get by sample error:', err);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
}

/**
 * GET /api/reports/search
 * Search reports by name, phone, project, labId, sampleId.
 */
async function searchReports(req, res) {
    try {
        const { q, status, page = 1, limit = 25, projectId } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};

        // R-9 & R1: Scoping — non-admin users only see reports in their authorized scope
        const userRole = req.user?.role;
        const userLab = req.user?.labId;
        const userProjects = req.user?.projects ? (typeof req.user.projects === 'string' ? JSON.parse(req.user.projects) : req.user.projects) : [];

        if (userLab && !['SUPER_ADMIN', 'MASTER_USER'].includes(userRole)) {
            where.labId = userLab;
        }

        // R1: External and general viewers strictly view PUBLISHED reports for authorized projects
        const projectPolicyService = require('../services/projectPolicyService');

        if (['EXTERNAL_VIEWER', 'VIEWER'].includes(userRole)) {
            where.status = 'PUBLISHED';
            if (userProjects.length > 0) {
                const expandedProjects = new Set(userProjects);
                userProjects.forEach(p => {
                    const children = projectPolicyService.getProgrammeChildProjectCodes(p);
                    children.forEach(c => expandedProjects.add(c));
                });
                where.projectCode = { in: Array.from(expandedProjects) };
            } else if (!userLab) {
                return res.json({ reports: [], pagination: { total: 0, page: 1, limit: parseInt(limit), pages: 0 } });
            }
        } else if (status) {
            where.status = status;
        } else {
            where.status = 'PUBLISHED'; // Default to published
        }

        const andClauses = [];

        if (projectId) {
            const childCodes = projectPolicyService.getProgrammeChildProjectCodes(projectId);
            const candidateCodes = childCodes.length > 0 ? [String(projectId), ...childCodes] : [String(projectId)];
            if (candidateCodes.length === 1) {
                andClauses.push({
                    OR: [
                        { projectCode: candidateCodes[0] },
                        { sample: { projectCode: candidateCodes[0] } },
                        { sample: { projectId: candidateCodes[0] } }
                    ]
                });
            } else {
                andClauses.push({
                    OR: [
                        { projectCode: { in: candidateCodes } },
                        { sample: { projectCode: { in: candidateCodes } } },
                        { sample: { projectId: { in: candidateCodes } } }
                    ]
                });
            }
        }

        // Full-text search across denormalized keys
        if (q && q.trim()) {
            const term = q.trim();
            // Digits-only? Search phone
            const isPhone = /^\d+$/.test(term.replace(/[+\-\s()]/g, ''));

            const qOr = [
                { firstName: { contains: term } },
                { surname: { contains: term } },
                { projectCode: { contains: term } },
                { projectName: { contains: term } },
                { sampleLabId: { contains: term } },
                { sampleId: { contains: term } }
            ];

            if (isPhone) {
                qOr.push({ phoneNorm: { contains: term.replace(/\D/g, '') } });
            } else {
                qOr.push({ phone: { contains: term } });
            }
            andClauses.push({ OR: qOr });
        }

        if (andClauses.length > 0) {
            where.AND = andClauses;
        }

        const [reports, total] = await Promise.all([
            prisma.report.findMany({
                where,
                select: {
                    id: true,
                    sampleId: true,
                    sampleLabId: true,
                    labId: true,
                    version: true,
                    status: true,
                    firstName: true,
                    surname: true,
                    phone: true,
                    projectCode: true,
                    projectName: true,
                    generatedBy: true,
                    generatedAt: true,
                    publishedAt: true,
                    shareLinks: {
                        where: { isRevoked: false },
                        select: { id: true, expiresAt: true }
                    }
                },
                orderBy: { generatedAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.report.count({ where })
        ]);

        res.json({
            reports,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('[Report] Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
}

// ─── SHARING ENDPOINTS ───────────────────────────────────

/**
 * POST /api/reports/:reportId/share
 * Create a share link for a report.
 */
async function createShareLink(req, res) {
    try {
        const { reportId } = req.params;
        const { expiresInDays = 30 } = req.body;

        if (!['LAB_MANAGER', 'MASTER_USER', 'SUPER_ADMIN'].includes(req.user?.role)) {
            return res.status(403).json({ error: 'Access denied: Only managers can create report share links' });
        }

        const report = await prisma.report.findUnique({ where: { id: reportId } });
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        if (report.status !== 'PUBLISHED') {
            return res.status(400).json({ error: 'Only published reports can be shared' });
        }

        // Generate strong random token
        const token = generateToken();
        const tokenHashed = hashToken(token);

        const expiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null;

        const link = await prisma.reportShareLink.create({
            data: {
                reportId,
                tokenHash: tokenHashed,
                expiresAt,
                createdBy: req.user?.username || 'system'
            }
        });

        // Audit
        try {
            await prisma.auditLog.create({
                data: {
                    action: 'REPORT_SHARED',
                    userId: req.user?.id || 'system',
                    details: JSON.stringify({
                        reportId,
                        linkId: link.id,
                        expiresAt: link.expiresAt
                    })
                }
            });
        } catch (e) { /* best-effort */ }

        // Build public URL
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const publicUrl = `${baseUrl}/report/${token}`;

        res.json({
            linkId: link.id,
            token, // Only returned once, never stored
            publicUrl,
            expiresAt: link.expiresAt,
            createdAt: link.createdAt
        });
    } catch (err) {
        console.error('[Report] Share error:', err);
        res.status(500).json({ error: 'Failed to create share link' });
    }
}

/**
 * GET /api/reports/:reportId/links
 * List all share links for a report.
 */
async function listShareLinks(req, res) {
    try {
        const { reportId } = req.params;
        const links = await prisma.reportShareLink.findMany({
            where: { reportId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                expiresAt: true,
                isRevoked: true,
                createdBy: true,
                createdAt: true,
                revokedAt: true,
                revokedBy: true,
                _count: { select: { accessLogs: true } }
            }
        });

        res.json(links);
    } catch (err) {
        console.error('[Report] List links error:', err);
        res.status(500).json({ error: 'Failed to list share links' });
    }
}

/**
 * POST /api/reports/links/:linkId/revoke
 * Revoke a share link.
 */
async function revokeShareLink(req, res) {
    try {
        const { linkId } = req.params;
        const link = await prisma.reportShareLink.findUnique({ where: { id: linkId } });

        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }
        if (link.isRevoked) {
            return res.status(400).json({ error: 'Link already revoked' });
        }

        await prisma.reportShareLink.update({
            where: { id: linkId },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
                revokedBy: req.user?.username || 'system'
            }
        });

        // Audit
        try {
            await prisma.auditLog.create({
                data: {
                    action: 'REPORT_LINK_REVOKED',
                    userId: req.user?.id || 'system',
                    details: JSON.stringify({ linkId, reportId: link.reportId })
                }
            });
        } catch (e) { /* best-effort */ }

        res.json({ success: true });
    } catch (err) {
        console.error('[Report] Revoke error:', err);
        res.status(500).json({ error: 'Failed to revoke link' });
    }
}

// ─── PUBLIC ENDPOINTS ────────────────────────────────────

/**
 * GET /api/reports/public/:token
 * Public HTML report access via token.
 */
async function getPublicReport(req, res) {
    try {
        const { token } = req.params;
        const tokenHashed = hashToken(token);

        const link = await prisma.reportShareLink.findUnique({
            where: { tokenHash: tokenHashed },
            include: { report: true }
        });

        if (!link) {
            return res.status(404).json({ error: 'Report not found or link invalid' });
        }

        if (link.isRevoked) {
            return res.status(410).json({ error: 'This link has been revoked' });
        }

        if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
            return res.status(410).json({ error: 'This link has expired' });
        }

        // Log access
        try {
            await prisma.reportAccessLog.create({
                data: {
                    linkId: link.id,
                    ipAddress: req.ip || req.connection?.remoteAddress,
                    userAgent: req.get('User-Agent') || null
                }
            });
        } catch (e) { /* best-effort */ }

        const report = link.report;
        res.json({
            id: report.id,
            sampleId: report.sampleId,
            sampleLabId: report.sampleLabId,
            version: report.version,
            status: report.status,
            generatedAt: report.generatedAt,
            content: report.content ? JSON.parse(report.content) : null
        });
    } catch (err) {
        console.error('[Report] Public access error:', err);
        res.status(500).json({ error: 'Failed to load report' });
    }
}

/**
 * GET /api/reports/public/:token/pdf
 * Public PDF report download using PDFKit.
 */
async function getPublicReportPdf(req, res) {
    try {
        const { token } = req.params;
        const tokenHashed = hashToken(token);

        const link = await prisma.reportShareLink.findUnique({
            where: { tokenHash: tokenHashed },
            include: { report: true }
        });

        if (!link) {
            return res.status(404).json({ error: 'Report not found or link invalid' });
        }
        if (link.isRevoked) {
            return res.status(410).json({ error: 'This link has been revoked' });
        }
        if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
            return res.status(410).json({ error: 'This link has expired' });
        }

        // Log access
        try {
            await prisma.reportAccessLog.create({
                data: {
                    linkId: link.id,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });
        } catch (e) { /* best-effort */ }

        const report = link.report;
        const content = report.content ? (typeof report.content === 'string' ? JSON.parse(report.content) : report.content) : null;

        if (!content) {
            return res.status(404).json({ error: 'Report content not available' });
        }

        const sampleId = content.sample?.labId || content.sample?.originalId || report.sampleId || 'Report';
        const pdfBuffer = await generateReportPdfBuffer(content);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="SoilFER_Report_${sampleId}_v${report.version}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        return res.send(pdfBuffer);
    } catch (err) {
        console.error('[Report] PDF generation error:', err);
        return res.status(500).json({ error: 'Failed to generate PDF' });
    }
}

/**
 * GET /api/reports/:reportId/pdf
 * Authenticated PDF download for a specific report ID.
 */
async function getReportPdf(req, res) {
    try {
        const { reportId } = req.params;
        const report = await prisma.report.findUnique({ where: { id: reportId } });
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Scope and published check
        const scopeGuard = require('../utils/scopeGuard');
        const sample = await prisma.sample.findUnique({ where: { id: report.sampleId } });
        if (sample && !scopeGuard.canAccessEntity(req.user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Report not in your scope' });
        }

        if (['EXTERNAL_VIEWER', 'VIEWER'].includes(req.user?.role) && report.status !== 'PUBLISHED') {
            return res.status(403).json({ error: 'Access denied: Only published reports are downloadable' });
        }

        const content = report.content ? (typeof report.content === 'string' ? JSON.parse(report.content) : report.content) : null;
        if (!content) {
            return res.status(404).json({ error: 'Report content not available' });
        }

        const sampleId = content.sample?.labId || content.sample?.originalId || report.sampleId || 'Report';
        const pdfBuffer = await generateReportPdfBuffer(content);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="SoilFER_Report_${sampleId}_v${report.version}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        return res.send(pdfBuffer);
    } catch (err) {
        console.error('[Report] PDF get error:', err);
        return res.status(500).json({ error: 'Failed to generate PDF' });
    }
}

/**
 * GET /api/reports/sample/:sampleId/pdf
 * Authenticated PDF generation for a sample (uses published report or assembles on-the-fly).
 */
async function getSampleReportPdf(req, res) {
    try {
        const { sampleId } = req.params;
        let report = await prisma.report.findFirst({
            where: { sampleId, status: 'PUBLISHED' },
            orderBy: { version: 'desc' }
        });

        if (['EXTERNAL_VIEWER', 'VIEWER'].includes(req.user?.role) && !report) {
            return res.status(404).json({ error: 'No published report available for this sample' });
        }

        let content;
        if (report && report.content) {
            content = typeof report.content === 'string' ? JSON.parse(report.content) : report.content;
        } else {
            const assembled = await assembleReport(sampleId, req.user);
            content = assembled.content;
        }

        const sId = content.sample?.labId || content.sample?.originalId || sampleId;
        const pdfBuffer = await generateReportPdfBuffer(content);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="SoilFER_Certificate_${sId}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        return res.send(pdfBuffer);
    } catch (err) {
        console.error('[Report] Sample PDF error:', err);
        return res.status(500).json({ error: err.message || 'Failed to generate PDF' });
    }
}

module.exports = {
    generateReport,
    getReport,
    getReportPdf,
    getReportBySample,
    getSampleReportPdf,
    searchReports,
    createShareLink,
    listShareLinks,
    revokeShareLink,
    getPublicReport,
    getPublicReportPdf
};
