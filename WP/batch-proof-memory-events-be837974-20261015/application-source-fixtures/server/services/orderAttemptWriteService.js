const rules = require('./workflowStateRules');

// All new order-bound attempt INSERTs use one error boundary. Prisma may hide
// SQLite's trigger text behind P2003; clients receive a stable service code.
async function insertOrderBoundAttempt(tx, data) {
    rules.requireTransaction(tx);
    if (!data.orderLineId) throw new rules.TransitionError('Resolve the current order line before reserving a new execution.', 409, 'ORDER_LINE_REQUIRED');
    try { return await tx.workAttempt.create({ data }); }
    catch (error) {
        if (['P2003','P2002'].includes(error.code) || String(error.code || '').startsWith('SQLITE_CONSTRAINT')) {
            throw new rules.TransitionError('The storage contract refused this new execution. Reload the work before reserving another attempt.',
                409, 'ORDER_ATTEMPT_INSERT_REFUSED');
        }
        throw error;
    }
}
module.exports = { insertOrderBoundAttempt };
