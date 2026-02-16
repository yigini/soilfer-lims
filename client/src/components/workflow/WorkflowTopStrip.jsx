import React from 'react';
import { ArrowLeft, RefreshCw, Maximize2, Minimize2, MapPin, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

/**
 * V2 T06: Sticky top strip — Location | Owner | Status | Risk | Next Action
 */
export default function WorkflowTopStrip({
    locationSummary,
    sample,
    isFullscreen,
    onBack,
    onRefresh,
    onFullscreen,
}) {
    const { currentRoom, owner, status, risk, nextAction, sla } = locationSummary || {};

    const riskClass = risk === 'CRITICAL' ? 'critical' : risk === 'WARNING' ? 'warning' : 'ok';

    const formatSLA = (h) => {
        if (!h) return '—';
        if (h < 24) return `${h}h`;
        const d = Math.floor(h / 24);
        const rem = h % 24;
        return rem > 0 ? `${d}d ${rem}h` : `${d}d`;
    };

    return (
        <div className="wf-top-strip" role="banner" aria-label="Sample workflow status bar">
            {/* Back button */}
            <button className="wf-back-btn" onClick={onBack} aria-label="Go back">
                <ArrowLeft size={18} />
            </button>

            {/* Sample ID */}
            <div className="wf-strip-section">
                <span className="wf-strip-label">Sample</span>
                <span className="wf-strip-value">{sample?.labId || sample?.sampleId || sample?.id || '—'}</span>
            </div>
            {sample?.projectCode && (
                <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>
                    {sample.projectCode}
                </span>
            )}

            <div className="wf-strip-divider" />

            {/* Current Location */}
            <div className="wf-strip-section">
                <span className="wf-strip-label">Location</span>
                <span className="wf-strip-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} style={{ color: '#6366f1' }} />
                    {currentRoom || '—'}
                </span>
            </div>

            <div className="wf-strip-divider" />

            {/* Owner */}
            <div className="wf-strip-section">
                <span className="wf-strip-label">Owner</span>
                <span className="wf-strip-value" style={{ fontSize: 13 }}>{owner || 'Unassigned'}</span>
            </div>

            <div className="wf-strip-divider" />

            {/* Status */}
            <div className="wf-strip-section">
                <span className="wf-strip-label">Status</span>
                <span className="wf-strip-value" style={{ fontSize: 12 }}>{status || '—'}</span>
            </div>

            <div className="wf-strip-divider" />

            {/* Risk */}
            <div className="wf-strip-section">
                <span className="wf-strip-label">Risk</span>
                <span className={`wf-risk-badge ${riskClass}`}>
                    {risk === 'CRITICAL' ? <XCircle size={12} /> : risk === 'WARNING' ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />} {risk || 'OK'}
                </span>
            </div>

            <div className="wf-strip-divider" />

            {/* Next Action */}
            <div className="wf-strip-section" style={{ minWidth: 150, flex: 1 }}>
                <span className="wf-strip-label">Next Action</span>
                <span className="wf-strip-value" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    {nextAction || '—'}
                </span>
            </div>

            {/* SLA age */}
            {sla?.totalHours > 0 && (
                <>
                    <div className="wf-strip-divider" />
                    <div className="wf-strip-section">
                        <span className="wf-strip-label">Age</span>
                        <span className={`wf-risk-badge ${sla.severity === 'CRITICAL' ? 'critical' : sla.severity === 'WARNING' ? 'warning' : 'ok'}`}>
                            {formatSLA(sla.totalHours)}
                        </span>
                    </div>
                </>
            )}

            {/* Actions */}
            <div className="wf-strip-actions">
                <button onClick={onRefresh} title="Refresh data" aria-label="Refresh data">
                    <RefreshCw size={16} />
                </button>
                <button onClick={onFullscreen} title="Toggle fullscreen (F)" aria-label="Toggle fullscreen">
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>
        </div>
    );
}
