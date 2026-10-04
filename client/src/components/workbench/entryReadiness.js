const SEALED = ['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'];

export function canSelectInstrument(item) {
    if (!item || SEALED.includes(item.status)) return false;
    const blockers = item.readiness?.blockers || [];
    return item.readiness?.isReady === true ||
        (blockers.length > 0 && blockers.every(code => code === 'INSTRUMENT_REQUIRED'));
}

export function isEntryReady(item, equipment = []) {
    if (!item || SEALED.includes(item.status)) return false;
    if (item.readiness?.isReady === true) return true;
    if (!canSelectInstrument(item)) return false;
    const selectedId = item.draft?.instrumentId || item.equipmentId;
    const asset = equipment.find(candidate => candidate.id === selectedId);
    return !!asset && asset.status === 'IN_SERVICE' && asset.calibrationStatus !== 'OVERDUE';
}
