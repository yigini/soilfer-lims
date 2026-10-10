// #205: the structured preparation records payload the gate confirmation sends.
const NUMBER_FIELDS = ['temperatureC', 'massBeforeG', 'massAfterG', 'coarseFractionG', 'sieveMm', 'grindMm'];

/** Converts the editable form rows into the payload the server validates. */
export function preparationPayload(records = []) {
    return records.map(record => {
        const row = { gateCode: record.gateCode };
        for (const [key, value] of Object.entries(record)) {
            if (key === 'gateCode' || value === '' || value === null || value === undefined) continue;
            if (key === 'startedAt' || key === 'endedAt') {
                const date = new Date(value);
                row[key] = Number.isNaN(date.getTime()) ? value : date.toISOString();
            } else row[key] = NUMBER_FIELDS.includes(key) ? Number(value) : value;
        }
        return row;
    });
}
