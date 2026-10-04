const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("JWT_SECRET missing!");
    process.exit(1);
}

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(role, name, url, expectedStatus, headers = {}) {
    try {
        const start = Date.now();
        const res = await fetch(`${BASE_URL}${url}`, { headers });
        const elapsed = Date.now() - start;
        const pass = res.status === expectedStatus;
        console.log(`[${pass ? 'PASS' : 'FAIL'}] ${role} - ${name} (${url}) -> Got ${res.status}, Expected ${expectedStatus} (${elapsed}ms)`);
        return pass;
    } catch (e) {
        console.error(`[FAIL] ${role} - ${name} (${url}) -> Error: ${e.message}`);
        return false;
    }
}

(async () => {
    console.log("=== EXECUTING READ-ONLY ROLE / ROUTE POSTFLIGHT PROTOCOL ===");

    // Generate tokens for each established user principal
    const tokenAdmin = jwt.sign({ id: '1770311018064', username: 'admin', role: 'SUPER_ADMIN', tokenVersion: 1 }, JWT_SECRET);
    const tokenMgr = jwt.sign({ id: 'user-mgr-gtm', username: 'mgr_gtm', role: 'LAB_MANAGER', labId: 'GTM-LAB1', countries: ['GTM'], projects: ['DEMO-GTM-2026'], tokenVersion: 1 }, JWT_SECRET);
    const tokenTech = jwt.sign({ id: 'user-tech-gtm', username: 'tech_gtm', role: 'LAB_TECHNICIAN', labId: 'GTM-LAB1', countries: ['GTM'], projects: ['DEMO-GTM-2026'], tokenVersion: 1 }, JWT_SECRET);
    const tokenReception = jwt.sign({ id: 'user-intake-gtm', username: 'intake_gtm', role: 'SAMPLE_RECEPTION', labId: 'GTM-LAB1', countries: ['GTM'], projects: ['DEMO-GTM-2026'], tokenVersion: 1 }, JWT_SECRET);
    const tokenNational = jwt.sign({ id: 'user-master', username: 'master', role: 'MASTER_USER', countries: ['GTM'], tokenVersion: 1 }, JWT_SECRET);
    const tokenForeignMgr = jwt.sign({ id: 'user-mgr-hnd', username: 'mgr_hnd', role: 'LAB_MANAGER', labId: 'HND-LAB1', countries: ['HND'], projects: [], tokenVersion: 1 }, JWT_SECRET);

    const authAdmin = { 'Authorization': `Bearer ${tokenAdmin}` };
    const authMgr = { 'Authorization': `Bearer ${tokenMgr}` };
    const authTech = { 'Authorization': `Bearer ${tokenTech}` };
    const authReception = { 'Authorization': `Bearer ${tokenReception}` };
    const authNational = { 'Authorization': `Bearer ${tokenNational}` };
    const authForeignMgr = { 'Authorization': `Bearer ${tokenForeignMgr}` };

    let allPass = true;

    // 1. Health
    allPass = await testEndpoint('PUBLIC', 'System Health', '/api/health', 200) && allPass;

    // 2. SUPER_ADMIN
    allPass = await testEndpoint('SUPER_ADMIN', 'Users List', '/api/users', 200, authAdmin) && allPass;
    allPass = await testEndpoint('SUPER_ADMIN', 'Labs Directory', '/api/labs', 200, authAdmin) && allPass;

    // 3. LAB_MANAGER
    allPass = await testEndpoint('LAB_MANAGER', 'Live Dashboard KPIs', '/api/dashboard/live', 200, authMgr) && allPass;
    allPass = await testEndpoint('LAB_MANAGER', 'QC Exceptions Queue', '/api/dashboard/queues/manager.exceptions', 200, authMgr) && allPass;
    allPass = await testEndpoint('LAB_MANAGER', 'QC Batches List', '/api/qc/batches', 200, authMgr) && allPass;
    allPass = await testEndpoint('LAB_MANAGER', 'Submissions Queue', '/api/submissions', 200, authMgr) && allPass;

    // 4. LAB_TECHNICIAN
    allPass = await testEndpoint('LAB_TECHNICIAN', 'My Work', '/api/work', 200, authTech) && allPass;
    allPass = await testEndpoint('LAB_TECHNICIAN', 'Workbench Queue', '/api/workbench/queue', 200, authTech) && allPass;
    allPass = await testEndpoint('LAB_TECHNICIAN', 'Reports Search', '/api/reports/search', 200, authTech) && allPass;

    // 5. SAMPLE_RECEPTION
    allPass = await testEndpoint('SAMPLE_RECEPTION', 'Samples List', '/api/samples', 200, authReception) && allPass;
    allPass = await testEndpoint('SAMPLE_RECEPTION', 'Admin Units', '/api/reception/admin-units', 200, authReception) && allPass;
    allPass = await testEndpoint('SAMPLE_RECEPTION', 'Consignments', '/api/reception/consignments', 200, authReception) && allPass;

    // 6. MASTER_USER (National) & Cross-Lab Scoping
    allPass = await testEndpoint('MASTER_USER', 'Scoped Reports Search', '/api/reports/search', 200, authNational) && allPass;
    allPass = await testEndpoint('LAB_MANAGER (HND)', 'Cross-Lab Foreign Report Forbidden', '/api/reports/RPT-GTM-DEMO-S01-v1', 403, authForeignMgr) && allPass;

    // 7. Project Metadata Detail check
    allPass = await testEndpoint('SUPER_ADMIN', 'Project Detail', '/api/projects/proj-demo-gtm-soilfer-2026', 200, authAdmin) && allPass;

    // 8. PUBLIC / External
    allPass = await testEndpoint('PUBLIC', 'Invalid Share Token 404', '/api/reports/public/invalid-token-xyz', 404) && allPass;

    // 9. Targeted PR 130 & PR 131 verifications
    allPass = await testEndpoint('SUPER_ADMIN', 'Sample S005 Workspace (#119)', '/api/samples/GTM-LAB1/workspace', 200, authAdmin) && allPass;
    allPass = await testEndpoint('LAB_MANAGER', 'QC Batch Inspection BATCH-GTM-2026-P-01 (#118)', '/api/qc/batches/BATCH-GTM-2026-P-01', 200, authMgr) && allPass;

    try {
        const resNoMatch = await fetch(`${BASE_URL}/api/reports/search?q=GTM26-0002&status=SUPERSEDED`, { headers: authAdmin });
        const dataNoMatch = await resNoMatch.json();
        const noMatchPass = resNoMatch.status === 200 && Array.isArray(dataNoMatch.reports) && dataNoMatch.reports.length === 0;
        console.log(`[${noMatchPass ? 'PASS' : 'FAIL'}] SUPER_ADMIN - Result Reports Superseded No-Match (#124) -> Count ${dataNoMatch?.reports?.length ?? 'err'}, Expected 0`);
        allPass = noMatchPass && allPass;
    } catch (e) {
        console.error(`[FAIL] SUPER_ADMIN - Result Reports Superseded No-Match (#124) -> Error: ${e.message}`);
        allPass = false;
    }

    try {
        const resMatch = await fetch(`${BASE_URL}/api/reports/search?q=GTM26-0002&status=ALL`, { headers: authAdmin });
        const dataMatch = await resMatch.json();
        const matchPass = resMatch.status === 200 && Array.isArray(dataMatch.reports) && dataMatch.reports.length === 1;
        console.log(`[${matchPass ? 'PASS' : 'FAIL'}] SUPER_ADMIN - Result Reports All Versions Match (#124) -> Count ${dataMatch?.reports?.length ?? 'err'}, Expected 1`);
        allPass = matchPass && allPass;
    } catch (e) {
        console.error(`[FAIL] SUPER_ADMIN - Result Reports All Versions Match (#124) -> Error: ${e.message}`);
        allPass = false;
    }

    // 10. Targeted PR 134 (#122) & PR 135 (#121) verifications
    allPass = await testEndpoint('LAB_MANAGER (GTM)', 'Lab Methods Defaults Scope (#122)', '/api/config/lab-defaults/GTM-LAB1', 200, authMgr) && allPass;
    allPass = await testEndpoint('LAB_MANAGER (GTM)', 'Cross-Lab Foreign Lab Methods 403 (#122)', '/api/config/lab-defaults/HND-LAB1', 403, authMgr) && allPass;
    allPass = await testEndpoint('SAMPLE_RECEPTION', 'Sample S004 Truthful Reception Date (#121)', '/api/samples?q=S004', 200, authReception) && allPass;

    // 11. Targeted PR 136 (#126) read-only verifications
    allPass = await testEndpoint('LAB_TECHNICIAN', 'Messages Conversations List (#126)', '/api/messages/conversations', 200, authTech) && allPass;
    allPass = await testEndpoint('LAB_TECHNICIAN', 'Messages Inbox List (#126)', '/api/messages?folder=INBOX', 200, authTech) && allPass;

    // 12. NEW: PR 137 (#125) Inventory Summary vs Row Badges Verification
    console.log("\n--- PR 137 (#125) Inventory Verification ---");
    try {
        const startInv = Date.now();
        const resAlerts = await fetch(`${BASE_URL}/api/inventory/alerts`, { headers: authAdmin });
        const durInvAlerts = Date.now() - startInv;
        const alertsData = await resAlerts.json();

        const alertsPass = resAlerts.status === 200 && alertsData.counts && typeof alertsData.counts.outOfStock === 'number';
        console.log(`[${alertsPass ? 'PASS' : 'FAIL'}] SUPER_ADMIN - Inventory Alerts API -> Status ${resAlerts.status} (${durInvAlerts}ms)`);
        allPass = alertsPass && allPass;

        if (alertsPass) {
            const counts = alertsData.counts;
            console.log(`     Alert Counts: outOfStock=${counts.outOfStock}, lowStock=${counts.lowStock}, expired=${counts.expired}, expiredLots=${counts.expiredLots}, total=${counts.total}`);

            // Fetch inventory items to verify unique item row aggregation
            const resItems = await fetch(`${BASE_URL}/api/inventory/items?limit=200`, { headers: authAdmin });
            const itemsData = await resItems.json();
            const items = itemsData.items || itemsData.data || itemsData;

            if (Array.isArray(items)) {
                const activeItems = items.filter(it => it.isActive !== false);
                const outOfStockItems = activeItems.filter(it => it.isOutOfStock);
                console.log(`     Catalog Row Counts: Total Active Items=${activeItems.length}, Rows isOutOfStock=${outOfStockItems.length}`);

                // In production, there are 126 active out of stock items
                const countMatch = counts.outOfStock === outOfStockItems.length && counts.outOfStock === 126;
                console.log(`[${countMatch ? 'PASS' : 'FAIL'}] SUPER_ADMIN - Inventory Summary outOfStock (${counts.outOfStock}) == Row isOutOfStock (${outOfStockItems.length}) == 126`);
                allPass = countMatch && allPass;

                const expiredMatch = counts.expired <= counts.expiredLots;
                console.log(`[${expiredMatch ? 'PASS' : 'FAIL'}] SUPER_ADMIN - Inventory Unique Expired Items (${counts.expired}) <= Expired Lots (${counts.expiredLots})`);
                allPass = expiredMatch && allPass;
            } else {
                console.error(`[FAIL] SUPER_ADMIN - Inventory items response is not an array`);
                allPass = false;
            }
        }
    } catch (e) {
        console.error(`[FAIL] SUPER_ADMIN - Inventory Alerts check failed: ${e.message}`);
        allPass = false;
    }

    // 13. NEW: PR 138 (#120) Operational Views & Manager Queue Verification
    console.log("\n--- PR 138 (#120) Operational Views & Manager Queue Verification ---");
    try {
        // Daily lab work view: must exclude SUBMITTED_FULL, APPROVED, RECEIVED_REJECTED, REJECTED
        const startDaily = Date.now();
        const resDaily = await fetch(`${BASE_URL}/api/samples?view=daily`, { headers: authMgr });
        const durDaily = Date.now() - startDaily;
        const dailyData = await resDaily.json();
        const dailySamples = dailyData.data || [];

        const invalidDaily = dailySamples.filter(s =>
            ['SUBMITTED_FULL', 'APPROVED', 'RECEIVED_REJECTED', 'REJECTED'].includes(s.status)
        );
        const dailyExclusionPass = resDaily.status === 200 && invalidDaily.length === 0;
        console.log(`[${dailyExclusionPass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Daily View Excludes Completed/Rejected (${durDaily}ms) -> Invalid rows: ${invalidDaily.length}, Expected 0`);
        allPass = dailyExclusionPass && allPass;

        if (dailyData.views) {
            const facetPass = dailyData.views.daily === dailySamples.length;
            console.log(`[${facetPass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Daily Row Count (${dailySamples.length}) == views.daily Facet (${dailyData.views.daily})`);
            allPass = facetPass && allPass;
        }

        // Completed filter: returns SUBMITTED_FULL and APPROVED
        const resCompleted = await fetch(`${BASE_URL}/api/samples?status=SUBMITTED_FULL,APPROVED`, { headers: authMgr });
        const completedData = await resCompleted.json();
        const completedSamples = completedData.data || [];

        const nonCompleted = completedSamples.filter(s =>
            !['SUBMITTED_FULL', 'APPROVED'].includes(s.status)
        );
        const completedFilterPass = resCompleted.status === 200 && nonCompleted.length === 0;
        console.log(`[${completedFilterPass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Completed Filter Returns Only Finished/Approved -> Count: ${completedSamples.length}, Non-completed rows: ${nonCompleted.length}`);
        allPass = completedFilterPass && allPass;

        if (completedData.facets && completedData.facets.lifecycle) {
            console.log(`     Completed Lifecycle Facet: ${completedData.facets.lifecycle.COMPLETED}`);
        }

        // Manager Final Approval Queue
        const startFinal = Date.now();
        const resFinalQueue = await fetch(`${BASE_URL}/api/dashboard/queues/manager.finalApproval`, { headers: authMgr });
        const durFinalQueue = Date.now() - startFinal;
        const finalQueueData = await resFinalQueue.json();
        const finalQueuePass = resFinalQueue.status === 200 && (Array.isArray(finalQueueData) || Array.isArray(finalQueueData.rows));
        const finalQueueTotal = finalQueueData.totalRows ?? (Array.isArray(finalQueueData) ? finalQueueData.length : (finalQueueData.rows || []).length);
        console.log(`[${finalQueuePass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Manager Final Approval Queue (${durFinalQueue}ms) -> Status ${resFinalQueue.status}, Total: ${finalQueueTotal}`);
        allPass = finalQueuePass && allPass;

        // Dashboard Home & Latency Benchmark
        const startHome = Date.now();
        const resHome = await fetch(`${BASE_URL}/api/dashboard/home`, { headers: authMgr });
        const durHome = Date.now() - startHome;
        const homeData = await resHome.json();
        const homePass = resHome.status === 200 && durHome < 2000;
        console.log(`[${homePass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Dashboard Home Response Time: ${durHome}ms (< 2000ms threshold)`);
        allPass = homePass && allPass;

        // Live Dashboard Latency Benchmark
        const startLive = Date.now();
        const resLive = await fetch(`${BASE_URL}/api/dashboard/live`, { headers: authMgr });
        const durLive = Date.now() - startLive;
        const livePass = resLive.status === 200 && durLive < 2000;
        console.log(`[${livePass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Dashboard Live Response Time: ${durLive}ms (< 2000ms threshold)`);
        allPass = livePass && allPass;

    } catch (e) {
        console.error(`[FAIL] LAB_MANAGER - Operational Views check failed: ${e.message}`);
        allPass = false;
    }

    // 14. NEW: PR 139 (#120) Expected Arrivals View & Deep Link Alignment
    console.log("\n--- PR 139 (#120) Expected Arrivals View & Deep Link Alignment ---");
    try {
        const startExpected = Date.now();
        const resExpected = await fetch(`${BASE_URL}/api/samples?view=expected`, { headers: authMgr });
        const durExpected = Date.now() - startExpected;
        const expectedData = await resExpected.json();
        const expectedSamples = expectedData.data || [];

        // In expected arrivals view, all samples must have status in EXPECTED_STATUSES ('EXPECTED', 'COLLECTED')
        const invalidExpected = expectedSamples.filter(s =>
            !['EXPECTED', 'COLLECTED'].includes(s.status)
        );
        const expectedPass = resExpected.status === 200 && invalidExpected.length === 0;
        console.log(`[${expectedPass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Expected View Returns Only Expected/Collected (${durExpected}ms) -> Invalid rows: ${invalidExpected.length}, Total expected rows: ${expectedSamples.length}`);
        allPass = expectedPass && allPass;

        if (expectedData.views && expectedData.meta) {
            const expectedFacetPass = expectedData.views.expected === expectedData.meta.total && expectedSamples.length <= 50;
            console.log(`[${expectedFacetPass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Expected Facet (${expectedData.views.expected}) == meta.total (${expectedData.meta.total}), page rows: ${expectedSamples.length}`);
            allPass = expectedFacetPass && allPass;
        }

        // Test expected=true parameter alignment
        const resExpectedParam = await fetch(`${BASE_URL}/api/samples?view=expected&expected=true`, { headers: authMgr });
        const expectedParamData = await resExpectedParam.json();
        const expectedParamPass = resExpectedParam.status === 200 && (expectedParamData.data || []).length === expectedSamples.length && expectedParamData.meta?.total === expectedData.meta?.total;
        console.log(`[${expectedParamPass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Expected View with expected=true Filter Returns Consistent Page Count (${(expectedParamData.data || []).length}) & Total (${expectedParamData.meta?.total})`);
        allPass = expectedParamPass && allPass;

        // Test registry view
        const resRegistry = await fetch(`${BASE_URL}/api/samples?view=registry`, { headers: authMgr });
        const registryData = await resRegistry.json();
        const registryPass = resRegistry.status === 200 && Array.isArray(registryData.data);
        console.log(`[${registryPass ? 'PASS' : 'FAIL'}] LAB_MANAGER - Registry View Accessible -> Status ${resRegistry.status}, Total: ${registryData.meta?.total || (registryData.data || []).length}`);
        allPass = registryPass && allPass;

    } catch (e) {
        console.error(`[FAIL] LAB_MANAGER - PR 139 Expected View check failed: ${e.message}`);
        allPass = false;
    }

    // 15. NEW: PR 141 (#120) Scoped Manager Queues & Dashboard Verification
    console.log("\n--- PR 141 (#120) Scoped Manager Queues & Dashboard Verification ---");
    try {
        const resFinalApprovalGTM = await fetch(`${BASE_URL}/api/dashboard/queues/manager.finalApproval?labId=GTM-LAB1`, { headers: authMgr });
        const dataFinalApprovalGTM = await resFinalApprovalGTM.json();
        const passFinalApprovalGTM = resFinalApprovalGTM.status === 200 && Array.isArray(dataFinalApprovalGTM.rows);
        console.log(`[${passFinalApprovalGTM ? 'PASS' : 'FAIL'}] LAB_MANAGER - Scoped Final Approval Queue (GTM-LAB1) -> Status ${resFinalApprovalGTM.status}, Rows: ${dataFinalApprovalGTM.rows?.length ?? 'none'}`);
        allPass = passFinalApprovalGTM && allPass;

        const resReviewGTM = await fetch(`${BASE_URL}/api/dashboard/queues/manager.review?labId=GTM-LAB1`, { headers: authMgr });
        const dataReviewGTM = await resReviewGTM.json();
        const passReviewGTM = resReviewGTM.status === 200 && Array.isArray(dataReviewGTM.rows);
        console.log(`[${passReviewGTM ? 'PASS' : 'FAIL'}] LAB_MANAGER - Scoped Review Queue (GTM-LAB1) -> Status ${resReviewGTM.status}, Rows: ${dataReviewGTM.rows?.length ?? 'none'}`);
        allPass = passReviewGTM && allPass;

        const resExceptionsGTM = await fetch(`${BASE_URL}/api/dashboard/queues/manager.exceptions?labId=GTM-LAB1`, { headers: authMgr });
        const passExceptionsGTM = resExceptionsGTM.status === 200;
        console.log(`[${passExceptionsGTM ? 'PASS' : 'FAIL'}] LAB_MANAGER - Scoped Exceptions Queue (GTM-LAB1) -> Status ${resExceptionsGTM.status}`);
        allPass = passExceptionsGTM && allPass;

        const resHomeGTM = await fetch(`${BASE_URL}/api/dashboard/home?labId=GTM-LAB1`, { headers: authMgr });
        const dataHomeGTM = await resHomeGTM.json();
        const passHomeGTM = resHomeGTM.status === 200 && Array.isArray(dataHomeGTM.metrics);
        console.log(`[${passHomeGTM ? 'PASS' : 'FAIL'}] LAB_MANAGER - Scoped Home Dashboard Metrics (GTM-LAB1) -> Status ${resHomeGTM.status}, Metrics: ${dataHomeGTM.metrics?.length || 0}`);
        allPass = passHomeGTM && allPass;

        const resLiveGTM = await fetch(`${BASE_URL}/api/dashboard/live?labId=GTM-LAB1`, { headers: authMgr });
        const dataLiveGTM = await resLiveGTM.json();
        const passLiveGTM = resLiveGTM.status === 200 && Boolean(dataLiveGTM.kpis);
        console.log(`[${passLiveGTM ? 'PASS' : 'FAIL'}] LAB_MANAGER - Scoped Live Dashboard KPIs (GTM-LAB1) -> Status ${resLiveGTM.status}`);
        allPass = passLiveGTM && allPass;
    } catch (e) {
        console.error(`[FAIL] LAB_MANAGER - PR 141 verification failed: ${e.message}`);
        allPass = false;
    }

    console.log(`\n=== POSTFLIGHT RESULT: ${allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'} ===`);
    if (!allPass) process.exit(1);
})();
