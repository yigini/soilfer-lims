/**
 * Spreadsheet Import Utilities
 * Production parsing, column detection, row limit validation, and leading zero preservation
 * for SoilFER LIMS project sample manifests.
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB limit
export const MAX_BATCH_ROWS = 2000;

export const LOCALIZED_SAMPLE_HEADERS = [
    'sample id', 'sample_id', 'sampleid', 'sample-id',
    'sample code', 'sample_code', 'samplecode', 'sample-code',
    'sample', 'identifier', 'id', 'code',
    'identificador', 'identificador de muestra', 'identificador_muestra', 'id_muestra', 'id muestra',
    'codigo', 'código', 'codigo de muestra', 'código de muestra', 'muestra',
    'identifiant', 'identifiant de l\'échantillon', 'identifiant echantillon', 'id_echantillon', 'id echantillon',
    'échantillon', 'echantillon', 'code echantillon', 'code échantillon', 'numéro d\'échantillon', 'numero d\'echantillon',
    'amostra', 'id_amostra', 'id amostra', 'código da amostra', 'codigo da amostra', 'identificador da amostra'
];

/**
 * Detect matching sample identifier columns using canonical exact phrases.
 * Avoids destructive fuzzy guessing (such as substring matching on 'id' or 'code')
 * which would incorrectly treat data rows like 'FIELD001' as headers.
 */
export const detectIdColumns = (headerRow) => {
    if (!headerRow || !Array.isArray(headerRow)) return [];
    const matchingCols = [];
    for (let c = 0; c < headerRow.length; c++) {
        const headerText = String(headerRow[c] || '').trim().toLowerCase();
        if (LOCALIZED_SAMPLE_HEADERS.includes(headerText)) {
            matchingCols.push(c);
        }
    }
    return matchingCols;
};

/**
 * Extract non-empty identifiers from a specified column.
 * Enforces the 2,000 row batch limit and returns a structured result.
 */
export const extractIdsFromColumn = (rows, colIdx, hasHeader, t = (k, fallback) => fallback) => {
    if (!rows || rows.length === 0) {
        return {
            success: false,
            error: t('projects.import.emptyFile', 'The selected spreadsheet file is empty.'),
            ids: []
        };
    }

    const startRow = hasHeader ? 1 : 0;
    const dataRows = rows.slice(startRow);

    if (dataRows.length > MAX_BATCH_ROWS) {
        return {
            success: false,
            error: t('projects.import.tooManyRows', `File contains ${dataRows.length} data rows, which exceeds the maximum allowed batch size of ${MAX_BATCH_ROWS} samples.`),
            ids: []
        };
    }

    const ids = [];
    for (let r = 0; r < dataRows.length; r++) {
        const val = String(dataRows[r]?.[colIdx] ?? '').trim();
        if (val) {
            ids.push(val);
        }
    }

    if (ids.length === 0) {
        return {
            success: false,
            error: t('projects.import.noIdsFoundInCol', 'No non-empty sample identifiers found in the selected column.'),
            ids: []
        };
    }

    return {
        success: true,
        error: null,
        ids
    };
};
