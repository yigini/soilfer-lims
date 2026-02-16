import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    deriveLocationSummary,
    deriveStageSummaries,
    derivePath,
} from '../utils/workflowMapper';
import { useSampleWorkflow } from '../hooks/useSampleWorkflow';
import WorkflowTopStrip from '../components/workflow/WorkflowTopStrip';
import WorkflowStageLane from '../components/workflow/WorkflowStageLane';
import WorkflowDetailDrawer from '../components/workflow/WorkflowDetailDrawer';
import { AlertTriangle } from 'lucide-react';
import '../styles/workflow-map-v2.css';

/**
 * V2: Workflow Intelligence Map
 * Manager-first, deterministic stage-lane layout.
 */
export default function SampleWorkflowMap() {
    const { id } = useParams();
    const navigate = useNavigate();

    // Data
    const { sample, workItems, auditLog, loading, error, fetchData } = useSampleWorkflow(id);

    // Derived selectors (memoized)
    const locationSummary = useMemo(
        () => deriveLocationSummary(sample, workItems, auditLog),
        [sample, workItems, auditLog]
    );
    const stageSummaries = useMemo(
        () => deriveStageSummaries(sample, workItems),
        [sample, workItems]
    );
    const path = useMemo(
        () => derivePath(locationSummary, stageSummaries),
        [locationSummary, stageSummaries]
    );

    // Fullscreen
    const [isFullscreen, setIsFullscreen] = useState(false);
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    // Esc key to exit fullscreen
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'f' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') toggleFullscreen();
            if (e.key === 'Escape' && isFullscreen) {
                document.exitFullscreen().catch(() => { });
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen, toggleFullscreen]);

    // Detail Drawer
    const [selectedRoom, setSelectedRoom] = useState(null);
    const handleStageClick = useCallback((room) => {
        setSelectedRoom(room);
    }, []);

    // ─── Loading state ───
    if (loading) {
        return (
            <div className="wf-v2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 40, height: 40,
                        border: '3px solid #e2e8f0', borderTopColor: '#6366f1',
                        borderRadius: '50%', animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px',
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Loading workflow data...</p>
                </div>
            </div>
        );
    }

    // ─── Error state ───
    if (error) {
        return (
            <div className="wf-v2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                    textAlign: 'center', padding: '32px', background: 'white',
                    borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: 360,
                }}>
                    <AlertTriangle size={36} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
                        Error loading workflow
                    </h3>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{error}</p>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            padding: '8px 20px', background: '#6366f1', color: 'white',
                            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // ─── Main V2 Layout ───
    return (
        <div className="wf-v2" role="application" aria-label={`Workflow map for sample ${id}`}>
            {/* Sticky Top Strip */}
            <WorkflowTopStrip
                locationSummary={locationSummary}
                sample={sample}
                isFullscreen={isFullscreen}
                onBack={() => navigate(`/samples/${id}`)}
                onRefresh={fetchData}
                onFullscreen={toggleFullscreen}
            />

            {/* Stage Lane */}
            <WorkflowStageLane
                stageSummaries={stageSummaries}
                path={path}
                onStageClick={handleStageClick}
            />

            {/* Detail Drawer */}
            {selectedRoom && (
                <WorkflowDetailDrawer
                    selectedRoom={selectedRoom}
                    stageSummary={stageSummaries.find(s => s.room === selectedRoom)}
                    workItems={workItems}
                    auditLog={auditLog}
                    onClose={() => setSelectedRoom(null)}
                />
            )}
        </div>
    );
}
