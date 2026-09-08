import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useDialog } from '../context/DialogContext';
import {
    Package, AlertTriangle, Search, Plus, Download, Bell, Filter,
    ChevronRight, X, Beaker, FlaskConical, Box, TestTube2,
    MapPin, Clock, ShieldAlert, Trash2, ArrowRightLeft, MinusCircle,
    PlusCircle, Eye, Archive, CheckCircle, XCircle, RefreshCw, BarChart3
} from 'lucide-react';
import InfoTooltip from '../components/common/InfoTooltip';

// ─── Constants ───────────────────────────────────────────────────
const ITEM_TYPES = ['ALL', 'REAGENT', 'CHEMICAL', 'CONSUMABLE', 'STANDARD', 'CRM', 'CONTAINER', 'OTHER'];
const TYPE_ICONS = { REAGENT: Beaker, CHEMICAL: FlaskConical, CONSUMABLE: Box, STANDARD: TestTube2, CRM: TestTube2, CONTAINER: Archive, OTHER: Package };
const TYPE_COLORS = {
    REAGENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    CHEMICAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    CONSUMABLE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    STANDARD: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    CRM: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    CONTAINER: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    OTHER: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
};
const STATUS_BADGES = {
    AVAILABLE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    QUARANTINED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    EXPIRED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    DISPOSED: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-500'
};

// ─── Alert Banner ────────────────────────────────────────────────
const AlertBanner = ({ alerts, onViewAlerts }) => {
    if (!alerts || alerts.total === 0) return null;
    return (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-900/20 dark:to-amber-900/20 border border-red-200 dark:border-red-800/40">
            <Bell size={16} className="text-red-500 animate-pulse" />
            <div className="flex gap-4 text-sm font-medium flex-1">
                {alerts.expired > 0 && <span className="text-red-600 dark:text-red-400">🔴 {alerts.expired} expired</span>}
                {alerts.expiringSoon > 0 && <span className="text-amber-600 dark:text-amber-400">🟡 {alerts.expiringSoon} expiring soon</span>}
                {alerts.lowStock > 0 && <span className="text-orange-600 dark:text-orange-400">📦 {alerts.lowStock} low stock</span>}
                {alerts.quarantined > 0 && <span className="text-yellow-600 dark:text-yellow-400">🔒 {alerts.quarantined} quarantined</span>}
            </div>
            <button onClick={onViewAlerts} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">View All</button>
        </div>
    );
};

