const path = require('node:path');
const { chromium } = require('playwright');
const { checkMobileLayout } = require('../../../client/scripts/check-mobile-layout.cjs');

test('actual Manager Queue and Samples components contain their controls at 390px and desktop width', async () => {
    await checkMobileLayout({ chromium, artifactDir: path.resolve(__dirname, '../../../output/playwright/issue102-mobile-layout') });
}, 90000);
