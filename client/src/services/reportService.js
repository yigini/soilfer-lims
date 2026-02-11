import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateAnalysisReport = (sample, results) => {
    const doc = new jsPDF();

    // -- Header --
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Blue
    doc.text('SoilFER LIMS', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Official Laboratory Report', 14, 26);

    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);

    // -- Sample Info --
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Sample Information', 14, 40);

    doc.setFontSize(10);
    const info = [
        ['Lab ID:', sample.labId],
        ['Project:', sample.projectCode],
        ['Collection Date:', sample.collectionDate || '-'],
        ['Reception Date:', sample.receptionDate ? sample.receptionDate.split('T')[0] : '-'],
        ['Coordinates:', sample.location ? `${sample.location.lat}, ${sample.location.lng}` : '-']
    ];

    let y = 50;
    info.forEach(row => {
        doc.setFont(undefined, 'bold');
        doc.text(row[0], 14, y);
        doc.setFont(undefined, 'normal');
        doc.text(row[1], 50, y);
        y += 6;
    });

    // -- Results Table --
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Analytical Results', 14, y + 10);

    const tableData = results.map(r => [
        r.paramName || r.param,
        r.value,
        r.unit,
        r.flags && r.flags.length > 0 ? `FLAG: ${r.flags.join(', ')}` : 'PASS'
    ]);

    doc.autoTable({
        startY: y + 15,
        head: [['Parameter', 'Value', 'Unit', 'QC Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 10 }
    });

    // -- Footer --
    const finalY = doc.lastAutoTable.finalY || 150;

    doc.setFontSize(10);
    doc.text('Authorized By:', 14, finalY + 20);
    doc.setFont(undefined, 'italic');
    doc.text(localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).name : 'Lab Manager', 45, finalY + 20);

    doc.setLineWidth(0.5);
    doc.line(45, finalY + 21, 100, finalY + 21); // Underline signature

    doc.setFont(undefined, 'normal');
    doc.text('Date:', 120, finalY + 20);
    doc.text(new Date().toLocaleDateString(), 135, finalY + 20);

    doc.save(`COA_${sample.labId}.pdf`);
};
