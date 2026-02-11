import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
    Globe, MapPin, FlaskConical, Layers, Eye, EyeOff, RefreshCw,
    Search, Filter, X, ChevronDown, Maximize, ArrowLeft, AlertTriangle,
    Activity, Info
} from 'lucide-react';

// ─── Load Cesium CDN dynamically ───
const loadCesium = (token) => {
    return new Promise((resolve, reject) => {
        if (window.Cesium) {
            window.Cesium.Ion.defaultAccessToken = token;
            return resolve(window.Cesium);
        }

        // Load CSS
        if (!document.getElementById('cesium-css')) {
            const link = document.createElement('link');
            link.id = 'cesium-css';
            link.rel = 'stylesheet';
            link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/Widgets/widgets.css';
            document.head.appendChild(link);
        }

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/Cesium.js';
        script.onload = () => {
            if (window.Cesium) {
                window.Cesium.Ion.defaultAccessToken = token;
                resolve(window.Cesium);
            } else {
                reject(new Error('CesiumJS failed to initialize'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load CesiumJS from CDN'));
        document.head.appendChild(script);
    });
};

// ─── Status color mapping ───
const STATUS_COLORS = {
    'RECEIVED': { pin: '#3b82f6', label: 'Received' },
    'IN_PROGRESS': { pin: '#f59e0b', label: 'In Progress' },
    'COMPLETED': { pin: '#10b981', label: 'Completed' },
    'APPROVED': { pin: '#6366f1', label: 'Approved' },
    'ARCHIVED': { pin: '#6b7280', label: 'Archived' },
    'EXPECTED': { pin: '#a855f7', label: 'Expected' },
    'DRAFT': { pin: '#f97316', label: 'Draft' },
    'DISPOSED': { pin: '#ef4444', label: 'Disposed' },
};

const getStatusColor = (status) => STATUS_COLORS[status]?.pin || '#94a3b8';

// ─── Main Component ───
const CesiumGlobe = () => {
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    const [cesiumReady, setCesiumReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [samples, setSamples] = useState([]);
    const [cesiumToken, setCesiumToken] = useState(null);
    const [selectedSample, setSelectedSample] = useState(null);
    const [stats, setStats] = useState({ total: 0, withGps: 0, countries: 0 });
    const [filterProject, setFilterProject] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [projects, setProjects] = useState([]);
    const [showLegend, setShowLegend] = useState(true);

    // 1. Fetch Cesium token from settings
    useEffect(() => {
        const fetchToken = async () => {
            try {
                const res = await axios.get('/api/admin/settings');
                const token = res.data?.branding?.cesiumToken;
                if (token) {
                    setCesiumToken(token);
                } else {
                    setError('No Cesium token configured. Go to Admin → Branding → Integrations to add your Cesium Ion token.');
                    setLoading(false);
                }
            } catch (e) {
                setError('Failed to load settings');
                setLoading(false);
            }
        };
        fetchToken();
    }, []);

    // 2. Fetch sample locations
    const fetchLocations = useCallback(async () => {
        try {
            const params = {};
            if (filterProject) params.project = filterProject;
            if (filterStatus) params.status = filterStatus;
            const res = await axios.get('/api/samples/locations', { params });
            const data = res.data || [];
            setSamples(data);

            const countries = new Set(data.map(s => s.country).filter(Boolean));
            setStats({
                total: data.length,
                withGps: data.filter(s => s.lat && s.lng).length,
                countries: countries.size
            });

            // Get unique projects
            const pSet = new Set(data.map(s => s.projectCode).filter(Boolean));
            setProjects([...pSet].sort());
        } catch (e) {
            console.error('Locations fetch failed:', e);
        }
    }, [filterProject, filterStatus]);

    useEffect(() => { fetchLocations(); }, [fetchLocations]);

    // 3. Initialize Cesium viewer
    useEffect(() => {
        if (!cesiumToken || !containerRef.current) return;

        let viewer = null;
        const init = async () => {
            try {
                const Cesium = await loadCesium(cesiumToken);

                viewer = new Cesium.Viewer(containerRef.current, {
                    terrainProvider: await Cesium.createWorldTerrainAsync(),
                    baseLayerPicker: false,
                    geocoder: false,
                    homeButton: false,
                    sceneModePicker: true,
                    selectionIndicator: false,
                    infoBox: false,
                    timeline: false,
                    animation: false,
                    navigationHelpButton: false,
                    fullscreenButton: false,
                    creditContainer: document.createElement('div'), // Hide credits
                    skyBox: false,
                    skyAtmosphere: new Cesium.SkyAtmosphere(),
                    scene3DOnly: false,
                    shadows: false,
                    imageryProvider: false
                });

                // Add Cesium World Imagery
                try {
                    const imagery = await Cesium.IonImageryProvider.fromAssetId(2);
                    viewer.imageryLayers.addImageryProvider(imagery);
                } catch (imgErr) {
                    console.warn('Falling back to default imagery:', imgErr);
                }

                // Dark atmosphere styling
                viewer.scene.globe.enableLighting = true;
                viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0f172a');

                viewerRef.current = viewer;
                setCesiumReady(true);
                setLoading(false);
            } catch (e) {
                console.error('Cesium init error:', e);
                setError(`Failed to initialize 3D Globe: ${e.message}`);
                setLoading(false);
            }
        };

        init();

        return () => {
            if (viewer && !viewer.isDestroyed()) {
                viewer.destroy();
            }
            viewerRef.current = null;
        };
    }, [cesiumToken]);

    // 4. Plot sample pins
    useEffect(() => {
        if (!cesiumReady || !viewerRef.current) return;
        const viewer = viewerRef.current;
        const Cesium = window.Cesium;

        viewer.entities.removeAll();

        const gpsPoints = samples.filter(s => s.lat && s.lng);
        if (gpsPoints.length === 0) return;

        gpsPoints.forEach(sample => {
            const color = Cesium.Color.fromCssColorString(getStatusColor(sample.status));

            viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(sample.lng, sample.lat, 50),
                point: {
                    pixelSize: 10,
                    color: color,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                },
                label: {
                    text: sample.originalId || sample.id,
                    font: '11px Inter, sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -14),
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 50000, 0.3),
                    translucencyByDistance: new Cesium.NearFarScalar(500, 1.0, 100000, 0.0)
                },
                properties: {
                    sampleId: sample.id,
                    originalId: sample.originalId,
                    projectCode: sample.projectCode,
                    status: sample.status,
                    location: sample.location,
                    country: sample.country
                }
            });
        });

        // Click handler
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click) => {
            const picked = viewer.scene.pick(click.position);
            if (Cesium.defined(picked) && picked.id && picked.id.properties) {
                const props = picked.id.properties;
                setSelectedSample({
                    id: props.sampleId?.getValue(),
                    originalId: props.originalId?.getValue(),
                    projectCode: props.projectCode?.getValue(),
                    status: props.status?.getValue(),
                    location: props.location?.getValue(),
                    country: props.country?.getValue()
                });
            } else {
                setSelectedSample(null);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Fly to fit
        viewer.zoomTo(viewer.entities, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 0));

        return () => handler.destroy();
    }, [cesiumReady, samples]);

    // ─── Error state ───
    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="text-center p-8 max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                        <AlertTriangle size={40} className="text-amber-500" />
                    </div>
                    <h2 className="text-xl font-black text-white mb-3">Globe Unavailable</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">{error}</p>
                    <a href="/admin"
                        className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition">
                        <ArrowLeft size={14} /> Go to Admin
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen bg-slate-950 overflow-hidden">
            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950">
                    <div className="relative">
                        <Globe size={64} className="text-blue-500 animate-pulse" />
                        <div className="absolute inset-0 animate-spin">
                            <div className="w-2 h-2 bg-blue-400 rounded-full absolute top-0 left-1/2 -translate-x-1/2" />
                        </div>
                    </div>
                    <p className="mt-6 text-white font-black text-sm uppercase tracking-widest">Initializing 3D Globe</p>
                    <p className="mt-2 text-gray-500 text-xs">Loading Cesium terrain and imagery…</p>
                </div>
            )}

            {/* Cesium container */}
            <div ref={containerRef} className="w-full h-full" />

            {/* Top-left stats bar */}
            {cesiumReady && (
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                        <Globe size={16} className="text-blue-400" />
                        <span className="text-white font-black text-xs uppercase tracking-widest">
                            Sample Globe
                        </span>
                        <div className="w-px h-4 bg-white/20" />
                        <div className="flex gap-3">
                            <span className="text-[10px] text-gray-400"><span className="text-white font-bold">{stats.withGps}</span> GPS points</span>
                            <span className="text-[10px] text-gray-400"><span className="text-white font-bold">{stats.countries}</span> countries</span>
                            <span className="text-[10px] text-gray-400"><span className="text-white font-bold">{stats.total}</span> total samples</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Top-right controls */}
            {cesiumReady && (
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    {/* Project filter */}
                    <select
                        value={filterProject}
                        onChange={e => setFilterProject(e.target.value)}
                        className="px-3 py-2 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl text-white text-xs font-medium appearance-none cursor-pointer min-w-[140px]"
                    >
                        <option value="">All Projects</option>
                        {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    {/* Status filter */}
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="px-3 py-2 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl text-white text-xs font-medium appearance-none cursor-pointer min-w-[140px]"
                    >
                        <option value="">All Statuses</option>
                        {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>

                    {/* Refresh */}
                    <button
                        onClick={fetchLocations}
                        className="p-2.5 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl text-white hover:bg-slate-800 transition"
                        title="Refresh Data"
                    >
                        <RefreshCw size={14} />
                    </button>

                    {/* Legend toggle */}
                    <button
                        onClick={() => setShowLegend(!showLegend)}
                        className="p-2.5 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl text-white hover:bg-slate-800 transition"
                        title="Toggle Legend"
                    >
                        {showLegend ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>

                    {/* Back */}
                    <a
                        href="/samples"
                        className="p-2.5 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl text-white hover:bg-slate-800 transition"
                        title="Back to Samples"
                    >
                        <ArrowLeft size={14} />
                    </a>
                </div>
            )}

            {/* Legend */}
            {cesiumReady && showLegend && (
                <div className="absolute bottom-6 left-4 z-20 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Sample Status</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        {Object.entries(STATUS_COLORS).map(([status, config]) => (
                            <div key={status} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: config.pin }} />
                                <span className="text-xs text-gray-300">{config.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Selected sample detail panel */}
            {selectedSample && (
                <div className="absolute bottom-6 right-4 z-20 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl w-80">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-black text-sm flex items-center gap-2">
                            <FlaskConical size={14} className="text-blue-400" />
                            Sample Details
                        </h3>
                        <button onClick={() => setSelectedSample(null)} className="text-gray-500 hover:text-white transition">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">ID</span>
                            <span className="text-xs font-mono text-blue-400">{selectedSample.originalId || selectedSample.id}</span>
                        </div>
                        {selectedSample.projectCode && (
                            <div className="flex justify-between">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Project</span>
                                <span className="text-xs text-white font-medium">{selectedSample.projectCode}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                                style={{ backgroundColor: getStatusColor(selectedSample.status) }}>
                                {STATUS_COLORS[selectedSample.status]?.label || selectedSample.status}
                            </span>
                        </div>
                        {selectedSample.location && (
                            <div className="flex justify-between">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Location</span>
                                <span className="text-xs text-gray-300">{selectedSample.location}</span>
                            </div>
                        )}
                        {selectedSample.country && (
                            <div className="flex justify-between">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Country</span>
                                <span className="text-xs text-gray-300">{selectedSample.country}</span>
                            </div>
                        )}
                    </div>
                    <a
                        href={`/samples/${selectedSample.id}`}
                        className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition"
                    >
                        <Info size={12} /> View Full Detail
                    </a>
                </div>
            )}
        </div>
    );
};

export default CesiumGlobe;
