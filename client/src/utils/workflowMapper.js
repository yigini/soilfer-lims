/**
 * workflowMapper.js — Fixed Lab Floor Plan Layout
 */

export const ROOMS = {
    RECEPTION: 'Reception',
    PREP_ROOM: 'Preparation Room',
    PHYSICAL_LAB: 'Physical Testing',
    CHEMICAL_LAB: 'Chemical Analysis',
    SPECTRAL_LAB: 'Spectral Lab',
    QA_OFFICE: 'QA Review',
    ARCHIVE: 'Archive & Disposal',
};

// ─── Visual Config ───
export const ROOM_CONFIG = {
    [ROOMS.RECEPTION]: { icon: 'PackageCheck', accent: '#6366f1', description: 'Sample Login' },
    [ROOMS.PREP_ROOM]: { icon: 'Filter', accent: '#f59e0b', description: 'Drying & Sieving' },
    [ROOMS.PHYSICAL_LAB]: { icon: 'Ruler', accent: '#10b981', description: 'Physical Properties' },
    [ROOMS.CHEMICAL_LAB]: { icon: 'FlaskConical', accent: '#3b82f6', description: 'Wet Chemistry' },
    [ROOMS.SPECTRAL_LAB]: { icon: 'ScanLine', accent: '#8b5cf6', description: 'Spectroscopy' },
    [ROOMS.QA_OFFICE]: { icon: 'ShieldCheck', accent: '#14b8a6', description: 'Quality Control' },
    [ROOMS.ARCHIVE]: { icon: 'Archive', accent: '#64748b', description: 'Storage' },
};

// ─── Analysis Mapping ───
const ANALYSIS_ROOM = {
    DRYING: ROOMS.PREP_ROOM, PREPARATION: ROOMS.PREP_ROOM,
    TEXTURE: ROOMS.PHYSICAL_LAB, SAND: ROOMS.PHYSICAL_LAB, SILT: ROOMS.PHYSICAL_LAB,
    CLAY: ROOMS.PHYSICAL_LAB, GRAVEL: ROOMS.PHYSICAL_LAB, BULK_DENSITY: ROOMS.PHYSICAL_LAB,
    BD: ROOMS.PHYSICAL_LAB, MC: ROOMS.PHYSICAL_LAB, MOIST: ROOMS.PHYSICAL_LAB,
    MOISTURE: ROOMS.PHYSICAL_LAB, PEAT: ROOMS.PHYSICAL_LAB,
    PH: ROOMS.CHEMICAL_LAB, PH_H2O: ROOMS.CHEMICAL_LAB, PH_KCL: ROOMS.CHEMICAL_LAB,
    PH_CACL2: ROOMS.CHEMICAL_LAB, EC: ROOMS.CHEMICAL_LAB, SOC: ROOMS.CHEMICAL_LAB,
    OC: ROOMS.CHEMICAL_LAB, TN: ROOMS.CHEMICAL_LAB, TC: ROOMS.CHEMICAL_LAB,
    CEC: ROOMS.CHEMICAL_LAB, AV_P: ROOMS.CHEMICAL_LAB, P_AVAIL: ROOMS.CHEMICAL_LAB,
    P_BRAY: ROOMS.CHEMICAL_LAB, P_OLSEN: ROOMS.CHEMICAL_LAB, PHOS: ROOMS.CHEMICAL_LAB,
    EX_ACIDITY: ROOMS.CHEMICAL_LAB, CACO3: ROOMS.CHEMICAL_LAB, CA_CO3: ROOMS.CHEMICAL_LAB,
    K_EXCH: ROOMS.CHEMICAL_LAB, CA_EXCH: ROOMS.CHEMICAL_LAB, MG_EXCH: ROOMS.CHEMICAL_LAB,
    NA_EXCH: ROOMS.CHEMICAL_LAB, AL_EXCH: ROOMS.CHEMICAL_LAB, H_EXCH: ROOMS.CHEMICAL_LAB,
    FE: ROOMS.CHEMICAL_LAB, MN: ROOMS.CHEMICAL_LAB, ZN: ROOMS.CHEMICAL_LAB,
    CU: ROOMS.CHEMICAL_LAB, B: ROOMS.CHEMICAL_LAB, S: ROOMS.CHEMICAL_LAB,
    S_RESP: ROOMS.CHEMICAL_LAB, MISC: ROOMS.CHEMICAL_LAB,
    MIR: ROOMS.SPECTRAL_LAB, VISNIR: ROOMS.SPECTRAL_LAB, XRF: ROOMS.SPECTRAL_LAB,
    SPEC_MIR: ROOMS.SPECTRAL_LAB, SPEC_VIS_NIR: ROOMS.SPECTRAL_LAB,
    SPEC_VISNIR: ROOMS.SPECTRAL_LAB, SPEC_XRF: ROOMS.SPECTRAL_LAB,
    ARCHIVING: ROOMS.ARCHIVE, ARCH: ROOMS.ARCHIVE, DISPOSAL: ROOMS.ARCHIVE, DISP: ROOMS.ARCHIVE,
};

