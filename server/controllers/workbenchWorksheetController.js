const db = require('../prisma');
const service = require('../services/workbenchWorksheetService');

exports.getWorksheet = async (req, res) => {
    const locale = req.locale || req.user?.language || 'en';
    const labels = service.labelsFor(locale);
    try {
        const model = await db.$transaction(tx => service.worksheetModel(tx, req.params.batchId, req.user, req.query.analysisCode));
        const pdf = await service.renderWorksheet(model, locale);
        res.set('Cache-Control', 'no-store');
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', 'attachment; filename="run-worksheet.pdf"');
        return res.send(pdf);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ code: error.code || 'WORKSHEET_FAILED',
            error: labels.errors[error.code] || (error.statusCode ? error.message : labels.errors.WORKSHEET_FAILED) });
    }
};
