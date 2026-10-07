const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { createHash } = require('node:crypto');

// #179 pin 5992389337. This resolves two fixed, digest-bound DDL assets;
// it grants no write authority and never accepts an arbitrary SQL loader.
const WORKFLOW_LOADER = 'services/workflowMigrationSources.js';
const WORKFLOW_LOADER_SHA256 = '0b7f6010cc7b69a03ffe5aceb3c467dd5a718f51d25968e5aba07fcf8aaa1733';
const RESULT_LOADER = 'services/resultAttemptMigrationSource.js';
const RESULT_LOADER_SHA256 = '36658af9e2a6fa817ff4938ad08ac6879ff10a2969acf1a395a68cad5f37a655';
const HOLD_LOADER = 'services/sampleHoldMigrationSource.js';
const HOLD_LOADER_SHA256 = '8092708bf3f0f83111d56b00174a6b9dee9f2d996b7a874ad821801abeb37bb9';
const HOLD_SQL_SHA256 = '5fce16e8bc148e07880fe6afcc7f5aec1c94c319a5c98ddaeaf47450906b06a8';
const RESULT_SQL_SHA256 = 'aac7a1fc8e7a19ea993f6995032812e43ee4887bf0683da446438659061b235d';
const REFERENCE_LOADER = 'services/referenceMaterialMigrationSource.js';
const REFERENCE_LOADER_SHA256 = 'aec02b50c02946f7fb35606524ebb5ced033d43107aa810905fa7c8d4b245ae9';
const REFERENCE_SQL_SHA256 = '5da12ca98c6402002ab2701105eb9e2a51539d4421f53d70c60f47ab98bd51e3';
const QC_RULE_LOADER = 'services/qcRuleMigrationSource.js';
const QC_RULE_LOADER_SHA256 = '222ad51af3fe26ea4bddb9e4d522898857c0ec15f31295c0ce5f81b5dbc487fa';
const QC_RULE_SQL_SHA256 = '4ee7f414ae3e6228faf52fe81d32bde2bdaf6ecb975ca62a438494db42e58b06';
const QC_RUN_LOADER = 'services/qcRunMigrationSource.js';
const QC_RUN_LOADER_SHA256 = '9443bc78374817300000410723c97eb7d0d2f18b9f8e1b2fdfa5704c62149436';
const QC_RUN_SQL_SHA256 = '2f3d7a319d6cbb1fb061092d79e29e03358c28aba9e22190f221df71635e2046';
// #189 additive evidence sources are inspected, never exempted as writers.
const QC_EVIDENCE_SOURCES = Object.freeze([
    Object.freeze({ functionName: 'loadProficiencyMigrationSource', loader: 'services/proficiencyMigrationSource.js',
        loaderSha256: 'e4210caee7aa209d3fdc438b268d72e0728eb6b3a7a2ab102e4b9c8eedfdea0f',
        directory: '20261007000300_proficiency_evidence', sqlSha256: 'bab161fb91e649a33454086aff12eca8ad0b56d16b9f5f47c278a7c20e4fc77a' }),
    Object.freeze({ functionName: 'loadResultEquipmentMigrationSource', loader: 'services/resultEquipmentMigrationSource.js',
        loaderSha256: '4b5a2ea2ef7ee02da46336efaa495520f93cecf9056fa91fdef78b30172acad5',
        directory: '20261007000400_result_equipment_evidence', sqlSha256: 'bd409a6e5d4d8aea357991450025601d73c4c4729cb46473d847c17cb66319d4' })
]);
const WORKFLOW_SOURCES = Object.freeze({
    evidence: { directory: '20261005000000_workflow_state_evidence', sha256: 'ae3accea0c276aab9ea3ed443b44d89ac05e52ef38a39345aa33e8744f019552' },
    guards: { directory: '20261005000100_workflow_state_guards', sha256: '84921ef45fa8609621b38908de5261d716820f2135f2dde1b9a20fafa6fc81ed' }
});
// #179 pin 5993219622. This is reported inventory, not a writer/helper
// exception. A byte change restores failing embedded-write findings.
const deferredSources = Object.freeze([Object.freeze({
    path: 'server/scripts/rehearsal_docker_boundary.cjs',
    sha256: 'c215311a252b83fb95dcf410d4e9c9bc79c24864ca782123d19631472b226f32',
    reason: '#146 synthetic Docker fault adapter; deferred, see #245'
})]);

