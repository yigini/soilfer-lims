import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';

/**
 * WorkflowDependencyGraph
 * Item-level DAG showing exact analytical prerequisites and QA review gates.
 * Parallel tests stay parallel in column 2, feeding independent review decisions in column 3.
 */
export default function WorkflowDependencyGraph({
    dependencyGraph,
    workItems = [],
    selectedId,
    onSelect
}) {
    const containerRef = useRef(null);
    const [wirePaths, setWirePaths] = useState([]);

    const rawNodes = dependencyGraph?.nodes || [];
    const rawEdges = dependencyGraph?.edges || [];

    // Position nodes:
    // Column 1: Gate work items (DRYING, PREPARATION)
    // Column 2: Analytical tests (MIR, VISNIR, PH, etc.)
    // Column 3: QA Review nodes for each analytical test
    const { positionedNodes, positionedEdges } = React.useMemo(() => {
        let gateRow = 1;
        let testRow = 1;

        const nodes = [];
        const edges = [...rawEdges];

        // 1. Separate gate items vs analytical items
        const gateNodes = rawNodes.filter(n => n.category === 'Prepare');
        const testNodes = rawNodes.filter(n => n.category === 'Analyze');

        // Layout gate nodes (Col 1)
        gateNodes.forEach(node => {
            nodes.push({ ...node, col: 1, row: gateRow++ });
        });

        // Layout test nodes (Col 2) & create corresponding Review Gate nodes (Col 3)
        testNodes.forEach(node => {
            const currentRow = testRow++;
            nodes.push({ ...node, col: 2, row: currentRow });

            // Review decision node for this test
            const reviewId = `rev_${node.id}`;
            const isTestDone = node.status.toLowerCase().includes('completed') || node.status.toLowerCase().includes('accepted');
            const isApproved = node.status.toLowerCase().includes('accepted');

            nodes.push({
                id: reviewId,
                workItemId: node.workItemId,
                title: `Review ${node.title}`,
                category: 'Review',
                status: isApproved ? 'Approved' : (isTestDone ? 'Decision pending' : 'Awaiting submission'),
                tone: isApproved ? 'done' : (isTestDone ? 'active' : 'pending'),
                sub: `After eligible ${node.title} submission`,
                desc: `${node.title} must reach an eligible submission state before its result can be evaluated and accepted.`,
                owner: 'Authorized Reviewer',
                checks: isTestDone ? ['Result submitted for evaluation'] : ['Pending test execution'],
                after: 'Accept, request reanalysis, or waive result',
                col: 3,
                row: currentRow
            });

            // Add handoff edge from Test to Review Decision
            edges.push({
                from: node.id,
                to: reviewId,
                type: 'handoff',
                tone: isApproved ? 'ready' : (isTestDone ? 'ready' : 'pending')
            });
        });

        // If no gate nodes were found, provide fallback if needed
        return { positionedNodes: nodes, positionedEdges: edges };
    }, [rawNodes, rawEdges]);

    // Recalculate SVG connector paths
    const updateWires = useCallback(() => {
        if (!containerRef.current || positionedEdges.length === 0) {
            setWirePaths([]);
            return;
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        if (containerRect.width < 240) {
            setWirePaths([]);
            return;
        }

        const paths = [];

        positionedEdges.forEach((edge) => {
            const elFrom = containerRef.current.querySelector(`[data-node="${edge.from}"]`);
            const elTo = containerRef.current.querySelector(`[data-node="${edge.to}"]`);
            if (!elFrom || !elTo) return;

            const rectFrom = elFrom.getBoundingClientRect();
            const rectTo = elTo.getBoundingClientRect();

            const nodeFrom = positionedNodes.find(n => n.id === edge.from);
            const nodeTo = positionedNodes.find(n => n.id === edge.to);

            let d = '';
            if (nodeFrom && nodeTo && nodeFrom.col === nodeTo.col) {
                // Same column vertical connector
                const x = rectFrom.left + rectFrom.width / 2 - containerRect.left;
                const y1 = rectFrom.bottom - containerRect.top;
                const y2 = rectTo.top - containerRect.top;
                d = `M ${x} ${y1} V ${y2 - 3}`;
            } else {
                // Cross column orthogonal connector
                const x1 = rectFrom.right - containerRect.left;
                const y1 = rectFrom.top + rectFrom.height / 2 - containerRect.top;
                const x2 = rectTo.left - containerRect.left;
                const y2 = rectTo.top + rectTo.height / 2 - containerRect.top;
                const midX = (x1 + x2) / 2;
                d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2 - 3}`;
            }

            paths.push({
                d,
                tone: edge.tone || 'pending',
                key: `${edge.from}-${edge.to}`
            });
        });

        setWirePaths(paths);
    }, [positionedEdges, positionedNodes]);

    useLayoutEffect(() => {
        updateWires();
    }, [updateWires]);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(() => {
            updateWires();
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [updateWires]);

    const maxRows = Math.max(
        3,
        positionedNodes.filter(n => n.col === 1).length,
        positionedNodes.filter(n => n.col === 2).length
    );

    return (
        <section className="sf-map-area" aria-label="Workflow Dependency Graph">
            <div className="sf-map-title">
                <strong>Prerequisites &amp; result handoffs</strong>
                <span>Parallel work stays parallel</span>
            </div>

            <div
                ref={containerRef}
                className="sf-grid"
                style={{
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gridTemplateRows: `repeat(${maxRows}, minmax(105px, auto))`
                }}
            >
                {/* SVG Bezier Wires */}
                <svg className="sf-wires" aria-hidden="true">
                    <defs>
                        <marker
                            id="sf-arrow-ready"
                            viewBox="0 0 8 8"
                            refX="7"
                            refY="4"
                            markerWidth="5"
                            markerHeight="5"
                            orient="auto-start-reverse"
                        >
                            <polygon points="0,0 8,4 0,8" fill="var(--sf-green)" />
                        </marker>
                        <marker
                            id="sf-arrow-pending"
                            viewBox="0 0 8 8"
                            refX="7"
                            refY="4"
                            markerWidth="5"
                            markerHeight="5"
                            orient="auto-start-reverse"
                        >
                            <polygon points="0,0 8,4 0,8" fill="var(--sf-muted)" />
                        </marker>
                    </defs>
                    {wirePaths.map(wire => (
                        <path
                            key={wire.key}
                            d={wire.d}
                            className={`sf-${wire.tone}`}
                            markerEnd={`url(#sf-arrow-${wire.tone})`}
                        />
                    ))}
                </svg>

                {/* Node Cards */}
                {positionedNodes.map(node => {
                    const isSelected = selectedId === node.id || selectedId === node.workItemId || selectedId === `wi_${node.workItemId}`;
                    const badgeIcon = node.tone === 'done' ? '✓ ' : (node.tone === 'active' ? '● ' : (node.tone === 'warn' ? '△ ' : (node.tone === 'blocked' ? '✕ ' : '')));

                    return (
                        <button
                            key={node.id}
                            type="button"
                            className="sf-node"
                            data-node={node.id}
                            aria-pressed={isSelected}
                            onClick={() => onSelect(node)}
                            style={{
                                gridColumn: node.col,
                                gridRow: node.row
                            }}
                        >
                            <span className="sf-node-label">{node.category}</span>
                            <span className="sf-node-title">{node.title}</span>
                            <span className={`sf-pill sf-${node.tone}`}>
                                {badgeIcon}{node.status}
                            </span>
                            {node.sub && <small>{node.sub}</small>}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="sf-legend">
                <span>
                    <b className="sf-stroke"></b>
                    Prerequisite satisfied →
                </span>
                <span>
                    <b className="sf-stroke sf-dashed"></b>
                    Future handoff →
                </span>
            </div>
        </section>
    );
}
