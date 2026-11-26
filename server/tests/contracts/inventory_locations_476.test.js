const { randomUUID } = require('node:crypto');
const express = require('express');
const request = require('supertest');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const inventoryRoutes = require('../../routes/inventoryRoutes');

const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
const packs = Object.fromEntries(locales.map(locale => [
    locale,
    require('../../../client/src/translations/' + locale + '.json')
]));

const labA = 'LOC476-A-' + randomUUID();
const labB = 'LOC476-B-' + randomUUID();

let app;
let managerTokenA;
let techTokenA;
let managerTokenB;

beforeAll(async () => {
    for (const id of [labA, labB]) {
        await prisma.lab.create({
            data: { id, code: id, name: 'Locations 476 Lab', country: 'GTM', timezone: 'UTC' }
        });
    }
    managerTokenA = await getAuthToken('LAB_MANAGER', labA);
    techTokenA = await getAuthToken('LAB_TECHNICIAN', labA);
    managerTokenB = await getAuthToken('LAB_MANAGER', labB);

    app = express();
    app.use(express.json());
    app.use('/api/inventory', inventoryRoutes);
});

const auth = token => ({ Authorization: `Bearer ${token}` });

test('creating a child location with a wrong purpose or a parent from another lab is refused', async () => {
    const sampleParent = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({ name: 'Sample Cold Room', purpose: 'SAMPLE', locationType: 'ROOM' });
    expect(sampleParent.status).toBe(201);

    const wrongPurpose = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({
            name: 'Mismatched Reagent Shelf',
            purpose: 'REAGENT',
            locationType: 'SHELF',
            parentLocationId: sampleParent.body.id
        });
    expect(wrongPurpose.status).toBe(400);
    expect(wrongPurpose.body.code).toBe('CUSTODY_LOCATION_INVALID');

    const otherLabParent = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenB))
        .send({ name: 'Lab B Sample Room', purpose: 'SAMPLE', locationType: 'ROOM' });
    expect(otherLabParent.status).toBe(201);

    const foreignParent = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({
            name: 'Cross-Lab Child Shelf',
            purpose: 'SAMPLE',
            locationType: 'SHELF',
            parentLocationId: otherLabParent.body.id
        });
    expect(foreignParent.status).toBe(403);
});

test('PATCH cannot change purpose or parent, and writes one audit row with before and after on valid updates', async () => {
    const parent = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({ name: 'Reagent Room 1', purpose: 'REAGENT', locationType: 'ROOM' });
    expect(parent.status).toBe(201);

    const loc = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({ name: 'Acid Cabinet', purpose: 'REAGENT', locationType: 'CABINET', temperatureRange: '15-25°C' });
    expect(loc.status).toBe(201);

    const changePurpose = await request(app)
        .patch(`/api/inventory/locations/${loc.body.id}`)
        .set(auth(managerTokenA))
        .send({ purpose: 'SAMPLE' });
    expect(changePurpose.status).toBe(400);
    expect(changePurpose.body.code).toBe('LOCATION_FIELD_IMMUTABLE');

    const changeParent = await request(app)
        .patch(`/api/inventory/locations/${loc.body.id}`)
        .set(auth(managerTokenA))
        .send({ parentLocationId: parent.body.id });
    expect(changeParent.status).toBe(400);
    expect(changeParent.body.code).toBe('LOCATION_FIELD_IMMUTABLE');

    const crossLabPatch = await request(app)
        .patch(`/api/inventory/locations/${loc.body.id}`)
        .set(auth(managerTokenB))
        .send({ name: 'Hijacked' });
    expect(crossLabPatch.status).toBe(403);

    const updated = await request(app)
        .patch(`/api/inventory/locations/${loc.body.id}`)
        .set(auth(managerTokenA))
        .send({ name: 'Acid Cabinet A', locationType: 'FRIDGE', temperatureRange: '2-8°C' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
        id: loc.body.id,
        name: 'Acid Cabinet A',
        purpose: 'REAGENT',
        parentLocationId: null,
        locationType: 'FRIDGE',
        temperatureRange: '2-8°C',
        isActive: true
    });

    const audits = await prisma.auditLog.findMany({
        where: { entity: 'INVENTORY', entityId: loc.body.id, action: 'LOCATION_UPDATED' }
    });
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0].before)).toMatchObject({ name: 'Acid Cabinet', locationType: 'CABINET', temperatureRange: '15-25°C' });
    expect(JSON.parse(audits[0].after)).toMatchObject({ name: 'Acid Cabinet A', locationType: 'FRIDGE', temperatureRange: '2-8°C' });
});

