import React, { useState } from 'react';
import { ROOMS, ROOM_CONFIG, getRoomSummary } from '../../utils/workflowMapper';
import { Box } from 'lucide-react';

/**
 * LabFloorPlan — Custom interactive minimap showing a simplified
 * isometric/flat floor plan of the laboratory with room highlights.
 *
 * Features:
 *   - Clickable rooms → zoom to that room on the main canvas
 *   - "Sample is HERE" pulsing dot
 *   - Status colors per room
 *   - 3D perspective toggle
 */

const PLAN_W = 280;
const PLAN_H = 210;

// Simplified room rectangles for the minimap
const ROOM_RECTS = {
    [ROOMS.RECEPTION]: { x: 5, y: 5, w: 90, h: 60 },
    [ROOMS.PREP_ROOM]: { x: 100, y: 5, w: 90, h: 60 },
    [ROOMS.PHYSICAL_LAB]: { x: 5, y: 72, w: 58, h: 70 },
    [ROOMS.CHEMICAL_LAB]: { x: 68, y: 72, w: 58, h: 70 },
    [ROOMS.SPECTRAL_LAB]: { x: 131, y: 72, w: 58, h: 70 },
    [ROOMS.QA_OFFICE]: { x: 68, y: 149, w: 58, h: 52 },
    [ROOMS.ARCHIVE]: { x: 131, y: 149, w: 58, h: 52 },
};

export default function LabFloorPlan({ workItems, onRoomClick }) {
    const [is3D, setIs3D] = useState(false);
    const rooms = getRoomSummary(workItems);

    const roomMap = {};
    rooms.forEach(r => { roomMap[r.roomName] = r; });

    function getColor(roomName) {
        const r = roomMap[roomName];
        if (!r || !r.hasItems) return '#e2e8f0';
        const cfg = ROOM_CONFIG[roomName];
        if (r.status === 'ACCEPTED') return '#86efac';
        if (r.status === 'IN_PROGRESS') return '#fcd34d';
        if (r.status === 'REANALYSIS_REQUIRED') return '#fca5a5';
        if (r.status === 'ASSIGNED') return '#93c5fd';
        return cfg?.floor || '#f1f5f9';
    }

    function getPct(roomName) {
        const r = roomMap[roomName];
        return r ? r.pct : 0;
    }

    const transform3D = is3D
        ? 'perspective(600px) rotateX(35deg) rotateZ(-3deg) scale(0.95)'
        : 'none';

    return (
        <div style={{
            position: 'absolute', bottom: 58, right: 12, zIndex: 10,
            backgroundColor: 'white', border: '1px solid #e5e7eb',
            borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            padding: 10, userSelect: 'none',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #f1f5f9',
            }}>
                <span style={{
                    fontSize: 10, fontWeight: 700, color: '#475569',
                    textTransform: 'uppercase', letterSpacing: 1
                }}>
                    Lab Floor Plan
                </span>
                <button
                    onClick={() => setIs3D(!is3D)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        fontSize: 9, fontWeight: 700, color: is3D ? '#4338ca' : '#94a3b8',
                        border: `1px solid ${is3D ? '#4338ca' : '#e2e8f0'}`,
                        borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                        backgroundColor: is3D ? '#eef2ff' : 'transparent',
                        transition: 'all 0.2s',
                    }}
                >
                    <Box size={10} /> 3D
                </button>
            </div>

            {/* Floor plan SVG */}
            <div style={{
                transition: 'transform 0.5s ease',
                transform: transform3D,
                transformOrigin: 'center bottom',
            }}>
                <svg width={195} height={210} viewBox="0 0 195 210"
                    style={{ display: 'block' }}
                >
                    {/* Building outline */}
                    <rect x={2} y={2} width={191} height={206} rx={3}
                        fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 2" />

                    {/* Building label */}
                    <text x={97} y={208} textAnchor="middle" fontSize={7}
                        fill="#94a3b8" fontWeight="600">
                        SOIL TESTING LABORATORY
                    </text>

                    {/* Rooms */}
                    {Object.entries(ROOM_RECTS).map(([roomName, rect]) => {
                        const cfg = ROOM_CONFIG[roomName];
                        const r = roomMap[roomName];
                        const isHere = r?.sampleHere;
                        const color = getColor(roomName);

                        return (
                            <g key={roomName} style={{ cursor: 'pointer' }}
                                onClick={() => onRoomClick?.(roomName)}
                            >
                                {/* 3D depth shadow */}
                                {is3D && (
                                    <rect
                                        x={rect.x + 2} y={rect.y + 3}
                                        width={rect.w} height={rect.h}
                                        rx={2} fill="#1e293b" opacity={0.12}
                                    />
                                )}

                                {/* Room body */}
                                <rect
                                    x={rect.x} y={rect.y}
                                    width={rect.w} height={rect.h}
                                    rx={2}
                                    fill={color} stroke={cfg?.wall || '#64748b'}
                                    strokeWidth={1.5}
                                />

                                {/* Accent bar at top */}
                                <rect
                                    x={rect.x} y={rect.y}
                                    width={rect.w} height={3}
                                    fill={cfg?.accent || '#6b7280'} rx={1}
                                />

                                {/* Emoji */}
                                <text
                                    x={rect.x + rect.w / 2}
                                    y={rect.y + rect.h / 2 - 2}
                                    textAnchor="middle" fontSize={rect.h > 55 ? 14 : 11}
                                >
                                    {cfg?.emoji}
                                </text>

                                {/* Room name */}
                                <text
                                    x={rect.x + rect.w / 2}
                                    y={rect.y + rect.h / 2 + (rect.h > 55 ? 11 : 9)}
                                    textAnchor="middle" fontSize={6}
                                    fill="#374151" fontWeight="700"
                                >
                                    {roomName.length > 14 ? roomName.slice(0, 12) + '…' : roomName}
                                </text>

                                {/* "HERE" pulsing dot */}
                                {isHere && (
                                    <circle
                                        cx={rect.x + rect.w - 5}
                                        cy={rect.y + 8}
                                        r={3} fill="#f59e0b"
                                    >
                                        <animate
                                            attributeName="r" values="3;5;3"
                                            dur="1.5s" repeatCount="indefinite"
                                        />
                                        <animate
                                            attributeName="opacity" values="1;0.4;1"
                                            dur="1.5s" repeatCount="indefinite"
                                        />
                                    </circle>
                                )}

                                {/* Progress indicator */}
                                {r && r.total > 0 && (
                                    <text
                                        x={rect.x + rect.w / 2}
                                        y={rect.y + rect.h - 4}
                                        textAnchor="middle" fontSize={7}
                                        fill={cfg?.accent || '#6b7280'} fontWeight="800"
                                    >
                                        {r.accepted}/{r.total}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Corridors (door openings between rooms) */}
                    <line x1={95} y1={35} x2={100} y2={35} stroke={ROOM_CONFIG[ROOMS.RECEPTION]?.accent} strokeWidth={2} />
                    <line x1={60} y1={65} x2={60} y2={72} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 1" />
                    <line x1={97} y1={65} x2={97} y2={72} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 1" />
                    <line x1={160} y1={65} x2={160} y2={72} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 1" />
                    <line x1={97} y1={142} x2={97} y2={149} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 1" />
                    <line x1={160} y1={142} x2={160} y2={149} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 1" />
                </svg>
            </div>
        </div>
    );
}
