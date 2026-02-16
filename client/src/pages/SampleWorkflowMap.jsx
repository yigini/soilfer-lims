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
    deriveLocationSummary,
    deriveStageSummaries,
    derivePath,
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
                sample={sample}
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
                    fitViewOptions={{ padding: 0.15 }}
                    minZoom={0.3}
                    maxZoom={2}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background variant="dots" gap={24} size={1} color="rgba(148,163,184,0.2)" />
                    <MiniMap
                        nodeStrokeWidth={3}
                        pannable
                        zoomable
                        style={{
                            background: 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                        }}
                        maskColor="rgba(99, 102, 241, 0.08)"
                    />
                    <Controls
                        showInteractive={false}
                        style={{
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                            overflow: 'hidden',
                        }}
                    />
                </ReactFlow>
            </div>

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


/**
 * Build ReactFlow nodes/edges from stage summaries.
 * Layout: 3 rows to avoid edge overlap.
 *   Row 1:  Reception → Preparation Room
 *   Row 2:  Physical Testing | Chemical Analysis | Spectral Lab  (parallel)
 *   Row 3:  QA Review → Archive & Disposal
 */
function buildStageGraph(stageSummaries, path) {
    const { completedRooms, currentRoom } = path || {};
    const nodes = [];
    const edges = [];

    const CARD_W = 250;
    const H_GAP = 80;
    const V_GAP = 60;

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

    // ─── Row 1: Reception → Prep (horizontal) ───
    const row1Y = 0;
    addNode('reception', 'Reception', 0, row1Y);
    addNode('prep', 'Preparation Room', CARD_W + H_GAP, row1Y);

    // ─── Row 2: 3 parallel labs (centered under row 1) ───
    const row1Width = 2 * CARD_W + H_GAP;
    const labCount = 3;
    const labTotalW = labCount * CARD_W + (labCount - 1) * H_GAP;
    const labOffsetX = (row1Width - labTotalW) / 2;
    const row2Y = row1Y + V_GAP + 200; // generous vertical gap

    addNode('physical', 'Physical Testing', labOffsetX + 0 * (CARD_W + H_GAP), row2Y);
    addNode('chemical', 'Chemical Analysis', labOffsetX + 1 * (CARD_W + H_GAP), row2Y);
    addNode('spectral', 'Spectral Lab', labOffsetX + 2 * (CARD_W + H_GAP), row2Y);

    // ─── Row 3: QA → Archive (centered under labs) ───
    const row3Width = 2 * CARD_W + H_GAP;
    const row3OffsetX = (labTotalW - row3Width) / 2 + labOffsetX;
    const row3Y = row2Y + V_GAP + 200;

    addNode('qa', 'QA Review', row3OffsetX, row3Y);
    addNode('archive', 'Archive & Disposal', row3OffsetX + CARD_W + H_GAP, row3Y);

    // ─── Edges ───
    const addEdge = (src, tgt, srcHandle, tgtHandle) => {
        const srcRoom = nodes.find(n => n.id === src)?.data?.room;
        const tgtRoom = nodes.find(n => n.id === tgt)?.data?.room;
        const srcPhase = getPhase(srcRoom);
        const tgtPhase = getPhase(tgtRoom);
        const isActive = srcPhase !== 'future' || tgtPhase !== 'future';

        // Animate edges to rooms with active (pending) work, not just the single 'current' room
        const tgtStage = stageMap[tgtRoom];
        const tgtHasActiveWork = tgtStage && tgtStage.total > 0 && tgtStage.done < tgtStage.total;
        const isOnPath = tgtPhase === 'current' || (srcPhase === 'completed' && tgtHasActiveWork);

        edges.push({
            id: `e-${src}-${tgt}`,
            source: src,
            target: tgt,
            sourceHandle: srcHandle,
            targetHandle: tgtHandle,
            type: 'smoothstep',
            animated: isOnPath,
            style: {
                stroke: isOnPath ? '#f59e0b' : isActive ? '#86efac' : '#e2e8f0',
                strokeWidth: isOnPath ? 3 : isActive ? 2 : 1.5,
                opacity: isActive ? 1 : 0.4,
                strokeDasharray: isActive ? undefined : '6 4',
            },
        });
    };

    // Row 1 horizontal connections
    addEdge('reception', 'prep', 'right', 'left');

    // Prep → 3 labs (vertical: bottom → top)
    addEdge('prep', 'physical', 'bottom', 'top');
    addEdge('prep', 'chemical', 'bottom', 'top');
    addEdge('prep', 'spectral', 'bottom', 'top');

    // 3 labs → QA (vertical: bottom → top)
    addEdge('physical', 'qa', 'bottom', 'top');
    addEdge('chemical', 'qa', 'bottom', 'top');
    addEdge('spectral', 'qa', 'bottom', 'top');

    // QA → Archive (horizontal)
    addEdge('qa', 'archive', 'right', 'left');

    return { nodes, edges };
}
