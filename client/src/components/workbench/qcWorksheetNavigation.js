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
    if (!['Tab', 'Enter'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const table = event.currentTarget;
    const cells = [...table.querySelectorAll('input, textarea')].filter(cell =>
        !cell.disabled && !cell.readOnly && cell.tabIndex !== -1 &&
        !['checkbox', 'radio', 'hidden'].includes(cell.type));
    const index = cells.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault(); event.stopPropagation();
    const nextIndex = index + (event.shiftKey ? -1 : 1);
    // Reverse navigation stays in the grid; forward completion goes to the
    // existing Result review button, never to the run-setup controls.
    if (nextIndex < 0) cells.at(-1)?.focus();
    else if (nextIndex < cells.length) cells[nextIndex].focus();
    else (completionButton || cells[0])?.focus();
}
