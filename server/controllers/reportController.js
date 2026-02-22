/**
 * Report Controller
 * Handles report generation, retrieval, search, sharing, and public access.
 */
const crypto = require('crypto');
const prisma = require('../prisma');
const { assembleReport } = require('../services/reportAssembly');

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

        // Mark any existing reports for this sample as SUPERSEDED
        const existingReports = await prisma.report.findMany({
            where: { sampleId, status: 'PUBLISHED' }
        });
        const currentVersion = existingReports.length;

        if (existingReports.length > 0) {
            await prisma.report.updateMany({
                where: { sampleId, status: 'PUBLISHED' },
                data: { status: 'SUPERSEDED' }
            });
        }

        // Assemble the report
        const { content, searchKeys } = await assembleReport(sampleId, req.user);

        // Create report record
        const report = await prisma.report.create({
            data: {
                sampleId,
                labId: sample.assignedLab || sample.labId || null,
                version: currentVersion + 1,
                status: 'PUBLISHED',
                content: JSON.stringify(content),
                generatedBy: req.user?.username || 'system',
                publishedAt: new Date(),
                ...searchKeys
            }
        });

        // Audit log
        try {
            await prisma.auditLog.create({
                data: {
                    action: 'REPORT_GENERATED',
                    userId: req.user?.id || 'system',
                    details: JSON.stringify({
                        reportId: report.id,
                        sampleId,
                        version: report.version,
                        labId: report.labId
                    })
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

        res.json({
            ...report,
            content: report.content ? JSON.parse(report.content) : null
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
        const report = await prisma.report.findFirst({
            where: { sampleId, status: 'PUBLISHED' },
            orderBy: { version: 'desc' }
        });

        if (!report) {
            return res.status(404).json({ error: 'No published report for this sample' });
        }

        res.json({
            ...report,
            content: report.content ? JSON.parse(report.content) : null
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
        const { q, status, page = 1, limit = 25 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};

        // Status filter
        if (status) {
            where.status = status;
        } else {
            where.status = 'PUBLISHED'; // Default to published
        }

        // Full-text search across denormalized keys
        if (q && q.trim()) {
            const term = q.trim();
            // Digits-only? Search phone
            const isPhone = /^\d+$/.test(term.replace(/[+\-\s()]/g, ''));

            where.OR = [
                { firstName: { contains: term, mode: 'insensitive' } },
                { surname: { contains: term, mode: 'insensitive' } },
                { projectCode: { contains: term, mode: 'insensitive' } },
                { projectName: { contains: term, mode: 'insensitive' } },
                { sampleLabId: { contains: term, mode: 'insensitive' } },
                { sampleId: { contains: term, mode: 'insensitive' } }
            ];

            if (isPhone) {
                where.OR.push({ phoneNorm: { contains: term.replace(/\D/g, '') } });
            } else {
                where.OR.push({ phone: { contains: term, mode: 'insensitive' } });
            }
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
 * Public PDF download via token.
 * Returns the report content as JSON (PDF rendering done client-side with pdfmake).
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
        // Return content for client-side PDF rendering
        res.json({
            format: 'pdf',
            content: report.content ? JSON.parse(report.content) : null,
            version: report.version,
            generatedAt: report.generatedAt
        });
    } catch (err) {
        console.error('[Report] Public PDF error:', err);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
}

module.exports = {
    generateReport,
    getReport,
    getReportBySample,
    searchReports,
    createShareLink,
    listShareLinks,
    revokeShareLink,
    getPublicReport,
    getPublicReportPdf
};
