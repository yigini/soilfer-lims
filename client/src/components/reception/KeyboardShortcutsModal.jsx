import React, { useEffect } from 'react';
import { X, Keyboard, Zap, Printer, CheckCircle, ArrowRight, CornerDownLeft } from 'lucide-react';

const KeyboardShortcutsModal = ({ isOpen, onClose }) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const shortcuts = [
        {
            category: 'Desk Navigation & Modes',
            items: [
                { keys: ['Alt', '1'], label: 'Switch to Project Sample Intake' },
                { keys: ['Alt', '2'], label: 'Switch to Walk-in Sample Intake' },
                { keys: ['Alt', '3'], label: 'Switch to Consignment Batch Mode' },
                { keys: ['Escape'], label: 'Close Active Modal / Back to Desk' },
            ]
        },
        {
            category: 'Hardware Wedge Scanner',
            items: [
                { keys: ['Alt', 'W'], label: 'Toggle Wedge Fast Mode ON / OFF' },
                { keys: ['Enter'], label: 'Submit Barcode Scan (Zero Latency in Fast Mode)' },
                { keys: ['Tab'], label: 'Submit Barcode Scan (if Suffix set to Tab/Both)' },
            ]
        },
        {
            category: 'Sample Intake & Labels',
            items: [
                { keys: ['Ctrl', 'Enter'], label: 'Complete Intake / Submit Consignment' },
                { keys: ['Ctrl', 'P'], label: 'Open Label Print Dialog' },
                { keys: ['?'], label: 'Show / Hide this Keyboard Shortcuts modal' },
            ]
        }
    ];

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-sf-divider">
                {/* Header */}
                <div className="p-4 border-b border-sf-divider flex justify-between items-center bg-sf-canvas/50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <Keyboard size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sf-text text-sm">
                                Reception Desk Keyboard Shortcuts
                            </h3>
                            <p className="text-[11px] text-sf-muted">
                                High-throughput ergonomic key combinations
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-sf-hover rounded-full transition-colors text-sf-muted hover:text-sf-text"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Shortcuts List */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {shortcuts.map((section, sIdx) => (
                        <div key={sIdx} className="space-y-2.5">
                            <h4 className="text-[11px] font-bold text-sf-muted uppercase tracking-wider">
                                {section.category}
                            </h4>
                            <div className="space-y-1.5">
                                {section.items.map((item, iIdx) => (
                                    <div
                                        key={iIdx}
                                        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-sf-hover/60 text-xs"
                                    >
                                        <span className="text-sf-text font-medium">
                                            {item.label}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {item.keys.map((k, kIdx) => (
                                                <React.Fragment key={kIdx}>
                                                    <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-sf-canvas border border-sf-divider text-sf-text rounded shadow-sm">
                                                        {k}
                                                    </kbd>
                                                    {kIdx < item.keys.length - 1 && (
                                                        <span className="text-sf-muted text-[10px]">+</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-sf-divider bg-sf-canvas/30 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-sf-raised hover:bg-sf-hover text-sf-text border border-sf-divider rounded-lg text-xs font-bold transition-all"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcutsModal;
