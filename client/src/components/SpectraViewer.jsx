import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Color palette for multi-trace overlay
const TRACE_COLORS = [
    '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
];

/**
 * Format physical quantity name for Y-axis and tooltips (SL-03)
 */
const formatQuantity = (qty, modality) => {
    if (qty === 'ABSORBANCE') return 'Absorbance';
    if (qty === 'REFLECTANCE') return 'Reflectance';
    if (qty === 'LOG_1_R') return 'log(1/R)';
    if (qty === 'KUBELKA_MUNK') return 'Kubelka-Munk';
    if (qty === 'TRANSMITTANCE') return 'Transmittance (%)';
    return modality === 'MIR' ? 'Absorbance' : 'Reflectance';
};

/**
 * Linear interpolation helper on monotonic curve (SL-05)
 */
function interpolateAt(sortedPoints, targetX) {
    if (!sortedPoints || sortedPoints.length === 0) return null;
    const n = sortedPoints.length;
    const minX = sortedPoints[0].x;
    const maxX = sortedPoints[n - 1].x;

    // Check bounds
    if (targetX < minX || targetX > maxX) return null;

    // Binary search to find interval [low, high]
    let low = 0;
    let high = n - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (sortedPoints[mid].x <= targetX) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    const idx = high;
    if (idx < 0) return sortedPoints[0].y;
    if (idx >= n - 1) return sortedPoints[n - 1].y;

    const p1 = sortedPoints[idx];
    const p2 = sortedPoints[idx + 1];
    const dx = p2.x - p1.x;
    if (Math.abs(dx) < 1e-9) return p1.y;

    const t = (targetX - p1.x) / dx;
    return p1.y + t * (p2.y - p1.y);
}

/**
 * SpectraViewer — supports single scan OR multi-scan overlay with continuous interpolation.
 *
 * Props:
 *   data        — single scan object { chartData, instrument, scanDate, modality, quantity, axisUnit, ... }
 *   overlayData — optional array of scan objects for multi-trace overlay
 *                 each: { id, chartData, filename, modality, metadata, quantity, axisUnit }
 */
