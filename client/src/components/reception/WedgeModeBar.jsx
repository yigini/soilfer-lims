import React from 'react';
import { Zap, Volume2, VolumeX, Keyboard, HelpCircle, Settings, Check } from 'lucide-react';
import { isAudioEnabled, setAudioEnabled, playNoticeChime } from '../../utils/audioCues';

const WedgeModeBar = ({
    isWedgeMode,
    onToggleWedgeMode,
    wedgeSuffix,
    onChangeSuffix,
    soundEnabled,
    onToggleSound,
    onOpenShortcuts,
    autoRefocus,
    onToggleAutoRefocus
}) => {
    return (
        <div className="bg-sf-raised text-sf-text px-4 py-2.5 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3 mb-6 transition-all border border-sf-divider">
            {/* Left: Mode Status & Toggle */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => {
                        onToggleWedgeMode(!isWedgeMode);
                        playNoticeChime();
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                        isWedgeMode
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/40'
                            : 'bg-sf-surface hover:bg-sf-canvas text-sf-muted border border-sf-divider'
                    }`}
                    title="Toggle Wedge Scanner Fast Intake Mode (Shortcut: Alt+W)"
                >
                    <Zap size={14} className={isWedgeMode ? 'fill-current animate-pulse' : ''} />
                    <span>Wedge Fast Mode</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">Alt+W</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 text-xs">
                    {isWedgeMode ? (
                        <span className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                            Hardware Scanner Active (0ms Latency)
                        </span>
                    ) : (
                        <span className="text-sf-muted">Standard Desk Typing Mode</span>
                    )}
                </div>
            </div>

            {/* Right: Hardware Settings & Shortcuts */}
            <div className="flex items-center gap-2 text-xs">
                {/* Suffix Configuration */}
                <div className="flex items-center gap-1.5 bg-sf-surface px-2.5 py-1 rounded-xl border border-sf-divider">
                    <span className="text-sf-muted text-[11px] font-medium">Suffix:</span>
                    <select
                        value={wedgeSuffix}
                        onChange={(e) => onChangeSuffix(e.target.value)}
                        className="bg-transparent text-sf-text font-mono text-xs focus:outline-none cursor-pointer"
                        title="Configured terminator character emitted by your barcode scanner"
                    >
                        <option value="ENTER" className="bg-sf-surface text-sf-text">Enter (\n)</option>
                        <option value="TAB" className="bg-sf-surface text-sf-text">Tab (\t)</option>
                        <option value="BOTH" className="bg-sf-surface text-sf-text">Enter or Tab</option>
                    </select>
                </div>

                {/* Auto Refocus Toggle */}
                {isWedgeMode && (
                    <button
                        type="button"
                        onClick={() => onToggleAutoRefocus(!autoRefocus)}
                        className={`px-2.5 py-1 rounded-xl border transition-all text-xs flex items-center gap-1.5 ${
                            autoRefocus
                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-600 dark:text-indigo-300'
                                : 'bg-sf-surface border-sf-divider text-sf-muted hover:text-sf-text'
                        }`}
                        title="Auto-anchor keyboard focus to barcode scan input"
                    >
                        <span>Refocus</span>
                        <span className="text-[10px] font-bold uppercase">{autoRefocus ? 'ON' : 'OFF'}</span>
                    </button>
                )}

                {/* Audio Cues Toggle */}
                <button
                    type="button"
                    onClick={() => {
                        const next = !soundEnabled;
                        onToggleSound(next);
                        if (next) playNoticeChime();
                    }}
                    className={`p-1.5 rounded-xl border transition-all ${
                        soundEnabled
                            ? 'bg-sf-surface border-sf-divider text-emerald-600 dark:text-emerald-400 hover:bg-sf-canvas'
                            : 'bg-sf-surface border-sf-divider text-sf-muted hover:text-sf-text'
                    }`}
                    title={soundEnabled ? 'Audio Feedback Enabled (Click to Mute)' : 'Audio Feedback Muted (Click to Enable)'}
                >
                    {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>

                {/* Keyboard Shortcuts Cheat-sheet Button */}
                <button
                    type="button"
                    onClick={onOpenShortcuts}
                    className="p-1.5 bg-sf-surface hover:bg-sf-canvas border border-sf-divider text-sf-text rounded-xl transition-colors flex items-center gap-1"
                    title="View Keyboard Shortcuts (?)"
                >
                    <Keyboard size={16} />
                    <span className="font-mono text-[10px] font-bold">?</span>
                </button>
            </div>
        </div>
    );
};

export default WedgeModeBar;
