// Match Result editors through the server's work-item links. A sample id alone
// must never attach another method's or another run's draft to a QC position.
export function runWorksheetRows(positions, items, analysisCode) {
    return positions.map(position => {
        const ids = new Set((position.workItems || []).filter(link => link.analysisCode === analysisCode)
            .map(link => link.workItemId));
        const item = position.kind === 'SAMPLE' ? items.find(row => ids.has(row.workItemId || row.id)) : null;
        return { position, item: item || null };
    });
}

export function advanceWorksheetCell(event, completionButton) {
    const key = event.code === 'NumpadEnter' ? 'Enter' : event.key;
    if (!['Tab', 'Enter', 'ArrowDown', 'ArrowUp'].includes(key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const table = event.currentTarget;
    const available = cell => !cell.disabled && !cell.readOnly && cell.tabIndex !== -1;
    // Keep disabled inputs in the column map so a held first fraction cannot
    // shift the second fraction into its column. Only eligible cells get focus.
    const columns = [...table.querySelectorAll('input, textarea')].filter(cell =>
        !['checkbox', 'radio', 'hidden'].includes(cell.type));
    const cells = columns.filter(available);
    const index = cells.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault(); event.stopPropagation();
    const backwards = key === 'ArrowUp' || ((key === 'Enter' || key === 'Tab') && event.shiftKey);
    if (key === 'Tab') {
        const next = cells[index + (backwards ? -1 : 1)];
        if (next) next.focus();
        else if (!backwards) completionButton?.focus();
        return;
    }
    const rows = new Map();
    columns.forEach(cell => {
        const row = cell.closest?.('tr') || cell;
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(cell);
    });
    const rowCells = [...rows.values()];
    const rowIndex = rowCells.findIndex(row => row.includes(event.target));
    const column = rowCells[rowIndex].indexOf(event.target);
    for (let nextRow = rowIndex + (backwards ? -1 : 1); nextRow >= 0 && nextRow < rowCells.length;
        nextRow += backwards ? -1 : 1) {
        const next = rowCells[nextRow][column];
        if (next && available(next)) { next.focus(); return; }
    }
    if (!backwards) completionButton?.focus();
}

// Restore only the controlled cell's client value. The caller chooses its
// existing draft-state callback; this helper never sends a command.
export function revertWorksheetCell(event, focusValue, restore) {
    if (event.key !== 'Escape' || !restore || focusValue === null ||
        event.currentTarget.value === focusValue) return false;
    event.preventDefault(); event.stopPropagation();
    restore(focusValue);
    return true;
}
