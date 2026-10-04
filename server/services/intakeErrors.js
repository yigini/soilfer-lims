class IntakeError extends Error {
    constructor(statusCode, payload) {
        super(payload.message || payload.error || payload.code || 'Intake failed.');
        this.statusCode = statusCode;
        this.code = payload.code || payload.error;
        this.payload = payload;
    }
}
function respond(res, error) {
    if (error.payload) return res.status(error.statusCode).json(error.payload);
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, code: error.code, error: error.message, message: error.message });
    if (error.name === 'ProfileReferenceConflictError') return res.status(409).json({ success: false, code: error.code, error: error.code, message: error.message });
    console.error('[intakeService]', error);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
}
module.exports = { IntakeError, respond };