// ─── Quick Consume Modal (New) ──────────────────────────────────
const QuickConsumeModal = ({ show, onClose, item, locations, onSuccess }) => {
    const [lot, setLot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show && item) {
            setLoading(true);
            axios.get(`/api/inventory/fefo/${item.id}`)
                .then(res => {
                    const available = res.data.filter(l => l.status === 'AVAILABLE' && l.currentQuantity > 0);
                    setLot(available[0] || null);
                })
                .catch(e => setError('Failed to find best lot'))
                .finally(() => setLoading(false));
        } else {
            setLot(null); setQuantity(''); setReason(''); setError('');
        }
    }, [show, item]);

    const handleConsume = async () => {
        setSaving(true); setError('');
        try {
            await axios.post(`/api/inventory/lots/${lot.id}/consume`, {
                quantity: parseFloat(quantity),
                reason: reason || undefined
            });
            onSuccess(); onClose();
        } catch (e) {
            setError(e.response?.data?.error || 'Consumption failed');
        } finally { setSaving(false); }
    };

    if (!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><MinusCircle size={18} className="text-blue-600" /> Quick Consume</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                    {loading ? <div className="text-center py-4 text-gray-400">Finding best lot...</div> :
                        !lot ? <div className="text-center py-4 text-red-500 text-sm">No available lots with stock for this item.</div> : (
                            <>
                                <div className="text-sm">
                                    <p className="text-gray-500 mb-1">Item: <b className="text-sf-text">{item.name}</b></p>
                                    <div className="p-2 rounded bg-sf-canvas/50 border dark:border-gray-600">
                                        <p className="flex justify-between"><span>Auto-selected Lot:</span> <b className="font-mono text-xs">{lot.lotNumber}</b></p>
                                        <p className="flex justify-between"><span>Available:</span> <b>{lot.currentQuantity} {item.unitOfMeasure}</b></p>
                                        {lot.expiryDate && <p className="flex justify-between text-amber-600"><span>Expires:</span> <b>{new Date(lot.expiryDate).toLocaleDateString()}</b></p>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Amount to use ({item.unitOfMeasure}) *</label>
                                    <input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} autoFocus
                                        className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                {error && <p className="text-xs text-red-500">{error}</p>}
                            </>
                        )}
                </div>
                <div className="px-6 py-4 bg-sf-canvas/50 border-t dark:border-gray-700 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm">Cancel</button>
                    <button onClick={handleConsume} disabled={!lot || !quantity || saving}
                        className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                        {saving ? 'Processing...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Receive Stock Modal ─────────────────────────────────────────
const ReceiveStockModal = ({ show, onClose, items, locations, onSuccess, initialItemId }) => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ inventoryItemId: '', lotNumber: '', quantity: '', expiryDate: '', locationId: '', concentration: '', preparedBy: '', traceabilityNotes: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const reset = () => {
        setStep(initialItemId ? 2 : 1);
        setForm({ inventoryItemId: initialItemId || '', lotNumber: '', quantity: '', expiryDate: '', locationId: '', concentration: '', preparedBy: '', traceabilityNotes: '' });
        setError('');
    };
    useEffect(() => { if (show) reset(); }, [show, initialItemId]);

    const selectedItem = items.find(i => i.id === form.inventoryItemId);

    const handleSubmit = async () => {
        setSaving(true); setError('');
        try {
            await axios.post('/api/inventory/lots', { ...form, quantity: parseFloat(form.quantity) });
            onSuccess(); onClose();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to receive stock');
        } finally { setSaving(false); }
    };

    if (!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20">
                    <div className="flex items-center gap-2">
                        <PlusCircle className="text-emerald-600" size={20} />
                        <h3 className="text-lg font-bold text-sf-text">Receive Stock</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-sf-muted">Step {step}/3</span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
                </div>
                {/* Steps */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}

                    {step === 1 && (<>
                        <label className="block text-sm font-medium text-sf-muted">Select Item *</label>
                        <select value={form.inventoryItemId} onChange={e => setForm(f => ({ ...f, inventoryItemId: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sf-text focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="">— Choose item —</option>
                            {items.filter(i => i.isActive).map(i => <option key={i.id} value={i.id}>{i.name} ({i.itemType})</option>)}
                        </select>
                        {selectedItem && <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-200">Unit: <b>{selectedItem.unitOfMeasure}</b> • Type: <b>{selectedItem.itemType}</b>{selectedItem.grade && <> • Grade: <b>{selectedItem.grade}</b></>}</div>}
                    </>)}

                    {step === 2 && (<>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-sf-muted mb-1">Lot Number *</label>
                                <input value={form.lotNumber} onChange={e => setForm(f => ({ ...f, lotNumber: e.target.value }))} placeholder="e.g. LOT-2026-001"
                                    className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sf-text focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-sf-muted mb-1">Quantity *</label>
                                <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                                    placeholder={selectedItem?.unitOfMeasure || 'qty'}
                                    className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sf-text focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-sf-muted mb-1">Expiry Date</label>
                                <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sf-text focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-sf-muted mb-1">Storage Location</label>
                                <select value={form.locationId} onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sf-text focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                                    <option value="">Default</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-sf-muted mb-1">Concentration / Notes</label>
                            <input value={form.concentration} onChange={e => setForm(f => ({ ...f, concentration: e.target.value }))} placeholder="e.g. 1000 ppm"
                                className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sf-text focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                    </>)}

                    {step === 3 && (<>
                        <div className="p-4 rounded-xl bg-sf-canvas/50 space-y-2 text-sm">
                            <h4 className="font-bold text-sf-text mb-2">📋 Confirm Receipt</h4>
                            <p><span className="text-gray-500">Item:</span> <b>{selectedItem?.name}</b></p>
                            <p><span className="text-gray-500">Lot:</span> <b>{form.lotNumber}</b></p>
                            <p><span className="text-gray-500">Quantity:</span> <b>{form.quantity} {selectedItem?.unitOfMeasure}</b></p>
                            {form.expiryDate && <p><span className="text-gray-500">Expiry:</span> <b>{form.expiryDate}</b></p>}
                            {form.concentration && <p><span className="text-gray-500">Concentration:</span> <b>{form.concentration}</b></p>}
                        </div>
                    </>)}
                </div>
                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t dark:border-gray-700 bg-sf-canvas/50">
                    <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} className="px-4 py-2 text-sm font-medium text-sf-muted hover:text-gray-900 dark:hover:text-gray-200">
                        {step > 1 ? '← Back' : 'Cancel'}
                    </button>
                    {step < 3 ? (
                        <button onClick={() => setStep(s => s + 1)}
                            disabled={(step === 1 && !form.inventoryItemId) || (step === 2 && (!form.lotNumber || !form.quantity))}
                            className="px-6 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            Next →
                        </button>
                    ) : (
                        <button onClick={handleSubmit} disabled={saving}
                            className="px-6 py-2 text-sm font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />} Confirm Receipt
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Item Detail Drawer ──────────────────────────────────────────
const ItemDrawer = ({ item, show, onClose, onAction, canManage, canConsume, locations }) => {
    const [actionModal, setActionModal] = useState(null); // { type, lotId }
    const [actionForm, setActionForm] = useState({ quantity: '', reason: '', locationId: '' });
    const [actionError, setActionError] = useState('');
    const [actionSaving, setActionSaving] = useState(false);

    if (!show || !item) return null;
    const availableLots = (item.lots || []).filter(l => l.status === 'AVAILABLE');
    const totalAvailable = availableLots.reduce((s, l) => s + l.currentQuantity, 0);

    const executeAction = async () => {
        setActionSaving(true); setActionError('');
        try {
            const lotId = actionModal.lotId;
            if (actionModal.type === 'consume') {
                await axios.post(`/api/inventory/lots/${lotId}/consume`, { quantity: parseFloat(actionForm.quantity), reason: actionForm.reason || undefined });
            } else if (actionModal.type === 'adjust') {
                await axios.post(`/api/inventory/lots/${lotId}/adjust`, { delta: parseFloat(actionForm.quantity), reason: actionForm.reason });
            } else if (actionModal.type === 'quarantine') {
                await axios.post(`/api/inventory/lots/${lotId}/quarantine`, { reason: actionForm.reason });
            } else if (actionModal.type === 'release') {
                await axios.post(`/api/inventory/lots/${lotId}/release`, { reason: actionForm.reason });
            } else if (actionModal.type === 'dispose') {
                await axios.post(`/api/inventory/lots/${lotId}/dispose`, { reason: actionForm.reason });
            } else if (actionModal.type === 'transfer') {
                await axios.post(`/api/inventory/lots/${lotId}/transfer`, { locationId: actionForm.locationId });
            }
            setActionModal(null); setActionForm({ quantity: '', reason: '', locationId: '' });
            onAction(); // refresh
        } catch (e) {
            setActionError(e.response?.data?.error || 'Action failed');
        } finally { setActionSaving(false); }
    };

    const needsQty = ['consume', 'adjust'].includes(actionModal?.type);
    const needsReason = ['adjust', 'quarantine', 'dispose'].includes(actionModal?.type);
    const needsLocation = actionModal?.type === 'transfer';

    return (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-2xl bg-sf-surface h-full overflow-y-auto shadow-2xl animate-slide-in-right" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur">
                    <div>
                        <h3 className="text-lg font-bold text-sf-text flex items-center gap-2">
                            {React.createElement(TYPE_ICONS[item.itemType] || Package, { size: 18 })}
                            {item.name}
                        </h3>
                        <p className="text-sm text-sf-muted mt-0.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[item.itemType] || TYPE_COLORS.OTHER}`}>{item.itemType}</span>
                            {item.shortCode && <span className="ml-2 font-mono text-xs">{item.shortCode}</span>}
                            {item.grade && <span className="ml-2">• {item.grade}</span>}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-sf-raised"><X size={20} /></button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3 p-6 pb-3">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-center">
                        <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalAvailable.toFixed(1)}</div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">{item.unitOfMeasure} available</div>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-center">
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{item.lotCount || 0}</div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">total lots</div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-center">
                        <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{item.nearestExpiry ? Math.max(0, Math.ceil((new Date(item.nearestExpiry) - new Date()) / 86400000)) : '—'}</div>
                        <div className="text-xs text-amber-600 dark:text-amber-400">days to expiry</div>
                    </div>
                </div>

                {/* Details */}
                {(item.hazardClass || item.sopLink || item.preferredVendor || item.notes) && (
                    <div className="px-6 pb-3">
                        <div className="p-3 rounded-xl bg-sf-canvas/40 text-sm space-y-1">
                            {item.hazardClass && <p>⚠️ <b>Hazard:</b> {item.hazardClass}</p>}
                            {item.preferredVendor && <p>🏪 <b>Vendor:</b> {item.preferredVendor}</p>}
                            {item.reorderPoint > 0 && <p>📦 <b>Reorder at:</b> {item.reorderPoint} {item.unitOfMeasure}</p>}
                            {item.sopLink && <p>📄 <a href={item.sopLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View SOP</a></p>}
                            {item.notes && <p className="text-gray-500">{item.notes}</p>}
                        </div>
                    </div>
                )}

                {/* Lots Table */}
                <div className="px-6 pb-6">
                    <h4 className="text-sm font-bold text-sf-muted mb-2 flex items-center gap-2">
                        <Archive size={14} /> Lots ({(item.lots || []).length})
                    </h4>
                    <div className="rounded-xl border dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-sf-canvas/60">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-sf-muted">Lot #</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-sf-muted">Status</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-sf-muted">Qty</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-sf-muted">Expiry</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-sf-muted">Location</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold text-sf-muted">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {(item.lots || []).map(lot => {
                                    const isExpired = lot.expiryDate && new Date(lot.expiryDate) < new Date();
                                    return (
                                        <tr key={lot.id} className="hover:bg-sf-raised/30">
                                            <td className="px-3 py-2 font-mono text-xs">{lot.lotNumber}</td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGES[lot.status] || ''}`}>{lot.status}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold">{lot.currentQuantity} <span className="text-xs font-normal text-gray-400">{lot.unitOfMeasure}</span></td>
                                            <td className={`px-3 py-2 text-xs text-center ${isExpired ? 'text-red-600 font-bold' : ''}`}>
                                                {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString() : '—'}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-center">{lot.location?.name || '—'}</td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canConsume && lot.status === 'AVAILABLE' && lot.currentQuantity > 0 && (
                                                        <button onClick={() => { setActionModal({ type: 'consume', lotId: lot.id }); setActionForm({ quantity: '', reason: '' }); setActionError(''); }}
                                                            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600" title="Consume"><MinusCircle size={14} /></button>
                                                    )}
                                                    {canManage && (<>
                                                        {lot.status === 'AVAILABLE' && (
                                                            <button onClick={() => { setActionModal({ type: 'quarantine', lotId: lot.id }); setActionForm({ reason: '' }); setActionError(''); }}
                                                                className="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600" title="Quarantine"><ShieldAlert size={14} /></button>
                                                        )}
                                                        {lot.status === 'QUARANTINED' && (
                                                            <button onClick={() => { setActionModal({ type: 'release', lotId: lot.id }); setActionError(''); }}
                                                                className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600" title="Release"><CheckCircle size={14} /></button>
                                                        )}
                                                        <button onClick={() => { setActionModal({ type: 'adjust', lotId: lot.id }); setActionForm({ quantity: '', reason: '' }); setActionError(''); }}
                                                            className="p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600" title="Adjust"><BarChart3 size={14} /></button>
                                                        <button onClick={() => { setActionModal({ type: 'transfer', lotId: lot.id }); setActionForm({ locationId: '' }); setActionError(''); }}
                                                            className="p-1 rounded hover:bg-cyan-100 dark:hover:bg-cyan-900/30 text-cyan-600" title="Transfer"><ArrowRightLeft size={14} /></button>
                                                        {lot.status !== 'DISPOSED' && (
                                                            <button onClick={() => { setActionModal({ type: 'dispose', lotId: lot.id }); setActionForm({ reason: '' }); setActionError(''); }}
                                                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500" title="Dispose"><Trash2 size={14} /></button>
                                                        )}
                                                    </>)}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(item.lots || []).length === 0 && (
                                    <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No lots received yet</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Action Sub-Modal */}
                {actionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setActionModal(null)}>
                        <div className="bg-sf-surface rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
                            <h4 className="font-bold text-sf-text mb-3 capitalize">{actionModal.type} Lot</h4>
                            {actionError && <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{actionError}</div>}
                            {needsQty && (
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-sf-muted mb-1">{actionModal.type === 'adjust' ? 'Delta (+/-)' : 'Quantity'} *</label>
                                    <input type="number" step="0.01" value={actionForm.quantity} onChange={e => setActionForm(f => ({ ...f, quantity: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            )}
                            {needsReason && (
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-sf-muted mb-1">Reason *</label>
                                    <textarea value={actionForm.reason} onChange={e => setActionForm(f => ({ ...f, reason: e.target.value }))} rows={2}
                                        className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            )}
                            {needsLocation && (
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-sf-muted mb-1">New Location *</label>
                                    <select value={actionForm.locationId} onChange={e => setActionForm(f => ({ ...f, locationId: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">— Select —</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                                <button onClick={executeAction} disabled={actionSaving || (needsQty && !actionForm.quantity) || (needsReason && actionForm.reason.length < 3) || (needsLocation && !actionForm.locationId)}
                                    className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
                                    {actionSaving ? 'Processing...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Create Item Modal ───────────────────────────────────────────
const CreateItemModal = ({ show, onClose, onSuccess }) => {
    const [form, setForm] = useState({ name: '', itemType: 'REAGENT', unitOfMeasure: 'mL', shortCode: '', grade: '', hazardClass: '', reorderPoint: 0 });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setSaving(true); setError('');
        try {
            await axios.post('/api/inventory/items', form);
            onSuccess(); onClose();
        } catch (e) { setError(e.response?.data?.error || 'Failed'); }
        finally { setSaving(false); }
    };

    if (!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
                    <h3 className="text-lg font-bold text-sf-text flex items-center gap-2"><Plus size={18} /> New Catalog Item</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                    {error && <div className="p-2 rounded bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>}
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Item name *"
                        className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="grid grid-cols-2 gap-3">
                        <select value={form.itemType} onChange={e => setForm(f => ({ ...f, itemType: e.target.value }))}
                            className="px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none">
                            {ITEM_TYPES.filter(t => t !== 'ALL').map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={form.unitOfMeasure} onChange={e => setForm(f => ({ ...f, unitOfMeasure: e.target.value }))}
                            className="px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none">
                            {['g', 'mg', 'kg', 'mL', 'L', 'µL', 'pcs', 'box'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <input value={form.shortCode} onChange={e => setForm(f => ({ ...f, shortCode: e.target.value }))} placeholder="Short code"
                            className="px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none" />
                        <input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} placeholder="Grade"
                            className="px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none" />
                    </div>
                    <input value={form.hazardClass} onChange={e => setForm(f => ({ ...f, hazardClass: e.target.value }))} placeholder="Hazard class (optional)"
                        className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none" />
                    <input type="number" value={form.reorderPoint} onChange={e => setForm(f => ({ ...f, reorderPoint: parseFloat(e.target.value) || 0 }))} placeholder="Reorder point"
                        className="w-full px-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none" />
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t dark:border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                    <button onClick={handleSubmit} disabled={saving || !form.name}
                        className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
                        {saving ? 'Creating...' : 'Create Item'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════
// MAIN INVENTORY COCKPIT
// ═════════════════════════════════════════════════════════════════
const Inventory = () => {
    const { user, hasPermission } = useAuth();
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const canManage = hasPermission('MANAGE_INVENTORY');
    const canConsume = hasPermission('CONSUME_INVENTORY');

    const [items, setItems] = useState([]);
    const [locations, setLocations] = useState([]);
    const [alertCounts, setAlertCounts] = useState(null);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [showReceive, setShowReceive] = useState(false);
    const [initialReceiveItemId, setInitialReceiveItemId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showQuickConsume, setShowQuickConsume] = useState(false);
    const [quickConsumeItem, setQuickConsumeItem] = useState(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [alertFilter, setAlertFilter] = useState(null);
    const [alertsList, setAlertsList] = useState([]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [itemsRes, locsRes, alertsRes] = await Promise.all([
                axios.get('/api/inventory/items', { params: { type: typeFilter !== 'ALL' ? typeFilter : undefined, search: search || undefined } }),
                axios.get('/api/inventory/locations'),
                axios.get('/api/inventory/alerts')
            ]);
            setItems(itemsRes.data);
            setLocations(locsRes.data);
            setAlertCounts(alertsRes.data.counts);
            setAlertsList(alertsRes.data.alerts || []);
        } catch (e) { console.error('[INVENTORY] fetch error:', e); }
        finally { setLoading(false); }
    }, [typeFilter, search]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const openItem = async (item) => {
        try {
            const res = await axios.get(`/api/inventory/items/${item.id}`);
            setSelectedItem(res.data);
        } catch (e) { console.error(e); }
    };

    const handleQuickReceive = (e, item) => {
        e.stopPropagation();
        setInitialReceiveItemId(item.id);
        setShowReceive(true);
    };

    const handleQuickConsume = (e, item) => {
        e.stopPropagation();
        setQuickConsumeItem(item);
        setShowQuickConsume(true);
    };

    const handleExport = async (type) => {
        try {
            const res = await axios.get(`/api/inventory/export/${type}`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url; a.download = `inventory_${type}_${new Date().toISOString().split('T')[0]}.csv`;
            a.click(); URL.revokeObjectURL(url);
        } catch (e) { showDialog({ title: t('common.error', 'Error'), message: 'Failed to export inventory data.', type: 'error' }); }
    };

    return (
        <div className="flex flex-col h-full gap-4 pb-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-sf-text flex items-center gap-2">
                        <Package className="text-blue-600 dark:text-blue-400" size={24} /> {t('inventory.title', 'Inventory & Reagents')}
                    </h1>
                    <p className="text-sm text-sf-muted">{t('inventory.subtitle', 'Track laboratory consumables, certified reference materials, and expiration alerts')}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {canManage && (
                        <>
                            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-sf-divider text-sf-muted hover:bg-sf-raised transition-colors">
                                <Plus size={14} /> {t('inventory.addItem', 'New Item')}
                            </button>
                            <button onClick={() => { setInitialReceiveItemId(null); setShowReceive(true); }} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm">
                                <PlusCircle size={14} /> {t('inventory.adjustStock', 'Receive Stock')}
                            </button>
                        </>
                    )}
                    <div className="relative">
                        <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 rounded-lg border dark:border-gray-600 hover:bg-sf-raised relative">
                            <Download size={16} className="text-gray-500" />
                        </button>
                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-sf-surface rounded-lg shadow-xl border dark:border-gray-700 py-1 z-30">
                                {['stock', 'expiry', 'transactions'].map(type => (
                                    <button key={type} onClick={() => { handleExport(type); setShowExportMenu(false); }}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-sf-raised capitalize">{type} Report</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AlertBanner alerts={alertCounts} onViewAlerts={() => setAlertFilter(alertFilter ? null : 'LOW_STOCK')} />
            {alertFilter && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40 text-sm">
                    <Filter size={14} className="text-orange-500" />
                    <span className="text-orange-700 dark:text-orange-300 font-medium">{t('inventory.lowStock', 'Showing: Low Stock Items')}</span>
                    <button onClick={() => setAlertFilter(null)} className="ml-auto p-0.5 rounded hover:bg-orange-100 dark:hover:bg-orange-800/40 text-orange-500"><X size={14} /></button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('inventory.searchPlaceholder', 'Search items by name or code...')}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-sf-text outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex card-base rounded-lg border p-0.5 overflow-x-auto">
                    {ITEM_TYPES.map(type => (
                        <button key={type} onClick={() => setTypeFilter(type)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${typeFilter === type
                                ? 'bg-slate-700 dark:bg-slate-600 text-white shadow-sm'
                                : 'text-sf-muted hover:text-gray-900 dark:hover:text-gray-200'}`}>
                            {type === 'ALL' ? t('common.all', 'ALL') : type}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card-base rounded-xl shadow-sm border flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-gray-400"><RefreshCw size={24} className="animate-spin mr-2" /> {t('common.loading', 'Loading inventory...')}</div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                        <Package size={40} className="mb-2 opacity-40" />
                        <p className="text-sm">{t('common.noRecords', 'No inventory items found')}</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-sf-canvas/60 border-b dark:border-gray-600 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase">{t('inventory.itemName', 'Item')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase">{t('inventory.category', 'Type')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase text-right">{t('inventory.currentStock', 'Total Stock')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase text-center">{t('inventory.expiryDate', 'Nearest Expiry')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase text-center">Status</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase text-right">{t('common.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {items.filter(item => !alertFilter || (alertFilter === 'LOW_STOCK' && item.isLowStock)).map(item => (
                                <tr key={item.id} onClick={() => openItem(item)} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-sf-text group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                                            {item.name}
                                        </div>
                                        {item.shortCode && <div className="text-xs text-gray-400 font-mono">{item.shortCode}</div>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[item.itemType] || TYPE_COLORS.OTHER}`}>
                                            {React.createElement(TYPE_ICONS[item.itemType] || Package, { size: 10 })}
                                            {item.itemType}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`font-bold ${item.isLowStock ? 'text-red-600 dark:text-red-400' : 'text-sf-text'}`}>
                                            {item.totalStock?.toFixed(1) || '0.0'}
                                        </span>
                                        <span className="text-xs text-gray-400 ml-1">{item.unitOfMeasure}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs">
                                        {item.nearestExpiry ? (
                                            <span className={item.isExpiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-500'}>
                                                {new Date(item.nearestExpiry).toLocaleDateString()}
                                            </span>
                                        ) : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {item.isLowStock && <span title="Low stock" className="text-red-500"><AlertTriangle size={14} /></span>}
                                            {item.isExpiringSoon && <span title="Expiring soon" className="text-amber-500"><Clock size={14} /></span>}
                                            {item.hasQuarantined && <span title="Has quarantined lots" className="text-yellow-500"><ShieldAlert size={14} /></span>}
                                            {item.hasExpired && <span title="Has expired lots" className="text-red-400"><XCircle size={14} /></span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {canConsume && item.totalStock > 0 && (
                                                <button onClick={(e) => handleQuickConsume(e, item)}
                                                    className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors" title="Quick Consume (FEFO)">
                                                    <MinusCircle size={14} />
                                                </button>
                                            )}
                                            {canManage && (
                                                <button onClick={(e) => handleQuickReceive(e, item)}
                                                    className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors" title="Receive Stock">
                                                    <PlusCircle size={14} />
                                                </button>
                                            )}
                                            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                                            <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modals */}
            <ReceiveStockModal show={showReceive} onClose={() => setShowReceive(false)} items={items} locations={locations} onSuccess={fetchAll} initialItemId={initialReceiveItemId} />
            <QuickConsumeModal show={showQuickConsume} onClose={() => setShowQuickConsume(false)} item={quickConsumeItem} locations={locations} onSuccess={fetchAll} />
            <CreateItemModal show={showCreate} onClose={() => setShowCreate(false)} onSuccess={fetchAll} />
            <ItemDrawer item={selectedItem} show={!!selectedItem} onClose={() => setSelectedItem(null)} onAction={() => { fetchAll(); if (selectedItem) openItem(selectedItem); }} canManage={canManage} canConsume={canConsume} locations={locations} />
        </div>
    );
};


export default Inventory;