const SpectraViewer = ({ data, overlayData }) => {
    const isOverlay = overlayData && overlayData.length > 1;

    // ── OVERLAY MODE (SL-05 & SL-03) ──
    const overlayGrid = useMemo(() => {
        if (!isOverlay) return null;

        // Extract and sort each scan's points ascending for interpolation
        const normalizedScans = overlayData.map(scan => {
            if (!scan.chartData || scan.chartData.length === 0) return { id: scan.id, points: [] };
            const pts = scan.chartData.map(p => ({
                x: Number(p.wavelength),
                y: Number(p.value !== undefined ? p.value : p.absorbance)
            })).filter(p => !isNaN(p.x) && !isNaN(p.y));
            pts.sort((a, b) => a.x - b.x);
            return { id: scan.id, points: pts };
        });

        // Determine global bounding span
        let globalMin = Infinity;
        let globalMax = -Infinity;
        normalizedScans.forEach(s => {
            if (s.points.length > 0) {
                if (s.points[0].x < globalMin) globalMin = s.points[0].x;
                if (s.points[s.points.length - 1].x > globalMax) globalMax = s.points[s.points.length - 1].x;
            }
        });

        if (globalMin === Infinity || globalMax <= globalMin) return [];

        // Build continuous uniform grid (500 display points)
        const NUM_POINTS = 500;
        const step = (globalMax - globalMin) / (NUM_POINTS - 1);
        const mergedData = [];

        for (let i = 0; i < NUM_POINTS; i++) {
            const currentX = Math.round((globalMin + i * step) * 10) / 10;
            const row = { wavelength: currentX };
            normalizedScans.forEach((s, idx) => {
                const val = interpolateAt(s.points, currentX);
                row[`scan_${idx}`] = val !== null ? Math.round(val * 10000) / 10000 : null;
            });
            mergedData.push(row);
        }

        return mergedData;
    }, [isOverlay, overlayData]);

    if (isOverlay) {
        const first = overlayData[0];
        const modality = first?.modality || 'NIR';
        const isWavenumber = first?.axisUnit === 'WAVENUMBER_CM1' || modality === 'MIR';
        const yLabel = formatQuantity(first?.quantity || first?.metadata?.quantity, modality);
        const xLabel = isWavenumber ? 'Wavenumber (cm⁻¹)' : 'Wavelength (nm)';

        return (
            <div className="w-full h-96 bg-sf-surface p-4 rounded-lg shadow-sm border border-sf-divider">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h4 className="text-sm font-bold text-sf-text">
                            Overlay Comparison — {overlayData.length} scans
                        </h4>
                        <p className="text-xs text-gray-400">
                            Continuous common-grid display {isWavenumber ? '(4000 → 400 cm⁻¹)' : ''}
                        </p>
                    </div>
                    <span className="text-xs text-gray-400 font-mono px-2 py-1 bg-sf-raised dark:bg-gray-700 rounded">
                        {modality} • {yLabel}
                    </span>
                </div>
                <ResponsiveContainer width="100%" height="88%">
                    <LineChart data={overlayGrid || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="wavelength"
                            label={{ value: xLabel, position: 'insideBottomRight', offset: -5 }}
                            type="number"
                            reversed={isWavenumber}
                            domain={['dataMin', 'dataMax']}
                            tick={{ fontSize: 11 }}
                        />
                        <YAxis
                            label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
                            tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px', border: 'none',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                fontSize: '12px'
                            }}
                            labelFormatter={v => isWavenumber ? `${v} cm⁻¹` : `λ ${v} nm`}
                            formatter={(value, name) => [value !== null ? Number(value).toFixed(4) : 'N/A', name]}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                        />
                        {overlayData.map((scan, idx) => (
                            <Line
                                key={scan.id || idx}
                                type="monotone"
                                dataKey={`scan_${idx}`}
                                name={`v${scan.metadata?.scanVersion || idx + 1} — ${scan.filename || `Scan ${idx + 1}`}`}
                                stroke={TRACE_COLORS[idx % TRACE_COLORS.length]}
                                strokeWidth={1.5}
                                dot={false}
                                activeDot={{ r: 4 }}
                                connectNulls
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    }

    // ── SINGLE SCAN MODE (SL-03) ──
    if (!data || !data.chartData || data.chartData.length === 0) {
        return <div className="text-gray-500 text-center p-10">No spectral data available for this sample.</div>;
    }

    const modality = data.modality || 'NIR';
    const isWavenumber = data.axisUnit === 'WAVENUMBER_CM1' || modality === 'MIR';
    const yLabel = formatQuantity(data.quantity || data.metadata?.quantity, modality);
    const xLabel = isWavenumber ? 'Wavenumber (cm⁻¹)' : 'Wavelength (nm)';
    const dataKey = data.chartData[0]?.value !== undefined ? 'value' : 'absorbance';

    return (
        <div className="w-full h-80 bg-sf-surface p-4 rounded-lg shadow-sm border border-sf-divider">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-sf-text">
                    Spectral Analysis ({data.instrument || data.metadata?.instrument || modality}) - {data.scanDate ? new Date(data.scanDate).toLocaleDateString() : (data.timestamp ? new Date(data.timestamp).toLocaleDateString() : '')}
                </h4>
                <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-mono">
                        {isWavenumber ? 'IR Convention (4000 → 400 cm⁻¹)' : 'VNIR (Ascending)'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-sf-raised text-gray-600 dark:bg-gray-700 dark:text-gray-300 font-medium">
                        {yLabel}
                    </span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height="88%">
                <LineChart data={data.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--sf-divider, #e2e8f0)" />
                    <XAxis
                        dataKey="wavelength"
                        label={{ value: xLabel, position: 'insideBottomRight', offset: -5 }}
                        type="number"
                        reversed={isWavenumber}
                        domain={['dataMin', 'dataMax']}
                        tick={{ fontSize: 11 }}
                    />
                    <YAxis
                        label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelFormatter={v => isWavenumber ? `${Number(v).toFixed(1)} cm⁻¹` : `λ ${Number(v).toFixed(1)} nm`}
                        formatter={val => [Number(val).toFixed(4), yLabel]}
                    />
                    <Line
                        type="monotone"
                        dataKey={dataKey}
                        name={yLabel}
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SpectraViewer;
