'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Loader2, MessageCircle, Send, ArrowLeft, User, Search, Pin, 
  FileText, Image as ImageIcon, Link as LinkIcon, Trash2, Edit, 
  Reply, Forward, Sparkles, Smile, Mic, Download, 
  Check, CheckCheck, Info, Phone, X, Sparkle, AlertCircle, RefreshCw, MoreVertical,
  VolumeX, Ban, AlertTriangle, EyeOff, Trash
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

interface DBMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  partner_id: string;
  partner_name: string;
  partner_avatar: string;
  partner_online?: boolean;
  partner_last_seen?: string;
  body: string;
  read: boolean;
  type: string;
  attachments?: any[];
  reactions?: Record<string, string[]>;
  created_at: string;
  status?: 'sending' | 'sent' | 'read' | 'error';
}

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
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [sharedSearchQuery, setSharedSearchQuery] = useState('');
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  
  // Right sidebar
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'media' | 'files' | 'links'>('media');
  
  // Modals & AI dropdowns
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiSummaryData, setAiSummaryData] = useState<{ summary: string; actionItems: string[] } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [aiToneEnhanceOpen, setAiToneEnhanceOpen] = useState(false);
  const [enhancingMessage, setEnhancingMessage] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => updatePresence(false));

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      updatePresence(false);
    };
  }, [session?.user?.id]);

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

  // Real-time WebSockets subscription
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('realtime-chat-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['messages', session?.access_token] });
      })
      .subscribe();

    const presenceChannel = supabase
      .channel('realtime-profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        refetch();
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

  // Set active partner ID
  useEffect(() => {
    if (targetUserId) {
      setActivePartnerId(targetUserId);
      setMobileConversationOpen(true);
    } else if (messages.length > 0 && !activePartnerId) {
      setActivePartnerId(messages[0].partner_id);
    }
  }, [targetUserId, messages]);

  // CRITICAL BUG FIX: Instant Read Receipts & Notification Sync when conversation opens
  useEffect(() => {
    if (!activePartnerId || !session?.access_token) return;

    // Optimistically mark messages from partner as read locally
    setLocalMessages(prev => prev.map(m => {
      if (m.partner_id === activePartnerId && !m.read && m.sender_id !== session.user.id) {
        return { ...m, read: true, status: 'read' };
      }
      return m;
    }));

    // Call PUT API to mark as read in database
    fetch('/api/messages', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id: 'all', read: true })
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['messages', session.access_token] });
      queryClient.invalidateQueries({ queryKey: ['chats-messages', session.access_token] });
      queryClient.invalidateQueries({ queryKey: ['notifications', session.access_token] });
    }).catch(console.error);
  }, [activePartnerId, session?.access_token]);

  // Handle typing state
  const handleTyping = () => {
    if (!session || !activePartnerId) return;

    if (!isTyping) {
      setIsTyping(true);
      supabase.channel(`typing-${activePartnerId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: session.user.id, typing: true }
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      supabase.channel(`typing-${activePartnerId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: session.user.id, typing: false }
      });
    }, 2000);
  };

  // Subscribe to partner typing events
  useEffect(() => {
    if (!session || !activePartnerId) return;

    const typingChannel = supabase
      .channel(`typing-${session.user.id}`)
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (payload.payload?.userId === activePartnerId) {
          setPartnerTyping(payload.payload?.typing || false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [activePartnerId, session]);

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
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ recipientId: partnerId, body, type, attachments: atts }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onMutate: async (newMsg) => {
      const tempId = Math.random().toString();
      const optimisticMsg: DBMessage = {
        id: tempId,
        sender_id: session.user.id,
        recipient_id: newMsg.partnerId,
        partner_id: newMsg.partnerId,
        partner_name: activeChatInfo?.partnerName || 'Member',
        partner_avatar: activeChatInfo?.partnerAvatar || '',
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
    if (!activePartnerId) return;

    let msgType = 'TEXT';
    if (attachments.length > 0) {
      const firstType = attachments[0].file_type.toUpperCase();
      if (firstType.includes('IMAGE')) msgType = 'IMAGE';
      else msgType = 'FILE';
    } else if (newMessage.startsWith('http')) {
      msgType = 'LINK';
    }

    sendMessageMutation.mutate({ 
      partnerId: activePartnerId, 
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
    if (!activePartnerId) return;
    setLoadingSummary(true);
    setAiSummaryOpen(true);
    try {
      const activeChatMessages = localMessages.filter(m => m.partner_id === activePartnerId);
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: activeChatMessages.slice(0, 15) })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummaryData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSummary(false);
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
  }> = {};

  localMessages.forEach((msg) => {
    const pid = msg.partner_id;
    if (!chatGroups[pid]) {
      chatGroups[pid] = {
        partnerName: msg.partner_name,
        partnerAvatar: msg.partner_avatar,
        latestMessage: msg.body,
        timestamp: msg.created_at,
        unread: !msg.read && msg.sender_id !== session.user.id,
        online: msg.partner_online || false,
        lastSeen: msg.partner_last_seen || null,
        pinned: false
      };
    }
  });

  // Target user injected if empty chat
  if (targetUserId && targetProfileData?.profile && !chatGroups[targetUserId]) {
    chatGroups[targetUserId] = {
      partnerName: targetProfileData.profile.full_name || 'Member',
      partnerAvatar: targetProfileData.profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUserId}`,
      latestMessage: 'Start a conversation...',
      timestamp: new Date().toISOString(),
      unread: false,
      online: targetProfileData.profile.online || false,
      lastSeen: targetProfileData.profile.last_seen || null,
      pinned: true
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

  const activeMessages = localMessages.filter(m => m.partner_id === activePartnerId).reverse();
  const filteredActiveMessages = activeMessages.filter(m => {
    if (!chatSearchQuery.trim()) return true;
    return m.body.toLowerCase().includes(chatSearchQuery.toLowerCase());
  });

  const activeChatInfo = activePartnerId ? chatGroups[activePartnerId] : null;

  // Shared media panels
  const sharedImages = activeMessages.filter(m => m.type === 'IMAGE' || m.attachments?.some(a => a.file_type.includes('image')));
  const sharedFiles = activeMessages.filter(m => m.type === 'FILE' || m.attachments?.some(a => !a.file_type.includes('image')));
  const sharedLinks = activeMessages.filter(m => m.type === 'LINK' || m.body.includes('http://') || m.body.includes('https://'));

  return (
    <div className="chat-page-root">
      <Navbar />
      
      <div className="chat-layout">
          
          {/* 1. LEFT SIDEBAR: Redesigned with NO red or blue borders, uses 22%-25% width */}
          <div className={`chat-sidebar ${mobileConversationOpen ? 'mobile-hidden' : ''}`}>
            {/* Search and Header */}
            <div className="chat-sidebar-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: 'Outfit', color: '#f8f9fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Messages
                </h2>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--search-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.55rem 1rem 0.55rem 2.25rem',
                    fontSize: '0.85rem',
                    color: '#f8f9fa',
                    outline: 'none',
                  }}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
              </div>
            </div>
            
            {/* Conversations List with premium Active Chat styling */}
            <div className="chat-sidebar-scroll">
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
                sortedChats.map(([pid, chat]) => {
                  const isActive = activePartnerId === pid;
                  return (
                    <div
                      key={pid}
                      onClick={() => {
                        setActivePartnerId(pid);
                        setMobileConversationOpen(true);
                      }}
                      className={`conversation-card-item ${isActive ? 'active' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem',
                        padding: '0.85rem',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        // Active style uses soft white glow & border accents, NO RED OR BLUE
                        backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                        border: '1px solid transparent',
                        borderLeft: isActive ? '3px solid #ffffff' : '1px solid transparent',
                        boxShadow: isActive ? '0 0 12px rgba(255, 255, 255, 0.06)' : 'none',
                        transition: 'all 0.2s ease',
                        marginBottom: '0.35rem',
                        position: 'relative'
                      }}
                    >
                      {/* Avatar with Presence Indicator */}
                      <div style={{ position: 'relative' }}>
                        {chat.partnerAvatar ? (
                          <img
                            src={chat.partnerAvatar}
                            alt={chat.partnerName}
                            onError={(e) => {
                              e.currentTarget.src = "https://api.dicebear.com/7.x/bottts/svg?seed=guest";
                            }}
                            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.88rem' }}>
                            {getInitials(chat.partnerName)}
                          </div>
                        )}
                        <div 
                          style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: chat.online ? '#10b981' : '#6b7280', 
                            border: '2px solid #111216',
                            position: 'absolute',
                            bottom: '0',
                            right: '0'
                          }} 
                        />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f8f9fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {chat.partnerName}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {new Date(chat.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        {partnerTyping && isActive ? (
                          <p style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                            Typing...
                          </p>
                        ) : (
                          <p style={{ fontSize: '0.78rem', color: chat.unread && !isActive ? '#f8f9fa' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: chat.unread && !isActive ? 700 : 400, marginTop: '2px' }}>
                            {chat.latestMessage}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                        {chat.pinned && <Pin size={10} style={{ color: '#6366f1' }} />}
                        {chat.unread && !isActive && (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }} />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. CENTER SECTION: Chat Window & Responsive Mobile view (Expands to full remaining space) */}
          <div className={`chat-center ${mobileConversationOpen ? 'mobile-active' : 'mobile-hidden'}`}>
            {activePartnerId && activeChatInfo ? (
              <div className="chat-window">
                {/* Chat Header */}
                <div className="chat-window-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <button 
                      onClick={() => setMobileConversationOpen(false)}
                      style={{ background: 'transparent', border: 'none', color: '#f8f9fa', cursor: 'pointer', display: 'none' }}
                      className="back-btn-mobile"
                    >
                      <ArrowLeft size={20} style={{ marginRight: '0.25rem' }} />
                    </button>
                    <div style={{ position: 'relative' }}>
                      {activeChatInfo.partnerAvatar ? (
                        <img
                          src={activeChatInfo.partnerAvatar}
                          alt={activeChatInfo.partnerName}
                          onError={(e) => {
                            e.currentTarget.src = "https://api.dicebear.com/7.x/bottts/svg?seed=guest";
                          }}
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                          {getInitials(activeChatInfo.partnerName)}
                        </div>
                      )}
                      <div 
                        style={{ 
                          width: '11px', 
                          height: '11px', 
                          borderRadius: '50%', 
                          backgroundColor: activeChatInfo.online ? '#10b981' : '#6b7280', 
                          border: '2px solid #111216',
                          position: 'absolute',
                          bottom: '0',
                          right: '0'
                        }} 
                      />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8f9fa', fontFamily: 'Outfit' }}>
                        {activeChatInfo.partnerName}
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {activeChatInfo.online ? 'Online' : activeChatInfo.lastSeen ? `Last seen ${new Date(activeChatInfo.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Offline'}
                      </span>
                    </div>
                  </div>

                  {/* Header Actions: voice call & 3-dot dropdown menu */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <button style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: 'none', color: '#f8f9fa', cursor: 'pointer', padding: '0.5rem', borderRadius: '10px' }}>
                      <Phone size={16} />
                    </button>
                    
                    {/* Three-dot menu replacing info/search icon */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        onClick={() => setMenuOpen(!menuOpen)}
                        style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: 'none', color: '#f8f9fa', cursor: 'pointer', padding: '0.5rem', borderRadius: '10px' }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {menuOpen && (
                        <div style={{ position: 'absolute', top: '40px', right: '0', backgroundColor: '#1c1c1f', border: '1px solid var(--border-color)', borderRadius: '12px', width: '220px', zIndex: 100, display: 'flex', flexDirection: 'column', padding: '0.5rem', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                          <button 
                            onClick={() => { setChatSearchOpen(true); setMenuOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: '#f8f9fa', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', borderRadius: '6px' }}
                          >
                            <Search size={14} /> Conversation Search
                          </button>
                          <button 
                            onClick={() => { setRightSidebarOpen(true); setActiveRightTab('media'); setMenuOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: '#f8f9fa', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', borderRadius: '6px' }}
                          >
                            <ImageIcon size={14} /> Shared Media
                          </button>
                          <button 
                            onClick={() => { setRightSidebarOpen(true); setActiveRightTab('files'); setMenuOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: '#f8f9fa', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', borderRadius: '6px' }}
                          >
                            <FileText size={14} /> Shared Files
                          </button>
                          <button 
                            onClick={() => { setRightSidebarOpen(true); setActiveRightTab('links'); setMenuOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: '#f8f9fa', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', borderRadius: '6px' }}
                          >
                            <LinkIcon size={14} /> Shared Links
                          </button>
                          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                          <button 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: '#f8f9fa', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', borderRadius: '6px' }}
                          >
                            <VolumeX size={14} /> Mute Notifications
                          </button>
                          <button 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: '#f8f9fa', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', borderRadius: '6px' }}
                          >
                            <Ban size={14} /> Block User
                          </button>
                          <button 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: '#ef4444', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', borderRadius: '6px' }}
                          >
                            <AlertTriangle size={14} /> Report User
                          </button>
                          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }} />
                          <button 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: '#ef4444', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', borderRadius: '6px' }}
                          >
                            <EyeOff size={14} /> Clear Chat
                          </button>
                          <button 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: '#ef4444', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', borderRadius: '6px' }}
                          >
                            <Trash size={14} /> Delete Chat
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Conversation Search */}
                {chatSearchOpen && (
                  <div className="chat-toolbar" style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#16171b', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        type="text" 
                        placeholder="Search text in messages..."
                        value={chatSearchQuery}
                        onChange={(e) => setChatSearchQuery(e.target.value)}
                        style={{
                          backgroundColor: '#0c0d12',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '0.45rem 1rem 0.45rem 2rem',
                          fontSize: '0.82rem',
                          color: '#f8f9fa',
                          width: '100%',
                          outline: 'none',
                        }}
                      />
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                    </div>
                    <button 
                      onClick={() => { setChatSearchOpen(false); setChatSearchQuery(''); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* AI Feature Panel */}
                <div className="chat-toolbar" style={{ backgroundColor: 'rgba(99,102,241,0.04)', padding: '0.45rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6366f1', fontWeight: 700, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Sparkle size={10} /> AI Agent:
                  </span>
                  <button 
                    onClick={handleAISummary}
                    style={{
                      background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
                      border: 'none',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Sparkles size={12} />
                    Summarize Conversation
                  </button>
                </div>

                {/* Failed Message Notice */}
                {failedMessages.length > 0 && (
                  <div className="chat-toolbar" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {failedMessages.map((fm, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#ef4444' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <AlertCircle size={14} /> Failed to send message: "{fm.body}"
                        </span>
                        <button 
                          onClick={() => handleRetry(fm, idx)}
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: 'none', borderRadius: '4px', color: '#ef4444', padding: '0.15rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem' }}
                        >
                          <RefreshCw size={10} /> Retry
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message List */}
                <div 
                  ref={messagesContainerRef}
                  className="chat-messages"
                >
                  {filteredActiveMessages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', gap: '0.75rem' }}>
                      <User size={40} style={{ opacity: 0.3, color: '#6366f1' }} />
                      <p style={{ fontSize: '0.85rem' }}>Beginning of your conversation with {activeChatInfo.partnerName}.</p>
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
                            className="msg-row"
                            style={{
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '65%',
                              display: 'flex',
                              gap: '0.55rem',
                              marginTop: isGrouped ? '2px' : '8px',
                              position: 'relative'
                            }}
                          >
                            {!isMe && !isGrouped && (
                              <div style={{ position: 'relative' }}>
                                {activeChatInfo.partnerAvatar ? (
                                  <img
                                    src={activeChatInfo.partnerAvatar}
                                    alt="avatar"
                                    onError={(e) => {
                                      e.currentTarget.src = "https://api.dicebear.com/7.x/bottts/svg?seed=guest";
                                    }}
                                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', marginTop: '2px' }}
                                  />
                                ) : (
                                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.75rem', marginTop: '2px' }}>
                                    {getInitials(activeChatInfo.partnerName)}
                                  </div>
                                )}
                              </div>
                            )}
                            {!isMe && isGrouped && <div style={{ width: '32px' }} />}

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                              <div
                                style={{
                                  padding: '0.65rem 0.95rem',
                                  borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                                  backgroundColor: isMe ? '#6366f1' : '#1c1c1f',
                                  color: '#f8f9fa',
                                  fontSize: '0.88rem',
                                  lineHeight: '1.45',
                                  wordBreak: 'break-word',
                                  border: isMe ? 'none' : '1px solid var(--border-color)',
                                  position: 'relative'
                                }}
                              >
                                {/* Attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    {msg.attachments.map((att, i) => (
                                      <div key={i} style={{ borderRadius: '8px', overflow: 'hidden' }}>
                                        {att.file_type.includes('image') ? (
                                          <img 
                                            src={att.url} 
                                            alt="attachment" 
                                            onClick={() => setLightboxImage(att.url)}
                                            style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: '8px', cursor: 'pointer', objectFit: 'cover' }} 
                                          />
                                        ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.45rem', borderRadius: '8px' }}>
                                            <FileText size={16} />
                                            <span style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{att.name || 'File'}</span>
                                            <a href={att.url} download style={{ color: '#6366f1' }}><Download size={14} /></a>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {msg.body}

                                {/* Reactions */}
                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.35rem' }}>
                                    {Object.entries(msg.reactions).map(([emoji, users]) => {
                                      if (users.length === 0) return null;
                                      return (
                                        <button 
                                          key={emoji}
                                          onClick={() => handleReaction(msg.id, emoji)}
                                          style={{
                                            backgroundColor: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '8px',
                                            padding: '0.1rem 0.35rem',
                                            fontSize: '0.72rem',
                                            color: '#f8f9fa',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          {emoji} {users.length}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Footer details (timestamp + single tick/double tick checkmark receipts) */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                                  {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                </span>
                                {isMe && (
                                  msg.status === 'sending' ? (
                                    <Loader2 size={10} className="spin" style={{ color: 'var(--text-muted)' }} />
                                  ) : msg.read || msg.status === 'read' ? (
                                    <CheckCheck size={12} style={{ color: '#10b981' }} />
                                  ) : (
                                    <Check size={12} style={{ color: 'var(--text-muted)' }} />
                                  )
                                )}
                              </div>
                            </div>

                            {/* Hover reactions selector bar */}
                            <div className="message-actions-overlay" style={{ display: 'flex', gap: '0.25rem', padding: '0.2rem', backgroundColor: '#1c1c1f', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                              {['👍', '❤️', '🚀', '🔥', '👏'].map(emoji => (
                                <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>{emoji}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Partner Typing Indicator with full "Typing..." text */}
                {partnerTyping && (
                  <div style={{ padding: '0.45rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: '#6366f1' }}>
                    <span>{activeChatInfo.partnerName} is typing...</span>
                    <div className="typing-dots" style={{ display: 'flex', gap: '3px' }}>
                      <span className="dot dot1" />
                      <span className="dot dot2" />
                      <span className="dot dot3" />
                    </div>
                  </div>
                )}

                {/* Message Composer - Rebuilt as modern floating composer card */}
                <div className="chat-composer">
                  {attachments.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem' }}>
                      {attachments.map((att, i) => (
                        <div key={i} style={{ position: 'relative', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0.25rem', backgroundColor: '#1c1c1f' }}>
                          <span style={{ fontSize: '0.72rem', display: 'block', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
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

                  <div className="chat-composer-bar">
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px' }}
                    >
                      <ImageIcon size={18} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      multiple 
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      style={{ display: 'none' }} 
                    />

                    {/* Emoji Trigger */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        type="button" 
                        onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                        style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px' }}
                      >
                        <Smile size={18} />
                      </button>
                      {emojiPickerOpen && (
                        <div style={{ position: 'absolute', bottom: '50px', left: '0', backgroundColor: '#1c1c1f', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem', zIndex: 10 }}>
                          {['👍', '❤️', '🚀', '🔥', '👏', '💡', '🎉', '💻', '🤔', '🙌'].map(emoji => (
                            <button 
                              key={emoji} 
                              type="button"
                              onClick={() => {
                                setNewMessage(prev => prev + emoji);
                                setEmojiPickerOpen(false);
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.15rem' }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <textarea
                      ref={composerTextareaRef}
                      placeholder={`Message ${activeChatInfo.partnerName}...`}
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
                        fontSize: '0.88rem',
                        color: '#f8f9fa',
                        outline: 'none',
                        resize: 'none',
                        padding: '0.4rem 0.25rem',
                        maxHeight: '120px'
                      }}
                    />

                    {/* AI Rewrite Selector */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        type="button" 
                        onClick={() => setAiToneEnhanceOpen(!aiToneEnhanceOpen)}
                        style={{ backgroundColor: 'rgba(99,102,241,0.12)', border: 'none', color: '#6366f1', cursor: 'pointer', padding: '0.45rem', borderRadius: '8px' }}
                      >
                        <Sparkles size={16} />
                      </button>
                      {aiToneEnhanceOpen && (
                        <div style={{ position: 'absolute', bottom: '50px', right: '0', backgroundColor: '#1c1c1f', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', zIndex: 10, width: '140px' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '0.25rem' }}>ENHANCE TONE:</span>
                          {['Professional', 'Inspirational', 'Casual', 'Polite'].map(tone => (
                            <button
                              key={tone}
                              type="button"
                              onClick={() => handleAIEnhance(tone.toLowerCase())}
                              style={{ backgroundColor: 'transparent', border: 'none', color: '#f8f9fa', padding: '0.35rem', textTransform: 'capitalize', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
                            >
                              {tone}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSend()}
                      disabled={(!newMessage.trim() && attachments.length === 0) || sendMessageMutation.isPending}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        backgroundColor: (newMessage.trim() || attachments.length > 0) ? '#6366f1' : 'transparent',
                        color: (newMessage.trim() || attachments.length > 0) ? 'white' : 'var(--text-muted)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: (newMessage.trim() || attachments.length > 0) ? 'pointer' : 'default',
                        transition: 'background-color 0.2s',
                        padding: '0.45rem'
                      }}
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 size={16} className="spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="chat-empty-state">
                <MessageCircle size={54} style={{ opacity: 0.2, color: '#6366f1' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, fontFamily: 'Outfit', color: '#f8f9fa' }}>No Chat Selected</h3>
                <p style={{ fontSize: '0.85rem' }}>Select a conversation from the list to start messaging.</p>
              </div>
            )}
          </div>

          {/* 3. RIGHT SIDEBAR: Shared Media explorer - Redesigned as proper Glassmorphism cards (20%-25% width) */}
          {activePartnerId && activeChatInfo && rightSidebarOpen && (
            <div className="chat-right-sidebar">
              <div className="chat-right-inner">
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Outfit', color: '#f8f9fa' }}>Shared Content</h3>
                  <button onClick={() => setRightSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                  {(['media', 'files', 'links'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveRightTab(tab)}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: 'none',
                        background: 'none',
                        color: activeRightTab === tab ? '#6366f1' : 'var(--text-muted)',
                        borderBottom: activeRightTab === tab ? '2px solid #6366f1' : 'none',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        cursor: 'pointer'
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Search shared items */}
                <div style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder={`Search shared ${activeRightTab}...`}
                      value={sharedSearchQuery}
                      onChange={(e) => setSharedSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--search-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '0.45rem 1rem 0.45rem 2rem',
                        fontSize: '0.78rem',
                        color: '#f8f9fa',
                        outline: 'none',
                      }}
                    />
                    <Search size={12} style={{ position: 'absolute', left: '8px', top: '10px', color: 'var(--text-muted)' }} />
                  </div>
                </div>

                {/* Content Panel */}
                <div className="chat-right-scroll">
                  {activeRightTab === 'media' && (
                    sharedImages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <ImageIcon size={28} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                        <p>No shared media found.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                        {sharedImages.map((m, idx) => {
                          const imgUrl = m.attachments?.[0]?.url || m.body;
                          return (
                            <div 
                              key={idx} 
                              onClick={() => setLightboxImage(imgUrl)}
                              style={{ 
                                aspectRatio: '1', 
                                borderRadius: '8px', 
                                overflow: 'hidden', 
                                cursor: 'pointer',
                                border: '1px solid var(--border-color)'
                              }}
                            >
                              <img src={imgUrl} alt="media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {activeRightTab === 'files' && (
                    sharedFiles.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <FileText size={28} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                        <p>No shared files found.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        {sharedFiles.map((m, idx) => {
                          const file = m.attachments?.[0] || { name: 'Shared Document', size: 1024, url: m.body };
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyItems: 'space-between', padding: '0.55rem', backgroundColor: 'var(--search-bg)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
                                <FileText size={18} style={{ color: '#6366f1' }} />
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: '0.78rem', color: '#f8f9fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(0)} KB</span>
                                </div>
                              </div>
                              <a href={file.url} download style={{ color: '#6366f1', padding: '0.25rem' }}>
                                <Download size={14} />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {activeRightTab === 'links' && (
                    sharedLinks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <LinkIcon size={28} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                        <p>No shared links found.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        {sharedLinks.map((m, idx) => {
                          const urlMatch = m.body.match(/https?:\/\/[^\s]+/);
                          const url = urlMatch ? urlMatch[0] : m.body;
                          return (
                            <a 
                              key={idx} 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                padding: '0.65rem', 
                                backgroundColor: 'var(--search-bg)', 
                                borderRadius: '10px', 
                                border: '1px solid var(--border-color)',
                                textDecoration: 'none'
                              }}
                            >
                              <span style={{ fontSize: '0.78rem', color: '#6366f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>Click to open link</span>
                            </a>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <img src={lightboxImage} alt="lightbox" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px' }} />
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


    </div>
  );
}
