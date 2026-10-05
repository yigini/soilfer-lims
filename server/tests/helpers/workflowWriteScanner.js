const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const mutations = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'save', 'saveMany', 'bulkUpdate']);
const sqlMethods = new Set(['prepare', 'exec', 'execute', 'pragma', '$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);
const workflowModels = new Map([['sample', 'Sample'], ['samples', 'Sample'], ['workItem', 'WorkItem'], ['workItems', 'WorkItem']]);
const union = sets => [...new Set(sets.flat())];

function scanSource(source, filename, exceptions = []) {
    const violations = [];
    const report = (node, code, detail) => violations.push({ file: filename, line: node?.loc?.start.line || 1, code, detail });
    const rawWrite = text => /\bINSERT\s+(?:OR\s+\w+\s+)?INTO\s+["`\[]?(?:Sample|WorkItem)\b/i.test(text) ||
        [...text.matchAll(/\bUPDATE\s+["`\[]?(?:Sample|WorkItem)["`\]]?\s+SET\s+([\s\S]*?)(?=\bWHERE\b|;|$)/gi)]
            .some(match => /(?:^|,)\s*["`\[]?status["`\]]?\s*=|<unknown>/i.test(match[1])) ||
        (/\b(?:INSERT\s+INTO|UPDATE)\s+<unknown>/i.test(text));
    const disabling = text => /\bDROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?["`\[]?(?:Sample_status_(?:insert|update)_guard|WorkItem_status_(?:insert|update)_guard|Batch_status_(?:insert|update)_guard|ReviewDecision_decision_(?:insert_guard|immutable)|ResultEvidenceEvent_(?:insert_guard|update_immutable|delete_immutable))\b|\bPRAGMA\s+(?:foreign_keys|recursive_triggers)\s*=\s*(?:OFF|0)\b/i.test(text) ||
        (exceptions.some(entry => entry.file === filename) && /\bDROP\s+TRIGGER\b|db\s+push\s+--accept-data-loss/i.test(text));
    if (!/\.(?:js|cjs|mjs)$/.test(filename)) {
        if (rawWrite(source)) report(null, 'RAW_WORKFLOW_SQL', 'Sample/WorkItem SQL write outside the central authority.');
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
        if (p.isMemberExpression()) return databaseRoot(p.get('object'), seen);
        if (p.isCallExpression() && p.get('callee').isIdentifier({ name: 'require' })) return strings(p.get('arguments.0')).some(value => /(?:prisma|\/db)$/.test(value));
        return false;
    }
    function models(p, seen = new Set()) {
        if (!p?.node) return [];
        if (p.isMemberExpression()) {
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
        if (p.isMemberExpression()) return keys(p).map(name => ({ name, object: p.get('object') }));
        if (p.isIdentifier()) return bindingValue(p, seen).flatMap(value => value.property
            ? [{ name: value.property, object: value.path }] : method(value.path, value.seen));
        if (p.isCallExpression() && p.get('callee').isMemberExpression() && keys(p.get('callee')).includes('bind')) return method(p.get('callee.object'), seen);
        return [];
    }
    function hasStatus(p, seen = new Set()) {
        if (!p?.node) return true;
        if (p.isObjectExpression()) return p.get('properties').some(property => {
            if (property.isSpreadElement()) return hasStatus(property.get('argument'), seen);
            const names = property.node.computed ? strings(property.get('key')) : [property.node.key.name || property.node.key.value];
            return names.includes('status') || names.includes('<unknown>');
        });
        if (p.isIdentifier()) {
            const binding = p.scope.getBinding(p.node.name), values = bindingValue(p, seen);
            if (binding?.referencePaths.some(reference => reference.parentPath.isMemberExpression() && reference.key === 'object' &&
                (keys(reference.parentPath).includes('status') || keys(reference.parentPath).includes('<unknown>')) &&
                reference.parentPath.parentPath.isAssignmentExpression())) return true;
            return values.length ? values.some(value => value.property || hasStatus(value.path, value.seen)) : true;
        }
        if (p.isConditionalExpression()) return hasStatus(p.get('consequent'), seen) || hasStatus(p.get('alternate'), seen);
        if (p.isCallExpression() && p.get('callee').isMemberExpression() && p.get('callee.object').isIdentifier({ name: 'Object' }) && keys(p.get('callee')).includes('assign')) {
            return p.get('arguments').some(argument => hasStatus(argument, seen));
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
    function owner(p) {
        for (let current = p.parentPath; current; current = current.parentPath) {
            if (current.isFunctionDeclaration() && current.node.id) return current.node.id.name;
            if ((current.isFunctionExpression() || current.isArrowFunctionExpression()) && current.parentPath.isVariableDeclarator() && current.parentPath.node.id.type === 'Identifier') return current.parentPath.node.id.name;
            if (current.isObjectMethod()) return current.node.key.name || current.node.key.value;
        }
        return null;
    }
    function authorized(p, entities) {
        const name = owner(p);
        if (!exportedNames.has(name)) return false;
        if (filename === 'services/sampleStateService.js' && ['createSample', 'transitionSample'].includes(name) && entities.every(entity => entity === 'Sample')) return true;
        if (filename === 'services/workItemStateService.js' && ['createWorkItem', 'transitionWorkItem'].includes(name) && entities.every(entity => entity === 'WorkItem')) return true;
        return exceptions.some(entry => entry.file === filename && entry.exportName === name);
    }
    function helperImport(p, specifiers) {
        if (filename.startsWith('tests/')) return;
        for (const specifier of specifiers) {
            if (specifier.includes('<unknown>')) continue;
            const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(filename), specifier.replace(/\\/g, '/'))).replace(/\.(?:js|cjs)$/, '');
            if (exceptions.some(entry => resolved === entry.file.replace(/\.js$/, ''))) report(p.node, 'TEST_HELPER_IMPORTED_BY_RUNTIME', specifier);
        }
    }
    traverse(ast, {
        ImportDeclaration(p) { helperImport(p, [p.node.source.value]); },
        CallExpression(p) {
            if (p.get('callee').isIdentifier({ name: 'require' }) || p.node.callee.type === 'Import') helperImport(p, strings(p.get('arguments.0')));
            for (const target of method(p.get('callee'))) {
                const entities = models(target.object);
                if (mutations.has(target.name) && entities.length) {
                    const writes = !['update', 'updateMany', 'updateManyAndReturn'].includes(target.name) || hasStatus(dataArgument(p.get('arguments.0')));
                    if (writes && !authorized(p, entities)) report(p.node, 'WORKFLOW_WRITE_OUTSIDE_AUTHORITY', `${entities.join('/')} ${target.name}`);
                }
                if (sqlMethods.has(target.name) && !(target.name === 'exec' && regularExpression(target.object))) for (const sql of strings(p.get('arguments.0'))) {
                    if (disabling(target.name === 'pragma' ? `PRAGMA ${sql}` : sql)) report(p.node, 'WORKFLOW_GUARD_DISABLED', target.name);
                    if (rawWrite(sql) && !authorized(p, ['Sample', 'WorkItem'])) report(p.node, 'RAW_WORKFLOW_SQL', target.name);
                    if (sql === '<unknown>' && !schemaFileRead(p.get('arguments.0')) && !authorized(p, ['Sample', 'WorkItem'])) {
                        report(p.node, 'UNRESOLVED_WORKFLOW_SQL', target.name);
                    }
                }
            }
        },
        TaggedTemplateExpression(p) {
            for (const target of method(p.get('tag'))) if (sqlMethods.has(target.name)) for (const sql of strings(p.get('quasi'))) {
                if (rawWrite(sql) && !authorized(p, ['Sample', 'WorkItem'])) report(p.node, 'RAW_WORKFLOW_SQL', target.name);
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

module.exports = { scanSource, scanFiles };
