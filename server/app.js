const express = require('express');
require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const prisma = require('./prisma');
const { randomUUID: uuidv4 } = require('crypto');
const localeMiddleware = require('./middleware/localeMiddleware');
const { success, error } = require('./i18n/response');

const app = express();
// Enable if behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "default-src": ["'self'", "https://*.cesium.com", "https://cesium.com"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cesium.com", "https://*.cesium.com", "https://cdnjs.cloudflare.com", "https://*.virtualearth.net"],
            "style-src": ["'self'", "'unsafe-inline'", "https://cesium.com", "https://*.cesium.com", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "img-src": ["'self'", "data:", "blob:", "https://api.qrserver.com", "https://cesium.com", "https://*.cesium.com", "https://*.openstreetmap.org", "https://*.cartocdn.com", "https://*.basemaps.cartocdn.com", "https://*.virtualearth.net", "https://*.arcgisonline.com", "https://server.arcgisonline.com", "https://mt1.google.com", "https://*.google.com", "https://cdnjs.cloudflare.com", "https://images.unsplash.com"],
            "connect-src": ["'self'", "https://cesium.com", "https://*.cesium.com", "https://api.cesium.com", "https://assets.cesium.com", "https://*.virtualearth.net", "https://*.openstreetmap.org", "https://*.cartocdn.com", "https://*.basemaps.cartocdn.com", "https://*.arcgisonline.com", "https://server.arcgisonline.com", "https://mt1.google.com", "https://*.google.com"],
            "media-src": ["'self'", "https://ssl.gstatic.com"],
            "worker-src": ["'self'", "blob:", "https://*.cesium.com", "https://cesium.com"],
            "child-src": ["'self'", "blob:", "https://*.cesium.com", "https://cesium.com"]
        }
    }
}));
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['http://localhost:5173', 'https://lims.yigini.net', 'http://lims.yigini.net']
        : '*',
    credentials: true
}));

// Rate Limiting
if (process.env.NODE_ENV !== 'test') {
    // Global Rate Limiter for API routes (DoS protection)
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // 1000 requests per 15 min per IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests from this IP, please try again later.' }
    });
    app.use('/api', apiLimiter);

    // Strict Rate Limiter for Login / Credential Endpoints (brute force protection)
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 30, // Limit to 30 login attempts per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many login attempts, please try again later.' }
    });
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);
}

// Scoped body parser limits: 2mb default, 50mb for bulk import & spectral batches
app.use('/api/import', express.json({ limit: '50mb' }));
app.use('/api/import', express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/spectral', express.json({ limit: '50mb' }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Global Localization & Response Standardization Middleware
app.use(localeMiddleware);
app.use((req, res, next) => {
    // Attach helpers to res object for easy access in controllers
    // partial application to pass 'res' automatically
    res.success = (code, msg, params, status, data) => success(res, code, msg, params, status, data);
    res.error = (status, code, msg, params, data) => error(res, status, code, msg, params, data);
    next();
});

// Public (no-auth) routes
app.use('/api/public', publicRoutes);

// Seed Users: Handled by reset_admin.js or external scripts
// Seed Messages: Handled by migrations or external scripts


// --- Routes ---
const jwt = require('jsonwebtoken');
const { verifyToken, checkPermission } = require('./middleware/authMiddleware');
if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not defined in environment variables.');
    process.exit(1);
}
const SECRET_KEY = process.env.JWT_SECRET;

// Health Check (used by Docker healthcheck)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Background Schedulers Lifecycle Management
let backupScheduleInterval = null;

function startBackgroundSchedulers() {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_BACKGROUND_JOBS === 'true' || process.env.ENABLE_BACKGROUND_JOBS === 'false') {
        return;
    }

    // Automated Daily Database Backup Schedule (runs every 24h)
    try {
        if (!backupScheduleInterval) {
            const { performBackup } = require('./scripts/backup_db');
            const ONE_DAY_MS = 24 * 60 * 60 * 1000;
            backupScheduleInterval = setInterval(() => {
                performBackup()
                    .then(p => p && console.log(`[BACKUP_SCHEDULE] Completed: ${p}`))
                    .catch(e => console.error('[BACKUP_SCHEDULE] Error:', e.message));
            }, ONE_DAY_MS);
            console.log('[BACKUP_SCHEDULE] Backup interval active (24h)');
        }
    } catch (e) {
        console.warn('[BACKUP_SCHEDULE] Could not initialize automated backup interval:', e.message);
    }

    // Automated KoboToolbox Background Sync Scheduler
    try {
        const { startScheduler } = require('./services/koboScheduler');
        startScheduler(60000); // Check every 60s
    } catch (e) {
        console.warn('[KOBO_SCHEDULER] Could not start Kobo scheduler:', e.message);
    }
}

