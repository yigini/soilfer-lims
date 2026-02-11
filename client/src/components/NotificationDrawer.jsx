
import React, { useEffect, useRef } from 'react';
import { X, Check, Bell, ExternalLink, Info, AlertTriangle, CheckCircle, AlertOctagon, Mail, MessageCircle, Send, ArrowLeft, CheckCheck, Smile } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

const NotificationDrawer = () => {
    const {
        isDrawerOpen, closeDrawer, notifications, markAsRead, markAllRead, clearAllNotifications,
        sendMessage, sendChatMessage, directory, fetchDirectory,
        conversations, fetchConversations,
        activeThread, activeThreadPartner, fetchThread, setActiveThreadPartner,
        isOnline
    } = useNotifications();
    const navigate = useNavigate();

    // VIEW: NOTIFICATIONS | CHATS | THREAD
    const [view, setView] = React.useState('NOTIFICATIONS');
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
    const getTypeStyles = (type) => {
        switch (type) {
            case 'SUCCESS': return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' };
            case 'WARNING': return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
            case 'ERROR': return { icon: AlertOctagon, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' };
            case 'MESSAGE': return { icon: Bell, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' };
            default: return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' };
        }
    };

    const handleNotifClick = (notif) => {
        if (!notif.read && !notif.isRead) markAsRead(notif.id);
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
        if (diff < 60000) return 'now';
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
        return 'Chat';
    };

    // ── Tab Header ─────────────────────────────────────────────────
    const renderTabHeader = () => (
        <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            {view === 'THREAD' ? (
                <div className="flex items-center w-full px-4 py-3 gap-3">
                    <button
                        onClick={() => { setView('CHATS'); setActiveThreadPartner(null); }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            {getPartnerName().charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">{getPartnerName()}</p>
                            {isOnline(activeThreadPartner) ? (
                                <p className="text-xs text-green-500 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> online
                                </p>
                            ) : (
                                <p className="text-xs text-gray-400">offline</p>
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
                                ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                                : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200"
                        )}
                    >
                        <Bell size={16} /> Notifications
                    </button>
                    <button
                        onClick={() => setView('CHATS')}
                        className={clsx(
                            "flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all border-b-2",
                            view === 'CHATS' || view === 'COMPOSE'
                                ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                                : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200"
                        )}
                    >
                        <MessageCircle size={16} /> Chats
                    </button>
                </>
            )}
        </div>
    );

    // ── Notification List ──────────────────────────────────────────
    const renderNotificationList = () => (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Actions */}
            {notifications.length > 0 && (
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex gap-2">
                    <button onClick={markAllRead} className="text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md transition-colors">Mark all read</button>
                    <button onClick={clearAllNotifications} className="text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-md transition-colors">Clear All</button>
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
                        <Bell size={48} className="mb-4 opacity-20" />
                        <p>No notifications yet</p>
                    </div>
                ) : (
                    notifications.map(notif => {
                        const style = getTypeStyles(notif.type);
                        const Icon = style.icon;
                        return (
                            <div
                                key={notif.id}
                                onClick={() => handleNotifClick(notif)}
                                className={clsx(
                                    "relative group flex gap-3 p-3 rounded-xl transition-all cursor-pointer border",
                                    (notif.read || notif.isRead)
                                        ? "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-70 hover:opacity-100"
                                        : "bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30 shadow-sm"
                                )}
                            >
                                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${style.bg} ${style.color}`}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <h4 className={clsx("text-sm font-medium truncate pr-2", (notif.read || notif.isRead) ? "text-gray-700 dark:text-gray-300" : "text-gray-900 dark:text-gray-100 font-semibold")}>{notif.title}</h4>
                                        {!(notif.read || notif.isRead) && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-1">{notif.message}</p>
                                    <div className="flex items-center justify-between text-xs text-gray-400">
                                        <span>{formatTime(notif.createdAt)}</span>
                                        {notif.link && <span className="flex items-center gap-1 text-blue-500 font-medium group-hover:underline">View <ExternalLink size={10} /></span>}
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
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* New Chat Button */}
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <button
                    onClick={() => setView('COMPOSE')}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                    <MessageCircle size={16} /> New Chat
                </button>
            </div>

            {sendSuccess && (
                <div className="mx-3 mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 animate-in slide-in-from-top duration-300">
                    <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Message sent!</p>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
                        <MessageCircle size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">No conversations yet</p>
                        <p className="text-xs mt-1">Start a new chat above</p>
                    </div>
                ) : (
                    conversations.map(conv => (
                        <div
                            key={conv.partnerId}
                            onClick={() => openConversation(conv.partnerId)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-800"
                        >
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                    {conv.partnerName.charAt(0).toUpperCase()}
                                </div>
                                {isOnline(conv.partnerId) && (
                                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full shadow-sm" />
                                )}
                                {conv.unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                    </span>
                                )}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className={clsx("text-sm truncate", conv.unreadCount > 0 ? "font-bold text-gray-900 dark:text-white" : "font-medium text-gray-800 dark:text-gray-200")}>
                                        {conv.partnerName}
                                    </h4>
                                    <span className={clsx("text-[11px] ml-2 shrink-0", conv.unreadCount > 0 ? "text-green-500 font-semibold" : "text-gray-400")}>
                                        {formatTime(conv.lastMessageAt)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {conv.lastMessageIsMe && (
                                        <CheckCheck size={14} className="text-blue-400 shrink-0" />
                                    )}
                                    <p className={clsx("text-xs truncate", conv.unreadCount > 0 ? "text-gray-800 dark:text-gray-200 font-medium" : "text-gray-500 dark:text-gray-400")}>
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
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setView('CHATS')} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
                </button>
                <h3 className="font-semibold text-gray-900 dark:text-white">New Message</h3>
            </div>
            <form onSubmit={handleQuickCompose} className="space-y-4 flex-1 flex flex-col">
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">To</label>
                    <select
                        className="w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm py-2.5 px-3 focus:ring-2 focus:ring-blue-500"
                        value={composeData.toUserId}
                        onChange={e => setComposeData({ ...composeData, toUserId: e.target.value })}
                        required
                    >
                        <option value="">Select Recipient...</option>
                        {directory.map(u => (
                            <option key={u.id} value={u.id}>
                                {u.name || u.username} ({u.role})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 flex flex-col">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Message</label>
                    <textarea
                        className="flex-1 w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm p-3 resize-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                        value={composeData.message}
                        onChange={e => setComposeData({ ...composeData, message: e.target.value })}
                        required
                        placeholder="Type your message..."
                    />
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setView('CHATS')} className="flex-1 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl dark:text-gray-300 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                    <button type="submit" disabled={sending} className="flex-1 px-4 py-2.5 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-medium shadow-sm flex items-center justify-center gap-2 transition-all">
                        {sending ? 'Sending...' : <><Send size={14} /> Send</>}
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
                    className="flex-1 overflow-y-auto px-3 py-4 bg-gray-50 dark:bg-gray-900/40"
                    style={{
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    }}
                >

                    {activeThread.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                            <MessageCircle size={40} className="mb-3 opacity-30" />
                            <p className="text-sm">No messages yet</p>
                            <p className="text-xs mt-1">Say hello! 👋</p>
                        </div>
                    ) : (
                        grouped.map((item, idx) => {
                            if (item.type === 'date') {
                                return (
                                    <div key={`date-${idx}`} className="flex items-center justify-center my-4">
                                        <span className="px-3 py-1 bg-white/80 dark:bg-gray-700/80 text-[11px] text-gray-500 dark:text-gray-400 rounded-lg shadow-sm font-medium backdrop-blur-sm">
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
                                            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md"
                                            : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md border border-gray-100 dark:border-gray-600"
                                    )}>
                                        {/* Bubble tail */}
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                                        <div className={clsx("flex items-center justify-end gap-1 mt-1", isMe ? "text-blue-100" : "text-gray-400 dark:text-gray-500")}>
                                            <span className="text-[10px]">{formatChatTime(msg.createdAt)}</span>
                                            {isMe && (
                                                msg.isRead ? (
                                                    <CheckCheck size={12} className="text-cyan-300" />
                                                ) : msg.isDelivered ? (
                                                    <CheckCheck size={12} className="text-blue-200" />
                                                ) : (
                                                    <Check size={12} className="text-blue-200/60" />
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
                <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 relative">
                    {showEmojiPicker && (
                        <div
                            ref={emojiPickerRef}
                            className="absolute bottom-full left-3 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-6 gap-1 animate-in zoom-in-95"
                        >
                            {['😊', '😂', '👍', '🙏', '🔥', '❤️', '✅', '🚀', '🤔', '👀', '✨', '👋', '🎉', '🤝', '🙌', '💯', '📍', '🧪'].map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                        setChatInput(prev => prev + emoji);
                                        // Keeping it open for multiple selection
                                    }}
                                    className="w-10 h-10 flex items-center justify-center text-xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                                showEmojiPicker ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                        >
                            <Smile size={20} />
                        </button>
                        <div className="flex-1 relative">
                            <textarea
                                className="w-full rounded-2xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm px-4 py-2.5 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-24 transition-all"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleChatSend(e);
                                    }
                                }}
                                placeholder="Type a message..."
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
                                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 scale-100"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 scale-95"
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
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
                    onClick={closeDrawer}
                />
            )}

            {/* Drawer */}
            <div className={`fixed inset-y-0 right-0 w-full md:w-[420px] bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[70] flex flex-col border-l dark:border-gray-700
                ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-lg text-white">
                            {view === 'THREAD' ? 'Chat' : 'Messages & Alerts'}
                        </h2>
                    </div>
                    <button
                        onClick={closeDrawer}
                        className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
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
                    <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                        <button
                            onClick={() => {
                                closeDrawer();
                                navigate('/profile');
                            }}
                            className="w-full py-2 flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors text-sm"
                        >
                            <Mail size={14} /> Open Full Messaging Center
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default NotificationDrawer;
