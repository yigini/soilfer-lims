import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const HelpContext = createContext(null);

export const HelpProvider = ({ children }) => {
    const location = useLocation();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerArticleId, setDrawerArticleId] = useState(null);
    const [activeBlockers, setActiveBlockers] = useState([]);
    const [articleHistory, setArticleHistory] = useState([]);
    const triggerElementRef = useRef(null);

    const openDrawer = useCallback((targetArticleId = null, triggerEl = null) => {
        if (triggerEl) {
            triggerElementRef.current = triggerEl;
        } else if (document.activeElement instanceof HTMLElement) {
            triggerElementRef.current = document.activeElement;
        }

        if (targetArticleId) {
            setDrawerArticleId(targetArticleId);
            setArticleHistory([targetArticleId]);
        } else {
            setDrawerArticleId(null);
            setArticleHistory([]);
        }
        setIsDrawerOpen(true);
    }, []);

    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false);
        setDrawerArticleId(null);
        setArticleHistory([]);

        // Restore focus to the trigger button that opened help
        if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
            setTimeout(() => {
                try {
                    triggerElementRef.current.focus();
                } catch (e) { }
            }, 50);
        }
    }, []);

    const drillDownArticle = useCallback((articleId) => {
        setArticleHistory(prev => [...prev, articleId]);
        setDrawerArticleId(articleId);
    }, []);

    const navigateBackInDrawer = useCallback(() => {
        setArticleHistory(prev => {
            if (prev.length <= 1) {
                setDrawerArticleId(null);
                return [];
            }
            const nextHistory = prev.slice(0, -1);
            setDrawerArticleId(nextHistory[nextHistory.length - 1]);
            return nextHistory;
        });
    }, []);

    const registerBlockers = useCallback((codes = []) => {
        const cleanCodes = Array.isArray(codes) ? codes.filter(Boolean) : [];
        setActiveBlockers(cleanCodes);
    }, []);

    const clearBlockers = useCallback(() => {
        setActiveBlockers([]);
    }, []);

    const value = {
        isDrawerOpen,
        drawerArticleId,
        activeBlockers,
        articleHistory,
        currentPath: location.pathname,
        openDrawer,
        closeDrawer,
        drillDownArticle,
        navigateBackInDrawer,
        registerBlockers,
        clearBlockers
    };

    return (
        <HelpContext.Provider value={value}>
            {children}
        </HelpContext.Provider>
    );
};

export const useHelp = () => {
    const context = useContext(HelpContext);
    if (!context) {
        throw new Error('useHelp must be used within a HelpProvider');
    }
    return context;
};

export default HelpContext;
