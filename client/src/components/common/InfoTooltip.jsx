import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Premium InfoTooltip component for non-invasive help text.
 * Uses fixed positioning to escape container overflow clipping.
 */
const InfoTooltip = ({ text, position = 'bottom' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const iconRef = useRef(null);

    useEffect(() => {
        if (isVisible && iconRef.current) {
            const rect = iconRef.current.getBoundingClientRect();
            let top, left;

            switch (position) {
                case 'top':
                    top = rect.top - 8; // 8px gap
                    left = rect.left + rect.width / 2;
                    break;
                case 'bottom':
                    top = rect.bottom + 8;
                    left = rect.left + rect.width / 2;
                    break;
                case 'left':
                    top = rect.top + rect.height / 2;
                    left = rect.left - 8;
                    break;
                case 'right':
                    top = rect.top + rect.height / 2;
                    left = rect.right + 8;
                    break;
                default:
                    top = rect.bottom + 8;
                    left = rect.left + rect.width / 2;
            }

            setCoords({ top, left });
        }
    }, [isVisible, position]);

    const getTransform = () => {
        switch (position) {
            case 'top': return 'translateX(-50%) translateY(-100%)';
            case 'bottom': return 'translateX(-50%)';
            case 'left': return 'translateY(-50%) translateX(-100%)';
            case 'right': return 'translateY(-50%)';
            default: return 'translateX(-50%)';
        }
    };

    return (
        <div className="relative inline-block ml-1 align-middle leading-none">
            <div
                ref={iconRef}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
            >
                <HelpCircle size={14} className="text-gray-400 hover:text-blue-500 cursor-help transition-colors" />
            </div>

            {isVisible && (
                <div
                    className="fixed max-w-xs p-3 bg-gray-900 dark:bg-black text-white text-[11px] leading-relaxed rounded-xl shadow-2xl pointer-events-none border border-white/10"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        transform: getTransform(),
                        zIndex: 99999,
                        whiteSpace: 'normal',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word'
                    }}
                >
                    {text}
                </div>
            )}
        </div>
    );
};

export default InfoTooltip;
