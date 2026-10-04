const prisma = require('../prisma');

class IdGenerator {
    /**
     * Compatibility entry point for sample-code allocation. The caller must
     * supply the intake transaction; format and reset come from lab policy.
     */
    async generateLabId(labReference, prefix = 'S', tx, context = {}) {
        return require('./sampleCodeService').allocateSampleCode(tx, { labReference, ...context });
    }

    /**
     * Generates a unique Sample ID for Walk-ins.
     * Format: {Prefix}{Number}
     * Example: W001 (Walk-in), P001 (PT)
     */
    async generateWalkInOriginalId(prefixType = 'W') {
        return await this._getSequencedId(prefixType, 3, false);
    }

    /**
     * Helper for Walk-in creation
     */
    async generateWalkInId(countryCode, prefixType = 'W') {
        // User wants "one letter and three numbers"
        return await this._getSequencedId(prefixType, 3, false);
    }

    /**
     * Internal helper to find max sequence and increment
     * prefix: The ID prefix (e.g., "S", "W", "P")
     * pad: Padding length for the number (3 for "001")
     * useHyphen: Whether to put a hyphen between prefix and sequence
     */
    async _getSequencedId(prefix, pad, useHyphen = true, db = prisma) {
        const separator = useHyphen ? '-' : '';
        const matchPrefix = `${prefix}${separator}`;

        // Retry loop to handle concurrent ID generation (Finding #9)
        for (let attempt = 0; attempt < 5; attempt++) {
            // Check both labId and originalId to ensure absolute uniqueness across the system
            const samples = await db.sample.findMany({
                where: {
                    OR: [
                        { labId: { startsWith: matchPrefix } },
                        { originalId: { startsWith: matchPrefix } }
                    ]
                },
                select: { labId: true, originalId: true }
            });

            let maxSeq = 0;
            samples.forEach(s => {
                [s.labId, s.originalId].forEach(targetId => {
                    if (!targetId || !targetId.startsWith(matchPrefix)) return;

                    let numericPart;
                    if (useHyphen) {
                        const parts = targetId.split('-');
                        numericPart = parts[parts.length - 1];
                    } else {
                        numericPart = targetId.substring(prefix.length);
                    }

                    const seq = parseInt(numericPart);
                    if (!isNaN(seq) && seq > maxSeq) {
                        maxSeq = seq;
                    }
                });
            });

            const nextSeqNum = maxSeq + 1 + attempt; // Add attempt offset to avoid retrying same number
            const nextSeq = nextSeqNum.toString().padStart(pad, '0');
            const candidateId = `${prefix}${separator}${nextSeq}`;

            // Verify the candidate doesn't already exist (collision check)
            const exists = await db.sample.findFirst({
                where: {
                    OR: [
                        { id: candidateId },
                        { labId: candidateId },
                        { originalId: candidateId }
                    ]
                }
            });

            if (!exists) {
                return candidateId;
            }

            console.warn(`[ID_GEN] Collision detected for ${candidateId}, retrying (attempt ${attempt + 1})`);
        }

        // Fallback: use timestamp-based ID to guarantee uniqueness
        const fallbackId = `${prefix}${separator}${Date.now().toString().slice(-6)}`;
        console.warn(`[ID_GEN] All retries exhausted, using fallback ID: ${fallbackId}`);
        return fallbackId;
    }
}

module.exports = new IdGenerator();
