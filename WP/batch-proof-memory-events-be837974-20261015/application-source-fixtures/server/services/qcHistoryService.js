function requireBatchHistory(value) {
    try {
        const history = typeof value === 'string' ? JSON.parse(value) : value ?? [];
        if (Array.isArray(history)) return history;
    } catch { /* Refuse corrupt evidence without replacing it. */ }
    throw Object.assign(new Error('Batch history needs repair before use.'), { statusCode: 409, code: 'BATCH_HISTORY_INVALID' });
}
module.exports = { requireBatchHistory };
