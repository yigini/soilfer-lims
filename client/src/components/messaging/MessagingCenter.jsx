import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { Inbox, Send, FileText, Archive, Trash2, Edit3, User, RefreshCw, Check, Clock, Mail, MessageCircle, ArrowLeft, CheckCheck, Smile } from 'lucide-react';
import clsx from 'clsx';
import { useDialog } from '../../context/DialogContext';

const MessagingCenter = ({ initialMessageId }) => {
    const {
        messages, fetchMessages, sendMessage, saveDraft, moveMessage, directory, fetchDirectory, markMessageRead,
        // Chat
        sendChatMessage, conversations, fetchConversations, activeThread, activeThreadPartner, fetchThread, setActiveThreadPartner,
        isOnline
    } = useNotifications();
    const { user } = useAuth();
    const { showDialog } = useDialog();

    // State
    const [activeFolder, setActiveFolder] = useState('INBOX');
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [isComposing, setIsComposing] = useState(false);
    const [composeData, setComposeData] = useState({ toUserId: '', subject: '', body: '', id: null });
    const [loading, setLoading] = useState(false);
    const initialLinkedRef = useRef(false);

    // Chat state
    const [chatView, setChatView] = useState('LIST'); // LIST | THREAD
    const [chatInput, setChatInput] = useState('');
    const [chatSending, setChatSending] = React.useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const emojiPickerRef = useRef(null);
    const threadEndRef = useRef(null);

    // Is on Chat tab?
    const isChatTab = activeFolder === 'CHATS';

    // Initial Fetch & Deep Linking
    useEffect(() => {
        if (!isChatTab) {
            fetchMessages(activeFolder);
        } else {
            fetchConversations();
        }
        fetchDirectory();
    }, [activeFolder]);

    // Deep link: only run ONCE per initialMessageId
    useEffect(() => {
        if (!initialMessageId || initialLinkedRef.current) return;
        if (messages.length > 0) {
            const msg = messages.find(m => m.id === initialMessageId);
            if (msg) {
                setSelectedMessage(msg);
                initialLinkedRef.current = true;
                if (!msg.isRead && activeFolder === 'INBOX') {
                    markMessageRead(msg.id);
                }
            }
        }
    }, [initialMessageId, messages]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-scroll chat thread
    useEffect(() => {
        if (isChatTab && chatView === 'THREAD' && threadEndRef.current) {
            threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeThread, chatView, isChatTab]);

    // Handle Folder Switch
    const switchFolder = (folder) => {
        setActiveFolder(folder);
        setSelectedMessage(null);
        setIsComposing(false);
        if (folder === 'CHATS') {
            setChatView('LIST');
            setActiveThreadPartner(null);
        }
    };

    // Handle Compose
    const handleCompose = (draft = null) => {
        if (draft) {
            setComposeData({ toUserId: draft.recipientId || '', subject: draft.subject, body: draft.body, id: draft.id });
        } else {
            setComposeData({ toUserId: '', subject: '', body: '', id: null });
        }
        setIsComposing(true);
        setSelectedMessage(null);
    };

    const handleReply = (msg) => {
        setComposeData({
            toUserId: activeFolder === 'SENT' ? msg.recipientId : msg.senderId,
            subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
            body: `\n\n\n--------------------------------\nOn ${new Date(msg.createdAt).toLocaleString()}, ${msg.senderName || msg.sender?.name || msg.sender?.username || 'Unknown'} wrote:\n> ${msg.body.replace(/\n/g, '\n> ')}`
        });
        setIsComposing(true);
        setSelectedMessage(null);
    };

    const onSend = async (e) => {
        e.preventDefault();
        setLoading(true);

        let success;
        if (activeFolder === 'CHATS') {
            success = await sendChatMessage(composeData.toUserId, composeData.body);
        } else {
            success = await sendMessage(composeData.toUserId, composeData.subject, composeData.body, composeData.id);
        }

        setLoading(false);
        if (success) {
            setIsComposing(false);
            if (activeFolder === 'CHATS') {
                // Already in chats, just refresh
                fetchConversations();
                setActiveThreadPartner(composeData.toUserId);
                setChatView('THREAD');
            } else {
                switchFolder('SENT');
            }
            showDialog({ title: 'Success', message: 'Message sent successfully.', type: 'success' });
        } else {
            showDialog({ title: 'Error', message: 'Failed to send message.', type: 'error' });
        }
    };

    const onSaveDraft = async () => {
        setLoading(true);
        const success = await saveDraft(composeData.toUserId, composeData.subject, composeData.body, composeData.id);
        setLoading(false);
        if (success) {
            setIsComposing(false);
            switchFolder('DRAFT');
            showDialog({ title: 'Saved', message: 'Message saved to drafts.', type: 'info' });
        }
    };

    const onArchive = async (id) => {
        const scope = (activeFolder === 'SENT' || activeFolder === 'DRAFT') ? 'SENDER' : 'RECIPIENT';
        await moveMessage(id, 'ARCHIVE', scope);
        setTimeout(() => fetchMessages(activeFolder), 100);
        if (selectedMessage?.id === id) setSelectedMessage(null);
    };

    const onDelete = async (id) => {
        const scope = (activeFolder === 'SENT' || activeFolder === 'DRAFT') ? 'SENDER' : 'RECIPIENT';
        await moveMessage(id, 'TRASH', scope);
        setTimeout(() => fetchMessages(activeFolder), 100);
        if (selectedMessage?.id === id) setSelectedMessage(null);
    };

    // ── Chat Handlers ─────────────────────────────────────────────
    const openConversation = (partnerId) => {
        fetchThread(partnerId);
        setChatView('THREAD');
    };

    const handleChatSend = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !activeThreadPartner) return;
        setChatSending(true);
        const result = await sendChatMessage(activeThreadPartner, chatInput.trim());
        setChatSending(false);
        if (result) {
            setChatInput('');
        }
    };

    // ── Formatters ────────────────────────────────────────────────
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

    const formatChatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

    const getPartnerName = () => {
        const conv = conversations.find(c => c.partnerId === activeThreadPartner);
        if (conv) return conv.partnerName;
        if (activeThread.length > 0) {
            const msg = activeThread[0];
            return msg.isMe ? msg.recipientName : msg.senderName;
        }
        return 'Chat';
    };

    // ── Render Message List Item ──────────────────────────────────
    const renderMessageItem = (msg) => {
        const isSelected = selectedMessage?.id === msg.id;
        const otherUser = (activeFolder === 'SENT' || activeFolder === 'DRAFT')
            ? (msg.recipientName || msg.recipient?.name || msg.recipient?.username || 'Unknown')
            : (msg.senderName || msg.sender?.name || msg.sender?.username || 'Unknown');

        return (
            <div
                key={msg.id}
                onClick={() => {
                    if (isComposing) return;
                    setSelectedMessage(msg);
                    if (!msg.isRead && activeFolder === 'INBOX') markMessageRead(msg.id);
                }}
                className={clsx(
                    "p-4 border-b dark:border-gray-700 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
                    isSelected ? "bg-blue-50 dark:bg-blue-900/10 border-l-4 border-l-blue-500" : "border-l-4 border-l-transparent",
                    !msg.isRead && activeFolder === 'INBOX' ? "font-semibold" : ""
                )}
            >
                <div className="flex justify-between items-start mb-1">
                    <span className="truncate text-sm text-sf-text font-medium w-40 block">
                        {(activeFolder === 'DRAFT' && !otherUser) ? '(No Recipient)' : otherUser}
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <div className="text-sm text-sf-text mb-1 truncate">{msg.subject}</div>
                <div className="text-xs text-sf-muted line-clamp-1">{msg.body}</div>
            </div>
        );
    };

    // ── Render Conversation List (for Chat tab) ───────────────────
    const renderConversationList = () => (
        <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
                    <MessageCircle size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">No conversations yet</p>
                    <p className="text-xs mt-2 text-gray-400">Start a new chat from the notification drawer</p>
                </div>
            ) : (
                conversations.map(conv => (
                    <div
                        key={conv.partnerId}
                        onClick={() => openConversation(conv.partnerId)}
                        className={clsx(
                            "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-800",
                            activeThreadPartner === conv.partnerId
                                ? "bg-blue-50 dark:bg-blue-900/10"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        )}
                    >
                        <div className="relative shrink-0">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-base shadow-sm">
                                {conv.partnerName.charAt(0).toUpperCase()}
                            </div>
                            {isOnline(conv.partnerId) && (
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full shadow-sm" />
                            )}
                            {conv.unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                                <h4 className={clsx("text-sm truncate", conv.unreadCount > 0 ? "font-bold text-sf-text" : "font-medium text-sf-text")}>
                                    {conv.partnerName}
                                </h4>
                                <span className={clsx("text-[11px] ml-2 shrink-0", conv.unreadCount > 0 ? "text-green-500 font-semibold" : "text-gray-400")}>
                                    {formatTime(conv.lastMessageAt)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                {conv.lastMessageIsMe && (
                                    conv.unreadCount === 0 ? <CheckCheck size={14} className="text-blue-400 shrink-0" /> : <Check size={14} className="text-gray-400 shrink-0" />
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
    );

    // ── Render Chat Thread (Bubble UI) ────────────────────────────
    const renderChatThread = () => {
        const grouped = groupMessagesByDate(activeThread);

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Thread Header */}
                <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center gap-3 bg-sf-surface">
                    <button
                        onClick={() => { setChatView('LIST'); setActiveThreadPartner(null); }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors md:hidden"
                    >
                        <ArrowLeft size={20} className="text-sf-muted" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
                        {getPartnerName().charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-sf-text">{getPartnerName()}</p>
                        {isOnline(activeThreadPartner) ? (
                            <p className="text-xs text-green-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> online
                            </p>
                        ) : (
                            <p className="text-xs text-gray-400">offline</p>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 bg-sf-canvas/40" style={{
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                }}>
                    {activeThread.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <MessageCircle size={40} className="mb-3 opacity-30" />
                            <p className="text-sm">No messages yet</p>
                            <p className="text-xs mt-1">Say hello! 👋</p>
                        </div>
                    ) : (
                        grouped.map((item, idx) => {
                            if (item.type === 'date') {
                                return (
                                    <div key={`date-${idx}`} className="flex items-center justify-center my-4">
                                        <span className="px-3 py-1 bg-white/80 dark:bg-gray-700/80 text-[11px] text-sf-muted rounded-lg shadow-sm font-medium backdrop-blur-sm">
                                            {item.label}
                                        </span>
                                    </div>
                                );
                            }
                            const msg = item.data;
                            const isMe = msg.isMe;
                            return (
                                <div key={msg.id} className={clsx("flex mb-1.5", isMe ? "justify-end" : "justify-start")}>
                                    <div className={clsx(
                                        "relative max-w-[70%] px-3 py-2 rounded-2xl shadow-sm",
                                        isMe
                                            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md"
                                            : "bg-white dark:bg-gray-700 text-sf-text rounded-bl-md border border-gray-100 dark:border-gray-600"
                                    )}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                                        <div className={clsx("flex items-center justify-end gap-1 mt-1", isMe ? "text-blue-100" : "text-sf-muted")}>
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
                <div className="border-t border-sf-divider bg-sf-surface px-4 py-3 relative">
                    {showEmojiPicker && (
                        <div
                            ref={emojiPickerRef}
                            className="absolute bottom-full left-4 mb-2 bg-sf-surface border border-sf-divider rounded-2xl shadow-xl p-2 z-50 grid grid-cols-6 gap-1 animate-in zoom-in-95"
                        >
                            {['😊', '😂', '👍', '🙏', '🔥', '❤️', '✅', '🚀', '🤔', '👀', '✨', '👋', '🎉', '🤝', '🙌', '💯', '📍', '🧪'].map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => setChatInput(prev => prev + emoji)}
                                    className="w-10 h-10 flex items-center justify-center text-xl hover:bg-sf-raised rounded-lg transition-colors"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                    <form onSubmit={handleChatSend} className="flex items-end gap-3">
                        <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={clsx(
                                "shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                showEmojiPicker ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" : "text-gray-400 hover:bg-sf-raised"
                            )}
                        >
                            <Smile size={20} />
                        </button>
                        <div className="flex-1">
                            <textarea
                                className="w-full rounded-2xl border border-sf-divider dark:bg-gray-700 dark:text-white text-sm px-4 py-2.5 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-24"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(e); } }}
                                placeholder="Type a message..."
                                rows={1}
                                style={{ minHeight: '40px' }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={chatSending || !chatInput.trim()}
                            className={clsx(
                                "shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm",
                                chatInput.trim()
                                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                            )}
                        >
                            <Send size={18} className={chatInput.trim() ? '' : 'opacity-50'} />
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    // ── Main Render ───────────────────────────────────────────────
    return (
        <div className="flex h-[600px] border dark:border-gray-700 rounded-xl overflow-hidden bg-sf-surface shadow-sm">
            {/* Sidebar */}
            <div className="w-48 md:w-64 bg-sf-canvas/50 border-r dark:border-gray-700 flex flex-col">
                <div className="p-4">
                    <button
                        onClick={() => handleCompose()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
                    >
                        <Edit3 size={18} /> Compose
                    </button>
                </div>

                <nav className="flex-1 space-y-1 p-2">
                    {/* Chat Tab — at the top */}
                    <button
                        onClick={() => switchFolder('CHATS')}
                        className={clsx("w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors", activeFolder === 'CHATS' ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm" : "text-sf-muted hover:bg-sf-raised")}
                    >
                        <div className="flex items-center gap-3"><MessageCircle size={18} /> Chats</div>
                        {conversations.filter(c => c.unreadCount > 0).length > 0 && (
                            <span className={clsx("text-xs rounded-full px-1.5 py-0.5 font-bold", activeFolder === 'CHATS' ? "bg-white/20 text-white" : "bg-green-500 text-white")}>
                                {conversations.reduce((acc, c) => acc + c.unreadCount, 0)}
                            </span>
                        )}
                    </button>

                    <div className="py-2 border-b dark:border-gray-700" />

                    <button
                        onClick={() => switchFolder('INBOX')}
                        className={clsx("w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors", activeFolder === 'INBOX' ? "bg-sf-surface text-blue-600 shadow-sm" : "text-sf-muted hover:bg-sf-raised")}
                    >
                        <div className="flex items-center gap-3"><Inbox size={18} /> Inbox</div>
                    </button>
                    <button
                        onClick={() => switchFolder('SENT')}
                        className={clsx("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors", activeFolder === 'SENT' ? "bg-sf-surface text-blue-600 shadow-sm" : "text-sf-muted hover:bg-sf-raised")}
                    >
                        <Send size={18} /> Sent
                    </button>
                    <button
                        onClick={() => switchFolder('DRAFT')}
                        className={clsx("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors", activeFolder === 'DRAFT' ? "bg-sf-surface text-blue-600 shadow-sm" : "text-sf-muted hover:bg-sf-raised")}
                    >
                        <FileText size={18} /> Drafts
                    </button>
                    <button
                        onClick={() => switchFolder('ARCHIVE')}
                        className={clsx("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors", activeFolder === 'ARCHIVE' ? "bg-sf-surface text-blue-600 shadow-sm" : "text-sf-muted hover:bg-sf-raised")}
                    >
                        <Archive size={18} /> Archive
                    </button>
                    <div className="pt-4 mt-4 border-t dark:border-gray-700">
                        <button
                            onClick={() => switchFolder('TRASH')}
                            className={clsx("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors", activeFolder === 'TRASH' ? "bg-sf-surface text-red-600 shadow-sm" : "text-sf-muted hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600")}
                        >
                            <Trash2 size={18} /> Trash
                        </button>
                    </div>
                </nav>
            </div>

            {/* ── Chat Tab Content ─────────────────────────────────────── */}
            {isChatTab ? (
                <div className="flex-1 flex overflow-hidden">
                    {/* Conversation List (always visible on desktop) */}
                    <div className={clsx(
                        "w-64 md:w-80 border-r dark:border-gray-700 flex flex-col bg-sf-surface",
                        chatView === 'THREAD' ? "hidden md:flex" : "flex"
                    )}>
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-semibold text-sf-text flex items-center gap-2">
                                <MessageCircle size={18} className="text-blue-500" /> Chats
                            </h3>
                            <button onClick={fetchConversations} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <RefreshCw size={16} />
                            </button>
                        </div>
                        {renderConversationList()}
                    </div>

                    {/* Thread Panel */}
                    <div className={clsx(
                        "flex-1 flex flex-col bg-gray-50/50 dark:bg-gray-900/20",
                        chatView === 'LIST' ? "hidden md:flex" : "flex"
                    )}>
                        {activeThreadPartner ? (
                            renderChatThread()
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <MessageCircle size={48} className="mb-4 opacity-20" />
                                <p className="text-sm">Select a conversation</p>
                                <p className="text-xs mt-1 text-gray-400">or start one from the notification drawer</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Formal Messages Content ─────────────────────────── */}
                    {/* Message List */}
                    <div className="w-64 md:w-80 border-r dark:border-gray-700 flex flex-col bg-sf-surface">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-semibold text-sf-text capitalize">{activeFolder.toLowerCase()}</h3>
                            <button onClick={() => fetchMessages(activeFolder)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><RefreshCw size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {messages.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">No messages</div>
                            ) : (
                                messages.map(renderMessageItem)
                            )}
                        </div>
                    </div>

                    {/* Message Detail / Compose */}
                    <div className="flex-1 flex flex-col bg-gray-50/50 dark:bg-gray-900/20">
                        {isComposing ? (
                            <div className="flex-1 flex flex-col p-6 overflow-y-auto animate-in fade-in duration-200">
                                <h3 className="text-lg font-bold text-sf-text mb-4">
                                    {composeData.id ? 'Edit Draft' : 'New Message'}
                                </h3>
                                <form onSubmit={onSend} className="space-y-4 flex-1 flex flex-col">
                                    <div>
                                        <label className="block text-sm font-medium text-sf-muted mb-1">To</label>
                                        <select
                                            className="w-full rounded-lg border-sf-divider dark:bg-gray-700 dark:text-white p-2.5"
                                            value={composeData.toUserId}
                                            onChange={e => setComposeData({ ...composeData, toUserId: e.target.value })}
                                            required={!composeData.id}
                                        >
                                            <option value="">Select Recipient...</option>
                                            {(user?.role === 'LAB_MANAGER' || user?.role === 'SUPER_ADMIN' || (user?.role && user.role.includes('MANAGER'))) && (
                                                <option value="BROADCAST">📢 Broadcast to All Staff</option>
                                            )}
                                            {directory.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.id === user?.id ? '📝 Note to Self' : (u.name || u.username)} ({u.role})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {activeFolder !== 'CHATS' && (
                                        <div>
                                            <label className="block text-sm font-medium text-sf-muted mb-1">Subject</label>
                                            <input
                                                type="text"
                                                className="w-full rounded-lg border-sf-divider dark:bg-gray-700 dark:text-white p-2.5"
                                                value={composeData.subject}
                                                onChange={e => setComposeData({ ...composeData, subject: e.target.value })}
                                                placeholder="Subject..."
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="flex-1 flex flex-col">
                                        <label className="block text-sm font-medium text-sf-muted mb-1">Message</label>
                                        <textarea
                                            className="flex-1 w-full rounded-lg border-sf-divider dark:bg-gray-700 dark:text-white p-3 resize-none focus:ring-2 focus:ring-blue-500"
                                            value={composeData.body}
                                            onChange={e => setComposeData({ ...composeData, body: e.target.value })}
                                            required
                                            placeholder="Type your message here..."
                                        />
                                    </div>
                                    <div className="flex justify-end gap-3 pt-2">
                                        {activeFolder !== 'CHATS' && (
                                            <button type="button" onClick={onSaveDraft} className="px-4 py-2 text-sf-muted hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2">
                                                <FileText size={18} /> Save Draft
                                            </button>
                                        )}
                                        <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 shadow-sm">
                                            <Send size={18} /> {loading ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : selectedMessage ? (
                            <div className="flex-1 flex flex-col p-6 overflow-y-auto animate-in fade-in duration-200">
                                <div className="border-b dark:border-gray-700 pb-4 mb-4">
                                    <h2 className="text-xl font-bold text-sf-text mb-2">{selectedMessage.subject}</h2>
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="space-y-1">
                                            <div className="font-medium text-gray-900 dark:text-gray-200 flex items-center gap-2">
                                                <User size={16} className="text-gray-500" />
                                                {activeFolder === 'SENT'
                                                    ? `To: ${selectedMessage.recipientName || selectedMessage.recipient?.name || selectedMessage.recipient?.username || 'Unknown'}`
                                                    : `From: ${selectedMessage.senderName || selectedMessage.sender?.name || selectedMessage.sender?.username || 'Unknown'}`}
                                            </div>
                                            <div className="text-gray-500 flex items-center gap-2">
                                                <Clock size={14} />
                                                {new Date(selectedMessage.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleReply(selectedMessage)} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 text-sm font-medium flex items-center gap-1">
                                                <Send size={14} className="scale-x-[-1]" /> Reply
                                            </button>
                                            {activeFolder === 'DRAFT' ? (
                                                <button onClick={() => handleCompose(selectedMessage)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg dark:hover:bg-blue-900/30" title="Edit Draft">
                                                    <Edit3 size={18} />
                                                </button>
                                            ) : (
                                                <>
                                                    {activeFolder !== 'ARCHIVE' && activeFolder !== 'TRASH' && (
                                                        <button onClick={() => onArchive(selectedMessage.id)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700" title="Archive">
                                                            <Archive size={18} />
                                                        </button>
                                                    )}
                                                    {activeFolder !== 'TRASH' && (
                                                        <button onClick={() => onDelete(selectedMessage.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20" title="Delete">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="whitespace-pre-wrap text-sf-text leading-relaxed font-sans">
                                    {selectedMessage.body}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <Mail size={48} className="mb-4 opacity-20" />
                                <p>Select a message to view</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default MessagingCenter;