const mutations = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'save', 'saveMany', 'bulkUpdate', 'delete', 'deleteMany']);
const sqlMethods = new Set(['prepare', 'exec', 'execute', 'pragma', '$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);
const workflowModels = new Map([['sample', 'Sample'], ['samples', 'Sample'], ['workItem', 'WorkItem'], ['workItems', 'WorkItem'], ['result', 'Result'], ['results', 'Result']]);
const union = sets => [...new Set(sets.flat())];

function scanSource(source, filename, exceptions = []) {
    const violations = [];
    const report = (node, code, detail) => violations.push({ file: filename, line: node?.loc?.start?.line || node?.loc?.line || 1, code, detail });
    const sqlTable = '(?:["`\\[]?\\w+["`\\]]?\\s*\\.\\s*)?["`\\[]?(?:Sample|WorkItem)(?:["`\\]]|\\b)';
    const rawWrite = text => new RegExp('\\b(?:INSERT\\s+(?:OR\\s+\\w+\\s+)?INTO|REPLACE\\s+INTO|DELETE\\s+FROM)\\s+' + sqlTable, 'i').test(text) ||
        [...text.matchAll(new RegExp('\\bUPDATE(?:\\s+OR\\s+\\w+)?\\s+' + sqlTable + '\\s+SET\\s+([\\s\\S]*?)(?=\\bWHERE\\b|;|$)', 'gi'))]
            .some(match => /(?:^|,)\s*["`\[]?status["`\]]?\s*=|<unknown>/i.test(match[1])) ||
        (/\b(?:INSERT\s+INTO|UPDATE)\s+<unknown>/i.test(text));
    const rawResultCreate = text => /\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|REPLACE\s+INTO)\s+(?:["`\[]?\w+["`\]]?\s*\.\s*)?["`\[]?Result(?:["`\]]|\b)/i.test(text);
    const rawCacheWrite = text => [...text.matchAll(/\bUPDATE(?:\s+OR\s+\w+)?\s+(?:["`\[]?\w+["`\]]?\s*\.\s*)?["`\[]?WorkItem(?:["`\]]|\b)\s+SET\s+([\s\S]*?)(?=\bWHERE\b|;|$)/gi)]
        .some(match => /(?:^|,)\s*["`\[]?result["`\]]?\s*=/i.test(match[1]));
    const disabling = text => /\bDROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?["`\[]?(?:Sample_status_(?:insert|update)_guard|WorkItem_status_(?:insert|update)_guard|Batch_status_(?:insert|update)_guard|ReviewDecision_decision_(?:insert_guard|immutable)|ResultEvidenceEvent_(?:insert_guard|update_immutable|delete_immutable)|Result_attempt_(?:insert|update)_guard|WorkAttempt_result_reference_guard)\b|\bPRAGMA\s+(?:foreign_keys|recursive_triggers)\s*=\s*(?:OFF|0)\b/i.test(text) ||
        (exceptions.some(entry => entry.file === filename) && /\bDROP\s+TRIGGER\b|db\s+push\s+--accept-data-loss/i.test(text));
    if (!/\.(?:js|cjs|mjs)$/.test(filename)) {
        if (rawWrite(source)) report(null, 'RAW_WORKFLOW_SQL', 'Sample/WorkItem SQL write outside the central authority.');
        if (rawResultCreate(source) || rawCacheWrite(source)) report(null, 'RAW_RESULT_SQL', 'Result creation/cache write outside resultWriteService.');
        if (disabling(source)) report(null, 'WORKFLOW_GUARD_DISABLED', 'Workflow enforcement cannot be disabled.');
        return violations;
    }
    let ast;
    try { ast = parser.parse(source, { sourceType: 'unambiguous', allowReturnOutsideFunction: true, plugins: ['jsx'] }); }
    catch (error) { report(error, 'SOURCE_PARSE_FAILED', error.message); return violations; }
    const exportedNames = new Set();
    traverse(ast, { AssignmentExpression(p) {
        const left = p.node.left;
        if (left.type === 'MemberExpression' && left.object.name === 'module' && left.property.name === 'exports' && p.get('right').isObjectExpression()) {
            for (const property of p.node.right.properties) if (property.type === 'ObjectProperty' && property.value.type === 'Identifier' &&
                (property.key.name || property.key.value) === property.value.name) exportedNames.add(property.value.name);
        }
    } });

    function bindingValue(p, seen) {
        const binding = p.scope.getBinding(p.node.name);
        if (!binding || seen.has(binding)) return [];
        const next = new Set([...seen, binding]);
        const declaration = binding.path;
        if (declaration.isVariableDeclarator()) {
            const init = declaration.get('init');
            if (!init.node) return [];
            if (declaration.get('id').isObjectPattern()) {
                const property = declaration.get('id.properties').find(prop => prop.get('value')?.node?.name === p.node.name);
                return property ? [{ path: init, property: property.node.key.name || property.node.key.value, seen: next }] : [];
            }
            return [{ path: init, seen: next }, ...binding.constantViolations.filter(v => v.isAssignmentExpression())
                .map(v => ({ path: v.get('right'), seen: next }))];
        }
        return [];
    }
    function strings(p, seen = new Set()) {
        if (!p?.node) return ['<unknown>'];
        const resolvedMigration = migrationSql(p);
        if (resolvedMigration !== null) return [resolvedMigration];
        if (p.isStringLiteral() || p.isNumericLiteral()) return [String(p.node.value)];
        if (p.isIdentifier()) {
            if (p.node.name === '__dirname' && !p.scope.getBinding('__dirname')) return [path.dirname(path.resolve(__dirname, '../..', filename))];
            const values = bindingValue(p, seen);
            return values.length ? union(values.map(v => v.property ? ['<unknown>'] : strings(v.path, v.seen))) : ['<unknown>'];
        }
        if (p.isConditionalExpression()) return union([strings(p.get('consequent'), seen), strings(p.get('alternate'), seen)]);
        if (p.isBinaryExpression({ operator: '+' })) return strings(p.get('left'), seen).flatMap(left => strings(p.get('right'), seen).map(right => left + right)).slice(0, 32);
        if (p.isTemplateLiteral()) {
            let values = [''];
            for (let i = 0; i < p.node.quasis.length; i++) {
                values = values.map(value => value + p.node.quasis[i].value.cooked);
                if (i < p.node.expressions.length) values = values.flatMap(value => strings(p.get(`expressions.${i}`), seen).map(expression => value + expression)).slice(0, 32);
            }
            return values;
        }
        if (p.isArrayExpression()) return union(p.get('elements').map(element => strings(element, seen)));
        if (p.isCallExpression() && p.get('callee').isMemberExpression() && p.get('callee.object').isIdentifier({ name: 'path' }) &&
            ['resolve', 'join'].includes(p.node.callee.property.name)) {
            return [p.get('arguments').map(argument => strings(argument, seen).join('|')).join('/')];
        }
        if (nodeFsRead(p)) {
            const candidates = strings(p.get('arguments.0'), seen), serverRoot = path.resolve(__dirname, '../..');
            if (candidates.some(file => file.includes('<unknown>') || !path.isAbsolute(file) || !file.endsWith('.sql') ||
                path.relative(serverRoot, path.resolve(file)).startsWith('..') || !fs.existsSync(file))) return ['<unknown>'];
            // Inspect literal checked-in SQL rather than exempting its caller.
            // Loaded workflow writes and disabled guards are still violations.
            return candidates.map(file => fs.readFileSync(file, 'utf8'));
        }
        return ['<unknown>'];
    }
    let validatedSources;
    function verifiedSources() {
        if (validatedSources !== undefined) return validatedSources;
        validatedSources = null;
        const root = path.resolve(__dirname, '../..'), loaderFile = path.join(root, WORKFLOW_LOADER);
        try {
            const bytes = fs.readFileSync(loaderFile);
            if (createHash('sha256').update(bytes).digest('hex') !== WORKFLOW_LOADER_SHA256) return null;
            const loaderAst = parser.parse(bytes.toString('utf8'), { sourceType: 'unambiguous' });
            const declaration = loaderAst.program.body.filter(node => node.type === 'VariableDeclaration')
                .flatMap(node => node.declarations).find(node => node.id.name === 'SOURCES');
            const registry = declaration?.init?.arguments?.[0];
            if (registry?.type !== 'ObjectExpression' || registry.properties.length !== 2) return null;
            for (const property of registry.properties) {
                const key = property.key.name, wanted = WORKFLOW_SOURCES[key];
                const definition = property.value.arguments?.[0];
                if (!wanted || definition?.type !== 'ObjectExpression' || definition.properties.length !== 2 || property.computed) return null;
                const values = Object.fromEntries(definition.properties.map(item => [item.key.name, item.value.value]));
                if (JSON.stringify(values) !== JSON.stringify(wanted)) return null;
            }
            const loaded = {};
            for (const [key, definition] of Object.entries(WORKFLOW_SOURCES)) {
                const sqlBytes = fs.readFileSync(path.join(root, 'prisma/migrations', definition.directory, 'migration.sql'));
                if (createHash('sha256').update(sqlBytes).digest('hex') !== definition.sha256) return null;
                const sql = sqlBytes.toString('utf8');
                if (/\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE\s+["`\[]?\w+["`\]]?\s+SET|DELETE\s+FROM|DROP\s+TRIGGER|ATTACH)\b|\bPRAGMA\s+(?:foreign_keys|ignore_check_constraints|writable_schema)\b/i.test(sql)) return null;
                loaded[key] = sql;
            }
            validatedSources = loaded;
        } catch { return null; }
        return validatedSources;
    }
    function sourceFunction(p, name) {
        if (!p?.isIdentifier({ name })) return false;
        const binding = p.scope.getBinding(name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return false;
        const declaration = binding.path, id = declaration.get('id'), init = declaration.get('init');
        if (!id.isObjectPattern() || !init.isCallExpression() || !init.get('callee').isIdentifier({ name: 'require' }) || init.scope.getBinding('require')) return false;
        const property = id.get('properties').find(item => item.isObjectProperty() && !item.node.computed &&
            item.node.key.name === name && item.get('value').isIdentifier({ name }));
        if (!property || init.node.arguments.length !== 1 || !init.get('arguments.0').isStringLiteral()) return false;
        const root = path.resolve(__dirname, '../..');
        let literal = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, WORKFLOW_LOADER)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!literal.startsWith('.')) literal = `./${literal}`;
        return init.node.arguments[0].value === literal;
    }
    function sourceObject(p) {
        if (p?.isCallExpression()) return p.node.arguments.length === 0 && sourceFunction(p.get('callee'), 'loadWorkflowMigrationSources');
        if (!p?.isIdentifier()) return false;
        const binding = p.scope.getBinding(p.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator() ||
            !binding.path.get('id').isIdentifier() || !binding.path.get('init').isCallExpression() || !sourceObject(binding.path.get('init'))) return false;
        return binding.referencePaths.every(reference => {
            let end = reference;
            const members = [];
            while (end.parentPath?.isMemberExpression() && end.parentPath.get('object').node === end.node) {
                if (end.parentPath.node.computed) return false;
                end = end.parentPath; members.push(end.node.property.name);
            }
            // The object or one of its objects cannot be aliased, spread or
            // passed to another function. Its immutable scalar fields may be read.
            if (members.length < 2 || !['evidence', 'guards'].includes(members[0]) ||
                !['sql', 'sha256', 'directory', 'file'].includes(members[1]) ||
                members.slice(2).some(name => !['matchAll', 'indexOf', 'slice'].includes(name))) return false;
            return !(end.parentPath?.isAssignmentExpression() && end.parentPath.get('left').node === end.node) &&
                !end.parentPath?.isUpdateExpression() && !(end.parentPath?.isUnaryExpression({ operator: 'delete' }));
        });
    }
    function migrationSql(p) {
        const qcEvidenceSql = qcEvidenceMigrationSql(p);
        if (qcEvidenceSql !== null) return qcEvidenceSql;
        const holdSql = holdMigrationSql(p);
        if (holdSql !== null) return holdSql;
        const referenceSql = referenceMigrationSql(p);
        if (referenceSql !== null) return referenceSql;
        const qcRuleSql = referenceMigrationSql(p, true);
        if (qcRuleSql !== null) return qcRuleSql;
        const qcRunSql = referenceMigrationSql(p, false, true);
        if (qcRunSql !== null) return qcRunSql;
        const resultSql = resultMigrationSql(p);
        if (resultSql !== null) return resultSql;
        if (p?.isCallExpression() && sourceFunction(p.get('callee'), 'evidenceCreates') && p.node.arguments.length === 1) {
            const argument = p.get('arguments.0');
            if (!argument.isMemberExpression() || argument.node.computed || argument.node.property.name !== 'sql' ||
                !argument.get('object').isMemberExpression() || argument.node.object.computed || argument.node.object.property.name !== 'evidence') return null;
            const sql = migrationSql(argument), sliced = sql?.slice(sql.indexOf('CREATE TABLE'));
            if (!sliced || sliced.split(';').filter(statement => statement.trim()).some(statement => !/^\s*CREATE (?:TABLE|INDEX)\b/.test(statement))) return null;
            return sliced;
        }
        if (!p?.isMemberExpression() || p.node.computed || p.node.property.name !== 'sql') return null;
        const member = p.get('object');
        if (!member.isMemberExpression() || member.node.computed || !Object.hasOwn(WORKFLOW_SOURCES, member.node.property.name) || !sourceObject(member.get('object'))) return null;
        return verifiedSources()?.[member.node.property.name] || null;
    }
    function resultMigrationSql(p) {
        if (!p?.isMemberExpression() || p.node.computed || !['sql', 'guardsSql'].includes(p.node.property.name)) return null;
        const object = p.get('object');
        if (!object.isIdentifier()) return null;
        const binding = object.scope.getBinding(object.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return null;
        const init = binding.path.get('init');
        if (!init.isCallExpression() || init.node.arguments.length || !init.get('callee').isIdentifier({ name: 'loadResultAttemptMigrationSource' })) return null;
        const loaderBinding = init.scope.getBinding('loadResultAttemptMigrationSource');
        const declaration = loaderBinding?.path;
        if (!loaderBinding || loaderBinding.kind !== 'const' || loaderBinding.constantViolations.length || !declaration?.isVariableDeclarator() || !declaration.get('id').isObjectPattern()) return null;
        const imported = declaration.get('init');
        if (!imported.isCallExpression() || !imported.get('callee').isIdentifier({ name: 'require' }) || imported.scope.getBinding('require') || imported.node.arguments.length !== 1) return null;
        const root = path.resolve(__dirname, '../..');
        const specifier = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, RESULT_LOADER)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!imported.get('arguments.0').isStringLiteral({ value: specifier.startsWith('.') ? specifier : `./${specifier}` })) return null;
        const properties = declaration.node.id.properties;
        if (!properties.some(property => property.type === 'ObjectProperty' && !property.computed && property.key.name === 'loadResultAttemptMigrationSource' && property.value.name === property.key.name)) return null;
        if (binding.referencePaths.some(reference => !reference.parentPath.isMemberExpression() || reference.parentPath.node.computed ||
            !['sql', 'guardsSql', 'sha256'].includes(reference.parentPath.node.property.name) || reference.parentPath.parentPath.isAssignmentExpression())) return null;
        try {
            if (createHash('sha256').update(fs.readFileSync(path.join(root, RESULT_LOADER))).digest('hex') !== RESULT_LOADER_SHA256) return null;
            const bytes = fs.readFileSync(path.join(root, 'prisma/migrations/20261006000000_result_attempt_link/migration.sql'));
            if (createHash('sha256').update(bytes).digest('hex') !== RESULT_SQL_SHA256) return null;
            const sql = bytes.toString('utf8');
            return p.node.property.name === 'guardsSql' ? sql.slice(sql.indexOf('CREATE TRIGGER')) : sql;
        } catch { return null; }
    }
    function holdMigrationSql(p) {
        if (!p?.isMemberExpression() || p.node.computed || !['sql', 'guardsSql', 'indexSql'].includes(p.node.property.name)) return null;
        const object = p.get('object');
        if (!object.isIdentifier()) return null;
        const binding = object.scope.getBinding(object.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return null;
        const init = binding.path.get('init');
        if (!init.isCallExpression() || init.node.arguments.length || !init.get('callee').isIdentifier({ name: 'loadSampleHoldMigrationSource' })) return null;
        const loaderBinding = init.scope.getBinding('loadSampleHoldMigrationSource');
        const declaration = loaderBinding?.path;
        if (!loaderBinding || loaderBinding.kind !== 'const' || loaderBinding.constantViolations.length || !declaration?.isVariableDeclarator() || !declaration.get('id').isObjectPattern()) return null;
        const imported = declaration.get('init');
        if (!imported.isCallExpression() || !imported.get('callee').isIdentifier({ name: 'require' }) || imported.scope.getBinding('require') || imported.node.arguments.length !== 1) return null;
        const root = path.resolve(__dirname, '../..');
        const specifier = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, HOLD_LOADER)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!imported.get('arguments.0').isStringLiteral({ value: specifier.startsWith('.') ? specifier : `./${specifier}` })) return null;
        const properties = declaration.node.id.properties;
        if (!properties.some(property => property.type === 'ObjectProperty' && !property.computed && property.key.name === 'loadSampleHoldMigrationSource' && property.value.name === property.key.name)) return null;
        if (binding.referencePaths.some(reference => !reference.parentPath.isMemberExpression() || reference.parentPath.node.computed ||
            !['sql', 'guardsSql', 'indexSql', 'sha256'].includes(reference.parentPath.node.property.name) || reference.parentPath.parentPath.isAssignmentExpression())) return null;
        try {
            if (createHash('sha256').update(fs.readFileSync(path.join(root, HOLD_LOADER))).digest('hex') !== HOLD_LOADER_SHA256) return null;
            const bytes = fs.readFileSync(path.join(root, 'prisma/migrations/20261006000100_sample_holds_cancellation/migration.sql'));
            if (createHash('sha256').update(bytes).digest('hex') !== HOLD_SQL_SHA256) return null;
            const sql = bytes.toString('utf8');
            return p.node.property.name === 'guardsSql' ? sql.slice(sql.indexOf('CREATE TRIGGER')) :
                p.node.property.name === 'indexSql' ? sql.slice(sql.indexOf('CREATE UNIQUE INDEX'), sql.indexOf('-- Fresh Prisma')) : sql;
        } catch { return null; }
    }
    function referenceMigrationSql(p, qcRule = false, qcRun = false) {
        if (!p?.isMemberExpression() || p.node.computed || !(qcRun ? ['sql', 'schemaSql', 'guardsSql', 'bootstrapSql'] : ['sql', 'guardsSql']).includes(p.node.property.name)) return null;
        const object = p.get('object');
        if (!object.isIdentifier()) return null;
        const binding = object.scope.getBinding(object.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return null;
        const init = binding.path.get('init');
        const functionName = qcRun ? 'loadQcRunMigrationSource' : qcRule ? 'loadQcRuleMigrationSource' : 'loadReferenceMaterialMigrationSource';
        const loader = qcRun ? QC_RUN_LOADER : qcRule ? QC_RULE_LOADER : REFERENCE_LOADER;
        if (!init.isCallExpression() || init.node.arguments.length || !init.get('callee').isIdentifier({ name: functionName })) return null;
        const loaderBinding = init.scope.getBinding(functionName), declaration = loaderBinding?.path;
        if (!loaderBinding || loaderBinding.kind !== 'const' || loaderBinding.constantViolations.length || !declaration?.isVariableDeclarator() || !declaration.get('id').isObjectPattern()) return null;
        const imported = declaration.get('init');
        if (!imported.isCallExpression() || !imported.get('callee').isIdentifier({ name: 'require' }) || imported.scope.getBinding('require') || imported.node.arguments.length !== 1) return null;
        const root = path.resolve(__dirname, '../..');
        const specifier = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, loader)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!imported.get('arguments.0').isStringLiteral({ value: specifier.startsWith('.') ? specifier : `./${specifier}` })) return null;
        if (!declaration.node.id.properties.some(property => property.type === 'ObjectProperty' && !property.computed && property.key.name === functionName && property.value.name === functionName)) return null;
        if (binding.referencePaths.some(reference => {
            const member = reference.parentPath;
            if (!member.isMemberExpression() || member.node.computed || !(qcRun ? ['sql', 'schemaSql', 'guardsSql', 'bootstrapSql', 'sha256', 'oracleSha256', 'freshTables'] : ['sql', 'guardsSql', 'sha256', 'oracleSha256', 'freshTables']).includes(member.node.property.name)) return true;
            let end = member;
            while (end.parentPath?.isMemberExpression() && end.parentPath.get('object').node === end.node) end = end.parentPath;
            return (end.parentPath?.isAssignmentExpression() && end.parentPath.get('left').node === end.node) || end.parentPath?.isUpdateExpression() || end.parentPath?.isUnaryExpression({ operator: 'delete' });
        })) return null;
        try {
            if (createHash('sha256').update(fs.readFileSync(path.join(root, loader))).digest('hex') !== (qcRun ? QC_RUN_LOADER_SHA256 : qcRule ? QC_RULE_LOADER_SHA256 : REFERENCE_LOADER_SHA256)) return null;
            const bytes = fs.readFileSync(path.join(root, qcRun ? 'prisma/migrations/20261006000400_normalized_qc_runs/migration.sql' : qcRule ? 'prisma/migrations/20261006000300_qc_rules/migration.sql' : 'prisma/migrations/20261006000200_reference_material_catalogue/migration.sql'));
            if (createHash('sha256').update(bytes).digest('hex') !== (qcRun ? QC_RUN_SQL_SHA256 : qcRule ? QC_RULE_SQL_SHA256 : REFERENCE_SQL_SHA256)) return null;
            const sql = bytes.toString('utf8');
            if (qcRun) {
                if (p.node.property.name === 'bootstrapSql') return require(path.join(root, loader)).loadQcRunMigrationSource().bootstrapSql;
                const boundary = sql.indexOf('CREATE UNIQUE INDEX "BatchAnalyte_crm_ordinal_unique"');
                return p.node.property.name === 'schemaSql' ? sql.slice(0, boundary) : p.node.property.name === 'guardsSql' ? sql.slice(boundary) : sql;
            }
            return p.node.property.name === 'guardsSql' ? sql.slice(sql.indexOf('CREATE UNIQUE INDEX')) : sql;
        } catch { return null; }
    }
    function qcEvidenceMigrationSql(p) {
        if (!p?.isMemberExpression() || p.node.computed || !['sql', 'schemaSql', 'guardsSql'].includes(p.node.property.name)) return null;
        const object = p.get('object');
        if (!object.isIdentifier()) return null;
        const binding = object.scope.getBinding(object.node.name);
        if (!binding || binding.kind !== 'const' || binding.constantViolations.length || !binding.path.isVariableDeclarator()) return null;
        const init = binding.path.get('init');
        if (!init.isCallExpression() || init.node.arguments.length || !init.get('callee').isIdentifier()) return null;
        const source = QC_EVIDENCE_SOURCES.find(row => init.node.callee.name === row.functionName);
        if (!source) return null;
        const loaderBinding = init.scope.getBinding(source.functionName), declaration = loaderBinding?.path;
        if (!loaderBinding || loaderBinding.kind !== 'const' || loaderBinding.constantViolations.length || !declaration?.isVariableDeclarator() || !declaration.get('id').isObjectPattern()) return null;
        const imported = declaration.get('init');
        if (!imported.isCallExpression() || !imported.get('callee').isIdentifier({ name: 'require' }) || imported.scope.getBinding('require') || imported.node.arguments.length !== 1) return null;
        const root = path.resolve(__dirname, '../..');
        const specifier = path.relative(path.dirname(path.resolve(root, filename)), path.join(root, source.loader)).replace(/\\/g, '/').replace(/\.js$/, '');
        if (!imported.get('arguments.0').isStringLiteral({ value: specifier.startsWith('.') ? specifier : `./${specifier}` })) return null;
        if (!declaration.node.id.properties.some(property => property.type === 'ObjectProperty' && !property.computed && property.key.name === source.functionName && property.value.name === source.functionName)) return null;
        if (binding.referencePaths.some(reference => {
            const member = reference.parentPath;
            if (!member.isMemberExpression() || member.node.computed || !['sql', 'schemaSql', 'guardsSql', 'sha256'].includes(member.node.property.name)) return true;
            let end = member;
            while (end.parentPath?.isMemberExpression() && end.parentPath.get('object').node === end.node) end = end.parentPath;
            return (end.parentPath?.isAssignmentExpression() && end.parentPath.get('left').node === end.node) || end.parentPath?.isUpdateExpression() || end.parentPath?.isUnaryExpression({ operator: 'delete' });
        })) return null;
        try {
            if (createHash('sha256').update(fs.readFileSync(path.join(root, source.loader))).digest('hex') !== source.loaderSha256) return null;
            const bytes = fs.readFileSync(path.join(root, 'prisma/migrations', source.directory, 'migration.sql'));
            if (createHash('sha256').update(bytes).digest('hex') !== source.sqlSha256) return null;
            const sql = bytes.toString('utf8'), boundary = sql.indexOf('CREATE TRIGGER');
            return p.node.property.name === 'schemaSql' ? sql.slice(0, boundary) : p.node.property.name === 'guardsSql' ? sql.slice(boundary) : sql;
        } catch { return null; }
    }
    function nodeFsRead(p) {
        if (!p?.isCallExpression() || !p.get('callee').isMemberExpression() ||
            !p.get('callee.object').isIdentifier({ name: 'fs' }) || p.node.callee.property.name !== 'readFileSync') return false;
        const binding = p.scope.getBinding('fs');
        if (!binding || binding.constantViolations.length) return false;
        if (binding.path.isImportDefaultSpecifier() || binding.path.isImportNamespaceSpecifier()) {
            return ['fs', 'node:fs'].includes(binding.path.parentPath.node.source?.value);
        }
        const init = binding.path.isVariableDeclarator() && binding.path.get('init');
        return init?.isCallExpression() && init.get('callee').isIdentifier({ name: 'require' }) &&
            strings(init.get('arguments.0')).every(name => ['fs', 'node:fs'].includes(name));
    }
    function schemaFileRead(p, seen = new Set()) {
        if (p?.isIdentifier()) return bindingValue(p, seen).some(value => !value.property && schemaFileRead(value.path, value.seen));
        return nodeFsRead(p) &&
            strings(p.get('arguments.0')).some(value => /(?:prisma\/migrations\/.+\/migration\.sql|scripts\/schema\/[^/]+\.sql)$/.test(value));
    }
    function regularExpression(p, seen = new Set()) {
        return p?.isRegExpLiteral() || (p?.isIdentifier() && bindingValue(p, seen).some(value => regularExpression(value.path, value.seen)));
    }
    function keys(p) { return p.node.computed ? strings(p.get('property')) : [p.node.property.name]; }
    function databaseRoot(p, seen = new Set()) {
        if (!p?.node) return false;
        if (p.isIdentifier()) {
            if (/^(?:prisma|tx|client|db|database|delegate|model)$/.test(p.node.name)) return true;
            return bindingValue(p, seen).some(value => databaseRoot(value.path, value.seen));
        }
        if (p.isMemberExpression() || p.isOptionalMemberExpression()) return databaseRoot(p.get('object'), seen);
        if (p.isCallExpression() && p.get('callee').isIdentifier({ name: 'require' })) return strings(p.get('arguments.0')).some(value => /(?:prisma|\/db)$/.test(value));
        return false;
    }
    function models(p, seen = new Set()) {
        if (!p?.node) return [];
        if (p.isMemberExpression() || p.isOptionalMemberExpression()) {
            const names = keys(p), known = names.filter(name => workflowModels.has(name)).map(name => workflowModels.get(name));
            if (known.length) return known;
            if (names.includes('<unknown>') && databaseRoot(p.get('object'))) return ['Sample', 'WorkItem'];
            return [];
        }
        if (p.isIdentifier()) return union(bindingValue(p, seen).map(value => value.property
            ? [workflowModels.get(value.property)].filter(Boolean) : models(value.path, value.seen)));
        if (p.isConditionalExpression()) return union([models(p.get('consequent'), seen), models(p.get('alternate'), seen)]);
        return [];
    }
    function method(p, seen = new Set()) {
        if (!p?.node) return [];
        if (p.isMemberExpression() || p.isOptionalMemberExpression()) return keys(p).map(name => ({ name, object: p.get('object') }));
        if (p.isIdentifier()) return bindingValue(p, seen).flatMap(value => value.property
            ? [{ name: value.property, object: value.path }] : method(value.path, value.seen));
        if (p.isCallExpression() && p.get('callee').isMemberExpression() && keys(p.get('callee')).includes('bind')) return method(p.get('callee.object'), seen);
        return [];
    }
    function hasStatus(p, seen = new Set(), field = 'status') {
        if (!p?.node) return true;
        if (p.isObjectExpression()) return p.get('properties').some(property => {
            if (property.isSpreadElement()) return hasStatus(property.get('argument'), seen, field);
            const names = property.node.computed ? strings(property.get('key')) : [property.node.key.name || property.node.key.value];
            return names.includes(field) || names.includes('<unknown>');
        });
        if (p.isIdentifier()) {
            const binding = p.scope.getBinding(p.node.name), values = bindingValue(p, seen);
            if (binding?.path.isVariableDeclarator() && binding.path.get('id').isObjectPattern() &&
                binding.path.node.id.properties.some(property => property.type === 'RestElement' && property.argument.name === p.node.name) &&
                binding.path.node.id.properties.some(property => property.type === 'ObjectProperty' && !property.computed && (property.key.name || property.key.value) === field)) return false;
            if (binding?.referencePaths.some(reference => reference.parentPath.isMemberExpression() && reference.key === 'object' &&
                (keys(reference.parentPath).includes(field) || keys(reference.parentPath).includes('<unknown>')) &&
                reference.parentPath.parentPath.isAssignmentExpression())) return true;
            return values.length ? values.some(value => value.property || hasStatus(value.path, value.seen, field)) : true;
        }
        if (p.isConditionalExpression()) return hasStatus(p.get('consequent'), seen, field) || hasStatus(p.get('alternate'), seen, field);
        if (p.isCallExpression() && p.get('callee').isMemberExpression() && p.get('callee.object').isIdentifier({ name: 'Object' }) && keys(p.get('callee')).includes('assign')) {
            return p.get('arguments').some(argument => hasStatus(argument, seen, field));
        }
        return true;
    }
    function dataArgument(p) {
        if (p?.isObjectExpression()) {
            const properties = p.get('properties');
            const data = properties.find(property => property.isObjectProperty() && (property.node.key.name || property.node.key.value) === 'data');
            if (data) return data.get('value');
        }
        if (p?.isIdentifier()) {
            const values = bindingValue(p, new Set());
            if (values.length === 1 && !values[0].property) return dataArgument(values[0].path);
        }
        return null;
    }
    const relationCommands = new Set(['create', 'createMany', 'connectOrCreate', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'connect', 'set', 'disconnect']);
    function hasRelationCommand(p, seen = new Set()) {
        if (!p?.node) return false;
        if (p.isIdentifier()) return bindingValue(p, seen).some(value => hasRelationCommand(value.path, value.seen));
        if (p.isConditionalExpression()) return hasRelationCommand(p.get('consequent'), seen) || hasRelationCommand(p.get('alternate'), seen);
        if (!p.isObjectExpression()) return false;
        return p.get('properties').some(property => property.isSpreadElement() ? hasRelationCommand(property.get('argument'), seen)
            : property.isObjectProperty() && (property.node.computed ? strings(property.get('key'), seen)
                : [property.node.key.name || property.node.key.value]).some(key => relationCommands.has(key)));
    }
    function relationWrites(p, seen = new Set()) {
        if (!p?.node) return [];
        if (p.isIdentifier()) return union(bindingValue(p, seen).map(value => relationWrites(value.path, value.seen)));
        if (p.isArrayExpression()) return union(p.get('elements').map(value => relationWrites(value, seen)));
        if (p.isConditionalExpression()) return union([relationWrites(p.get('consequent'), seen), relationWrites(p.get('alternate'), seen)]);
        if (!p.isObjectExpression()) return [];
        return union(p.get('properties').map(property => {
            if (property.isSpreadElement()) return relationWrites(property.get('argument'), seen);
            if (!property.isObjectProperty()) return [];
            const names = property.node.computed ? strings(property.get('key'), seen) : [property.node.key.name || property.node.key.value];
            const value = property.get('value');
            return union([hasRelationCommand(value, seen) ? names.filter(name => workflowModels.has(name)).map(name => workflowModels.get(name)) : [],
                relationWrites(value, seen)]);
        }));
    }
    function owner(p) {
        for (let current = p.parentPath; current; current = current.parentPath) {
            if (current.isFunctionDeclaration() && current.node.id) return current.node.id.name;
            if ((current.isFunctionExpression() || current.isArrowFunctionExpression()) && current.parentPath.isVariableDeclarator() && current.parentPath.node.id.type === 'Identifier') return current.parentPath.node.id.name;
            if (current.isObjectMethod()) return current.node.key.name || current.node.key.value;
        }
        return null;
    }
    function authorized(p, entities, operation) {
        const name = owner(p);
        if (!exportedNames.has(name)) return false;
        const removal = ['delete', 'deleteMany'].includes(operation);
        if (filename === 'services/sampleStateService.js' && (['createSample', 'transitionSample', 'writeSampleHoldCompatibility'].includes(name) || removal && name === 'removePreAnalyticSample') && entities.every(entity => entity === 'Sample')) return true;
        if (filename === 'services/workItemStateService.js' && (['createWorkItem', 'transitionWorkItem'].includes(name) || removal && name === 'removeUnstartedWorkItems') && entities.every(entity => entity === 'WorkItem')) return true;
        if (removal && filename === 'tests/helpers/workflowFixtures.js' && name === 'cleanupWorkflowFixtures') return true;
        return exceptions.some(entry => entry.file === filename && entry.exportName === name);
    }
    function resultProbe(p) {
        const name = owner(p);
        return exportedNames.has(name) && exceptions.some(entry => entry.file === filename && entry.exportName === name);
    }
    function pinnedCorruptProjectConnection(p, sql) {
        if (!/^PRAGMA\s+foreign_keys\s*=\s*OFF$/i.test(sql.trim()) || owner(p) !== 'beforeGuards' || !exportedNames.has('beforeGuards') ||
            !exceptions.some(entry => entry.file === filename && entry.exportName === 'beforeGuards' && entry.foreignKeysOffVariant === 'PROJECT_FK_CORRUPT_SYNTHETIC')) return false;
        for (let current = p; current.parentPath; current = current.parentPath) {
            const parent = current.parentPath;
            if (parent.isIfStatement() && current.key === 'consequent') {
                const condition = parent.get('test');
                if (condition.isBinaryExpression({ operator: '===' }) && condition.get('left').isIdentifier({ name: 'schemaVariant' }) &&
                    condition.get('right').isStringLiteral({ value: 'PROJECT_FK_CORRUPT_SYNTHETIC' })) return true;
            }
        }
        return false;
    }
    function helperImport(p, specifiers) {
        if (filename.startsWith('tests/')) return;
        const rehearsalLauncher = /^scripts\/(?:run_manager_dashboard_tasklist_side_by_side|run_test_rehearsal|verify_issue149_[^/]+)\.cjs$/.test(filename);
        for (const specifier of specifiers) {
            if (specifier.includes('<unknown>')) continue;
            const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(filename), specifier.replace(/\\/g, '/'))).replace(/\.(?:js|cjs)$/, '');
            if (exceptions.some(entry => resolved === entry.file.replace(/\.js$/, '')) || (rehearsalLauncher && resolved.startsWith('tests/'))) {
                report(p.node, 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
            }
        }
    }
    function embeddedProgram(p) {
        function childProcessModule(object, seen = new Set()) {
            if (object?.isImportSpecifier()) return ['child_process', 'node:child_process'].includes(object.parentPath.node.source.value);
            if (object?.isCallExpression() && object.get('callee').isIdentifier({ name: 'require' })) {
                return strings(object.get('arguments.0')).some(name => ['child_process', 'node:child_process'].includes(name));
            }
            if (object?.isIdentifier()) {
                const binding = object.scope.getBinding(object.node.name);
                if (binding?.path.isImportNamespaceSpecifier() || binding?.path.isImportDefaultSpecifier()) {
                    return ['child_process', 'node:child_process'].includes(binding.path.parentPath.node.source.value);
                }
                return bindingValue(object, seen).some(value => childProcessModule(value.path, value.seen));
            }
            return false;
        }
        const argumentsToCheck = [];
        if (p.get('callee').isIdentifier({ name: 'Function' })) argumentsToCheck.push(...p.get('arguments'));
        const targets = method(p.get('callee'));
        if (p.get('callee').isIdentifier()) {
            const imported = p.scope.getBinding(p.node.callee.name)?.path;
            if (imported?.isImportSpecifier() && ['child_process', 'node:child_process', 'fs', 'node:fs', 'vm', 'node:vm']
                .includes(imported.parentPath.node.source.value)) targets.push({
                name: imported.node.imported.name || imported.node.imported.value, object: imported });
        }
        for (const target of targets) {
            if (['spawn', 'spawnSync', 'execFile', 'execFileSync'].includes(target.name) ||
                (['exec', 'execSync'].includes(target.name) && childProcessModule(target.object))) {
                argumentsToCheck.push(...p.get('arguments'));
            }
            if (/^writeFile(?:Sync)?$/.test(target.name) &&
                strings(p.get('arguments.0')).some(file => /\.(?:js|cjs|mjs)$/.test(file))) argumentsToCheck.push(p.get('arguments.1'));
            if (['Script', 'runInContext', 'runInNewContext', 'runInThisContext', 'compileFunction'].includes(target.name)) {
                argumentsToCheck.push(p.get('arguments.0'));
            }
        }
        const embeddedDml = new RegExp('\\b(?:INSERT\\s+(?:OR\\s+\\w+\\s+)?INTO|REPLACE\\s+INTO|UPDATE(?:\\s+OR\\s+\\w+)?|DELETE\\s+FROM)\\s+\\\\*' + sqlTable, 'i');
        if (!argumentsToCheck.some(argument => strings(argument).some(text => embeddedDml.test(text)))) return;
        const entry = deferredSources.find(record => record.path === `server/${filename}` &&
            record.sha256 === createHash('sha256').update(source).digest('hex'));
        report(p.node, entry ? 'DEFERRED_SYNTHETIC_FAULT_FIXTURE' : 'EMBEDDED_WORKFLOW_WRITE',
            entry?.reason || 'Embedded Sample/WorkItem DML cannot bypass the workflow source inventory.');
    }
    function inspectCall(p) {
            embeddedProgram(p);
            if (p.get('callee').isIdentifier({ name: 'require' }) || p.node.callee.type === 'Import') helperImport(p, strings(p.get('arguments.0')));
            for (const target of method(p.get('callee'))) {
                if (target.name === 'reactivateCancelledIntakeWork' && filename !== 'services/sampleStateService.js') {
                    report(p.node, 'INTAKE_REACTIVATION_CALLER_FORBIDDEN', 'Only the sample re-acceptance transaction may reactivate cancelled work.');
                }
                if (target.name === 'writeSampleHoldCompatibility' && filename !== 'services/sampleHoldService.js') {
                    report(p.node, 'HOLD_MARKER_CALLER_FORBIDDEN', 'Only the hold service may update compatibility markers.');
                }
                const entities = union([models(target.object), relationWrites(p.get('arguments.0'))]);
                if (['removePreAnalyticSample', 'removeUnstartedWorkItems'].includes(target.name) && !p.get('arguments.0')?.isIdentifier({ name: 'tx' })) {
                    report(p.node, 'WORKFLOW_REMOVAL_WITHOUT_TRANSACTION', target.name);
                }
                if (mutations.has(target.name) && entities.length) {
                    const stateEntities = entities.filter(entity => entity !== 'Result');
                    const writes = relationWrites(p.get('arguments.0')).filter(entity => entity !== 'Result').length || !['update', 'updateMany', 'updateManyAndReturn'].includes(target.name) || hasStatus(dataArgument(p.get('arguments.0')));
                    if (stateEntities.length && writes && !authorized(p, stateEntities, target.name)) report(p.node, 'WORKFLOW_WRITE_OUTSIDE_AUTHORITY', `${stateEntities.join('/')} ${target.name}`);
                    if (filename !== 'services/resultWriteService.js') {
                        if (entities.includes('Result') && (['create', 'createMany', 'createManyAndReturn', 'upsert'].includes(target.name) || relationWrites(p.get('arguments.0')).includes('Result'))) report(p.node, 'RESULT_CREATE_OUTSIDE_AUTHORITY', target.name);
                        if (entities.includes('WorkItem') && !['delete', 'deleteMany'].includes(target.name) && hasStatus(dataArgument(p.get('arguments.0')), new Set(), 'result')) report(p.node, 'RESULT_CACHE_OUTSIDE_AUTHORITY', target.name);
                    }
                }
                if (sqlMethods.has(target.name) && !(target.name === 'exec' && regularExpression(target.object))) for (const sql of strings(p.get('arguments.0'))) {
                    const statement = target.name === 'pragma' ? `PRAGMA ${sql}` : sql;
                    if (disabling(statement) && !pinnedCorruptProjectConnection(p, statement)) report(p.node, 'WORKFLOW_GUARD_DISABLED', target.name);
                    if (rawWrite(sql) && !authorized(p, ['Sample', 'WorkItem'])) report(p.node, 'RAW_WORKFLOW_SQL', target.name);
                    if ((rawResultCreate(sql) || rawCacheWrite(sql)) && filename !== 'services/resultWriteService.js' && !resultProbe(p)) report(p.node, 'RAW_RESULT_SQL', target.name);
                    if (sql === '<unknown>' && !schemaFileRead(p.get('arguments.0')) && !authorized(p, ['Sample', 'WorkItem'])) {
                        report(p.node, 'UNRESOLVED_WORKFLOW_SQL', target.name);
                    }
                }
            }
    }
    function resultOption(p, names, values) {
        if (names.includes('source')) {
            if (filename !== 'controllers/importController.js' && values.includes('legacy-import')) {
                report(p.node, 'HISTORICAL_IMPORT_CALLER_FORBIDDEN', 'Only importController may request historical result entry.');
            }
            if (values.includes('derived') && !(filename === 'services/resultWriteService.js' &&
                ['deriveTextureResult', 'writeTextureDetermination'].includes(owner(p)))) {
                report(p.node, 'DERIVED_RESULT_CALLER_FORBIDDEN', 'Only texture derivation may request derived result readiness.');
            }
            if (values.includes('spectral-prediction') && !(filename === 'services/resultWriteService.js' && owner(p) === 'writeSpectralPrediction')) {
                report(p.node, 'PREDICTED_RESULT_CALLER_FORBIDDEN', 'Use the internal spectral prediction writer.');
            }
        }
        if (names.includes('syncResult') && filename !== 'services/syncService.js') {
            report(p.node, 'SYNC_RESULT_CALLER_FORBIDDEN', 'Only offline sync may supply Result identity and payload flags.');
        }
    }
    traverse(ast, {
        ObjectProperty(p) {
            const names = p.node.computed ? strings(p.get('key')) : [p.node.key.name || p.node.key.value];
            resultOption(p, names, strings(p.get('value')));
        },
        AssignmentExpression(p) {
            const left = p.get('left');
            if (left.isMemberExpression()) resultOption(p, keys(left), strings(p.get('right')));
        },
        ImportDeclaration(p) { helperImport(p, [p.node.source.value]); },
        NewExpression(p) { embeddedProgram(p); },
        CallExpression: inspectCall,
        OptionalCallExpression: inspectCall,
        TaggedTemplateExpression(p) {
            for (const target of method(p.get('tag'))) if (sqlMethods.has(target.name)) for (const sql of strings(p.get('quasi'))) {
                if (rawWrite(sql) && !authorized(p, ['Sample', 'WorkItem'])) report(p.node, 'RAW_WORKFLOW_SQL', target.name);
                if ((rawResultCreate(sql) || rawCacheWrite(sql)) && filename !== 'services/resultWriteService.js' && !resultProbe(p)) report(p.node, 'RAW_RESULT_SQL', target.name);
                if (disabling(sql)) report(p.node, 'WORKFLOW_GUARD_DISABLED', target.name);
                if (sql === '<unknown>' && !authorized(p, ['Sample', 'WorkItem'])) report(p.node, 'UNRESOLVED_WORKFLOW_SQL', target.name);
            }
        }
    });
    return [...new Map(violations.map(violation => [JSON.stringify(violation), violation])).values()];
}

function scanFiles(serverRoot, files, exceptions) {
    return files.flatMap(file => scanSource(fs.readFileSync(path.resolve(serverRoot, file), 'utf8'), file.replace(/\\/g, '/'), exceptions));
}

module.exports = { scanSource, scanFiles, deferredSources };
