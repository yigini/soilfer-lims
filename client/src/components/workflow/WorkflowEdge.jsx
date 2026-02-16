import React from 'react';
import { BaseEdge, getSmoothStepPath } from '@xyflow/react';

export default function WorkflowEdge({
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition,
    targetPosition,
    data = {},
    style = {},
}) {
    const [edgePath] = getSmoothStepPath({
        sourceX, sourceY,
        targetX, targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 24,
    });

    return (
        <>
            {/* Background thick track */}
            <BaseEdge
                id={`${id}-bg`}
                path={edgePath}
                style={{
                    stroke: '#e5e7eb',
                    strokeWidth: 6,
                    strokeLinecap: 'round',
                    ...style,
                }}
            />
            {/* Animated dash overlay */}
            <BaseEdge
                id={id}
                path={edgePath}
                style={{
                    stroke: '#94a3b8',
                    strokeWidth: 3,
                    strokeDasharray: '8 6',
                    strokeLinecap: 'round',
                    animation: 'flowDash 1.2s linear infinite',
                    ...style,
                }}
            />
            <style>{`
                @keyframes flowDash {
                    to { stroke-dashoffset: -28; }
                }
            `}</style>
        </>
    );
}
