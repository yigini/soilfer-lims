'use strict';

const packages = require('./data/soil_packages.json');

// Called only when catalogue seeding found no existing analyses. Even on a
// partially initialized database, preserve a package that already owns the id.
async function seedFreshSoilPackages(db) {
    for (const group of packages) {
        await db.analysisGroup.upsert({
            where: { id: group.id }, update: {},
            create: { id: group.id, name: group.name, analyses: JSON.stringify(group.analyses), labId: null }
        });
    }
}

module.exports = { seedFreshSoilPackages };
