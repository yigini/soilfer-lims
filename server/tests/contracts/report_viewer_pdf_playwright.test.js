const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { randomUUID, createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const { qcGateFixture } = require('../helpers/qcGateFixture');

// CI uses Poppler. Windows may select its installed PyMuPDF for the same
// actual-page text assertions; no PDF internals or mocked drawing calls.
const pdfText = (file, page) => process.env.LIMS_TEST_PDF_PYTHON
    ? execFileSync(process.env.LIMS_TEST_PDF_PYTHON, ['-c',
        'import pymupdf,sys; d=pymupdf.open(sys.argv[1]); n=int(sys.argv[2]); print("\\n".join(p.get_text() for p in ([d[n-1]] if n else d)))',
        file, String(page || 0)], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    : execFileSync('pdftotext', [...(page ? ['-f', String(page), '-l', String(page)] : []), '-layout', file, '-'], { encoding: 'utf8' });
const pdfPages = file => Number(execFileSync('pdfinfo', [file], { encoding: 'utf8' }).match(/^Pages:\s+(\d+)/m)?.[1]);

test('the real report viewer downloads its official stored version and prints the complete document only', async () => {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 } });
    const previousServe = process.env.SERVE_CLIENT, previousSecret = process.env.JWT_SECRET;
    const builtClient = path.resolve(__dirname, '../../../client/dist');
    const ownedClient = fs.mkdtempSync(path.join(os.tmpdir(), 'lims-report-client-'));
    const artifacts = path.resolve(__dirname, '../../../output/playwright/report-viewer-pdf');
    fs.mkdirSync(artifacts, { recursive: true });
    fs.cpSync(builtClient, ownedClient, { recursive: true });
    expect(fs.readFileSync(path.join(ownedClient, 'index.html'))).toEqual(fs.readFileSync(path.join(builtClient, 'index.html')));
    let app, server, browser, page;
    try {
        const at = '2026-11-17T10:00:00.000Z';
        const parameters = [
            ['PH_H2O', 'Soil pH', '6.8', 'pH units'], ['SOC', 'Organic carbon', '18.5', 'g/kg'],
            ['TN', 'Total nitrogen', '1.2', 'g/kg'], ['SAND', 'Sand', '60', '%'],
            ['SILT', 'Silt', '25', '%'], ['CLAY', 'Clay', '15', '%']
        ];
        const content = {
            meta: { locale: 'en' }, reportNumber: 'OWNED-2026-00455',
            sample: { id: f.items[0].sampleId, labId: 'PDF-SAMPLE-455', originalId: 'PDF-ORIGINAL-455', approvedBy: 'Owned reviewer', approvedAt: at },
            client: { name: 'Owned report client' }, lab: { name: 'Owned report laboratory' },
            resultGroups: [{ categoryName: 'Recorded soil measurements', items: parameters.map(([param, name, value, unit], index) => ({
                param, name, value, unit, method: `Recorded method ${index + 1}`, standard: `Recorded SOP ${index + 1}`,
                uncertainty: { state: 'NOT_STATED' }
            })) }],
            methodologies: parameters.map(([param, name], index) => ({ param, paramName: name, method: `Recorded method ${index + 1}`,
                methodVersion: '1', standard: `Recorded SOP ${index + 1}`,
                reference: { citation: `Recorded reference ${index + 1}. ` + 'Documented procedure, preparation, calibration and measurement conditions retained for this synthetic report. '.repeat(7) } })),
            signedBy: { name: 'Owned PDF Reviewer', username: 'owned-reviewer', title: 'Laboratory manager', date: at },
            publication: { status: 'PUBLISHED', publishedAt: at, issuer: { name: 'Owned PDF Issuer', username: 'owned-issuer', role: 'Laboratory manager' } },
            generated: { at, by: f.actor.username, version: '1.16.0' },
            qcStatement: 'Recorded quality checks passed for these synthetic measurements.'
        };
        const selected = await f.db.report.create({ data: { id: randomUUID(), sampleId: f.items[0].sampleId, labId: f.labId,
            version: 2, status: 'PUBLISHED', reportNumberBase: content.reportNumber, revision: 0, sampleLabId: 'PDF-SAMPLE-455',
            firstName: 'BEHIND-LIST-SENTINEL', surname: 'Must not print', generatedBy: f.actor.username,
            content: JSON.stringify(content), publishedAt: new Date(at) } });
        // A newer draft must never replace the selected issued version's download.
        await f.db.report.create({ data: { sampleId: selected.sampleId, labId: f.labId, version: 3, status: 'DRAFT',
            generatedBy: f.actor.username, content: JSON.stringify({ ...content, reportNumber: 'WRONG-LATEST-DRAFT' }) } });
        const shareToken = 'owned-public-report-viewer-token';
        await f.db.reportShareLink.create({ data: { reportId: selected.id, tokenHash: createHash('sha256').update(shareToken).digest('hex'), createdBy: f.actor.username } });
        const frozenBefore = await f.db.report.findMany({ orderBy: { version: 'asc' } });
        process.env.SERVE_CLIENT = 'true'; process.env.JWT_SECRET = 'owned-report-viewer-browser-contract';
        await jest.isolateModulesAsync(async () => {
            jest.doMock('../../prisma', () => f.db);
            jest.doMock('path', () => {
                const actual = jest.requireActual('path');
                return { ...actual, join: (...parts) => parts.length === 4 && actual.resolve(parts[0]) === actual.resolve(__dirname, '../..') &&
                    parts[1] === '..' && parts[2] === 'client' && parts[3] === 'dist' ? ownedClient : actual.join(...parts) };
            });
            app = require('../../app');
            server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
            const base = `http://127.0.0.1:${server.address().port}`;
            const token = jwt.sign({ id: f.actor.username, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });
            const user = await f.db.user.findUnique({ where: { username: f.actor.username } });
            browser = await chromium.launch();
            const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
            await context.addInitScript(({ token, user }) => {
                localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
                sessionStorage.setItem('soilfer_locale_override', 'en');
                window.__reportPrintCalls = 0; window.print = () => window.__reportPrintCalls++;
            }, { token, user });
            page = await context.newPage();
            expect((await page.goto(`${base}/result-reports`)).status()).toBe(200);
            await page.getByText('BEHIND-LIST-SENTINEL Must not print', { exact: true }).waitFor();
            await page.getByTitle('View report').click();
            const viewer = page.getByRole('dialog', { name: 'View report', exact: true });
            await viewer.locator('.report-document').waitFor();
            expect(await viewer.locator('.report-results-table tbody tr').count()).toBeGreaterThanOrEqual(6);
            await page.screenshot({ path: path.join(artifacts, 'viewer.png'), fullPage: true });

            const responsePromise = page.waitForResponse(response => response.url() === `${base}/api/reports/${selected.id}/pdf`);
            const downloadPromise = page.waitForEvent('download');
            await viewer.getByRole('button', { name: 'Print / Save as PDF', exact: true }).click();
            const response = await responsePromise, download = await downloadPromise;
            expect(response.status()).toBe(200);
            expect(response.headers()['content-type']).toContain('application/pdf');
            expect(download.suggestedFilename()).toMatch(/PDF-SAMPLE-455_v2\.pdf$/);
            const officialFile = path.join(artifacts, 'official-v2.pdf');
            await download.saveAs(officialFile);
            expect(fs.readFileSync(officialFile)).toEqual(await response.body());
            const pages = pdfPages(officialFile), text = pdfText(officialFile);
            expect(pages).toBeGreaterThan(1);
            for (let pageNo = 1; pageNo <= pages; pageNo++) {
                const pageText = pdfText(officialFile, pageNo);
                expect(pageText).toContain(content.reportNumber);
                expect(pageText).toMatch(new RegExp(`Page ${pageNo} of ${pages}`));
            }
            for (const phrase of ['METHODS AND REFERENCES', 'Recorded method 6', 'Owned PDF Reviewer', 'Disclaimer: This certificate relates solely to the sample as received and tested.']) {
                expect(text.replace(/\s+/g, ' ')).toContain(phrase);
            }
            expect(text).not.toMatch(/WRONG-LATEST-DRAFT|BEHIND-LIST-SENTINEL/);
            const publicPdf = await context.request.get(`${base}/api/reports/public/${shareToken}/pdf`);
            expect(publicPdf.status()).toBe(200);
            expect((await publicPdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

            // Chromium's paginated print layout uses the same media rules as Ctrl+P.
            await page.emulateMedia({ media: 'print' });
            expect(await page.locator('#root').isVisible()).toBe(false);
            const layout = await viewer.evaluate(node => ({ position: getComputedStyle(node).position,
                height: getComputedStyle(node.querySelector('.report-viewer-shell')).height,
                overflow: getComputedStyle(node.querySelector('.report-viewer-scroll')).overflow }));
            expect(layout.position).toBe('static'); expect(layout.overflow).toBe('visible');
            const printFile = path.join(artifacts, 'browser-print-v2.pdf');
            await page.pdf({ path: printFile, preferCSSPageSize: true, printBackground: true });
            const printText = pdfText(printFile).replace(/\s+/g, ' ');
            expect(pdfPages(printFile)).toBeGreaterThan(1);
            for (const phrase of ['Owned report laboratory', 'ANALYTICAL METHODS', 'Recorded method 6', 'Owned PDF Reviewer', 'This report relates only to the sample(s) tested.']) expect(printText).toContain(phrase);
            expect(printText).not.toMatch(/BEHIND-LIST-SENTINEL|WRONG-LATEST-DRAFT|Result Reports|Search by name/);
            await page.emulateMedia({ media: 'screen' });

            for (const status of [403, 500]) {
                await page.route(`**/api/reports/${selected.id}/pdf`, route => route.fulfill({ status, contentType: 'application/json', body: '{"error":"Owned refusal"}' }));
                await viewer.getByRole('button', { name: 'Print / Save as PDF', exact: true }).click();
                await page.getByText('The report PDF could not be downloaded. Please try again.', { exact: true }).waitFor();
                expect(await page.evaluate(() => window.__reportPrintCalls)).toBe(0);
                await page.getByRole('button', { name: 'OK', exact: true }).click();
                await page.unroute(`**/api/reports/${selected.id}/pdf`);
            }
            expect(await f.db.report.findMany({ orderBy: { version: 'asc' } })).toEqual(frozenBefore);
            fs.writeFileSync(path.join(artifacts, 'checks.json'), JSON.stringify({ pages, selectedVersion: 2, officialRoute: true,
                footerEveryPage: true, methods: true, signature: true, disclaimer: true, printIsolation: true, explicit403and500: true }, null, 2));
        });
    } catch (error) {
        if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true });
        throw error;
    } finally {
        await browser?.close();
        if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        app?.stopBackgroundSchedulers(); jest.dontMock('../../prisma'); jest.dontMock('path');
        if (previousServe === undefined) delete process.env.SERVE_CLIENT; else process.env.SERVE_CLIENT = previousServe;
        if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
        await f.close();
        fs.rmSync(ownedClient, { recursive: true, force: true });
    }
}, 180000);
