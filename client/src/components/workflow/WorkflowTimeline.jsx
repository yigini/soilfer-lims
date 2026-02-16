import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, Gauge } from 'lucide-react';

const SPEEDS = [1, 2, 5];

export default function WorkflowTimeline({ snapshots, currentIndex, onIndexChange, t }) {
    const [playing, setPlaying] = useState(false);
    const [speedIdx, setSpeedIdx] = useState(0);
    const intervalRef = useRef(null);

    const speed = SPEEDS[speedIdx];
    const total = snapshots?.length || 0;

    const stop = useCallback(() => {
        setPlaying(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const play = useCallback(() => {
        if (total <= 1) return;
        setPlaying(true);
    }, [total]);

    useEffect(() => {
        if (!playing) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        intervalRef.current = setInterval(() => {
            onIndexChange(prev => {
                const next = typeof prev === 'function' ? prev : prev;
                // Handled by parent
                return 'next';
            });
        }, 1000 / speed);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [playing, speed, onIndexChange]);

    // Stop when reaching the end
    useEffect(() => {
        if (currentIndex >= total - 1 && playing) {
            stop();
        }
    }, [currentIndex, total, playing, stop]);

    if (total <= 1) return null;

    const current = snapshots[currentIndex];
    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                    onClick={() => playing ? stop() : play()}
                    className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                    {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>

                {/* Slider */}
                <div className="flex-1">
                    <input
                        type="range"
                        min={0}
                        max={total - 1}
                        value={currentIndex}
                        onChange={e => { stop(); onIndexChange(Number(e.target.value)); }}
                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>{formatTime(snapshots[0]?.timestamp)}</span>
                        <span>{formatTime(snapshots[total - 1]?.timestamp)}</span>
                    </div>
                </div>

                {/* Speed */}
                <button
                    onClick={() => setSpeedIdx((speedIdx + 1) % SPEEDS.length)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                    <Gauge size={12} />
                    {speed}x
                </button>

                {/* Jump to latest */}
                <button
                    onClick={() => { stop(); onIndexChange(total - 1); }}
                    className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    title={t ? t('workflow.timeline.jumpToLatest') : 'Jump to Latest'}
                >
                    <SkipForward size={16} />
                </button>
            </div>

            {/* Current event label */}
            {current && (
                <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{formatTime(current.timestamp)}</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400 truncate ml-4">{current.label}</span>
                    <span className="text-gray-400 ml-auto">{currentIndex + 1}/{total}</span>
                </div>
            )}
        </div>
    );
}
