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

console.log('--- STATIC MULTI-LOCALE GOVERNANCE KEY-PRESENCE CHECK ---');
console.log('NOTE: This check verifies dictionary key presence and non-emptiness across all 5 JSON translation files. It does NOT assert component DOM rendering, layout measurement, or browser interaction (see browser_paging_review.cjs for end-to-end browser verification).\n');

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
    { key: 'labManagement.tabs.overview', name: 'Tab: Overview' },
    { key: 'labManagement.tabs.people', name: 'Tab: People & Access' },
    { key: 'labManagement.tabs.projects', name: 'Tab: Projects' },
    { key: 'labManagement.tabs.resources', name: 'Tab: Methods & Resources' },
    { key: 'labManagement.tabs.settings', name: 'Tab: Settings' },
    { key: 'labManagement.tabs.history', name: 'Tab: History' },
    { key: 'labManagement.projects.title', name: 'Projects: Title' },
    { key: 'labManagement.projects.subtitle', name: 'Projects: Subtitle' },
    { key: 'labManagement.projects.ownedProject', name: 'Projects: Owned Tag' },
    { key: 'labManagement.projects.sharedProgramme', name: 'Projects: Shared Tag' },
    { key: 'labManagement.projects.ownerTag', name: 'Projects: Owner Label' },
    { key: 'labManagement.projects.servicingTag', name: 'Projects: Servicing Lab Label' },
    { key: 'labManagement.projects.status', name: 'Projects: Status Label' },
    { key: 'labManagement.projects.workload', name: 'Projects: Workload Label' },
    { key: 'labManagement.projects.viewWorkspace', name: 'Projects: View Workspace Link' },
    { key: 'labManagement.projects.noProjects', name: 'Projects: Empty State' },
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
    console.log(`Checking Locale: [${loc}]`);
    let localeMissing = 0;
    for (const tc of testCases) {
        const rendered = t(loc, tc.key, null);
        if (!rendered || rendered.trim() === '') {
            console.error(`  FAIL: Missing translation for [${tc.key}] in ${loc}`);
            localeMissing++;
            allPassed = false;
        } else {
            // Verify no unexpanded interpolation like {{something}} without a valid template
            if (rendered.includes('{{') && rendered.includes('}}') && !rendered.includes('{{from}}') && !rendered.includes('{{to}}') && !rendered.includes('{{total}}') && !rendered.includes('{{count}}')) {
                console.error(`  FAIL: Unexpanded unexpected template in [${tc.key}] for ${loc}: "${rendered}"`);
                allPassed = false;
            }
        }
    }
    if (localeMissing === 0) {
        console.log(`  PASSED: All ${testCases.length} static keys present and non-empty in ${loc}`);
    }
}

if (!allPassed) {
    console.error('\nStatic multi-locale key verification FAILED!');
    process.exit(1);
} else {
    console.log('\nALL 5 LOCALES: STATIC GOVERNANCE TRANSLATION KEYS VERIFIED PRESENT AND NON-EMPTY');
    console.log('(Static dictionary presence only; does not assert component DOM rendering, layout bounding, or browser interaction).\n');
}