import { getAnalysisDisplayName } from './analysisNames';

export function getDisplayName(code) {
    if (!code) return '—';
    return getAnalysisDisplayName(code);
}

export function getRoom(code) {
    const up = code.toUpperCase();
    if (ANALYSIS_ROOM[up]) return ANALYSIS_ROOM[up];
    if (up.includes('SPEC_') || up.includes('MIR') || up.includes('NIR')) return ROOMS.SPECTRAL_LAB;
    if (up.includes('EXCH') || up.includes('PH_') || up.includes('ACID')) return ROOMS.CHEMICAL_LAB;
    if (up.includes('DRY') || up.includes('PREP')) return ROOMS.PREP_ROOM;
    if (up.includes('ARCH') || up.includes('DISP')) return ROOMS.ARCHIVE;
    return ROOMS.CHEMICAL_LAB;
}

// ─── Status Colors ───
export const STATUS_COLORS = {
    NOT_ASSIGNED: { bg: '#f8fafc', text: '#94a3b8', label: 'Waiting' },
    ASSIGNED: { bg: '#dbeafe', text: '#2563eb', label: 'Assigned' },
    IN_PROGRESS: { bg: '#fef3c7', text: '#d97706', label: 'Active' },
    COMPLETED: { bg: '#e0e7ff', text: '#4f46e5', label: 'Done' },
    SUBMITTED: { bg: '#e0e7ff', text: '#4f46e5', label: 'Submitted' },
    ACCEPTED: { bg: '#d1fae5', text: '#059669', label: 'Approved' },
    REANALYSIS_REQUIRED: { bg: '#fee2e2', text: '#dc2626', label: 'Redo' },
    RECEIVED_REJECTED: { bg: '#fee2e2', text: '#dc2626', label: 'Rejected' },
    WAIVED: { bg: '#f1f5f9', text: '#64748b', label: 'Waived' },
    PENDING: { bg: '#f8fafc', text: '#94a3b8', label: 'Pending' },
};
export function getStatusColor(s) { return STATUS_COLORS[s] || STATUS_COLORS.PENDING; }

