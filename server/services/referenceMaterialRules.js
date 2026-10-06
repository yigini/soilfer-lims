const KINDS = Object.freeze(['CRM', 'LRM', 'CHECK_STANDARD', 'CALIBRATION_STANDARD', 'BLANK_MATRIX']);
const STATUSES = Object.freeze(['ACTIVE', 'QUARANTINED', 'EXPIRED', 'RETIRED']);
const VALUE_TYPES = Object.freeze(['CERTIFIED', 'INDICATIVE', 'CONSENSUS', 'LAB_ASSIGNED']);

function eligibility(material, now = new Date()) {
    if (material.status !== 'ACTIVE') return { eligible: false, reason: material.status };
    const dates = [material.expiryDate, material.inventoryLot?.expiryDate].filter(Boolean).map(value => new Date(value));
    if (dates.some(date => !Number.isFinite(date.getTime()))) return { eligible: false, reason: 'EXPIRY_INVALID' };
    const effectiveExpiry = dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : null;
    if (effectiveExpiry && effectiveExpiry <= now) return { eligible: false, reason: 'EXPIRED', effectiveExpiry };
    if (material.inventoryLotId && (!material.inventoryLot || material.inventoryLot.labId !== material.labId)) return { eligible: false, reason: 'INVENTORY_SCOPE_INVALID', effectiveExpiry };
    if (material.inventoryLot && material.inventoryLot.status !== 'AVAILABLE') return { eligible: false, reason: `INVENTORY_${material.inventoryLot.status}`, effectiveExpiry };
    return { eligible: true, reason: null, effectiveExpiry };
}

module.exports = { KINDS, STATUSES, VALUE_TYPES, eligibility };
