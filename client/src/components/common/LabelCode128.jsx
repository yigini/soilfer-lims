import React from 'react';
import { code128Data } from '../../utils/labelBarcode';

export default function LabelCode128({ code, heightMm = 10 }) {
    const { bits, width } = code128Data(code);
    const bars = [];
    for (let start = 0; start < bits.length;) {
        let end = start + 1;
        while (end < bits.length && bits[end] === bits[start]) end++;
        if (bits[start] === '1') bars.push(<rect key={start} x={start + 10} y="0" width={end - start} height="32" fill="black" />);
        start = end;
    }
    return <svg role="img" aria-label={`Code128 ${code}`} data-code={code} viewBox={`0 0 ${width} 32`}
        preserveAspectRatio="none" style={{ width: '100%', height: `${heightMm}mm`, flexShrink: 0 }} shapeRendering="crispEdges">
        <rect width={width} height="32" fill="white" />{bars}
    </svg>;
}
