import { useEffect, useRef } from 'react';

/**
 * Trap focus within a container element.
 * Focus cycles through focusable elements using Tab/Shift+Tab,
 * Escape triggers the onClose callback, and focus is restored
 * to the opening trigger upon dismissal.
 *
 * @param {boolean} isActive - Whether the trap is active
 * @param {Function} [onClose] - Optional callback for Escape key
 * @returns {React.RefObject} Ref to attach to the container element
 */
export function useFocusTrap(isActive, onClose) {
    const containerRef = useRef(null);
    const triggerRef = useRef(null);
    const fallbackRef = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const captureTrigger = () => {
        if (typeof document === 'undefined') return;
        const activeEl = document.activeElement;
        if (activeEl && activeEl !== document.body && (!containerRef.current || !containerRef.current.contains(activeEl))) {
            triggerRef.current = activeEl;
            fallbackRef.current = {
                id: activeEl.id || null,
                text: activeEl.textContent?.trim() || null,
                tagName: activeEl.tagName || null
            };
        }
    };

    // Capture the trigger element synchronously during render if active and not yet captured
    if (isActive && !triggerRef.current) {
        captureTrigger();
    }

    // Capture on active transition if missed during initial render
    useEffect(() => {
        if (isActive && !triggerRef.current) {
            captureTrigger();
        }
    }, [isActive]);

    // Manage focus trapping, keyboard navigation (Tab/Shift+Tab, Escape), and focus restoration
    useEffect(() => {
        if (!isActive) return;

        const container = containerRef.current;
        if (!container) return;

        const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

        const getFocusableElements = () => {
            if (!container) return [];
            return Array.from(container.querySelectorAll(focusableSelector)).filter(el => {
                if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
                if (el.offsetParent === null && el.getClientRects().length === 0) return false;
                if (el.closest('[aria-hidden="true"]')) return false;
                return true;
            });
        };

        // Focus initial element inside container after entrance
        const focusInitial = () => {
            if (!container) return;
            const focusableEls = getFocusableElements();
            if (focusableEls.length > 0 && !container.contains(document.activeElement)) {
                // Focus the first input/select/textarea if available, otherwise first focusable element
                const firstInput = container.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
                if (firstInput && focusableEls.includes(firstInput)) {
                    firstInput.focus();
                } else {
                    focusableEls[0].focus();
                }
            }
        };

        focusInitial();
        const timer = setTimeout(focusInitial, 50);

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                if (onCloseRef.current) {
                    onCloseRef.current();
                }
                return;
            }

            if (e.key !== 'Tab') return;

            const focusable = getFocusableElements();
            if (focusable.length === 0) {
                e.preventDefault();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first || !container.contains(document.activeElement)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last || !container.contains(document.activeElement)) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', handleKeyDown, true);

            // Restore focus to original trigger (or replacement if parent re-rendered)
            const resolveTrigger = () => {
                let target = triggerRef.current;
                if (!target || !target.isConnected) {
                    if (fallbackRef.current) {
                        const { id, text, tagName } = fallbackRef.current;
                        if (id) {
                            const found = document.getElementById(id);
                            if (found && found.isConnected) return found;
                        }
                        if (tagName && text) {
                            const candidates = Array.from(document.querySelectorAll(tagName.toLowerCase()));
                            const match = candidates.find(c => c.textContent?.trim() === text && (c.offsetParent !== null || c.getClientRects().length > 0));
                            if (match) return match;
                        }
                    }
                }
                return target && target.isConnected ? target : null;
            };

            const doFocus = () => {
                const target = resolveTrigger();
                if (target && typeof target.focus === 'function') {
                    target.focus();
                }
            };

            doFocus();
            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => {
                    const target = resolveTrigger();
                    if (target && typeof target.focus === 'function' && document.activeElement !== target) {
                        target.focus();
                    }
                });
            }
            setTimeout(() => {
                const target = resolveTrigger();
                if (target && typeof target.focus === 'function' && document.activeElement !== target) {
                    target.focus();
                }
                triggerRef.current = null;
                fallbackRef.current = null;
            }, 0);
        };
    }, [isActive]);

    return containerRef;
}