test('deactivating a location with an active child is refused until the child is deactivated; reactivate is allowed', async () => {
    const parent = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({ name: 'Archive Freezer', purpose: 'SAMPLE', locationType: 'FREEZER', temperatureRange: '-20°C' });
    expect(parent.status).toBe(201);

    const child = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({ name: 'Rack 1', purpose: 'SAMPLE', locationType: 'SHELF', parentLocationId: parent.body.id });
    expect(child.status).toBe(201);

    const blocked = await request(app)
        .patch(`/api/inventory/locations/${parent.body.id}`)
        .set(auth(managerTokenA))
        .send({ isActive: false });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('LOCATION_HAS_ACTIVE_CHILDREN');

    const deactivateChild = await request(app)
        .patch(`/api/inventory/locations/${child.body.id}`)
        .set(auth(managerTokenA))
        .send({ isActive: false });
    expect(deactivateChild.status).toBe(200);
    expect(deactivateChild.body.isActive).toBe(false);

    const deactivateParent = await request(app)
        .patch(`/api/inventory/locations/${parent.body.id}`)
        .set(auth(managerTokenA))
        .send({ isActive: false });
    expect(deactivateParent.status).toBe(200);
    expect(deactivateParent.body.isActive).toBe(false);

    const reactivateParent = await request(app)
        .patch(`/api/inventory/locations/${parent.body.id}`)
        .set(auth(managerTokenA))
        .send({ isActive: true });
    expect(reactivateParent.status).toBe(200);
    expect(reactivateParent.body.isActive).toBe(true);
});

test('deactivated location disappears from pickers without includeInactive=1, appears with includeInactive=1, and a lot stored there still shows it', async () => {
    const loc = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({ name: 'Retiring Reagent Shelf', purpose: 'REAGENT', locationType: 'SHELF' });
    expect(loc.status).toBe(201);

    const item = await request(app)
        .post('/api/inventory/items')
        .set(auth(managerTokenA))
        .send({ name: 'Sulfuric Acid', itemType: 'REAGENT', unitOfMeasure: 'mL' });
    expect(item.status).toBe(201);

    const lot = await request(app)
        .post('/api/inventory/lots')
        .set(auth(managerTokenA))
        .send({ inventoryItemId: item.body.id, lotNumber: 'LOT-RET-1', quantity: 500, locationId: loc.body.id });
    expect(lot.status).toBe(201);

    const deactivated = await request(app)
        .patch(`/api/inventory/locations/${loc.body.id}`)
        .set(auth(managerTokenA))
        .send({ isActive: false });
    expect(deactivated.status).toBe(200);

    const pickerList = await request(app)
        .get('/api/inventory/locations?purpose=REAGENT')
        .set(auth(managerTokenA));
    expect(pickerList.status).toBe(200);
    expect(pickerList.body.some(row => row.id === loc.body.id)).toBe(false);

    const fullList = await request(app)
        .get('/api/inventory/locations?purpose=REAGENT&includeInactive=1')
        .set(auth(managerTokenA));
    expect(fullList.status).toBe(200);
    expect(fullList.body.find(row => row.id === loc.body.id)).toMatchObject({ id: loc.body.id, isActive: false });

    const lotsRes = await request(app)
        .get(`/api/inventory/lots?itemId=${item.body.id}`)
        .set(auth(managerTokenA));
    expect(lotsRes.status).toBe(200);
    expect(lotsRes.body[0]).toMatchObject({
        id: lot.body.id,
        locationId: loc.body.id,
        location: expect.objectContaining({ id: loc.body.id, name: 'Retiring Reagent Shelf', isActive: false })
    });

    const itemDetail = await request(app)
        .get(`/api/inventory/items/${item.body.id}`)
        .set(auth(managerTokenA));
    expect(itemDetail.status).toBe(200);
    expect(itemDetail.body.lots[0].location).toMatchObject({ id: loc.body.id, name: 'Retiring Reagent Shelf' });
});

