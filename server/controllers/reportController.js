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

        // Append version to report number
        const version = currentVersion + 1;
        if (content.reportNumber) {
            content.reportNumber = `${content.reportNumber}-v${version}`;
        }

        // Create report record
        const report = await prisma.report.create({
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

        // R-9: Lab-scoping — non-admin users only see reports for their lab
        const userRole = req.user?.role;
        const userLab = req.user?.labId;
        if (userLab && !['SUPER_ADMIN', 'MASTER_USER'].includes(userRole)) {
            where.labId = userLab;
        }

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
                { firstName: { contains: term } },
                { surname: { contains: term } },
                { projectCode: { contains: term } },
                { projectName: { contains: term } },
                { sampleLabId: { contains: term } },
                { sampleId: { contains: term } }
            ];

            if (isPhone) {
                where.OR.push({ phoneNorm: { contains: term.replace(/\D/g, '') } });
            } else {
                where.OR.push({ phone: { contains: term } });
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
 * Server-side PDF generation using Puppeteer.
 * Renders the public report HTML and converts to A4 PDF.
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

        // Try Puppeteer for server-side PDF
        let puppeteer;
        try {
            puppeteer = require('puppeteer');
        } catch (e) {
            console.warn('[Report] Puppeteer not available for server-side PDF generation');
            return res.status(503).json({
                error: 'PDF_SERVICE_UNAVAILABLE',
                message: 'Server-side PDF rendering is not configured on this host. Please use the in-browser print/export option.',
                version: report.version,
                generatedAt: report.generatedAt
            });
        }

        // Build the public report URL
        const host = req.get('host') || 'localhost:4000';
        const protocol = req.protocol || 'http';
        const publicUrl = `${protocol}://${host}/report/${token}`;

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        try {
            const page = await browser.newPage();
            await page.goto(publicUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            // Wait a bit for React to render
            await page.waitForSelector('.report-container', { timeout: 10000 }).catch(() => { });

            const labName = content.lab?.name || 'Laboratory';
            const sampleId = content.sample?.labId || content.sample?.originalId || 'Report';

            const pdfBuffer = await page.pdf({
                format: 'A4',
                margin: { top: '20mm', bottom: '25mm', left: '15mm', right: '15mm' },
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: `<div style="width:100%;font-size:8px;padding:5mm 15mm;color:#999;display:flex;justify-content:space-between;"><span>${labName}</span><span>Soil Analysis Report — ${sampleId}</span></div>`,
                footerTemplate: `<div style="width:100%;font-size:7px;padding:5mm 15mm;color:#999;border-top:0.5px solid #ddd;display:flex;justify-content:space-between;"><span>Generated ${new Date(report.generatedAt).toLocaleDateString()}</span><span>v${report.version}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`
            });

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="report-${sampleId}-v${report.version}.pdf"`,
                'Content-Length': pdfBuffer.length
            });
            res.send(pdfBuffer);
        } finally {
            await browser.close();
        }
    } catch (err) {
        console.error('[Report] PDF generation error:', err);
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
