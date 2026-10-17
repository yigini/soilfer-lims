const prisma = require('../prisma');
const labels = require('../services/labelPrintService');
const { mapStateError } = require('../services/workflowStateRules');
const handler = command => async (req, res) => {
    try { res.json(command === 'preview' ? { labels: await labels.preview(prisma, req.user, req.body) } : await labels.print(prisma, req.user, req.body)); }
    catch (failure) {
        const error = mapStateError(failure, 'LABEL_PRINT_CHANGED');
        if (!error.statusCode) console.error('Label print failed:', error);
        const locale = require('../utils/localeResolver').resolveLocale({ sessionOverride: req.locale, acceptLanguage: req.headers['accept-language'], fallbackLocale: 'en' });
        const catalog = require(`../locales/${locale}.json`).labelPrint;
        res.status(error.statusCode || 500).json({ code: error.code || 'LABEL_PRINT_FAILED', error: catalog.errors[error.code] || catalog.failed });
    }
};
exports.preview = handler('preview');
exports.print = handler('print');
