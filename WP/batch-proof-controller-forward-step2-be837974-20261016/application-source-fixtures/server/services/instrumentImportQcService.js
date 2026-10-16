const { writeNativeMeasurements } = require('./qcNativeMeasurementService');

// Sole runtime caller of the internal entry-only option. HTTP callers cannot
// select it through the ordinary QC body or correction/evaluation routes.
async function commitQcMeasurements(db, actor, { batchId, importReceiptId, analysisCode, measurements }) {
    return writeNativeMeasurements(db, batchId, actor, { analysisCode, measurements }, { entryOnly: true, importReceiptId });
}
module.exports = { commitQcMeasurements };
