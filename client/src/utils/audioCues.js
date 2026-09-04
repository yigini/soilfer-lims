// Web Audio API Synthesizer for hardware barcode scanner cues and reception feedback
// 100% offline, zero network requests, zero audio file assets

let audioCtx = null;

const getAudioContext = () => {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
};

export const isAudioEnabled = () => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('lims_sound_enabled');
    return stored === null ? true : stored === 'true';
};

export const setAudioEnabled = (enabled) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('lims_sound_enabled', String(enabled));
};

/**
 * Play a high-pitched, crisp dual-tone rising chime (880Hz -> 1760Hz)
 * Indicating successful barcode scan or verified intake.
 */
export const playSuccessChime = () => {
    if (!isAudioEnabled()) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12); // A6

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.start(now);
        osc.stop(now + 0.15);
    } catch (e) {
        console.debug('Audio playback error:', e);
    }
};

/**
 * Play a low-frequency sawtooth buzz (220Hz)
 * Indicating scan not found, duplicate warning, or rejection.
 */
export const playErrorBuzz = () => {
    if (!isAudioEnabled()) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now); // A3
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.25);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.start(now);
        osc.stop(now + 0.3);
    } catch (e) {
        console.debug('Audio playback error:', e);
    }
};

/**
 * Play a two-tone alert notification (587Hz -> 880Hz)
 * Indicating a notice, duplicate prompt, or exception recorded.
 */
export const playNoticeChime = () => {
    if (!isAudioEnabled()) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // First beep (587Hz - D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc1.start(now);
        osc1.stop(now + 0.08);

        // Second beep (880Hz - A5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(880, now + 0.1);
        gain2.gain.setValueAtTime(0.18, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.2);
    } catch (e) {
        console.debug('Audio playback error:', e);
    }
};
