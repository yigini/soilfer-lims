
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, MapPin, User, Calendar, Layers, Camera, Globe, Cloud, Leaf, FileText, X, ChevronLeft, ChevronRight as ChevronRightIcon, ExternalLink, Compass, RotateCw, RotateCcw } from 'lucide-react';
import MetadataEditorModal from './MetadataEditorModal';

// Proxy Kobo attachment URLs through our server (adds auth token)
const proxyUrl = (url) => url ? `/api/kobo/media?url=${encodeURIComponent(url)}` : null;

// ─── Shared Components ───────────────────────────────────────────

const Badge = ({ text, color = 'gray' }) => {
    const colors = {
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        orange: 'bg-orange-50 text-orange-700 border-orange-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        gray: 'bg-gray-50 text-gray-600 border-gray-200',
    };
    return (
        <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-semibold tracking-wide uppercase ${colors[color] || colors.gray}`}>
            {text}
        </span>
    );
};

const InfoCard = ({ icon: Icon, iconColor, label, value, subtitle }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/80 border border-gray-100 hover:bg-gray-100/80 transition-colors">
        {Icon && (
            <div className={`p-2 rounded-lg ${iconColor || 'bg-blue-100 text-blue-600'} flex-shrink-0`}>
                <Icon size={16} />
            </div>
        )}
        <div className="min-w-0 flex-1">
            <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">{label}</div>
            <div className="text-sm font-semibold text-gray-900 mt-0.5 break-words">{value || <span className="text-gray-300 font-normal italic">Not recorded</span>}</div>
            {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
    </div>
);

const SectionHeader = ({ icon: Icon, title, badge, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="mb-3">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-2 px-1 group">
                <div className="flex items-center gap-2">
                    {Icon && <Icon size={14} className="text-gray-400" />}
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</span>
                    {badge}
                </div>
                {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
            </button>
            {open && <div className="mt-1">{children}</div>}
        </div>
    );
};

// ─── PHOTO LIGHTBOX MODAL ─────────────────────────────────────────

const PhotoLightbox = ({ photos, initialIndex = 0, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [rotation, setRotation] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const imageAreaRef = React.useRef(null);
    const photo = photos[currentIndex];
    if (!photo) return null;

    const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
    const prev = () => { setCurrentIndex((i) => (i - 1 + photos.length) % photos.length); setRotation(0); resetView(); };
    const next = () => { setCurrentIndex((i) => (i + 1) % photos.length); setRotation(0); resetView(); };
    const zoomIn = () => setZoom(z => Math.min(z * 1.3, 8));
    const zoomOut = () => { const newZ = Math.max(zoom / 1.3, 1); setZoom(newZ); if (newZ <= 1) setPan({ x: 0, y: 0 }); };
    const zoomReset = () => resetView();

    // Keyboard navigation
    React.useEffect(() => {
        const handler = (e) => {
            if (e.key === 'ArrowLeft') prev();
            else if (e.key === 'ArrowRight') next();
            else if (e.key === 'Escape') onClose();
            else if (e.key === '+' || e.key === '=') zoomIn();
            else if (e.key === '-') zoomOut();
            else if (e.key === '0') zoomReset();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [zoom]);

    // Mouse wheel zoom
    React.useEffect(() => {
        const el = imageAreaRef.current;
        if (!el) return;
        const handleWheel = (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                setZoom(z => Math.min(z * 1.15, 8));
            } else {
                setZoom(z => {
                    const newZ = Math.max(z / 1.15, 1);
                    if (newZ <= 1) setPan({ x: 0, y: 0 });
                    return newZ;
                });
            }
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    // Mouse drag for panning when zoomed
    const handleMouseDown = (e) => {
        if (zoom <= 1) return;
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    };
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setPan({
            x: dragStart.current.panX + (e.clientX - dragStart.current.x),
            y: dragStart.current.panY + (e.clientY - dragStart.current.y)
        });
    };
    const handleMouseUp = () => setIsDragging(false);

    React.useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging]);

    const zoomPercent = Math.round(zoom * 100);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
            {/* ─── Top Toolbar ─── */}
            <div
                className="flex items-center justify-between px-5 py-3 shrink-0"
                style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(12px)',
                }}
            >
                {/* Left: photo info */}
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-white/40 text-sm font-mono">{currentIndex + 1}/{photos.length}</span>
                    <div className="min-w-0">
                        <div className="text-white text-sm font-medium truncate">{photo.categoryLabel || 'Photo'}</div>
                        <div className="text-white/40 text-xs truncate">{photo.filename}</div>
                    </div>
                </div>

                {/* Center: zoom controls */}
                <div className="flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '2px 4px' }}>
                    <button
                        onClick={zoomOut}
                        className="text-white/60 hover:text-white hover:bg-white/10 p-1.5 rounded-md transition-all"
                        title="Zoom out (−)"
                        disabled={zoom <= 1}
                        style={{ opacity: zoom <= 1 ? 0.3 : 1 }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                    </button>
                    <button
                        onClick={zoomReset}
                        className="text-white/50 hover:text-white text-xs font-mono px-2 py-1 rounded-md hover:bg-white/10 transition-all min-w-[48px] text-center"
                        title="Reset zoom (0)"
                    >
                        {zoomPercent}%
                    </button>
                    <button
                        onClick={zoomIn}
                        className="text-white/60 hover:text-white hover:bg-white/10 p-1.5 rounded-md transition-all"
                        title="Zoom in (+)"
                        disabled={zoom >= 8}
                        style={{ opacity: zoom >= 8 ? 0.3 : 1 }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                    </button>
                </div>

                {/* Right: controls */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setRotation(r => r - 90)}
                        className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                        title="Rotate left"
                    >
                        <RotateCcw size={18} />
                    </button>
                    <button
                        onClick={() => setRotation(r => r + 90)}
                        className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                        title="Rotate right"
                    >
                        <RotateCw size={18} />
                    </button>
                    <a
                        href={proxyUrl(photo.download_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                        title="Open original"
                    >
                        <ExternalLink size={18} />
                    </a>
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <button
                        onClick={onClose}
                        className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                        title="Close (Esc)"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* ─── Image Area ─── */}
            <div
                ref={imageAreaRef}
                className="flex-1 relative flex items-center justify-center min-h-0 overflow-hidden"
                onClick={(e) => { if (zoom <= 1) onClose(); }}
                onDoubleClick={(e) => { e.stopPropagation(); if (zoom > 1) resetView(); else setZoom(2); }}
                style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
                {/* Side navigation arrows */}
                {photos.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); prev(); }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-full transition-all"
                            style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        >
                            <ChevronLeft size={22} className="text-white/80" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); next(); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-full transition-all"
                            style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        >
                            <ChevronRightIcon size={22} className="text-white/80" />
                        </button>
                    </>
                )}

                {/* Main image */}
                <img
                    src={proxyUrl(photo.download_large || photo.download_url)}
                    alt={photo.categoryLabel || photo.filename}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={handleMouseDown}
                    className="max-w-full max-h-full object-contain select-none"
                    style={{
                        transform: `rotate(${rotation}deg) scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                        padding: '16px',
                        cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                    }}
                    draggable={false}
                />
            </div>

            {/* ─── Bottom Thumbnail Strip ─── */}
            {photos.length > 1 && (
                <div
                    className="shrink-0 flex justify-center gap-2 py-3 px-4 overflow-x-auto"
                    style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    {photos.map((p, i) => (
                        <button
                            key={i}
                            onClick={() => { setCurrentIndex(i); setRotation(0); }}
                            className="flex-shrink-0 rounded-lg overflow-hidden transition-all duration-200"
                            style={{
                                width: 56, height: 56,
                                border: i === currentIndex ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
                                opacity: i === currentIndex ? 1 : 0.45,
                                transform: i === currentIndex ? 'scale(1.08)' : 'scale(1)',
                                boxShadow: i === currentIndex ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
                            }}
                            onMouseEnter={e => { if (i !== currentIndex) e.currentTarget.style.opacity = '0.75'; }}
                            onMouseLeave={e => { if (i !== currentIndex) e.currentTarget.style.opacity = '0.45'; }}
                        >
                            <img
                                src={proxyUrl(p.download_small || p.download_medium || p.download_url)}
                                alt=""
                                className="w-full h-full object-cover"
                                draggable={false}
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── PHOTO GALLERY ────────────────────────────────────────────────

const PHOTO_ORDER = ['north', 'south', 'east', 'west', 'soil', 'sample', 'site_photo', 'other'];

const CATEGORY_ICONS = {
    north: '⬆️', south: '⬇️', east: '➡️', west: '⬅️',
    soil: '🌍', sample: '🧪', site_photo: '📷', other: '📎'
};

// Categories to exclude from photo gallery
const HIDDEN_CATEGORIES = ['participant_signature', 'surveyor_signature', 'signature'];

const PhotoGallery = ({ attachments }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const photos = (attachments || []).filter(a => a.mimetype?.startsWith('image') && !HIDDEN_CATEGORIES.includes(a.category));
    const others = (attachments || []).filter(a => !a.mimetype?.startsWith('image'));

    // Sort photos by category order
    const sortedPhotos = [...photos].sort((a, b) => {
        const ai = PHOTO_ORDER.indexOf(a.category || 'other');
        const bi = PHOTO_ORDER.indexOf(b.category || 'other');
        return ai - bi;
    });

    // Group by category
    const grouped = {};
    sortedPhotos.forEach(p => {
        const cat = p.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    if (sortedPhotos.length === 0 && others.length === 0) {
        return <p className="text-xs text-gray-400 italic p-2">No attachments available</p>;
    }

    return (
        <div className="space-y-3">
            {/* Directional Photos Grid */}
            {Object.keys(grouped).some(k => ['north', 'south', 'east', 'west'].includes(k)) && (
                <div>
                    <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Compass size={12} /> Directional Photos
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {['north', 'east', 'south', 'west'].map(d => {
                            const rotation = { north: 0, east: 90, south: 180, west: 270 }[d];
                            const photo = grouped[d]?.[0];
                            const CompassBadge = () => (
                                <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full pl-1 pr-2 py-0.5">
                                    <svg viewBox="0 0 20 20" className="w-4 h-4" style={{ transform: `rotate(${rotation}deg)` }}>
                                        <polygon points="10,2 7,12 13,12" fill="#ef4444" />
                                        <polygon points="10,18 7,12 13,12" fill="#ffffff80" />
                                        <circle cx="10" cy="12" r="1.5" fill="white" />
                                    </svg>
                                    <span className="text-white text-[9px] font-bold uppercase tracking-widest">{d}</span>
                                </div>
                            );
                            if (!photo) return (
                                <div key={d} className="relative aspect-square rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-1 opacity-40">
                                        <svg viewBox="0 0 20 20" className="w-5 h-5" style={{ transform: `rotate(${rotation}deg)` }}>
                                            <polygon points="10,2 7,12 13,12" fill="#9ca3af" />
                                            <polygon points="10,18 7,12 13,12" fill="#d1d5db" />
                                        </svg>
                                        <span className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">{d}</span>
                                    </div>
                                </div>
                            );
                            const globalIdx = sortedPhotos.indexOf(photo);
                            return (
                                <button key={d}
                                    onClick={() => { setLightboxIndex(globalIdx); setLightboxOpen(true); }}
                                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
                                >
                                    <img src={proxyUrl(photo.download_small || photo.download_medium || photo.download_url)}
                                        alt={`${d} view`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
                                    <CompassBadge />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Other Photos */}
            {Object.entries(grouped).filter(([k]) => !['north', 'south', 'east', 'west'].includes(k)).map(([cat, items]) => (
                <div key={cat}>
                    <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-2">
                        {CATEGORY_ICONS[cat] || '📎'} {items[0]?.categoryLabel || cat}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {items.map((photo, i) => {
                            const globalIdx = sortedPhotos.indexOf(photo);
                            return (
                                <button
                                    key={i}
                                    onClick={() => { setLightboxIndex(globalIdx); setLightboxOpen(true); }}
                                    className="relative aspect-square rounded overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow transition-all group cursor-pointer"
                                >
                                    <img
                                        src={proxyUrl(photo.download_small || photo.download_medium || photo.download_url)}
                                        alt={photo.categoryLabel}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Non-image Attachments */}
            {others.length > 0 && (
                <div>
                    <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-2">📎 Files</div>
                    <div className="space-y-1">
                        {others.map((att, i) => (
                            <a key={i} href={proxyUrl(att.download_url)} target="_blank" rel="noreferrer"
                                className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-all text-xs text-gray-600 hover:text-blue-700"
                            >
                                <FileText size={14} className="flex-shrink-0" />
                                <span className="truncate">{att.filename || `File ${i + 1}`}</span>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightboxOpen && (
                <PhotoLightbox
                    photos={sortedPhotos}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </div>
    );
};

// ─── KOBO VIEW ────────────────────────────────────────────────────

const KoboFieldDataView = ({ sample, meta, rawMeta }) => {
    const get = (key) => meta?.[key]?.value;
    const lat = get('latitude');
    const lng = get('longitude');
    const hasCoords = lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng));
    // Support both processed attachments (from resync/new sync) and raw Kobo _attachments (legacy)
    const rawAttachments = get('attachments') || rawMeta?.attachments || [];
    // Normalize raw Kobo _attachments if used as fallback (different field names)
    const attachments = rawAttachments.length > 0 ? rawAttachments : (rawMeta?._attachments || []).map(a => ({
        filename: a.filename?.split('/').pop() || a.filename,
        category: 'other',
        categoryLabel: '📎 Other',
        download_url: a.download_url,
        download_small: a.download_small_url,
        download_medium: a.download_medium_url,
        download_large: a.download_large_url,
        mimetype: a.mimetype
    }));

    return (
        <div className="space-y-4">
            {/* Key Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <InfoCard icon={MapPin} iconColor="bg-red-50 text-red-500" label="GPS Coordinates"
                    value={hasCoords ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : null}
                    subtitle={hasCoords ? 'From Kobo GPS' : null}
                />
                <InfoCard icon={User} iconColor="bg-indigo-50 text-indigo-500" label="Surveyor"
                    value={get('surveyor') || rawMeta?.surveyor}
                />
                <InfoCard icon={Calendar} iconColor="bg-amber-50 text-amber-600" label="Collection Date"
                    value={get('collectionDate') ? new Date(get('collectionDate')).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : null}
                />
                <InfoCard icon={Globe} iconColor="bg-emerald-50 text-emerald-600" label="Province / Region"
                    value={get('province') || rawMeta?.province}
                />
            </div>

            {/* Site + Sampling | Photos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionHeader icon={Layers} title="Site & Sampling" defaultOpen={true}>
                    <div className="grid grid-cols-2 gap-2">
                        <InfoCard icon={null} label="Site ID" value={get('site_id') || rawMeta?.site_id} />
                        <InfoCard icon={null} label="Depth" value={get('depth')} />
                        <InfoCard icon={null} label="Land Cover" value={get('land_cover') || rawMeta?.land_cover} />
                        <InfoCard icon={null} label="Accessibility" value={rawMeta?.accessibility} />
                        <InfoCard icon={null} label="Sampling" value={rawMeta?.sampling_succeeded === 'yes' ? '✅ Succeeded' : rawMeta?.sampling_succeeded} />
                        <InfoCard icon={null} label="Kobo ID" value={rawMeta?.kobo_id || get('kobo_submission_id')} />
                    </div>
                </SectionHeader>

                <SectionHeader icon={Camera} title={`Photos & Attachments (${attachments.length})`} defaultOpen={true}>
                    <PhotoGallery attachments={attachments} />
                </SectionHeader>
            </div>

            {/* Source Footer */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <Cloud size={12} className="text-emerald-500" />
                <span className="text-[11px] text-gray-400">Data synced from KoboToolbox</span>
                {rawMeta?.submission_time && (
                    <span className="text-[11px] text-gray-300 ml-auto">Submitted: {new Date(rawMeta.submission_time).toLocaleDateString()}</span>
                )}
            </div>
        </div>
    );
};

// ─── WALK-IN / MANUAL VIEW ─────────────────────────────────────────

const ManualFieldDataView = ({ sample, meta }) => {
    const get = (key) => meta?.[key]?.value;
    const getSource = (key) => meta?.[key]?.source;

    const Row = ({ label, value, source }) => (
        <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 px-2 hover:bg-gray-50 rounded transition-colors">
            <span className="text-sm text-gray-500 font-medium">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900 font-medium">{value || <span className="text-gray-300 italic font-normal">—</span>}</span>
                {source && <Badge text={source === 'WALK_IN_INTAKE' ? 'Intake' : source === 'MANUAL_EDIT' ? 'Edited' : source} color={source === 'WALK_IN_INTAKE' ? 'blue' : 'orange'} />}
            </div>
        </div>
    );

    const lat = get('latitude');
    const lng = get('longitude');
    const coords = (lat && lng) ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : null;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <SectionHeader icon={FileText} title="Identification">
                        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                            <Row label="Project Code" value={get('projectCode') || sample.projectCode} />
                            <Row label="Site Name" value={get('siteName')} source={getSource('siteName')} />
                            <Row label="Collector" value={get('surveyor')} source={getSource('surveyor')} />
                            <Row label="Organization" value={get('organization')} source={getSource('organization')} />
                            <Row label="Submitter" value={get('submitterName')} source={getSource('submitterName')} />
                            <Row label="Contact" value={get('submitterPhone') || get('submitterEmail')} source={getSource('submitterPhone')} />
                        </div>
                    </SectionHeader>
                    <SectionHeader icon={MapPin} title="Location">
                        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                            <Row label="Coordinates" value={coords} source={getSource('latitude')} />
                            <Row label="Elevation" value={get('elevation')} source={getSource('elevation')} />
                            <Row label="Region" value={get('admin1')} source={getSource('admin1')} />
                            <Row label="District" value={get('admin2')} source={getSource('admin2')} />
                            <Row label="Description" value={get('locationDescription')} source={getSource('locationDescription')} />
                        </div>
                    </SectionHeader>
                </div>
                <div className="space-y-3">
                    <SectionHeader icon={Layers} title="Sampling">
                        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                            <Row label="Collection Date" value={get('collectionDate')} source={getSource('collectionDate')} />
                            <Row label="Depth Range" value={get('depthType')} source={getSource('depthType')} />
                            <Row label="Top Depth" value={get('depthTop')} source={getSource('depthTop')} />
                            <Row label="Bottom Depth" value={get('depthBottom')} source={getSource('depthBottom')} />
                            <Row label="Composite" value={get('isComposite')} source={getSource('isComposite')} />
                            <Row label="Purpose" value={get('samplingPurpose')} source={getSource('samplingPurpose')} />
                        </div>
                    </SectionHeader>
                    <SectionHeader icon={Leaf} title="Land Use">
                        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                            <Row label="Land Use" value={get('landUse')} source={getSource('landUse')} />
                            <Row label="Current Crop" value={get('crop')} source={getSource('crop')} />
                            <Row label="Previous Crop" value={get('previousCrop')} source={getSource('previousCrop')} />
                            <Row label="Management" value={get('managementPractices')} source={getSource('managementPractices')} />
                            <Row label="Fertilizer" value={get('fertilizer')} source={getSource('fertilizer')} />
                        </div>
                    </SectionHeader>
                </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <Edit2 size={12} className="text-blue-500" />
                <span className="text-[11px] text-gray-400">Data entered manually via intake form</span>
            </div>
        </div>
    );
};

// ─── PENDING SYNC VIEW ────────────────────────────────────────────

const PendingSyncView = ({ sample, onSynced }) => {
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);

    const handleSync = async () => {
        setSyncing(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/kobo/sync-sample/${sample.id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                // Reload the page to show synced data
                if (onSynced) onSynced();
                else window.location.reload();
            } else {
                setError(data.message || 'Sample not found in Kobo submissions');
            }
        } catch (e) {
            setError(e.message || 'Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                <div className="text-3xl mb-2">🔄</div>
                <h3 className="text-base font-bold text-amber-800 mb-1">Field Data Pending Sync</h3>
                <p className="text-sm text-amber-600">This sample was collected via KoboToolbox but the field data hasn't been synced yet.</p>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                    {syncing ? (
                        <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Syncing from Kobo...</>
                    ) : (
                        <><Cloud size={16} /> Sync Now</>
                    )}
                </button>
                {error && <p className="text-xs text-red-600 mt-2">⚠ {error}</p>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoCard icon={Globe} iconColor="bg-gray-100 text-gray-400" label="Project" value={sample.projectCode} />
                <InfoCard icon={MapPin} iconColor="bg-gray-100 text-gray-400" label="GPS" value={null} />
                <InfoCard icon={User} iconColor="bg-gray-100 text-gray-400" label="Surveyor" value={null} />
                <InfoCard icon={Calendar} iconColor="bg-gray-100 text-gray-400" label="Collection Date" value={null} />
            </div>
        </div>
    );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────

const FieldMetadataCard = ({ sample, canEdit, onUpdateMetadata }) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    let meta = sample.fieldMetadata || {};
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }

    let rawMeta = sample.metadata || {};
    if (typeof rawMeta === 'string') { try { rawMeta = JSON.parse(rawMeta); } catch { rawMeta = {}; } }

    // 3-state detection
    const hasKoboData = !!(rawMeta?.kobo_id || rawMeta?.kobo_uuid || meta?.kobo_submission_id?.value || (rawMeta?.attachments?.length > 0));
    const hasKoboConnection = sample.hasKoboConnection;
    // State: 'synced' | 'pending' | 'manual'
    const dataSource = hasKoboData ? 'synced' : (hasKoboConnection ? 'pending' : 'manual');

    const badges = {
        synced: <Badge text="Kobo Synced" color="green" />,
        pending: <Badge text="Pending Sync" color="orange" />,
        manual: <Badge text="Manual Entry" color="blue" />
    };

    return (
        <div className="relative">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-800">Field Data</h2>
                    {badges[dataSource]}
                </div>
                {canEdit && dataSource !== 'pending' && (
                    <button onClick={() => setIsEditModalOpen(true)}
                        className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-semibold">
                        <Edit2 size={16} /> Edit Details
                    </button>
                )}
            </div>

            {dataSource === 'synced' && <KoboFieldDataView sample={sample} meta={meta} rawMeta={rawMeta} />}
            {dataSource === 'pending' && <PendingSyncView sample={sample} />}
            {dataSource === 'manual' && <ManualFieldDataView sample={sample} meta={meta} />}

            {canEdit && (
                <MetadataEditorModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} sample={sample}
                    onSave={(data) => { onUpdateMetadata(data); setIsEditModalOpen(false); }} />
            )}
        </div>
    );
};

export default FieldMetadataCard;
