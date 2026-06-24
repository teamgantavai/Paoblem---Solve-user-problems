'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  Copy,
  Edit3,
  FileText,
  Loader2,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Pin,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  User,
  X,
  Flag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_online?: boolean;
  last_seen_at?: string | null;
};

type Attachment = {
  url: string;
  name: string;
  type: 'image' | 'file';
  mime_type: string;
  size: number;
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  attachments: Attachment[];
  reply_to_message_id: string | null;
  reply_to?: Pick<ChatMessage, 'id' | 'sender_id' | 'content' | 'message_type' | 'attachments'> | null;
  sender?: Profile;
  reads?: { user_id: string; read_at: string }[];
  client_mutation_id?: string | null;
  status?: 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  optimistic?: boolean;
};

type Conversation = {
  id: string;
  partner: Profile;
  last_message: ChatMessage | null;
  unread_count: number;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  blocked: boolean;
  updated_at: string;
};

type MessagesQueryData = {
  messages: ChatMessage[];
  nextCursor: string | null;
};

const EMOJI_OPTIONS = ['😀', '😂', '😊', '😍', '🥳', '😎', '😅', '😢', '😮', '👍', '👏', '🙏', '🔥', '✨', '💡', '❤️', '🚀', '✅'];

function displayName(profile?: Partial<Profile> | null) {
  return profile?.full_name || profile?.username || 'Member';
}