export function isBlocked(wi, all) {
    const code = wi.analysis.toUpperCase();
    if (code === 'DRYING') return false;
    if (code === 'PREPARATION') {
        const d = all.find(w => w.analysis.toUpperCase() === 'DRYING');
        return d ? !['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(d.status) : false;
    }
    return false;
}

// ─── Room Status ───
function computeRoomStatus(items) {
    const total = items.length;
    if (total === 0) return { status: 'PENDING', accepted: 0, inProgress: 0, total: 0, pct: 0 };
    const accepted = items.filter(w => ['ACCEPTED', 'WAIVED'].includes(w.status)).length;
    const inProgress = items.filter(w => w.status === 'IN_PROGRESS').length;
    let status = 'NOT_ASSIGNED';
    if (accepted === total) status = 'ACCEPTED';
    else if (inProgress > 0) status = 'IN_PROGRESS';
    else if (items.some(w => ['COMPLETED', 'SUBMITTED'].includes(w.status))) status = 'COMPLETED';
    else if (items.some(w => w.status === 'ASSIGNED')) status = 'ASSIGNED';
    return { status, accepted, inProgress, total, pct: Math.round((accepted / total) * 100) };
}

// ──────────────────────────────────────────────
//  FIXED FLOOR PLAN POSITIONS (Global Coordinates)
//
//  Layout:
//    [Reception]            [Prep Room]
//         |                      |
//    [Physical]  [Chemical]  [Spectral]
//                     |
//                [QA Office]
//                     |
//                 [Archive]
// ──────────────────────────────────────────────
const W = 580;   // Card Width + Gap
const H = 320;   // Row Height

const POSITIONS = {
    // Row 1: Reception (Left) ... Prep (Right)
    [ROOMS.RECEPTION]: { x: 0, y: 0 },
    [ROOMS.PREP_ROOM]: { x: W * 1.5, y: 0 },

    // Row 2: Operational Labs
    [ROOMS.PHYSICAL_LAB]: { x: 0, y: H },
    [ROOMS.CHEMICAL_LAB]: { x: W, y: H },
    [ROOMS.SPECTRAL_LAB]: { x: W * 2, y: H },

    // Row 3: QA (Centered below operational labs)
    [ROOMS.QA_OFFICE]: { x: W, y: H * 2 },

    // Row 4: Archive (Exit)
    [ROOMS.ARCHIVE]: { x: W * 2, y: H * 2.8 },
};

/**
 * P0: Core Location Resolver
 * Determines the single source of truth for "Where is the sample right now?".
 */
export function resolveSampleLocation(sample, workItems, auditLog) {
    // 1. Prioritize ACTIVE work items (IN_PROGRESS) — strongest signal
    if (workItems && workItems.length > 0) {
        const active = workItems.filter(w => w.status === 'IN_PROGRESS');
        if (active.length > 0) {
            let target = active[0];
            if (active.length > 1 && auditLog) {
                const latestEv = auditLog.find(ev =>
                    (ev.entity === 'WORKITEM' || ev.action?.includes('WORKITEM')) &&
                    active.some(w => w.id === ev.entityId)
                );
                if (latestEv) {
                    target = active.find(w => w.id === latestEv.entityId) || active[0];
                }
            }
            const room = getRoom(target.analysis);
            return {
                currentRoom: room,
                reason: `${active.length} active analys${active.length > 1 ? 'es' : 'is'}`,
                nextAction: `Processing ${getDisplayName(target.analysis)}`,
                status: 'IN_PROGRESS'
            };
        }

        // 2. ASSIGNED work items (scheduled but not started)
        const assigned = workItems.filter(w => w.status === 'ASSIGNED');
        if (assigned.length > 0) {
            const room = getRoom(assigned[0].analysis);
            return {
                currentRoom: room,
                reason: `${assigned.length} pending task${assigned.length > 1 ? 's' : ''}`,
                nextAction: 'Waiting for technician',
                status: 'ASSIGNED'
            };
        }

        // 3. PENDING work items (created but not assigned yet) → Prep Room
        const pending = workItems.filter(w => w.status === 'PENDING' || w.status === 'NOT_ASSIGNED');
        if (pending.length > 0) {
            return {
                currentRoom: ROOMS.PREP_ROOM,
                reason: `${pending.length} task${pending.length > 1 ? 's' : ''} awaiting assignment`,
                nextAction: 'Assign to technician',
                status: 'PENDING'
            };
        }

        // 4. All completed but not QA'd → QA Office
        const allDone = workItems.every(w => ['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(w.status));
        const notQA = workItems.some(w => !['ACCEPTED', 'WAIVED'].includes(w.status));

        if (allDone && notQA) {
            return {
                currentRoom: ROOMS.QA_OFFICE,
                reason: 'Labs completed',
                nextAction: 'Quality Assurance Review',
                status: 'QA_PENDING'
            };
        }

        // 5. Fully QA'd → Archive (terminal: either archived or disposed)
        if (allDone && !notQA) {
            const isArchived = sample?.status === 'ARCHIVED';
            const isDisposed = sample?.status === 'DISPOSED';
            return {
                currentRoom: ROOMS.ARCHIVE,
                reason: isArchived ? 'Sample archived' : isDisposed ? 'Sample disposed' : 'All QA Passed',
                nextAction: isArchived ? 'Sample stored in archive'
                    : isDisposed ? 'Sample disposed of'
                        : 'Ready for archiving or disposal',
                status: sample?.status || 'APPROVED',
            };
        }
    }

    // 6. No work items — use sample status to determine stage
    const earlyStatuses = ['EXPECTED', 'COLLECTED', 'DRAFT'];
    if (sample && earlyStatuses.includes(sample.status)) {
        return {
            currentRoom: ROOMS.RECEPTION,
            reason: 'Sample newly registered',
            nextAction: 'Ready for scanning',
            status: sample.status
        };
    }

    // 7. Sample RECEIVED but no work items yet → still at Reception
    if (sample && sample.status === 'RECEIVED') {
        return {
            currentRoom: ROOMS.RECEPTION,
            reason: 'Sample received',
            nextAction: 'Pending intake acceptance',
            status: 'RECEIVED'
        };
    }

    // 7b. RECEIVED_REJECTED → Reception Quarantine
    if (sample && (sample.status === 'RECEIVED_REJECTED' || sample.status === 'REJECTED')) {
        return {
            currentRoom: ROOMS.RECEPTION,
            reason: 'Sample rejected at intake (non-conformance)',
            nextAction: 'Quarantined / Excluded from testing',
            status: 'RECEIVED_REJECTED'
        };
    }

    // 8. ACCEPTED but no work items → Prep Room (work items should be generated)
    if (sample && (sample.status === 'ACCEPTED' || sample.status === 'LAB_ID_ASSIGNED')) {
        return {
            currentRoom: ROOMS.PREP_ROOM,
            reason: 'Intake accepted',
            nextAction: 'Awaiting sample preparation',
            status: sample.status
        };
    }

    // Default Fallback
    return {
        currentRoom: ROOMS.RECEPTION,
        reason: 'Sample Logged',
        nextAction: 'Awaiting Assignment',
        status: sample?.status || 'RECEIVED'
    };
}

// ─── Builder ───
export function buildWorkflowGraph(sample, workItems, resolvedLocation) {
    const currentRoom = resolvedLocation?.currentRoom || null;
    const nodes = [];
    const edges = [];

    // Group items by room
    const roomGroups = {};
    Object.values(ROOMS).forEach(r => { roomGroups[r] = []; });
    if (workItems) {
        workItems.forEach(wi => {
            const room = getRoom(wi.analysis);
            roomGroups[room].push(wi);
        });
    }

    // ALWAYS create nodes for ALL rooms (Active or Inactive)
    Object.values(ROOMS).forEach(roomName => {
        const items = roomGroups[roomName] || [];
        const isActive = items.length > 0;
        const roomId = `room-${roomName.replace(/[\s&]/g, '-').toLowerCase()}`;
        const pos = POSITIONS[roomName];
        const config = ROOM_CONFIG[roomName];

        // Extract unique assignees for this room
        const assignees = [...new Set(
            items.filter(wi => wi.assignedTo || wi.assignee)
                .map(wi => wi.assignedTo || wi.assignee)
        )].slice(0, 3); // Max 3 avatars

        let nodeData = {
            nodeType: 'room',
            roomName, config,
            title: roomName,
            isActive: isActive,
            isCurrentRoom: roomName === currentRoom,
            sampleHere: false,
            assignees,
            analysisList: [],
            roomStatus: { total: 0, accepted: 0, pct: 0 },
            // P2: Per-room bottleneck data
            bottleneckCount: 0,
            bottleneckSeverity: null,
        };

        // Special: Reception
        if (roomName === ROOMS.RECEPTION) {
            nodeData.isReception = true;
            nodeData.isActive = true; // Always visible
            nodeData.sampleInfo = {
                labId: sample.labId || sample.sampleId,
                projectCode: sample.projectCode,
                status: sample.status
            };
            nodeData.sampleHere = true; // Placeholder, resolver overrides logic in UI badge usually
            // But we can also set it here for the "Soft Glow" effect on the correct node
        }

        // Special: QA
        else if (roomName === ROOMS.QA_OFFICE) {
            const allOps = [
                ...roomGroups[ROOMS.PHYSICAL_LAB],
                ...roomGroups[ROOMS.CHEMICAL_LAB],
                ...roomGroups[ROOMS.SPECTRAL_LAB]
            ];
            nodeData.isQA = true;
            nodeData.isActive = allOps.length > 0;
            nodeData.roomStatus = computeRoomStatus(allOps);
            // QA logic: here if operations done but QA pending
        }

        // Standard Lab Rooms
        else {
            if (isActive) {
                nodeData.analysisList = items.map(wi => ({
                    id: wi.id, name: getDisplayName(wi.analysis),
                    analysisCode: wi.analysis, status: wi.status,
                    blocked: isBlocked(wi, workItems)
                }));
                nodeData.roomStatus = computeRoomStatus(items);
            }
        }

        // P2: Compute per-room bottleneck severity
        const roomBottlenecks = items.filter(wi => {
            const terminal = ['COMPLETED', 'ACCEPTED', 'WAIVED', 'SUBMITTED'];
            if (terminal.includes(wi.status)) return false;
            const refDate = wi.updatedAt || wi.createdAt;
            if (!refDate) return false;
            const elapsed = (Date.now() - new Date(refDate).getTime()) / 3600000;
            return elapsed >= 24; // WARNING threshold
        });
        if (roomBottlenecks.length > 0) {
            nodeData.bottleneckCount = roomBottlenecks.length;
            const hasCritical = roomBottlenecks.some(wi => {
                const refDate = wi.updatedAt || wi.createdAt;
                return refDate && (Date.now() - new Date(refDate).getTime()) / 3600000 >= 72;
            });
            nodeData.bottleneckSeverity = hasCritical ? 'CRITICAL' : 'WARNING';
        }

        nodes.push({
            id: roomId,
            type: 'workflowNode',
            position: pos,
            data: nodeData,
            draggable: false, // Fixed layout
        });
    });

    // Edges (Fixed Paths)
    const connections = [
        { src: ROOMS.RECEPTION, tgt: ROOMS.PREP_ROOM },
        { src: ROOMS.PREP_ROOM, tgt: ROOMS.PHYSICAL_LAB },
        { src: ROOMS.PREP_ROOM, tgt: ROOMS.CHEMICAL_LAB },
        { src: ROOMS.PREP_ROOM, tgt: ROOMS.SPECTRAL_LAB },
        { src: ROOMS.PHYSICAL_LAB, tgt: ROOMS.QA_OFFICE },
        { src: ROOMS.CHEMICAL_LAB, tgt: ROOMS.QA_OFFICE },
        { src: ROOMS.SPECTRAL_LAB, tgt: ROOMS.QA_OFFICE },
        { src: ROOMS.QA_OFFICE, tgt: ROOMS.ARCHIVE },
    ];

    connections.forEach(({ src, tgt }) => {
        const srcId = `room-${src.replace(/[\s&]/g, '-').toLowerCase()}`;
        const tgtId = `room-${tgt.replace(/[\s&]/g, '-').toLowerCase()}`;

        const srcNode = nodes.find(n => n.id === srcId);
        const tgtNode = nodes.find(n => n.id === tgtId);
        const isPathActive = srcNode.data.isActive && tgtNode.data.isActive;
        // P1: Highlight edges on path TO the current room
        const isOnCurrentPath = currentRoom && (
            srcNode.data.isCurrentRoom || tgtNode.data.isCurrentRoom ||
            (srcNode.data.isActive && tgtNode.data.isCurrentRoom)
        );

        edges.push({
            id: `e-${srcId}-${tgtId}`,
            source: srcId, target: tgtId,
            type: 'workflowEdge',
            animated: isPathActive || isOnCurrentPath,
            style: {
                stroke: isOnCurrentPath ? '#f59e0b' : isPathActive ? '#6366f1' : '#e5e7eb',
                strokeWidth: isOnCurrentPath ? 3 : isPathActive ? 2 : 1,
                opacity: isPathActive || isOnCurrentPath ? 1 : 0.4,
                strokeDasharray: isPathActive || isOnCurrentPath ? 'none' : '5 5'
            },
            data: { active: isPathActive, onCurrentPath: isOnCurrentPath }
        });
    });

    return { nodes, edges };
}

// ─── Helpers (Restored) ───
export function computeKPIs(workItems) {
    if (!workItems) return { total: 0, assigned: 0, inProgress: 0, blocked: 0, reanalysis: 0, completed: 0 };
    const ana = workItems.filter(w =>
        !['DRYING', 'PREPARATION', 'ARCHIVING', 'ARCH', 'DISPOSAL', 'DISP'].includes(w.analysis.toUpperCase())
    );
    return {
        total: ana.length,
        assigned: ana.filter(w => w.status === 'ASSIGNED').length,
        inProgress: ana.filter(w => w.status === 'IN_PROGRESS').length,
        blocked: ana.filter(w => isBlocked(w, workItems) && !['ACCEPTED', 'WAIVED', 'COMPLETED', 'SUBMITTED'].includes(w.status)).length,
        reanalysis: ana.filter(w => w.status === 'REANALYSIS_REQUIRED').length,
        completed: ana.filter(w => ['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(w.status)).length,
    };
}

export function buildTimelineSnapshots(auditLog, workItems) {
    if (!auditLog || auditLog.length === 0) return [];
    const sorted = [...auditLog].filter(a => a.action && a.timestamp)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const snapshots = [];
    const cur = {};
    workItems.forEach(w => { cur[w.id] = 'NOT_ASSIGNED'; });
    snapshots.push({ timestamp: sorted[0]?.timestamp || new Date().toISOString(), label: 'Start', states: { ...cur } });
    sorted.forEach(ev => {
        if (ev.entity === 'WORKITEM' || ev.action?.includes('WORKITEM') || ev.action?.includes('STATUS')) {
            const id = ev.entityId;
            const after = ev.after;
            if (after?.status && cur[id] !== undefined) {
                cur[id] = after.status;
                const wi = workItems.find(w => w.id === id);
                snapshots.push({ timestamp: ev.timestamp, label: `${wi ? getDisplayName(wi.analysis) : ev.action}: ${after.status.replace(/_/g, ' ')}`, states: { ...cur } });
            }
        }
    });
    workItems.forEach(w => { cur[w.id] = w.status; });
    snapshots.push({ timestamp: new Date().toISOString(), label: 'Current', states: { ...cur } });
    return snapshots;
}

export function filterNodes(nodes, filters) { return nodes; } // No filtering in fixed layout

// ─── P2: Workflow Intelligence ───────────────────────────
// SLA thresholds in hours
const SLA_THRESHOLDS = {
    WARNING: 24,    // 24h → yellow
    CRITICAL: 72,   // 72h → red
};

/** Compute hours elapsed since a date string */
export function getElapsedHours(dateStr) {
    if (!dateStr) return 0;
    return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 3600000);
}

/**
 * Detect bottleneck work items (stuck too long in a non-terminal state).
 * Returns array of { workItemId, analysis, room, status, elapsedHours, severity }
 */
export function computeBottlenecks(workItems) {
    if (!workItems?.length) return [];
    const terminal = ['COMPLETED', 'ACCEPTED', 'WAIVED', 'SUBMITTED'];
    return workItems
        .filter(wi => !terminal.includes(wi.status))
        .map(wi => {
            const refDate = wi.updatedAt || wi.createdAt;
            const elapsed = getElapsedHours(refDate);
            const severity = elapsed >= SLA_THRESHOLDS.CRITICAL ? 'CRITICAL'
                : elapsed >= SLA_THRESHOLDS.WARNING ? 'WARNING' : null;
            return severity ? {
                workItemId: wi.id,
                analysis: wi.analysis,
                room: getRoom(wi.analysis),
                status: wi.status,
                elapsedHours: Math.round(elapsed),
                severity,
            } : null;
        })
        .filter(Boolean);
}

/**
 * Compute overall SLA status for the sample from audit log creation event.
 * Returns { totalHours, severity, createdAt }
 */
export function computeSLAStatus(sample, auditLog) {
    // Find creation timestamp
    const createdEvent = auditLog?.find(e =>
        e.action === 'SAMPLE_CREATED' || e.action === 'SAMPLE_RECEIVED' || e.action === 'AUTO_CREATE'
    );
    const createdAt = createdEvent?.timestamp || sample?.receptionDate || sample?.createdAt;
    if (!createdAt) return { totalHours: 0, severity: null, createdAt: null };

    const totalHours = Math.round(getElapsedHours(createdAt));
    const severity = totalHours >= SLA_THRESHOLDS.CRITICAL ? 'CRITICAL'
        : totalHours >= SLA_THRESHOLDS.WARNING ? 'WARNING' : 'OK';

    return { totalHours, severity, createdAt };
}

// ═══════════════════════════════════════════════════════════
//  V2: Manager-First Selectors
// ═══════════════════════════════════════════════════════════

/** Ordered stage sequence for path derivation */
export const STAGE_ORDER = [
    ROOMS.RECEPTION,
    ROOMS.PREP_ROOM,
    ROOMS.PHYSICAL_LAB,
    ROOMS.CHEMICAL_LAB,
    ROOMS.SPECTRAL_LAB,
    ROOMS.QA_OFFICE,
    ROOMS.ARCHIVE,
];

/**
 * V2 T02: Derive manager-facing location summary.
 */
export function deriveLocationSummary(sample, workItems, auditLog) {
    const loc = resolveSampleLocation(sample, workItems, auditLog);
    const sla = computeSLAStatus(sample, auditLog);
    const bottlenecks = computeBottlenecks(workItems);

    // Determine primary owner
    let owner = null;
    if (workItems?.length) {
        const activeWi = workItems.find(w => w.status === 'IN_PROGRESS' && w.assignedTo);
        if (activeWi) owner = activeWi.assignedTo;
        else {
            const assignedWi = workItems.find(w => w.status === 'ASSIGNED' && w.assignedTo);
            if (assignedWi) owner = assignedWi.assignedTo;
        }
    }

    // Risk assessment — pre-arrival and terminal samples have no risk
    const PRE_ARRIVAL = ['EXPECTED', 'COLLECTED', 'DRAFT'];
    const TERMINAL = ['ARCHIVED', 'DISPOSED'];
    let risk = 'OK';
    if (PRE_ARRIVAL.includes(sample?.status) || TERMINAL.includes(sample?.status)) {
        risk = 'OK'; // No risk before sample arrives or after it's done
    } else if (bottlenecks.some(b => b.severity === 'CRITICAL') || sla.severity === 'CRITICAL') {
        risk = 'CRITICAL';
    } else if (bottlenecks.length > 0 || sla.severity === 'WARNING') {
        risk = 'WARNING';
    }

    // Blocker sentence
    let nextAction = loc.nextAction;
    if (bottlenecks.length > 0) {
        const worst = bottlenecks.sort((a, b) => b.elapsedHours - a.elapsedHours)[0];
        nextAction = `Delayed: ${getDisplayName(worst.analysis)} (${Math.round(worst.elapsedHours)}h)`;
    }

    const lastUpdatedAt = auditLog?.[0]?.timestamp || sample?.updatedAt || null;

    return { currentRoom: loc.currentRoom, owner, status: loc.status, risk, nextAction, lastUpdatedAt, sla };
}

/**
 * V2 T02: Derive per-stage summaries for stage cards.
 */
export function deriveStageSummaries(sample, workItems) {
    return STAGE_ORDER.map(room => {
        const config = ROOM_CONFIG[room];
        const items = (workItems || []).filter(wi => getRoom(wi.analysis) === room);

        if (room === ROOMS.RECEPTION) {
            return {
                room, config, total: 0, done: 0, inProgress: 0, blocked: 0,
                status: sample?.status || 'RECEIVED', staff: [], analyses: [],
                sampleInfo: { labId: sample?.labId || sample?.id, projectCode: sample?.projectCode, status: sample?.status, receivedBy: sample?.receivedBy },
            };
        }

        if (room === ROOMS.PREP_ROOM) {
            let synthItems = items.length > 0 ? items : [];
            if (items.length === 0 && sample) {
                const synth = [];
                if (sample.dryingStatus) synth.push({ analysis: 'DRYING', status: sample.dryingStatus === 'DONE' ? 'COMPLETED' : sample.dryingStatus, assignedTo: null });
                if (sample.preparationStatus) synth.push({ analysis: 'PREPARATION', status: sample.preparationStatus === 'DONE' ? 'COMPLETED' : sample.preparationStatus, assignedTo: null });
                synthItems = synth;
            }
            const total = synthItems.length;
            const done = synthItems.filter(w => ['COMPLETED', 'ACCEPTED', 'WAIVED', 'SUBMITTED'].includes(w.status)).length;
            const inProg = synthItems.filter(w => w.status === 'IN_PROGRESS').length;
            const staff = [...new Set(synthItems.filter(w => w.assignedTo).map(w => w.assignedTo))].slice(0, 4);
            return {
                room, config, total, done, inProgress: inProg, blocked: 0,
                status: total === 0 ? 'EMPTY' : done === total ? 'COMPLETED' : inProg > 0 ? 'IN_PROGRESS' : 'PENDING',
                staff, analyses: synthItems.map(w => ({ code: w.analysis, name: getDisplayName(w.analysis), status: w.status, assignedTo: w.assignedTo })),
            };
        }

        if (room === ROOMS.QA_OFFICE && items.length === 0) {
            const labItems = (workItems || []).filter(wi => {
                const r = getRoom(wi.analysis);
                return r === ROOMS.PHYSICAL_LAB || r === ROOMS.CHEMICAL_LAB || r === ROOMS.SPECTRAL_LAB;
            });
            const labDone = labItems.every(w => ['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(w.status));
            const labAccepted = labItems.every(w => ['ACCEPTED', 'WAIVED'].includes(w.status));
            return {
                room, config, total: labItems.length,
                done: labItems.filter(w => ['ACCEPTED', 'WAIVED'].includes(w.status)).length,
                inProgress: 0, blocked: 0,
                status: labAccepted ? 'COMPLETED' : labDone ? 'IN_PROGRESS' : 'PENDING',
                staff: [], analyses: [],
            };
        }

        const total = items.length;
        const done = items.filter(w => ['COMPLETED', 'ACCEPTED', 'WAIVED', 'SUBMITTED'].includes(w.status)).length;
        const inProg = items.filter(w => w.status === 'IN_PROGRESS').length;
        const blockedCount = items.filter(w => isBlocked(w, workItems || [])).length;
        const staff = [...new Set(items.filter(w => w.assignedTo).map(w => w.assignedTo))].slice(0, 4);

        let status = 'EMPTY';
        if (total > 0) {
            if (done === total) status = 'COMPLETED';
            else if (inProg > 0) status = 'IN_PROGRESS';
            else if (items.some(w => w.status === 'ASSIGNED')) status = 'ASSIGNED';
            else status = 'PENDING';
        }

        return {
            room, config, total, done, inProgress: inProg, blocked: blockedCount, status, staff,
            analyses: items.map(w => ({ code: w.analysis, name: getDisplayName(w.analysis), status: w.status, assignedTo: w.assignedTo })),
        };
    });
}

/**
 * V2 T02: Derive path trail.
 */
export function derivePath(locationSummary, stageSummaries) {
    const current = locationSummary.currentRoom;
    const currentIdx = STAGE_ORDER.indexOf(current);
    if (currentIdx < 0) return { completedRooms: [], currentRoom: current, futureRooms: [...STAGE_ORDER] };

    const completedRooms = STAGE_ORDER.slice(0, currentIdx).filter(room => {
        const stage = stageSummaries.find(s => s.room === room);
        return stage && (stage.total === 0 || stage.done === stage.total);
    });

    return { completedRooms, currentRoom: current, futureRooms: STAGE_ORDER.slice(currentIdx + 1) };
}
