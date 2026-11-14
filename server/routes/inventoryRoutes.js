const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const inv = require('../controllers/inventoryController');
const { hasPermission } = require('../config/roles');

// Preserve existing stock-receipt authority, including national managers.
const mayPrepareLot = (req, res, next) => hasPermission(req.user, 'MANAGE_INVENTORY')
    ? next() : checkPermission('PREPARE_INVENTORY_LOT')(req, res, next);

router.use(verifyToken);

// ─── Items (catalog) ─────────────────────────────────────────────
router.get('/items', checkPermission('VIEW_INVENTORY'), inv.getItems);
router.get('/items/:id', checkPermission('VIEW_INVENTORY'), inv.getItem);
router.post('/items', checkPermission('MANAGE_INVENTORY'), inv.createItem);
router.put('/items/:id', checkPermission('MANAGE_INVENTORY'), inv.updateItem);

// ─── Lots ────────────────────────────────────────────────────────
router.get('/lots', checkPermission('VIEW_INVENTORY'), inv.getLots);
router.post('/lots', mayPrepareLot, inv.createLot);
router.post('/lots/:id/consume', checkPermission('CONSUME_INVENTORY'), inv.consumeLot);
router.post('/lots/:id/adjust', checkPermission('MANAGE_INVENTORY'), inv.adjustLot);
router.post('/lots/:id/quarantine', checkPermission('MANAGE_INVENTORY'), inv.quarantineLot);
router.post('/lots/:id/release', checkPermission('MANAGE_INVENTORY'), inv.releaseLot);
router.post('/lots/:id/dispose', checkPermission('MANAGE_INVENTORY'), inv.disposeLot);
router.post('/lots/:id/transfer', checkPermission('MANAGE_INVENTORY'), inv.transferLot);

// ─── Locations ───────────────────────────────────────────────────
router.get('/locations', checkPermission('VIEW_INVENTORY'), inv.getLocations);
router.post('/locations', checkPermission('MANAGE_INVENTORY'), inv.createLocation);

// ─── Transactions (read-only ledger) ─────────────────────────────
router.get('/transactions', checkPermission('VIEW_INVENTORY'), inv.getTransactions);

// ─── Alerts ──────────────────────────────────────────────────────
router.get('/alerts', checkPermission('VIEW_INVENTORY'), inv.getAlerts);

// ─── FEFO suggestion ─────────────────────────────────────────────
router.get('/fefo/:itemId', checkPermission('CONSUME_INVENTORY'), inv.getFEFO);

// ─── Exports ─────────────────────────────────────────────────────
router.get('/export/:type', checkPermission('MANAGE_INVENTORY'), inv.exportData);

// ─── Method Requirements ─────────────────────────────────────────
router.get('/method-requirements', checkPermission('VIEW_INVENTORY'), inv.getMethodRequirements);
router.post('/method-requirements', checkPermission('MANAGE_INVENTORY'), inv.createMethodRequirement);
router.delete('/method-requirements/:id', checkPermission('MANAGE_INVENTORY'), inv.deleteMethodRequirement);

module.exports = router;
