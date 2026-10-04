const crypto = require('crypto');
const { calculateUsdaTexture } = require('../utils/soilCalculations');

// Call only inside the transaction that writes the source fractions.
async function deriveTextureResult(tx, { sampleId, replicateNo = 1, actor, now = new Date(), retainRawInput = false }) {
    const fractions = await tx.result.findMany({
        where: { sampleId, replicateNo, isCurrent: true, param: { in: ['SAND', 'SILT', 'CLAY'] } },
        orderBy: { createdAt: 'desc' }
    });
    const [sand, silt, clay] = ['SAND', 'SILT', 'CLAY'].map(param => fractions.find(row => row.param === param));
    if (!sand || !silt || !clay) return null;
    const texture = calculateUsdaTexture(sand.numericValue ?? sand.value, silt.numericValue ?? silt.value, clay.numericValue ?? clay.value);
    if (!texture.isValid) return null;
    const id = crypto.randomUUID();
    await tx.result.updateMany({
        where: { sampleId, param: 'TEXTURE', replicateNo, isCurrent: true },
        data: { isCurrent: false, supersededBy: id }
    });
    return tx.result.create({ data: {
        id, sampleId, param: 'TEXTURE', value: texture.className,
        ...(retainRawInput ? { rawInput: JSON.stringify({ sand: sand.rawInput, silt: silt.rawInput, clay: clay.rawInput }) } : {}),
        numericValue: null, unit: '', isValid: true, censoring: 'NONE', basis: 'AIR_DRY',
        replicateNo, isCurrent: true, provenance: 'DERIVED', enteredBy: actor || 'SYSTEM_CALC',
        analysedAt: now, createdAt: now, updatedAt: now
    } });
}

module.exports = { deriveTextureResult };
