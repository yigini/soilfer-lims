'use strict';

const request = require('supertest');
const express = require('express');
const { computeItemStockAggregation } = require('../../controllers/inventoryController');

describe('Inventory Stock Aggregation & Lifecycle Contracts (#125)', () => {
    const fixedNow = new Date('2026-09-21T12:00:00.000Z');

    describe('Pure Aggregation Logic (computeItemStockAggregation)', () => {
        test('1. Zero stock fixture: no lots or 0 quantity yields usableStock=0, isOutOfStock=true, isLowStock=false', () => {
            const itemNoLots = {
                id: 'item-1',
                name: 'Hydrochloric Acid 1M',
                unitOfMeasure: 'L',
                reorderPoint: 10,
                lots: []
            };

            const agg1 = computeItemStockAggregation(itemNoLots, fixedNow);
            expect(agg1.usableStock).toBe(0);
            expect(agg1.totalStock).toBe(0);
            expect(agg1.expiredStock).toBe(0);
            expect(agg1.isOutOfStock).toBe(true);
            expect(agg1.isLowStock).toBe(false);
            expect(agg1.hasExpired).toBe(false);
            expect(agg1.hasMissingQuantity).toBe(false);

            const itemZeroLot = {
                id: 'item-2',
                name: 'Sulfuric Acid',
                unitOfMeasure: 'L',
                reorderPoint: 5,
                lots: [{
                    id: 'lot-z',
                    lotNumber: 'L-ZERO',
                    currentQuantity: 0,
                    status: 'AVAILABLE',
                    expiryDate: '2027-01-01T00:00:00.000Z'
                }]
            };
            const agg2 = computeItemStockAggregation(itemZeroLot, fixedNow);
            expect(agg2.usableStock).toBe(0);
            expect(agg2.isOutOfStock).toBe(true);
            expect(agg2.isLowStock).toBe(false);
        });

        test('2. Positive stock below threshold: usableStock=15, reorderPoint=20 yields isLowStock=true, isOutOfStock=false', () => {
            const item = {
                id: 'item-low',
                name: 'Buffer pH 7.0',
                unitOfMeasure: 'mL',
                reorderPoint: 20,
                lots: [{
                    id: 'lot-low',
                    lotNumber: 'L-LOW-1',
                    currentQuantity: 15,
                    status: 'AVAILABLE',
                    expiryDate: '2027-06-01T00:00:00.000Z'
                }]
            };

            const agg = computeItemStockAggregation(item, fixedNow);
            expect(agg.usableStock).toBe(15);
            expect(agg.isOutOfStock).toBe(false);
            expect(agg.isLowStock).toBe(true);
            expect(agg.hasExpired).toBe(false);
        });

        test('3. Positive stock at threshold: usableStock=20, reorderPoint=20 yields isLowStock=true (at or below threshold)', () => {
            const item = {
                id: 'item-thresh',
                name: 'Sodium Hydroxide Pellets',
                unitOfMeasure: 'kg',
                reorderPoint: 20,
                lots: [{
                    id: 'lot-thresh',
                    lotNumber: 'L-TH-1',
                    currentQuantity: 20,
                    status: 'AVAILABLE',
                    expiryDate: '2027-06-01T00:00:00.000Z'
                }]
            };

            const agg = computeItemStockAggregation(item, fixedNow);
            expect(agg.usableStock).toBe(20);
            expect(agg.isOutOfStock).toBe(false);
            expect(agg.isLowStock).toBe(true);
        });

        test('4. Positive stock above threshold: usableStock=30, reorderPoint=20 yields isLowStock=false, isOutOfStock=false', () => {
            const item = {
                id: 'item-healthy',
                name: 'Ammonium Acetate',
                unitOfMeasure: 'kg',
                reorderPoint: 20,
                lots: [{
                    id: 'lot-h',
                    lotNumber: 'L-H-1',
                    currentQuantity: 30,
                    status: 'AVAILABLE',
                    expiryDate: '2027-06-01T00:00:00.000Z'
                }]
            };

            const agg = computeItemStockAggregation(item, fixedNow);
            expect(agg.usableStock).toBe(30);
            expect(agg.isOutOfStock).toBe(false);
            expect(agg.isLowStock).toBe(false);
        });

        test('5. Missing value: lot with null currentQuantity is not treated as zero; yields hasMissingQuantity=true and usableStock=null', () => {
            const item = {
                id: 'item-null-qty',
                name: 'Potassium Chloride CRM',
                unitOfMeasure: 'g',
                reorderPoint: 10,
                lots: [{
                    id: 'lot-missing',
                    lotNumber: 'L-MISSING',
                    currentQuantity: null,
                    status: 'AVAILABLE',
                    expiryDate: '2027-06-01T00:00:00.000Z'
                }]
            };

            const agg = computeItemStockAggregation(item, fixedNow);
            expect(agg.hasMissingQuantity).toBe(true);
            expect(agg.missingQuantityLotCount).toBe(1);
            expect(agg.usableStock).toBeNull();
            expect(agg.usableStock).not.toBe(0);
        });

        test('6. All-expired lots: yields usableStock=0, isOutOfStock=true, hasExpired=true with separate expiredStock', () => {
            const item = {
                id: 'item-all-expired',
                name: 'Nitric Acid 65%',
                unitOfMeasure: 'L',
                reorderPoint: 5,
                lots: [
                    {
                        id: 'lot-exp-1',
                        lotNumber: 'L-EXP-1',
                        currentQuantity: 10,
                        status: 'EXPIRED',
                        expiryDate: '2026-01-01T00:00:00.000Z'
                    },
                    {
                        id: 'lot-exp-2',
                        lotNumber: 'L-EXP-2',
                        currentQuantity: 15,
                        status: 'AVAILABLE',
                        expiryDate: '2026-08-01T00:00:00.000Z' // Past fixedNow (2026-09-21)
                    }
                ]
            };

            const agg = computeItemStockAggregation(item, fixedNow);
            expect(agg.usableStock).toBe(0);
            expect(agg.expiredStock).toBe(25);
            expect(agg.isOutOfStock).toBe(true);
            expect(agg.hasExpired).toBe(true);
            expect(agg.hasExpiredLots).toBe(true);
            expect(agg.expiredLotCount).toBe(2);
            expect(agg.availableLotCount).toBe(0);
        });

        test('7. Mixed lots: both low-stock / out-of-stock and expired conditions remain visible without precedence masking', () => {
            const item = {
                id: 'item-mixed',
                name: 'Filter Papers Grade 1',
                unitOfMeasure: 'box',
                reorderPoint: 20,
                lots: [
                    {
                        id: 'lot-avail',
                        lotNumber: 'L-OK',
                        currentQuantity: 10,
                        status: 'AVAILABLE',
                        expiryDate: '2027-12-31T00:00:00.000Z'
                    },
                    {
                        id: 'lot-bad',
                        lotNumber: 'L-BAD',
                        currentQuantity: 40,
                        status: 'AVAILABLE',
                        expiryDate: '2026-05-01T00:00:00.000Z' // Expired!
                    }
                ]
            };

            const agg = computeItemStockAggregation(item, fixedNow);
            expect(agg.usableStock).toBe(10);
            expect(agg.expiredStock).toBe(40);
            expect(agg.isLowStock).toBe(true);
            expect(agg.hasExpired).toBe(true);
            expect(agg.hasExpiredLots).toBe(true);
            expect(agg.availableLotCount).toBe(1);
            expect(agg.expiredLotCount).toBe(1);
        });

        test('7b. Mixed known and unknown usable lots: 0 + null does not assert isOutOfStock', () => {
            const item = {
                id: 'item-mixed-unknown',
                name: 'Buffer Solution pH 7.0',
                unitOfMeasure: 'bottle',
                reorderPoint: 5,
                lots: [
                    {
                        id: 'lot-zero',
                        lotNumber: 'L-ZERO',
                        currentQuantity: 0,
                        status: 'AVAILABLE',
                        expiryDate: '2027-12-31T00:00:00.000Z'
                    },
                    {
                        id: 'lot-uncounted',
                        lotNumber: 'L-UNCOUNTED',
                        currentQuantity: null,
                        status: 'AVAILABLE',
                        expiryDate: '2027-12-31T00:00:00.000Z'
                    }
                ]
            };

            const agg = computeItemStockAggregation(item, fixedNow);
            // 0 is a known subtotal, but because one usable lot is uncounted (null),
            // total is unknown; we must NOT declare the item OUT OF STOCK.
            expect(agg.usableStock).toBe(0);
            expect(agg.isUsableStockSubtotal).toBe(true);
            expect(agg.hasMissingQuantity).toBe(true);
            expect(agg.hasMissingQuantityInUsableLots).toBe(true);
            expect(agg.usableMissingQuantityLotCount).toBe(1);
            expect(agg.isOutOfStock).toBe(false);
        });

        test('7c. Positive known stock below threshold with uncounted lots: isUsableStockSubtotal=true and isLowStock=true (uncertain low stock)', () => {
            const item = {
                id: 'item-pos-unknown-low',
                name: 'Ethanol 96%',
                unitOfMeasure: 'L',
                reorderPoint: 20,
                lots: [
                    {
                        id: 'lot-pos',
                        lotNumber: 'L-POS',
                        currentQuantity: 15,
                        status: 'AVAILABLE',
                        expiryDate: '2027-12-31T00:00:00.000Z'
                    },
                    {
                        id: 'lot-uncounted-2',
                        lotNumber: 'L-UNCOUNTED-2',
                        currentQuantity: null,
                        status: 'AVAILABLE',
                        expiryDate: '2027-12-31T00:00:00.000Z'
                    }
                ]
            };

            const agg = computeItemStockAggregation(item, fixedNow);
            // 15 is known, which is <= reorderPoint (20), but uncounted lot could potentially put it over.
            expect(agg.usableStock).toBe(15);
            expect(agg.isUsableStockSubtotal).toBe(true);
            expect(agg.hasMissingQuantityInUsableLots).toBe(true);
            expect(agg.isLowStock).toBe(true);
            expect(agg.isOutOfStock).toBe(false);
        });

        test('7d. Positive known stock above threshold with uncounted lots: isLowStock=false (known stock alone is sufficient)', () => {
            const item = {
                id: 'item-pos-unknown-high',
                name: 'Hydrochloric Acid 37%',
                unitOfMeasure: 'L',
                reorderPoint: 20,
                lots: [
                    {
                        id: 'lot-high',
                        lotNumber: 'L-HIGH',
                        currentQuantity: 25,
                        status: 'AVAILABLE',
                        expiryDate: '2027-12-31T00:00:00.000Z'
                    },
                    {
                        id: 'lot-uncounted-3',
                        lotNumber: 'L-UNCOUNTED-3',
                        currentQuantity: null,
                        status: 'AVAILABLE',
                        expiryDate: '2027-12-31T00:00:00.000Z'
                    }
                ]
            };

            const agg = computeItemStockAggregation(item, fixedNow);
            expect(agg.usableStock).toBe(25);
            expect(agg.isUsableStockSubtotal).toBe(true);
            expect(agg.hasMissingQuantityInUsableLots).toBe(true);
            expect(agg.isLowStock).toBe(false);
            expect(agg.isOutOfStock).toBe(false);
        });
    });

    describe('HTTP Endpoints & Zero Side-Effects Contracts', () => {
        let app;

        beforeEach(() => {
            jest.clearAllMocks();

            const inventoryController = require('../../controllers/inventoryController');

            app = express();
            app.use(express.json());
            // Mock auth middleware injecting user
            app.use((req, res, next) => {
                req.user = { id: 'usr-mgr', username: 'labmgr', role: 'LAB_MANAGER', labId: 'LAB-1' };
                next();
            });

            app.get('/api/inventory/items', inventoryController.getItems);
            app.get('/api/inventory/items/:id', inventoryController.getItem);
            app.get('/api/inventory/alerts', inventoryController.getAlerts);
            app.get('/api/inventory/fefo/:itemId', inventoryController.getFEFO);
        });

        test('8. GET /api/inventory/alerts is pure and produces ZERO database mutation side-effects', async () => {
            const prisma = require('../../prisma');
            const originalFindMany = prisma.inventoryItem.findMany;
            const originalLotUpdate = prisma.inventoryLot.update;

            const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
            const futureDate = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString();

            prisma.inventoryItem.findMany = jest.fn().mockResolvedValue([
                {
                    id: 'item-100',
                    name: 'Test Chemical',
                    reorderPoint: 5,
                    unitOfMeasure: 'g',
                    lots: [
                        { id: 'lot-exp', lotNumber: 'L-1', currentQuantity: 10, status: 'AVAILABLE', expiryDate: pastDate },
                        { id: 'lot-ok', lotNumber: 'L-2', currentQuantity: 2, status: 'AVAILABLE', expiryDate: futureDate }
                    ]
                }
            ]);

            const updateSpy = jest.fn();
            prisma.inventoryLot.update = updateSpy;

            try {
                const res = await request(app).get('/api/inventory/alerts');
                expect(res.status).toBe(200);

                // Zero DB update side-effects on GET request!
                expect(updateSpy).not.toHaveBeenCalled();

                // Check alert structure
                expect(res.body.counts).toBeDefined();
                expect(res.body.counts.expired).toBeGreaterThanOrEqual(1);
                expect(res.body.counts.lowStock).toBeGreaterThanOrEqual(1);
            } finally {
                prisma.inventoryItem.findMany = originalFindMany;
                prisma.inventoryLot.update = originalLotUpdate;
            }
        });

        test('9. GET /api/inventory/fefo/:itemId filters out expired lots from recommendations', async () => {
            const prisma = require('../../prisma');
            const originalLotFindMany = prisma.inventoryLot.findMany;

            const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
            const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

            prisma.inventoryLot.findMany = jest.fn().mockResolvedValue([
                { id: 'lot-expired', lotNumber: 'L-EXP', expiryDate: pastDate, status: 'AVAILABLE', currentQuantity: 10 },
                { id: 'lot-fresh', lotNumber: 'L-FRESH', expiryDate: futureDate, status: 'AVAILABLE', currentQuantity: 5 }
            ]);

            try {
                const res = await request(app).get('/api/inventory/fefo/item-100');
                expect(res.status).toBe(200);
                expect(res.body).toHaveLength(1);
                expect(res.body[0].id).toBe('lot-fresh');
                expect(res.body.find(l => l.id === 'lot-expired')).toBeUndefined();
            } finally {
                prisma.inventoryLot.findMany = originalLotFindMany;
            }
        });
    });
});
