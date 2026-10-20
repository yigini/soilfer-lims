const path = require('node:path');
const { chromium } = require('playwright');
const { checkMobileLayout } = require('../../../client/scripts/check-mobile-layout.cjs');

test('actual app sidebar and localized Samples controls stay usable at phone and desktop widths (#102, #321)', async () => {
    await checkMobileLayout({ chromium, artifactDir: path.resolve(__dirname, '../../../output/playwright/issue102-mobile-layout') });
}, 90000);
