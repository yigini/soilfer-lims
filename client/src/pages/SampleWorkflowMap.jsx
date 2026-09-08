import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSampleWorkflow } from '../hooks/useSampleWorkflow';
import WorkflowHeader from '../components/workflow/WorkflowHeader';
import WorkflowOverviewGraph from '../components/workflow/WorkflowOverviewGraph';
import WorkflowDependencyGraph from '../components/workflow/WorkflowDependencyGraph';
import WorkflowAnalysisList from '../components/workflow/WorkflowAnalysisList';
import WorkflowInspector from '../components/workflow/WorkflowInspector';
import { AlertTriangle, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import '../styles/workflow-map-v2.css';

/**
 * SampleWorkflowMap Redesign
 * Operational workflow map featuring 3 synchronized views:
 *   - Overview: High-level stage progression for relevant stations
 *   - Dependencies: Item-level DAG with prerequisites and review gates
 *   - Analysis list: Complete sortable task list for keyboard & screen readers
 * Docked inspector panel at wide screens, stacked on tablet/mobile.
 */
export default function SampleWorkflowMap() {
    const { id: paramId } = useParams();
    const location = useLocation();
    const queryId = new URLSearchParams(location.search).get('sampleId');
    const id = paramId || queryId;
    const navigate = useNavigate();

    const {
        sample,
        workItems,
        auditLog,
        mapState,
        loading,
        refreshing,
        error,
        lastUpdated,
        fetchData,
        refresh
    } = useSampleWorkflow(id);

    // Initial view: list on mobile, overview on desktop
    const [activeView, setActiveView] = useState(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 540) {
            return 'list';
        }
        return 'overview';
    });

    const [selectedItem, setSelectedItem] = useState(null);

    // Auto-select initial focal item once mapState loads
    useEffect(() => {
        if (!mapState) return;

        // If nothing is selected, prioritize selecting active work item
        if (!selectedItem) {
            const activeNode = mapState.dependencyGraph?.nodes?.find(n => n.tone === 'active') ||
                mapState.stageGraph?.nodes?.find(n => n.tone === 'active') ||
                mapState.stageGraph?.nodes?.[0];
            if (activeNode) {
                setSelectedItem(activeNode);
            }
        }
    }, [mapState, selectedItem]);

    // Keyboard shortcuts (1: Overview, 2: Dependencies, 3: List)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === '1') setActiveView('overview');
            if (e.key === '2') setActiveView('dependencies');
            if (e.key === '3') setActiveView('list');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Selection handler with cross-view synchronization
    const handleSelect = useCallback((item) => {
        setSelectedItem(item);
    }, []);

    // "Inspect next work" button handler from banner
    const handleInspectNext = useCallback(() => {
        if (!mapState) return;
        const activeDep = mapState.dependencyGraph?.nodes?.find(n => n.tone === 'active') ||
            mapState.dependencyGraph?.nodes?.find(n => n.status.toLowerCase().includes('progress')) ||
            mapState.dependencyGraph?.nodes?.[0];

        setActiveView('dependencies');
        if (activeDep) {
            setSelectedItem(activeDep);
        }
    }, [mapState]);

    // "Trace dependencies" button handler from inspector
    const handleTraceDependencies = useCallback(() => {
        setActiveView('dependencies');
        if (selectedItem && mapState) {
            // Find matching item in dependency graph
            const depMatch = mapState.dependencyGraph?.nodes?.find(n =>
                n.analysis === selectedItem.analysis ||
                n.room === selectedItem.title ||
                n.id === selectedItem.id
            );
            if (depMatch) {
                setSelectedItem(depMatch);
            }
        }
    }, [selectedItem, mapState]);

    // Missing ID State
    if (!id) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[460px] p-8 text-center">
                <div className="p-4 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 mb-4">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-sf-text">No Sample Specified</h3>
                <p className="text-sm text-sf-muted max-w-md mt-1 mb-6">
                    A sample ID is required to display the workflow map.
                </p>
                <button
                    type="button"
                    onClick={() => navigate('/samples')}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Return to Samples
                </button>
            </div>
        );
    }

    // Loading State
    if (loading && !mapState) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[460px] p-8 text-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <h3 className="text-base font-semibold text-sf-text">Loading Workflow Map</h3>
                <p className="text-xs text-sf-muted mt-1">Retrieving verified sample stage graph and prerequisite state...</p>
            </div>
        );
    }

    // Error State
    if (error && !mapState) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[460px] p-8 text-center">
                <div className="p-4 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 mb-4">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-sf-text">Workflow Unavailable</h3>
                <p className="text-sm text-sf-muted max-w-md mt-1 mb-6">
                    {error}
                </p>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/samples')}
                        className="px-4 py-2 text-sm font-medium border border-sf-divider rounded-lg hover:bg-sf-raised transition-colors"
                    >
                        Return to Samples
                    </button>
                    <button
                        type="button"
                        onClick={() => fetchData(false)}
                        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const selectedId = selectedItem?.id || selectedItem?.workItemId;

    return (
        <div className="sf-concept" id="soilfer-workflow-redesign">
            {/* Header / Summary / View Switcher */}
            <WorkflowHeader
                sample={sample}
                mapState={mapState}
                activeView={activeView}
                onViewChange={setActiveView}
                onInspectNext={handleInspectNext}
                lastUpdated={lastUpdated}
                refreshing={refreshing}
                onRefresh={refresh}
            />

            {/* Main Interactive Workspace (Canvas + Docked Inspector) */}
            <div className="sf-workspace">
                {activeView === 'overview' && (
                    <WorkflowOverviewGraph
                        stageGraph={mapState?.stageGraph}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                    />
                )}

                {activeView === 'dependencies' && (
                    <WorkflowDependencyGraph
                        dependencyGraph={mapState?.dependencyGraph}
                        workItems={workItems}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                    />
                )}

                {activeView === 'list' && (
                    <WorkflowAnalysisList
                        dependencyGraph={mapState?.dependencyGraph}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                    />
                )}

                {/* Docked Inspector Panel */}
                <WorkflowInspector
                    selectedItem={selectedItem}
                    activeView={activeView}
                    onTraceDependencies={handleTraceDependencies}
                    sampleId={sample?.id}
                    auditLog={auditLog}
                />
            </div>

            {/* Footnote */}
            <div className="sf-top text-xs text-sf-muted border-t border-sf-divider">
                <span>Path shown reflects assigned determinations for this sample. Keyboard shortcuts: [1] Overview, [2] Dependencies, [3] Analysis list.</span>
                <span>SoilFER LIMS v1.4.0</span>
            </div>
        </div>
    );
}
