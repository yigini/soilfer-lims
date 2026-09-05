import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';

/**
 * WorkflowOverviewGraph
 * High-level stage progression with pure CSS Grid + SVG bezier connector wires.
 * Displays only relevant stations (no ghost/empty rooms).
 */
export default function WorkflowOverviewGraph({
    stageGraph,
    selectedId,
    onSelect
}) {
    const containerRef = useRef(null);
    const [wirePaths, setWirePaths] = useState([]);

    const nodes = stageGraph?.nodes || [];
    const edges = stageGraph?.edges || [];

    // Assign grid columns and rows based on node role:
    // Column 1: Reception (row 1), Preparation (row 2)
    // Column 2: Active analytical rooms (rows 1..N)
    // Column 3: QA Review (row 2), Closure (row 3)
    const positionedNodes = React.useMemo(() => {
        let analyticalIndex = 1;
        return nodes.map((node) => {
            let col = 2;
            let row = 1;

            if (node.id === 'reception') {
                col = 1;
                row = 1;
            } else if (node.id === 'prep') {
                col = 1;
                row = 2;
            } else if (node.id === 'review') {
                col = 3;
                row = 2;
            } else if (node.id === 'closure') {
                col = 3;
                row = 3;
            } else {
                col = 2;
                row = analyticalIndex++;
            }

            return { ...node, col, row };
        });
    }, [nodes]);

    // Recalculate SVG connector paths on layout / resize
    const updateWires = useCallback(() => {
        if (!containerRef.current || edges.length === 0) {
            setWirePaths([]);
            return;
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        if (containerRect.width < 240) {
            setWirePaths([]);
            return;
        }

        const paths = [];

        edges.forEach((edge) => {
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
    }, [edges, positionedNodes]);

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

    return (
        <section className="sf-map-area" aria-label="Workflow Overview Map">
            <div className="sf-map-title">
                <strong>Sample pathway</strong>
                <span>Only relevant stations</span>
            </div>

            <div
                ref={containerRef}
                className="sf-grid"
                style={{
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gridTemplateRows: `repeat(${Math.max(3, positionedNodes.filter(n => n.col === 2).length)}, minmax(105px, auto))`
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
                        <marker
                            id="sf-arrow-blocked"
                            viewBox="0 0 8 8"
                            refX="7"
                            refY="4"
                            markerWidth="5"
                            markerHeight="5"
                            orient="auto-start-reverse"
                        >
                            <polygon points="0,0 8,4 0,8" fill="var(--sf-red)" />
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
                    const isSelected = selectedId === node.id;
                    const badgeIcon = node.tone === 'done' ? '✓ ' : (node.tone === 'active' ? '● ' : (node.tone === 'warn' ? '△ ' : ''));

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
