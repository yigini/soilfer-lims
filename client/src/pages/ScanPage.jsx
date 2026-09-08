import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    QrCode,
    Camera,
    CameraOff,
    Search,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    TestTube2,
    Beaker,
    Package
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getOfflineSample } from '../services/offline/offlineDb';
import clsx from 'clsx';

export default function ScanPage() {
    const { t } = useLanguage();
    const navigate = useNavigate();

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [manualCode, setManualCode] = useState('');
    const [scannedResult, setScannedResult] = useState(null);
    const [searching, setSearching] = useState(false);

    // Initialize camera stream
    useEffect(() => {
        let active = true;

        async function startCamera() {
            setCameraError(null);
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Camera access is not supported in this browser.');
                }
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                if (!active) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                    setCameraActive(true);
                }
            } catch (err) {
                console.warn('[CAMERA_INIT_ERROR]', err.message);
                if (active) {
                    setCameraError(err.name === 'NotAllowedError'
                        ? 'Camera permission denied. Please allow camera access or use manual entry below.'
                        : 'Could not activate camera. Please use manual entry.');
                    setCameraActive(false);
                }
            }
        }

        startCamera();

        return () => {
            active = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Frame scanning loop if BarcodeDetector is available
    useEffect(() => {
        if (!cameraActive || !window.BarcodeDetector) return;

        let intervalId = null;
        try {
            const detector = new window.BarcodeDetector({
                formats: ['qr_code', 'code_128', 'code_39', 'ean_13']
            });

            intervalId = setInterval(async () => {
                if (videoRef.current && videoRef.current.readyState >= 2 && !scannedResult) {
                    try {
                        const barcodes = await detector.detect(videoRef.current);
                        if (barcodes && barcodes.length > 0) {
                            const rawValue = barcodes[0].rawValue;
                            handleCodeIdentified(rawValue);
                        }
                    } catch (e) {
                        // ignore frame detect error
                    }
                }
            }, 500);
        } catch (e) {
            console.warn('[BARCODE_DETECTOR_UNAVAILABLE]', e);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [cameraActive, scannedResult]);

    // Parse and resolve scanned string
    const handleCodeIdentified = async (code) => {
        if (!code || !code.trim()) return;
        const clean = code.trim();

        // Acoustic or tactile feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(100);
        }

        setSearching(true);
        let extractedId = clean;

        // If URL was scanned (e.g. https://lims.yigini.net/samples/SMP-001)
        if (clean.includes('/samples/')) {
            extractedId = clean.split('/samples/')[1].split('?')[0];
        } else if (clean.includes('/workbench?sampleId=')) {
            extractedId = clean.split('sampleId=')[1].split('&')[0];
        }

        // Check local offline DB or server
        let sampleData = null;
        try {
            sampleData = await getOfflineSample(extractedId);
            if (!sampleData) {
                const res = await fetch(`/api/samples/${extractedId}`);
                if (res.ok) {
                    sampleData = await res.json();
                }
            }
        } catch (e) {
            console.warn('[SCAN_LOOKUP_FAIL]', e);
        }

        setScannedResult({
            rawCode: clean,
            sampleId: extractedId,
            sampleData
        });
        setSearching(false);
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        handleCodeIdentified(manualCode);
    };

    const resetScan = () => {
        setScannedResult(null);
        setManualCode('');
    };

    return (
        <div className="max-w-md mx-auto space-y-5 pb-16">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sf-primary/10 text-sf-primary">
                    <QrCode size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-sf-text">Specimen Scanner</h1>
                    <p className="text-xs text-sf-muted">Scan sample QR code or barcode label</p>
                </div>
            </div>

            {/* Viewfinder Card */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square border border-sf-divider shadow-inner flex items-center justify-center">
                {cameraActive ? (
                    <>
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                        {/* Scanning Overlay Reticle */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-56 h-56 border-2 border-dashed border-white/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-emerald-400/70 shadow-[0_0_8px_#34d399] animate-pulse" />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-6 text-center text-sf-muted space-y-3">
                        <CameraOff size={40} className="mx-auto text-sf-control" />
                        <p className="text-xs text-stone-300 font-medium">
                            {cameraError || 'Camera viewfinder idle'}
                        </p>
                    </div>
                )}
            </div>

            {/* Scanned Result Card */}
            {scannedResult && (
                <div className="p-4 rounded-2xl border border-sf-divider bg-sf-surface shadow-md space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                            Specimen Recognized
                        </span>
                        <button
                            onClick={resetScan}
                            className="text-xs text-sf-primary hover:underline font-bold"
                        >
                            Scan Another
                        </button>
                    </div>

                    <div className="p-3 rounded-xl bg-sf-inset border border-sf-divider flex items-center justify-between">
                        <div>
                            <div className="text-xs text-sf-muted">Sample Identifier</div>
                            <div className="text-base font-mono font-bold text-sf-text">
                                {scannedResult.sampleId}
                            </div>
                        </div>
                        <CheckCircle2 size={20} className="text-emerald-500" />
                    </div>

                    {/* Quick action buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                            onClick={() => navigate(`/samples/${scannedResult.sampleId}`)}
                            className="flex items-center justify-center gap-2 p-3 rounded-xl border border-sf-divider bg-sf-surface hover:bg-sf-hover text-xs font-bold text-sf-text transition-colors"
                        >
                            <TestTube2 size={16} className="text-sf-primary" />
                            <span>Sample Details</span>
                        </button>
                        <button
                            onClick={() => navigate(`/workbench?sampleId=${scannedResult.sampleId}`)}
                            className="btn-primary flex items-center justify-center gap-2 p-3 text-xs font-bold"
                        >
                            <Beaker size={16} />
                            <span>Workbench</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Manual Entry Fallback */}
            <form onSubmit={handleManualSubmit} className="p-4 rounded-2xl border border-sf-divider bg-sf-surface space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-sf-muted">
                    Manual Barcode / Identifier Entry
                </label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="e.g. W001 or LAB-2026-001"
                            className="input-base w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-mono"
                        />
                        <Search size={16} className="absolute left-3 top-3 text-sf-muted" />
                    </div>
                    <button
                        type="submit"
                        disabled={!manualCode.trim() || searching}
                        className="btn-primary px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <span>Lookup</span>
                        <ArrowRight size={14} />
                    </button>
                </div>
            </form>
        </div>
    );
}
