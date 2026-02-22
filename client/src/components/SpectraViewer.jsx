import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Color palette for multi-trace overlay
const TRACE_COLORS = [
    '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
];

/**
 * SpectraViewer — supports single scan OR multi-scan overlay.
 *
 * Props:
 *   data        — single scan object { chartData, instrument, scanDate, modality, ... }
 *   overlayData — optional array of scan objects for multi-trace overlay
 *                 each: { id, chartData, filename, modality, metadata }
 */
const SpectraViewer = ({ data, overlayData }) => {
    const isOverlay = overlayData && overlayData.length > 1;

    // ── OVERLAY MODE ──
    if (isOverlay) {
        // Merge all scans into unified wavelength axis
        const wavelengthSet = new Set();
        overlayData.forEach(scan => {
            if (scan.chartData) scan.chartData.forEach(pt => wavelengthSet.add(pt.wavelength));
        });
        const sortedWavelengths = [...wavelengthSet].sort((a, b) => a - b);

        // Build merged data: one row per wavelength, columns = scan traces
        const mergedData = sortedWavelengths.map(w => {
            const row = { wavelength: w };
            overlayData.forEach((scan, idx) => {
                const pt = scan.chartData?.find(p => p.wavelength === w);
                row[`scan_${idx}`] = pt ? pt.absorbance : null;
            });
            return row;
        });

        const modality = overlayData[0]?.modality || 'NIR';
        const yLabel = modality === 'MIR' ? 'Absorbance' : 'Reflectance';

        return (
            <div className="w-full h-96 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                        Overlay Comparison — {overlayData.length} scans
                    </h4>
                    <span className="text-xs text-gray-400 font-mono">{modality}</span>
                </div>
                <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={mergedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="wavelength"
                            label={{ value: 'Wavelength (nm)', position: 'insideBottomRight', offset: -5 }}
                            type="number"
                            domain={['auto', 'auto']}
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
                            labelFormatter={v => `λ ${v} nm`}
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

    // ── SINGLE SCAN MODE ── (original behavior)
    if (!data || !data.chartData || data.chartData.length === 0) {
        return <div className="text-gray-500 text-center p-10">No spectral data available for this sample.</div>;
    }

    const modality = data.modality || 'NIR';
    const yLabel = modality === 'MIR' ? 'Absorbance' : 'Reflectance';

    return (
        <div className="w-full h-80 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">
                Spectral Analysis ({data.instrument || modality}) - {data.scanDate ? new Date(data.scanDate).toLocaleDateString() : ''}
            </h4>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        dataKey="wavelength"
                        label={{ value: 'Wavelength (nm)', position: 'insideBottomRight', offset: -5 }}
                        type="number"
                        domain={['auto', 'auto']}
                    />
                    <YAxis
                        label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="absorbance"
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
