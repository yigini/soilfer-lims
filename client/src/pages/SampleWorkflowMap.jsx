import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    deriveStageSummaries,
    derivePath,
    deriveLocationSummary,
} from '../utils/workflowMapper';
import { useSampleWorkflow } from '../hooks/useSampleWorkflow';
import WorkflowTopStrip from '../components/workflow/WorkflowTopStrip';
import WorkflowStageNode from '../components/workflow/WorkflowStageNode';
import WorkflowDetailDrawer from '../components/workflow/WorkflowDetailDrawer';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import '../styles/workflow-map-v2.css';

const nodeTypes = { workflowStage: WorkflowStageNode };

const defaultEdgeOptions = {
    type: 'smoothstep',
    style: { strokeWidth: 2 },
};

/**
 * V3: Workflow Intelligence Map with ReactFlow canvas
 * Pan, zoom, minimap, animated transitions, manager-first layout.
 */
export default function SampleWorkflowMap() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();

    // Data
    const { sample, workItems, auditLog, mapState, loading, error, fetchData } = useSampleWorkflow(id);

    // Use backend mapState as primary truth, client-side derivation as fallback
    const locationSummary = useMemo(() => {
        if (mapState) {
            return {
                currentRoom: mapState.currentRooms?.[0] || '—',
                activeRooms: mapState.currentRooms || [],
                owner: mapState.owner,
                status: mapState.lifecycle,
                risk: mapState.risk,
                nextAction: mapState.nextActions?.[0]?.action || '—',
                sla: mapState.sla,
                phase: mapState.phase,
                progress: mapState.progress,
            };
        }
        return deriveLocationSummary(sample, workItems, auditLog);
    }, [mapState, sample, workItems, auditLog]);

    const stageSummaries = useMemo(() => {
        // Always fall back to client-side derivation which includes ALL rooms
        const fullStages = deriveStageSummaries(sample, workItems);

        if (mapState?.activeStages?.length > 0) {
            // Build lookup from backend stages
            const backendMap = {};
            mapState.activeStages.forEach(s => { backendMap[s.room] = s; });

            // Merge: use backend data where available, keep client-side for missing rooms
            return fullStages.map(stage => {
                const bs = backendMap[stage.room];
                if (bs) {
                    return {
                        ...stage,
                        items: bs.items,
                        done: bs.progress.done,
                        total: bs.progress.total,
                        status: bs.status,
                        blockers: bs.blockers || [],
                    };
                }
                return stage;
            });
        }
        return fullStages;
    }, [mapState, sample, workItems]);

    const path = useMemo(
        () => derivePath(locationSummary, stageSummaries),
        [locationSummary, stageSummaries]
    );

    // Build ReactFlow graph from stage summaries
    const graph = useMemo(() => {
        if (!stageSummaries || stageSummaries.length === 0) return { nodes: [], edges: [] };
        return buildStageGraph(stageSummaries, path, locationSummary);
    }, [stageSummaries, path, locationSummary]);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        setNodes(graph.nodes);
        setEdges(graph.edges);
    }, [graph, setNodes, setEdges]);

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
    const handleNodeClick = useCallback((_, node) => {
        setSelectedRoom(node.data.room);
    }, []);

    // ─── Loading state ───
    if (loading) {
        return (
            <div className="wf-v2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="wf-loading-spinner" />
                    <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginTop: 16 }}>{t('sampleDetail.loading', 'Loading workflow data...')}</p>
                </div>
            </div>
        );
    }

    // ─── Error state ───
    if (error) {
        return (
            <div className="wf-v2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="wf-error-card">
                    <AlertTriangle size={36} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
                        {t('workflow.errorLoading', 'Error loading workflow')}
                    </h3>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{error}</p>
                    <button onClick={() => navigate(-1)} className="wf-error-btn">{t('common.back', 'Go Back')}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="wf-v2" role="application" aria-label={`Workflow map for sample ${id}`}>
            {/* Sticky Top Strip */}
            <WorkflowTopStrip
                locationSummary={locationSummary}
                mapState={mapState}
                sample={sample}
                workItems={workItems}
                isFullscreen={isFullscreen}
                onBack={() => navigate(`/samples/${id}`)}
                onRefresh={fetchData}
                onFullscreen={toggleFullscreen}
            />

            {/* ReactFlow Canvas */}
            <div className="wf-canvas">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={handleNodeClick}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={defaultEdgeOptions}
                    fitView
                    fitViewOptions={{ padding: 0.18 }}
                    minZoom={0.25}
                    maxZoom={2}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background variant="dots" gap={24} size={1} className="wf-canvas-dots" />
                    <MiniMap
                        nodeStrokeWidth={3}
                        pannable
                        zoomable
                        className="wf-minimap"
                        maskColor="rgba(99, 102, 241, 0.12)"
                    />
                    <Controls
                        showInteractive={false}
                        className="wf-canvas-controls"
                    />
                </ReactFlow>
            </div>

            {/* Detail Drawer */}
            {selectedRoom && (
                <WorkflowDetailDrawer
                    selectedRoom={selectedRoom}
                    stageSummary={stageSummaries.find(s => s.room === selectedRoom)}
                    blockerGraph={mapState?.blockerGraph || []}
                    workItems={workItems}
                    auditLog={auditLog}
                    sample={sample}
                    onClose={() => setSelectedRoom(null)}
                />
            )}
        </div>
    );
}

