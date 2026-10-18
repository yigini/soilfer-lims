const fs = require('node:fs'), path = require('node:path');
const { worksheet203Fixture } = require('../helpers/worksheet203Fixture');
const service = require('../../services/workbenchWorksheetService');
const pageCount = pdf => (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;

test('40 samples plus ordinary QC and all six selected template columns fit at most two actual A4 PDF pages', async () => {
    const f = worksheet203Fixture();
    const before = JSON.stringify(f.batch);
    const model = await service.worksheetModel(f.db, f.batch.id, f.actor, undefined, { now: new Date('2026-10-18T04:00:00Z') });
    expect(model.rows.filter(row => row.kind === 'SAMPLE')).toHaveLength(40);
    expect(model.rows).toHaveLength(47);
    expect(model.columns).toHaveLength(6);
    expect(model.rows.filter(row => row.kind === 'SAMPLE').every(row => row.barcode && row.code)).toBe(true);
    expect(model.rows.filter(row => row.kind !== 'SAMPLE').every(row => row.barcode === null && row.code === null)).toBe(true);
    expect(model.rows.find(row => row.kind === 'LRM').lot).toBe('RM-LOT-17');
    expect(model.method).toMatchObject({ name: 'Frozen synthetic method A', version: 1 });
    expect(f.reads.some(row => row.model === 'methodology')).toBe(false);
    const pdf = await service.renderWorksheet(model);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(pdf)).toBeGreaterThan(0);
    expect(pageCount(pdf)).toBeLessThanOrEqual(2);
    expect(pdf.toString('latin1')).toMatch(/\/MediaBox \[0 0 595\.28 841\.89\]/);
    expect(f.writes).toEqual([]);
    expect(JSON.stringify(f.batch)).toBe(before);
    if (process.env.ISSUE203_PUBLIC_PDF_OUTPUT) fs.writeFileSync(process.env.ISSUE203_PUBLIC_PDF_OUTPUT, pdf, { flag: 'wx' });
});

test('mixed runs require an explicit valid analyte, and selected B never receives A-only QC or template columns', async () => {
    const f = worksheet203Fixture({ mixed: true });
    await expect(service.worksheetModel(f.db, f.batch.id, f.actor)).rejects.toMatchObject({ statusCode: 422, code: 'WORKSHEET_ANALYTE_REQUIRED' });
    await expect(service.worksheetModel(f.db, f.batch.id, f.actor, 'MISSING')).rejects.toMatchObject({ statusCode: 422, code: 'WORKSHEET_ANALYTE_NOT_IN_RUN' });
    await expect(service.worksheetModel(f.db, f.batch.id, f.actor, ['A', 'B'])).rejects.toMatchObject({ statusCode: 422, code: 'WORKSHEET_ANALYTE_NOT_IN_RUN' });
    const model = await service.worksheetModel(f.db, f.batch.id, f.actor, 'B');
    expect(model.analysisCode).toBe('B');
    expect(model.columns).toHaveLength(1);
    expect(model.rows).toHaveLength(44);
    expect(model.rows.filter(row => row.kind === 'SAMPLE')).toHaveLength(40);
    // Duplicates serve every analyte served by their linked parent sample.
    expect(model.rows.filter(row => row.kind === 'DUPLICATE')).toHaveLength(4);
    expect(model.rows.every(row => ['SAMPLE', 'DUPLICATE'].includes(row.kind))).toBe(true);
    expect(f.writes).toEqual([]);
});

test.each([{ missingCode: true }, { conflictCode: true }])('missing/conflicting issued code %j leaves the sample row printable without a barcode or write', async options => {
    const f = worksheet203Fixture({ samples: 2, ...options });
    const model = await service.worksheetModel(f.db, f.batch.id, f.actor);
    expect(model.rows.filter(row => row.kind === 'SAMPLE')).toHaveLength(2);
    expect(model.rows.find(row => row.kind === 'SAMPLE')).toMatchObject({ code: null, barcode: null });
    expect(pageCount(await service.renderWorksheet(model))).toBe(1);
    expect(f.writes).toEqual([]);
});

test('permission, tenant scope and corrupt run membership are refused through the real read authority', async () => {
    const f = worksheet203Fixture({ samples: 2 });
    await expect(service.worksheetModel(f.db, f.batch.id, { ...f.actor, role: 'VIEWER' })).rejects.toMatchObject({ statusCode: 403, code: 'WORKSHEET_PERMISSION_DENIED' });
    await expect(service.worksheetModel(f.db, f.batch.id, { ...f.actor, labId: f.foreign.id })).rejects.toMatchObject({ statusCode: 403 });
    f.sampleRows.get('synthetic-sample-1').assignedLab = f.foreign.id;
    await expect(service.worksheetModel(f.db, f.batch.id, f.actor)).rejects.toMatchObject({ statusCode: 409, code: 'WORKSHEET_MEMBERSHIP_INVALID' });
    expect(f.writes).toEqual([]);
});

test('a header that cannot fit a physical sheet gets a stable refusal instead of overlapping raw-data rows', async () => {
    const f = worksheet203Fixture({ samples: 2 });
    const model = await service.worksheetModel(f.db, f.batch.id, f.actor);
    model.method.name = 'Long method label '.repeat(2000);
    await expect(service.renderWorksheet(model)).rejects.toMatchObject({ statusCode: 422, code: 'WORKSHEET_LAYOUT_TOO_LARGE' });
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('%s renders the worksheet and includes every visible label and stable error translation', async locale => {
    const f = worksheet203Fixture({ samples: 2 });
    const labels = service.labelsFor(locale);
    expect(Object.keys(labels).sort()).toEqual(Object.keys(service.labelsFor('en')).sort());
    expect(Object.keys(labels.errors).sort()).toEqual(Object.keys(service.labelsFor('en').errors).sort());
    expect(pageCount(await service.renderWorksheet(await service.worksheetModel(f.db, f.batch.id, f.actor), locale))).toBe(1);
});

test('the PDF route retains shared token/permission guards and does not enter a write command', () => {
    const routes = fs.readFileSync(path.resolve(__dirname, '../../routes/workbenchRoutes.js'), 'utf8');
    expect(routes).toContain('router.use(verifyToken)');
    expect(routes).toMatch(/router\.get\('\/runs\/:batchId\/worksheet\.pdf', checkPermission\('ENTER_RESULTS'\), worksheetController\.getWorksheet\)/);
});