function stopBackgroundSchedulers() {
    if (backupScheduleInterval) {
        clearInterval(backupScheduleInterval);
        backupScheduleInterval = null;
    }
    try {
        const { stopScheduler } = require('./services/koboScheduler');
        stopScheduler();
    } catch (_) {}
}

startBackgroundSchedulers();

app.startBackgroundSchedulers = startBackgroundSchedulers;
app.stopBackgroundSchedulers = stopBackgroundSchedulers;

if (process.env.NODE_ENV !== 'production') {
    app.get('/', (req, res) => {
        res.send('Enterprise Server running and healthy.');
    });
}

// Canonical Audit Logs Route
app.get('/api/audit-final', verifyToken, checkPermission('VIEW_AUDIT'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = (req.query.search || '').toLowerCase();
        const category = req.query.category || 'ALL';

        const user = req.user;
        const userRole = (user.role || '').toUpperCase().trim();
        const userLabId = user.labId;

        console.log(`[AUDIT_SECURITY] Request by ${user.username} | Role: ${userRole} | Lab: ${userLabId}`);

        const where = {};

        // 1. Mandatory Isolation (The Forge)
        if (userRole !== 'SUPER_ADMIN') {
            if (userLabId) {
                // If lab staff: They see logs for their lab OR logs they performed.
                where.OR = [
                    { labId: userLabId },
                    { performedBy: user.username }
                ];
                console.log(`[AUDIT_SECURITY] Scoping to Lab: ${userLabId}`);
            } else {
                // If regional staff without a lab: They only see their own manual actions for now.
                where.performedBy = user.username;
                console.log(`[AUDIT_SECURITY] Scoping to User only: ${user.username}`);
            }
        } else {
            console.log(`[AUDIT_SECURITY] Full Access (SUPER_ADMIN)`);
        }

        // 2. Filters
        const operationalActions = ['SAMPLE_CREATED', 'STATUS_CHANGE', 'WORKITEM_GENERATED', 'RESULTS_ENTERED', 'APPROVAL_GIVEN', 'Sample Created', 'Sample Updated', 'Sample Deleted', 'AUTO_CREATE', 'SPECTRA_UPLOAD'];

        if (category === 'OPERATIONAL') {
            where.action = { in: operationalActions };
        } else if (category === 'SYSTEM') {
            where.action = { notIn: operationalActions };
        }

        if (search) {
            const searchTerm = { contains: search };
            const searchConditions = [
                { action: searchTerm },
                { performedBy: searchTerm },
                { details: searchTerm },
                { entityId: searchTerm }
            ];

            if (where.OR) {
                // Combine RBAC OR with Search OR using AND
                where.AND = [
                    { OR: where.OR },
                    { OR: searchConditions }
                ];
                delete where.OR;
            } else {
                where.OR = searchConditions;
            }
        }

        const [total, logs] = await prisma.$transaction([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            })
        ]);

        const mappedLogs = logs.map(log => {
            const logAction = log.action || '';
            const isOperational = operationalActions.includes(logAction);
            return {
                ...log,
                user: log.performedBy || 'System',
                time: log.timestamp,
                details: log.details || (log.entity ? `${log.entity} ${log.entityId || ''}` : '-'),
                category: isOperational ? 'OPERATIONAL' : 'SYSTEM'
            };
        });

        res.json({
            data: mappedLogs,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        console.error("[AUDIT_ERROR] Critical failure in audit retrieval:", e);
        res.status(500).json({ error: 'Internal Security Gate Error' });
    }
});

