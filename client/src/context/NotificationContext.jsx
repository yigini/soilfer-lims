
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { playNoticeChime } from '../utils/audioCues';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user, token } = useAuth();
    const userId = user?.id;

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerView, setDrawerView] = useState('NOTIFICATIONS');

    // Messaging state (formal messages)
    const [directory, setDirectory] = useState([]);
    const [messages, setMessages] = useState([]);

    // Chat state (real-time conversations)
    const [conversations, setConversations] = useState([]);
    const [activeThread, setActiveThread] = useState([]);
    const [activeThreadPartner, setActiveThreadPartner] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    // WebSocket
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const wsConnected = useRef(false);
    const reconnectAttempts = useRef(0);
    const refreshState = useRef({ inFlight: new Set(), nextAt: 0 });

    useEffect(() => {
        // Identity/token changes start a new refresh generation. Late responses
        // from the previous session must not populate the next user's drawer.
        refreshState.current = { inFlight: new Set(), nextAt: 0 };
        return () => { refreshState.current = { inFlight: new Set(), nextAt: 0 }; };
    }, [userId, token]);

    // Generic event subscribers (for WORKITEM_CHANGED, WORKITEM_UPDATE, etc.)
    const eventSubscribersRef = useRef(new Map());

    // ── Refs for stable WS handler access ─────────────────────────
    // This prevents the stale closure bug — WS onmessage always reads current values
    const activeThreadPartnerRef = useRef(null);
    const fetchConversationsRef = useRef(null);
    const fetchNotificationsRef = useRef(null);

    // Keep refs in sync
    useEffect(() => { activeThreadPartnerRef.current = activeThreadPartner; }, [activeThreadPartner]);

    // ── Notifications ─────────────────────────────────────────────
    const fetchList = useCallback(async (url, apply) => {
        const state = refreshState.current;
        if (!userId || state.inFlight.has(url) || Date.now() < state.nextAt) return;
        state.inFlight.add(url);
        try {
            const res = await axios.get(url);
            if (refreshState.current === state) apply(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            const status = err.response?.status;
            if (status === 401 || status === 403) state.nextAt = Infinity;
            if (status === 429) {
                const seconds = Number(err.response.headers?.['retry-after']);
                const delay = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60000;
                state.nextAt = Math.max(state.nextAt, Date.now() + delay);
            }
            console.error('Background notification refresh failed', status || 'network');
        } finally {
            state.inFlight.delete(url);
        }
    }, [userId, token]);

    const fetchNotifications = useCallback(() => fetchList('/api/notifications', list => {
        setNotifications(list);
        setUnreadCount(list.filter(n => !n.read && !n.isRead).length);
    }), [fetchList]);

    // Keep ref in sync
    useEffect(() => { fetchNotificationsRef.current = fetchNotifications; }, [fetchNotifications]);

    const markAsRead = async (id) => {
        try {
            await axios.post('/api/notifications/mark-read', { id });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) { console.error('Failed to mark as read', err); }
    };

    const markAllRead = async () => {
        try {
            await axios.post('/api/notifications/mark-all-read');
            setNotifications(prev => prev.map(n => ({ ...n, read: true, isRead: true })));
            setUnreadCount(0);
        } catch (err) { console.error('Failed to mark all read', err); }
    };

    const clearAllNotifications = async () => {
        try {
            await axios.post('/api/notifications/clear-all');
            setNotifications([]);
            setUnreadCount(0);
        } catch (err) { console.error('Failed to clear notifications', err); }
    };

    // ── Formal Messaging ──────────────────────────────────────────
    const sendMessage = async (toUserId, subject, message, draftId = null) => {
        try {
            const res = await axios.post('/api/messages/send', { toUserId, subject, body: message, draftId, isChat: false });
            return res.data || true;
        } catch (err) { console.error('Failed to send message', err); return false; }
    };

    const saveDraft = async (toUserId, subject, message, id = null) => {
        try {
            await axios.post('/api/messages/draft', { toUserId, subject, body: message, id });
            return true;
        } catch (err) { console.error('Failed to save draft', err); return false; }
    };

    const fetchMessages = async (folder = 'INBOX') => {
        try {
            const res = await axios.get(`/api/messages?folder=${folder}`);
            setMessages(res.data);
        } catch (err) { console.error('Failed to fetch messages', err); }
    };

    const moveMessage = async (id, targetFolder, scope) => {
        try {
            await axios.post('/api/messages/move', { id, targetFolder, scope });
            setMessages(prev => prev.filter(m => m.id !== id));
            if (targetFolder === 'TRASH' || targetFolder === 'ARCHIVE') {
                fetchNotifications();
                fetchConversations();
            }
        } catch (err) { console.error('Failed to move message', err); }
    };

    const markMessageRead = async (id) => {
        try {
            await axios.post('/api/messages/read', { id });
            setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
        } catch (err) { console.error('Failed to mark message read', err); }
    };

    const fetchDirectory = async () => {
        try {
            const res = await axios.get('/api/users/directory');
            setDirectory(res.data);
        } catch (err) { console.error('Failed to fetch user directory', err); }
    };

    // ── Chat (real-time conversations) ────────────────────────────
    const sendChatMessage = async (toUserId, body) => {
        try {
            const res = await axios.post('/api/messages/send', { toUserId, subject: '', body, isChat: true });
            return res.data || true;
        } catch (err) { console.error('Failed to send chat message', err); return false; }
    };

    const fetchConversations = useCallback(() =>
        fetchList('/api/messages/conversations', setConversations), [fetchList]);

    useEffect(() => { fetchConversationsRef.current = fetchConversations; }, [fetchConversations]);

    const fetchThread = useCallback(async (partnerId) => {
        try {
            const res = await axios.get(`/api/messages/thread/${partnerId}`);
            setActiveThread(res.data);
            setActiveThreadPartner(partnerId);
            fetchConversations();
            fetchNotifications();
        } catch (err) { console.error('Failed to fetch thread', err); }
    }, [fetchConversations, fetchNotifications]);

    // ── Drawer Controls ───────────────────────────────────────────
    const toggleDrawer = useCallback((targetView = null) => {
        setIsDrawerOpen(prev => {
            if (!prev && targetView) {
                setDrawerView(targetView);
            }
            return !prev;
        });
    }, []);

    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false);
    }, []);

    const openDrawer = useCallback((targetView = null) => {
        if (targetView) {
            setDrawerView(targetView);
        }
        setIsDrawerOpen(true);
    }, []);

    // ── WebSocket Connection ──────────────────────────────────────
    const handleWebSocketEvent = useCallback((data) => {
        // Use refs to always get the current values (avoids stale closure)
        const currentPartner = activeThreadPartnerRef.current;

        switch (data.type) {
            case 'CONNECTED':
                reconnectAttempts.current = 0;
                console.log('[WS] Authenticated as', data.userId);
                if (data.onlineUsers) {
                    setOnlineUsers(new Set(data.onlineUsers.map(String)));
                }
                break;

            case 'USER_STATUS':
                const sid = String(data.userId);
                setOnlineUsers(prev => {
                    const next = new Set(prev);
                    if (data.status === 'ONLINE') next.add(sid);
                    else next.delete(sid);
                    return next;
                });
                break;

            case 'NEW_MESSAGE': {
                const msg = data.message;

                // Play chime on incoming message from others
                if (!msg.isMe) {
                    playNoticeChime();
                }

                // Update active thread if chatting with this person
                if (currentPartner && msg.isChat) {
                    const partnerId = msg.isMe ? String(msg.recipientId) : String(msg.senderId);
                    if (partnerId === String(currentPartner)) {
                        setActiveThread(prev => {
                            // Deduplicate by id
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, msg];
                        });
                    }
                }

                // Update conversations list
                if (fetchConversationsRef.current) fetchConversationsRef.current();

                // Refresh notifications (for non-chat messages or chat notifications)
                if (fetchNotificationsRef.current) fetchNotificationsRef.current();

                // Also refresh formal message list if it's a formal message
                if (!msg.isChat) {
                    setMessages(prev => {
                        if (prev.length === 0) return prev; // Only refresh if list is loaded
                        return prev; // Let polling/manual refresh handle it
                    });
                }
                break;
            }

            case 'MESSAGE_READ': {
                setActiveThread(prev => prev.map(m =>
                    m.id === data.messageId ? { ...m, isRead: true } : m
                ));
                break;
            }

            case 'MESSAGES_READ': {
                const readIds = new Set(data.messageIds || []);
                setActiveThread(prev => prev.map(m =>
                    readIds.has(m.id) ? { ...m, isRead: true, isDelivered: true } : m
                ));
                break;
            }

            case 'MESSAGES_DELIVERED': {
                const deliveredIds = new Set(data.messageIds || []);
                setActiveThread(prev => prev.map(m =>
                    deliveredIds.has(m.id) ? { ...m, isDelivered: true } : m
                ));
                break;
            }

            case 'NOTIFICATION_UPDATE': {
                if (data.notification) {
                    setNotifications(prev => [data.notification, ...prev]);
                    setUnreadCount(prev => prev + 1);
                    playNoticeChime();
                }
                break;
            }

            case 'NOTIFICATION_REFRESH': {
                if (fetchNotificationsRef.current) fetchNotificationsRef.current();
                break;
            }

            case 'WORKITEM_CHANGED':
            case 'WORKITEM_UPDATE': {
                // Fan out to subscribers of both event names for backward compat
                const changedSubs = eventSubscribersRef.current.get('WORKITEM_CHANGED');
                if (changedSubs) changedSubs.forEach(cb => cb(data));
                const legacySubs = eventSubscribersRef.current.get('WORKITEM_UPDATE');
                if (legacySubs) legacySubs.forEach(cb => cb(data));
                break;
            }

            case 'MESSAGE_MOVED': {
                setMessages(prev => prev.filter(m => m.id !== data.messageId));
                if (fetchConversationsRef.current) fetchConversationsRef.current();
                break;
            }

            default:
                break;
        }
    }, []); // No dependencies — uses refs for everything

    const connectWebSocket = useCallback(() => {
        if (!token || !userId) return;
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

        const scheduleReconnect = () => {
            const delay = Math.min(60000, 3000 * (2 ** Math.min(reconnectAttempts.current++, 5)));
            reconnectTimer.current = setTimeout(connectWebSocket, delay);
        };

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = import.meta.env.DEV ? 'localhost:3000' : window.location.host;
        const wsUrl = `${protocol}://${host}/ws`;

        try {
            const ws = new WebSocket(wsUrl, [token]);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WS] Connected');
                wsConnected.current = true;
                if (reconnectTimer.current) {
                    clearTimeout(reconnectTimer.current);
                    reconnectTimer.current = null;
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleWebSocketEvent(data);
                } catch (e) { console.error('[WS] Parse error:', e); }
            };

            ws.onclose = (event) => {
                console.log('[WS] Disconnected');
                wsConnected.current = false;
                wsRef.current = null;
                // Authentication refusals need a new session, not repeated upgrades.
                if (event.code >= 4001 && event.code <= 4005) return;
                scheduleReconnect();
            };

            ws.onerror = (err) => {
                // If the socket is already closed or closing, ignore the error
                if (ws.readyState > 1) return;
                console.error('[WS] Error:', err);
                ws.close();
            };
        } catch (e) {
            console.error('[WS] Connection failed:', e);
            scheduleReconnect();
        }
    }, [userId, token, handleWebSocketEvent]);

    // Connect WebSocket on mount
    useEffect(() => {
        reconnectAttempts.current = 0;
        if (userId) connectWebSocket();
        return () => {
            wsConnected.current = false;
            if (wsRef.current) {
                const ws = wsRef.current;
                wsRef.current = null;

                // Detach all listeners to prevent the error/close logic from triggering state updates after unmount
                ws.onopen = null;
                ws.onmessage = null;
                ws.onclose = null;
                ws.onerror = null;

                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                } else if (ws.readyState === WebSocket.CONNECTING) {
                    // To avoid "WebSocket is closed before the connection is established" warning in Chrome:
                    // Wait for it to open, then close it.
                    ws.onopen = () => ws.close();
                }
            }
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
        };
    }, [userId, connectWebSocket]);

    // Fallback polling
    useEffect(() => {
        if (!userId) return;
        const refresh = () => {
            if (document.visibilityState !== 'hidden' && navigator.onLine !== false && !wsConnected.current) {
                fetchNotifications();
                fetchConversations();
            }
        };
        refresh();
        const interval = setInterval(refresh, 30000);
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('online', refresh);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('online', refresh);
        };
    }, [userId, fetchNotifications, fetchConversations]);

    // ── Event Subscription API (for WORKITEM_CHANGED, WORKITEM_UPDATE, etc.) ─────────────────
    const subscribeToEvent = useCallback((eventType, callback) => {
        const subs = eventSubscribersRef.current;
        if (!subs.has(eventType)) subs.set(eventType, new Set());
        subs.get(eventType).add(callback);
        // Return unsubscribe function
        return () => {
            subs.get(eventType)?.delete(callback);
        };
    }, []);

    // Unread counts calculation
    const notifsList = Array.isArray(notifications) ? notifications : [];
    const convsList = Array.isArray(conversations) ? conversations : [];
    const unreadNotificationCount = notifsList.filter(n => (!n.read && !n.isRead) && n.type !== 'MESSAGE').length;
    const unreadChatCount = convsList.reduce((sum, c) => sum + (c?.unreadCount || 0), 0);
    const unreadFormalMessageCount = notifsList.filter(n => (!n.read && !n.isRead) && n.type === 'MESSAGE' && n.link).length;
    const unreadChatNotifs = notifsList.filter(n => (!n.read && !n.isRead) && n.type === 'MESSAGE' && !n.link).length;
    const effectiveChatCount = Math.max(unreadChatCount, unreadChatNotifs);
    const unreadMessageCount = effectiveChatCount + unreadFormalMessageCount;
    const hasUnreadMessages = unreadMessageCount > 0;
    const totalUnreadCount = unreadNotificationCount + unreadMessageCount;

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount: totalUnreadCount,
            totalUnreadCount,
            unreadNotificationCount,
            unreadMessageCount,
            unreadChatCount: effectiveChatCount,
            hasUnreadMessages,
            drawerView,
            setDrawerView,
            isDrawerOpen, toggleDrawer, closeDrawer, openDrawer,
            markAsRead, markAllRead, clearAllNotifications,
            refresh: fetchNotifications,
            // Formal messaging
            sendMessage, directory, fetchDirectory,
            messages, fetchMessages, saveDraft, moveMessage, markMessageRead,
            // Chat
            sendChatMessage,
            conversations, fetchConversations,
            activeThread, activeThreadPartner, fetchThread, setActiveThreadPartner,
            onlineUsers,
            isOnline: (uid) => onlineUsers.has(String(uid)),
            // Event subscription
            subscribeToEvent
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
    return context;
};
