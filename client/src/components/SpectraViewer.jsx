import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SpectraViewer = ({ data }) => {
    if (!data || !data.chartData || data.chartData.length === 0) {
        return <div className="text-gray-500 text-center p-10">No spectral data available for this sample.</div>;
    }

    return (
        <div className="w-full h-80 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <h4 className="text-sm font-bold text-gray-700 mb-4">Spectral Analysis ({data.instrument}) - {new Date(data.scanDate).toLocaleDateString()}</h4>
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
                        label={{ value: 'Absorbance', angle: -90, position: 'insideLeft' }}
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
