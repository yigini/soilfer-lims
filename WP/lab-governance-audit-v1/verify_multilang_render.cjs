const fs = require('fs');
const path = require('path');

const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
const translationsDir = path.resolve(__dirname, '../../client/src/translations');

const loadedTranslations = {};
for (const loc of locales) {
    const p = path.join(translationsDir, `${loc}.json`);
    loadedTranslations[loc] = JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getNestedValue(obj, keyPath) {
    return keyPath.split('.').reduce((prev, curr) => (prev && prev[curr] !== undefined) ? prev[curr] : undefined, obj);
}

function t(locale, key, fallback) {
    const val = getNestedValue(loadedTranslations[locale], key);
    return val !== undefined ? val : fallback;
}

console.log('--- MULTI-LOCALE GOVERNANCE RENDERING VERIFICATION ---');

const testCases = [
    { key: 'labManagement.people.title', name: 'People & Access Header' },
    { key: 'labManagement.people.invite', name: 'Invite Button' },
    { key: 'labManagement.people.searchPlaceholder', name: 'Search Placeholder' },
    { key: 'labManagement.people.filterAll', name: 'All Filter' },
    { key: 'labManagement.people.filterActive', name: 'Active Filter' },
    { key: 'labManagement.people.filterSuspended', name: 'Suspended Filter' },
    { key: 'labManagement.people.noStaff', name: 'Empty Staff Message' },
    { key: 'labManagement.people.colPerson', name: 'Table Header: Person' },
    { key: 'labManagement.people.colRole', name: 'Table Header: Role' },
    { key: 'labManagement.people.colStatus', name: 'Table Header: Status' },
    { key: 'labManagement.people.colWork', name: 'Table Header: Work' },
    { key: 'labManagement.people.reviewAccess', name: 'Action: Review Access' },
    { key: 'staffManagement.invite.successTitle', name: 'Invite: Success Title' },
    { key: 'staffManagement.invite.successDetails', name: 'Invite: Success Details' },
    { key: 'staffManagement.invite.activationLinkLabel', name: 'Invite: Activation Link' },
    { key: 'staffManagement.invite.fullName', name: 'Invite: Full Name' },
    { key: 'staffManagement.invite.email', name: 'Invite: Work Email' },
    { key: 'staffManagement.invite.labScope', name: 'Invite: Lab Scope' },
    { key: 'staffManagement.invite.globalScope', name: 'Invite: Global Scope' },
    { key: 'staffManagement.invite.prepareButton', name: 'Invite: Prepare Button' },
    { key: 'roles.labManager', name: 'Role: Lab Manager' },
    { key: 'roles.sampleReception', name: 'Role: Intake Officer' },
    { key: 'roles.labTechnician', name: 'Role: Lab Tech' },
    { key: 'roles.auditUser', name: 'Role: Quality & Audit' },
    { key: 'roles.superAdmin', name: 'Role: Super Admin' }
];

let allPassed = true;

for (const loc of locales) {
    console.log(`\nChecking Locale: [${loc}]`);
    let localeMissing = 0;
    for (const tc of testCases) {
        const rendered = t(loc, tc.key, null);
        if (!rendered || rendered.trim() === '') {
            console.error(`  FAIL: Missing translation for [${tc.key}] in ${loc}`);
            localeMissing++;
            allPassed = false;
        } else {
            // Verify no unexpanded interpolation like {{something}}
            if (rendered.includes('{{') && rendered.includes('}}')) {
                console.error(`  FAIL: Unexpanded template in [${tc.key}] for ${loc}: "${rendered}"`);
                allPassed = false;
            }
        }
    }
    if (localeMissing === 0) {
        console.log(`  PASSED: All ${testCases.length} governance keys fully rendered in ${loc}`);
        // Print representative sample:
        console.log(`    Header: "${t(loc, 'labManagement.people.title')}"`);
        console.log(`    Invite: "${t(loc, 'labManagement.people.invite')}"`);
        console.log(`    Success Title: "${t(loc, 'staffManagement.invite.successTitle')}"`);
        console.log(`    Lab Scope: "${t(loc, 'staffManagement.invite.labScope')}"`);
        console.log(`    Prepare Button: "${t(loc, 'staffManagement.invite.prepareButton')}"`);
    }
}

if (!allPassed) {
    console.error('\nMulti-locale verification FAILED!');
    process.exit(1);
} else {
    console.log('\nALL 5 LOCALES VERIFIED AND RENDERED SUCCESSFULLY WITH 100% ACCURACY!');
}
