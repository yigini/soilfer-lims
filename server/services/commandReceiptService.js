const prisma = require('../prisma');

/**
 * Command Receipt Service for Idempotency and Deduplication
 * Per Section 9 & 17.2 of the Sample Workspace Redesign Plan
 */
class CommandReceiptService {
    /**
     * Check if a command with the given idempotency key has already executed
     * @param {string} idempotencyKey 
     * @param {string} commandType 
     * @param {string} actor 
     * @param {string} targetResource 
     * @param {string} [payloadHash]
     * @returns {Promise<{ isExisting: boolean, receipt?: object, conflict?: boolean, reason?: string }>}
     */
    static async checkReceipt(idempotencyKey, commandType, actor, targetResource, payloadHash = null) {
        if (!idempotencyKey) {
            return { isExisting: false };
        }

        const receipt = await prisma.commandReceipt.findUnique({
            where: { idempotencyKey }
        });

        if (!receipt) {
            return { isExisting: false };
        }

        // Verify that parameters match original command
        if (receipt.commandType !== commandType || receipt.actor !== actor || receipt.targetResource !== targetResource) {
            return { isExisting: true, conflict: true, reason: 'METADATA_MISMATCH', receipt };
        }

        let parsedOutcome = null;
        if (receipt.outcome) {
            try {
                parsedOutcome = JSON.parse(receipt.outcome);
            } catch {
                parsedOutcome = null;
            }
        }

        if (payloadHash && parsedOutcome?.payloadHash && parsedOutcome.payloadHash !== payloadHash) {
            return { isExisting: true, conflict: true, reason: 'PAYLOAD_HASH_MISMATCH', receipt: { ...receipt, parsedOutcome } };
        }

        return {
            isExisting: true,
            conflict: false,
            receipt: {
                ...receipt,
                parsedOutcome
            }
        };
    }

    /**
     * Compute a deterministic SHA256 hash of command parameters
     * @param {object} payload 
     * @returns {string|null}
     */
    static computePayloadHash(payload) {
        if (!payload || typeof payload !== 'object') return null;
        const crypto = require('crypto');
        const clean = { ...payload };
        delete clean.idempotencyKey;
        delete clean.expectedRevision;
        delete clean.previewHash;
        delete clean.previewToken;
        const sortedKeys = Object.keys(clean).sort();
        const normalized = {};
        for (const k of sortedKeys) {
            normalized[k] = clean[k];
        }
        return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
    }

    /**
     * Store a command receipt atomically within a transaction
     * @param {object} tx - Prisma transaction client
     * @param {object} params
     * @param {string} params.idempotencyKey
     * @param {string} params.commandType
     * @param {string} params.targetResource
     * @param {string} params.actor
     * @param {string} params.status - SUCCESS | FAILED
     * @param {object} [params.outcome]
     * @param {string} [params.payloadHash]
     */
    static async recordReceipt(tx, { idempotencyKey, commandType, targetResource, actor, status = 'SUCCESS', outcome = null, payloadHash = null }) {
        if (!idempotencyKey) {
            return null;
        }

        let storedOutcome = outcome;
        if (payloadHash) {
            if (storedOutcome && typeof storedOutcome === 'object' && !Array.isArray(storedOutcome)) {
                if (!storedOutcome.payloadHash) {
                    storedOutcome = { ...storedOutcome, payloadHash };
                }
            } else if (!storedOutcome) {
                storedOutcome = { payloadHash };
            }
        }

        const client = tx || prisma;
        return await client.commandReceipt.create({
            data: {
                idempotencyKey,
                commandType,
                targetResource,
                actor,
                status,
                outcome: storedOutcome ? JSON.stringify(storedOutcome) : null
            }
        });
    }
}

module.exports = CommandReceiptService;
