var prisma = require('./server/prisma');

(async function () {
    var spectral = await prisma.spectralData.findMany({
        select: { id: true, sampleId: true, labId: true, modality: true, qcStatus: true, status: true, filename: true, timestamp: true }
    });
    console.log('Total spectral: ' + spectral.length);

    var sids = [];
    spectral.forEach(function (s) { if (s.sampleId && sids.indexOf(s.sampleId) === -1) sids.push(s.sampleId); });

    var samples = await prisma.sample.findMany({
        where: { id: { in: sids } },
        select: { id: true, labId: true }
    });
    var sm = {};
    samples.forEach(function (s) { sm[s.id] = s; });

    var orphanIds = [];
    for (var i = 0; i < spectral.length; i++) {
        var sp = spectral[i];
        var sample = sm[sp.sampleId];
        if (!sample) orphanIds.push(sp.id);
        var label = sample ? sample.labId : 'ORPHAN';
        console.log(sp.labId + ' | ' + label + ' | ' + sp.modality + ' | status:' + sp.status + ' | qc:' + sp.qcStatus);
    }

    console.log('Orphans: ' + orphanIds.length);
    if (orphanIds.length > 0) {
        var deleted = await prisma.spectralData.deleteMany({ where: { id: { in: orphanIds } } });
        console.log('Deleted: ' + deleted.count);
    }
    console.log('Remaining: ' + (await prisma.spectralData.count()));
    process.exit(0);
})().catch(function (e) { console.error(e.message); process.exit(1); });
