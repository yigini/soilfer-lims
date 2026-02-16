var p = require('/app/server/prisma');
// Count EXPECTED samples with null fieldMetadata and metadata
p.sample.count({
    where: {
        status: 'EXPECTED',
        fieldMetadata: null,
        metadata: null
    }
}).then(function (count) {
    console.log('EXPECTED samples with null field+metadata (now hidden):', count);
    return p.sample.count({ where: { status: 'EXPECTED' } });
}).then(function (total) {
    console.log('Total EXPECTED samples:', total);
    return p.sample.count({
        where: {
            status: 'EXPECTED',
            fieldMetadata: { not: null }
        }
    });
}).then(function (withFM) {
    console.log('EXPECTED samples WITH fieldMetadata (still visible):', withFM);
    p.$disconnect();
});
