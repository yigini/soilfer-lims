const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');

test('real Chromium types and records 40 values through the production app with keyboard input only', async () => {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 } });
    const previousServe = process.env.SERVE_CLIENT, previousSecret = process.env.JWT_SECRET;
    let browser, server, app, context, page;
    const artifactRoot = path.resolve(__dirname, '../../../output/playwright');
    fs.mkdirSync(artifactRoot, { recursive: true });
    try {
        const ids = [];
        await f.db.equipmentQualification.create({ data: { id: randomUUID(), equipmentId: f.instrument.id, labId: f.labId,
            calibrationStatus: 'OK', verificationStatus: 'OK', nextCalibrationDueDate: new Date('2099-01-01') } });
        await f.db.equipmentMethodEligibility.create({ data: { id: randomUUID(), labId: f.labId, analysisCode: f.analysisCode,
            methodId: f.method.id, isRequired: true, eligibleEquipmentIds: JSON.stringify([f.instrument.id]) } });
        for (let index = 0; index < 40; index++) {
            const sample = await createSampleFixture(f.db, { data: { id: randomUUID(), originalId: `KEYBOARD-${String(index + 1).padStart(2, '0')}`,
                assignedLab: f.labId, status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
            for (const analysis of ['DRYING', 'PREPARATION']) await createWorkItemFixture(f.db, { data: {
                id: randomUUID(), sampleId: sample.id, labId: f.labId, analysis, status: 'COMPLETED', history: '[]' } });
            const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, labId: f.labId,
                analysis: f.analysisCode, methodologyId: f.method.id, assignedTo: f.actor.username, equipmentId: f.instrument.id,
                status: 'IN_PROGRESS', history: '[]' } });
            ids.push(item.id);
        }
        process.env.SERVE_CLIENT = 'true'; process.env.JWT_SECRET = 'owned-keyboard-playwright-contract';
        await jest.isolateModulesAsync(async () => {
            // Only the owned connection is injected. App, authentication,
            // permissions, scope, queue, preview and commit are the real code.
            jest.doMock('../../prisma', () => f.db);
            app = require('../../app');
            server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
            const token = jwt.sign({ id: f.actor.username, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });
            const user = await f.db.user.findUnique({ where: { username: f.actor.username } });
            browser = await chromium.launch();
            context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
            await context.addInitScript(({ token, user }) => {
                localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
                sessionStorage.setItem('soilfer_locale_override', 'en');
                window.__keyboardMouseEvents = 0;
                document.addEventListener('mousedown', () => window.__keyboardMouseEvents++);
            }, { token, user });
            await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
            page = await context.newPage();
            await page.goto(`http://127.0.0.1:${server.address().port}/workbench?analysis=${encodeURIComponent(f.analysisCode)}&queue=my_work`);
            await page.locator('[data-testid="worksheet-grid"] input[aria-label$=" determination"]').first().waitFor();
            expect(await page.locator('[data-testid="worksheet-grid"] input[aria-label$=" determination"]').count()).toBe(40);
            const tabTo = async predicate => {
                for (let step = 0; step < 120; step++) {
                    await page.keyboard.press('Tab');
                    if (await page.evaluate(predicate)) return;
                }
                throw Error('Keyboard Tab did not reach the expected application control.');
            };
            await tabTo(() => document.activeElement?.closest('[data-testid="worksheet-grid"]') &&
                document.activeElement?.getAttribute('aria-label')?.endsWith(' determination'));
            const typed = [];
            for (let index = 0; index < 40; index++) {
                expect(await page.locator(':focus').getAttribute('aria-label')).toMatch(/ determination$/);
                const row = await page.locator(':focus').evaluate(input => input.closest('tr').rowIndex);
                expect(typed).not.toContain(row); typed.push(row);
                const rawInput = `6.${String(index + 1).padStart(2, '0')}`;
                if (index === 0) {
                    for (const key of ['Numpad6', 'NumpadDecimal', 'Numpad0', 'Numpad1']) {
                        await page.keyboard.press(key); await page.waitForTimeout(45);
                    }
                } else await page.keyboard.type(rawInput, { delay: 45 });
                expect(await page.locator(':focus').inputValue()).toBe(rawInput);
                await page.keyboard.press(index % 2 ? 'NumpadEnter' : 'Enter');
            }
            expect(await page.locator(':focus').getAttribute('data-testid')).toBe('record-all-ready');
            await page.waitForFunction(() => document.querySelector('[data-testid="record-all-ready"]')?.textContent.includes('(40)'));
            const previewResponse = page.waitForResponse(response => response.url().endsWith('/api/workbench/v2/completion/preview'));
            await page.keyboard.press('Enter');
            const preview = await (await previewResponse).json();
            expect(preview.included).toHaveLength(40); expect(preview.excluded).toHaveLength(0);
            await page.getByText('I verified the sample IDs, determinations, basis, and replicate numbers shown above against raw bench data.').waitFor();
            await tabTo(() => document.activeElement?.type === 'checkbox' &&
                document.activeElement.closest('label')?.textContent.includes('I verified'));
            await page.keyboard.press('Space'); await page.keyboard.press('Tab');
            expect(await page.locator(':focus').textContent()).toContain('Record 40 Determinations');
            const committedResponse = page.waitForResponse(response => response.url().endsWith('/api/workbench/v2/completion/commit'));
            await page.keyboard.press('Enter');
            const committed = await (await committedResponse).json();
            expect(committed).toMatchObject({ saved: 40 }); expect(committed.errors || []).toHaveLength(0);
            const results = await f.db.result.findMany({ where: { sampleId: { in: (await f.db.workItem.findMany({ where: { id: { in: ids } } })).map(item => item.sampleId) } } });
            expect(results).toHaveLength(40); expect(results.every(row => row.attemptId && row.isCurrent && row.equipmentId === f.instrument.id)).toBe(true);
            expect(new Set(results.map(row => row.attemptId)).size).toBe(40);
            expect(results.map(row => row.value).sort()).toEqual(Array.from({ length: 40 }, (_, index) => `6.${String(index + 1).padStart(2, '0')}`).sort());
            expect((await f.db.workItem.findMany({ where: { id: { in: ids } } })).every(row => row.status === 'COMPLETED')).toBe(true);
            expect(await page.evaluate(() => window.__keyboardMouseEvents)).toBe(0);
            await page.screenshot({ path: path.join(artifactRoot, 'audit-196-keyboard-40.png'), fullPage: true });
            await context.tracing.stop({ path: path.join(artifactRoot, 'audit-196-keyboard-40.zip') });
            await context.close();
        });
    } catch (error) {
        if (page && !page.isClosed()) {
            await page.screenshot({ path: path.join(artifactRoot, 'audit-196-keyboard-failure.png'), fullPage: true });
            fs.writeFileSync(path.join(artifactRoot, 'audit-196-keyboard-failure.json'), JSON.stringify(await page.evaluate(() => ({
                focus: document.activeElement?.outerHTML,
                cells: [...document.querySelectorAll('[data-testid="worksheet-grid"] input')].map(input => ({ label: input.getAttribute('aria-label'),
                    type: input.type, disabled: input.disabled, readOnly: input.readOnly, tabIndex: input.tabIndex, value: input.value }))
            })), null, 2));
            await context.tracing.stop({ path: path.join(artifactRoot, 'audit-196-keyboard-failure.zip') });
        }
        throw error;
    } finally {
        await browser?.close();
        if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        app?.stopBackgroundSchedulers(); jest.dontMock('../../prisma');
        if (previousServe === undefined) delete process.env.SERVE_CLIENT; else process.env.SERVE_CLIENT = previousServe;
        if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
        await f.close();
    }
}, 180000);