// --- Routes ---
app.use('/api/admin', verifyToken, adminRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/access', require('./routes/accessRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/config', require('./routes/analysisRoutes'));

app.use('/api/samples', verifyToken, require('./routes/sampleRoutes'));
app.use('/api/results', verifyToken, require('./routes/resultsRoutes'));
app.use('/api/data-results', verifyToken, require('./routes/dataResultsRoutes'));
app.use('/api/inventory', verifyToken, require('./routes/inventoryRoutes'));
app.use('/api/equipment', verifyToken, require('./routes/equipmentRoutes'));
const spectralRoutes = require('./routes/spectralRoutes');

app.use('/api/spectral', spectralRoutes);
app.use('/api/reception', verifyToken, require('./routes/receptionRoutes'));
app.use('/api/work', verifyToken, require('./routes/workRoutes'));
app.use('/api/workbench', verifyToken, require('./routes/workbenchRoutes'));
app.use('/api/sync', require('./routes/syncRoutes'));
app.use('/api/offline', require('./routes/offlineRoutes'));
app.use('/api/labs', verifyToken, require('./routes/labRoutes'));
app.use('/api/exports', verifyToken, require('./routes/exportRoutes'));
app.use('/api/import', require('./routes/importRoutes'));
app.use('/api/reports', require('./routes/reportRoutes')); // auth handled internally (has public routes)
app.use('/api/qc', verifyToken, require('./routes/qcRoutes'));
app.use('/api/pt', require('./routes/ptRoutes'));
app.use('/api/submissions', verifyToken, require('./routes/submissionRoutes'));
app.use('/api/reviews', verifyToken, require('./routes/reviewRoutes'));
app.use('/api/notifications', verifyToken, require('./routes/notificationRoutes'));
app.use('/api/auth', require('./routes/authRoutes')); // auth handled internally (has login)
app.use('/api/messages', verifyToken, require('./routes/messageRoutes'));
app.use('/api/help', require('./routes/helpRoutes'));
app.use('/api/v1/data-exchange', require('./routes/sisRoutes')); // Neutral National Data Exchange API (v1)
app.use('/api/v1/sis', require('./routes/sisRoutes')); // Legacy backward-compatible alias
// Kobo media proxy — no JWT auth because <img> tags can't send headers.
// Security: (1) only proxies to known Kobo hosts from active configs, (2) HTTPS only, (3) URL scheme validation.
const koboController = require('./controllers/koboController');
app.get('/api/kobo/media', koboController.proxyMedia);

// Kobo API routes (authenticated)
app.use('/api/kobo', verifyToken, require('./routes/koboRoutes'));

// Canonical dashboard routes
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// ─── UNIFIED LIVE DASHBOARD ENDPOINT (Backward Compatibility) ───
app.get('/api/dashboard/live', verifyToken, async (req, res) => {
    const user = req.user;
    const qLabId = (req.query.labId || req.query.labs || '').trim();
    const effectiveLabId = (user.role === 'SUPER_ADMIN' && qLabId) ? qLabId : (user.role !== 'SUPER_ADMIN' ? user.labId : null);
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Build RBAC scoping using central scopeGuard
        const scopeGuard = require('./utils/scopeGuard');
        let sampleWhere = scopeGuard.buildScopedWhere(user, {}, { entityType: 'Sample' });
        let workWhere = scopeGuard.buildScopedWhere(user, {}, { entityType: 'WorkItem' });

        // Safe query condition composer: prevents overwriting top-level scope OR clauses
        const composeWhere = (scope, condition) => {
            if (!scope || Object.keys(scope).length === 0) return condition || {};
            if (!condition || Object.keys(condition).length === 0) return scope;
            return { AND: [scope, condition] };
        };

        if (user.role === 'SUPER_ADMIN' && qLabId) {
            const labCondition = {
                OR: [
                    { assignedLab: qLabId },
                    { labId: qLabId }
                ]
            };
            sampleWhere = composeWhere(sampleWhere, labCondition);
            workWhere = composeWhere(workWhere, labCondition);
        }

        // ── LAB_MANAGER / SUPER_ADMIN ──
        if (['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            // KPIs
            const [pendingIntakes, totalSamples, inProgress, completedToday] = await Promise.all([
                prisma.sample.count({ where: { ...sampleWhere, status: { in: ['RECEIVED', 'COLLECTED'] } } }),
                prisma.sample.count({ where: sampleWhere }),
                prisma.sample.count({ where: { ...sampleWhere, status: { in: ['PROCESSING', 'PREPARATION', 'ANALYSIS', 'PARTIALLY_COMPLETE'] } } }),
                prisma.sample.count({ where: { ...sampleWhere, status: 'COMPLETED', updatedAt: { gte: today } } }),
            ]);

            // Work items - Scoped via Scope Guard
            const [unassignedTasks, allWork] = await Promise.all([
                prisma.workItem.count({ where: { ...workWhere, status: { in: ['NOT_ASSIGNED', 'PENDING'] }, assignedTo: null } }),
                prisma.workItem.findMany({ where: workWhere, orderBy: { createdAt: 'desc' }, take: 500 }),
            ]);

            // Submissions pending review
            let awaitingReview = 0;
            let reviewQueue = [];
            try {
                const subWhere = { status: 'PENDING_REVIEW' };
                if (effectiveLabId) {
                    subWhere.OR = [
                        { assignedLab: effectiveLabId },
                        { labId: effectiveLabId }
                    ];
                }
                const [subCount, submissions] = await Promise.all([
                    prisma.submission.count({ where: subWhere }),
                    prisma.submission.findMany({
                        where: subWhere,
                        orderBy: { submittedAt: 'desc' },
                        take: 20,
                    })
                ]);
                awaitingReview = subCount;
                // Aggregate by sample
                const reviewGroups = {};
                submissions.forEach(sub => {
                    if (!reviewGroups[sub.sampleId]) {
                        reviewGroups[sub.sampleId] = {
                            sampleId: sub.sampleId,
                            labId: sub.labId || sub.sampleId,
                            submittedBy: sub.submittedBy,
                            submittedAt: sub.submittedAt,
                            count: 1,
                            types: [sub.type],
                        };
                    } else {
                        reviewGroups[sub.sampleId].count++;
                        if (!reviewGroups[sub.sampleId].types.includes(sub.type)) {
                            reviewGroups[sub.sampleId].types.push(sub.type);
                        }
                    }
                });
                reviewQueue = Object.values(reviewGroups);
            } catch (e) { /* submission model may not exist */ }

            // Intake queue (latest 10 RECEIVED samples)
            const intakeQueue = await prisma.sample.findMany({
                where: { ...sampleWhere, status: { in: ['RECEIVED', 'COLLECTED'] } },
                orderBy: { receptionDate: 'desc' },
                take: 10,
                select: { id: true, originalId: true, labId: true, projectCode: true, receptionDate: true, receivedBy: true, clientName: true, status: true },
            });

            // Oversight — progress per lab ID
            const sampleGroups = {};
            allWork.forEach(i => {
                const key = i.labId || 'Unknown';
                if (!sampleGroups[key]) sampleGroups[key] = { total: 0, completed: 0, sampleId: i.sampleId };
                sampleGroups[key].total++;
                if (i.status === 'COMPLETED') sampleGroups[key].completed++;
            });
            const oversight = Object.entries(sampleGroups)
                .map(([labId, s]) => ({
                    labId, sampleId: s.sampleId, total: s.total, completed: s.completed,
                    progress: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
                }))
                .filter(s => s.total > 0)
                .sort((a, b) => b.progress - a.progress)
                .slice(0, 15);

            // Tech workload
            const techs = await prisma.user.findMany({
                where: { role: 'LAB_TECHNICIAN', isActive: true, ...(effectiveLabId ? { labId: effectiveLabId } : {}) },
                select: { id: true, username: true, name: true },
            });
            const techWorkload = techs.map(t => {
                const assigned = allWork.filter(w => w.assignedTo === t.username);
                return {
                    username: t.username,
                    name: t.name || t.username,
                    assigned: assigned.length,
                    completed: assigned.filter(w => w.status === 'COMPLETED').length,
                    pending: assigned.filter(w => ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(w.status)).length,
                };
            });

            // Recent activity (last 10) scoped to laboratory
            let recentLogs;
            if (effectiveLabId) {
                recentLogs = await prisma.$queryRaw`
                    SELECT DISTINCT a.* FROM AuditLog a
                    LEFT JOIN Sample s ON (a.sampleId = s.id OR a.entityId = s.id)
                    LEFT JOIN User u ON a.performedBy = u.username
                    WHERE (
                        a.labId = ${effectiveLabId}
                        OR s.labId = ${effectiveLabId}
                        OR s.assignedLab = ${effectiveLabId}
                        OR u.labId = ${effectiveLabId}
                    )
                    ORDER BY a.timestamp DESC
                    LIMIT 10
                `;
            } else if (user.role === 'SUPER_ADMIN') {
                recentLogs = await prisma.auditLog.findMany({
                    orderBy: { timestamp: 'desc' },
                    take: 10,
                });
            } else {
                recentLogs = await prisma.auditLog.findMany({
                    where: { performedBy: user.username },
                    orderBy: { timestamp: 'desc' },
                    take: 10,
                });
            }
            const recentActivity = recentLogs.map(log => ({
                id: log.id,
                action: log.action,
                details: log.details || `${log.entity} ${log.entityId}`,
                time: log.timestamp,
                user: log.performedBy,
            }));

            // Warnings
            const warnings = [];
            if (pendingIntakes > 5) warnings.push({ type: 'HIGH_INTAKE', message: `${pendingIntakes} samples waiting for intake acceptance`, severity: 'MEDIUM' });
            if (unassignedTasks > 10) warnings.push({ type: 'UNASSIGNED', message: `${unassignedTasks} work items need assignment`, severity: 'HIGH' });
            if (awaitingReview > 0) warnings.push({ type: 'REVIEW', message: `${awaitingReview} submissions awaiting review`, severity: 'MEDIUM' });

            return res.json({
                role: user.role,
                kpis: { pendingIntakes, unassignedTasks, inProgress, awaitingReview, completedToday, totalSamples },
                intakeQueue,
                reviewQueue,
                oversight,
                techWorkload,
                recentActivity,
                warnings,
                timestamp: new Date(),
            });
        }

        // ── LAB_TECHNICIAN ──
        if (user.role === 'LAB_TECHNICIAN') {
            const myWork = await prisma.workItem.findMany({
                where: { assignedTo: user.username },
                orderBy: { createdAt: 'desc' },
                take: 200,
            });

            const activeItems = myWork.filter(w => ['ASSIGNED', 'PENDING', 'IN_PROGRESS'].includes(w.status));
            const completedToday = myWork.filter(w => w.status === 'COMPLETED' && w.updatedAt >= today).length;
            const reanalysis = myWork.filter(w => w.status === 'REANALYSIS_REQUIRED');

            // Group by sample
            const sampleGroups = {};
            activeItems.forEach(item => {
                const key = item.sampleId;
                if (!sampleGroups[key]) {
                    sampleGroups[key] = {
                        sampleId: key,
                        labId: item.labId || key,
                        analyses: [item.analysis],
                        statuses: [item.status],
                        priority: item.priority,
                        items: [item],
                        createdAt: item.createdAt,
                    };
                } else {
                    if (!sampleGroups[key].analyses.includes(item.analysis)) sampleGroups[key].analyses.push(item.analysis);
                    sampleGroups[key].statuses.push(item.status);
                    sampleGroups[key].items.push(item);
                    if (item.priority === 'URGENT') sampleGroups[key].priority = 'URGENT';
                }
            });

            const myQueue = Object.values(sampleGroups).sort((a, b) => {
                if (a.priority === 'URGENT' && b.priority !== 'URGENT') return -1;
                if (b.priority === 'URGENT' && a.priority !== 'URGENT') return 1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            const warnings = [];
            if (reanalysis.length > 0) warnings.push({ type: 'REANALYSIS', message: `${reanalysis.length} item(s) need reanalysis`, severity: 'HIGH' });

            return res.json({
                role: user.role,
                kpis: { assignedToMe: activeItems.length, inProgress: activeItems.filter(w => w.status === 'IN_PROGRESS').length, completedToday, reanalysisRequired: reanalysis.length },
                myQueue,
                reanalysis: reanalysis.map(r => ({ id: r.id, sampleId: r.sampleId, labId: r.labId, analysis: r.analysis, reason: r.reanalysisReason })),
                warnings,
                timestamp: new Date(),
            });
        }

        // ── SAMPLE_RECEPTION ──
        if (user.role === 'SAMPLE_RECEPTION') {
            // Determine laboratory timezone
            let labTimezone = 'UTC';
            if (user.labId) {
                try {
                    const labRec = await prisma.lab.findUnique({
                        where: { id: user.labId },
                        select: { timezone: true }
                    });
                    if (labRec?.timezone) labTimezone = labRec.timezone;
                } catch { /* fallback to UTC */ }
            }

            // Calculate half-open day interval [dayStart, dayEnd) in lab timezone
            const now = new Date();
            let dayStart, dayEnd;
            try {
                const dateParts = new Intl.DateTimeFormat('en-CA', {
                    timeZone: labTimezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(now);
                const getTzOffsetMs = (date, tz) => {
                    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
                    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
                    return utcDate.getTime() - tzDate.getTime();
                };
                const approxDate = new Date(`${dateParts}T00:00:00Z`);
                const offset = getTzOffsetMs(approxDate, labTimezone);
                dayStart = new Date(approxDate.getTime() + offset);
                dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            } catch {
                dayStart = new Date(today);
                dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            }

            // Determine operational gate applicability for this laboratory
            let isDryingApplicable = true;
            try {
                const dryingGate = await prisma.operationalGate.findFirst({
                    where: {
                        code: 'DRYING',
                        isActive: true,
                        ...(user.labId ? { OR: [{ labId: user.labId }, { labId: null }] } : {})
                    }
                });
                const totalConfiguredGates = await prisma.operationalGate.count({
                    where: user.labId ? { OR: [{ labId: user.labId }, { labId: null }] } : {}
                });
                if (totalConfiguredGates > 0 && !dryingGate) {
                    isDryingApplicable = false;
                }
            } catch {
                isDryingApplicable = true;
            }

            // Explicit Reception KPIs
            const [
                expectedArrivals,
                incompleteDrafts,
                receivedToday,
                needsAttention,
                totalProcessed,
                pendingDrying,
                pendingPreparation
            ] = await Promise.all([
                // 1. Expected arrivals (registered in project manifest but not yet received)
                prisma.sample.count({
                    where: composeWhere(sampleWhere, { status: 'EXPECTED' })
                }),
                // 2. Incomplete drafts (in-progress intake drafts)
                prisma.sample.count({
                    where: composeWhere(sampleWhere, { status: 'DRAFT' })
                }),
                // 3. Received today (half-open day interval in lab timezone, excluding EXPECTED/DRAFT)
                prisma.sample.count({
                    where: composeWhere(sampleWhere, {
                        receptionDate: { gte: dayStart, lt: dayEnd },
                        status: { notIn: ['EXPECTED', 'DRAFT'] }
                    })
                }),
                // 4. Needs attention: rejected intake, non-conformance, or overdue unreviewed
                prisma.sample.count({
                    where: composeWhere(sampleWhere, {
                        OR: [
                            { status: 'RECEIVED_REJECTED' },
                            { status: 'RECEIVED', receptionDate: { lt: dayStart } }
                        ]
                    })
                }),
                // 5. Total registered in scope
                prisma.sample.count({ where: sampleWhere }),
                // 6. Operational handoff: strictly received/accepted samples awaiting drying
                //    Excludes unreceived EXPECTED and DRAFT samples, and closed/approved samples
                isDryingApplicable
                    ? prisma.sample.count({
                        where: composeWhere(sampleWhere, {
                            status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING'] },
                            receptionDate: { not: null },
                            dryingStatus: 'PENDING'
                        })
                    })
                    : 0,
                // 7. Operational handoff: strictly received/accepted samples ready for preparation
                //    Missing drying is unknown, not waived; requires dryingStatus: DONE when applicable
                prisma.sample.count({
                    where: composeWhere(sampleWhere, {
                        status: { in: ['RECEIVED', 'ACCEPTED', 'PROCESSING', 'PREPARATION'] },
                        receptionDate: { not: null },
                        preparationStatus: 'PENDING',
                        ...(isDryingApplicable ? { dryingStatus: 'DONE' } : {})
                    })
                })
            ]);

            // Scoped queues for Reception Dashboard tabs
            const [rawRecentIntakes, draftQueue, rawExpectedQueue, attentionQueue] = await Promise.all([
                // Today's receipts
                prisma.sample.findMany({
                    where: composeWhere(sampleWhere, {
                        receptionDate: { gte: dayStart, lt: dayEnd },
                        status: { notIn: ['EXPECTED', 'DRAFT'] }
                    }),
                    orderBy: { receptionDate: 'desc' },
                    take: 20,
                    select: {
                        id: true, originalId: true, labId: true, projectCode: true,
                        projectId: true, clientName: true, receptionDate: true,
                        receivedBy: true, status: true, dryingStatus: true,
                        preparationStatus: true, latitude: true, longitude: true
                    }
                }),
                // Incomplete drafts
                prisma.sample.findMany({
                    where: composeWhere(sampleWhere, { status: 'DRAFT' }),
                    orderBy: { updatedAt: 'desc' },
                    take: 20,
                    select: {
                        id: true, originalId: true, labId: true, projectCode: true,
                        projectId: true, clientName: true, updatedAt: true,
                        receivedBy: true, status: true
                    }
                }),
                // Expected arrivals
                prisma.sample.findMany({
                    where: composeWhere(sampleWhere, { status: 'EXPECTED' }),
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    select: {
                        id: true, originalId: true, projectCode: true,
                        projectId: true, clientName: true, createdAt: true,
                        status: true, latitude: true, longitude: true,
                        fieldMetadata: true
                    }
                }),
                // Needs attention (rejected or unreviewed)
                prisma.sample.findMany({
                    where: composeWhere(sampleWhere, {
                        OR: [
                            { status: 'RECEIVED_REJECTED' },
                            { status: 'RECEIVED', receptionDate: { lt: dayStart } }
                        ]
                    }),
                    orderBy: { updatedAt: 'desc' },
                    take: 20,
                    select: {
                        id: true, originalId: true, labId: true, projectCode: true,
                        projectId: true, clientName: true, receptionDate: true,
                        status: true, rejectionReason: true, updatedAt: true
                    }
                })
            ]);

            // Normalize lean provenance in previews without transmitting raw fieldMetadata blobs
            const recentIntakes = rawRecentIntakes.map(s => ({
                id: s.id,
                originalId: s.originalId,
                labId: s.labId,
                projectCode: s.projectCode,
                projectId: s.projectId,
                clientName: s.clientName,
                receptionDate: s.receptionDate,
                receivedBy: s.receivedBy,
                status: s.status,
                dryingStatus: s.dryingStatus,
                preparationStatus: s.preparationStatus,
                hasCoordinates: Boolean(s.latitude != null && s.longitude != null)
            }));

            const expectedQueue = rawExpectedQueue.map(s => {
                let hasCoords = Boolean(s.latitude != null && s.longitude != null);
                if (!hasCoords && s.fieldMetadata) {
                    try {
                        const fm = typeof s.fieldMetadata === 'string' ? JSON.parse(s.fieldMetadata) : s.fieldMetadata;
                        hasCoords = Boolean(fm?.latitude || fm?.lat || fm?.gps || fm?.coordinates);
                    } catch {}
                }
                return {
                    id: s.id,
                    originalId: s.originalId,
                    projectCode: s.projectCode,
                    projectId: s.projectId,
                    clientName: s.clientName,
                    createdAt: s.createdAt,
                    status: s.status,
                    hasCoordinates: hasCoords
                };
            });

            return res.json({
                role: user.role,
                timezone: labTimezone,
                kpis: {
                    expectedArrivals,
                    incompleteDrafts,
                    receivedToday,
                    needsAttention,
                    totalProcessed,
                    totalRegistered: totalProcessed,
                    pendingDrying,
                    pendingPreparation,
                    waitingDrying: pendingDrying,
                    readyPreparation: pendingPreparation
                },
                recentIntakes,
                draftQueue,
                expectedQueue,
                attentionQueue,
                warnings: [],
                timestamp: new Date()
            });
        }

        // ── PROJECT_MANAGER / COUNTRY_ADMIN / VIEWER / others ──
        const [totalSamples, inProgress, receivedToday] = await Promise.all([
            prisma.sample.count({ where: sampleWhere }),
            prisma.sample.count({ where: { ...sampleWhere, status: { in: ['RECEIVED', 'PREPARATION', 'ANALYSIS', 'PARTIALLY_COMPLETE', 'PROCESSING'] } } }),
            prisma.sample.count({ where: { ...sampleWhere, receptionDate: { gte: today } } }),
        ]);

        // Daily counts for last 7 days
        const dailyCounts = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(today);
            dayStart.setDate(dayStart.getDate() - i);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            const count = await prisma.sample.count({
                where: { ...sampleWhere, receptionDate: { gte: dayStart, lt: dayEnd } },
            });
            dailyCounts.push({
                date: dayStart.toISOString().split('T')[0],
                day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
                count,
            });
        }

        // Recent activity scoped to laboratory
        let recentLogs;
        if (user.role === 'SUPER_ADMIN') {
            recentLogs = await prisma.auditLog.findMany({
                orderBy: { timestamp: 'desc' },
                take: 8,
            });
        } else if (user.labId) {
            recentLogs = await prisma.$queryRaw`
                SELECT DISTINCT a.* FROM AuditLog a
                LEFT JOIN Sample s ON (a.sampleId = s.id OR a.entityId = s.id)
                LEFT JOIN User u ON a.performedBy = u.username
                WHERE (
                    a.labId = ${user.labId}
                    OR s.labId = ${user.labId}
                    OR s.assignedLab = ${user.labId}
                    OR u.labId = ${user.labId}
                )
                ORDER BY a.timestamp DESC
                LIMIT 8
            `;
        } else {
            recentLogs = await prisma.auditLog.findMany({
                where: { performedBy: user.username },
                orderBy: { timestamp: 'desc' },
                take: 8,
            });
        }
        const recentActivity = recentLogs.map(log => ({
            id: log.id,
            action: log.action,
            details: log.details || `${log.entity} ${log.entityId}`,
            time: log.timestamp,
        }));

        return res.json({
            role: user.role,
            kpis: { totalSamples, inProgress, receivedToday },
            dailyCounts,
            recentActivity,
            warnings: [],
            timestamp: new Date(),
        });

    } catch (e) {
        console.error('Dashboard Live Error:', e);
        res.status(500).json({ error: 'Failed to fetch live dashboard data' });
    }
});

app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
    const user = req.user;
    const { country, projectId } = req.query; // Optional filters

    try {
        // 1. Build Query
        const where = {};

        // RBAC Scoping
        if (user.role !== 'SUPER_ADMIN') {
            const userCountries = user.countries || [];
            const userProjects = user.projects || [];
            if (userCountries.length > 0) {
                // If filtering by country, it's safer to query projects or raw field? 
                // Schema has projectCode, countryName. 
                // Let's assume projectCode map to country for now or countryName.
                where.OR = [
                    { projectCode: { in: userCountries } },
                    { countryName: { in: userCountries } }
                ];
            }
            if (userProjects.length > 0) {
                // Combine with existing OR or add? 
                // Complex RBAC logic from sampleController... simplified here:
                if (where.OR) {
                    where.OR.push({ projectId: { in: userProjects } });
                } else {
                    where.OR = [{ projectId: { in: userProjects } }];
                }
            }
        }

        // Explicit Filters
        if (country) {
            // where.countryName = country; // Schema might not have countryName populated for all.
            // Using contains for safety or direct match if confident.
            // OR query:
            where.AND = [
                ...(where.AND || []),
                {
                    OR: [
                        { countryName: country },
                        { projectCode: country }
                    ]
                }
            ];
        }
        if (projectId) {
            where.projectId = projectId;
        }

        // 2. Fetch Data
        const totalSamples = await prisma.sample.count({ where });

        // In Progress: RECEIVED, PREPARATION, ANALYSIS, PARTIALLY_COMPLETE, COMPLETED (Wait, COMPLETED means analysis completed?)
        // Using same list: ['RECEIVED', 'PREPARATION', 'ANALYSIS', 'PARTIALLY_COMPLETE', 'COMPLETED']
        const inProgress = await prisma.sample.count({
            where: {
                ...where,
                status: {
                    in: ['RECEIVED', 'PREPARATION', 'ANALYSIS', 'PARTIALLY_COMPLETE', 'COMPLETED', 'PROCESSING']
                }
            }
        });

        // "Today"
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const receivedToday = await prisma.sample.count({
            where: {
                ...where,
                receptionDate: {
                    gte: today
                }
            }
        });

        // Recent Activity strictly scoped to laboratory
        let recentLogs;
        if (user.role === 'SUPER_ADMIN') {
            recentLogs = await prisma.auditLog.findMany({
                orderBy: { timestamp: 'desc' },
                take: 5,
            });
        } else if (user.labId) {
            recentLogs = await prisma.$queryRaw`
                SELECT DISTINCT a.* FROM AuditLog a
                LEFT JOIN Sample s ON (a.sampleId = s.id OR a.entityId = s.id)
                LEFT JOIN User u ON a.performedBy = u.username
                WHERE (
                    a.labId = ${user.labId}
                    OR s.labId = ${user.labId}
                    OR s.assignedLab = ${user.labId}
                    OR u.labId = ${user.labId}
                )
                ORDER BY a.timestamp DESC
                LIMIT 5
            `;
        } else {
            recentLogs = await prisma.auditLog.findMany({
                where: { performedBy: user.username },
                orderBy: { timestamp: 'desc' },
                take: 5,
            });
        }

        const recentActivity = recentLogs.map(log => ({
            id: log.id,
            action: log.action,
            details: log.details || `${log.entity} ${log.entityId}`,
            time: log.timestamp
        }));

        res.json({ totalSamples, inProgress, receivedToday, recentActivity });
    } catch (e) {
        console.error("Dashboard Stats Error:", e);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ─── Uploads Static Directory (Persistent user/sample assets) ───
const uploadsDir = path.join(__dirname, 'uploads');
const intakeUploadsDir = path.join(uploadsDir, 'intake');
if (!fs.existsSync(intakeUploadsDir)) {
    fs.mkdirSync(intakeUploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// ─── Production / Standalone: Serve React client ───
if (process.env.NODE_ENV === 'production' || process.env.SERVE_CLIENT === 'true') {
    const clientDist = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientDist));

    // SPA fallback: all non-API routes serve index.html
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api') && (req.method === 'GET' || req.method === 'HEAD')) {
            res.sendFile(path.join(clientDist, 'index.html'));
        } else {
            next();
        }
    });
}

// ─── Global Error Handler ───
// Catches unhandled controller errors, prevents stack trace leaks, and ensures standard JSON responses
app.use((err, req, res, next) => {
    console.error(`[UNHANDLED_ERROR] ${req.method} ${req.originalUrl}:`, err);
    if (res.headersSent) {
        return next(err);
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: process.env.NODE_ENV === 'production'
            ? (status === 404 ? 'Resource not found' : 'An internal server error occurred.')
            : (err.message || 'An unexpected error occurred.')
    });
});

module.exports = app;
