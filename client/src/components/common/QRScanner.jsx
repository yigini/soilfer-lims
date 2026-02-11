import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

const QRScanner = ({ onScan, onClose }) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            /* verbose= */ false
        );

        scanner.render((decodedText) => {
            scanner.clear();
            onScan(decodedText);
        }, (error) => {
            // console.warn(error);
        });

        return () => {
            scanner.clear().catch(error => {
                console.error("Failed to clear scanner", error);
            });
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden relative">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Scan Sample ID</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div id="reader" className="w-full overflow-hidden rounded-xl border-2 border-dashed border-gray-300"></div>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500 mb-2">Align the QR code or Barcode within the frame</p>
                        <div className="flex justify-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Scanner Active</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-gray-600 font-bold hover:text-gray-900"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QRScanner;
