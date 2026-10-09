const SEALED = ['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'];

// The RUN identity is supplied by the server's central Result context.
export function entryInstrumentId(item, overrideId) {
    return item?.instrumentSource === 'RUN' ? item.equipmentId : overrideId || item?.draft?.instrumentId || item?.equipmentId;
}

export function canSelectInstrument(item) {
    if (!item || SEALED.includes(item.status)) return false;
    const blockers = item.readiness?.blockers || [];
    return item.readiness?.isReady === true ||
        (blockers.length > 0 && blockers.every(code => code === 'INSTRUMENT_REQUIRED'));
}

export function isEntryReady(item, equipment = []) {
    if (!item || SEALED.includes(item.status) && !(item.status === 'COMPLETED' &&
        item.sampleReplicates?.requiredCount === 2 && item.sampleReplicates?.canAppend === true)) return false;
    const selectedId = entryInstrumentId(item);
    const asset = (item.eligibleEquipment || equipment).find(candidate => candidate.id === selectedId);
    if (asset && (asset.status !== 'IN_SERVICE' || ['BLOCKED', 'NOT_CONFIGURED'].includes(asset.readiness) ||
        ['OVERDUE', 'FAILED'].includes(asset.calibrationStatus))) return false;
    if (item.readiness?.isReady === true) return true;
    if (!canSelectInstrument(item)) return false;
    return !!asset;
}
