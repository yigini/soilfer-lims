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
     * @returns {Promise<{ isExisting: boolean, receipt?: object, conflict?: boolean }>}
     */
    static async checkReceipt(idempotencyKey, commandType, actor, targetResource) {
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
            return { isExisting: true, conflict: true, receipt };
        }

        return {
            isExisting: true,
            conflict: false,
            receipt: {
                ...receipt,
                parsedOutcome: receipt.outcome ? JSON.parse(receipt.outcome) : null
            }
        };
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
     */
    static async recordReceipt(tx, { idempotencyKey, commandType, targetResource, actor, status = 'SUCCESS', outcome = null }) {
        if (!idempotencyKey) {
            return null;
        }

        const client = tx || prisma;
        return await client.commandReceipt.create({
            data: {
                idempotencyKey,
                commandType,
                targetResource,
                actor,
                status,
                outcome: outcome ? JSON.stringify(outcome) : null
            }
        });
    }
}

module.exports = CommandReceiptService;
