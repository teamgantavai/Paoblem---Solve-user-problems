'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, Send, ArrowLeft, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

interface DBMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  partner_id: string;
  partner_name: string;
  partner_avatar: string;
  body: string;
  read: boolean;
  created_at: string;
}

export default function ChatsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 size={30} className="spin" style={{ color: 'var(--text-muted)' }} />
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const targetUserId = searchParams.get('userId');

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
    refetchInterval: 5000, // poll every 5s for near real-time updates
  });

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

  // Scroll to bottom when messages list changes or active chat changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activePartnerId, mobileConversationOpen]);

  // Set active partner ID on mount or query change
  useEffect(() => {
    if (targetUserId) {
      setActivePartnerId(targetUserId);
      setMobileConversationOpen(true);
    } else if (messages.length > 0 && !activePartnerId) {
      setActivePartnerId(messages[0].partner_id);
    }
  }, [targetUserId, messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ partnerId, body }: { partnerId: string; body: string }) => {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ recipientId: partnerId, body }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      setNewMessage('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['messages', session?.access_token] });
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activePartnerId) return;
    sendMessageMutation.mutate({ partnerId: activePartnerId, body: newMessage });
  };

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 size={30} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-container">
        <Navbar />
        <div className="main-content" style={{ justifyContent: 'center', padding: '4rem 1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <MessageCircle size={48} style={{ color: 'var(--text-muted)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sign in to view messages</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>Connect with builders, founders, and investors by messaging them directly.</p>
            <button className="btn btn-primary" onClick={() => router.push('/')}>Go to Home</button>
          </div>
        </div>
      </div>
    );
  }

  // Group messages into chats
  const chatGroups: Record<string, { partnerName: string; partnerAvatar: string; latestMessage: string; timestamp: string; unread: boolean }> = {};
  messages.forEach((msg) => {
    const pid = msg.partner_id;
    if (!chatGroups[pid]) {
      chatGroups[pid] = {
        partnerName: msg.partner_name,
        partnerAvatar: msg.partner_avatar,
        latestMessage: msg.body,
        timestamp: msg.created_at,
        unread: !msg.read && msg.sender_id !== session.user.id,
      };
    }
  });

  // If there's a targetUserId that has no messages yet, inject them into groups
  if (targetUserId && targetProfileData?.profile && !chatGroups[targetUserId]) {
    chatGroups[targetUserId] = {
      partnerName: targetProfileData.profile.full_name || 'Member',
      partnerAvatar: targetProfileData.profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUserId}`,
      latestMessage: 'Start a conversation...',
      timestamp: new Date().toISOString(),
      unread: false,
    };
  }

  const sortedChats = Object.entries(chatGroups).sort((a, b) => new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime());

  // Filter messages for active chat
  const activeMessages = messages.filter(m => m.partner_id === activePartnerId).reverse();
  const activeChatInfo = activePartnerId ? chatGroups[activePartnerId] : null;

  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content" style={{ padding: '0', height: 'calc(100vh - 65px)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: 'var(--bg-app)' }}>
          
          {/* Chats Sidebar List */}
          <div 
            className={`chats-sidebar-list ${mobileConversationOpen ? 'mobile-hidden' : ''}`}
            style={{ width: '320px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Messages</h2>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {isLoading && messages.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 size={24} className="spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : sortedChats.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <MessageCircle size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                  <p>No conversations yet. Visit a founder's profile to send them a message!</p>
                </div>
              ) : (
                sortedChats.map(([pid, chat]) => (
                  <div
                    key={pid}
                    onClick={() => {
                      setActivePartnerId(pid);
                      setMobileConversationOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      backgroundColor: activePartnerId === pid ? 'var(--bg-hover)' : 'transparent',
                      transition: 'background-color 0.2s',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <img
                      src={chat.partnerAvatar}
                      alt={chat.partnerName}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {chat.partnerName}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {new Date(chat.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: chat.unread ? 'var(--text-main)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: chat.unread ? 700 : 400, marginTop: '2px' }}>
                        {chat.latestMessage}
                      </p>
                    </div>
                    {chat.unread && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)' }} />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Conversation Area */}
          <div 
            className={`chats-conversation-area ${!mobileConversationOpen ? 'mobile-hidden' : ''}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-card)' }}
          >
            {activePartnerId && activeChatInfo ? (
              <>
                {/* Chat Header */}
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button 
                    onClick={() => setMobileConversationOpen(false)}
                    className="mobile-only"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '0.25rem 0.5rem 0.25rem 0' }}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <img
                    src={activeChatInfo.partnerAvatar}
                    alt={activeChatInfo.partnerName}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => router.push(`/profile?userId=${activePartnerId}`)}
                  />
                  <div>
                    <h3 
                      style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)', cursor: 'pointer' }}
                      onClick={() => router.push(`/profile?userId=${activePartnerId}`)}
                    >
                      {activeChatInfo.partnerName}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Online</span>
                  </div>
                </div>

                {/* Messages Feed */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeMessages.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', gap: '0.5rem' }}>
                      <User size={32} style={{ opacity: 0.5 }} />
                      <p style={{ fontSize: '0.85rem' }}>This is the beginning of your conversation with {activeChatInfo.partnerName}.</p>
                    </div>
                  ) : (
                    activeMessages.map((msg) => {
                      const isMe = msg.sender_id === session.user.id;
                      return (
                        <div
                          key={msg.id}
                          style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '70%',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          <div
                            style={{
                              padding: '0.6rem 0.9rem',
                              borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                              backgroundColor: isMe ? 'var(--accent-blue)' : 'var(--bg-hover)',
                              color: isMe ? 'white' : 'var(--text-main)',
                              fontSize: '0.88rem',
                              lineHeight: '1.45',
                              wordBreak: 'break-word',
                            }}
                          >
                            {msg.body}
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: '2px' }}>
                            {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form 
                  onSubmit={handleSend}
                  style={{ padding: '0.85rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', backgroundColor: 'var(--bg-card)' }}
                >
                  <input
                    type="text"
                    placeholder={`Message ${activeChatInfo.partnerName}...`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--search-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '24px',
                      padding: '0.6rem 1.2rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: newMessage.trim() ? 'var(--accent-blue)' : 'var(--bg-hover)',
                      color: newMessage.trim() ? 'white' : 'var(--text-muted)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: newMessage.trim() ? 'pointer' : 'default',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', gap: '0.75rem' }}>
                <MessageCircle size={48} style={{ opacity: 0.3 }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>No Chat Selected</h3>
                <p style={{ fontSize: '0.82rem' }}>Select a chat from the sidebar list to view the conversation details.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-hidden {
            display: none !important;
          }
          .chats-sidebar-list {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
