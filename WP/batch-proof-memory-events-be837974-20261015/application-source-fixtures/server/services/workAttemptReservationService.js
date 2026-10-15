// Shared by execution allocation and the read-only order-impact report.
// A retained OPEN reservation bypasses new-attempt order-line resolution.
function inspectOpenExecutionReservations(open) {
    if (open.length > 1) return { mode: 'AMBIGUOUS_OPEN', attemptIds: open.map(row => row.id) };
    if (open.length === 1) return { mode: 'RESERVED_OPEN', attemptId: open[0].id };
    return { mode: 'NEW_INSERT' };
}
module.exports = { inspectOpenExecutionReservations };
