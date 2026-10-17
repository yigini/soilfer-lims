import JsBarcode from 'jsbarcode';

// Use the library's automatic Code128 mode switching and preserve quiet zones.
export function code128Data(code) {
    const output = {};
    JsBarcode(output, code, { format: 'CODE128', width: 1, height: 32, displayValue: false, margin: 10 });
    const bits = output.encodings.map(row => row.data).join('');
    return { bits, width: bits.length + 20 };
}

export function fitsLabel(code, format) {
    try {
        // Avoid silently crushing long issued identities into an unreadable bar.
        return code128Data(code).width * 0.19 <= (format === 'COMPACT' ? 46 : 95);
    } catch { return false; }
}
