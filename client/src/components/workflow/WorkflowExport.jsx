import React, { useCallback } from 'react';
import { Download, Image, FileText } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

export default function WorkflowExport({ graphRef, sample, t }) {
    const handlePNG = useCallback(async () => {
        if (!graphRef?.current) return;
        try {
            const dataUrl = await toPng(graphRef.current, {
                backgroundColor: '#f9fafb',
                pixelRatio: 2,
                filter: (node) => {
                    // Skip React Flow controls/minimap for clean export
                    if (node?.classList?.contains('react-flow__controls')) return false;
                    if (node?.classList?.contains('react-flow__minimap')) return false;
                    return true;
                },
            });
            const link = document.createElement('a');
            link.download = `workflow-${sample?.labId || sample?.id || 'export'}-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('PNG export failed:', err);
        }
    }, [graphRef, sample]);

    const handlePDF = useCallback(async () => {
        if (!graphRef?.current) return;
        try {
            const dataUrl = await toPng(graphRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                filter: (node) => {
                    if (node?.classList?.contains('react-flow__controls')) return false;
                    if (node?.classList?.contains('react-flow__minimap')) return false;
                    return true;
                },
            });

            const img = new window.Image();
            img.src = dataUrl;
            await new Promise(resolve => { img.onload = resolve; });

            const pdf = new jsPDF({
                orientation: img.width > img.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [img.width / 2, img.height / 2 + 60],
            });

            // Header
            pdf.setFontSize(14);
            pdf.setFont(undefined, 'bold');
            pdf.text(`Sample Workflow: ${sample?.labId || sample?.id || ''}`, 20, 30);
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'normal');
            pdf.text(`Project: ${sample?.projectCode || '—'}  |  Status: ${sample?.status || '—'}`, 20, 45);
            pdf.text(`Exported: ${new Date().toLocaleString()}`, 20, 57);

            // Graph image
            pdf.addImage(dataUrl, 'PNG', 0, 65, img.width / 2, img.height / 2);

            pdf.save(`workflow-${sample?.labId || sample?.id || 'export'}-${Date.now()}.pdf`);
        } catch (err) {
            console.error('PDF export failed:', err);
        }
    }, [graphRef, sample]);

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handlePNG}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
            >
                <Image size={14} />
                PNG
            </button>
            <button
                onClick={handlePDF}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
            >
                <FileText size={14} />
                PDF
            </button>
        </div>
    );
}
