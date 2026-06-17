'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Loader2, MessageCircle, Send, ArrowLeft, User, Users, Search, Pin, 
  FileText, Image as ImageIcon, Link as LinkIcon, Trash2, Edit, 
  Reply, Forward, Sparkles, Smile, Mic, Download, 
  Check, CheckCheck, Info, Phone, X, Sparkle, AlertCircle, RefreshCw, MoreVertical,
  VolumeX, Ban, AlertTriangle, EyeOff, Trash
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

interface DBMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  partner_id: string;
  partner_name: string;
  partner_avatar: string;
  partner_online?: boolean;
  partner_last_seen?: string;
  is_group?: boolean;
  members?: any[];
  body: string;
  read: boolean;
  type: string;
  attachments?: any[];
  reactions?: Record<string, string[]>;
  created_at: string;
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

const UserSearchSuggestions = ({ query, onSelect, excludeUsernames = [], currentUserId }: { query: string, onSelect: (uname: string) => void, excludeUsernames?: string[], currentUserId?: string }) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('username, full_name, avatar_url, id')
        .ilike('username', `%${query}%`)
        .limit(5);
      if (data) {
        setSuggestions(data.filter(u => 
          !excludeUsernames.includes(u.username.toLowerCase()) && 
          u.id !== currentUserId
        ));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, excludeUsernames, currentUserId]);

  if (!query.trim() || suggestions.length === 0) return null;

  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#1a1a1c', border: '1px solid #2a2a2c', borderRadius: '12px', zIndex: 100, marginTop: '4px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
      {suggestions.map(u => (
        <div key={u.username} onClick={() => onSelect(u.username)} style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #2a2a2c', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2c'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
          <img src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} alt={u.username} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 500 }}>{u.full_name || u.username}</span>
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>@{u.username}</span>
          </div>
        </div>
      ))}
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
  const [newChatMode, setNewChatMode] = useState<'pick' | 'dm' | 'group'>('pick');
  const [newChatUsername, setNewChatUsername] = useState('');
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [newChatError, setNewChatError] = useState('');
  const [groupChatUsernames, setGroupChatUsernames] = useState<string[]>([]);
  const [groupChatInput, setGroupChatInput] = useState('');

  const [aiToneEnhanceOpen, setAiToneEnhanceOpen] = useState(false);
  const [enhancingMessage, setEnhancingMessage] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [addMemberUsername, setAddMemberUsername] = useState('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  // Chat management states
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  // Attachment states
  const [attachments, setAttachments] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Messages lists (local state for optimistic UI updates)
  const [localMessages, setLocalMessages] = useState<DBMessage[]>([]);
  const [failedMessages, setFailedMessages] = useState<any[]>([]);

  // Typing indicators
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const targetUserId = searchParams.get('userId');

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

  // Sync user presence state: Heartbeat every 30s + Tab Visibility check
  useEffect(() => {
    if (!session?.user?.id) return;

    const updatePresence = async (online: boolean) => {
      try {
        await supabase
          .from('profiles')
          .update({ 
            online, 
            last_seen: new Date().toISOString() 
          })
          .eq('id', session.user.id);
      } catch (err) {
        // ignore fallback errors
      }
    };

    updatePresence(true);

    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence(true);
      }
    }, 30000);

    const handleVisibilityChange = () => {
      updatePresence(document.visibilityState === 'visible');
    };

    const setOfflineOnUnload = () => {
      if (!session?.user?.id || !session?.access_token) return;
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`;
      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify({ 
          online: false, 
          last_seen: new Date().toISOString() 
        }),
        keepalive: true
      }).catch(() => {});
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', setOfflineOnUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', setOfflineOnUnload);
      setOfflineOnUnload();
    };
  }, [session?.user?.id, session?.access_token]);

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
    refetchInterval: 3500,
  });

  // Keep local messages updated with fetched messages
  useEffect(() => {
    if (messages.length > 0) {
      setLocalMessages(messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Real-time WebSockets subscription
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('realtime-chat-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['messages', session?.access_token] });

        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as any;
          if (newMsg.sender_id !== session?.user?.id) {
            // Trigger browser notification
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('New Message', {
                body: newMsg.body || 'You received a new message.',
                icon: '/favicon.ico'
              });
            }
          }
        }
      })
      .subscribe();

    const presenceChannel = supabase
      .channel('realtime-profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['target-chat-profile'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [session?.user?.id]);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Auto-scroll to bottom when messages change or a new chat is opened
  useEffect(() => {
    scrollToBottom('auto');
  }, [messages, localMessages, activeChatId]);

  // Set active partner ID
  useEffect(() => {
    if (targetUserId) {
      setActiveChatId(targetUserId);
      setMobileConversationOpen(true);
    } else if (messages.length > 0 && !activeChatId) {
      setActiveChatId(messages[0].partner_id);
    }
  }, [targetUserId, messages]);

  // CRITICAL BUG FIX: Instant Read Receipts & Notification Sync when conversation opens
  useEffect(() => {
    if (!activeChatId || !session?.access_token) return;

    // Optimistically mark messages from partner as read locally
    setLocalMessages(prev => prev.map(m => {
      if ((m.partner_id === activeChatId || m.conversation_id === activeChatId) && !m.read && m.sender_id !== session.user.id) {
        return { ...m, read: true, status: 'read' };
      }
      return m;
    }));

    // Optimistically update the global React Query cache so the Navbar badge disappears instantly
    queryClient.setQueryData(['messages', session.access_token], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((m: any) => {
        if ((m.partner_id === activeChatId || m.conversation_id === activeChatId) && !m.read && m.sender_id !== session.user.id) {
          return { ...m, read: true };
        }
        return m;
      });
    });

    // Call PUT API to mark as read
    const isConversationId = localMessages.some(m => m.conversation_id === activeChatId);
    fetch('/api/messages/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ conversationId: isConversationId ? activeChatId : undefined, partnerId: !isConversationId ? activeChatId : undefined, read: true })
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['messages', session.access_token] });
      queryClient.invalidateQueries({ queryKey: ['chats-messages', session.access_token] });
      queryClient.invalidateQueries({ queryKey: ['notifications', session.access_token] });
    }).catch(console.error);
  }, [activeChatId, session?.access_token]);

  // Handle typing state
  const handleTyping = () => {
    if (!session || !activeChatId) return;

    if (!isTyping) {
      setIsTyping(true);
      supabase.channel(`typing-${activeChatId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: session.user.id, typing: true }
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      supabase.channel(`typing-${activeChatId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: session.user.id, typing: false }
      });
    }, 2000);
  };

  // Subscribe to partner typing events
  useEffect(() => {
    if (!session || !activeChatId) return;

    const typingChannel = supabase
      .channel(`typing-${session.user.id}`)
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (payload.payload?.userId === activeChatId) {
          setPartnerTyping(payload.payload?.typing || false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [activeChatId, session]);

  // Auto-expand composer field
  useEffect(() => {
    const textarea = composerTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  // Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ partnerId, body, type = 'TEXT', atts = [] }: { partnerId: string; body: string; type?: string; atts?: any[] }) => {
      const isConversationId = localMessages.some(m => m.conversation_id === partnerId);
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          conversationId: isConversationId ? partnerId : undefined,
          recipientId: !isConversationId ? partnerId : undefined, 
          body, 
          type, 
          attachments: atts 
        }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onMutate: async (newMsg) => {
      const tempId = Math.random().toString();
      const isConversationId = localMessages.some(m => m.conversation_id === activeChatId);
      const optimisticMsg: DBMessage = {
        id: tempId,
        conversation_id: isConversationId ? (activeChatId || '') : '',
        sender_id: session.user.id,
        recipient_id: newMsg.partnerId,
        partner_id: newMsg.partnerId,
        partner_name: activeChatInfo?.partnerName || 'Member',
        partner_avatar: activeChatInfo?.partnerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${newMsg.partnerId}`,
        body: newMsg.body,
        read: false,
        type: newMsg.type || 'TEXT',
        attachments: newMsg.atts || [],
        created_at: new Date().toISOString(),
        status: 'sending'
      };
      setLocalMessages(prev => [optimisticMsg, ...prev]);
      scrollToBottom('smooth');
      return { tempId };
    },
    onError: (err, newMsg, context: any) => {
      setLocalMessages(prev => prev.filter(m => m.id !== context?.tempId));
      setFailedMessages(prev => [...prev, { partnerId: newMsg.partnerId, body: newMsg.body, type: newMsg.type, attachments: newMsg.atts }]);
    },
    onSuccess: () => {
      setNewMessage('');
      setAttachments([]);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['messages', session?.access_token] });
    }
  });

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && attachments.length === 0) return;
    if (!activeChatId) return;

    let msgType = 'TEXT';
    if (attachments.length > 0) {
      const firstType = attachments[0].file_type.toUpperCase();
      if (firstType.includes('IMAGE')) msgType = 'IMAGE';
      else msgType = 'FILE';
    } else if (newMessage.startsWith('http')) {
      msgType = 'LINK';
    }

    sendMessageMutation.mutate({ 
      partnerId: activeChatId, 
      body: newMessage,
      type: msgType,
      atts: attachments
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
      atts: failedMsg.attachments
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
      const activeChatMessages = localMessages.filter(m => (m.conversation_id || m.partner_id) === activeChatId);
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: activeChatMessages.slice(0, 15) })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummaryData(data);
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
      setLocalMessages(prev => prev.filter(m => (m.conversation_id || m.partner_id) !== activeChatId));
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
        setLocalMessages(prev => prev.filter(m => (m.conversation_id || m.partner_id) !== activeChatId));
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

  const handleRenameGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatId || !session?.access_token || !newGroupName.trim()) return;
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          conversationId: activeChatId,
          type: 'GROUP_RENAME',
          body: newGroupName.trim()
        })
      });
      // Trigger a re-fetch of messages in the background to update the name
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setShowRenameModal(false);
      setShowChatMenu(false);
      setNewGroupName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0] || !activeChatId || !session?.access_token) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            conversationId: activeChatId,
            type: 'GROUP_AVATAR',
            body: reader.result as string
          })
        });
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        setShowChatMenu(false);
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };


  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatUsername.trim()) return;
    setNewChatLoading(true);
    setNewChatError('');

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('username', newChatUsername.trim().toLowerCase()).single();
      if (error || !data) {
        setNewChatError('User not found. Please check the username.');
        return;
      }
      setIsNewChatModalOpen(false);
      setNewChatUsername('');
      setActiveChatId(data.id);
    } catch (err: any) {
      setNewChatError('An error occurred. Please try again.');
    } finally {
      setNewChatLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberUsername.trim() || !activeChatId || !session) return;
    setAddMemberLoading(true);
    setAddMemberError('');

    try {
      // Find user
      const { data: userToAdd, error: userErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', addMemberUsername.trim().toLowerCase())
        .single();
        
      if (userErr || !userToAdd) {
        setAddMemberError('User not found. Please check the username.');
        setAddMemberLoading(false);
        return;
      }

      // Find members of current chat
      const activeMessages = localMessages.filter(m => (m.conversation_id || m.partner_id) === activeChatId);
      const currentMembersIds = activeChatInfo?.members?.map(m => m.id) || [];
      if (currentMembersIds.length === 0 && activeChatInfo) {
         currentMembersIds.push(activeChatId); // In case it's a new unsaved chat
      }

      if (currentMembersIds.includes(userToAdd.id)) {
        setAddMemberError('User is already in this chat.');
        setAddMemberLoading(false);
        return;
      }

      const participantIds = [...currentMembersIds, userToAdd.id];
      // Create a dummy message to force the creation of the group chat via POST api/messages
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ 
          participantIds,
          body: `Added ${userToAdd.full_name} to the conversation.`,
          type: 'SYSTEM'
        })
      });

      if (!res.ok) throw new Error('Failed to create group chat');
      const data = await res.json();
      
      setIsAddMemberModalOpen(false);
      setAddMemberUsername('');
      setActiveChatId(data.message.conversation_id);
      
      // Invalidate to fetch new group
      queryClient.invalidateQueries({ queryKey: ['messages', session.access_token] });
    } catch (err: any) {
      setAddMemberError('An error occurred. Please try again.');
    } finally {
      setAddMemberLoading(false);
    }
  };

  // AI Tone Enhancer handler
  const handleAIEnhance = async (tone: string) => {
    if (!newMessage.trim()) return;
    setEnhancingMessage(true);
    try {
      const res = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newMessage, tone })
      });
      if (res.ok) {
        const data = await res.json();
        setNewMessage(data.enhanced || newMessage);
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

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
    const cid = msg.conversation_id || msg.partner_id;
    if (!chatGroups[cid]) {
      chatGroups[cid] = {
        partnerName: msg.partner_name,
        partnerAvatar: msg.partner_avatar,
        latestMessage: msg.body,
        timestamp: msg.created_at,
        unread: !msg.read && msg.sender_id !== session.user.id,
        online: msg.partner_online || false,
        lastSeen: msg.partner_last_seen || null,
        pinned: false,
        isGroup: msg.is_group || false,
        members: msg.members || []
      };
    }
  });

  // Target user injected if empty chat (legacy routing)
  if (targetUserId && targetProfileData?.profile && !chatGroups[targetUserId]) {
    chatGroups[targetUserId] = {
      partnerName: targetProfileData.profile.full_name || 'Member',
      partnerAvatar: targetProfileData.profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUserId}`,
      latestMessage: 'Start a conversation...',
      timestamp: new Date().toISOString(),
      unread: false,
      online: targetProfileData.profile.online || false,
      lastSeen: targetProfileData.profile.last_seen || null,
      pinned: true,
      isGroup: false,
      members: [targetProfileData.profile]
    };
  }

  // Filter & Sort conversations list
  const sortedChats = Object.entries(chatGroups)
    .filter(([_, chat]) => {
      if (searchQuery.trim() === '') return true;
      return chat.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
             chat.latestMessage.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (a[1].pinned && !b[1].pinned) return -1;
      if (!a[1].pinned && b[1].pinned) return 1;
      return new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime();
    });

  const activeMessages = localMessages.filter(m => (m.conversation_id || m.partner_id) === activeChatId).reverse();
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

  return (
    <div className="app-container" style={{ backgroundColor: '#070708', color: '#f8f9fa', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      
      <div style={{ display: 'flex', flex: 1, width: '100%', height: 'calc(100vh - 70px)', overflow: 'hidden', backgroundColor: '#070708', position: 'relative' }}>
          
          {/* 1. LEFT SIDEBAR: Redesigned with NO red or blue borders, uses 22%-25% width */}
          <div 
            className={`chats-sidebar-list ${mobileConversationOpen ? 'mobile-hidden' : ''}`}
            style={{ 
              width: '25%', 
              maxWidth: '340px',
              minWidth: '280px',
              flexShrink: 0,
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: '#000000',
              padding: '0.5rem',
              overflowY: 'auto'
            }}
          >
            {/* Search and Header */}
            <div style={{ padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Outfit', color: '#f8f9fa' }}>
                    Messages
                  </h2>
                  <span style={{ backgroundColor: '#ffffff', color: '#000000', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '12px' }}>
                    {sortedChats.length}
                  </span>
                </div>
                <button 
                  onClick={() => setIsNewChatModalOpen(true)}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#ffffff',
                    border: 'none',
                    borderRadius: '24px',
                    padding: '0.65rem 2.5rem 0.65rem 1.25rem',
                    fontSize: '0.85rem',
                    color: '#000000',
                    outline: 'none',
                  }}
                />
                <Search size={16} style={{ position: 'absolute', right: '14px', top: '10px', color: '#6b7280' }} />
              </div>
            </div>
            
            {/* Conversations List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0.5rem' }}>
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
                      onClick={() => setActiveChatId(pid)}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '0.4rem',
                        padding: '0.85rem 1rem', 
                        cursor: 'pointer', 
                        borderRadius: '16px',
                        backgroundColor: isActive ? '#2a2a2a' : 'transparent',
                        transition: 'background-color 0.2s',
                        marginBottom: '0.25rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                        <div style={{ position: 'relative' }}>
                          {chat.partnerAvatar ? (
                            <img src={chat.partnerAvatar} alt={chat.partnerName} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                              {getInitials(chat.partnerName)}
                            </div>
                          )}
                          {chat.unread && (
                            <div style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444', border: '2px solid #111111' }} />
                          )}
                          {chat.online && (
                            <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid #111111' }} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: isActive ? 700 : 600, color: '#ffffff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {chat.partnerName}
                            </h4>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                              {formatRelativeTime(chat.timestamp)}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: '#a1a1aa', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: chat.unread ? 600 : 400 }}>
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

          {/* 2. CENTER SECTION: Chat Window */}
          <div 
            className={`chats-conversation-area ${!mobileConversationOpen ? 'mobile-hidden' : ''} mobile-overlay-view`}
            style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: '#121214',
              borderLeft: '1px solid #1f1f22',
              borderRight: '1px solid #1f1f22',
              overflow: 'hidden'
            }}
          >
            {activeChatId && activeChatInfo ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Chat Header */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <button 
                      onClick={() => setMobileConversationOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: '#f8f9fa', cursor: 'pointer', display: 'none' }}
                      className="back-btn-mobile"
                    >
                      <ArrowLeft size={20} style={{ marginRight: '0.25rem' }} />
                    </button>
                    <div style={{ position: 'relative' }}>
                      {activeChatInfo && activeChatInfo.partnerAvatar ? (
                        <img src={activeChatInfo.partnerAvatar} alt="avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : activeChatInfo ? (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>
                          {getInitials(activeChatInfo.partnerName)}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>{activeChatInfo?.partnerName}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeChatInfo?.online ? '#10b981' : '#6b7280' }} />
                        <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
                          {activeChatInfo?.online ? 'Online' : getRelativeTime(activeChatInfo?.lastSeen || null)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#333333', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '24px', color: '#ffffff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                      <Phone size={16} />
                      Call
                    </button>
                    {!rightSidebarOpen && (
                      <button 
                        onClick={() => setRightSidebarOpen(true)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a2a2a', border: 'none', width: '40px', height: '40px', borderRadius: '50%', color: '#f8f9fa', cursor: 'pointer', transition: 'background-color 0.2s' }}
                        title="Open Directory"
                      >
                        <Info size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Message List */}
                <div 
                  ref={messagesContainerRef}
                  style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}
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
                      const isGrouped = prevMsg && prevMsg.sender_id === msg.sender_id && 
                        (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 120000);

                      // Date separator check
                      const showDateSeparator = !prevMsg || 
                        new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

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
                          className="message-group" 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            marginTop: isGrouped && !showDateSeparator ? '2px' : '0.75rem',
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
                                {!isGrouped && (
                                  activeChatInfo.partnerAvatar ? (
                                    <img
                                      src={activeChatInfo.partnerAvatar}
                                      alt="avatar"
                                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem', color: '#ffffff' }}>
                                      {getInitials(activeChatInfo.partnerName)}
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', flex: 1 }}>
                              <div
                                style={{
                                  padding: '0.65rem 1rem',
                                  borderRadius: '20px',
                                  backgroundColor: isMe ? '#404040' : '#ffffff',
                                  color: isMe ? '#ffffff' : '#000000',
                                  fontSize: '0.95rem',
                                  lineHeight: '1.4',
                                  wordBreak: 'break-word',
                                  border: 'none',
                                  position: 'relative'
                                }}
                              >
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
                                {msg.body && <span style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</span>}
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

                              {/* Seen Avatar Indicator */}
                              {msg.id === latestReadMessageId && (
                                <div className="seen-avatar-wrapper">
                                  {activeChatInfo?.partnerAvatar ? (
                                    <img 
                                      src={activeChatInfo.partnerAvatar} 
                                      alt="seen" 
                                      className="seen-avatar" 
                                    />
                                  ) : (
                                    <div className="seen-avatar" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.4rem', fontWeight: 'bold', color: 'white' }}>
                                      {getInitials(activeChatInfo?.partnerName || '?')}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Self Avatar - Only on the first message of the group */}
                            {isMe && (
                              <div style={{ width: '36px', height: '36px', flexShrink: 0 }}>
                                {!isGrouped && (
                                  session?.user?.user_metadata?.avatar_url ? (
                                    <img
                                      src={session.user.user_metadata.avatar_url}
                                      alt="my avatar"
                                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>
                                      {getInitials(session?.user?.email || 'Me')}
                                    </div>
                                  )
                                )}
                              </div>
                            )}
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

                <div style={{ 
                  padding: '1rem 1.5rem 1.5rem', 
                  backgroundColor: '#121214',
                  boxShadow: '0 -40px 40px -10px rgba(18,18,20, 1)',
                  position: 'relative',
                  zIndex: 10
                }}>
                  {attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem' }}>
                      {attachments.map((att, i) => (
                        <div key={i} style={{ position: 'relative', borderRadius: '8px', border: '1px solid #333', padding: '0.25rem', backgroundColor: '#2a2a2a' }}>
                          <span style={{ fontSize: '0.72rem', display: 'block', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>{att.name}</span>
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
                      style={{ backgroundColor: 'transparent', border: 'none', color: '#f8f9fa', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center' }}
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

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: '30px', padding: '0.35rem 0.35rem 0.35rem 1.5rem' }}>
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
                          color: '#000000',
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
                          backgroundColor: '#000000',
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', gap: '1rem', backgroundColor: '#070708' }}>
                <MessageCircle size={54} style={{ opacity: 0.2, color: '#6366f1' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'Outfit', color: '#f8f9fa' }}>No Chat Selected</h3>
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
                backgroundColor: '#111111', 
                borderLeft: '1px solid #2a2a2a', 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%',
              }}
              className="right-sidebar"
            >
              <div style={{ padding: '1.25rem 1.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Directory</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setRightSidebarOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: '#f8f9fa', cursor: 'pointer', padding: '0.25rem' }}
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
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden', zIndex: 50, width: '180px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                        <button onClick={() => setShowConfirmClear(true)} style={{ width: '100%', padding: '10px 15px', background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#f8f9fa', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}>Clear Chat</button>
                        {activeChatInfo.isGroup && (
                          <>
                            <button onClick={() => setShowRenameModal(true)} style={{ width: '100%', padding: '10px 15px', background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#f8f9fa', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}>Rename Group</button>
                            <button onClick={() => groupAvatarInputRef.current?.click()} style={{ width: '100%', padding: '10px 15px', background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#f8f9fa', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}>Set Picture</button>
                            <input type="file" accept="image/*" ref={groupAvatarInputRef} style={{ display: 'none' }} onChange={handleGroupAvatarUpload} />
                          </>
                        )}
                        <button onClick={() => setShowConfirmDelete(true)} style={{ width: '100%', padding: '10px 15px', background: 'transparent', border: 'none', color: '#ef4444', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}>
                           {activeChatInfo.isGroup ? 'Leave/Delete Group' : 'Delete Chat'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                {/* Team Members */}
                {activeChatInfo.isGroup && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Team Members</h3>
                        <span style={{ backgroundColor: '#2a2a2a', color: '#ffffff', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '8px', fontWeight: 600 }}>{activeChatInfo.members?.length || 1}</span>
                      </div>
                      <button 
                        onClick={() => setIsAddMemberModalOpen(true)}
                        style={{ background: '#2a2a2a', border: 'none', color: '#ffffff', cursor: 'pointer', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span style={{ fontSize: '1.2rem', fontWeight: 300 }}>+</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {activeChatInfo.members?.map((member: any) => {
                        const creatorId = activeMessages[activeMessages.length - 1]?.sender_id;
                        const isCreator = member.id === creatorId;
                        return (
                          <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <img src={member.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.id}`} alt={member.full_name} style={{ width: '40px', height: '40px', borderRadius: '12px', objectFit: 'cover' }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{member.full_name} {isCreator && <span style={{fontSize:'0.7rem', backgroundColor: '#6366f1', color: 'white', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px'}}>Admin</span>}</span>
                              <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{isCreator ? 'Creator' : 'Member'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Files */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Files</h3>
                    <span style={{ backgroundColor: '#2a2a2a', color: '#ffffff', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '8px', fontWeight: 600 }}>{sharedFiles.length}</span>
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
                          <div style={{ width: '44px', height: '44px', backgroundColor: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isImage ? <ImageIcon size={20} color={iconColor} /> : <FileText size={20} color={iconColor} />}
                          </div>
                          
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {fileName}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase' }}>
                              {(isPdf ? 'PDF' : isImage ? 'PNG' : isDoc ? 'DOC' : 'FILE')} {(file.size ? (file.size / 1024 / 1024).toFixed(1) + 'mb' : '1mb')}
                            </span>
                          </div>

                          <a href={file.url} download style={{ color: '#ffffff', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #4b4b4b', borderRadius: '50%', width: '32px', height: '32px', padding: '0.3rem' }}>
                            <Download size={14} />
                          </a>
                        </div>
                      );
                    }) : (
                      <p style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>No files shared yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
        </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}
        >
          <img src={lightboxImage} alt="lightbox" style={{ maxWidth: '90%', maxHeight: '85%', borderRadius: '12px', objectFit: 'contain' }} />
          <a 
            href={lightboxImage} 
            download 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.75rem 1.5rem', 
              backgroundColor: '#ffffff', 
              color: '#000000', 
              borderRadius: '24px', 
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            <Download size={18} />
            Save Image
          </a>
        </div>
      )}

      {/* AI Summary Modal */}
      {aiSummaryOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#121214', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '500px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit', color: '#f8f9fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                  <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                    {aiSummaryData?.summary || 'No summary available.'}
                  </p>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#a855f7', marginBottom: '0.5rem' }}>ACTION ITEMS & TASKS</h4>
                  {aiSummaryData?.actionItems && aiSummaryData.actionItems.length > 0 ? (
                    <ul style={{ paddingLeft: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {aiSummaryData.actionItems.map((item, idx) => (
                        <li key={idx} style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)' }}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No action items detected.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#121214', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '420px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit', color: '#f8f9fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {newChatMode === 'pick' ? 'Start a New Chat' : newChatMode === 'dm' ? 'Direct Message' : 'New Group Chat'}
              </h3>
              <button onClick={() => { setIsNewChatModalOpen(false); setNewChatError(''); setNewChatUsername(''); setNewChatMode('pick'); setGroupChatUsernames([]); setGroupChatInput(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Step 1: Pick mode */}
            {newChatMode === 'pick' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={() => setNewChatMode('dm')}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', backgroundColor: '#1a1a1c', border: '1px solid #2a2a2c', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', color: '#fff', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.backgroundColor = '#1e1e22'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2c'; e.currentTarget.style.backgroundColor = '#1a1a1c'; }}
                >
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageCircle size={20} color="#fff" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Direct Message</span>
                    <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>Start a private 1-on-1 conversation</span>
                  </div>
                </button>
                <button
                  onClick={() => setNewChatMode('group')}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', backgroundColor: '#1a1a1c', border: '1px solid #2a2a2c', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', color: '#fff', textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.backgroundColor = '#1e1e22'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2c'; e.currentTarget.style.backgroundColor = '#1a1a1c'; }}
                >
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={20} color="#fff" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Group Chat</span>
                    <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>Create a conversation with multiple people</span>
                  </div>
                </button>
              </div>
            )}

            {/* Step 2a: Direct Message form */}
            {newChatMode === 'dm' && (
              <>
                <button onClick={() => { setNewChatMode('pick'); setNewChatError(''); setNewChatUsername(''); }} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', padding: 0, marginTop: '-0.5rem' }}>
                  ← Back
                </button>
                <form onSubmit={handleStartNewChat} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                    <label style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Enter Username</label>
                    <input
                      type="text"
                      value={newChatUsername}
                      onChange={(e) => setNewChatUsername(e.target.value)}
                      placeholder="e.g. johndoe"
                      autoFocus
                      style={{ backgroundColor: '#1a1a1c', border: '1px solid #2a2a2c', color: '#ffffff', borderRadius: '12px', padding: '0.75rem 1rem', outline: 'none' }}
                    />
                    <UserSearchSuggestions 
                      query={newChatUsername} 
                      currentUserId={session?.user?.id}
                      onSelect={(uname) => setNewChatUsername(uname)} 
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
              </>
            )}

            {/* Step 2b: Group Chat form */}
            {newChatMode === 'group' && (
              <>
                <button onClick={() => { setNewChatMode('pick'); setNewChatError(''); setGroupChatUsernames([]); setGroupChatInput(''); }} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', padding: 0, marginTop: '-0.5rem' }}>
                  ← Back
                </button>

                {/* Added members chips */}
                {groupChatUsernames.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {groupChatUsernames.map((uname, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#1e293b', color: '#e2e8f0', padding: '0.35rem 0.65rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500 }}>
                        {uname}
                        <button onClick={() => setGroupChatUsernames(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                  <input
                    type="text"
                    value={groupChatInput}
                    onChange={(e) => setGroupChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (groupChatInput.trim() && !groupChatUsernames.includes(groupChatInput.trim().toLowerCase())) {
                          setGroupChatUsernames(prev => [...prev, groupChatInput.trim().toLowerCase()]);
                          setGroupChatInput('');
                          setNewChatError('');
                        }
                      }
                    }}
                    placeholder="Add username and press Enter"
                    autoFocus
                    style={{ flex: 1, backgroundColor: '#1a1a1c', border: '1px solid #2a2a2c', color: '#ffffff', borderRadius: '12px', padding: '0.75rem 1rem', outline: 'none', fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (groupChatInput.trim() && !groupChatUsernames.includes(groupChatInput.trim().toLowerCase())) {
                        setGroupChatUsernames(prev => [...prev, groupChatInput.trim().toLowerCase()]);
                        setGroupChatInput('');
                        setNewChatError('');
                      }
                    }}
                    style={{ backgroundColor: '#2a2a2c', border: 'none', color: '#fff', borderRadius: '12px', padding: '0 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem' }}
                  >+</button>
                  <UserSearchSuggestions 
                    query={groupChatInput} 
                    excludeUsernames={groupChatUsernames}
                    currentUserId={session?.user?.id}
                    onSelect={(uname) => {
                      if (!groupChatUsernames.includes(uname.toLowerCase())) {
                        setGroupChatUsernames(prev => [...prev, uname.toLowerCase()]);
                        setGroupChatInput('');
                        setNewChatError('');
                      }
                    }} 
                  />
                </div>

                {newChatError && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>{newChatError}</p>}

                <button
                  type="button"
                  disabled={newChatLoading || groupChatUsernames.length < 2}
                  onClick={async () => {
                    setNewChatLoading(true);
                    setNewChatError('');
                    try {
                      // Resolve all usernames to IDs
                      const ids: string[] = [];
                      for (const uname of groupChatUsernames) {
                        const { data, error } = await supabase.from('profiles').select('id, full_name').eq('username', uname).single();
                        if (error || !data) {
                          setNewChatError(`User "${uname}" not found.`);
                          setNewChatLoading(false);
                          return;
                        }
                        ids.push(data.id);
                      }
                      // Create group via API
                      const res = await fetch('/api/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` },
                        body: JSON.stringify({ participantIds: ids, body: 'Group chat created.', type: 'SYSTEM' })
                      });
                      if (!res.ok) throw new Error('Failed to create group');
                      const result = await res.json();
                      setIsNewChatModalOpen(false);
                      setNewChatMode('pick');
                      setGroupChatUsernames([]);
                      setGroupChatInput('');
                      setActiveChatId(result.message.conversation_id);
                      queryClient.invalidateQueries({ queryKey: ['messages', session!.access_token] });
                    } catch (err: any) {
                      setNewChatError(err.message || 'An error occurred.');
                    } finally {
                      setNewChatLoading(false);
                    }
                  }}
                  style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 600, border: 'none', borderRadius: '12px', padding: '0.75rem', cursor: (newChatLoading || groupChatUsernames.length < 2) ? 'not-allowed' : 'pointer', opacity: (newChatLoading || groupChatUsernames.length < 2) ? 0.6 : 1 }}
                >
                  {newChatLoading ? 'Creating...' : `Create Group (${groupChatUsernames.length} members)`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#121214', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '400px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit', color: '#f8f9fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Add Team Member
              </h3>
              <button onClick={() => { setIsAddMemberModalOpen(false); setAddMemberError(''); setAddMemberUsername(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                <label style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Enter Username</label>
                <input 
                  type="text" 
                  value={addMemberUsername}
                  onChange={(e) => setAddMemberUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  autoFocus
                  style={{ backgroundColor: '#1a1a1c', border: '1px solid #2a2a2c', color: '#ffffff', borderRadius: '12px', padding: '0.75rem 1rem', outline: 'none' }}
                />
                <UserSearchSuggestions 
                  query={addMemberUsername} 
                  currentUserId={session?.user?.id}
                  excludeUsernames={activeChatInfo?.members?.map((m: any) => m.username) || []}
                  onSelect={(uname) => setAddMemberUsername(uname)} 
                />
              </div>
              {addMemberError && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>{addMemberError}</p>}
              <button 
                type="submit" 
                disabled={addMemberLoading || !addMemberUsername.trim()}
                style={{ backgroundColor: '#ffffff', color: '#000000', fontWeight: 600, border: 'none', borderRadius: '12px', padding: '0.75rem', cursor: (addMemberLoading || !addMemberUsername.trim()) ? 'not-allowed' : 'pointer', opacity: (addMemberLoading || !addMemberUsername.trim()) ? 0.6 : 1 }}
              >
                {addMemberLoading ? 'Adding...' : 'Add Member'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Chat Management Modals */}
      {showRenameModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#121214', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '400px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8f9fa' }}>Rename Group</h3>
            <form onSubmit={handleRenameGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="text" 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter new group name"
                autoFocus
                style={{ backgroundColor: '#1a1a1c', border: '1px solid #2a2a2c', color: '#ffffff', borderRadius: '12px', padding: '0.75rem 1rem', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowRenameModal(false)} style={{ background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={!newGroupName.trim()} style={{ backgroundColor: '#ffffff', color: '#000000', fontWeight: 600, border: 'none', borderRadius: '12px', padding: '0.5rem 1rem', cursor: newGroupName.trim() ? 'pointer' : 'not-allowed', opacity: newGroupName.trim() ? 1 : 0.5 }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmClear && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#121214', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '400px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8f9fa' }}>Clear Chat</h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>Are you sure you want to clear all messages? This will only remove them for you.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowConfirmClear(false)} style={{ background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button type="button" onClick={handleClearChat} style={{ backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 600, border: 'none', borderRadius: '12px', padding: '0.5rem 1rem', cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#121214', border: '1px solid var(--border-color)', borderRadius: '24px', maxWidth: '400px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8f9fa' }}>{activeChatInfo?.isGroup ? 'Leave/Delete Group' : 'Delete Chat'}</h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>
              {activeChatInfo?.isGroup 
                ? (activeChatInfo.members?.some((m: any) => m.id === session?.user?.id && m.id === activeMessages[activeMessages.length - 1]?.sender_id) 
                    ? 'As the creator, deleting this group will remove it for everyone. Proceed?' 
                    : 'Are you sure you want to leave this group?')
                : 'Are you sure you want to delete this chat?'
              }
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" disabled={isDeletingChat} onClick={() => setShowConfirmDelete(false)} style={{ background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button type="button" disabled={isDeletingChat} onClick={() => handleDeleteChat(activeChatInfo?.members?.some((m: any) => m.id === session?.user?.id && m.id === activeMessages[activeMessages.length - 1]?.sender_id))} style={{ backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 600, border: 'none', borderRadius: '12px', padding: '0.5rem 1rem', cursor: isDeletingChat ? 'not-allowed' : 'pointer' }}>{isDeletingChat ? 'Processing...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
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
          right: 8px;
          z-index: 5;
        }
        div:hover > .message-actions-overlay {
          display: flex !important;
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
