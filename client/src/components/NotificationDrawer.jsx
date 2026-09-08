import React, { useEffect, useRef } from 'react';
import { X, Check, Bell, ExternalLink, Info, AlertTriangle, CheckCircle, AlertOctagon, Mail, MessageCircle, Send, ArrowLeft, CheckCheck, Smile } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

const NotificationDrawer = () => {
    const {
        isDrawerOpen, closeDrawer, notifications, markAsRead, markAllRead, clearAllNotifications,
        sendMessage, sendChatMessage, directory, fetchDirectory,
        conversations, fetchConversations,
        activeThread, activeThreadPartner, fetchThread, setActiveThreadPartner,
        isOnline,
        drawerView, setDrawerView,
        unreadNotificationCount, unreadMessageCount
    } = useNotifications();
    const { t } = useLanguage();
    const navigate = useNavigate();

    // VIEW: NOTIFICATIONS | CHATS | THREAD | COMPOSE (synced with context)
    const view = drawerView || 'NOTIFICATIONS';
    const setView = setDrawerView;
    const [chatInput, setChatInput] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [composeData, setComposeData] = React.useState({ toUserId: '', message: '' });
    const [sendSuccess, setSendSuccess] = React.useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const threadEndRef = useRef(null);
    const emojiPickerRef = useRef(null);

    // Fetch conversations when switching to CHATS view
    useEffect(() => {
        if (view === 'CHATS' && isDrawerOpen) {
            fetchConversations();
            if (directory.length === 0) fetchDirectory();
        }
    }, [view, isDrawerOpen]);

    // Auto-scroll to bottom of thread
    useEffect(() => {
        if (view === 'THREAD' && threadEndRef.current) {
            threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeThread, view]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset view when drawer closes
    useEffect(() => {
        if (!isDrawerOpen) {
            // Keep view state for next open
        }
    }, [isDrawerOpen]);

    // ── Helpers ────────────────────────────────────────────────────
    const parseParams = (str) => {
        try {
            return str ? JSON.parse(str) : {};
        } catch {
            return {};
        }
    };

    const resolveTitle = (notif) => {
        if (notif.titleCode) return t(notif.titleCode, parseParams(notif.titleParams));
        return notif.title;
    };

    const resolveMessage = (notif) => {
        if (notif.messageCode) return t(notif.messageCode, parseParams(notif.messageParams));
        return notif.message;
    };

    const getTypeStyles = (type) => {
        switch (type) {
            case 'SUCCESS': return { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
            case 'WARNING': return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' };
            case 'ERROR': return { icon: AlertOctagon, color: 'text-rose-500', bg: 'bg-rose-500/10' };
            case 'MESSAGE': return { icon: Bell, color: 'text-purple-500', bg: 'bg-purple-500/10' };
            default: return { icon: Info, color: 'text-sf-primary', bg: 'bg-sf-primary/10' };
        }
    };

    const handleNotifClick = (notif) => {
        if (!notif.read && !notif.isRead) markAsRead(notif.id);
        if (notif.type === 'MESSAGE' && !notif.link) {
            if (notif.senderId) {
                openConversation(notif.senderId);
            } else {
                setView('CHATS');
            }
            return;
        }
        if (notif.link) {
            closeDrawer();
            navigate(notif.link);
        }
    };

    const openConversation = (partnerId) => {
        fetchThread(partnerId);
        setView('THREAD');
    };

    const handleChatSend = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !activeThreadPartner) return;
        setSending(true);
        const result = await sendChatMessage(activeThreadPartner, chatInput.trim());
        setSending(false);
        if (result) {
            setChatInput('');
        }
    };

    const handleQuickCompose = async (e) => {
        e.preventDefault();
        if (!composeData.toUserId || !composeData.message.trim()) return;
        setSending(true);
        const success = await sendChatMessage(composeData.toUserId, composeData.message);
        setSending(false);
        if (success) {
            setComposeData({ toUserId: '', message: '' });
            setSendSuccess(true);
            setTimeout(() => setSendSuccess(false), 3500);
            // Switch to chats view to show the conversation
            fetchConversations();
            setView('CHATS');
        }
    };

    const formatTime = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return t('ui.now', 'now');
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const formatChatTime = (date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const groupMessagesByDate = (msgs) => {
        const groups = [];
        let currentDate = '';
        for (const msg of msgs) {
            const dateStr = new Date(msg.createdAt).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
            if (dateStr !== currentDate) {
                groups.push({ type: 'date', label: dateStr });
                currentDate = dateStr;
            }
            groups.push({ type: 'message', data: msg });
        }
        return groups;
    };

    // Get partner name from conversations or thread
    const getPartnerName = () => {
        const conv = conversations.find(c => c.partnerId === activeThreadPartner);
        if (conv) return conv.partnerName;
        if (activeThread.length > 0) {
            const msg = activeThread[0];
            return msg.isMe ? msg.recipientName : msg.senderName;
        }
        return t('ui.chat', 'Chat');
    };

    // ── Tab Header ─────────────────────────────────────────────────
    const renderTabHeader = () => (
        <div className="flex border-b border-sf-divider bg-sf-surface">
            {view === 'THREAD' ? (
                <div className="flex items-center w-full px-4 py-3 gap-3">
                    <button
                        onClick={() => { setView('CHATS'); setActiveThreadPartner(null); }}
                        className="p-1 hover:bg-sf-hover text-sf-muted hover:text-sf-text rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            {getPartnerName().charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-semibold text-sm text-sf-text leading-tight">{getPartnerName()}</p>
                            {isOnline(activeThreadPartner) ? (
                                <p className="text-xs text-emerald-500 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> {t('ui.online', 'online')}
                                </p>
                            ) : (
                                <p className="text-xs text-sf-muted">{t('ui.offline', 'offline')}</p>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <button
                        onClick={() => setView('NOTIFICATIONS')}
                        className={clsx(
                            "flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all border-b-2",
                            view === 'NOTIFICATIONS'
                                ? "text-sf-primary border-sf-primary"
                                : "text-sf-muted border-transparent hover:text-sf-text"
                        )}
                    >
                        <Bell size={16} />
                        <span>{t('ui.notifications', 'Notifications')}</span>
                        {unreadNotificationCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[11px] font-extrabold bg-sf-primary/15 text-sf-primary rounded-full">
                                {unreadNotificationCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setView('CHATS')}
                        className={clsx(
                            "flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all border-b-2",
                            view === 'CHATS' || view === 'COMPOSE'
                                ? "text-sf-primary border-sf-primary"
                                : "text-sf-muted border-transparent hover:text-sf-text"
                        )}
                    >
                        <MessageCircle size={16} />
                        <span>{t('ui.chats', 'Chats')}</span>
                        {unreadMessageCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[11px] font-black bg-rose-500 text-white rounded-full shadow-sm animate-pulse">
                                {unreadMessageCount}
                            </span>
                        )}
                    </button>
                </>
            )}
        </div>
    );

    // ── Notification List ──────────────────────────────────────────
    const renderNotificationList = () => (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-sf-canvas">
            {/* Actions */}
            {notifications.length > 0 && (
                <div className="px-4 py-2 border-b border-sf-divider bg-sf-surface flex gap-2">
                    <button onClick={markAllRead} className="text-xs font-semibold text-sf-primary hover:bg-sf-primary/10 px-2 py-1 rounded-md transition-colors">{t('ui.markAllRead', 'Mark all read')}</button>
                    <button onClick={clearAllNotifications} className="text-xs font-semibold text-rose-500 hover:bg-rose-500/10 px-2 py-1 rounded-md transition-colors">{t('ui.clearAll', 'Clear All')}</button>
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-sf-muted p-8">
                        <Bell size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">{t('ui.noNotifications', 'No notifications yet')}</p>
                    </div>
                ) : (
                    notifications.map(notif => {
                        const style = getTypeStyles(notif.type);
                        const Icon = style.icon;
                        const title = resolveTitle(notif);
                        const message = resolveMessage(notif);

                        return (
                            <div
                                key={notif.id}
                                onClick={() => handleNotifClick(notif)}
                                className={clsx(
                                    "relative group flex gap-3 p-3 rounded-xl transition-all cursor-pointer border",
                                    (notif.read || notif.isRead)
                                        ? "bg-sf-surface border-sf-divider opacity-75 hover:opacity-100 hover:bg-sf-hover/40"
                                        : "bg-sf-surface border-sf-primary/30 shadow-sm hover:border-sf-primary/60"
                                )}
                            >
                                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${style.bg} ${style.color}`}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <h4 className={clsx("text-sm truncate pr-2", (notif.read || notif.isRead) ? "text-sf-text font-medium" : "text-sf-text font-bold")}>{title}</h4>
                                        {!(notif.read || notif.isRead) && <span className="w-2 h-2 rounded-full bg-sf-primary shrink-0 mt-1.5" />}
                                    </div>
                                    <p className="text-xs text-sf-muted line-clamp-2 mb-1">{message}</p>
                                    <div className="flex items-center justify-between text-xs text-sf-muted">
                                        <span>{formatTime(notif.createdAt)}</span>
                                        {notif.link && <span className="flex items-center gap-1 text-sf-primary font-medium group-hover:underline">{t('ui.view', 'View')} <ExternalLink size={10} /></span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );

    // ── Conversation List (WhatsApp-style) ──────────────────────────
    const renderConversationList = () => (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-sf-canvas">
            {/* New Chat Button */}
            <div className="px-3 py-2 border-b border-sf-divider bg-sf-surface">
                <button
                    onClick={() => setView('COMPOSE')}
                    className="w-full py-2.5 bg-sf-primary text-sf-on-primary rounded-xl text-sm font-semibold hover:bg-sf-primary-hover transition-all shadow-sm flex items-center justify-center gap-2"
                >
                    <MessageCircle size={16} /> {t('ui.newChat', 'New Chat')}
                </button>
            </div>

            {sendSuccess && (
                <div className="mx-3 mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 animate-in slide-in-from-top duration-300">
                    <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('ui.messageSent', 'Message sent!')}</p>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-sf-muted p-8">
                        <MessageCircle size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">{t('ui.noConversations', 'No conversations yet')}</p>
                        <p className="text-xs mt-1 text-sf-muted">{t('ui.startNewChat', 'Start a new chat above')}</p>
                    </div>
                ) : (
                    conversations.map(conv => (
                        <div
                            key={conv.partnerId}
                            onClick={() => openConversation(conv.partnerId)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-sf-hover cursor-pointer transition-colors border-b border-sf-divider bg-sf-surface"
                        >
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                    {conv.partnerName.charAt(0).toUpperCase()}
                                </div>
                                {isOnline(conv.partnerId) && (
                                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-sf-surface rounded-full shadow-sm" />
                                )}
                                {conv.unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                    </span>
                                )}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className={clsx("text-sm truncate", conv.unreadCount > 0 ? "font-bold text-sf-text" : "font-medium text-sf-text")}>
                                        {conv.partnerName}
                                    </h4>
                                    <span className={clsx("text-[11px] ml-2 shrink-0", conv.unreadCount > 0 ? "text-emerald-500 font-semibold" : "text-sf-muted")}>
                                        {formatTime(conv.lastMessageAt)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {conv.lastMessageIsMe && (
                                        <CheckCheck size={14} className="text-sf-primary shrink-0" />
                                    )}
                                    <p className={clsx("text-xs truncate", conv.unreadCount > 0 ? "text-sf-text font-medium" : "text-sf-muted")}>
                                        {conv.lastMessage}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    // ── Compose View ───────────────────────────────────────────────
    const renderCompose = () => (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-sf-surface">
            <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setView('CHATS')} className="p-1 hover:bg-sf-hover text-sf-muted hover:text-sf-text rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <h3 className="font-semibold text-sf-text">{t('ui.newMessage', 'New Message')}</h3>
            </div>
            <form onSubmit={handleQuickCompose} className="space-y-4 flex-1 flex flex-col">
                <div>
                    <label className="block text-xs font-medium text-sf-muted mb-1 uppercase tracking-wide">{t('ui.to', 'To')}</label>
                    <select
                        className="w-full rounded-xl border border-sf-divider bg-sf-canvas text-sf-text text-sm py-2.5 px-3 focus:ring-2 focus:ring-sf-primary focus:border-sf-primary"
                        value={composeData.toUserId}
                        onChange={e => setComposeData({ ...composeData, toUserId: e.target.value })}
                        required
                    >
                        <option value="">{t('ui.selectRecipient', 'Select Recipient...')}</option>
                        {directory.map(u => (
                            <option key={u.id} value={u.id}>
                                {u.name || u.username} ({u.role})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 flex flex-col">
                    <label className="block text-xs font-medium text-sf-muted mb-1 uppercase tracking-wide">{t('ui.message', 'Message')}</label>
                    <textarea
                        className="flex-1 w-full rounded-xl border border-sf-divider bg-sf-canvas text-sf-text placeholder:text-sf-muted text-sm p-3 resize-none focus:ring-2 focus:ring-sf-primary min-h-[120px]"
                        value={composeData.message}
                        onChange={e => setComposeData({ ...composeData, message: e.target.value })}
                        required
                        placeholder={t('ui.typeMessage', 'Type your message...')}
                    />
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setView('CHATS')} className="flex-1 px-4 py-2.5 text-sm text-sf-muted hover:text-sf-text hover:bg-sf-hover rounded-xl transition-colors">{t('ui.cancel', 'Cancel')}</button>
                    <button type="submit" disabled={sending} className="flex-1 px-4 py-2.5 text-sm bg-sf-primary text-sf-on-primary rounded-xl hover:bg-sf-primary-hover font-semibold shadow-sm flex items-center justify-center gap-2 transition-all">
                        {sending ? t('ui.sending', 'Sending...') : <><Send size={14} /> {t('ui.send', 'Send')}</>}
                    </button>
                </div>
            </form>
        </div>
    );

    // ── Chat Thread (WhatsApp Bubbles) ─────────────────────────────
    const renderThread = () => {
        const grouped = groupMessagesByDate(activeThread);

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Chat Messages */}
                <div
                    className="flex-1 overflow-y-auto px-3 py-4 bg-sf-canvas"
                    style={{
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    }}
                >

                    {activeThread.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-sf-muted">
                            <MessageCircle size={40} className="mb-3 opacity-30" />
                            <p className="text-sm">{t('ui.noMessages', 'No messages yet')}</p>
                            <p className="text-xs mt-1 text-sf-muted">{t('ui.sayHello', 'Say hello! 👋')}</p>
                        </div>
                    ) : (
                        grouped.map((item, idx) => {
                            if (item.type === 'date') {
                                return (
                                    <div key={`date-${idx}`} className="flex items-center justify-center my-4">
                                        <span className="px-3 py-1 bg-sf-surface border border-sf-divider text-[11px] text-sf-muted rounded-lg shadow-sm font-medium backdrop-blur-sm">
                                            {item.label}
                                        </span>
                                    </div>
                                );
                            }

                            const msg = item.data;
                            const isMe = msg.isMe;

                            return (
                                <div key={msg.id} className={clsx("flex mb-1.5 animate-in slide-in-from-bottom-2 fade-in duration-300", isMe ? "justify-end" : "justify-start")}>
                                    <div className={clsx(
                                        "relative max-w-[80%] px-3 py-2 rounded-2xl shadow-sm",
                                        isMe
                                            ? "bg-sf-primary text-sf-on-primary rounded-br-md"
                                            : "bg-sf-surface text-sf-text rounded-bl-md border border-sf-divider"
                                    )}>
                                        {/* Bubble tail */}
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                                        <div className={clsx("flex items-center justify-end gap-1 mt-1", isMe ? "text-emerald-100" : "text-sf-muted")}>
                                            <span className="text-[10px]">{formatChatTime(msg.createdAt)}</span>
                                            {isMe && (
                                                msg.isRead ? (
                                                    <CheckCheck size={12} className="text-emerald-200" />
                                                ) : msg.isDelivered ? (
                                                    <CheckCheck size={12} className="text-emerald-300/80" />
                                                ) : (
                                                    <Check size={12} className="text-emerald-300/60" />
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={threadEndRef} />
                </div>

                {/* Input Bar */}
                <div className="border-t border-sf-divider bg-sf-surface px-3 py-2.5 relative">
                    {showEmojiPicker && (
                        <div
                            ref={emojiPickerRef}
                            className="absolute bottom-full left-3 mb-2 bg-sf-surface border border-sf-divider rounded-2xl shadow-xl p-2 z-50 grid grid-cols-6 gap-1 animate-in zoom-in-95"
                        >
                            {['😊', '😂', '👍', '🙏', '🔥', '❤️', '✅', '🚀', '🤔', '👀', '✨', '👋', '🎉', '🤝', '🙌', '💯', '📍', '🧪'].map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                        setChatInput(prev => prev + emoji);
                                    }}
                                    className="w-10 h-10 flex items-center justify-center text-xl hover:bg-sf-hover rounded-lg transition-colors"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                    <form onSubmit={handleChatSend} className="flex items-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={clsx(
                                "shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                showEmojiPicker ? "bg-sf-primary/15 text-sf-primary" : "text-sf-muted hover:bg-sf-hover hover:text-sf-text"
                            )}
                        >
                            <Smile size={20} />
                        </button>
                        <div className="flex-1 relative">
                            <textarea
                                className="w-full rounded-2xl border border-sf-divider bg-sf-canvas text-sf-text placeholder:text-sf-muted text-sm px-4 py-2.5 resize-none focus:ring-2 focus:ring-sf-primary focus:border-transparent max-h-24 transition-all"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleChatSend(e);
                                    }
                                }}
                                placeholder={t('ui.typeMessage', 'Type a message...')}
                                rows={1}
                                style={{ minHeight: '40px' }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={sending || !chatInput.trim()}
                            className={clsx(
                                "shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm",
                                chatInput.trim()
                                    ? "bg-sf-primary text-sf-on-primary hover:bg-sf-primary-hover scale-100"
                                    : "bg-sf-raised text-sf-muted scale-95"
                            )}
                        >
                            <Send size={18} className={chatInput.trim() ? '' : 'opacity-50'} />
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    // ── Main Render ─────────────────────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            {isDrawerOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    onClick={closeDrawer}
                />
            )}

            {/* Drawer */}
            <div className={`fixed inset-y-0 right-0 w-full md:w-[420px] bg-sf-surface shadow-2xl transform transition-transform duration-300 ease-in-out z-[70] flex flex-col border-l border-sf-divider
                ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-sf-divider flex items-center justify-between bg-sf-raised">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-base text-sf-text">
                            {view === 'THREAD' ? t('ui.chat', 'Chat') : t('ui.messagesAndAlerts', 'Messages & Alerts')}
                        </h2>
                    </div>
                    <button
                        onClick={closeDrawer}
                        className="p-1.5 text-sf-muted hover:text-sf-text rounded-full hover:bg-sf-hover transition-colors"
                        aria-label="Close drawer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                {renderTabHeader()}

                {/* Content */}
                {view === 'NOTIFICATIONS' && renderNotificationList()}
                {view === 'CHATS' && renderConversationList()}
                {view === 'COMPOSE' && renderCompose()}
                {view === 'THREAD' && renderThread()}

                {/* Footer — only show on main views */}
                {(view === 'NOTIFICATIONS' || view === 'CHATS') && (
                    <div className="p-3 border-t border-sf-divider bg-sf-surface">
                        <button
                            onClick={() => {
                                closeDrawer();
                                navigate('/profile');
                            }}
                            className="w-full py-2 flex items-center justify-center gap-2 text-sf-primary hover:underline font-semibold transition-colors text-sm"
                        >
                            <Mail size={14} /> {t('ui.openMessagingCenter', 'Open Full Messaging Center')}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default NotificationDrawer;
