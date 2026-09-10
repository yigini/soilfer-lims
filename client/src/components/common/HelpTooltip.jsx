import React, { useState, useRef, useEffect, useId } from 'react';
import { HelpCircle, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Accessible HelpTooltip component.
 * Operable via Keyboard (Enter/Space to toggle, Escape to dismiss), Touch, and Mouse.
 * Preserves accessibility standards with ARIA attributes and focus management.
 */
export const HelpTooltip = ({
    text,
    title,
    position = 'bottom',
    className = '',
    iconSize = 15,
    children
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const tooltipRef = useRef(null);
    const tooltipId = useId();

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                isOpen &&
                tooltipRef.current &&
                !tooltipRef.current.contains(e.target) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    const toggleTooltip = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(prev => !prev);
    };

    return (
        <span className={clsx("relative inline-flex items-center ml-1 align-middle", className)}>
            <button
                ref={triggerRef}
                type="button"
                onClick={toggleTooltip}
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                aria-expanded={isOpen}
                aria-describedby={isOpen ? tooltipId : undefined}
                aria-label={title || "Help guidance"}
                className="p-0.5 rounded-full text-sf-muted hover:text-sf-primary focus:outline-none focus:ring-2 focus:ring-sf-primary/40 focus:text-sf-primary transition-colors cursor-help"
            >
                {children || <HelpCircle size={iconSize} aria-hidden="true" />}
            </button>

            {isOpen && (
                <div
                    ref={tooltipRef}
                    id={tooltipId}
                    role="tooltip"
                    onMouseEnter={() => setIsOpen(true)}
                    onMouseLeave={() => setIsOpen(false)}
                    className={clsx(
                        "absolute z-50 w-64 max-w-[80vw] p-3 text-xs rounded-xl shadow-xl border leading-relaxed animate-fadeIn",
                        "bg-sf-surface text-sf-text border-sf-divider",
                        position === 'top' && "bottom-full left-1/2 -translate-x-1/2 mb-2",
                        position === 'bottom' && "top-full left-1/2 -translate-x-1/2 mt-2",
                        position === 'left' && "right-full top-1/2 -translate-y-1/2 mr-2",
                        position === 'right' && "left-full top-1/2 -translate-y-1/2 ml-2"
                    )}
                >
                    {title && (
                        <div className="font-bold text-sf-primary mb-1 text-[11px] uppercase tracking-wider">
                            {title}
                        </div>
                    )}
                    <div className="text-sf-text text-[11px]">
                        {text}
                    </div>
                </div>
            )}
        </span>
    );
};

export default HelpTooltip;