function compactTime(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function statusText(partner?: Profile) {
  if (partner?.is_online) return 'Active now';
  if (partner?.last_seen_at) return `Last seen ${compactTime(partner.last_seen_at)} ago`;
  return 'Offline';
}

function readReceipt(message: ChatMessage, me?: string) {
  if (message.status === 'sending') return 'Sent';
  if (message.status === 'failed') return 'Failed';
  if (message.sender_id !== me) return '';
  if (message.reads?.some((read) => read.user_id !== me) || message.status === 'seen') return 'Seen';
  return 'Delivered';
}

async function authHeaders(session: Session) {
  if (!session?.access_token) throw new Error('Please sign in again.');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  return {
    url,
    name: file.name,
    type: file.type.startsWith('image/') ? 'image' : 'file',
    mime_type: file.type || 'application/octet-stream',
    size: file.size,
  };
}

function Avatar({ profile, size = 42 }: { profile?: Partial<Profile> | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (profile?.avatar_url && !failed) {
    return <img className="chat-avatar" src={profile.avatar_url} alt={displayName(profile)} style={{ width: size, height: size }} onError={() => setFailed(true)} />;
  }
  return (
    <span className="chat-avatar chat-avatar-fallback" style={{ width: size, height: size }}>
      <User size={Math.max(16, Math.floor(size * 0.48))} />
    </span>
  );
}

function ChatsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingLastSentRef = useRef(0);
  const typingExpiryRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [session, setSession] = useState<Session>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(searchParams.get('conversationId'));
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(!!searchParams.get('conversationId'));
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [menuConversation, setMenuConversation] = useState<string | null>(null);
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [conversationView, setConversationView] = useState<'active' | 'archived'>('active');

  const me = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const conversationsQuery = useQuery<Conversation[]>({
    queryKey: ['messaging', 'conversations', conversationView, session?.access_token],
    queryFn: async () => {
      const url = new URL('/api/messages', window.location.origin);
      if (conversationView === 'archived') url.searchParams.set('archived', 'true');
      const res = await fetch(url, { headers: await authHeaders(session) });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not load conversations');
      const data = await res.json();
      return data.conversations || [];
    },
    enabled: !!session?.access_token,
    staleTime: 20_000,
  });

  const messagesQuery = useQuery<MessagesQueryData>({
    queryKey: ['messaging', 'messages', activeConversationId, messageSearch, session?.access_token],
    queryFn: async () => {
      if (!activeConversationId) return { messages: [], nextCursor: null };
      const url = new URL('/api/messages', window.location.origin);
      url.searchParams.set('conversationId', activeConversationId);
      if (messageSearch.trim()) url.searchParams.set('search', messageSearch.trim());
      const res = await fetch(url, { headers: await authHeaders(session) });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not load messages');
      return res.json();
    },
    enabled: !!session?.access_token && !!activeConversationId,
    staleTime: 10_000,
  });

  const activeConversation = conversationsQuery.data?.find((item) => item.id === activeConversationId) || null;
  const messages = messagesQuery.data?.messages || [];
  const activeTyping = activeConversationId ? typingUsers[activeConversationId] : false;
  const conversationSearchTerm = userSearch.trim().toLowerCase();
  const displayedConversations = (conversationsQuery.data || []).filter((conversation) => {
    if (conversationSearchTerm.length <= 1) return true;
    const partnerName = displayName(conversation.partner).toLowerCase();
    const username = conversation.partner?.username?.toLowerCase() || '';
    const preview = conversation.last_message?.content?.toLowerCase() || '';
    return partnerName.includes(conversationSearchTerm) || username.includes(conversationSearchTerm) || preview.includes(conversationSearchTerm);
  });

  const userSuggestionsQuery = useQuery<Profile[]>({
    queryKey: ['messaging', 'user-search', userSearch],
    queryFn: async () => {
      const term = userSearch.trim();
      if (!term) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
        .neq('id', me || '')
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    enabled: !!me && userSearch.trim().length > 1,
  });

  const invalidateMessaging = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
    if (activeConversationId) {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'messages', activeConversationId] });
    }
  }, [activeConversationId, queryClient]);

  const refetchMessaging = useCallback((conversationId?: string) => {
    queryClient.refetchQueries({ queryKey: ['messaging', 'conversations'], type: 'active' });
    if (conversationId) {
      queryClient.refetchQueries({ queryKey: ['messaging', 'messages', conversationId], type: 'active' });
    } else if (activeConversationId) {
      queryClient.refetchQueries({ queryKey: ['messaging', 'messages', activeConversationId], type: 'active' });
    }
  }, [activeConversationId, queryClient]);

  const upsertMessageInCache = useCallback((incoming: Partial<ChatMessage> & { id: string; conversation_id: string }) => {
    queryClient.setQueriesData<{ messages: ChatMessage[]; nextCursor: string | null }>(
      { queryKey: ['messaging', 'messages', incoming.conversation_id] },
      (current) => {
        if (!current?.messages) return current;
        const normalized = {
          ...incoming,
          attachments: incoming.deleted_at ? [] : incoming.attachments || [],
          content: incoming.deleted_at ? 'This message was deleted' : incoming.content || '',
        } as ChatMessage;
        const withoutDuplicate = current.messages.filter((message) => (
          message.id !== incoming.id
          && (!incoming.client_mutation_id || message.client_mutation_id !== incoming.client_mutation_id)
        ));
        return {
          ...current,
          messages: [...withoutDuplicate, normalized].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        };
      }
    );
  }, [queryClient]);

  useEffect(() => {
    if (!session?.access_token) return;

    const setOnline = (isOnline: boolean) => {
      fetch('/api/messaging/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ isOnline }),
        keepalive: true,
      }).catch(() => {});
    };

    setOnline(true);
    heartbeatRef.current = setInterval(() => setOnline(true), 45_000);
    const offline = () => setOnline(false);
    window.addEventListener('beforeunload', offline);
    document.addEventListener('visibilitychange', () => setOnline(!document.hidden));

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      window.removeEventListener('beforeunload', offline);
      offline();
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!me) return;

    const channel = supabase
      .channel(`messaging:${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const row = (payload.new || payload.old) as Partial<ChatMessage> & { id?: string; conversation_id?: string };
        if (!row?.conversation_id) return;
        if (row.id && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
          upsertMessageInCache(row as Partial<ChatMessage> & { id: string; conversation_id: string });
        }
        refetchMessaging(row.conversation_id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_deletions' }, () => refetchMessaging())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, () => refetchMessaging())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, () => refetchMessaging())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => refetchMessaging())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, queryClient, refetchMessaging, upsertMessageInCache]);

  useEffect(() => {
    if (!me) return;

    const channel = supabase
      .channel('messaging-typing', {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const conversationId = String(payload?.conversationId || '');
        const userId = String(payload?.userId || '');
        const isTyping = Boolean(payload?.isTyping);
        const sentAt = Number(payload?.sentAt || 0);

        if (!conversationId || userId === me) return;
        if (sentAt && Date.now() - sentAt > 5_000) return;

        if (typingExpiryRefs.current[conversationId]) {
          clearTimeout(typingExpiryRefs.current[conversationId]);
        }

        setTypingUsers((current) => ({ ...current, [conversationId]: isTyping }));

        if (isTyping) {
          typingExpiryRefs.current[conversationId] = setTimeout(() => {
            setTypingUsers((current) => ({ ...current, [conversationId]: false }));
            delete typingExpiryRefs.current[conversationId];
          }, 3_500);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;

    return () => {
      Object.values(typingExpiryRefs.current).forEach(clearTimeout);
      typingExpiryRefs.current = {};
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [me]);

  useEffect(() => {
    if (!activeConversationId || !session?.access_token) return;
    fetch('/api/messages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'read', conversationId: activeConversationId }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
    }).catch(() => {});
  }, [activeConversationId, session?.access_token, queryClient, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeConversationId, messages.length, activeTyping]);

  const openConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setMobileOpen(true);
    setMessageSearch('');
    setReplyTo(null);
    setEditingMessage(null);
    router.replace(`/chats?conversationId=${conversationId}`, { scroll: false });
  };

  const startTopLoader = () => window.dispatchEvent(new Event('top-loader:start'));
  const finishTopLoader = () => window.dispatchEvent(new Event('top-loader:finish'));

  const startConversation = async (profile: Profile) => {
    setStartingUserId(profile.id);
    startTopLoader();
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({
          recipientId: profile.id,
          startOnly: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not start conversation');
      const data = await res.json();
      setUserSearch('');
      await conversationsQuery.refetch();
      openConversation(data.conversationId);
    } finally {
      setStartingUserId(null);
      finishTopLoader();
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!draft.trim() && !attachments.length) return null;
      const clientMutationId = crypto.randomUUID();
      const payload = {
        conversationId: activeConversationId,
        recipientId: activeConversation?.partner?.id,
        body: draft,
        attachments,
        replyToMessageId: replyTo?.id,
        clientMutationId,
      };
      const optimistic: ChatMessage = {
        id: clientMutationId,
        conversation_id: activeConversationId || '',
        sender_id: me || '',
        content: draft,
        message_type: attachments.length ? (attachments.some((item) => item.type === 'image') ? 'image' : 'file') : 'text',
        attachments,
        reply_to_message_id: replyTo?.id || null,
        reply_to: replyTo ? {
          id: replyTo.id,
          sender_id: replyTo.sender_id,
          content: replyTo.content,
          message_type: replyTo.message_type,
          attachments: replyTo.attachments,
        } : null,
        reads: [],
        client_mutation_id: clientMutationId,
        status: 'sending',
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        optimistic: true,
      };

      if (activeConversationId) {
        queryClient.setQueryData<MessagesQueryData>(['messaging', 'messages', activeConversationId, messageSearch, session?.access_token], (current) => ({
          messages: [...(current?.messages || []), optimistic],
          nextCursor: current?.nextCursor || null,
        }));
      }

      setDraft('');
      setAttachments([]);
      setReplyTo(null);

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to send message');
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.conversationId && !activeConversationId) openConversation(data.conversationId);
      invalidateMessaging();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      invalidateMessaging();
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingMessage) return;
      const res = await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ messageId: editingMessage.id, body: draft }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not edit message');
    },
    onSuccess: () => {
      setDraft('');
      setEditingMessage(null);
      invalidateMessaging();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMessage = async (messageId: string, scope: 'me' | 'everyone' = 'everyone') => {
    const res = await fetch('/api/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
      body: JSON.stringify({ messageId, scope }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Could not delete message');
    invalidateMessaging();
  };

  const conversationAction = async (conversationId: string, action: 'pin' | 'archive' | 'block' | 'report', enabled = true) => {
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: action === 'report' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
      body: JSON.stringify({ action, enabled }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Action failed');
    toast.success(action === 'report' ? 'Report submitted' : 'Conversation updated');
    setMenuConversation(null);
    invalidateMessaging();
    if (action === 'archive' && enabled && activeConversationId === conversationId) {
      setActiveConversationId(null);
      router.replace('/chats', { scroll: false });
    }
  };

  const broadcastTyping = (isTyping: boolean) => {
    if (!activeConversationId || !me) return;
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    if (isTyping && now - typingLastSentRef.current < 450) return;
    typingLastSentRef.current = now;
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        conversationId: activeConversationId,
        userId: me,
        isTyping,
        sentAt: now,
      },
    }).catch(() => {});
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    broadcastTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => broadcastTyping(false), 2200);
  };

  const insertEmoji = (emoji: string) => {
    onDraftChange(`${draft}${emoji}`);
    setEmojiOpen(false);
  };

  const onFilesSelected = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const next = await Promise.all(Array.from(files).slice(0, 4).map(fileToAttachment));
      setAttachments((current) => [...current, ...next].slice(0, 4));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not attach file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (sessionLoading) {
    return (
      <div className="chat-page-root chat-centered">
        <Loader2 className="spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="chat-page-root">
        <Navbar />
        <main className="chat-auth-state">
          <MessageCircle size={42} />
          <h1>Sign in to view messages</h1>
          <p>Private conversations are available after login.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="chat-page-root">
      <Navbar />
      <main className="chat-layout">
        <aside className={`chat-sidebar ${mobileOpen ? 'mobile-hidden' : ''}`}>
          <div className="chat-sidebar-header">
            <div className="chat-title-row">
              <div>
                <h1>{conversationView === 'archived' ? 'Archived' : 'Messages'}</h1>
                <span>{conversationsQuery.data?.reduce((sum, item) => sum + item.unread_count, 0) || 0} unread</span>
              </div>
              <MessageCircle size={22} />
            </div>
            <div className="chat-view-tabs" role="tablist" aria-label="Conversation view">
              <button
                type="button"
                className={conversationView === 'active' ? 'active' : ''}
                onClick={() => {
                  setConversationView('active');
                  setActiveConversationId(null);
                  router.replace('/chats', { scroll: false });
                }}
              >
                Active
              </button>
              <button
                type="button"
                className={conversationView === 'archived' ? 'active' : ''}
                onClick={() => {
                  setConversationView('archived');
                  setActiveConversationId(null);
                  router.replace('/chats', { scroll: false });
                }}
              >
                Archive
              </button>
            </div>
            <label className="chat-search">
              <Search size={16} />
              <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search people" />
            </label>
          </div>

          {userSearch.trim().length > 1 && (
            <div className="chat-user-results">
              {(userSuggestionsQuery.data || []).map((profile) => (
                <button
                  key={profile.id}
                  disabled={!!startingUserId}
                  className={startingUserId === profile.id ? 'is-loading' : ''}
                  onClick={() => startConversation(profile).catch((error) => toast.error(error.message || 'Could not start chat'))}
                >
                  <Avatar profile={profile} size={34} />
                  <span>
                    <strong>{displayName(profile)}</strong>
                    <small>{startingUserId === profile.id ? 'Opening chat...' : `@${profile.username}`}</small>
                  </span>
                  {startingUserId === profile.id && <Loader2 className="spin chat-user-loading" size={17} />}
                </button>
              ))}
              {!userSuggestionsQuery.isLoading && !userSuggestionsQuery.data?.length && <p>No people found</p>}
            </div>
          )}

          <div className="chat-sidebar-scroll">
            {conversationsQuery.isLoading && Array.from({ length: 7 }).map((_, index) => <div className="chat-skeleton" key={index} />)}
            {!conversationsQuery.isLoading && !displayedConversations.length && (
              <div className="chat-empty-list">
                <MessageCircle size={34} />
                <p>{conversationSearchTerm.length > 1 ? 'No matching conversations' : conversationView === 'archived' ? 'No archived conversations' : 'No conversations yet'}</p>
              </div>
            )}
            {displayedConversations.map((conversation) => (
              <button
                key={conversation.id}
                className={`conversation-card-item ${conversation.id === activeConversationId ? 'active' : ''}`}
                onClick={() => openConversation(conversation.id)}
              >
                <span className="chat-avatar-wrap">
                  <Avatar profile={conversation.partner} />
                  <i className={conversation.partner?.is_online ? 'online' : ''} />
                </span>
                <span className="conversation-text">
                  <span className="conversation-topline">
                    <strong>{displayName(conversation.partner)}</strong>
                    <small>{compactTime(conversation.updated_at)}</small>
                  </span>
                  <span className="conversation-preview">
                    {conversation.pinned && <Pin size={13} />}
                    {conversation.last_message?.attachments?.length ? 'Attachment' : conversation.last_message?.content || 'Say hello'}
                  </span>
                </span>
                {conversation.unread_count > 0 && <span className="chat-unread-badge">{conversation.unread_count}</span>}
              </button>
            ))}
          </div>
        </aside>

        <section className={`chat-center ${mobileOpen ? 'mobile-active' : 'mobile-hidden'}`}>
          {!activeConversation ? (
            <div className="chat-empty-state">
              <MessageCircle size={46} />
              <h2>Select a conversation</h2>
              <p>Search for someone or open an existing message thread.</p>
            </div>
          ) : (
            <div className="chat-window">
              <header className="chat-window-header">
                <div className="chat-header-user">
                  <button className="chat-icon-btn back-btn-mobile" onClick={() => setMobileOpen(false)} title="Back">
                    <ArrowLeft size={20} />
                  </button>
                  <span className="chat-avatar-wrap">
                    <Avatar profile={activeConversation.partner} />
                    <i className={activeConversation.partner?.is_online ? 'online' : ''} />
                  </span>
                  <div>
                    <h2>{displayName(activeConversation.partner)}</h2>
                    <p>{activeTyping ? `${displayName(activeConversation.partner)} is typing...` : statusText(activeConversation.partner)}</p>
                  </div>
                </div>
                <div className="chat-header-actions">
                  <label className="chat-message-search">
                    <Search size={15} />
                    <input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search" />
                  </label>
                  <button className="chat-icon-btn" onClick={() => setMenuConversation(menuConversation === activeConversation.id ? null : activeConversation.id)} title="More">
                    <MoreVertical size={20} />
                  </button>
                  {menuConversation === activeConversation.id && (
                    <div className="chat-floating-menu">
                      <button className="chat-menu-item" onClick={() => conversationAction(activeConversation.id, 'pin', !activeConversation.pinned)}><Pin size={16} />{activeConversation.pinned ? 'Unpin' : 'Pin'}</button>
                      <button className="chat-menu-item" onClick={() => conversationAction(activeConversation.id, 'archive', !activeConversation.archived)}><Archive size={16} />{activeConversation.archived ? 'Restore' : 'Archive'}</button>
                      <button className="chat-menu-item" onClick={() => conversationAction(activeConversation.id, 'block', !activeConversation.blocked)}><Ban size={16} />{activeConversation.blocked ? 'Unblock' : 'Block'}</button>
                      <button className="chat-menu-item chat-menu-item-danger" onClick={() => conversationAction(activeConversation.id, 'report')}><Flag size={16} />Report</button>
                    </div>
                  )}
                </div>
              </header>

              {messagesQuery.isError && (
                <div className="chat-error-state">
                  Could not load messages.
                  <button onClick={() => messagesQuery.refetch()}>Retry</button>
                </div>
              )}

              <div className="chat-messages" ref={messageListRef}>
                {messagesQuery.isLoading && Array.from({ length: 8 }).map((_, index) => <div className="message-skeleton" key={index} />)}
                {!messagesQuery.isLoading && messages.length === 0 && (
                  <div className="chat-thread-empty">
                    <Smile size={34} />
                    <p>No messages here yet</p>
                  </div>
                )}
                {messages.map((message) => {
                  const mine = message.sender_id === me;
                  return (
                    <article key={message.id} className={`message-row ${mine ? 'mine' : 'theirs'} ${message.status === 'failed' ? 'failed' : ''}`} data-message-id={message.id}>
                      <div className="message-bubble">
                        {message.reply_to && (
                          <button className="message-reply-preview" onClick={() => document.querySelector(`[data-message-id="${message.reply_to?.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                            <Reply size={13} />
                            <span>{message.reply_to.content || 'Attachment'}</span>
                          </button>
                        )}
                        {!!message.attachments?.length && (
                          <div className="message-attachments">
                            {message.attachments.map((attachment, index) => attachment.type === 'image' ? (
                              <a href={attachment.url} target="_blank" rel="noreferrer" key={`${attachment.url}-${index}`}>
                                <img src={attachment.url} alt={attachment.name} />
                              </a>
                            ) : (
                              <a className="message-file" href={attachment.url} download={attachment.name} key={`${attachment.url}-${index}`}>
                                <FileText size={18} />
                                <span>{attachment.name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        {message.content && <p>{message.content}</p>}
                        <footer className="message-meta">
                          <time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                          {message.edited_at && <span>Edited</span>}
                          {mine && <span className="receipt">{readReceipt(message, me)} {readReceipt(message, me) === 'Seen' ? <CheckCheck size={13} /> : <Check size={13} />}</span>}
                        </footer>
                        <div className="message-actions-overlay active">
                          <button className="chat-icon-btn" onClick={() => setReplyTo(message)} title="Reply"><Reply size={15} /></button>
                          <button className="chat-icon-btn" onClick={() => navigator.clipboard.writeText(message.content || '')} title="Copy"><Copy size={15} /></button>
                          {mine && !message.deleted_at && (
                            <>
                              <button className="chat-icon-btn" onClick={() => { setEditingMessage(message); setDraft(message.content); }} title="Edit"><Edit3 size={15} /></button>
                              <button className="chat-icon-btn chat-icon-btn-danger" onClick={() => deleteMessage(message.id, 'everyone').catch((err) => toast.error(err.message))} title="Delete for everyone"><Trash2 size={15} /></button>
                            </>
                          )}
                          {!message.deleted_at && (
                            <button className="chat-icon-btn" onClick={() => deleteMessage(message.id, 'me').catch((err) => toast.error(err.message))} title="Delete for me"><X size={15} /></button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
                {activeTyping && (
                  <div className="message-row theirs">
                    <div className="typing-bubble"><span /><span /><span /></div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <footer className="chat-composer">
                {(replyTo || editingMessage || attachments.length > 0) && (
                  <div className="composer-context">
                    <div>
                      {editingMessage ? <strong>Editing message</strong> : replyTo ? <strong>Replying</strong> : <strong>{attachments.length} attachment{attachments.length > 1 ? 's' : ''}</strong>}
                      <span>{editingMessage?.content || replyTo?.content || attachments.map((item) => item.name).join(', ')}</span>
                    </div>
                    <button className="chat-icon-btn" onClick={() => { setReplyTo(null); setEditingMessage(null); setAttachments([]); if (editingMessage) setDraft(''); }} title="Clear"><X size={18} /></button>
                  </div>
                )}
                <div className="chat-composer-bar">
                  <input ref={fileInputRef} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.txt,.zip" onChange={(event) => onFilesSelected(event.target.files)} />
                  <button className="chat-icon-btn" onClick={() => fileInputRef.current?.click()} title="Attach"><Paperclip size={20} /></button>
                  <div className="emoji-picker-wrap">
                    <button className="chat-icon-btn" onClick={() => setEmojiOpen((open) => !open)} title="Emoji"><Smile size={20} /></button>
                    {emojiOpen && (
                      <div className="emoji-picker" role="menu" aria-label="Choose emoji">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}>{emoji}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (editingMessage) {
                        editMutation.mutate();
                      } else {
                        sendMutation.mutate();
                      }
                    }
                  }} placeholder="Message" rows={1} />
                  <button className="chat-send-btn" disabled={sendMutation.isPending || editMutation.isPending || (!draft.trim() && !attachments.length)} onClick={() => {
                    if (editingMessage) {
                      editMutation.mutate();
                    } else {
                      sendMutation.mutate();
                    }
                  }} title="Send">
                    {sendMutation.isPending || editMutation.isPending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                  </button>
                </div>
              </footer>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ChatsPage() {
  return (
    <Suspense fallback={<div className="chat-page-root chat-centered"><Loader2 className="spin" /></div>}>
      <ChatsPageContent />
    </Suspense>
  );
}