/**
 * Build ReactFlow nodes/edges from stage summaries.
 * Layout: 3 clean balanced rows
 *   Row 1:  Reception → Preparation Room
 *   Row 2:  Physical Testing | Chemical Analysis | Spectral Lab  (Parallel Analytical Core)
 *   Row 3:  QA Review → Archive & Storage
 */
function buildStageGraph(stageSummaries, path) {
    const { completedRooms, currentRoom } = path || {};
    const nodes = [];
    const edges = [];

    const CARD_W = 260;
    const H_GAP = 90;
    const V_GAP = 70;

    const stageMap = {};
    stageSummaries.forEach(s => { stageMap[s.room] = s; });

    const getPhase = (room) =>
        room === currentRoom ? 'current'
            : completedRooms?.includes(room) ? 'completed'
                : 'future';

    const addNode = (id, room, x, y) => {
        const stage = stageMap[room];
        if (!stage) return;
        nodes.push({
            id, type: 'workflowStage',
            position: { x, y },
            data: { ...stage, phase: getPhase(room), room },
            draggable: false,
        });
    };

    // ─── Row 1: Intake & Physical Gate ───
    const row1Y = 0;
    const row1OffsetX = (3 * CARD_W + 2 * H_GAP - (2 * CARD_W + H_GAP)) / 2;
    addNode('reception', 'Reception', row1OffsetX, row1Y);
    addNode('prep', 'Preparation Room', row1OffsetX + CARD_W + H_GAP, row1Y);

    // ─── Row 2: Parallel Analytical Core (3 Labs) ───
    const row2Y = row1Y + V_GAP + 260;
    addNode('physical', 'Physical Testing', 0 * (CARD_W + H_GAP), row2Y);
    addNode('chemical', 'Chemical Analysis', 1 * (CARD_W + H_GAP), row2Y);
    addNode('spectral', 'Spectral Lab', 2 * (CARD_W + H_GAP), row2Y);

    // ─── Row 3: QA Review & Archive Sample Bank ───
    const row3Y = row2Y + V_GAP + 260;
    const row3OffsetX = row1OffsetX;
    addNode('qa', 'QA Review', row3OffsetX, row3Y);
    addNode('archive', 'Archive & Disposal', row3OffsetX + CARD_W + H_GAP, row3Y);

    // ─── Edges ───
    const addEdge = (src, tgt, srcHandle, tgtHandle) => {
        const srcRoom = nodes.find(n => n.id === src)?.data?.room;
        const tgtRoom = nodes.find(n => n.id === tgt)?.data?.room;
        const srcPhase = getPhase(srcRoom);
        const tgtPhase = getPhase(tgtRoom);

        const tgtStage = stageMap[tgtRoom];
        const tgtHasActiveWork = tgtStage && tgtStage.total > 0 && tgtStage.done < tgtStage.total;
        const isCurrentlyActive = tgtPhase === 'current' || (srcPhase === 'completed' && tgtHasActiveWork);
        const isCompletedStep = srcPhase === 'completed' && tgtPhase === 'completed';

        edges.push({
            id: `e-${src}-${tgt}`,
            source: src,
            target: tgt,
            sourceHandle: srcHandle,
            targetHandle: tgtHandle,
            type: 'smoothstep',
            animated: isCurrentlyActive,
            style: {
                stroke: isCurrentlyActive
                    ? '#6366f1' // Active glowing indigo
                    : isCompletedStep
                    ? '#10b981' // Verified emerald
                    : 'var(--wf-edge-inactive, #cbd5e1)',
                strokeWidth: isCurrentlyActive ? 3 : isCompletedStep ? 2.5 : 1.5,
                opacity: isCurrentlyActive || isCompletedStep ? 1 : 0.45,
                strokeDasharray: isCompletedStep || isCurrentlyActive ? undefined : '5 4',
            },
        });
    };

    // Row 1 connections
    addEdge('reception', 'prep', 'right', 'left');

    // Row 1 -> Row 2 (Prep to 3 testing stations)
    addEdge('prep', 'physical', 'bottom', 'top');
    addEdge('prep', 'chemical', 'bottom', 'top');
    addEdge('prep', 'spectral', 'bottom', 'top');

    // Row 2 -> Row 3 (3 testing stations to QA)
    addEdge('physical', 'qa', 'bottom', 'top');
    addEdge('chemical', 'qa', 'bottom', 'top');
    addEdge('spectral', 'qa', 'bottom', 'top');

    // Row 3 connections (QA to Archive)
    addEdge('qa', 'archive', 'right', 'left');

    return { nodes, edges };
}
