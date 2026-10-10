const fs = require('node:fs'), path = require('node:path');
const parser = require('@babel/parser'), traverse = require('@babel/traverse').default;
const owners = new Set(['services/policyService.js', 'services/calculationActivationService.js']);
function inspect(source, filename) {
    const errors = [];
    const ast = parser.parse(source, { sourceType: 'unambiguous', plugins: ['jsx'] });
    const propertyName = node => node.computed ? node.property?.value : node.property?.name;
    const record = (node, model) => {
        if (model && !owners.has(filename)) errors.push({ filename, code: 'CALC_ACTIVATION_OUTSIDE_AUTHORITY', line: node.loc.start.line });
    };
    const name = node => node?.name || node?.value;
    const projection = p => !!p.findParent(parent => parent.isObjectProperty() && ['include', 'select'].includes(name(parent.node.key)));
    const sql = text => /\b(?:FROM|JOIN|UPDATE|INTO)\s+(?:(?:main|temp)\.)?["`\[]?CalcTemplateActivation\b/i
        .test(text.replace(/\/\*[\s\S]*?\*\/|--[^\n]*/g, ' '));
    traverse(ast, {
        MemberExpression(p) { record(p.node, propertyName(p.node) === 'calcTemplateActivation'); },
        OptionalMemberExpression(p) { record(p.node, propertyName(p.node) === 'calcTemplateActivation'); },
        ObjectProperty(p) {
            record(p.node, name(p.node.key) === 'activation' && projection(p));
            if (p.parentPath.isObjectPattern()) record(p.node,
                (p.node.computed ? p.node.key.value : p.node.key.name || p.node.key.value) === 'calcTemplateActivation');
        },
        StringLiteral(p) { record(p.node, sql(p.node.value)); },
        TemplateLiteral(p) { record(p.node, sql(p.node.quasis.map(part => part.value.cooked || part.value.raw).join(' '))); }
    });
    return errors;
}
function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(row => row.isDirectory() ? files(path.join(directory, row.name)) :
        /\.[cm]?js$/.test(row.name) ? [path.join(directory, row.name)] : []);
}
test('only the policy resolver and activation write authority access the activation model throughout runtime services/controllers/routes/scripts', () => {
    const root = path.resolve(__dirname, '../..');
    const errors = ['services', 'controllers', 'routes', 'scripts'].flatMap(directory => files(path.join(root, directory))).flatMap(file =>
        inspect(fs.readFileSync(file, 'utf8'), path.relative(root, file).replace(/\\/g, '/')));
    expect(errors).toEqual([]);
});
test.each([
    'db.resultCalculation.findUnique({include:{activation:true}})',
    "db.resultCalculation.findMany({select:{['activation']:{select:{id:true}}}})",
    'db.$queryRawUnsafe(\'SELECT * FROM "CalcTemplateActivation"\')',
    'db.$queryRawUnsafe(`SELECT id FROM main.CalcTemplateActivation WHERE labId=${labId}`)',
    "db.$executeRawUnsafe('DELETE FROM CalcTemplateActivation')"
])('relation/raw-SQL activation access is detected even in scripts: %s', source => {
    expect(inspect(source, 'scripts/alternateVariantConsumer.cjs')).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'CALC_ACTIVATION_OUTSIDE_AUTHORITY' })
    ]));
});
test.each(['db.calcTemplateActivation.findMany()', "db['calcTemplateActivation'].findFirst()",
    'db?.calcTemplateActivation?.create({})', 'const {calcTemplateActivation: aliases}=db; aliases.findMany()'])(
    'an alternate activation access in another consumer is detected: %s', source => {
        expect(inspect(source, 'services/alternateVariantConsumer.js')).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'CALC_ACTIVATION_OUTSIDE_AUTHORITY' })
        ]));
    });
