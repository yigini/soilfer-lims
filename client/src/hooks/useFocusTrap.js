import { useEffect, useRef } from 'react';

/**
 * Trap focus within a container element.
 * Focus cycles through focusable elements using Tab/Shift+Tab,
 * and Escape triggers the onClose callback.
 *
 * @param {boolean} isActive - Whether the trap is active
 * @param {Function} [onClose] - Optional callback for Escape key
 * @returns {React.RefObject} Ref to attach to the container element
 */
export function useFocusTrap(isActive, onClose) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        const container = containerRef.current;
        const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

        // Save previous focus to restore later
        const previousFocus = document.activeElement;

        // Focus the first focusable element
        const focusableEls = container.querySelectorAll(focusableSelector);
        if (focusableEls.length > 0) {
            focusableEls[0].focus();
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onClose) {
                e.stopPropagation();
                onClose();
                return;
            }

            if (e.key !== 'Tab') return;

            const focusable = container.querySelectorAll(focusableSelector);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('keydown', handleKeyDown);
            // Restore previous focus
            if (previousFocus && previousFocus.focus) {
                previousFocus.focus();
            }
        };
    }, [isActive, onClose]);

    return containerRef;
}
