const rules = require('../services/qcRuleService');
const reply = (res, e) => res.status(e.statusCode || 500).json({ code: e.code || 'QC_RULE_REQUEST_FAILED', error: e.statusCode ? e.message : 'Failed to process QC rules.' });
exports.list = async (req, res) => {
    try { res.json({ data: await rules.list(req.user, req.query.labId, req.query.analysisCode, req.query.methodologyId || null) }); }
    catch (e) { reply(res, e); }
};
exports.change = async (req, res) => {
    try { res.status(201).json({ data: await rules.change(req.user, req.body) }); }
    catch (e) { reply(res, e); }
};
