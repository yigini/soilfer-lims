'use strict';
// Original IR-04/IR-11 and A25/A38 requirements; fictional schema-only fixtures.
const fs = require('fs'), path = require('path'), Module = require('module');
const fixturePath = path.join(__dirname, 'final-review-probes.cjs');
const bootstrap = fs.readFileSync(fixturePath, 'utf8').split('async function main() {')[0];
const body = String.raw`
async function main() {
    for (const id of ['PAGING-A', 'PAGING-A-OTHER']) {
        await prisma.lab.create({ data: { id, code: id, name: id, country: 'Guatemala', isActive: true } });
    }
    const manager = await makeUser('paging-manager', 'LAB_MANAGER', 'PAGING-A');

    // Negative Controls: foreign, malformed, non-array, non-string, escaped, similar prefix
    const negativeTestProjects = [
        { id: 'p-foreign-prefix', code: 'P-FOREIGN-PREFIX', assignedLabIds: '["PAGING-A-OTHER"]', desc: 'Similar prefix in array' },
        { id: 'p-malformed-json', code: 'P-MALFORMED-JSON', assignedLabIds: '["PAGING-A', desc: 'Malformed JSON syntax' },
        { id: 'p-obj-key', code: 'P-OBJ-KEY', assignedLabIds: '{"PAGING-A": 1}', desc: 'Valid non-array JSON (object key)' },
        { id: 'p-obj-val', code: 'P-OBJ-VAL', assignedLabIds: '{"assigned": "PAGING-A"}', desc: 'Valid non-array JSON (object value)' },
        { id: 'p-scalar-str', code: 'P-SCALAR-STR', assignedLabIds: '"PAGING-A"', desc: 'Valid non-array JSON (scalar string)' },
        { id: 'p-scalar-num', code: 'P-SCALAR-NUM', assignedLabIds: '123', desc: 'Valid non-array JSON (scalar number)' },
        { id: 'p-arr-num', code: 'P-ARR-NUM', assignedLabIds: '[123, 456]', desc: 'Non-string array elements (numbers)' },
        { id: 'p-arr-obj', code: 'P-ARR-OBJ', assignedLabIds: '[{"id": "PAGING-A"}]', desc: 'Non-string array elements (objects)' },
        { id: 'p-escaped-id', code: 'P-ESCAPED-ID', assignedLabIds: '["\\"PAGING-A\\""]', desc: 'Escaped quote identifier' },
        { id: 'p-sub-suffix', code: 'P-SUB-SUFFIX', assignedLabIds: '["PRE-PAGING-A"]', desc: 'Substring suffix in array' }
    ];

    for (const p of negativeTestProjects) {
        await prisma.project.create({
            data: {
                id: p.id,
                code: p.code,
                name: p.desc,
                labId: 'PAGING-A-OTHER',
                assignedLabIds: p.assignedLabIds,
                status: 'ACTIVE'
            }
        });
    }

    // Positive Controls: owner, junction, and exact legacy array (single and multi-element)
    await prisma.project.create({
        data: {
            id: 'p-pos-owner',
            code: 'P-POS-OWNER',
            name: 'Positive Control: Owned project',
            labId: 'PAGING-A',
            assignedLabIds: '[]',
            status: 'ACTIVE'
        }
    });

    await prisma.project.create({
        data: {
            id: 'p-pos-junction',
            code: 'P-POS-JUNCTION',
            name: 'Positive Control: Junction project',
            labId: 'PAGING-A-OTHER',
            assignedLabIds: '[]',
            status: 'ACTIVE'
        }
    });
    await prisma.projectLab.create({
        data: {
            projectCode: 'P-POS-JUNCTION',
            labId: 'PAGING-A',
            role: 'PRIMARY'
        }
    });

    await prisma.project.create({
        data: {
            id: 'p-pos-legacy-single',
            code: 'P-POS-LEGACY-SINGLE',
            name: 'Positive Control: Exact single legacy array',
            labId: 'PAGING-A-OTHER',
            assignedLabIds: '["PAGING-A"]',
            status: 'ACTIVE'
        }
    });

    await prisma.project.create({
        data: {
            id: 'p-pos-legacy-multi',
            code: 'P-POS-LEGACY-MULTI',
            name: 'Positive Control: Exact multi legacy array',
            labId: 'PAGING-A-OTHER',
            assignedLabIds: '["OTHER-LAB", "PAGING-A", "EXTRA-LAB"]',
            status: 'ACTIVE'
        }
    });

    let r = await call(manager, 'get', '/api/labs/PAGING-A/workspace?projectLimit=50');
    const projectCodes = (r.body.projects || []).map(p => p.code);

    // Evaluate negative controls
    for (const neg of negativeTestProjects) {
        const visible = projectCodes.includes(neg.code);
        record('P02-' + neg.code, 'Negative control: ' + neg.desc + ' must not grant access', { visible: false }, { visible }, !visible);
    }

    // Evaluate positive controls
    const posOwner = projectCodes.includes('P-POS-OWNER');
    const posJunction = projectCodes.includes('P-POS-JUNCTION');
    const posLegacySingle = projectCodes.includes('P-POS-LEGACY-SINGLE');
    const posLegacyMulti = projectCodes.includes('P-POS-LEGACY-MULTI');

    record('P02-POS-OWNER', 'Positive control: Lab-owned project must appear', { visible: true }, { visible: posOwner }, posOwner);
    record('P02-POS-JUNCTION', 'Positive control: ProjectLab junction assigned project must appear', { visible: true }, { visible: posJunction }, posJunction);
    record('P02-POS-LEGACY-SINGLE', 'Positive control: Single exact assignedLabIds must appear', { visible: true }, { visible: posLegacySingle }, posLegacySingle);
    record('P02-POS-LEGACY-MULTI', 'Positive control: Multi-element assignedLabIds containing labId must appear', { visible: true }, { visible: posLegacyMulti }, posLegacyMulti);

    // Summary P02 assertion for backward compatibility with existing reports
    const allNegativesPassed = negativeTestProjects.every(n => !projectCodes.includes(n.code));
    const allPositivesPassed = posOwner && posJunction && posLegacySingle && posLegacyMulti;
    record('P02', 'Exact legacy lab membership guarded against substring, malformed, non-array, and non-string JSON', { allNegativesPassed: true, allPositivesPassed: true }, { allNegativesPassed, allPositivesPassed }, allNegativesPassed && allPositivesPassed);

    // P03: Bounded projects pagination
    await prisma.project.createMany({
        data: Array.from({ length: 205 }, (_, i) => ({
            id: 'paging-project-' + i,
            code: 'PAGING-OWN-' + String(i).padStart(3, '0'),
            name: 'Fictional project ' + i,
            labId: 'PAGING-A',
            assignedLabIds: '[]',
            status: 'ACTIVE'
        }))
    });

    r = await call(manager, 'get', '/api/labs/PAGING-A/workspace?projectPage=1&projectLimit=20');
    const projLen = r.body.projects?.length || 0;
    const pagination = r.body.projectsPagination;
    record('P03', 'Project collection is bounded with accurate total and navigation metadata', {
        http: 200,
        returnedAtMost: 20,
        hasPagination: true,
        totalProjects: 209
    }, {
        http: r.status,
        returned: projLen,
        hasPagination: !!pagination,
        totalProjects: pagination?.total
    }, r.status === 200 && projLen === 20 && !!pagination && pagination.total === 209 && pagination.totalPages === 11);

    await prisma.$disconnect();
    const report = {
        head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        timestamp: new Date().toISOString(),
        database: dbPath,
        schemaSource: 'Read-only schema; fictional fixtures only',
        sourceHashBefore,
        sourceHashAfter: hash(sourcePath),
        results
    };
    fs.writeFileSync(path.join(outputDir, 'workspace-paging-results.json'), JSON.stringify(report, null, 2));
    print(JSON.stringify(report, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
`;
const fixture = new Module(fixturePath, module);
fixture.filename = fixturePath;
fixture.paths = Module._nodeModulePaths(__dirname);
fixture._compile(bootstrap + body, fixturePath);
