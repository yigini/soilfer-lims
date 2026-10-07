// Only unmeasured pre-start positions may be replaced. Bound QC ids and every
// certificate snapshot survive, including extras no longer required by a rule.
function retainBoundPositions(sequence, previous) {
    const retained = previous.positions.filter(row => (row.references || []).length);
    const available = [...retained], idMap = new Map();
    const positions = sequence.positions.map(planned => {
        const index = available.findIndex(row => row.kind === planned.kind);
        if (index < 0) return planned;
        const [position] = available.splice(index, 1);
        idMap.set(planned.id, position.id);
        return { ...planned, id: position.id, references: position.references };
    });
    for (const position of available) {
        const row = { ...position, servedAnalytes: [...new Set(position.references.filter(reference => !reference.supersededById && reference.serviceStatus !== 'NOT_SERVED').map(reference => reference.analysisCode))] };
        // Preserve closing calibration checks as the final bracket.
        const closing = positions.at(-2)?.kind === 'CCV' && positions.at(-1)?.kind === 'CCB' ? positions.length - 2 : positions.length;
        positions.splice(closing, 0, row);
    }
    positions.forEach((row, index) => { row.position = index + 1; if (idMap.has(row.duplicateOfPositionId)) row.duplicateOfPositionId = idMap.get(row.duplicateOfPositionId); });
    return { ...sequence, positions, rebuild: { retainedPositionIds: retained.map(row => row.id),
        supersededPositionIds: previous.positions.filter(row => !retained.some(kept => kept.id === row.id)).map(row => row.id),
        newPositionIds: positions.filter(row => !retained.some(kept => kept.id === row.id)).map(row => row.id) } };
}

async function replaceUnmeasuredPositions(tx, previous, sequence, workItemIds) {
    const retainedIds = new Set(sequence.rebuild.retainedPositionIds);
    const replace = previous.positions.filter(row => !retainedIds.has(row.id));
    await tx.batchPositionWorkItem.deleteMany({ where: { positionId: { in: previous.positions.map(row => row.id) } } });
    // Duplicates are removed before their sample parents, respecting RESTRICT.
    for (const ids of [replace.filter(row => row.kind === 'DUPLICATE'), replace.filter(row => row.kind !== 'DUPLICATE')]) {
        await tx.batchPosition.deleteMany({ where: { id: { in: ids.map(row => row.id) } } });
    }
    // Move retained ids above both old and new sequences before assigning their
    // final order, avoiding collisions with the unique (batchId,position) key.
    const offset = Math.max(sequence.positions.length, ...previous.positions.map(row => row.position)) + 1;
    for (const [index, id] of sequence.rebuild.retainedPositionIds.entries()) await tx.batchPosition.update({ where: { id }, data: { position: offset + index } });
    const detached = previous.workItems.filter(row => !workItemIds.includes(row.id));
    await tx.workItem.updateMany({ where: { id: { in: detached.map(row => row.id) }, batchId: previous.id }, data: { batchId: null, rackPosition: null } });
}

module.exports = { retainBoundPositions, replaceUnmeasuredPositions };
