'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, MessageCircle, Send, ArrowLeft, User, Search, Pin,
  FileText, Image as ImageIcon, Link as LinkIcon, Trash2, Edit,
  Reply, Sparkles, Smile, Mic, Download, Copy, Bookmark, Share2, Archive,
  Check, CheckCheck, Info, X, Sparkle, AlertCircle, RefreshCw, MoreVertical,
  VolumeX, Ban, AlertTriangle, EyeOff, Trash, Clock, Settings, Key, Phone, Plus, Paperclip
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { useMicroAnimations } from '@/hooks/useMicroAnimations';
import GSAPModalWrapper from '@/components/GSAPModalWrapper';
import PhotoEditorModal from '@/components/PhotoEditorModal';

interface DBMessage {
  id?: string;
  tempId?: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  partner_id: string;
  partner_name: string;
  partner_avatar: string;
  partner_username?: string;
  partner_online?: boolean;
  partner_last_seen?: string;
  is_group?: boolean;
  members?: any[];
  sender_name?: string;
  sender_avatar?: string;
  sender_username?: string;
  body: string;
  read: boolean;
  type: string;
  attachments?: any[];
  reactions?: Record<string, string[]>;
  reply_to_message_id?: string | null;
  reply_to?: {
    id: string;
    body: string;
    type: string;
    sender_id: string;
    attachments?: any[];
  } | null;
  forwarded_from_message_id?: string | null;
  forwarded_sender_id?: string | null;
  forwarded?: boolean;
  deleted_at?: string | null;
  created_at: string;
  edited_at?: string | null;
  status?: 'sending' | 'sent' | 'read' | 'error';
}

