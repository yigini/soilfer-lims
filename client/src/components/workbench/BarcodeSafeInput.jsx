import React, { forwardRef, useEffect, useRef, useState } from 'react';

const candidates = new WeakMap();
const BURST_GAP_MS = 30;

// The grid's capture-phase navigation checks this before advancing Enter.
export function isBarcodeBurst(event) {
    const candidate = candidates.get(event.target);
    return event.key === 'Enter' && candidate?.characters > 6 &&
        Date.now() - candidate.lastAt < BURST_GAP_MS;
}

// Hold a possible wedge locally until its inter-key gap ends. A long wedge
// terminated by Enter never calls the draft or QC observation writer.
const BarcodeSafeInput = forwardRef(function BarcodeSafeInput({ value, onChange,
    onBarcodeRejected, onKeyDown, onBlur, ...props }, forwardedRef) {
    const [text, setText] = useState(String(value ?? ''));
    const node = useRef(null), pending = useRef(null), timer = useRef(null), blurTimer = useRef(null);
    const lastEmitted = useRef(null);
    const handlers = useRef(null);
    handlers.current = { onChange, onBarcodeRejected, onBlur };
    const clear = () => {
        clearTimeout(timer.current); timer.current = null;
        if (node.current) candidates.delete(node.current);
        pending.current = null;
    };
    const flush = () => {
        const next = pending.current?.next;
        clear();
        if (next !== undefined) {
            lastEmitted.current = String(next);
            handlers.current.onChange({target:{value:next},currentTarget:node.current});
        }
    };
    useEffect(() => {
        const supplied = String(value ?? '');
        // The parent may acknowledge a flush after a newer key has arrived.
        // Keep that pending edit and its timer; only an external value resets.
        if (supplied === lastEmitted.current) return;
        clear(); setText(supplied);
    }, [value]);
    useEffect(() => () => { clear(); clearTimeout(blurTimer.current); }, []);
    const keyDown = event => {
        if (onBarcodeRejected && isBarcodeBurst(event)) {
            event.preventDefault(); event.stopPropagation();
            const original = pending.current.original;
            clear(); setText(original); handlers.current.onBarcodeRejected();
            return;
        }
        if (onBarcodeRejected && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const now = Date.now(), previous = pending.current;
            if (previous && now - previous.lastAt >= BURST_GAP_MS) flush();
            const current = pending.current || { characters: 0, original: event.currentTarget.value };
            current.characters++; current.lastAt = now;
            pending.current = current; candidates.set(event.currentTarget, current);
        } else if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape') flush();
        onKeyDown?.(event);
    };
    const change = event => {
        const next = event.target.value;
        setText(next);
        if (!onBarcodeRejected || !pending.current) {
            lastEmitted.current = String(next);
            handlers.current.onChange(event); return;
        }
        pending.current.next = next;
        clearTimeout(timer.current); timer.current = setTimeout(flush, BURST_GAP_MS);
    };
    const blur = event => {
        const buffered = pending.current?.next !== undefined;
        flush();
        // Read the refreshed parent's handler after its draft state commits.
        if (buffered) blurTimer.current = setTimeout(() => handlers.current.onBlur?.(event), 0);
        else onBlur?.(event);
    };
    return <input {...props} ref={element => {
        node.current = element;
        if (typeof forwardedRef === 'function') forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
    }} value={text} onChange={change} onKeyDown={keyDown} onBlur={blur} />;
});

export default BarcodeSafeInput;