test('a technician without MANAGE_INVENTORY gets 403 on PATCH /api/inventory/locations/:id', async () => {
    const loc = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({ name: 'Protected Shelf', purpose: 'REAGENT', locationType: 'SHELF' });
    expect(loc.status).toBe(201);

    const forbidden = await request(app)
        .patch(`/api/inventory/locations/${loc.body.id}`)
        .set(auth(techTokenA))
        .send({ name: 'Unauthorized Rename' });
    expect(forbidden.status).toBe(403);
});

test('item API saves defaultLocationId and a new lot without explicit locationId inherits it', async () => {
    const loc1 = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({ name: 'Default Reagent Fridge', purpose: 'REAGENT', locationType: 'FRIDGE', temperatureRange: '2-8°C' });
    const loc2 = await request(app)
        .post('/api/inventory/locations')
        .set(auth(managerTokenA))
        .send({ name: 'Secondary Reagent Cabinet', purpose: 'REAGENT', locationType: 'CABINET' });
    expect(loc1.status).toBe(201);
    expect(loc2.status).toBe(201);

    const createdItem = await request(app)
        .post('/api/inventory/items')
        .set(auth(managerTokenA))
        .send({
            name: 'Potassium Chloride',
            itemType: 'REAGENT',
            unitOfMeasure: 'g',
            defaultLocationId: loc1.body.id
        });
    expect(createdItem.status).toBe(201);
    expect(createdItem.body.defaultLocationId).toBe(loc1.body.id);

    const inheritedLot = await request(app)
        .post('/api/inventory/lots')
        .set(auth(managerTokenA))
        .send({ inventoryItemId: createdItem.body.id, lotNumber: 'KCL-001', quantity: 250 });
    expect(inheritedLot.status).toBe(201);
    expect(inheritedLot.body.locationId).toBe(loc1.body.id);

    const updatedItem = await request(app)
        .put(`/api/inventory/items/${createdItem.body.id}`)
        .set(auth(managerTokenA))
        .send({ defaultLocationId: loc2.body.id });
    expect(updatedItem.status).toBe(200);
    expect(updatedItem.body.defaultLocationId).toBe(loc2.body.id);

    const secondLot = await request(app)
        .post('/api/inventory/lots')
        .set(auth(managerTokenA))
        .send({ inventoryItemId: createdItem.body.id, lotNumber: 'KCL-002', quantity: 100 });
    expect(secondLot.status).toBe(201);
    expect(secondLot.body.locationId).toBe(loc2.body.id);
});

test('all five locales contain matching inventory.tabs, inventory.locations, and custody.manageLocations strings', () => {
    const leaves = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) =>
        child && typeof child === 'object' ? leaves(child, prefix + key + '.') : [[prefix + key, child]]);
    const englishTabs = leaves(packs.en.inventory.tabs);
    const englishLocations = leaves(packs.en.inventory.locations);
    for (const locale of locales) {
        const tabs = leaves(packs[locale].inventory.tabs);
        const locs = leaves(packs[locale].inventory.locations);
        expect(tabs.map(([k]) => k).sort()).toEqual(englishTabs.map(([k]) => k).sort());
        expect(locs.map(([k]) => k).sort()).toEqual(englishLocations.map(([k]) => k).sort());
        for (const [, val] of [...tabs, ...locs]) {
            expect(typeof val).toBe('string');
            expect(val.trim()).not.toBe('');
        }
        expect(typeof packs[locale].custody.manageLocations).toBe('string');
        expect(packs[locale].custody.manageLocations.trim()).not.toBe('');
    }
});