const getRelativeTime = (isoDate: string | null) => {
  if (!isoDate) return 'Offline';
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last seen ${days}d ago`;
};

const EMPTY_USERNAMES: string[] = [];

const UserSearchSuggestions = ({ query, onSelect, excludeUsernames = EMPTY_USERNAMES, currentUserId }: { query: string, onSelect: (uname: string, user?: any) => void, excludeUsernames?: string[], currentUserId?: string }) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const normalizedQuery = query.trim();
  const excludedUsernameKey = excludeUsernames.map((uname) => uname.toLowerCase()).sort().join('|');

  useEffect(() => {
    if (!normalizedQuery) {
      setSuggestions((prev) => prev.length ? [] : prev);
      return;
    }
    const timer = setTimeout(async () => {
      const excludedUsernames = new Set(excludedUsernameKey ? excludedUsernameKey.split('|') : []);
      const { data } = await supabase.from('profiles')
        .select('username, full_name, avatar_url, id, online')
        .ilike('username', `%${normalizedQuery}%`)
        .limit(5);
      if (data) {
        setSuggestions(data.filter(u => 
          !excludedUsernames.has(u.username.toLowerCase()) && 
          u.id !== currentUserId
        ));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [normalizedQuery, excludedUsernameKey, currentUserId]);

  if (!normalizedQuery || suggestions.length === 0) return null;

  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', zIndex: 100, marginTop: '4px', overflow: 'hidden', boxShadow: '0 14px 32px var(--card-shadow)' }}>
      {suggestions.map(u => (
        <button type="button" key={u.username} onClick={() => onSelect(u.username, u)} style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', border: 'none', borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', background: 'transparent', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Avatar src={u.avatar_url} name={u.full_name || u.username} size={32} />
            <span style={{ position: 'absolute', right: -1, bottom: -1, width: 9, height: 9, borderRadius: '50%', background: u.online ? '#10b981' : '#6b7280', border: '2px solid var(--bg-card)' }} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>{u.full_name || u.username}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

const Avatar = ({ src, name, size = 44, rounded = '50%' }: { src?: string | null; name: string; size?: number; rounded?: string }) => {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;

  if (showImage) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: rounded, objectFit: 'cover', display: 'block' }}
      />
    );
  }

  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        flexShrink: 0
      }}
    >
      <User size={Math.max(16, Math.floor(size * 0.48))} />
    </div>
  );
};

export default function ChatsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#070708' }}>
        <Loader2 size={30} className="spin" style={{ color: '#6366f1' }} />
      </div>
    }>
      <ChatsPageContent />
    </Suspense>
  );
}

function ChatsPageContent() {
  const { animateListEntrance, animateMessageEntrance, animateModalEntrance } = useMicroAnimations();
  const sidebarListRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  
  // Helper to format timestamps to relative time (e.g. "12m", "1h", "2d")
  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d`;
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [sharedSearchQuery, setSharedSearchQuery] = useState('');
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  
  // Right sidebar
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'media' | 'files' | 'links'>('media');
  
  // Modals & AI dropdowns
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [aiSummaryData, setAiSummaryData] = useState<{ summary?: string, actionItems?: string[] } | null>(null);

  // New Chat Modal state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState('');
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [newChatError, setNewChatError] = useState('');

  // Holds the profile of the person we're opening a chat with before any message has been sent.
  // This lets the chat window render even when there are no existing messages.
  const [pendingChatProfile, setPendingChatProfile] = useState<{
    id: string;
    full_name: string;
    avatar_url: string;
    username?: string;
    online?: boolean;
    last_seen?: string | null;
  } | null>(null);
  const [pinnedChatIds, setPinnedChatIds] = useState<string[]>([]);
  const [savedMessageIds, setSavedMessageIds] = useState<string[]>([]);
  const [mutedChatIds, setMutedChatIds] = useState<string[]>([]);
  const [archivedChatIds, setArchivedChatIds] = useState<string[]>([]);
  const [manualUnreadChatIds, setManualUnreadChatIds] = useState<string[]>([]);
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  const [chatContextMenu, setChatContextMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const [pendingDeleteChatId, setPendingDeleteChatId] = useState<string | null>(null);
  const [showDeleteAllChatsConfirm, setShowDeleteAllChatsConfirm] = useState(false);
  const [showGlobalChatMenu, setShowGlobalChatMenu] = useState(false);
  const [showNewChatMenu, setShowNewChatMenu] = useState(false);
  const chatLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [aiToneEnhanceOpen, setAiToneEnhanceOpen] = useState(false);
  const [enhancingMessage, setEnhancingMessage] = useState(false);


  // Chat management states
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  // Attachment states
  const [attachments, setAttachments] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [editingAttachmentIndex, setEditingAttachmentIndex] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<DBMessage | null>(null);

  // Messages lists (local state for optimistic UI updates)
  const [localMessages, setLocalMessages] = useState<DBMessage[]>([]);
  const [failedMessages, setFailedMessages] = useState<any[]>([]);
  const [forwardingMessage, setForwardingMessage] = useState<DBMessage | null>(null);
  const [forwardTargetIds, setForwardTargetIds] = useState<string[]>([]);
  const [isForwarding, setIsForwarding] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [nextPrediction, setNextPrediction] = useState('');
  const [aiAssistantLoading, setAiAssistantLoading] = useState(false);
  const [rewriteOptions, setRewriteOptions] = useState<Record<string, string> | null>(null);

  // Typing indicators
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const activeTypingChannelRef = useRef<any>(null);
  const activeConversationIdRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const targetUserId = searchParams.get('userId');

  const mergeMessages = (current: DBMessage[], incoming: DBMessage[]) => {
    const byKey = new Map<string, DBMessage>();
    [...current, ...incoming].forEach((message) => {
      const key = message.id || message.tempId;
      if (!key) return;
      const existing = byKey.get(key);
      byKey.set(key, { ...(existing || {}), ...message });
    });
    return Array.from(byKey.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const matchesChatThread = (message: DBMessage, chatId: string | null) => {
    if (!chatId) return false;
    return message.conversation_id === chatId || message.partner_id === chatId;
  };

  const [activeChatOnline, setActiveChatOnline] = useState<boolean>(false);
  const [activeChatLastSeen, setActiveChatLastSeen] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPinnedChatIds(JSON.parse(localStorage.getItem('paoblem_pinned_chats') || '[]'));
      setSavedMessageIds(JSON.parse(localStorage.getItem('paoblem_saved_messages') || '[]'));
      setMutedChatIds(JSON.parse(localStorage.getItem('paoblem_muted_chats') || '[]'));
      setArchivedChatIds(JSON.parse(localStorage.getItem('paoblem_archived_chats') || '[]'));
      setManualUnreadChatIds(JSON.parse(localStorage.getItem('paoblem_manual_unread_chats') || '[]'));
    } catch {
      setPinnedChatIds([]);
      setSavedMessageIds([]);
      setMutedChatIds([]);
      setArchivedChatIds([]);
      setManualUnreadChatIds([]);
    }
  }, []);

  const persistPinnedChats = (next: string[]) => {
    setPinnedChatIds(next);
    localStorage.setItem('paoblem_pinned_chats', JSON.stringify(next));
  };

  const persistSavedMessages = (next: string[]) => {
    setSavedMessageIds(next);
    localStorage.setItem('paoblem_saved_messages', JSON.stringify(next));
  };

  const persistMutedChats = (next: string[]) => {
    setMutedChatIds(next);
    localStorage.setItem('paoblem_muted_chats', JSON.stringify(next));
  };

  const persistArchivedChats = (next: string[]) => {
    setArchivedChatIds(next);
    localStorage.setItem('paoblem_archived_chats', JSON.stringify(next));
  };

  const persistManualUnreadChats = (next: string[]) => {
    setManualUnreadChatIds(next);
    localStorage.setItem('paoblem_manual_unread_chats', JSON.stringify(next));
  };

  // Load Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoadingSession(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch all messages
  const { data: messages = [], isLoading, refetch } = useQuery<DBMessage[]>({
    queryKey: ['chats-messages', session?.access_token],
    queryFn: async () => {
      if (!session?.access_token) return [];
      const res = await fetch('/api/messages', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.messages || [];
    },
    enabled: !!session?.access_token,
    refetchInterval: 15000, // Reduced interval since we have real-time postgres_changes
  });

  // Keep local messages updated with fetched messages.
  // Guard: only update state when the merged result actually differs to prevent
  // an infinite render loop (mergeMessages always creates a new array reference).
  useEffect(() => {
    if (messages.length === 0) return;
    setLocalMessages(prev => {
      const merged = mergeMessages(prev, messages);
      // Reference-stable check: if lengths match and every id+body+status is the same, skip the update.
      if (
        prev.length === merged.length &&
        prev.every((m, i) => m.id === merged[i]?.id && m.body === merged[i]?.body && m.status === merged[i]?.status)
      ) {
        return prev;
      }
      return merged;
    });
  }, [messages]);

  // Fetch target user's details if we came from their profile
  const { data: targetProfileData } = useQuery({
    queryKey: ['target-chat-profile', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return null;
      const res = await fetch(`/api/profile?userId=${targetUserId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!targetUserId,
  });

  // Request Notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Active Conversation ID helper
  const activeConversationId = useMemo(() => {
    if (!activeChatId) return null;
    const msg = localMessages.find(m => matchesChatThread(m, activeChatId));
    return msg?.conversation_id || activeChatId;
  }, [activeChatId, localMessages]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`chat-global:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chats-messages', session.access_token] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chats-messages', session.access_token] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chats-messages', session.access_token] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'read_receipts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chats-messages', session.access_token] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, session?.access_token, queryClient]);

  // Real-time separate channel subscriptions (chat, presence, typing)
  useEffect(() => {
    if (!session?.user?.id || !activeChatId) {
      setActiveChatOnline(false);
      setActiveChatLastSeen(null);
      return;
    }

    const currentConvId = activeConversationId || activeChatId;

    // 1. Messages Channel: chat:{conversationId}
    const chatChannel = supabase.channel(`chat:${currentConvId}`);
    
    chatChannel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${currentConvId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as any;
          
          // Format message
          const isMe = newMsg.sender_id === session.user.id;
          
          setLocalMessages(prev => {
            // Check if message already exists (optimistic update replacement)
            const exists = prev.some(m => m.id === newMsg.id || m.tempId === newMsg.id);
            if (exists) return prev;
            
            const partnerInfo = activeChatInfo || {
              partnerName: 'Member',
              partnerAvatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${newMsg.sender_id}`
            };

            const formatted: DBMessage = {
              id: newMsg.id,
              conversation_id: newMsg.conversation_id,
              sender_id: newMsg.sender_id,
              recipient_id: isMe ? activeChatId : session.user.id,
              partner_id: activeChatId,
              partner_name: partnerInfo.partnerName,
              partner_avatar: partnerInfo.partnerAvatar,
              body: newMsg.content || '',
              read: false,
              type: newMsg.type || 'TEXT',
              attachments: [],
              created_at: newMsg.created_at,
              status: 'sent'
            };

            // Trigger notification if not me
            if (!isMe && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('New Message', {
                body: formatted.body || 'You received a new message.',
                icon: '/favicon.ico'
              });
            }

            return [formatted, ...prev];
          });
          scrollToBottom('smooth');
        } else if (payload.eventType === 'UPDATE') {
          const updatedMsg = payload.new as any;
          setLocalMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, body: updatedMsg.content, edited_at: updatedMsg.edited_at } : m));
        } else if (payload.eventType === 'DELETE') {
          const deletedMsg = payload.old as any;
          setLocalMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'read_receipts'
      }, (payload) => {
        // Read receipt added/updated -> update seen status in real-time
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const receipt = payload.new as any;
          setLocalMessages(prev => prev.map(m => {
            if (m.id === receipt.message_id) {
              return { ...m, read: true, status: 'read' };
            }
            return m;
          }));
        }
      })
      .subscribe();

    // 2. Presence Channel: presence:{conversationId}
    const presenceChannel = supabase.channel(`presence:${currentConvId}`);
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        let partnerIsOnline = false;
        let partnerLastSeenTime: string | null = null;

        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id === activeChatId) {
              partnerIsOnline = true;
            }
            if (p.user_id === activeChatId && p.last_seen) {
              partnerLastSeenTime = p.last_seen;
            }
          });
        });

        setActiveChatOnline(partnerIsOnline);
        if (partnerLastSeenTime) {
          setActiveChatLastSeen(partnerLastSeenTime);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: session.user.id,
            last_seen: new Date().toISOString()
          });
        }
      });

    // 3. Typing Channel: typing:{conversationId}
    const typingChannel = supabase.channel(`typing:${currentConvId}`);
    let localTypingTimeout: any = null;
    activeTypingChannelRef.current = typingChannel;

    typingChannel
      .on('broadcast', { event: 'typing:start' }, (payload: any) => {
        if (payload.payload?.userId !== session.user.id) {
          setPartnerTyping(true);
          
          // Auto-clear safety timeout
          if (localTypingTimeout) clearTimeout(localTypingTimeout);
          localTypingTimeout = setTimeout(() => {
            setPartnerTyping(false);
          }, 2000);
        }
      })
      .on('broadcast', { event: 'typing:stop' }, (payload: any) => {
        if (payload.payload?.userId !== session.user.id) {
          setPartnerTyping(false);
          if (localTypingTimeout) clearTimeout(localTypingTimeout);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(typingChannel);
      if (activeTypingChannelRef.current === typingChannel) activeTypingChannelRef.current = null;
      if (localTypingTimeout) clearTimeout(localTypingTimeout);
    };
  }, [activeChatId, session?.user?.id, activeConversationId]);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Auto-scroll to bottom when messages change or a new chat is opened
  useEffect(() => {
    scrollToBottom('auto');
  }, [messages, localMessages, activeChatId]);

  // Persist targetProfileData into pendingChatProfile as soon as it loads
  useEffect(() => {
    if (targetUserId && targetProfileData?.profile) {
      setPendingChatProfile({
        id: targetUserId,
        full_name: targetProfileData.profile.full_name || 'Member',
        avatar_url: targetProfileData.profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUserId}`,
        username: targetProfileData.profile.username,
        online: targetProfileData.profile.online || false,
        last_seen: targetProfileData.profile.last_seen || null,
      });
    }
  }, [targetUserId, targetProfileData]);

  // Set active partner ID
  useEffect(() => {
    if (targetUserId) {
      setActiveChatId(targetUserId);
      setMobileConversationOpen(true);
      // Clean the URL so the ?userId= param doesn't re-trigger on every render
      router.replace('/chats');
    } else if (messages.length > 0 && !activeChatId) {
      setActiveChatId(messages[0].partner_id);
    }
  }, [targetUserId, messages]);

  // Handle Visibility and Focus for Seen Receipts
  useEffect(() => {
    if (!activeChatId || !session?.access_token) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const msgId = entry.target.getAttribute('data-message-id');
          if (msgId && document.visibilityState === 'visible' && document.hasFocus()) {
            // Mark specific message read locally
            setLocalMessages(prev => prev.map(m => m.id === msgId ? { ...m, read: true, status: 'read' } : m));
            
            // PUT API call to persist read status
            fetch('/api/messages', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
              body: JSON.stringify({ id: msgId, read: true })
            }).catch(console.error);

            observer.unobserve(entry.target);
          }
        }
      });
    }, {
      root: messagesContainerRef.current,
      threshold: 0.1
    });

    const checkAndObserve = () => {
      const unreadElements = messagesContainerRef.current?.querySelectorAll('.unread-partner-message');
      unreadElements?.forEach(el => observer.observe(el));
    };

    checkAndObserve();

    const handleWindowEvents = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        checkAndObserve();
      }
    };

    window.addEventListener('visibilitychange', handleWindowEvents);
    window.addEventListener('focus', handleWindowEvents);

    return () => {
      observer.disconnect();
      window.removeEventListener('visibilitychange', handleWindowEvents);
      window.removeEventListener('focus', handleWindowEvents);
    };
  }, [localMessages, activeChatId, session?.access_token]);

  // Handle typing state broadcast
  const handleTyping = () => {
    if (!session || !activeChatId) return;

    if (!isTyping) {
      setIsTyping(true);
      activeTypingChannelRef.current?.send({
        type: 'broadcast',
        event: 'typing:start',
        payload: { userId: session.user.id }
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      activeTypingChannelRef.current?.send({
        type: 'broadcast',
        event: 'typing:stop',
        payload: { userId: session.user.id }
      });
    }, 2000);
  };

  // Auto-expand composer field
  useEffect(() => {
    const textarea = composerTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  useEffect(() => {
    const context = activeChatId
      ? localMessages
          .filter(m => matchesChatThread(m, activeChatId))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(-12)
      : [];
    if (!activeChatId || !session?.access_token || context.length === 0) {
      setSmartReplies([]);
      setNextPrediction('');
      return;
    }
    const timer = setTimeout(async () => {
      setAiAssistantLoading(true);
      try {
        const [suggestionsRes, predictionRes] = await Promise.all([
          fetch('/api/ai/chat-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ mode: 'suggestions', conversationId: activeConversationId, messages: context })
          }),
          fetch('/api/ai/chat-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ mode: 'prediction', conversationId: activeConversationId, messages: context })
          })
        ]);
        if (suggestionsRes.ok) {
          const data = await suggestionsRes.json();
          setSmartReplies(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : []);
        }
        if (predictionRes.ok) {
          const data = await predictionRes.json();
          setNextPrediction(typeof data.prediction === 'string' ? data.prediction : '');
        }
      } catch {
        setSmartReplies([]);
        setNextPrediction('');
      } finally {
        setAiAssistantLoading(false);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [activeChatId, activeConversationId, session?.access_token, localMessages.slice(0, 6).map(m => `${m.id}:${m.body}`).join('|')]);

  // Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ partnerId, body, type = 'TEXT', atts = [], replyToId, clientMutationId }: { partnerId: string; body: string; type?: string; atts?: any[]; replyToId?: string | null; clientMutationId: string }) => {
      const existing = localMessages.find(m => matchesChatThread(m, partnerId));
      const conversationId = existing?.conversation_id;
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          conversationId,
          recipientId: conversationId ? undefined : partnerId, 
          body, 
          type, 
          attachments: atts,
          replyToMessageId: replyToId,
          clientMutationId,
        }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onMutate: async (newMsg) => {
      const tempId = newMsg.clientMutationId;
      const existing = localMessages.find(m => matchesChatThread(m, activeChatId));
      const conversationId = existing?.conversation_id || '';
      const optimisticMsg: DBMessage = {
        id: tempId,
        tempId: tempId,
        conversation_id: conversationId || '',
        sender_id: session.user.id,
        recipient_id: newMsg.partnerId,
        partner_id: newMsg.partnerId,
        partner_name: activeChatInfo?.partnerName || 'Member',
        partner_avatar: activeChatInfo?.partnerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${newMsg.partnerId}`,
        body: newMsg.body,
        read: false,
        type: newMsg.type || 'TEXT',
        attachments: newMsg.atts || [],
        reply_to_message_id: newMsg.replyToId || null,
        reply_to: replyToMessage ? {
          id: replyToMessage.id || '',
          body: replyToMessage.body,
          type: replyToMessage.type,
          sender_id: replyToMessage.sender_id,
          attachments: replyToMessage.attachments,
        } : null,
        created_at: new Date().toISOString(),
        status: 'sending'
      };
      setLocalMessages(prev => [optimisticMsg, ...prev]);
      scrollToBottom('smooth');
      return { tempId };
    },
    onError: (err, newMsg, context: any) => {
      setLocalMessages(prev => prev.filter(m => m.id !== context?.tempId && m.tempId !== context?.tempId));
      setFailedMessages(prev => [...prev, { partnerId: newMsg.partnerId, body: newMsg.body, type: newMsg.type, attachments: newMsg.atts }]);
    },
    onSuccess: (data, _newMsg, context: any) => {
      if (data?.message) {
        setLocalMessages(prev => prev.map(m => {
          if (m.tempId === context?.tempId || m.id === context?.tempId) {
            return {
              ...data.message,
              // Always preserve the partner_id as the chat key so activeChatId stays valid
              partner_id: m.partner_id,
              status: 'sent'
            };
          }
          return m;
        }));
        // Real message sent — the partner will now appear in the messages list, so
        // we no longer need the manually injected pending profile entry.
        setPendingChatProfile(prev => (prev?.id === _newMsg.partnerId ? null : prev));
      }
      queryClient.invalidateQueries({ queryKey: ['chats-messages', session?.access_token] });
    }
  });

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const msgToSend = newMessage;
    const attsToSend = attachments;
    const replyToId = replyToMessage?.id || null;
    if (!msgToSend.trim() && attsToSend.length === 0) return;
    if (!activeChatId) return;

    let msgType = 'TEXT';
    if (attsToSend.length > 0) {
      const firstType = attsToSend[0].file_type.toUpperCase();
      if (firstType.includes('IMAGE')) msgType = 'IMAGE';
      else msgType = 'FILE';
    } else if (msgToSend.startsWith('http')) {
      msgType = 'LINK';
    }

    // Clear input & attachments immediately for instant UI response
    setNewMessage('');
    setAttachments([]);
    setReplyToMessage(null);

    sendMessageMutation.mutate({ 
      partnerId: activeChatId, 
      body: msgToSend,
      type: msgType,
      atts: attsToSend,
      replyToId,
      clientMutationId: 'client-' + crypto.randomUUID()
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = (failedMsg: any, idx: number) => {
    setFailedMessages(prev => prev.filter((_, i) => i !== idx));
    sendMessageMutation.mutate({
      partnerId: failedMsg.partnerId,
      body: failedMsg.body,
      type: failedMsg.type,
      atts: failedMsg.attachments,
      replyToId: failedMsg.replyToId || null,
      clientMutationId: 'client-' + crypto.randomUUID()
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments(prev => [...prev, {
          url: reader.result as string,
          file_type: file.type,
          name: file.name,
          size: file.size
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // AI Summary handler
  const handleAISummary = async () => {
    if (!activeChatId) return;
    setLoadingSummary(true);
    setAiSummaryOpen(true);
    try {
      const activeChatMessages = localMessages.filter(m => matchesChatThread(m, activeChatId));
      const res = await fetch('/api/ai/chat-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: 'summary', conversationId: activeConversationId, messages: activeChatMessages.slice(-40) })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummaryData({
          summary: data.summary,
          actionItems: data.actionItems || [],
          keyPoints: data.keyPoints || [],
          decisions: data.decisions || [],
        } as any);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // --- Chat Management Handlers ---
  const handleClearChat = async () => {
    if (!activeChatId || !session?.access_token) return;
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          conversationId: activeChatId,
          type: 'CHAT_CLEARED',
          body: 'Cleared chat'
        })
      });
      // Optimistically clear local UI
      setLocalMessages(prev => prev.filter(m => !matchesChatThread(m, activeChatId)));
      setShowConfirmClear(false);
      setShowChatMenu(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteChat = async (isCreator: boolean) => {
    if (!activeChatId || !session?.access_token) return;
    setIsDeletingChat(true);
    try {
      const action = isCreator ? 'delete' : 'leave';
      const res = await fetch(`/api/conversations/${activeChatId}?action=${action}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        // Remove from UI
        setLocalMessages(prev => prev.filter(m => !matchesChatThread(m, activeChatId)));
        setActiveChatId(null);
        setMobileConversationOpen(false);
        setRightSidebarOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingChat(false);
      setShowConfirmDelete(false);
      setShowChatMenu(false);
    }
  };



  const openDirectChatByUsername = async (username: string) => {
    if (!username.trim()) return;
    setNewChatLoading(true);
    setNewChatError('');

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('username', username.trim().toLowerCase()).single();
      if (error || !data) {
        setNewChatError('User not found. Please check the username.');
        return;
      }
      // Persist profile so chat window can render even before any message is sent
      setPendingChatProfile({
        id: data.id,
        full_name: data.full_name || data.username || 'Member',
        avatar_url: data.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.id}`,
        username: data.username,
        online: data.online || false,
        last_seen: data.last_seen || null,
      });
      setIsNewChatModalOpen(false);
      setNewChatUsername('');
      openConversation(data.id);
    } catch (err: any) {
      setNewChatError('An error occurred. Please try again.');
    } finally {
      setNewChatLoading(false);
    }
  };

  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    await openDirectChatByUsername(newChatUsername);
  };



  // AI Tone Enhancer handler
  const handleAIEnhance = async (tone: string) => {
    if (!newMessage.trim()) return;
    setEnhancingMessage(true);
    try {
      const res = await fetch('/api/ai/chat-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: 'rewrite', draft: newMessage, tone, conversationId: activeConversationId })
      });
      if (res.ok) {
        const data = await res.json();
        setRewriteOptions(data);
        setNewMessage(data[tone] || data.professional || newMessage);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEnhancingMessage(false);
      setAiToneEnhanceOpen(false);
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    setLocalMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const currentReactions = m.reactions || {};
      const userList = currentReactions[emoji] || [];
      const index = userList.indexOf(session.user.id);
      if (index > -1) {
        userList.splice(index, 1);
      } else {
        userList.push(session.user.id);
      }
      return {
        ...m,
        reactions: {
          ...currentReactions,
          [emoji]: userList
        }
      };
    }));
  };

  const openConversation = (chatId: string) => {
    setActiveChatId(chatId);
    setMobileConversationOpen(true);
    setChatContextMenu(null);
    persistManualUnreadChats(manualUnreadChatIds.filter(id => id !== chatId));
  };

  const openChatContextMenu = (chatId: string, x: number, y: number) => {
    setChatContextMenu({ chatId, x, y });
    setShowGlobalChatMenu(false);
    setShowNewChatMenu(false);
  };

  const togglePinChat = (chatId: string) => {
    const next = pinnedChatIds.includes(chatId)
      ? pinnedChatIds.filter(id => id !== chatId)
      : [chatId, ...pinnedChatIds];
    persistPinnedChats(next);
    setShowChatMenu(false);
  };

  const toggleSaveMessage = (messageId: string) => {
    const next = savedMessageIds.includes(messageId)
      ? savedMessageIds.filter(id => id !== messageId)
      : [messageId, ...savedMessageIds];
    persistSavedMessages(next);
  };

  const handleCopyMessage = async (body: string) => {
    if (!body.trim()) return;
    await navigator.clipboard?.writeText(body);
  };

  const handleShareMessage = async (msg: DBMessage) => {
    const text = msg.body || 'Shared from Paoblem chat';
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(text);
  };

  const openForwardModal = (msg: DBMessage) => {
    setForwardingMessage(msg);
    setForwardTargetIds([]);
    setActiveActionMessageId(null);
  };

  const submitForward = async () => {
    if (!forwardingMessage || !session?.access_token || forwardTargetIds.length === 0) return;
    setIsForwarding(true);
    try {
      await Promise.all(forwardTargetIds.map((chatId) => {
        const existing = localMessages.find(m => m.conversation_id === chatId || m.partner_id === chatId);
        const conversationId = existing?.conversation_id || chatId;
        const isConversationId = !!existing?.conversation_id || chatId === activeConversationIdRef.current;
        return fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({
            conversationId: isConversationId ? conversationId : undefined,
            recipientId: !isConversationId ? chatId : undefined,
            body: forwardingMessage.body,
            type: forwardingMessage.type,
            attachments: forwardingMessage.attachments || [],
            forwardedFromMessageId: forwardingMessage.id,
            forwardedSenderId: forwardingMessage.sender_id,
            clientMutationId: 'forward-' + crypto.randomUUID(),
          })
        });
      }));
      setForwardingMessage(null);
      setForwardTargetIds([]);
      queryClient.invalidateQueries({ queryKey: ['chats-messages', session.access_token] });
    } finally {
      setIsForwarding(false);
    }
  };

  const handleDeleteMessage = async (messageId: string, mode: 'me' | 'everyone' = 'me') => {
    if (!session?.access_token) return;
    const originalMessages = localMessages;
    if (mode === 'me') {
      setLocalMessages(prev => prev.filter(m => m.id !== messageId));
    } else {
      setLocalMessages(prev => prev.map(m => m.id === messageId ? { ...m, body: 'This message was deleted', deleted_at: new Date().toISOString(), attachments: [] } : m));
    }
    setActiveActionMessageId(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ messageId, mode })
      });
      if (!res.ok) throw new Error('Failed to delete message');
    } catch (err) {
      console.error(err);
      setLocalMessages(originalMessages);
    }
  };

  const startMessageEdit = (msg: DBMessage) => {
    setEditingMessageId(msg.id || null);
    setEditingMessageText(msg.body);
    setActiveActionMessageId(null);
  };

  const saveMessageEdit = async () => {
    if (!editingMessageId || !editingMessageText.trim() || !session?.access_token) return;
    const original = localMessages.find(m => m.id === editingMessageId);
    const nextBody = editingMessageText.trim();
    setLocalMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, body: nextBody, edited_at: new Date().toISOString() } : m));
    setEditingMessageId(null);
    setEditingMessageText('');

    try {
      const res = await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ messageId: editingMessageId, body: nextBody })
      });
      if (!res.ok) throw new Error('Failed to edit message');
      queryClient.invalidateQueries({ queryKey: ['chats-messages', session.access_token] });
    } catch (err) {
      console.error(err);
      if (original) {
        setLocalMessages(prev => prev.map(m => m.id === editingMessageId ? original : m));
      }
    }
  };

  const startReply = (msg: DBMessage) => {
    setReplyToMessage(msg);
    setActiveActionMessageId(null);
    composerTextareaRef.current?.focus();
  };

  const jumpToMessage = (messageId: string) => {
    document.querySelector(`[data-message-id="${messageId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleDeleteConversationLocal = (chatId: string) => {
    setLocalMessages(prev => prev.filter(m => (m.conversation_id || m.partner_id) !== chatId));
    setPinnedChatIds(prev => {
      const next = prev.filter(id => id !== chatId);
      localStorage.setItem('paoblem_pinned_chats', JSON.stringify(next));
      return next;
    });
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMobileConversationOpen(false);
      setRightSidebarOpen(false);
    }
  };

  const confirmDeleteChat = async () => {
    if (!pendingDeleteChatId || !session?.access_token) return;
    const chatId = pendingDeleteChatId;
    setIsDeletingChat(true);
    try {
      await fetch(`/api/conversations/${chatId}?action=leave`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      handleDeleteConversationLocal(chatId);
    } catch (err) {
      console.error(err);
    } finally {
      setPendingDeleteChatId(null);
      setIsDeletingChat(false);
      setChatContextMenu(null);
    }
  };

  const handleDeleteAllChatsLocal = async () => {
    if (session?.access_token) {
      await Promise.all(Object.keys(chatGroups).map(chatId => fetch(`/api/conversations/${chatId}?action=leave`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      }).catch(() => null)));
    }
    setLocalMessages([]);
    persistPinnedChats([]);
    setActiveChatId(null);
    setMobileConversationOpen(false);
    setRightSidebarOpen(false);
    setShowDeleteAllChatsConfirm(false);
    setShowGlobalChatMenu(false);
  };

  const markChatUnread = (chatId: string) => {
    persistManualUnreadChats(manualUnreadChatIds.includes(chatId) ? manualUnreadChatIds : [chatId, ...manualUnreadChatIds]);
    setChatContextMenu(null);
  };

  const toggleMuteChat = (chatId: string) => {
    persistMutedChats(mutedChatIds.includes(chatId) ? mutedChatIds.filter(id => id !== chatId) : [chatId, ...mutedChatIds]);
    setChatContextMenu(null);
  };

  const archiveChat = (chatId: string) => {
    persistArchivedChats(archivedChatIds.includes(chatId) ? archivedChatIds : [chatId, ...archivedChatIds]);
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMobileConversationOpen(false);
    }
    setChatContextMenu(null);
  };

  const goToActiveProfile = () => {
    if (!activeChatInfo || activeChatInfo.isGroup) return;
    const username = activeChatInfo.partnerUsername || activeChatInfo.members?.find((m: any) => m.id === activeChatId)?.username;
    if (username) {
      router.push(`/user/${username}`);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  useEffect(() => {
    if (sidebarListRef.current) {
      animateListEntrance(sidebarListRef, '.conversation-card-item');
    }
  }, [localMessages.length, searchQuery, animateListEntrance]);

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#070708' }}>
        <Loader2 size={30} className="spin" style={{ color: '#6366f1' }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-container" style={{ backgroundColor: '#070708', minHeight: '100vh', color: '#f8f9fa' }}>
        <Navbar />
        <div className="main-content" style={{ justifyContent: 'center', padding: '4rem 1rem', display: 'flex', alignItems: 'center' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', backgroundColor: '#121214', border: '1px solid var(--border-color)', borderRadius: '24px' }}>
            <MessageCircle size={60} style={{ color: '#6366f1' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Outfit' }}>Sign in to view messages</h2>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-body)', lineHeight: '1.6' }}>Connect with builders, founders, and investors by messaging them directly.</p>
            <button className="btn btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 600 }} onClick={() => router.push('/')}>Go to Home</button>
          </div>
        </div>
      </div>
    );
  }

  // Group messages into conversations
  const chatGroups: Record<string, { 
    partnerName: string; 
    partnerAvatar: string; 
    partnerUsername?: string;
    latestMessage: string; 
    timestamp: string; 
    unread: boolean; 
    online: boolean; 
    lastSeen: string | null;
    pinned?: boolean;
    isGroup?: boolean;
    members?: any[];
  }> = {};

  localMessages.forEach((msg) => {
    const cid = msg.partner_id || msg.conversation_id;
    if (!chatGroups[cid]) {
      chatGroups[cid] = {
        partnerName: msg.partner_name,
        partnerAvatar: msg.partner_avatar,
        partnerUsername: msg.partner_username,
        latestMessage: msg.body,
        timestamp: msg.created_at,
        unread: (!msg.read && msg.sender_id !== session.user.id) || manualUnreadChatIds.includes(cid),
        online: msg.partner_online || false,
        lastSeen: msg.partner_last_seen || null,
        pinned: false,
        isGroup: msg.is_group || false,
        members: msg.members || []
      };
    }
  });

  // Inject pending chat profile so the window renders before any message is sent
  if (pendingChatProfile && !chatGroups[pendingChatProfile.id]) {
    chatGroups[pendingChatProfile.id] = {
      partnerName: pendingChatProfile.full_name,
      partnerAvatar: pendingChatProfile.avatar_url,
      partnerUsername: pendingChatProfile.username,
      latestMessage: 'Start a conversation...',
      timestamp: new Date().toISOString(),
      unread: false,
      online: pendingChatProfile.online || false,
      lastSeen: pendingChatProfile.last_seen || null,
      pinned: false,
      isGroup: false,
      members: []
    };
  }

  // Filter & Sort conversations list
  const sortedChats = Object.entries(chatGroups)
    .filter(([_, chat]) => {
      if (archivedChatIds.includes(_)) return false;
      if (searchQuery.trim() === '') return true;
      return chat.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
             chat.latestMessage.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const aPinned = pinnedChatIds.includes(a[0]) || a[1].pinned;
      const bPinned = pinnedChatIds.includes(b[0]) || b[1].pinned;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime();
    });

  const activeMessages = localMessages.filter(m => matchesChatThread(m, activeChatId)).reverse();
  const filteredActiveMessages = activeMessages.filter(m => {
    if (!chatSearchQuery.trim()) return true;
    return m.body.toLowerCase().includes(chatSearchQuery.toLowerCase());
  });

  const activeChatInfo = activeChatId ? chatGroups[activeChatId] : null;

  const latestReadMessageId = (() => {
    for (let i = filteredActiveMessages.length - 1; i >= 0; i--) {
      const m = filteredActiveMessages[i];
      if (m.sender_id === session?.user?.id && m.read) return m.id;
    }
    return null;
  })();

  // Shared media panels
  const sharedImages = activeMessages.filter(m => m.type === 'IMAGE' || m.attachments?.some(a => a.file_type.includes('image')));
  const sharedFiles = activeMessages.filter(m => m.type === 'FILE' || m.attachments?.some(a => !a.file_type.includes('image')));
  const sharedLinks = activeMessages.filter(m => m.type === 'LINK' || m.body.includes('http://') || m.body.includes('https://'));
  const bookmarkedMessages = activeMessages.filter(m => m.id && savedMessageIds.includes(m.id));
  const unreadChatsCount = sortedChats.filter(([_, chat]) => chat.unread).length;

  return (
    <div className="app-container chat-page-root">
      <Navbar />
      
      <div className="chat-layout">
          
          {/* 1. LEFT SIDEBAR: Redesigned with NO red or blue borders, uses 22%-25% width */}
          <div 
            className={`chat-sidebar ${mobileConversationOpen ? 'mobile-hidden' : ''}`}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              overflowY: 'auto'
            }}
          >
            {/* Search and Header */}
            <div className="chat-sidebar-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Messages
                  </h2>
                  {unreadChatsCount > 0 && (
                    <span style={{ backgroundColor: '#ffffff', color: '#000000', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '12px' }}>
                      {unreadChatsCount}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
                  <button
                    onClick={() => { setShowNewChatMenu(prev => !prev); setShowGlobalChatMenu(false); }}
                    style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--text-main)', color: 'var(--bg-card)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    title="Start chat"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </button>
                  <button
                    onClick={() => { setShowGlobalChatMenu(prev => !prev); setShowNewChatMenu(false); }}
                    className="chat-icon-btn"
                    title="Chat options"
                    style={{ width: '32px', height: '32px' }}
                  >
                    <MoreVertical size={17} />
                  </button>
                  {showNewChatMenu && (
                    <div className="chat-floating-menu" style={{ top: 'calc(100% + 0.5rem)', right: 0 }}>
                      <button className="chat-menu-item" onClick={() => { setIsNewChatModalOpen(true); setShowNewChatMenu(false); }}><MessageCircle size={14} />New Message</button>
                    </div>
                  )}
                  {showGlobalChatMenu && (
                    <div className="chat-floating-menu" style={{ top: 'calc(100% + 0.5rem)', right: 0 }}>
                      <button className="chat-menu-item chat-menu-item-danger" onClick={() => { setShowDeleteAllChatsConfirm(true); setShowGlobalChatMenu(false); }}><Trash2 size={14} />Delete All Chats</button>
                      <button className="chat-menu-item"><Archive size={14} />Archived Chats</button>
                      <button className="chat-menu-item"><Info size={14} />Settings</button>
                      <button className="chat-menu-item"><Info size={14} />Privacy</button>
                      <button className="chat-menu-item"><Info size={14} />Help</button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--search-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '999px',
                    padding: '0.65rem 2.5rem 0.65rem 1.25rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-main)',
                    outline: 'none',
                  }}
                />
                <Search size={16} style={{ position: 'absolute', right: '14px', top: '10px', color: '#6b7280' }} />
              </div>
            </div>
            
            {/* Conversations List */}
            <div ref={sidebarListRef} className="chat-sidebar-scroll">
              {isLoading && messages.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 size={24} className="spin" style={{ color: '#6366f1' }} />
                </div>
              ) : sortedChats.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <MessageCircle size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, color: '#6366f1' }} />
                  <p>No conversations found.</p>
                </div>
              ) : (
                sortedChats.map(([pid, chat], idx) => {
                  const isActive = activeChatId === pid;
                  const tags: any[] = 
                               chat.partnerName === 'Elmer Laverty' ? [{text: "Question", color: "#f59e0b", bg: "#f59e0b20", solid: true}, {text: "Developer", color: "#10b981", bg: "#10b98120", solid: true}] : 
                               chat.partnerName === 'Florencio Dorrance' ? [{text: "Some content", color: "#a1a1aa", outlined: true}] : 
                               chat.partnerName === 'Lavern Laboy' ? [{text: "Bug", color: "#f59e0b", bg: "#f59e0b20", solid: true}, {text: "Developer", color: "#10b981", bg: "#10b98120", solid: true}] :
                               chat.partnerName === 'Titus Kitamura' ? [{text: "Question", color: "#f59e0b", bg: "#f59e0b20", solid: true}, {text: "Some content", color: "#a1a1aa", outlined: true}] :
                               chat.partnerName === 'Geoffrey Mott' ? [{text: "Request", color: "#10b981", bg: "#10b98120", solid: true}] :
                               chat.partnerName === 'Alfonzo Schuessler' ? [{text: "Follow up", color: "#a1a1aa", outlined: true}] :
                               idx % 3 === 0 ? [{text: "Question", color: "#f59e0b", bg: "#f59e0b20", solid: true}, {text: "Developer", color: "#10b981", bg: "#10b98120", solid: true}] : 
                               idx % 3 === 1 ? [{text: "Some content", color: "#a1a1aa", outlined: true}] : 
                               [{text: "Bug", color: "#ef4444", bg: "#ef444420", solid: true}, {text: "Developer", color: "#10b981", bg: "#10b98120", solid: true}];


                  return (
                    <div 
                      key={pid} 
                      className="conversation-card-item"
                      onClick={() => openConversation(pid)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openChatContextMenu(pid, e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        if (chatLongPressTimerRef.current) clearTimeout(chatLongPressTimerRef.current);
                        const touch = e.touches[0];
                        chatLongPressTimerRef.current = setTimeout(() => openChatContextMenu(pid, touch.clientX, touch.clientY), 550);
                      }}
                      onTouchEnd={() => {
                        if (chatLongPressTimerRef.current) clearTimeout(chatLongPressTimerRef.current);
                      }}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '0.4rem',
                        padding: '0.85rem 1rem', 
                        cursor: 'pointer', 
                        borderRadius: '12px',
                        backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                        transition: 'all 0.2s',
                        marginBottom: '0.2rem',
                        border: isActive ? '1px solid var(--border-color)' : '1px solid transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                        <div style={{ position: 'relative' }}>
                          <Avatar src={chat.partnerAvatar} name={chat.partnerName} size={44} />
                          {chat.unread && (
                            <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', border: '2px solid #111111' }} />
                          )}
                          {chat.online && (
                            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid #111111' }} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: isActive ? 700 : 600, color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {(pinnedChatIds.includes(pid) || chat.pinned) && <Pin size={12} style={{ marginRight: '0.3rem', verticalAlign: '-1px', color: 'var(--accent-blue)' }} />}
                              {chat.partnerName}
                            </h4>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                              {formatRelativeTime(chat.timestamp)}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-body)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: chat.unread ? 600 : 400 }}>
                            {chat.latestMessage}
                          </p>
                          
                          {/* Tags row */}
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                            {tags.map((t, i) => (
                              <span 
                                key={i} 
                                style={{ 
                                  fontSize: '0.65rem', 
                                  fontWeight: 600, 
                                  padding: '0.15rem 0.5rem', 
                                  borderRadius: '12px',
                                  backgroundColor: t.solid ? t.bg : 'transparent',
                                  color: t.solid ? t.color : '#a1a1aa',
                                  border: t.outlined ? '1px solid #a1a1aa' : 'none'
                                }}
                              >
                                {t.text}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {chatContextMenu && (
            <div
              className="chat-floating-menu"
              style={{
                position: 'fixed',
                top: chatContextMenu.y,
                left: chatContextMenu.x,
                zIndex: 1000,
              }}
              onMouseLeave={() => setChatContextMenu(null)}
            >
              <button className="chat-menu-item" onClick={() => openConversation(chatContextMenu.chatId)}><MessageCircle size={14} />Open Chat</button>
              <button className="chat-menu-item" onClick={() => markChatUnread(chatContextMenu.chatId)}><Bookmark size={14} />Mark as Unread</button>
              <button className="chat-menu-item" onClick={() => toggleMuteChat(chatContextMenu.chatId)}><VolumeX size={14} />{mutedChatIds.includes(chatContextMenu.chatId) ? 'Unmute Notifications' : 'Mute Notifications'}</button>
              <button className="chat-menu-item" onClick={() => archiveChat(chatContextMenu.chatId)}><Archive size={14} />Archive Chat</button>
              <button className="chat-menu-item chat-menu-item-danger" onClick={() => { setPendingDeleteChatId(chatContextMenu.chatId); setChatContextMenu(null); }}><Trash2 size={14} />Delete Chat</button>
            </div>
          )}

          {/* 2. CENTER SECTION: Chat Window */}
          <div 
            className={`chat-center ${mobileConversationOpen ? 'mobile-active' : 'mobile-hidden'}`}
            style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden'
            }}
          >
            {activeChatId && activeChatInfo ? (
              <div className="chat-window">
                {/* Chat Header */}
                <div className="chat-window-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <button 
                      onClick={() => setMobileConversationOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'none' }}
                      className="back-btn-mobile"
                      title="Back to conversations"
                    >
                      <ArrowLeft size={20} style={{ marginRight: '0.25rem' }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => activeChatInfo.partnerAvatar && setLightboxImage(activeChatInfo.partnerAvatar)}
                      style={{ position: 'relative', padding: 0, border: 'none', background: 'transparent', cursor: activeChatInfo.partnerAvatar ? 'pointer' : 'default' }}
                      title="View profile photo"
                    >
                      <Avatar src={activeChatInfo.partnerAvatar} name={activeChatInfo.partnerName} size={48} />
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <button
                        type="button"
                        onClick={goToActiveProfile}
                        disabled={activeChatInfo.isGroup || !(activeChatInfo.partnerUsername || activeChatInfo.members?.some((m: any) => m.id === activeChatId && m.username))}
                        style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: activeChatInfo.isGroup ? 'default' : 'pointer' }}
                        title={activeChatInfo.isGroup ? 'Group chat' : 'Open profile'}
                      >
                        {activeChatInfo?.partnerName}
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeChatInfo?.online ? '#10b981' : '#6b7280' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {activeChatInfo?.online ? 'Online' : getRelativeTime(activeChatInfo?.lastSeen || null)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={() => activeChatId && togglePinChat(activeChatId)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-color)', width: '40px', height: '40px', borderRadius: '50%', color: pinnedChatIds.includes(activeChatId) ? 'var(--accent-blue)' : 'var(--text-main)', cursor: 'pointer' }}
                      title={pinnedChatIds.includes(activeChatId) ? 'Unpin chat' : 'Pin chat'}
                    >
                      <Pin size={17} />
                    </button>
                    <button
                      onClick={() => setChatSearchOpen(prev => !prev)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-color)', width: '40px', height: '40px', borderRadius: '50%', color: chatSearchOpen ? 'var(--accent-blue)' : 'var(--text-main)', cursor: 'pointer' }}
                      title="Search in chat"
                    >
                      <Search size={17} />
                    </button>
                    {!rightSidebarOpen && (
                      <button 
                        onClick={() => setRightSidebarOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-color)', width: '40px', height: '40px', borderRadius: '50%', color: 'var(--text-main)', cursor: 'pointer', transition: 'background-color 0.2s' }}
                        title="Open Directory"
                      >
                        <Info size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {chatSearchOpen && (
                  <div className="chat-toolbar" style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Search messages in this chat..."
                        value={chatSearchQuery}
                        onChange={(e) => setChatSearchQuery(e.target.value)}
                        autoFocus
                        style={{ width: '100%', backgroundColor: 'var(--search-bg)', border: '1px solid var(--border-color)', borderRadius: '999px', color: 'var(--text-main)', padding: '0.65rem 2.5rem 0.65rem 1rem', outline: 'none' }}
                      />
                      <Search size={16} style={{ position: 'absolute', right: '0.9rem', top: '0.7rem', color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                )}

                {/* Message List */}
                <div 
                  ref={messagesContainerRef}
                  className="chat-messages"
                  onClick={() => setActiveActionMessageId(null)}
                >
                  {filteredActiveMessages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', gap: '0.75rem' }}>
                      <User size={40} style={{ opacity: 0.3, color: '#6366f1' }} />
                      <p style={{ fontSize: '0.85rem' }}>Beginning of your conversation with {activeChatInfo?.partnerName}.</p>
                    </div>
                  ) : (
                    filteredActiveMessages.map((msg, index) => {
                      const isMe = msg.sender_id === session.user.id;
                      
                      // Message grouping
                      const prevMsg = index > 0 ? filteredActiveMessages[index - 1] : null;
                      const nextMsg = index < filteredActiveMessages.length - 1 ? filteredActiveMessages[index + 1] : null;

                      // Date separator check
                      const showDateSeparator = !prevMsg || 
                        new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
                      
                      const showDateSeparatorNext = !nextMsg || 
                        new Date(nextMsg.created_at).toDateString() !== new Date(msg.created_at).toDateString();

                      const isGroupedWithPrev = prevMsg && prevMsg.sender_id === msg.sender_id && !showDateSeparator;
                      const isGroupedWithNext = nextMsg && nextMsg.sender_id === msg.sender_id && !showDateSeparatorNext;

                      const isGrouped = isGroupedWithPrev;

                      const getBorderRadius = () => {
                        const base = '20px';
                        const small = '4px';
                        if (isMe) {
                          const tr = isGroupedWithPrev ? small : base;
                          const br = isGroupedWithNext ? small : base;
                          return `${base} ${tr} ${br} ${base}`;
                        } else {
                          const tl = isGroupedWithPrev ? small : base;
                          const bl = isGroupedWithNext ? small : base;
                          return `${tl} ${base} ${base} ${bl}`;
                        }
                      };

                      return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                          {showDateSeparator && (
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                              <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '0.2rem 0.65rem', borderRadius: '10px' }}>
                                {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}

                        <div 
                          data-message-id={msg.id}
                          className={`message-group ${(!msg.read && !isMe) ? 'unread-partner-message' : ''}`}
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            marginTop: isGrouped && !showDateSeparator ? '2px' : '0.85rem',
                            position: 'relative' 
                          }}
                        >
                          <div
                            className="message-bubble"
                            style={{
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              display: 'flex',
                              alignItems: 'flex-end',
                              gap: '0.75rem',
                            }}
                          >
                            {/* Partner Avatar - Only on the first message of the group */}
                            {!isMe && (
                            <div style={{ width: '36px', height: '36px', flexShrink: 0 }}>
                                {!isGroupedWithPrev && (
                                  <Avatar src={activeChatInfo.partnerAvatar} name={activeChatInfo.partnerName} size={36} />
                                )}
                              </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', flex: 1 }}>
                              <div
                                onClick={(e) => e.stopPropagation()}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setActiveActionMessageId(activeActionMessageId === msg.id ? null : (msg.id || null));
                                }}
                                onTouchStart={() => {
                                  if (messageLongPressTimerRef.current) clearTimeout(messageLongPressTimerRef.current);
                                  messageLongPressTimerRef.current = setTimeout(() => setActiveActionMessageId(msg.id || null), 550);
                                }}
                                onTouchMove={() => {
                                  if (messageLongPressTimerRef.current) clearTimeout(messageLongPressTimerRef.current);
                                }}
                                onTouchEnd={() => {
                                  if (messageLongPressTimerRef.current) clearTimeout(messageLongPressTimerRef.current);
                                }}
                                style={{
                                  padding: '0.65rem 1rem',
                                  borderRadius: getBorderRadius(),
                                  backgroundColor: isMe ? 'var(--text-main)' : 'var(--bg-card)',
                                  color: isMe ? 'var(--bg-card)' : 'var(--text-main)',
                                  fontSize: '0.95rem',
                                  lineHeight: '1.4',
                                  wordBreak: 'break-word',
                                  border: isMe ? 'none' : '1px solid var(--border-color)',
                                  position: 'relative'
                                }}
                              >
                                {msg.forwarded && (
                                  <div style={{ fontSize: '0.72rem', opacity: 0.78, marginBottom: '0.35rem', fontWeight: 700 }}>
                                    Forwarded
                                  </div>
                                )}
                                {msg.reply_to && (
                                  <button
                                    type="button"
                                    onClick={() => jumpToMessage(msg.reply_to!.id)}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderLeft: `3px solid ${isMe ? '#ffffff' : 'var(--accent-blue)'}`, background: isMe ? 'rgba(255,255,255,0.16)' : 'var(--bg-hover)', color: 'inherit', borderRadius: '8px', padding: '0.45rem 0.55rem', marginBottom: '0.45rem', cursor: 'pointer' }}
                                  >
                                    <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.75, fontWeight: 700 }}>Reply</span>
                                    <span style={{ display: 'block', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {msg.reply_to.body || 'Attachment'}
                                    </span>
                                  </button>
                                )}
                                {/* Attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: msg.body ? '0.4rem' : '0' }}>
                                    {msg.attachments.map((att, i) => (
                                      att.file_type?.includes('image') ? (
                                        <img 
                                          key={i} 
                                          src={att.url} 
                                          alt="attachment" 
                                          onClick={() => setLightboxImage(att.url)}
                                          style={{ maxWidth: '100%', borderRadius: '12px', maxHeight: '200px', objectFit: 'cover', border: `1px solid ${isMe ? '#5a5a5a' : '#e5e7eb'}`, cursor: 'pointer' }} 
                                        />
                                      ) : (
                                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', backgroundColor: isMe ? '#5a5a5a' : '#f3f4f6', borderRadius: '8px', color: 'inherit', textDecoration: 'none', fontSize: '0.8rem' }}>
                                          <FileText size={14} />
                                          <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name || 'Document'}</span>
                                        </a>
                                      )
                                    ))}
                                  </div>
                                )}
                                {editingMessageId === msg.id ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '220px' }}>
                                    <textarea
                                      value={editingMessageText}
                                      onChange={(e) => setEditingMessageText(e.target.value)}
                                      rows={3}
                                      autoFocus
                                      style={{ background: 'rgba(255,255,255,0.12)', color: 'inherit', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '0.6rem', resize: 'vertical', outline: 'none' }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                      <button type="button" onClick={() => { setEditingMessageId(null); setEditingMessageText(''); }} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                                      <button type="button" onClick={saveMessageEdit} style={{ border: 'none', background: isMe ? '#fff' : 'var(--accent-blue)', color: isMe ? 'var(--accent-blue)' : '#fff', borderRadius: '8px', padding: '0.35rem 0.7rem', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                                    </div>
                                  </div>
                                ) : (
                                  msg.body && <span style={{ whiteSpace: 'pre-wrap' }}>{msg.body}{msg.edited_at && <span style={{ opacity: 0.72, fontSize: '0.78rem' }}> (edited)</span>}</span>
                                )}
                              </div>
                              
                              {/* Reactions */}
                              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.25rem', paddingLeft: isMe ? '0' : '0.5rem', paddingRight: isMe ? '0.5rem' : '0' }}>
                                  {Object.entries(msg.reactions).map(([emoji, users], i) => (
                                    <span key={i} style={{ backgroundColor: '#2a2a2a', padding: '0.1rem 0.4rem', borderRadius: '12px', fontSize: '0.8rem', border: '1px solid #333' }}>
                                      {emoji} {users.length}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Read Receipt Indicator */}
                              {isMe && msg.id === latestReadMessageId && (
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem', paddingRight: '0.2rem', fontWeight: 500 }}>
                                  Seen
                                </div>
                              )}
                            </div>


                          </div>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`message-actions-overlay ${activeActionMessageId === msg.id ? 'active' : ''}`}
                            style={{
                              gap: '0.25rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '999px',
                              padding: '0.25rem',
                              boxShadow: '0 8px 24px var(--card-shadow)',
                              left: isMe ? 'auto' : '48px',
                              right: isMe ? '8px' : 'auto',
                              maxWidth: 'min(520px, calc(100vw - 72px))',
                              overflowX: 'auto',
                            }}
                          >
                            <button type="button" title="Reply" onClick={() => startReply(msg)} className="chat-icon-btn"><Reply size={14} /></button>
                            {isMe && <button type="button" title="Edit" onClick={() => startMessageEdit(msg)} className="chat-icon-btn"><Edit size={14} /></button>}
                            {['😢', '😡'].map((emoji) => (
                              <button key={emoji} type="button" title={`React ${emoji}`} onClick={() => msg.id && handleReaction(msg.id, emoji)} className="chat-icon-btn" style={{ fontSize: '0.86rem' }}>{emoji}</button>
                            ))}
                            {['👍', '❤️', '😂', '😮'].map((emoji) => (
                              <button key={emoji} type="button" title={`React ${emoji}`} onClick={() => msg.id && handleReaction(msg.id, emoji)} className="chat-icon-btn" style={{ fontSize: '0.86rem' }}>{emoji}</button>
                            ))}
                            <button type="button" title="Copy" onClick={() => handleCopyMessage(msg.body)} className="chat-icon-btn"><Copy size={14} /></button>
                            <button type="button" title={msg.id && savedMessageIds.includes(msg.id) ? 'Unsave' : 'Save'} onClick={() => msg.id && toggleSaveMessage(msg.id)} className="chat-icon-btn"><Bookmark size={14} fill={msg.id && savedMessageIds.includes(msg.id) ? 'currentColor' : 'none'} /></button>
                            <button type="button" title="Forward" onClick={() => openForwardModal(msg)} className="chat-icon-btn"><Share2 size={14} /></button>
                            <button type="button" title="Delete for me" onClick={() => msg.id && handleDeleteMessage(msg.id, 'me')} className="chat-icon-btn chat-icon-btn-danger"><EyeOff size={14} /></button>
                            {isMe && <button type="button" title="Delete for everyone" onClick={() => msg.id && handleDeleteMessage(msg.id, 'everyone')} className="chat-icon-btn chat-icon-btn-danger"><Trash2 size={14} /></button>}
                          </div>
                        </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Partner Typing Indicator */}
                {partnerTyping && (
                  <div className="typing-bubble-wrapper" style={{ padding: '0 1.25rem' }}>
                    <div className="typing-bubble">
                      <div className="typing-dots">
                        <span className="dot dot1" />
                        <span className="dot dot2" />
                        <span className="dot dot3" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="chat-composer">
                  {replyToMessage && replyToMessage.id && (
                    <button
                      type="button"
                      onClick={() => jumpToMessage(replyToMessage.id!)}
                      style={{ width: '100%', marginBottom: '0.65rem', padding: '0.65rem 0.8rem', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--accent-blue)', background: 'var(--bg-hover)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 700, marginBottom: '0.15rem' }}>Replying to:</span>
                        <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyToMessage.body || 'Attachment'}</span>
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setReplyToMessage(null); }}
                        style={{ color: 'var(--text-muted)', display: 'flex' }}
                      >
                        <X size={16} />
                      </span>
                    </button>
                  )}
                  {(smartReplies.length > 0 || nextPrediction) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.65rem' }}>
                      {smartReplies.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                          {smartReplies.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => setNewMessage(suggestion)}
                              style={{ border: '1px solid var(--border-color)', background: 'var(--bg-hover)', color: 'var(--text-main)', borderRadius: '999px', padding: '0.4rem 0.7rem', fontSize: '0.78rem', cursor: 'pointer' }}
                            >
                              {suggestion}
                            </button>
                          ))}
                          {aiAssistantLoading && <Loader2 size={14} className="spin" style={{ color: 'var(--text-muted)', alignSelf: 'center' }} />}
                        </div>
                      )}
                      {nextPrediction && !newMessage && (
                        <button
                          type="button"
                          onClick={() => setNewMessage(nextPrediction)}
                          style={{ width: 'fit-content', maxWidth: '100%', border: 'none', background: 'transparent', color: 'var(--text-muted)', padding: 0, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}
                        >
                          {nextPrediction}
                        </button>
                      )}
                    </div>
                  )}
                  {attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem' }}>
                      {attachments.map((att, i) => (
                        <div key={i} style={{ position: 'relative', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '0.25rem', backgroundColor: 'var(--bg-hover)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {att.file_type?.includes('image') ? (
                            <button type="button" onClick={() => setLightboxImage(att.url)} style={{ border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }} title="Preview image">
                              <img src={att.url} alt={att.name || 'Preview'} style={{ width: 42, height: 42, borderRadius: '8px', objectFit: 'cover', display: 'block' }} />
                            </button>
                          ) : (
                            <FileText size={18} style={{ color: 'var(--text-muted)' }} />
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.72rem', display: 'block', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{att.name}</span>
                            {att.file_type?.includes('image') && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Preview ready</span>}
                            {att.file_type?.includes('image') && (
                              <button
                                type="button"
                                onClick={() => setEditingAttachmentIndex(i)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', padding: 0, textAlign: 'left', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                              >
                                Edit image
                              </button>
                            )}
                          </div>
                          <button 
                            onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#ef4444', border: 'none', color: 'white', borderRadius: '50%', width: '14px', height: '14px', fontSize: '8px', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center' }}
                      title="Attach file"
                    >
                      <LinkIcon size={24} style={{ transform: 'rotate(45deg)' }} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      multiple 
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      style={{ display: 'none' }} 
                    />

                    <div className="chat-composer-bar" style={{ flex: 1 }}>
                      <textarea
                        ref={composerTextareaRef}
                        placeholder="Type a message"
                        value={newMessage}
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          handleTyping();
                        }}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        style={{
                          flex: 1,
                          backgroundColor: 'transparent',
                          border: 'none',
                          fontSize: '1rem',
                          color: 'var(--text-main)',
                          outline: 'none',
                          resize: 'none',
                          padding: '0.6rem 0',
                          maxHeight: '120px'
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => handleSend()}
                        disabled={(!newMessage.trim() && attachments.length === 0) || sendMessageMutation.isPending}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-blue)',
                          color: '#ffffff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: (newMessage.trim() || attachments.length > 0) ? 'pointer' : 'default',
                          transition: 'opacity 0.2s',
                          marginLeft: '0.5rem',
                          opacity: (newMessage.trim() || attachments.length > 0) ? 1 : 0.5
                        }}
                      >
                        {sendMessageMutation.isPending ? (
                          <Loader2 size={18} className="spin" />
                        ) : (
                          <Send size={18} style={{ marginLeft: '2px' }} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', gap: '1rem', backgroundColor: 'var(--bg-dark)' }}>
                <MessageCircle size={54} style={{ opacity: 0.2, color: '#6366f1' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)' }}>No Chat Selected</h3>
                <p style={{ fontSize: '0.85rem' }}>Select a conversation from the list to start messaging.</p>
              </div>
            )}
          </div>

          {/* 3. RIGHT SIDEBAR: Directory */}
          {activeChatId && activeChatInfo && rightSidebarOpen && (
            <div 
              style={{ 
                width: '320px',
                minWidth: '320px',
                flexShrink: 0,
                backgroundColor: 'var(--bg-card)', 
                borderLeft: '1px solid var(--border-color)', 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%',
              }}
              className="right-sidebar"
            >
              <div style={{ padding: '1.25rem 1.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Directory</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setRightSidebarOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '0.25rem' }}
                    className="mobile-only-btn"
                  >
                    <X size={20} />
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button 
                      onClick={() => setShowChatMenu(!showChatMenu)} 
                      style={{ background: '#ffffff', border: 'none', color: '#000000', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MoreVertical size={18} strokeWidth={2.5} />
                    </button>
                    {showChatMenu && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', zIndex: 50, width: '190px', boxShadow: '0 14px 32px var(--card-shadow)' }}>
                        <button onClick={() => activeChatId && togglePinChat(activeChatId)} className="chat-menu-item"><Pin size={14} />{activeChatId && pinnedChatIds.includes(activeChatId) ? 'Unpin Chat' : 'Pin Chat'}</button>
                        <button onClick={() => { handleAISummary(); setShowChatMenu(false); }} className="chat-menu-item"><Sparkles size={14} />Summarize Chat</button>
                        <button onClick={() => handleShareMessage({ id: activeChatId || '', body: `${activeChatInfo.partnerName} on Paoblem`, conversation_id: activeChatId || '', sender_id: '', recipient_id: '', partner_id: '', partner_name: '', partner_avatar: '', read: false, type: 'TEXT', created_at: new Date().toISOString() })} className="chat-menu-item"><Share2 size={14} />Share Chat</button>
                        <button onClick={() => setShowConfirmClear(true)} className="chat-menu-item"><Trash size={14} />Clear Chat</button>
                        <button onClick={() => setShowConfirmDelete(true)} className="chat-menu-item chat-menu-item-danger">
                           <Trash2 size={14} />Delete Chat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                {/* Bookmarks */}
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Bookmarks</h3>
                    <span style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-main)', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '8px', fontWeight: 600 }}>{bookmarkedMessages.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {bookmarkedMessages.length > 0 ? bookmarkedMessages.slice(0, 6).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setChatSearchQuery(m.body)}
                        style={{ width: '100%', textAlign: 'left', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', color: 'var(--text-body)', borderRadius: '10px', padding: '0.65rem', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1.35 }}
                      >
                        {m.body || m.attachments?.[0]?.name || 'Saved attachment'}
                      </button>
                    )) : (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Saved messages appear here.</p>
                    )}
                  </div>
                </div>

                {/* Files */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Files</h3>
                    <span style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-main)', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '8px', fontWeight: 600 }}>{sharedFiles.length}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {sharedFiles.length > 0 ? sharedFiles.map((m, idx) => {
                      const file = m.attachments?.[0] || { name: 'Shared Document', size: 0, file_type: 'unknown' };
                      const fileName = file.name || 'Shared Document';
                      const isPdf = fileName.toLowerCase().endsWith('.pdf');
                      const isImage = file.file_type?.includes('image') || fileName.toLowerCase().match(/\.(png|jpg|jpeg|gif)$/i);
                      const isDoc = fileName.toLowerCase().match(/\.(doc|docx)$/i);
                      
                      const iconColor = isPdf ? '#ef4444' : isImage ? '#10b981' : isDoc ? '#3b82f6' : '#a1a1aa';
                      
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '44px', height: '44px', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isImage ? <ImageIcon size={20} color={iconColor} /> : <FileText size={20} color={iconColor} />}
                          </div>
                          
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fileName}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {(isPdf ? 'PDF' : isImage ? 'PNG' : isDoc ? 'DOC' : 'FILE')} {(file.size ? (file.size / 1024 / 1024).toFixed(1) + 'mb' : '1mb')}
                            </span>
                          </div>

                          <a href={file.url} download style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', padding: '0.3rem' }}>
                            <Download size={14} />
                          </a>
                        </div>
                      );
                    }) : (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No files shared yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
        </div>

      {/* Lightbox */}
      {lightboxImage && (
        <GSAPModalWrapper 
          onClick={() => { setLightboxImage(null); setLightboxScale(1); }}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', overflow: 'hidden' }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); setLightboxScale(1); }}
            style={{ position: 'fixed', top: '1rem', right: '1rem', width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}
            aria-label="Close image preview"
          >
            <X size={22} />
          </button>
          <img
            className="modal-box profile-lightbox-image"
            src={lightboxImage}
            alt="Profile preview"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.stopPropagation();
              setLightboxScale(prev => Math.min(3, Math.max(1, prev + (e.deltaY < 0 ? 0.12 : -0.12))));
            }}
            style={{ maxWidth: '92%', maxHeight: '88%', borderRadius: '12px', objectFit: 'contain', transform: `scale(${lightboxScale})`, transition: 'transform 180ms ease', touchAction: 'pinch-zoom' }}
          />
        </GSAPModalWrapper>
      )}

      <PhotoEditorModal
        isOpen={editingAttachmentIndex !== null && !!attachments[editingAttachmentIndex || 0]?.url}
        imageUrl={editingAttachmentIndex !== null ? attachments[editingAttachmentIndex]?.url : ''}
        onClose={() => setEditingAttachmentIndex(null)}
        onSave={(_blob, editedDataUrl) => {
          if (editingAttachmentIndex === null) return;
          setAttachments(prev => prev.map((att, idx) => idx === editingAttachmentIndex ? { ...att, url: editedDataUrl, name: att.name || 'edited-image.jpg' } : att));
          setEditingAttachmentIndex(null);
        }}
      />

      {forwardingMessage && (
        <GSAPModalWrapper style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-box" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px', maxWidth: '460px', width: '100%', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Forward message</h3>
              <button type="button" onClick={() => setForwardingMessage(null)} className="chat-icon-btn"><X size={18} /></button>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{forwardingMessage.body || 'Attachment'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '320px', overflowY: 'auto' }}>
              {sortedChats.map(([chatId, chat]) => (
                <label key={chatId} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem', borderRadius: '10px', cursor: 'pointer', background: forwardTargetIds.includes(chatId) ? 'var(--bg-hover)' : 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={forwardTargetIds.includes(chatId)}
                    onChange={(e) => setForwardTargetIds(prev => e.target.checked ? [...prev, chatId] : prev.filter(id => id !== chatId))}
                  />
                  <Avatar src={chat.partnerAvatar} name={chat.partnerName} size={32} />
                  <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.partnerName}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" onClick={() => setForwardingMessage(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={isForwarding || forwardTargetIds.length === 0} onClick={submitForward} style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.55rem 0.9rem', fontWeight: 700, cursor: forwardTargetIds.length ? 'pointer' : 'not-allowed', opacity: forwardTargetIds.length ? 1 : 0.55 }}>
                {isForwarding ? 'Forwarding...' : 'Forward'}
              </button>
            </div>
          </div>
        </GSAPModalWrapper>
      )}

      {/* AI Summary Modal */}
      {aiSummaryOpen && (
        <GSAPModalWrapper style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-box" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '500px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 24px 70px var(--card-shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: '#6366f1' }} />
                AI Conversation Summary
              </h3>
              <button onClick={() => setAiSummaryOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {loadingSummary ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
                <Loader2 size={28} className="spin" style={{ color: '#6366f1' }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Generating insights...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#6366f1', marginBottom: '0.35rem' }}>SUMMARY</h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    {aiSummaryData?.summary || 'No summary available.'}
                  </p>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#a855f7', marginBottom: '0.5rem' }}>ACTION ITEMS & TASKS</h4>
                  {aiSummaryData?.actionItems && aiSummaryData.actionItems.length > 0 ? (
                    <ul style={{ paddingLeft: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {aiSummaryData.actionItems.map((item, idx) => (
                        <li key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No action items detected.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </GSAPModalWrapper>
      )}

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <GSAPModalWrapper style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-box" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '460px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 24px 70px var(--card-shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageCircle size={18} style={{ color: '#6366f1' }} />
                New Message
              </h3>
              <button onClick={() => { setIsNewChatModalOpen(false); setNewChatError(''); setNewChatUsername(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Enter Username</label>
                <input
                  type="text"
                  value={newChatUsername}
                  onChange={(e) => setNewChatUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  autoFocus
                  style={{ backgroundColor: 'var(--search-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '12px', padding: '0.75rem 1rem', outline: 'none' }}
                />
                <UserSearchSuggestions 
                  query={newChatUsername} 
                  currentUserId={session?.user?.id}
                  onSelect={(uname) => {
                    setNewChatUsername(uname);
                    openDirectChatByUsername(uname);
                  }} 
                />
              </div>
              {newChatError && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>{newChatError}</p>}
              <button
                type="submit"
                disabled={newChatLoading || !newChatUsername.trim()}
                style={{ backgroundColor: '#6366f1', color: '#ffffff', fontWeight: 600, border: 'none', borderRadius: '12px', padding: '0.75rem', cursor: (newChatLoading || !newChatUsername.trim()) ? 'not-allowed' : 'pointer', opacity: (newChatLoading || !newChatUsername.trim()) ? 0.6 : 1 }}
              >
                {newChatLoading ? 'Searching...' : 'Start Chat'}
              </button>
            </form>
          </div>
        </GSAPModalWrapper>
      )}

      {/* Chat Management Modals */}
      {showConfirmClear && (
        <GSAPModalWrapper style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-box" style={{ backgroundColor: '#121214', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '400px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8f9fa' }}>Clear Chat</h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>Are you sure you want to clear all messages? This will only remove them for you.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowConfirmClear(false)} style={{ background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button type="button" onClick={handleClearChat} style={{ backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 600, border: 'none', borderRadius: '12px', padding: '0.5rem 1rem', cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
        </GSAPModalWrapper>
      )}

      {pendingDeleteChatId && (
        <GSAPModalWrapper style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-box" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px', maxWidth: '420px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Delete Chat?</h3>
            <p style={{ color: 'var(--text-body)', fontSize: '0.92rem', margin: 0, lineHeight: 1.5 }}>This conversation will be permanently deleted and cannot be recovered.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" disabled={isDeletingChat} onClick={() => setPendingDeleteChatId(null)} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button type="button" disabled={isDeletingChat} onClick={confirmDeleteChat} style={{ backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 700, border: 'none', borderRadius: '10px', padding: '0.6rem 1rem', cursor: isDeletingChat ? 'not-allowed' : 'pointer' }}>{isDeletingChat ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </GSAPModalWrapper>
      )}

      {showDeleteAllChatsConfirm && (
        <GSAPModalWrapper style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-box" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px', maxWidth: '440px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Delete All Chats?</h3>
            <p style={{ color: 'var(--text-body)', fontSize: '0.92rem', margin: 0, lineHeight: 1.5 }}>This action will permanently delete all conversations and cannot be undone.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowDeleteAllChatsConfirm(false)} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button type="button" onClick={handleDeleteAllChatsLocal} style={{ backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 700, border: 'none', borderRadius: '10px', padding: '0.6rem 1rem', cursor: 'pointer' }}>Delete All</button>
            </div>
          </div>
        </GSAPModalWrapper>
      )}

      {showConfirmDelete && (
        <GSAPModalWrapper style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="modal-box" style={{ backgroundColor: '#121214', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '400px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8f9fa' }}>Delete Chat</h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>Are you sure you want to delete this chat?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" disabled={isDeletingChat} onClick={() => setShowConfirmDelete(false)} style={{ background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button type="button" disabled={isDeletingChat} onClick={() => handleDeleteChat(false)} style={{ backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 600, border: 'none', borderRadius: '12px', padding: '0.5rem 1rem', cursor: isDeletingChat ? 'not-allowed' : 'pointer' }}>{isDeletingChat ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </GSAPModalWrapper>
      )}

      {/* Responsive Overlay & Styling */}
      <style jsx global>{`
        .chats-sidebar-list::-webkit-scrollbar,
        .chats-conversation-area::-webkit-scrollbar {
          width: 6px;
        }
        .chats-sidebar-list::-webkit-scrollbar-thumb,
        .chats-conversation-area::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .message-actions-overlay {
          display: none;
          position: absolute;
          top: -28px;
          z-index: 5;
        }
        .dot {
          width: 5px;
          height: 5px;
          background-color: #6366f1;
          border-radius: 50%;
          display: inline-block;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .dot1 { animation-delay: -0.32s; }
        .dot2 { animation-delay: -0.16s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }

        .conversation-card-item:hover {
          background-color: var(--bg-hover) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important;
        }

        .message-bubble {
          max-width: 75%;
          padding: 0.85rem 1rem;
        }

        @media (max-width: 1024px) {
          .right-sidebar {
            position: absolute !important;
            right: 0;
            top: 0;
            bottom: 0;
            z-index: 20;
            box-shadow: -5px 0 25px rgba(0,0,0,0.5);
          }
          .message-bubble {
            max-width: 85%;
          }
        }

        @media (max-width: 768px) {
          .mobile-hidden {
            display: none !important;
          }
          .chats-sidebar-list {
            width: 100% !important;
            max-width: 100% !important;
          }
          .mobile-overlay-view {
            width: 100% !important;
            height: 100% !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 500 !important;
          }
          .back-btn-mobile {
            display: flex !important;
          }
          .right-sidebar {
            display: none !important;
          }
          .message-bubble {
            max-width: 92%;
            padding: 0.75rem 0.85rem !important;
            font-size: 0.9rem !important;
          }
          .chat-input-container {
            padding: 0.75rem 1rem !important;
          }
        }
      `}</style>
    </div>
  );
}
