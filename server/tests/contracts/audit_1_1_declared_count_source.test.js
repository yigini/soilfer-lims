const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const root = path.resolve(__dirname, '../../..');
function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? files(file) : /\.(js|jsx)$/.test(file) ? [file] : [];
    });
}
function walk(node, visit) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(value => walk(value, visit)); return; }
    if (node.type) visit(node);
    for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value, visit);
}
function keyName(node) { return node?.type === 'Identifier' ? node.name : node?.type === 'StringLiteral' ? node.value : null; }

test('application code never reads the deprecated stored consignment count; only request/response aliases and one compatibility write remain', () => {
    const input = path.join(root, 'server/services/consignmentExpectedCountInput.js');
    const writer = path.join(root, 'server/services/consignmentIntakeService.js');
    const response = path.join(root, 'server/services/consignmentResponseService.js');
    const violations = [], writes = [];
    for (const file of ['server/controllers', 'server/services', 'client/src'].flatMap(dir => files(path.join(root, dir)))) {
        const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'unambiguous', plugins: ['jsx'] });
        walk(ast, node => {
            if (['MemberExpression', 'OptionalMemberExpression'].includes(node.type) && keyName(node.property) === 'expectedCount') {
                if (file !== input || node.object.type !== 'Identifier' || node.object.name !== 'header') violations.push(`${path.relative(root, file)}:${node.loc.start.line} reads compatibility count`);
            }
            if (node.type === 'ObjectProperty' && keyName(node.key) === 'expectedCount') {
                if (file === writer) writes.push(node.loc.start.line);
                else if (file !== response) violations.push(`${path.relative(root, file)}:${node.loc.start.line} uses compatibility count outside the writer/response alias`);
            }
        });
    }
    expect(violations).toEqual([]);
    expect(writes).toHaveLength(1);
    expect(fs.readFileSync(input, 'utf8')).not.toMatch(/require\([^)]*(?:prisma|sqlite)/);
});
