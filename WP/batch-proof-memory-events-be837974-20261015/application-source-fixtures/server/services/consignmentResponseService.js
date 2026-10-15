function consignmentResponse(record) {
    // The public alias is the declaration, never the deprecated stored count.
    return { ...record, declaredExpectedCount: record.declaredExpectedCount ?? null, expectedCount: record.declaredExpectedCount ?? null };
}
module.exports = { consignmentResponse };
