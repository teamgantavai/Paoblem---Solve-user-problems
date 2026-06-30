'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Copy,
  Edit3,
  FileText,
  Forward,
  Loader2,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Pin,
  Reply,
  Search,
  Send,
  ShieldCheck,
  ShieldOff,
  Smile,
  Trash2,
  User,
  X,
  Flag,
  Users,
  UserPlus,
  PlusCircle,
  Crown,
  Shield,
  Swords,
  Info,
  LogOut,
  Link2,
  Settings,
  Hash,
  VolumeX,
  Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import { parseLinksInText } from '@/app/lib/linkParser';
import { decodeHTMLEntities } from '@/lib/htmlDecoder';

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

type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  attachments: Attachment[];
  reply_to_message_id: string | null;
  reply_to?: GroupMessage | null;
  mentions: string[];
  pinned_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  sender?: Profile | null;
  reactions: { emoji: string; users: string[] }[];
  reads: { user_id: string; read_at: string }[];
  my_reaction?: string | null;
  client_mutation_id?: string | null;
  created_at: string;
  optimistic?: boolean;
  forwarded_from?: string | null; // sender name attribution
};

type ContextMenuState = {
  messageId: string;
  x: number;
  y: number;
} | null;

type GroupMember = {
  user_id: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  muted_until: string | null;
  joined_at: string;
  profile: Profile | null;
  is_online: boolean;
  last_seen_at: string | null;
};

type Group = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  category: string | null;
  privacy: 'public' | 'private';
  invite_permission: string;
  message_permission: string;
  member_count: number;
  last_message_at: string | null;
  created_at: string;
  my_role?: string;
  unread_count?: number;
  last_message?: {
    id: string;
    content: string;
    message_type: string;
    sender: Profile | null;
    created_at: string;
  } | null;
};

const EMOJI_QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✨'];
const EMOJI_FULL = ['😀','😂','😊','😍','🥳','😎','😅','😢','😮','👍','👏','🙏','🔥','✨','💡','❤️','🚀','✅','🎉','💪','🤝','💯'];
const GROUP_CATEGORIES = ['Tech', 'SaaS', 'E-commerce', 'FinTech', 'HealthTech', 'EdTech', 'AI/ML', 'Web3', 'Social', 'Gaming', 'B2B', 'B2C', 'Other'];
const EMOJI_OPTIONS = ['😀', '😂', '😊', '😍', '🥳', '😎', '😅', '😢', '😮', '👍', '👏', '🙏', '🔥', '✨', '💡', '❤️', '🚀', '✅'];
const LONG_PRESS_MS = 500;
const MUTE_OPTIONS = [
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 1440 },
  { label: '7 days', minutes: 10080 },
  { label: 'Unmute', minutes: 0 },
];

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

function groupReadReceipt(message: GroupMessage, me?: string) {
  if (message.optimistic) return 'Sending';
  if (message.sender_id !== me) return '';
  const readByOthers = message.reads?.filter((r) => r.user_id !== me) || [];
  if (readByOthers.length > 0) return 'Seen';
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

function Avatar({ profile, size = 42, onClick }: { profile?: Partial<Profile> | null; size?: number; onClick?: () => void }) {
  const [failed, setFailed] = useState(false);
  if (profile?.avatar_url && !failed) {
    return <img className="chat-avatar" src={profile.avatar_url} alt={displayName(profile)} style={{ width: size, height: size, cursor: onClick ? 'pointer' : 'default' }} onError={() => setFailed(true)} onClick={onClick} />;
  }
  return (
    <span className="chat-avatar chat-avatar-fallback" style={{ width: size, height: size, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <User size={Math.max(16, Math.floor(size * 0.48))} />
    </span>
  );
}

/* ── Group Avatar ────────────────────────────────────────────── */
function GroupAvatar({ name, avatarUrl, size = 42, radius = 12 }: {
  name?: string; avatarUrl?: string | null; size?: number; radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const letter = (name || '?')[0].toUpperCase();
  if (avatarUrl && !failed) {
    return <img src={avatarUrl} alt={name || 'Group'} className="group-avatar" style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover' }} onError={() => setFailed(true)} />;
  }
  return (
    <span className="group-avatar-fallback" style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 'bold' }}>
      {letter}
    </span>
  );
}

/* ── Member Avatar ───────────────────────────────────────────── */
function MemberAvatar({ profile, size = 32 }: { profile: Profile | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const letter = displayName(profile)[0].toUpperCase();
  if (profile?.avatar_url && !failed) {
    return <img src={profile.avatar_url} alt={displayName(profile)} className="group-msg-avatar" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} onError={() => setFailed(true)} />;
  }
  return (
    <span className="group-msg-avatar-fallback" style={{ width: size, height: size, borderRadius: '50%', fontSize: size * 0.38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', fontWeight: 'bold' }}>
      {letter}
    </span>
  );
}

/* ── Role Badge ──────────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  if (role === 'owner') return <span className="role-badge owner"><Crown size={10} style={{ marginRight: 2 }} />Owner</span>;
  if (role === 'admin') return <span className="role-badge admin"><Shield size={10} style={{ marginRight: 2 }} />Admin</span>;
  if (role === 'moderator') return <span className="role-badge moderator"><Swords size={10} style={{ marginRight: 2 }} />Mod</span>;
  return null;
}

/* ── Reusable Message Actions Component ────────────────────────── */
interface MessageActionsProps {
  messageId: string;
  content: string;
  mine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  showForward?: boolean;
  reactions: any[];
  me: string | null | undefined;
  activeReactionMenu: string | null;
  setActiveReactionMenu: React.Dispatch<React.SetStateAction<string | null>>;
  activeMessageMenu: string | null;
  setActiveMessageMenu: React.Dispatch<React.SetStateAction<string | null>>;
  onReply: () => void;
  onForward?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  positioningStyle?: React.CSSProperties;
}

function MessageActions({
  messageId,
  content,
  mine,
  canEdit,
  canDelete,
  showForward = false,
  reactions,
  me,
  activeReactionMenu,
  setActiveReactionMenu,
  activeMessageMenu,
  setActiveMessageMenu,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReact,
  positioningStyle
}: MessageActionsProps) {
  return (
    <>
      {/* Actions overlay — hover toolbar */}
      <div
        className={`group-msg-actions-overlay ${(activeReactionMenu === messageId || activeMessageMenu === messageId) ? 'visible' : ''}`}
        style={positioningStyle}
      >
        <button
          className="chat-icon-btn"
          title="React"
          onClick={(e) => {
            e.stopPropagation();
            setActiveReactionMenu(r => r === messageId ? null : messageId);
          }}
        >
          <Smile size={14} />
        </button>
        <button
          className="chat-icon-btn"
          title="Reply"
          onClick={(e) => {
            e.stopPropagation();
            onReply();
            setActiveMessageMenu(null);
          }}
        >
          <Reply size={14} />
        </button>
        {showForward && onForward && (
          <button
            className="chat-icon-btn"
            title="Forward"
            onClick={(e) => {
              e.stopPropagation();
              onForward();
              setActiveMessageMenu(null);
            }}
          >
            <Forward size={14} />
          </button>
        )}
        <button
          className="chat-icon-btn"
          title="Copy"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(content || '');
            toast.success('Copied');
            setActiveMessageMenu(null);
          }}
        >
          <Copy size={14} />
        </button>
        {mine && canEdit && (
          <button
            className="chat-icon-btn"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
              setActiveMessageMenu(null);
            }}
          >
            <Edit3 size={14} />
          </button>
        )}
        {canDelete && (
          <button
            className="chat-icon-btn danger"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setActiveMessageMenu(null);
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Viewport-aware reaction picker */}
      {activeReactionMenu === messageId && (
        <div
          className="group-reaction-picker"
          style={{ [mine ? 'right' : 'left']: 0, bottom: 'calc(100% + 6px)' }}
          onClick={e => e.stopPropagation()}
        >
          {EMOJI_QUICK.map(emoji => {
            const isActive = me && reactions?.find(r => r.emoji === emoji)?.users.includes(me);
            return (
              <button
                key={emoji}
                className={isActive ? 'active' : ''}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(emoji);
                }}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ── Render Group Message ───────────────────────────────────── */
function renderGroupMessage(content: string, members: GroupMember[], mine: boolean) {
  if (!content) return null;
  const decoded = decodeHTMLEntities(content);
  const segments = parseLinksInText(decoded);
  return (
    <p>
      {segments.map((seg, i) => {
        if (seg.type === 'link') {
          return (
            <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer"
              style={{ color: mine ? '#93c5fd' : '#3b82f6', textDecoration: 'underline', wordBreak: 'break-all', cursor: 'pointer' }}
              onClick={(e) => e.stopPropagation()}>
              {seg.display}
            </a>
          );
        }
        // Process @mentions
        const parts = seg.content.split(/(@\w+)/g);
        return (
          <React.Fragment key={i}>
            {parts.map((part, j) => {
              if (part.startsWith('@')) {
                const username = part.slice(1);
                const member = members.find(m => m.profile?.username === username);
                return member
                  ? <span key={j} className="group-mention">{part}</span>
                  : <span key={j}>{part}</span>;
              }
              return <span key={j}>{part.split('\n').flatMap((line, li, arr) => [line, li < arr.length - 1 ? <br key={li} /> : null]).filter(Boolean)}</span>;
            })}
          </React.Fragment>
        );
      })}
    </p>
  );
}

/* ── Create Group Modal ─────────────────────────────────────── */
function CreateGroupModal({ session, onClose, onCreated }: {
  session: Session;
  onClose: () => void;
  onCreated: (group: Group) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: suggestions } = useQuery<Profile[]>({
    queryKey: ['group-create-member-search', memberSearch],
    queryFn: async () => {
      if (!memberSearch.trim() || memberSearch.length < 2) return [];
      const { data } = await supabase.from('profiles')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${memberSearch}%,full_name.ilike.%${memberSearch}%`)
        .neq('id', session?.user.id || '')
        .limit(8);
      return data || [];
    },
    enabled: memberSearch.length >= 2,
  });

  const handleAvatarUpload = async (file: File) => {
    const att = await fileToAttachment(file);
    setAvatarUrl(att.url);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Group name is required'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders(session) },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category: category || null,
          privacy,
          avatarUrl,
          memberIds: selectedMembers.map(m => m.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');
      toast.success('Group created!');
      onCreated(data.group);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Details', 'Customize', 'Members'];

  return (
    <div className="group-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="group-modal">
        <button className="group-modal-close" onClick={onClose}><X size={18} /></button>
        <h2>Create a Group</h2>
        <div className="group-modal-steps">
          {steps.map((_, i) => (
            <div key={i} className={`group-modal-step-dot ${i <= step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="group-modal-step">
            <div className="group-form-field">
              <label>Group Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Startup Founders Hub" maxLength={100} autoFocus />
            </div>
            <div className="group-form-field">
              <label>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this group about?" maxLength={500} rows={3} />
            </div>
            <div className="group-form-field">
              <label>Category</label>
              <div className="group-category-tags">
                {GROUP_CATEGORIES.map(cat => (
                  <button key={cat} type="button" className={`group-category-tag ${category === cat ? 'active' : ''}`} onClick={() => setCategory(c => c === cat ? '' : cat)}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="group-form-field">
              <label>Privacy</label>
              <select value={privacy} onChange={e => setPrivacy(e.target.value as 'public' | 'private')}>
                <option value="public">🌐 Public — anyone can find and join</option>
                <option value="private">🔒 Private — invite only</option>
              </select>
            </div>
            <div className="group-modal-actions">
              <button className="group-btn-secondary" onClick={onClose}>Cancel</button>
              <button className="group-btn-primary" onClick={() => setStep(1)} disabled={!name.trim()}>
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="group-modal-step">
            <div className="group-avatar-upload">
              <div className="group-avatar-upload-circle" onClick={() => fileRef.current?.click()}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="group avatar" />
                  : name[0]?.toUpperCase() || <ImageIcon size={32} />}
              </div>
              <p className="group-avatar-upload-hint">Click to upload a group avatar (optional)</p>
              <input ref={fileRef} type="file" hidden accept="image/*"
                onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
            </div>
            <div className="group-modal-actions">
              <button className="group-btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button className="group-btn-primary" onClick={() => setStep(2)}>Next →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="group-modal-step">
            <div className="group-form-field">
              <label>Invite Members (optional)</label>
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search by username or name" />
            </div>
            {suggestions && suggestions.length > 0 && (
              <div className="group-member-search-results">
                {suggestions.filter(s => !selectedMembers.find(m => m.id === s.id)).map(profile => (
                  <button key={profile.id} className="group-member-search-item" onClick={() => {
                    setSelectedMembers(prev => [...prev, profile]);
                    setMemberSearch('');
                  }}>
                    <Avatar profile={profile} size={30} />
                    <span>
                      <strong style={{ fontSize: '0.87rem' }}>{displayName(profile)}</strong>
                      <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>@{profile.username}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedMembers.length > 0 && (
              <div className="group-selected-members">
                {selectedMembers.map(m => (
                  <span key={m.id} className="group-selected-member-chip">
                    <Avatar profile={m} size={20} />
                    {displayName(m)}
                    <button style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0 }}
                      onClick={() => setSelectedMembers(prev => prev.filter(x => x.id !== m.id))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="group-modal-actions">
              <button className="group-btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="group-btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : null}
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Invite Modal ───────────────────────────────────────────── */
function InviteModal({ groupId, session, onClose }: {
  groupId: string; session: Session; onClose: () => void;
}) {
  const [tab, setTab] = useState<'user' | 'link'>('user');
  const [search, setSearch] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: suggestions } = useQuery<Profile[]>({
    queryKey: ['invite-search', search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data } = await supabase.from('profiles')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${search}%,full_name.ilike.%${search}%`)
        .neq('id', session?.user.id || '')
        .limit(8);
      return data || [];
    },
    enabled: search.length >= 2,
  });

  const generateLink = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders(session) },
        body: JSON.stringify({ type: 'link', expires_days: 7 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteLink(data.link);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate invite link');
    } finally {
      setLoading(false);
    }
  };

  const inviteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders(session) },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Invite sent!');
      setSearch('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    }
  };

  return (
    <div className="group-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="group-modal">
        <button className="group-modal-close" onClick={onClose}><X size={18} /></button>
        <h2><UserPlus size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Invite Members</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className={`group-btn-${tab === 'user' ? 'primary' : 'secondary'}`} style={{ flex: 1, padding: '0.5rem' }}
            onClick={() => setTab('user')}>By Username</button>
          <button className={`group-btn-${tab === 'link' ? 'primary' : 'secondary'}`} style={{ flex: 1, padding: '0.5rem' }}
            onClick={() => setTab('link')}>Invite Link</button>
        </div>
        {tab === 'user' ? (
          <div className="group-modal-step">
            <div className="group-form-field">
              <label>Search user</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="@username or name" autoFocus />
            </div>
            {suggestions && suggestions.length > 0 && (
              <div className="group-member-search-results">
                {suggestions.map(profile => (
                  <button key={profile.id} className="group-member-search-item" onClick={() => inviteUser(profile.id)}>
                    <Avatar profile={profile} size={30} />
                    <span>
                      <strong style={{ fontSize: '0.87rem' }}>{displayName(profile)}</strong>
                      <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>@{profile.username}</small>
                    </span>
                    <UserPlus size={14} style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="group-modal-step">
            {inviteLink ? (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Share this link — expires in 7 days</p>
                <div className="group-invite-link-box">
                  <Link2 size={14} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteLink}</span>
                  <button className="group-icon-btn" onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    toast.success('Copied!');
                  }}><Copy size={14} /></button>
                </div>
              </>
            ) : (
              <button className="group-btn-primary" onClick={generateLink} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />}
                {loading ? 'Generating...' : 'Generate Invite Link'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Group Settings Modal ───────────────────────────────────── */
function GroupSettingsModal({ group, session, onClose, onUpdated }: {
  group: Group; session: Session; onClose: () => void; onUpdated: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [privacy, setPrivacy] = useState(group.privacy);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...await authHeaders(session) },
        body: JSON.stringify({ name, description, privacy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Group updated!');
      onUpdated();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="group-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="group-modal">
        <button className="group-modal-close" onClick={onClose}><X size={18} /></button>
        <h2><Settings size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Group Settings</h2>
        <div className="group-modal-step">
          <div className="group-form-field">
            <label>Group Name</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={100} />
          </div>
          <div className="group-form-field">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3} />
          </div>
          <div className="group-form-field">
            <label>Privacy</label>
            <select value={privacy} onChange={e => setPrivacy(e.target.value as 'public' | 'private')}>
              <option value="public">🌐 Public</option>
              <option value="private">🔒 Private</option>
            </select>
          </div>
          <div className="group-modal-actions">
            <button className="group-btn-secondary" onClick={onClose}>Cancel</button>
            <button className="group-btn-primary" onClick={save} disabled={loading || !name.trim()}>
              {loading ? <Loader2 size={16} className="spin" /> : null}
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Custom Confirmation Modal ──────────────────────────────── */
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmDialog({ isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, loading }: ConfirmDialogProps) {
  if (!isOpen) return null;
  return (
    <div className="group-modal-overlay" style={{ zIndex: 3000 }}>
      <div className="group-modal" style={{ maxWidth: 400, width: '90%', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-main)' }}>{title}</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.4' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="group-btn-secondary" onClick={onCancel} disabled={loading} style={{ flex: 1, padding: '0.55rem' }}>
            {cancelText}
          </button>
          <button className="group-btn-primary" onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '0.55rem', backgroundColor: 'var(--accent-danger, #ef4444)', borderColor: 'var(--accent-danger, #ef4444)' }}>
            {loading ? <Loader2 size={15} className="spin" style={{ marginRight: 6 }} /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Group Info Panel ───────────────────────────────────────── */
function GroupInfoPanel({ group, members, session, onInvite, onClose, onGroupUpdated, me, onMentionInsert, panelTab, setPanelTab }: {
  group: Group;
  members: GroupMember[];
  session: Session;
  onInvite: () => void;
  onClose: () => void;
  onGroupUpdated: () => void;
  me: string | undefined;
  onMentionInsert?: (username: string) => void;
  panelTab: 'about' | 'members' | 'requests';
  setPanelTab: React.Dispatch<React.SetStateAction<'about' | 'members' | 'requests'>>;
}) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const myRole = members.find(m => m.user_id === me)?.role || 'member';
  const roleRank: Record<string, number> = { owner: 4, admin: 3, moderator: 2, member: 1 };

  // Kick state
  const [kickingMember, setKickingMember] = useState<GroupMember | null>(null);
  const [kickingLoading, setKickingLoading] = useState(false);

  // Transfer ownership state
  const [transferTarget, setTransferTarget] = useState<GroupMember | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);

  // Member action menu open per user_id
  const [openMemberMenu, setOpenMemberMenu] = useState<string | null>(null);

  // Mute sub-menu
  const [muteTarget, setMuteTarget] = useState<GroupMember | null>(null);
  const [muteLoading, setMuteLoading] = useState(false);

  const confirmKick = async () => {
    if (!kickingMember) return;
    setKickingLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ userId: kickingMember.user_id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success('Member removed');
      onGroupUpdated();
      setKickingMember(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    } finally {
      setKickingLoading(false);
    }
  };

  const confirmTransfer = async () => {
    if (!transferTarget) return;
    setTransferLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ action: 'set_role', userId: transferTarget.user_id, role: 'owner' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Ownership transferred to ${displayName(transferTarget.profile)}`);
      onGroupUpdated();
      setTransferTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to transfer ownership');
    } finally {
      setTransferLoading(false);
    }
  };

  const setRole = async (member: GroupMember, role: 'admin' | 'moderator' | 'member') => {
    setOpenMemberMenu(null);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ action: 'set_role', userId: member.user_id, role }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Role updated to ${role}`);
      onGroupUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const muteFor = async (member: GroupMember, minutes: number) => {
    setMuteTarget(null);
    setMuteLoading(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ action: 'mute', userId: member.user_id, duration_minutes: minutes || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(minutes === 0 ? 'Member unmuted' : `Muted for ${MUTE_OPTIONS.find(o => o.minutes === minutes)?.label}`);
      onGroupUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mute member');
    } finally {
      setMuteLoading(false);
    }
  };

  const canManage = (member: GroupMember) => {
    if (member.user_id === me) return false;
    if (myRole === 'owner') return true;
    if (myRole === 'admin' && !['owner', 'admin'].includes(member.role)) return true;
    return false;
  };

  return (
    <>
      <ConfirmDialog
        isOpen={!!kickingMember}
        title="Remove Member"
        message={`Are you sure you want to remove ${displayName(kickingMember?.profile)} from the group?`}
        confirmText="Remove"
        onConfirm={confirmKick}
        onCancel={() => setKickingMember(null)}
        loading={kickingLoading}
      />

      <ConfirmDialog
        isOpen={!!transferTarget}
        title="Transfer Ownership"
        message={`Transfer ownership of "${group.name}" to ${displayName(transferTarget?.profile)}? You will become an admin.`}
        confirmText="Transfer"
        onConfirm={confirmTransfer}
        onCancel={() => setTransferTarget(null)}
        loading={transferLoading}
      />

      {/* Mute duration sub-modal */}
      {muteTarget && (
        <div className="group-modal-overlay" style={{ zIndex: 3100 }} onClick={e => e.target === e.currentTarget && setMuteTarget(null)}>
          <div className="group-modal" style={{ maxWidth: 340, width: '90%' }}>
            <button className="group-modal-close" onClick={() => setMuteTarget(null)}><X size={18} /></button>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              <VolumeX size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Mute {displayName(muteTarget.profile)}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {MUTE_OPTIONS.map(opt => (
                <button key={opt.minutes} className="group-btn-secondary" style={{ justifyContent: 'flex-start', padding: '0.6rem 0.8rem' }}
                  disabled={muteLoading}
                  onClick={() => muteFor(muteTarget, opt.minutes)}>
                  <Clock size={14} style={{ marginRight: 8 }} />{opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="group-info-panel-backdrop" onClick={onClose} />
      <div className="group-info-panel mobile-open" onClick={() => setOpenMemberMenu(null)}>
        <div className="group-panel-header">
          <h3>Group Info</h3>
          <button className="group-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="group-panel-tabs">
          <button className={panelTab === 'members' ? 'active' : ''} onClick={() => setPanelTab('members')}>
            <Users size={13} style={{ marginRight: 4 }} /> Members ({group.member_count})
          </button>
          <button className={panelTab === 'about' ? 'active' : ''} onClick={() => setPanelTab('about')}>
            <Info size={13} style={{ marginRight: 4 }} /> About
          </button>
          {['owner', 'admin'].includes(myRole) && (
            <button className={panelTab === 'requests' ? 'active' : ''} onClick={() => setPanelTab('requests')}>
              <UserPlus size={13} style={{ marginRight: 4 }} /> Requests
            </button>
          )}
        </div>
        <div className="group-info-panel-scroll">
          {panelTab === 'about' && (
            <>
              <div style={{ background: group.banner_url ? undefined : 'linear-gradient(135deg,#1e1b4b,#4338ca)', height: 90 }}>
                {group.banner_url && <img src={group.banner_url} alt="" className="group-banner" />}
              </div>
              <div className="group-panel-identity">
                <GroupAvatar name={group.name} avatarUrl={group.avatar_url} size={52} radius={14} />
                <h3 className="group-panel-name">{group.name}</h3>
                {group.description && <p className="group-panel-desc">{group.description}</p>}
                <div className="group-panel-meta">
                  {group.category && <span className="group-panel-chip"><Hash size={11} />{group.category}</span>}
                  <span className="group-panel-chip"><Users size={11} />{group.member_count} members</span>
                  <span className="group-panel-chip">{group.privacy === 'private' ? '🔒' : '🌐'} {group.privacy}</span>
                </div>
                {['owner', 'admin'].includes(myRole) && (
                  <button className="group-btn-secondary" style={{ marginTop: '0.5rem', padding: '0.5rem' }}
                    onClick={() => setShowSettings(true)}>
                    <Settings size={14} style={{ marginRight: 4 }} />Edit Group Settings
                  </button>
                )}
              </div>
            </>
          )}
          {panelTab === 'members' && (
            <>
              {['owner', 'admin'].includes(myRole) && (
                <div style={{ padding: '0.75rem 1rem' }}>
                  <button className="group-btn-secondary" style={{ padding: '0.5rem' }} onClick={onInvite}>
                    <UserPlus size={14} style={{ marginRight: 4 }} />Invite Members
                  </button>
                </div>
              )}
              <div className="group-panel-members">
                {members.map(member => (
                  <div key={member.user_id} className="group-panel-member-row" style={{ position: 'relative' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0, cursor: member.profile?.username ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (member.profile?.username) {
                          router.push(`/user/${member.profile.username}`);
                          onClose();
                        }
                      }}
                    >
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <MemberAvatar profile={member.profile} size={34} />
                        {member.is_online && <span className="group-online-dot" />}
                      </div>
                      <div className="group-panel-member-info">
                        <div className="group-panel-member-name">
                          {displayName(member.profile)}
                          {member.muted_until && new Date(member.muted_until) > new Date() && (
                            <VolumeX size={11} style={{ marginLeft: 4, color: 'var(--text-muted)', verticalAlign: 'middle' }} />
                          )}
                        </div>
                        <div className="group-panel-member-role">
                          <RoleBadge role={member.role} />
                          {member.profile?.username && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>@{member.profile.username}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Member action menu button — shown for all non-self members if I can manage, else for self */}
                    <div style={{ position: 'relative', marginLeft: 'auto' }}>
                      <button
                        className="group-icon-btn"
                        title="Member options"
                        onClick={e => { e.stopPropagation(); setOpenMemberMenu(prev => prev === member.user_id ? null : member.user_id); }}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {openMemberMenu === member.user_id && (
                        <div className="group-member-dropdown" onClick={e => e.stopPropagation()}>
                          {/* View Profile */}
                          {member.profile?.username && (
                            <button className="group-member-menu-item" onClick={() => { router.push(`/user/${member.profile!.username}`); setOpenMemberMenu(null); onClose(); }}>
                              <User size={13} />View Profile
                            </button>
                          )}
                          {/* Mention */}
                          {member.profile?.username && member.user_id !== me && (
                            <button className="group-member-menu-item" onClick={() => { onMentionInsert?.(`@${member.profile!.username} `); setOpenMemberMenu(null); onClose(); }}>
                              <Hash size={13} />Mention
                            </button>
                          )}
                          {/* Copy username */}
                          {member.profile?.username && (
                            <button className="group-member-menu-item" onClick={() => { navigator.clipboard.writeText(`@${member.profile!.username}`); toast.success('Copied!'); setOpenMemberMenu(null); }}>
                              <Copy size={13} />Copy @username
                            </button>
                          )}

                          {canManage(member) && <div className="group-member-menu-divider" />}

                          {/* Role management — owner can promote to admin */}
                          {myRole === 'owner' && member.role !== 'owner' && (
                            <>
                              {member.role !== 'admin' && (
                                <button className="group-member-menu-item" onClick={() => setRole(member, 'admin')}>
                                  <ShieldCheck size={13} style={{ color: '#6366f1' }} />Promote to Admin
                                </button>
                              )}
                              {member.role === 'admin' && (
                                <button className="group-member-menu-item" onClick={() => setRole(member, 'moderator')}>
                                  <ShieldOff size={13} />Demote to Mod
                                </button>
                              )}
                              {member.role === 'moderator' && (
                                <button className="group-member-menu-item" onClick={() => setRole(member, 'member')}>
                                  <ShieldOff size={13} />Demote to Member
                                </button>
                              )}
                            </>
                          )}
                          {/* Admin can promote member to mod, demote mod to member */}
                          {myRole === 'admin' && !['owner', 'admin'].includes(member.role) && (
                            <>
                              {member.role !== 'moderator' && (
                                <button className="group-member-menu-item" onClick={() => setRole(member, 'moderator')}>
                                  <ShieldCheck size={13} style={{ color: '#6366f1' }} />Promote to Mod
                                </button>
                              )}
                              {member.role === 'moderator' && (
                                <button className="group-member-menu-item" onClick={() => setRole(member, 'member')}>
                                  <ShieldOff size={13} />Demote to Member
                                </button>
                              )}
                            </>
                          )}

                          {/* Transfer ownership — owner only */}
                          {myRole === 'owner' && member.role !== 'owner' && (
                            <button className="group-member-menu-item" onClick={() => { setTransferTarget(member); setOpenMemberMenu(null); }}>
                              <Crown size={13} style={{ color: '#f59e0b' }} />Transfer Ownership
                            </button>
                          )}

                          {/* Mute */}
                          {canManage(member) && (roleRank[myRole] || 0) >= 2 && (
                            <button className="group-member-menu-item" onClick={() => { setMuteTarget(member); setOpenMemberMenu(null); }}>
                              <VolumeX size={13} />
                              {member.muted_until && new Date(member.muted_until) > new Date() ? 'Unmute / Remute' : 'Mute'}
                            </button>
                          )}

                          {/* Remove */}
                          {canManage(member) && (
                            <>
                              <div className="group-member-menu-divider" />
                              <button className="group-member-menu-item danger" onClick={() => { setKickingMember(member); setOpenMemberMenu(null); }}>
                                <X size={13} />Remove from Group
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {panelTab === 'requests' && ['owner', 'admin'].includes(myRole) && (
            <JoinRequestsPanel group={group} session={session} onGroupUpdated={onGroupUpdated} />
          )}
        </div>
      </div>
      {showSettings && (
        <GroupSettingsModal group={group} session={session} onClose={() => setShowSettings(false)} onUpdated={onGroupUpdated} />
      )}
    </>
  );
}

/* ── Join Requests Panel ────────────────────────────────────── */
interface JoinRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profile: Profile | null;
}

function JoinRequestsPanel({ group, session, onGroupUpdated }: {
  group: Group; session: Session; onGroupUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery<JoinRequest[]>({
    queryKey: ['groups', 'join-requests', group.id],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${group.id}/join-requests`, {
        headers: await authHeaders(session),
      });
      if (!res.ok) return [];
      return (await res.json()).requests || [];
    },
    enabled: !!session?.access_token,
    staleTime: 15_000,
  });

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setActingOn(requestId);
    try {
      const res = await fetch(`/api/groups/${group.id}/join-requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(action === 'approve' ? 'Request approved! User added to group.' : 'Request rejected.');
      queryClient.invalidateQueries({ queryKey: ['groups', 'join-requests', group.id] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'members', group.id] });
      onGroupUpdated();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} request`);
    } finally {
      setActingOn(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Loader2 size={20} className="spin" />
      </div>
    );
  }

  const pending = (requests || []).filter(r => r.status === 'pending');

  if (pending.length === 0) {
    return (
      <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
        <UserPlus size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block', margin: '0 auto 0.75rem auto' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No pending join requests</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0.75rem' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0.25rem' }}>
        {pending.length} pending request{pending.length > 1 ? 's' : ''}
      </p>
      {pending.map(req => (
        <div key={req.id} style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '0.875rem',
          marginBottom: '0.625rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
            <div style={{ position: 'relative', flexShrink: 0, cursor: req.profile?.username ? 'pointer' : 'default' }}
              onClick={() => req.profile?.username && router.push(`/user/${req.profile!.username}`)}>
              <MemberAvatar profile={req.profile} size={34} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', cursor: req.profile?.username ? 'pointer' : 'default' }}
                onClick={() => req.profile?.username && router.push(`/user/${req.profile!.username}`)}>
                {displayName(req.profile)}
              </div>
              {req.profile?.username && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{req.profile.username}</div>
              )}
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Requested {new Date(req.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="group-btn-primary" style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}
              disabled={actingOn === req.id} onClick={() => handleAction(req.id, 'approve')}>
              {actingOn === req.id ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
              Approve
            </button>
            <button className="group-btn-secondary" style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem', color: 'var(--accent-danger, #ef4444)' }}
              disabled={actingOn === req.id} onClick={() => handleAction(req.id, 'reject')}>
              <X size={13} />
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Pending Invite Card ────────────────────────────────────── */
function PendingInviteCard({ invite, session, onRespond }: {
  invite: {
    id: string;
    group_id: string;
    group_name?: string;
    invited_by_profile?: Profile | null;
  };
  session: Session;
  onRespond: () => void;
}) {
  const [loading, setLoading] = useState<'accepted' | 'declined' | null>(null);

  const respond = async (status: 'accepted' | 'declined') => {
    setLoading(status);
    try {
      const res = await fetch(`/api/groups/${invite.group_id}/invites`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ inviteId: invite.id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(status === 'accepted' ? `Joined "${invite.group_name}"!` : 'Invitation declined.');
      onRespond();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Failed to respond to invitation');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--accent-primary, #6366f1)',
      borderRadius: 10,
      padding: '0.75rem',
      marginBottom: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Mail size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)' }}>
            Invitation to join <strong>{invite.group_name}</strong>
          </div>
          {invite.invited_by_profile && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              from {displayName(invite.invited_by_profile)}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button
          className="group-btn-primary"
          style={{ flex: 1, padding: '0.35rem', fontSize: '0.78rem' }}
          disabled={!!loading}
          onClick={() => respond('accepted')}
        >
          {loading === 'accepted' ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
          Accept
        </button>
        <button
          className="group-btn-secondary"
          style={{ flex: 1, padding: '0.35rem', fontSize: '0.78rem' }}
          disabled={!!loading}
          onClick={() => respond('declined')}
        >
          {loading === 'declined' ? <Loader2 size={12} className="spin" /> : <X size={12} />}
          Decline
        </button>
      </div>
    </div>
  );
}

/* ── Forward Modal ──────────────────────────────────────────── */
function ForwardModal({ message, session, me, onClose }: {
  message: GroupMessage | null;
  session: Session;
  me: string | undefined;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const { data: conversations } = useQuery<Conversation[]>({
    queryKey: ['messaging', 'conversations', 'forward'],
    queryFn: async () => {
      const res = await fetch('/api/messages', { headers: await authHeaders(session) });
      const data = await res.json();
      return data.conversations || [];
    },
    enabled: !!session?.access_token,
    staleTime: 30_000,
  });

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups', 'list', 'forward'],
    queryFn: async () => {
      const res = await fetch('/api/groups', { headers: await authHeaders(session) });
      return (await res.json()).groups || [];
    },
    enabled: !!session?.access_token,
    staleTime: 30_000,
  });

  const term = search.toLowerCase();
  const filteredConvos = (conversations || []).filter(c =>
    displayName(c.partner).toLowerCase().includes(term) || c.partner?.username?.toLowerCase().includes(term)
  );
  const filteredGroups = (groups || []).filter(g => g.name.toLowerCase().includes(term));

  const forwardToConvo = async (convoId: string, partnerId: string) => {
    if (!message) return;
    setSending(convoId);
    try {
      const forwardedContent = `${message.forwarded_from ? `↩ Forwarded from ${message.forwarded_from}\n` : '↩ Forwarded\n'}${message.content}`;
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ conversationId: convoId, recipientId: partnerId, body: forwardedContent, attachments: message.attachments || [] }),
      });
      setSent(prev => new Set(prev).add(convoId));
    } catch { toast.error('Failed to forward'); }
    finally { setSending(null); }
  };

  const forwardToGroup = async (groupId: string, groupName: string) => {
    if (!message) return;
    setSending(groupId);
    try {
      const forwardedContent = `↩ Forwarded from ${message.forwarded_from || displayName(message.sender)}\n${message.content}`;
      await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ content: forwardedContent, attachments: message.attachments || [], mentions: [] }),
      });
      setSent(prev => new Set(prev).add(groupId));
    } catch { toast.error('Failed to forward'); }
    finally { setSending(null); }
  };

  if (!message) return null;
  return (
    <div className="group-modal-overlay" style={{ zIndex: 3000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="group-modal" style={{ maxWidth: 440, width: '92%' }}>
        <button className="group-modal-close" onClick={onClose}><X size={18} /></button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Forward size={18} />Forward Message</h2>
        <div className="group-forward-preview">
          <Reply size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {message.content || 'Attachment'}
          </span>
        </div>
        <div className="group-form-field" style={{ marginBottom: '0.75rem' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people or groups…" autoFocus />
        </div>
        <div className="group-forward-list">
          {filteredGroups.map(g => (
            <button key={g.id} className="group-forward-item" disabled={!!sending || sent.has(g.id)} onClick={() => forwardToGroup(g.id, g.name)}>
              <GroupAvatar name={g.name} avatarUrl={g.avatar_url} size={36} radius={10} />
              <span style={{ flex: 1, textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: '0.9rem' }}>{g.name}</strong>
                <small style={{ color: 'var(--text-muted)' }}>{g.member_count} members</small>
              </span>
              {sending === g.id ? <Loader2 size={16} className="spin" /> : sent.has(g.id) ? <CheckCheck size={16} style={{ color: '#22c55e' }} /> : <Forward size={14} />}
            </button>
          ))}
          {filteredConvos.map(c => (
            <button key={c.id} className="group-forward-item" disabled={!!sending || sent.has(c.id)} onClick={() => forwardToConvo(c.id, c.partner.id)}>
              <Avatar profile={c.partner} size={36} />
              <span style={{ flex: 1, textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: '0.9rem' }}>{displayName(c.partner)}</strong>
                <small style={{ color: 'var(--text-muted)' }}>@{c.partner.username}</small>
              </span>
              {sending === c.id ? <Loader2 size={16} className="spin" /> : sent.has(c.id) ? <CheckCheck size={16} style={{ color: '#22c55e' }} /> : <Forward size={14} />}
            </button>
          ))}
          {filteredGroups.length === 0 && filteredConvos.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No results</p>
          )}
        </div>
        {sent.size > 0 && (
          <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
            <button className="group-btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Message Info Modal ─────────────────────────────────────── */
function MessageInfoModal({ message, members, me, onClose }: {
  message: GroupMessage;
  members: GroupMember[];
  me: string | undefined;
  onClose: () => void;
}) {
  const readByOthers = (message.reads || []).filter(r => r.user_id !== me);

  return (
    <div className="group-modal-overlay" style={{ zIndex: 3000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="group-modal" style={{ maxWidth: 440, width: '92%' }}>
        <button className="group-modal-close" onClick={onClose}><X size={18} /></button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Info size={18} />Message Info</h2>

        {/* Message preview */}
        <div className="group-forward-preview" style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden' }}>
            {message.deleted_at ? <em>This message was deleted</em> : message.content || 'Attachment'}
          </span>
        </div>

        {/* Timestamps */}
        <div className="group-msg-info-timeline">
          <div className="group-msg-info-row">
            <Send size={14} style={{ color: 'var(--text-muted)' }} />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sent</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {new Date(message.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          </div>
          {message.edited_at && (
            <div className="group-msg-info-row">
              <Edit3 size={14} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Edited</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {new Date(message.edited_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Read receipts */}
        {readByOthers.length > 0 ? (
          <>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              Seen by {readByOthers.length}
            </div>
            <div className="group-msg-info-readers">
              {readByOthers.map(r => {
                const m = members.find(mb => mb.user_id === r.user_id);
                return (
                  <div key={r.user_id} className="group-msg-info-reader-row">
                    <MemberAvatar profile={m?.profile || null} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.87rem', fontWeight: 600 }}>{displayName(m?.profile)}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>@{m?.profile?.username}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                      <CheckCheck size={12} style={{ color: '#6366f1' }} />
                      {new Date(r.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem 0' }}>Not yet seen by others</p>
        )}

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.75rem 0 0.5rem' }}>
              Reactions
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {message.reactions.map(r => {
                const names = r.users.map(uid => {
                  const m = members.find(mb => mb.user_id === uid);
                  return displayName(m?.profile);
                }).join(', ');
                return (
                  <div key={r.emoji} className="group-reaction-badge active" title={names} style={{ cursor: 'default' }}>
                    <span>{r.emoji}</span>
                    <span className="react-count">{r.users.length}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const ImageIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
);

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
  const [enlargedAvatarUrl, setEnlargedAvatarUrl] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(searchParams.get('conversationId'));
  const [tempActiveConversation, setTempActiveConversation] = useState<Conversation | null>(() => {
    const conversationId = searchParams?.get('conversationId');
    const partnerId = searchParams?.get('partnerId');
    const partnerName = searchParams?.get('partnerName');
    const partnerAvatar = searchParams?.get('partnerAvatar');
    const partnerUsername = searchParams?.get('partnerUsername');

    if (conversationId && partnerId) {
      return {
        id: conversationId,
        partner: {
          id: partnerId,
          username: partnerUsername || null,
          full_name: partnerName || null,
          avatar_url: partnerAvatar || null,
          is_online: false,
          last_seen_at: null,
        },
        last_message: null,
        unread_count: 0,
        pinned: false,
        archived: false,
        muted: false,
        blocked: false,
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  });
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
  const [conversationView, setConversationView] = useState<'active' | 'groups' | 'archived'>('active');
  const [activeReactionMenu, setActiveReactionMenu] = useState<string | null>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, { emoji: string; users: string[] }[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('paoblem_chat_reactions');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return {};
  });

  /* ── Group States ─────────────────────────────────────────── */
  const [activeGroupId, setActiveGroupId] = useState<string | null>(searchParams.get('groupId'));
  const [groupSearch, setGroupSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [panelTab, setPanelTab] = useState<'about' | 'members' | 'requests'>('members');
  const [replyToGroup, setReplyToGroup] = useState<GroupMessage | null>(null);
  const [editingGroupMessage, setEditingGroupMessage] = useState<GroupMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [typingUsersGroup, setTypingUsersGroup] = useState<Record<string, string[]>>({});

  // New group UX states
  const [groupContextMenu, setGroupContextMenu] = useState<ContextMenuState>(null);
  const [forwardMessage, setForwardMessage] = useState<GroupMessage | null>(null);
  const [messageInfoMsg, setMessageInfoMsg] = useState<GroupMessage | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [groupDeleteScope, setGroupDeleteScope] = useState<{ messageId: string } | null>(null);
  const [dmDeleteScope, setDmDeleteScope] = useState<{ messageId: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupDraftRef = useRef<HTMLTextAreaElement | null>(null);
  const dmDraftRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    localStorage.setItem('paoblem_chat_reactions', JSON.stringify(messageReactions));
  }, [messageReactions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveReactionMenu(null);
        setActiveMessageMenu(null);
        setGroupContextMenu(null);
        setGroupDeleteScope(null);
        setDmDeleteScope(null);
      }
    };
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.group-reaction-picker') && 
        !target.closest('.chat-icon-btn') && 
        !target.closest('.group-context-menu') &&
        !target.closest('.group-member-dropdown') &&
        !target.closest('.chat-floating-menu')
      ) {
        setActiveReactionMenu(null);
        setActiveMessageMenu(null);
        setGroupContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

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

  // Handle direct actions from email invitation link (accept/decline)
  useEffect(() => {
    const inviteId = searchParams.get('invite');
    const groupId = searchParams.get('group');
    const action = searchParams.get('action');

    if (inviteId && groupId && action && session?.access_token) {
      const status = action === 'accept' ? 'accepted' : 'declined';
      toast.promise(
        fetch(`/api/groups/${groupId}/invites`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ inviteId, status }),
        }).then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to process invitation');
          queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
          queryClient.invalidateQueries({ queryKey: ['groups', 'my-invites'] });
          if (status === 'accepted') {
            setActiveGroupId(groupId);
            setConversationView('groups');
          }
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }),
        {
          loading: 'Processing invitation...',
          success: status === 'accepted' ? 'Successfully joined the group!' : 'Declined invitation.',
          error: (err) => err.message || 'Failed to process invitation',
        }
      );
    }
  }, [searchParams, session, queryClient]);

  const conversationsQuery = useQuery<Conversation[]>({
    queryKey: ['messaging', 'conversations', conversationView, session?.access_token],
    queryFn: async () => {
      const url = new URL('/api/messages', window.location.origin);
      if (conversationView === 'archived') url.searchParams.set('archived', 'true');
      const res = await fetch(url, { headers: await authHeaders(session), cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not load conversations');
      const data = await res.json();
      return data.conversations || [];
    },
    enabled: !!session?.access_token && conversationView !== 'groups',
    staleTime: 20_000,
  });

  const groupsQuery = useQuery<Group[]>({
    queryKey: ['groups', 'list', session?.access_token],
    queryFn: async () => {
      const res = await fetch('/api/groups', { headers: await authHeaders(session), cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load groups');
      return (await res.json()).groups || [];
    },
    enabled: !!session?.access_token,
    staleTime: 20_000,
  });

  // Fetch pending group invitations for the current user
  const myPendingInvitesQuery = useQuery<Array<{
    id: string; group_id: string; invited_by: string; expires_at: string | null;
    group_name?: string;
    invited_by_profile?: Profile | null;
  }>>({
    queryKey: ['groups', 'my-invites', session?.access_token],
    queryFn: async () => {
      if (!me) return [];
      // Fetch all groups to find invites — we query the invites table via a groups-level check
      // Use a direct Supabase client call for the current user's invites
      const { data, error } = await supabase
        .from('group_invites')
        .select('id, group_id, invited_by, expires_at, status')
        .eq('invited_user_id', me)
        .eq('status', 'pending');
      if (error) return [];
      // Hydrate group names and inviter profiles
      const groupIds = [...new Set((data || []).map((i: any) => i.group_id))];
      const inviterIds = [...new Set((data || []).map((i: any) => i.invited_by))];
      const [{ data: groups }, { data: profiles }] = await Promise.all([
        groupIds.length ? supabase.from('groups').select('id, name').in('id', groupIds) : { data: [] },
        inviterIds.length ? supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', inviterIds) : { data: [] },
      ]);
      const groupMap = new Map((groups || []).map((g: any) => [g.id, g.name]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return (data || []).map((inv: any) => ({
        ...inv,
        group_name: groupMap.get(inv.group_id) || 'Unknown Group',
        invited_by_profile: profileMap.get(inv.invited_by) || null,
      }));
    },
    enabled: !!session?.access_token && !!me,
    staleTime: 30_000,
  });

  const myPendingInvites = myPendingInvitesQuery.data || [];

  const groupMessagesQuery = useQuery<{ messages: GroupMessage[]; nextCursor: string | null }>({
    queryKey: ['groups', 'messages', activeGroupId, messageSearch, session?.access_token],
    queryFn: async () => {
      if (!activeGroupId) return { messages: [], nextCursor: null };
      const url = new URL(`/api/groups/${activeGroupId}/messages`, window.location.origin);
      if (messageSearch.trim()) url.searchParams.set('search', messageSearch.trim());
      const res = await fetch(url, { headers: await authHeaders(session), cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load messages');
      return res.json();
    },
    enabled: !!session?.access_token && !!activeGroupId,
    staleTime: 10_000,
  });

  const groupMembersQuery = useQuery<GroupMember[]>({
    queryKey: ['groups', 'members', activeGroupId, session?.access_token],
    queryFn: async () => {
      if (!activeGroupId) return [];
      const res = await fetch(`/api/groups/${activeGroupId}/members`, { headers: await authHeaders(session), cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load members');
      return (await res.json()).members || [];
    },
    enabled: !!session?.access_token && !!activeGroupId,
    staleTime: 30_000,
  });

  // Fetch the active group directly so the panel always works, even if groupsQuery is loading
  const activeGroupDetailQuery = useQuery<Group | null>({
    queryKey: ['groups', 'detail', activeGroupId, session?.access_token],
    queryFn: async () => {
      if (!activeGroupId) return null;
      const res = await fetch(`/api/groups/${activeGroupId}`, { headers: await authHeaders(session), cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.group || null;
    },
    enabled: !!session?.access_token && !!activeGroupId,
    staleTime: 20_000,
  });

  // activeGroup: prefer the full list entry (has unread counts etc.), fall back to the dedicated fetch
  const activeGroup = useMemo(() => {
    return groupsQuery.data?.find(g => g.id === activeGroupId) || activeGroupDetailQuery.data || null;
  }, [groupsQuery.data, activeGroupDetailQuery.data, activeGroupId]);
  const groupMessages = useMemo(() => {
    const raw = groupMessagesQuery.data?.messages || [];
    if (!me || typeof window === 'undefined') return raw;
    const key = `paoblem_deleted_group_messages:${me}`;
    const stored = localStorage.getItem(key);
    if (!stored) return raw;
    try {
      const deletedSet = new Set<string>(JSON.parse(stored));
      return raw.filter((msg) => !deletedSet.has(msg.id));
    } catch {
      return raw;
    }
  }, [groupMessagesQuery.data?.messages, me]);
  const members = groupMembersQuery.data || [];
  const myRole = members.find(m => m.user_id === me)?.role || 'member';

  const displayedGroups = useMemo(() => {
    const term = groupSearch.trim().toLowerCase();
    return (groupsQuery.data || []).filter(g =>
      !term || g.name.toLowerCase().includes(term)
    );
  }, [groupsQuery.data, groupSearch]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionSearch) return [];
    return members.filter(m =>
      m.user_id !== me &&
      (m.profile?.username?.toLowerCase().includes(mentionSearch) ||
        displayName(m.profile).toLowerCase().includes(mentionSearch))
    ).slice(0, 6);
  }, [mentionSearch, members, me]);

  const typingInGroup = activeGroupId ? (typingUsersGroup[activeGroupId] || []) : [];

  const messagesQuery = useQuery<MessagesQueryData>({
    queryKey: ['messaging', 'messages', activeConversationId, messageSearch, session?.access_token],
    queryFn: async () => {
      if (!activeConversationId) return { messages: [], nextCursor: null };
      const url = new URL('/api/messages', window.location.origin);
      url.searchParams.set('conversationId', activeConversationId);
      if (messageSearch.trim()) url.searchParams.set('search', messageSearch.trim());
      const res = await fetch(url, { headers: await authHeaders(session), cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not load messages');
      return res.json();
    },
    enabled: !!session?.access_token && !!activeConversationId,
    staleTime: 10_000,
  });

  const activeConversation = conversationsQuery.data?.find((item) => item.id === activeConversationId) || (activeConversationId && tempActiveConversation && tempActiveConversation.id === activeConversationId ? tempActiveConversation : null);
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
    queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
    if (conversationId) {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'messages', conversationId] });
    } else if (activeConversationId) {
      queryClient.invalidateQueries({ queryKey: ['messaging', 'messages', activeConversationId] });
    }
  }, [activeConversationId, queryClient]);

  const upsertMessageInCache = useCallback((incoming: Partial<ChatMessage> & { id: string; conversation_id: string }) => {
    queryClient.setQueriesData<{ messages: ChatMessage[]; nextCursor: string | null }>(
      { queryKey: ['messaging', 'messages', incoming.conversation_id] },
      (current) => {
        if (!current?.messages) return current;
        const existing = current.messages.find(m => m.id === incoming.id);
        const normalized = {
          ...(existing || {}),
          ...incoming,
          attachments: incoming.deleted_at ? [] : (incoming.attachments || existing?.attachments || []),
          content: incoming.deleted_at ? 'This message was deleted' : (incoming.content || existing?.content || ''),
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

  /* ── Group Realtime & Effects ─────────────────────────────── */
  const invalidateGroupMessages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['groups', 'messages', activeGroupId] });
    queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
  }, [activeGroupId, queryClient]);

  const upsertGroupMessageInCache = useCallback((incoming: Partial<GroupMessage> & { id: string; group_id: string }) => {
    queryClient.setQueriesData<{ messages: GroupMessage[]; nextCursor: string | null }>(
      { queryKey: ['groups', 'messages', incoming.group_id] },
      (current) => {
        if (!current?.messages) return current;
        const existing = current.messages.find(m => m.id === incoming.id);
        const normalized = {
          ...(existing || {}),
          ...incoming,
          attachments: incoming.deleted_at ? [] : (incoming.attachments || existing?.attachments || []),
          content: incoming.deleted_at ? 'This message was deleted' : (incoming.content || existing?.content || ''),
          reactions: incoming.deleted_at ? [] : (incoming.reactions || existing?.reactions || []),
          reads: incoming.reads || existing?.reads || [],
          mentions: incoming.mentions || existing?.mentions || [],
        } as GroupMessage;
        const without = current.messages.filter(m =>
          m.id !== incoming.id &&
          (!incoming.client_mutation_id || m.client_mutation_id !== incoming.client_mutation_id)
        );
        return {
          ...current,
          messages: [...without, normalized].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
        };
      }
    );
  }, [queryClient]);

  useEffect(() => {
    if (!me || !activeGroupId) return;

    const channel = supabase
      .channel(`group:${activeGroupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${activeGroupId}` }, (payload) => {
        const row = (payload.new || payload.old) as Partial<GroupMessage> & { id?: string; group_id?: string };
        if (!row?.group_id || !row.id) return;
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          upsertGroupMessageInCache(row as Partial<GroupMessage> & { id: string; group_id: string });
        }
        invalidateGroupMessages();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_message_reactions' }, () => invalidateGroupMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${activeGroupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['groups', 'members', activeGroupId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_join_requests', filter: `group_id=eq.${activeGroupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['groups', 'join-requests', activeGroupId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_invites' }, () => {
        queryClient.invalidateQueries({ queryKey: ['groups', 'my-invites'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [me, activeGroupId, invalidateGroupMessages, upsertGroupMessageInCache, queryClient]);

  useEffect(() => {
    if (!me || !activeGroupId) return;

    const channel = supabase
      .channel(`group-broadcast:${activeGroupId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const gid = String(payload?.groupId || '');
        const uid = String(payload?.userId || '');
        const name = String(payload?.userName || 'Someone');
        const isTyping = Boolean(payload?.isTyping);
        if (!gid || uid === me) return;
        setTypingUsersGroup(prev => {
          const current = prev[gid] || [];
          if (isTyping && !current.includes(name)) return { ...prev, [gid]: [...current, name] };
          if (!isTyping) return { ...prev, [gid]: current.filter(n => n !== name) };
          return prev;
        });
        if (isTyping) {
          setTimeout(() => {
            setTypingUsersGroup(prev => ({ ...prev, [gid]: (prev[gid] || []).filter(n => n !== name) }));
          }, 3_500);
        }
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const { messageId, emoji, userId } = payload || {};
        if (!messageId || !emoji || !userId) return;

        const queryKey = ['groups', 'messages', activeGroupId, messageSearch, session?.access_token];
        queryClient.setQueryData<{ messages: GroupMessage[]; nextCursor: string | null }>(
          queryKey,
          (curr) => {
            if (!curr) return curr;
            const updated = curr.messages.map((msg) => {
              if (msg.id !== messageId) return msg;

              // Step 1: Remove user from any previous reactions
              let reactions = (msg.reactions || [])
                .map(r => ({
                  ...r,
                  users: r.users.filter(uid => uid !== userId)
                }))
                .filter(r => r.users.length > 0);

              // Step 2: Toggle or set new reaction
              const existingReaction = reactions.find(r => r.emoji === emoji);
              if (existingReaction) {
                const hasUser = existingReaction.users.includes(userId);
                if (!hasUser) {
                  reactions = reactions.map(r => r.emoji === emoji ? { ...r, users: [...r.users, userId] } : r);
                } else {
                  reactions = reactions
                    .map(r => r.emoji === emoji ? { ...r, users: r.users.filter(uid => uid !== userId) } : r)
                    .filter(r => r.users.length > 0);
                }
              } else {
                reactions.push({ emoji, users: [userId] });
              }

              const my_reaction = userId === me ? (msg.my_reaction === emoji ? null : emoji) : msg.my_reaction;

              return { ...msg, reactions, my_reaction };
            });
            return { ...curr, messages: updated };
          }
        );
      })
      .on('broadcast', { event: 'delete_message' }, ({ payload }) => {
        const { messageId, userId } = payload || {};
        if (!messageId) return;

        const queryKey = ['groups', 'messages', activeGroupId, messageSearch, session?.access_token];
        queryClient.setQueryData<{ messages: GroupMessage[]; nextCursor: string | null }>(
          queryKey,
          (curr) => {
            if (!curr) return curr;
            const updated = curr.messages.map((msg) => {
              if (msg.id !== messageId) return msg;
              return {
                ...msg,
                content: '',
                attachments: [],
                deleted_at: new Date().toISOString(),
                deleted_by: userId,
                reactions: [], // Remove all reactions from the deleted message!
              };
            });
            return { ...curr, messages: updated };
          }
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [me, activeGroupId, queryClient, messageSearch, session?.access_token]);

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`groups-list:${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, queryClient]);

  useEffect(() => {
    if (!activeGroupId || !session?.access_token) return;
    fetch(`/api/groups/${activeGroupId}/messages`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'read' }),
    }).then(() => queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })).catch(() => {});
  }, [activeGroupId, session?.access_token, groupMessages.length, queryClient]);

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
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const { messageId, emoji, userId, isAdding, prevEmoji } = payload || {};
        if (!messageId || !emoji || !userId) return;
        setMessageReactions((prev) => {
          let currentList = [...(prev[messageId] || [])];

          // Step 1: Remove user from their previous reaction if swapping
          if (prevEmoji && prevEmoji !== emoji) {
            currentList = currentList
              .map((r) => r.emoji === prevEmoji ? { ...r, users: r.users.filter((u) => u !== userId) } : r)
              .filter((r) => r.users.length > 0);
          }

          // Step 2: Apply the new reaction
          const existing = currentList.find((r) => r.emoji === emoji);
          let newList;
          if (existing) {
            const hasUser = existing.users.includes(userId);
            let nextUsers = existing.users;
            if (isAdding && !hasUser) nextUsers = [...nextUsers, userId];
            else if (!isAdding && hasUser) nextUsers = nextUsers.filter((u) => u !== userId);
            if (nextUsers.length === 0) {
              newList = currentList.filter((r) => r.emoji !== emoji);
            } else {
              newList = currentList.map((r) => r.emoji === emoji ? { ...r, users: nextUsers } : r);
            }
          } else if (isAdding) {
            newList = [...currentList, { emoji, users: [userId] }];
          } else {
            newList = currentList;
          }
          return { ...prev, [messageId]: newList };
        });
      })
      .on('broadcast', { event: 'delete_message' }, ({ payload }) => {
        const { messageId, conversationId } = payload || {};
        if (!messageId || !conversationId) return;

        // Clear reactions in state
        setMessageReactions((prev) => {
          const copy = { ...prev };
          delete copy[messageId];
          return copy;
        });

        // Update messages query cache
        queryClient.setQueriesData<{ messages: ChatMessage[]; nextCursor: string | null }>(
          { queryKey: ['messaging', 'messages', conversationId] },
          (current) => {
            if (!current?.messages) return current;
            const updated = current.messages.map((msg) => {
              if (msg.id !== messageId) return msg;
              return {
                ...msg,
                content: 'This message was deleted',
                deleted_at: new Date().toISOString(),
                attachments: [],
              };
            });
            return { ...current, messages: updated };
          }
        );
      })
      .subscribe();
    typingChannelRef.current = channel;

    return () => {
      Object.values(typingExpiryRefs.current).forEach(clearTimeout);
      typingExpiryRefs.current = {};
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [me, queryClient]);

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
  }, [activeConversationId, messages.length, activeTyping, activeGroupId, groupMessages.length, typingInGroup.length]);

  const openConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setActiveGroupId(null);
    setMobileOpen(true);
    setMessageSearch('');
    setReplyTo(null);
    setEditingMessage(null);
    router.replace(`/chats?conversationId=${conversationId}`, { scroll: false });
  };

  const openGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    setActiveConversationId(null);
    setMobileOpen(true);
    setReplyToGroup(null);
    setEditingGroupMessage(null);
    setMessageSearch('');
    router.replace(`/chats?groupId=${groupId}`, { scroll: false });
  };

  const sendGroupMessageMutation = useMutation({
    mutationFn: async () => {
      if (!draft.trim() && !attachments.length) return null;
      if (!activeGroupId) return null;
      const clientMutationId = crypto.randomUUID();

      // Extract mentions
      const mentionMatches = draft.match(/@(\w+)/g) || [];
      const mentionedUsers = mentionMatches
        .map(m => members.find(mb => mb.profile?.username === m.slice(1)))
        .filter(Boolean)
        .map(m => m!.user_id);

      const optimistic: GroupMessage = {
        id: clientMutationId,
        group_id: activeGroupId,
        sender_id: me || '',
        content: draft,
        message_type: attachments.length
          ? (attachments.some(a => a.type === 'image') ? 'image' : 'file')
          : 'text',
        attachments,
        reply_to_message_id: replyToGroup?.id || null,
        reply_to: replyToGroup,
        mentions: mentionedUsers,
        pinned_at: null,
        edited_at: null,
        deleted_at: null,
        sender: { id: me || '', username: null, full_name: null, avatar_url: null },
        reactions: [],
        reads: [],
        client_mutation_id: clientMutationId,
        created_at: new Date().toISOString(),
        optimistic: true,
      };

      queryClient.setQueryData<{ messages: GroupMessage[]; nextCursor: string | null }>(
        ['groups', 'messages', activeGroupId, messageSearch, session?.access_token],
        (curr) => ({ messages: [...(curr?.messages || []), optimistic], nextCursor: curr?.nextCursor || null })
      );

      setDraft('');
      if (groupDraftRef.current) groupDraftRef.current.style.height = 'auto';
      setAttachments([]);
      setReplyToGroup(null);
      setShowMentionPopup(false);

      const res = await fetch(`/api/groups/${activeGroupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({
          content: optimistic.content,
          attachments,
          replyToMessageId: replyToGroup?.id,
          mentions: mentionedUsers,
          clientMutationId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to send');
      return res.json();
    },
    onSuccess: () => invalidateGroupMessages(),
    onError: (err: Error) => {
      toast.error(err.message);
      invalidateGroupMessages();
    },
  });

  const editGroupMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const res = await fetch(`/api/groups/${activeGroupId}/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ action: 'edit', messageId, content }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to edit');
      setDraft('');
      setEditingGroupMessage(null);
    },
    onSuccess: () => invalidateGroupMessages(),
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteGroupMessage = async (messageId: string, scope: 'me' | 'everyone' = 'everyone') => {
    if (!activeGroupId) return;

    if (scope === 'me') {
      if (!me) return;
      const key = `paoblem_deleted_group_messages:${me}`;
      const existing = localStorage.getItem(key);
      const list = existing ? JSON.parse(existing) : [];
      if (!list.includes(messageId)) {
        list.push(messageId);
        localStorage.setItem(key, JSON.stringify(list));
      }
      toast.success('Message deleted for you');

      // Optimistically update React Query cache in milliseconds
      const queryKey = ['groups', 'messages', activeGroupId, messageSearch, session?.access_token];
      queryClient.setQueryData<{ messages: GroupMessage[]; nextCursor: string | null }>(
        queryKey,
        (curr) => {
          if (!curr) return curr;
          return { ...curr, messages: curr.messages.filter(m => m.id !== messageId) };
        }
      );
      return;
    }

    // Optimistically update cache to mark message as deleted locally in milliseconds
    const queryKey = ['groups', 'messages', activeGroupId, messageSearch, session?.access_token];
    queryClient.setQueryData<{ messages: GroupMessage[]; nextCursor: string | null }>(
      queryKey,
      (curr) => {
        if (!curr) return curr;
        const updated = curr.messages.map((msg) => {
          if (msg.id !== messageId) return msg;
          return {
            ...msg,
            content: '',
            attachments: [],
            deleted_at: new Date().toISOString(),
            deleted_by: me || '',
            reactions: [], // Remove all reactions from the deleted message!
          };
        });
        return { ...curr, messages: updated };
      }
    );

    // Broadcast message deletion to other group members instantly
    supabase.channel(`group-broadcast:${activeGroupId}`).send({
      type: 'broadcast',
      event: 'delete_message',
      payload: { messageId, userId: me },
    }).catch(() => {});

    try {
      const res = await fetch(`/api/groups/${activeGroupId}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ messageId, scope }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      invalidateGroupMessages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete message');
      invalidateGroupMessages();
    }
  };

  const reactToGroupMessage = async (messageId: string, emoji: string) => {
    setActiveReactionMenu(null);
    if (!me || !activeGroupId) return;

    const queryKey = ['groups', 'messages', activeGroupId, messageSearch, session?.access_token];

    // Optimistically toggle reaction locally in milliseconds (strictly 1 reaction per user allowed)
    queryClient.setQueryData<{ messages: GroupMessage[]; nextCursor: string | null }>(
      queryKey,
      (curr) => {
        if (!curr) return curr;
        const updated = curr.messages.map((msg) => {
          if (msg.id !== messageId) return msg;

          // Step 1: Remove user from any previous reactions on this message
          let reactions = (msg.reactions || [])
            .map(r => ({
              ...r,
              users: r.users.filter(uid => uid !== me)
            }))
            .filter(r => r.users.length > 0);

          // Step 2: Toggle or set new reaction
          const existingReaction = reactions.find(r => r.emoji === emoji);
          if (existingReaction) {
            const hasUser = existingReaction.users.includes(me);
            if (!hasUser) {
              reactions = reactions.map(r => r.emoji === emoji ? { ...r, users: [...r.users, me] } : r);
            } else {
              reactions = reactions
                .map(r => r.emoji === emoji ? { ...r, users: r.users.filter(uid => uid !== me) } : r)
                .filter(r => r.users.length > 0);
            }
          } else {
            reactions.push({ emoji, users: [me] });
          }

          const my_reaction = msg.my_reaction === emoji ? null : emoji;

          return { ...msg, reactions, my_reaction };
        });
        return { ...curr, messages: updated };
      }
    );

    // Broadcast reaction change to other group members instantly
    supabase.channel(`group-broadcast:${activeGroupId}`).send({
      type: 'broadcast',
      event: 'reaction',
      payload: { messageId, emoji, userId: me },
    }).catch(() => {});

    try {
      const res = await fetch(`/api/groups/${activeGroupId}/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ action: 'react', messageId, emoji }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to react');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update reaction');
      invalidateGroupMessages();
    }
  };

  const leaveGroup = () => setShowLeaveDialog(true);

  const performLeaveGroup = async () => {
    setLeavingGroup(true);
    try {
      const res = await fetch(`/api/groups/${activeGroupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ userId: me }),
      });
      if (!res.ok) { toast.error((await res.json()).error); return; }
      toast.success('You left the group');
      setShowLeaveDialog(false);
      setActiveGroupId(null);
      setShowPanel(false);
      setMobileOpen(false);
      router.replace('/chats', { scroll: false });
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', activeGroupId] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave group');
    } finally {
      setLeavingGroup(false);
    }
  };

  const broadcastTypingGroup = (isTyping: boolean) => {
    if (!activeGroupId || !me) return;
    const now = Date.now();
    if (isTyping && now - typingLastSentRef.current < 450) return;
    typingLastSentRef.current = now;
    const myProfile = members.find(m => m.user_id === me);
    supabase.channel(`group-broadcast:${activeGroupId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        groupId: activeGroupId,
        userId: me,
        userName: displayName(myProfile?.profile),
        isTyping,
        sentAt: now,
      },
    }).catch(() => {});
  };

  const onDraftChangeGroup = (value: string) => {
    setDraft(value);
    broadcastTypingGroup(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => broadcastTypingGroup(false), 2200);

    if (groupDraftRef.current) {
      groupDraftRef.current.style.height = 'auto';
      groupDraftRef.current.style.height = `${Math.min(groupDraftRef.current.scrollHeight, 160)}px`;
    }

    const match = value.match(/@(\w*)$/);
    if (match) {
      setMentionSearch(match[1].toLowerCase());
      setShowMentionPopup(true);
      setMentionIndex(0);
    } else {
      setShowMentionPopup(false);
      setMentionSearch('');
    }
  };

  const insertMention = (member: GroupMember) => {
    const replaced = draft.replace(/@(\w*)$/, `@${member.profile?.username} `);
    setDraft(replaced);
    setShowMentionPopup(false);
    setMentionSearch('');
  };

  const getDateLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const isConsecutive = (msg: GroupMessage, prev?: GroupMessage) => {
    if (!prev) return false;
    if (msg.sender_id !== prev.sender_id) return false;
    if (msg.message_type === 'system' || prev.message_type === 'system') return false;
    return new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
  };

  const urlUserId = searchParams?.get('userId');

  useEffect(() => {
    if (!urlUserId || !session?.access_token) return;
 
    // Check if we already have it in conversations data
    const existing = conversationsQuery.data?.find((c) => c.partner?.id === urlUserId);
    if (existing) {
      openConversation(existing.id);
      return;
    }

    const handleAutoStartChat = async () => {
      startTopLoader();
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
          body: JSON.stringify({
            recipientId: urlUserId,
            startOnly: true,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Could not start conversation');
        const data = await res.json();
        
        // Fetch recipient profile for fallback temp conversation state
        const { data: partner } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', urlUserId)
          .single();

        if (partner) {
          setTempActiveConversation({
            id: data.conversationId,
            partner: {
              id: partner.id,
              username: partner.username,
              full_name: partner.full_name,
              avatar_url: partner.avatar_url,
              is_online: false,
              last_seen_at: null,
            },
            last_message: null,
            unread_count: 0,
            pinned: false,
            archived: false,
            muted: false,
            blocked: false,
            updated_at: new Date().toISOString(),
          });
        }

        openConversation(data.conversationId);
        queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
      } catch (error: any) {
        toast.error(error.message || 'Could not start chat');
      } finally {
        finishTopLoader();
      }
    };
 
    handleAutoStartChat();
  }, [urlUserId, session?.access_token, conversationsQuery.data, queryClient]);

  useEffect(() => {
    const groupId = searchParams?.get('groupId');
    const view = searchParams?.get('view');
    if (groupId) {
      setActiveGroupId(groupId);
      setConversationView('groups');
      setMobileOpen(true);
    } else if (view === 'groups') {
      setConversationView('groups');
    }
  }, [searchParams]);

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
      if (dmDraftRef.current) dmDraftRef.current.style.height = 'auto';
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
    onMutate: async ({ messageId, body }: { messageId: string; body: string }) => {
      const queryKey = ['messaging', 'messages', activeConversationId, messageSearch, session?.access_token];
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData<MessagesQueryData>(queryKey);

      if (previousData) {
        queryClient.setQueryData<MessagesQueryData>(queryKey, {
          ...previousData,
          messages: previousData.messages.map((msg) =>
            msg.id === messageId
              ? { ...msg, content: body, edited_at: new Date().toISOString() }
              : msg
          ),
        });
      }

      setDraft('');
      setEditingMessage(null);

      return { previousData };
    },
    mutationFn: async ({ messageId, body }: { messageId: string; body: string }) => {
      const res = await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ messageId, body }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not edit message');
    },
    onSuccess: () => {
      invalidateMessaging();
    },
    onError: (error: Error, variables, context) => {
      toast.error(error.message);
      if (context?.previousData) {
        const queryKey = ['messaging', 'messages', activeConversationId, messageSearch, session?.access_token];
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
  });

  const deleteMessage = async (messageId: string, scope: 'me' | 'everyone' = 'everyone') => {
    const queryKey = ['messaging', 'messages', activeConversationId, messageSearch, session?.access_token];
    const previousData = queryClient.getQueryData<MessagesQueryData>(queryKey);

    if (previousData) {
      queryClient.setQueryData<MessagesQueryData>(queryKey, {
        ...previousData,
        messages: previousData.messages
          .map((msg) => {
            if (msg.id === messageId) {
              if (scope === 'everyone') {
                return {
                  ...msg,
                  content: 'This message was deleted',
                  deleted_at: new Date().toISOString(),
                  attachments: [],
                };
              }
            }
            return msg;
          })
          .filter((msg) => !(msg.id === messageId && scope === 'me')),
      });
    }

    if (scope === 'everyone') {
      setMessageReactions((prev) => {
        const copy = { ...prev };
        delete copy[messageId];
        return copy;
      });

      typingChannelRef.current?.send({
        type: 'broadcast',
        event: 'delete_message',
        payload: { messageId, conversationId: activeConversationId },
      }).catch(() => {});
    }

    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders(session)) },
        body: JSON.stringify({ messageId, scope }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not delete message');
      invalidateMessaging();
    } catch (err: any) {
      toast.error(err.message);
      if (previousData) {
        queryClient.setQueryData(queryKey, previousData);
      }
    }
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

  const toggleReaction = (messageId: string, emoji: string) => {
    if (!me) return;
    setMessageReactions((prev) => {
      let currentList = [...(prev[messageId] || [])];

      // Find if user already has any reaction on this message (WhatsApp: one reaction per user)
      const prevReaction = currentList.find((r) => r.users.includes(me));
      const prevEmoji = prevReaction?.emoji;

      // Clicking the same emoji the user already reacted with → remove it
      const isSameEmoji = prevEmoji === emoji;
      const isAdding = !isSameEmoji;

      // Step 1: Remove user from their previous reaction
      if (prevEmoji) {
        currentList = currentList
          .map((r) => r.emoji === prevEmoji ? { ...r, users: r.users.filter((u) => u !== me) } : r)
          .filter((r) => r.users.length > 0);
      }

      // Step 2: Add user to the new emoji (unless it's the same → toggling off)
      let newList = currentList;
      if (isAdding) {
        const existing = currentList.find((r) => r.emoji === emoji);
        if (existing) {
          newList = currentList.map((r) => r.emoji === emoji ? { ...r, users: [...r.users, me] } : r);
        } else {
          newList = [...currentList, { emoji, users: [me] }];
        }
      }

      // Broadcast swap to other participants
      typingChannelRef.current?.send({
        type: 'broadcast',
        event: 'reaction',
        payload: {
          messageId,
          emoji,
          userId: me,
          isAdding,
          prevEmoji: prevEmoji || null,
        },
      }).catch(() => {});

      return { ...prev, [messageId]: newList };
    });
    setActiveReactionMenu(null);
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

    if (dmDraftRef.current) {
      dmDraftRef.current.style.height = 'auto';
      dmDraftRef.current.style.height = `${Math.min(dmDraftRef.current.scrollHeight, 160)}px`;
    }
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
              {conversationView === 'groups' ? (
                <>
                  <div>
                    <h1>Groups</h1>
                    <span>{(groupsQuery.data || []).reduce((sum, item) => sum + (item.unread_count || 0), 0)} unread</span>
                  </div>
                  <button className="chat-icon-btn" onClick={() => setShowCreateModal(true)} title="Create Group">
                    <PlusCircle size={22} />
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <h1>{conversationView === 'archived' ? 'Archived' : 'Messages'}</h1>
                    <span>{conversationsQuery.data?.reduce((sum, item) => sum + item.unread_count, 0) || 0} unread</span>
                  </div>
                  <MessageCircle size={22} />
                </>
              )}
            </div>
            <div className="chat-view-tabs" role="tablist" aria-label="Conversation view">
              <button
                type="button"
                className={conversationView === 'active' ? 'active' : ''}
                onClick={() => {
                  setConversationView('active');
                  setActiveConversationId(null);
                  setActiveGroupId(null);
                  router.replace('/chats', { scroll: false });
                }}
              >
                Direct
              </button>
              <button
                type="button"
                className={conversationView === 'groups' ? 'active' : ''}
                onClick={() => {
                  setConversationView('groups');
                  setActiveConversationId(null);
                  setActiveGroupId(null);
                  router.replace('/chats', { scroll: false });
                }}
              >
                Groups
              </button>
              <button
                type="button"
                className={conversationView === 'archived' ? 'active' : ''}
                onClick={() => {
                  setConversationView('archived');
                  setActiveConversationId(null);
                  setActiveGroupId(null);
                  router.replace('/chats', { scroll: false });
                }}
              >
                Archive
              </button>
            </div>
            <label className="chat-search">
              <Search size={16} />
              <input
                value={conversationView === 'groups' ? groupSearch : userSearch}
                onChange={(event) => conversationView === 'groups' ? setGroupSearch(event.target.value) : setUserSearch(event.target.value)}
                placeholder={conversationView === 'groups' ? "Search groups" : "Search people"}
              />
            </label>
          </div>

          {conversationView !== 'groups' && userSearch.trim().length > 1 && (
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
            {conversationView === 'groups' ? (
              <>
                {groupsQuery.isLoading && Array.from({ length: 7 }).map((_, index) => <div className="chat-skeleton" key={index} />)}
                {!groupsQuery.isLoading && !displayedGroups.length && (
                  <div className="chat-empty-list">
                    <Users size={34} />
                    <p>{groupSearch.length > 1 ? 'No matching groups' : 'No groups yet'}</p>
                    <button className="group-btn-primary" style={{ padding: '0.45rem 1rem', marginTop: '0.5rem', fontSize: '0.85rem', width: 'auto', display: 'inline-flex' }} onClick={() => setShowCreateModal(true)}>
                      Create a Group
                    </button>
                  </div>
                )}

                {/* Pending Invitations Banner */}
                {myPendingInvites.length > 0 && (
                  <div style={{ margin: '0 0 0.5rem 0' }}>
                    {myPendingInvites.map(invite => (
                      <PendingInviteCard
                        key={invite.id}
                        invite={invite}
                        session={session!}
                        onRespond={() => {
                          myPendingInvitesQuery.refetch();
                          queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
                        }}
                      />
                    ))}
                  </div>
                )}

                {displayedGroups.map((group: Group) => (
                  <button
                    key={group.id}
                    className={`conversation-card-item ${group.id === activeGroupId ? 'active' : ''}`}
                    onClick={() => openGroup(group.id)}
                  >
                    <span className="chat-avatar-wrap">
                      <GroupAvatar name={group.name} avatarUrl={group.avatar_url} size={42} radius={12} />
                    </span>
                    <span className="conversation-text">
                      <span className="conversation-topline">
                        <strong>{group.name}</strong>
                        <small>{compactTime(group.last_message_at || group.created_at)}</small>
                      </span>
                      <span className="conversation-preview">
                        {group.last_message
                          ? `${group.last_message.sender ? displayName(group.last_message.sender) + ': ' : ''}${group.last_message.content || 'New message'}`
                          : group.description || `${group.member_count} members`}
                      </span>
                    </span>
                    {(group.unread_count || 0) > 0 && <span className="chat-unread-badge">{group.unread_count}</span>}
                  </button>
                ))}
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </aside>

        <section className={`chat-center ${mobileOpen ? 'mobile-active' : 'mobile-hidden'}`}>
          {!activeConversationId && !activeGroupId ? (
            <div className="chat-empty-state">
              <MessageCircle size={46} />
              <h2>Select a conversation</h2>
              <p>Search for someone or open a group chat to start messaging.</p>
            </div>
          ) : activeGroupId ? (
            <div className="chat-window" style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              <div className="chat-main-column" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%' }}>
                {/* Group Chat Header */}
                <header className="chat-window-header">
                  <div className="chat-header-user">
                    <button className="chat-icon-btn back-btn-mobile" onClick={() => { setMobileOpen(false); router.replace('/chats', { scroll: false }); }} title="Back">
                      <ArrowLeft size={20} />
                    </button>
                    <span className="chat-avatar-wrap">
                      <GroupAvatar name={activeGroup?.name} avatarUrl={activeGroup?.avatar_url} size={42} radius={12} />
                    </span>
                    <div onClick={() => {
                      if (!showPanel) {
                        setPanelTab('members');
                        setShowPanel(true);
                      } else {
                        setShowPanel(false);
                      }
                    }} style={{ cursor: 'pointer' }}>
                      <h2>{activeGroup?.name}</h2>
                      <p>
                        {typingInGroup.length > 0
                          ? `${typingInGroup.slice(0, 2).join(', ')} ${typingInGroup.length === 1 ? 'is' : 'are'} typing...`
                          : `${activeGroup?.member_count || 0} members`}
                      </p>
                    </div>
                  </div>
                  <div className="chat-header-actions">
                    <label className="chat-message-search">
                      <Search size={15} />
                      <input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search" />
                    </label>
                    <button className="chat-icon-btn" title="Group info" onClick={() => {
                      if (!showPanel) {
                        setPanelTab('about');
                        setShowPanel(true);
                      } else if (panelTab === 'about') {
                        setShowPanel(false);
                      } else {
                        setPanelTab('about');
                      }
                    }}>
                      <Info size={20} />
                    </button>
                    {['owner', 'admin'].includes(myRole) && (
                      <button className="chat-icon-btn" title="Invite members" onClick={() => setShowInviteModal(true)}>
                        <UserPlus size={20} />
                      </button>
                    )}
                    <div style={{ position: 'relative' }}>
                      <button className="chat-icon-btn" title="More" onClick={() => setActiveMessageMenu(m => m === 'group-header-menu' ? null : 'group-header-menu')}>
                        <MoreVertical size={20} />
                      </button>
                      {activeMessageMenu === 'group-header-menu' && (
                        <div className="chat-floating-menu" style={{ top: '100%', right: 0 }}>
                          <button className="chat-menu-item" onClick={() => {
                            setPanelTab('members');
                            setShowPanel(true);
                            setActiveMessageMenu(null);
                          }}>
                            <Users size={16} style={{ marginRight: 4 }} />Members
                          </button>
                          {['owner', 'admin'].includes(myRole) && (
                            <button className="chat-menu-item" onClick={() => { setShowInviteModal(true); setActiveMessageMenu(null); }}>
                              <UserPlus size={16} style={{ marginRight: 4 }} />Invite Members
                            </button>
                          )}
                          <div className="chat-menu-divider" />
                          <button className="chat-menu-item chat-menu-item-danger" onClick={() => { leaveGroup(); setActiveMessageMenu(null); }}>
                            <LogOut size={16} style={{ marginRight: 4 }} />Leave Group
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </header>

                {/* Group Messages Area */}
                <div 
                  className="chat-messages" 
                  onClick={() => { setActiveMessageMenu(null); setActiveReactionMenu(null); }}
                >
                  {groupMessagesQuery.isLoading && Array.from({ length: 8 }).map((_, index) => <div className="message-skeleton" key={index} />)}
                  {!groupMessagesQuery.isLoading && groupMessages.length === 0 && (
                    <div className="chat-thread-empty">
                      <Smile size={34} />
                      <p>No messages here yet. Say hello! 👋</p>
                    </div>
                  )}
                  {groupMessages.map((msg, idx) => {
                    const prev = groupMessages[idx - 1];
                    const mine = msg.sender_id === me;
                    const consecutive = isConsecutive(msg, prev);
                    const showDate = !prev || getDateLabel(msg.created_at) !== getDateLabel(prev.created_at);

                    if (msg.message_type === 'system') {
                      return (
                        <React.Fragment key={msg.id}>
                          {showDate && <div className="group-date-separator"><span>{getDateLabel(msg.created_at)}</span></div>}
                          <div className="group-system-message">{msg.content}</div>
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && <div className="group-date-separator"><span>{getDateLabel(msg.created_at)}</span></div>}
                        <article
                          className={`group-message-row ${mine ? 'mine' : 'theirs'} ${consecutive ? 'consecutive' : ''}`}
                          data-message-id={msg.id}
                          style={{ userSelect: 'none' }}
                        >
                          {!mine && (
                            consecutive
                              ? <div className="group-msg-avatar-spacer" />
                              : <div style={{ position: 'relative' }}><MemberAvatar profile={msg.sender || null} size={32} /></div>
                          )}

                          <div className="group-msg-content">
                            {!mine && !consecutive && (
                              <div className="group-msg-sender-name">
                                {displayName(msg.sender)}
                                <RoleBadge role={members.find(m => m.user_id === msg.sender_id)?.role || 'member'} />
                              </div>
                            )}

                            <div style={{ position: 'relative' }} className="group-bubble-wrapper">
                              {!msg.deleted_at && (
                                <MessageActions
                                  messageId={msg.id}
                                  content={msg.content}
                                  mine={mine}
                                  canEdit={true}
                                  canDelete={true}
                                  showForward={true}
                                  reactions={msg.reactions}
                                  me={me}
                                  activeReactionMenu={activeReactionMenu}
                                  setActiveReactionMenu={setActiveReactionMenu}
                                  activeMessageMenu={activeMessageMenu}
                                  setActiveMessageMenu={setActiveMessageMenu}
                                  onReply={() => setReplyToGroup(msg)}
                                  onForward={() => setForwardMessage(msg)}
                                  onEdit={() => { setEditingGroupMessage(msg); setDraft(msg.content); }}
                                  onDelete={() => setGroupDeleteScope({ messageId: msg.id })}
                                  onReact={(emoji) => reactToGroupMessage(msg.id, emoji)}
                                />
                              )}

                              <div
                                className="group-bubble"
                                onContextMenu={e => {
                                  e.preventDefault();
                                  if (msg.deleted_at) return;
                                  setGroupContextMenu({ messageId: msg.id, x: e.clientX, y: e.clientY });
                                  setActiveReactionMenu(null);
                                }}
                                onTouchStart={(e) => {
                                  if (msg.deleted_at) return;
                                  if (e.touches.length > 1) return;
                                  longPressTimerRef.current = setTimeout(() => {
                                    setGroupContextMenu({ messageId: msg.id, x: window.innerWidth / 2, y: window.innerHeight / 2 });
                                    setActiveReactionMenu(null);
                                    longPressTimerRef.current = null;
                                  }, LONG_PRESS_MS);
                                }}
                                onTouchEnd={(e) => {
                                  if (longPressTimerRef.current) {
                                    clearTimeout(longPressTimerRef.current);
                                    longPressTimerRef.current = null;
                                  } else if (!msg.deleted_at) {
                                    e.preventDefault();
                                  }
                                }}
                                onTouchMove={() => {
                                  if (longPressTimerRef.current) {
                                    clearTimeout(longPressTimerRef.current);
                                    longPressTimerRef.current = null;
                                  }
                                }}
                                onClick={(e) => {
                                  if (msg.deleted_at) return;
                                  if ((e.target as HTMLElement).closest('button, a, img')) return;
                                  setActiveMessageMenu(m => m === msg.id ? null : msg.id);
                                  setActiveReactionMenu(null);
                                  setGroupContextMenu(null);
                                }}
                              >
                                {/* Forwarded badge */}
                                {!msg.deleted_at && msg.forwarded_from && (
                                  <div className="group-forwarded-badge">
                                    <Forward size={11} />
                                    <span>Forwarded from {msg.forwarded_from}</span>
                                  </div>
                                )}
                                {!msg.deleted_at && msg.content?.startsWith('↩ Forwarded') && (
                                  <div className="group-forwarded-badge">
                                    <Forward size={11} />
                                    <span>Forwarded</span>
                                  </div>
                                )}

                                {!msg.deleted_at && msg.reply_to && (
                                  <div className="group-reply-preview"
                                    onClick={() => document.querySelector(`[data-message-id="${msg.reply_to?.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                                    <Reply size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                      <span className="group-reply-sender">{displayName(msg.reply_to.sender)}</span>
                                      <span className="group-reply-text">{msg.reply_to.content || 'Attachment'}</span>
                                    </div>
                                  </div>
                                )}

                                {!msg.deleted_at && !!msg.attachments?.length && (
                                  <div className="group-msg-attachments">
                                    {msg.attachments.map((att, i) => att.type === 'image'
                                      ? <a key={i} href={att.url} target="_blank" rel="noreferrer"><img src={att.url} alt={att.name} /></a>
                                      : <a key={i} className="group-msg-file" href={att.url} download={att.name}>
                                        <FileText size={16} /><span>{att.name}</span>
                                      </a>
                                    )}
                                  </div>
                                )}

                                {msg.deleted_at ? (
                                  <p style={{ fontStyle: 'italic', opacity: 0.6 }}>This message was deleted</p>
                                ) : (
                                  msg.content && renderGroupMessage(msg.content, members, mine)
                                )}

                                <div className="group-msg-meta">
                                  <time>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                                  {msg.edited_at && !msg.deleted_at && <span>Edited</span>}
                                  {mine && (() => {
                                    const receipt = groupReadReceipt(msg, me);
                                    const readByOthers = msg.reads?.filter((r) => r.user_id !== me) || [];
                                    const readByNames = readByOthers
                                      .map((r) => {
                                        const m = members.find((mb) => mb.user_id === r.user_id);
                                        return m ? displayName(m.profile) : null;
                                      })
                                      .filter(Boolean);
                                    const tooltip = readByNames.length > 0 ? `Seen by ${readByNames.join(', ')}` : 'Delivered to group';
                                    return (
                                      <span
                                        className="group-msg-seen receipt"
                                        title={tooltip}
                                        onClick={() => setMessageInfoMsg(msg)}
                                        style={{ cursor: 'pointer' }}
                                      >
                                        {receipt}{' '}
                                        {receipt === 'Seen' ? <CheckCheck size={12} /> : <Check size={12} />}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Reactions with tooltip */}
                            {!msg.deleted_at && msg.reactions.length > 0 && (
                              <div className="group-bubble-reactions">
                                {msg.reactions.map(r => {
                                  const isActive = me && r.users.includes(me);
                                  const names = r.users.map(uid => {
                                    const m = members.find(mb => mb.user_id === uid);
                                    return displayName(m?.profile);
                                  }).join(', ');
                                  return (
                                    <button
                                      key={r.emoji}
                                      className={`group-reaction-badge ${isActive ? 'active' : ''}`}
                                      title={names}
                                      onClick={() => reactToGroupMessage(msg.id, r.emoji)}
                                    >
                                      <span>{r.emoji}</span>
                                      <span className="react-count">{r.users.length}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </article>
                      </React.Fragment>
                    );
                  })}
                  {typingInGroup.length > 0 && (
                    <div className="group-typing-row" style={{ paddingLeft: '12px' }}>
                      <div className="group-typing-bubble"><span /><span /><span /></div>
                      <span>{typingInGroup.slice(0, 2).join(', ')} {typingInGroup.length === 1 ? 'is' : 'are'} typing…</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Group Composer */}
                <footer className="chat-composer">
                  {(replyToGroup || editingGroupMessage || attachments.length > 0) && (
                    <div className="composer-context">
                      <div>
                        {editingGroupMessage
                          ? <strong>Editing message</strong>
                          : replyToGroup
                            ? <strong>Replying to {displayName(replyToGroup.sender)}</strong>
                            : <strong>{attachments.length} attachment{attachments.length > 1 ? 's' : ''}</strong>}
                        <span>{editingGroupMessage?.content || replyToGroup?.content || attachments.map(a => a.name).join(', ')}</span>
                      </div>
                      <button className="chat-icon-btn" onClick={() => { setReplyToGroup(null); setEditingGroupMessage(null); setAttachments([]); if (editingGroupMessage) setDraft(''); }}>
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {attachments.length > 0 && (
                    <div className="group-attachment-previews">
                      {attachments.map((att, i) => (
                        <div key={i} className="group-attachment-thumb">
                          {att.type === 'image'
                            ? <img src={att.url} alt={att.name} />
                            : <div className="group-attachment-thumb-file">
                              <FileText size={20} style={{ color: 'var(--text-muted)' }} />
                              <span>{att.name}</span>
                            </div>}
                          <button className="group-attachment-remove" onClick={() => setAttachments(a => a.filter((_, j) => j !== i))}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mention popup */}
                  {showMentionPopup && mentionSuggestions.length > 0 && (
                    <div className="group-mention-popup">
                      {mentionSuggestions.map((member: GroupMember, i: number) => (
                        <button key={member.user_id} className={`group-mention-item ${i === mentionIndex ? 'highlighted' : ''}`}
                          onClick={() => insertMention(member)}>
                          <MemberAvatar profile={member.profile} size={26} />
                          <span>
                            <strong style={{ fontSize: '0.87rem' }}>{displayName(member.profile)}</strong>
                            <small style={{ color: 'var(--text-muted)', marginLeft: 6 }}>@{member.profile?.username}</small>
                          </span>
                          <RoleBadge role={member.role} />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="chat-composer-bar">
                    <input ref={fileInputRef} type="file" hidden multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                      onChange={async (e) => {
                        if (!e.target.files?.length) return;
                        const next = await Promise.all(Array.from(e.target.files).slice(0, 4).map(fileToAttachment));
                        setAttachments(a => [...a, ...next].slice(0, 4));
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    />
                    <button className="chat-icon-btn" title="Attach" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip size={20} />
                    </button>
                    <div style={{ position: 'relative' }}>
                      <button className="chat-icon-btn" title="Emoji" onClick={() => setShowEmojiPicker(p => !p)}>
                        <Smile size={20} />
                      </button>
                      {showEmojiPicker && (
                        <div className="group-emoji-picker">
                          {EMOJI_FULL.map(emoji => (
                            <button key={emoji} onClick={() => { setDraft(d => d + emoji); setShowEmojiPicker(false); }}>
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <textarea
                      ref={groupDraftRef}
                      value={draft}
                      onChange={e => onDraftChangeGroup(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { setShowMentionPopup(false); return; }
                        if (showMentionPopup && e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionSuggestions.length - 1)); return; }
                        if (showMentionPopup && e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
                        if (showMentionPopup && e.key === 'Enter') { e.preventDefault(); if (mentionSuggestions[mentionIndex]) insertMention(mentionSuggestions[mentionIndex]); return; }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (editingGroupMessage) editGroupMessageMutation.mutate({ messageId: editingGroupMessage.id, content: draft });
                          else sendGroupMessageMutation.mutate();
                        }
                      }}
                      placeholder={`Message ${activeGroup?.name || 'group'}… (@ to mention)`}
                      rows={1}
                    />
                    <button className="chat-send-btn"
                      disabled={sendGroupMessageMutation.isPending || editGroupMessageMutation.isPending || (!draft.trim() && !attachments.length)}
                      onClick={() => {
                        if (editingGroupMessage) editGroupMessageMutation.mutate({ messageId: editingGroupMessage.id, content: draft });
                        else sendGroupMessageMutation.mutate();
                      }}>
                      {sendGroupMessageMutation.isPending || editGroupMessageMutation.isPending
                        ? <Loader2 size={16} className="spin" />
                        : <Send size={16} />}
                    </button>
                  </div>
                </footer>
              </div>

              {/* Group Info Panel */}
              {showPanel && activeGroup && (
                <GroupInfoPanel
                  group={activeGroup}
                  members={members}
                  session={session}
                  me={me}
                  onInvite={() => setShowInviteModal(true)}
                  onClose={() => setShowPanel(false)}
                  onMentionInsert={(text) => {
                    setDraft(prev => prev + text);
                    setShowPanel(false);
                    groupDraftRef.current?.focus();
                  }}
                  onGroupUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
                    queryClient.invalidateQueries({ queryKey: ['groups', 'members', activeGroupId] });
                    queryClient.invalidateQueries({ queryKey: ['groups', 'detail', activeGroupId] });
                  }}
                  panelTab={panelTab}
                  setPanelTab={setPanelTab}
                />
              )}
            </div>
          ) : !activeConversation ? (
            <div className="chat-page-root chat-centered" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 className="spin" />
            </div>
          ) : (
            <div className="chat-window">
              <header className="chat-window-header">
                <div className="chat-header-user">
                  <button className="chat-icon-btn back-btn-mobile" onClick={() => setMobileOpen(false)} title="Back">
                    <ArrowLeft size={20} />
                  </button>
                  <span className="chat-avatar-wrap">
                    <Avatar 
                      profile={activeConversation.partner} 
                      onClick={() => setEnlargedAvatarUrl(activeConversation.partner.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeConversation.partner.id}`)} 
                    />
                    <i className={activeConversation.partner?.is_online ? 'online' : ''} />
                  </span>
                  <div 
                    onClick={() => router.push(activeConversation.partner.username ? `/user/${activeConversation.partner.username}` : `/profile?userId=${activeConversation.partner.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
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

              <div 
                className="chat-messages" 
                ref={messageListRef}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('.message-bubble')) {
                    setActiveMessageMenu(null);
                    setActiveReactionMenu(null);
                  }
                }}
              >
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
                    <article
                      key={message.id}
                      className={`message-row ${mine ? 'mine' : 'theirs'} ${message.status === 'failed' ? 'failed' : ''}`}
                      data-message-id={message.id}
                      style={!message.deleted_at && messageReactions[message.id]?.length > 0 ? { paddingBottom: '1.4rem' } : undefined}
                    >
                      <div 
                        className="message-bubble"
                        onContextMenu={e => {
                          e.preventDefault();
                          if (message.deleted_at) return;
                          setGroupContextMenu({ messageId: message.id, x: e.clientX, y: e.clientY });
                          setActiveReactionMenu(null);
                        }}
                        onTouchStart={(e) => {
                          if (message.deleted_at) return;
                          if (e.touches.length > 1) return;
                          longPressTimerRef.current = setTimeout(() => {
                            setGroupContextMenu({ messageId: message.id, x: window.innerWidth / 2, y: window.innerHeight / 2 });
                            setActiveReactionMenu(null);
                            longPressTimerRef.current = null;
                          }, 500);
                        }}
                        onTouchEnd={(e) => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          } else if (!message.deleted_at) {
                            e.preventDefault();
                          }
                        }}
                        onTouchMove={() => {
                          if (longPressTimerRef.current) {
                            clearTimeout(longPressTimerRef.current);
                            longPressTimerRef.current = null;
                          }
                        }}
                        onClick={(e) => {
                          if (message.deleted_at) return;
                          if ((e.target as HTMLElement).closest('button, a, img')) return;
                          setActiveMessageMenu(activeMessageMenu === message.id ? null : message.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {message.deleted_at ? (
                          <p style={{ fontStyle: 'italic', opacity: 0.6 }}>This message was deleted.</p>
                        ) : (
                          <>
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
                            {message.content && renderFormattedMessage(message.content, mine)}
                          </>
                        )}
                        <footer className="message-meta">
                          <time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                          {message.edited_at && !message.deleted_at && <span>Edited</span>}
                          {mine && <span className="receipt">{readReceipt(message, me)} {readReceipt(message, me) === 'Seen' ? <CheckCheck size={13} /> : <Check size={13} />}</span>}
                        </footer>
                        {!message.deleted_at && messageReactions[message.id]?.length > 0 && (
                          <div className="message-bubble-reactions">
                            {messageReactions[message.id].map((r) => {
                              const active = me && r.users.includes(me);
                              return (
                                <button
                                  key={r.emoji}
                                  className={`message-reaction-badge ${active ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleReaction(message.id, r.emoji);
                                  }}
                                >
                                  <span>{r.emoji}</span>
                                  <span className="react-count">{r.users.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {!message.deleted_at && (
                          <MessageActions
                            messageId={message.id}
                            content={message.content}
                            mine={mine}
                            canEdit={true}
                            canDelete={true}
                            showForward={false}
                            reactions={messageReactions[message.id] || []}
                            me={me}
                            activeReactionMenu={activeReactionMenu}
                            setActiveReactionMenu={setActiveReactionMenu}
                            activeMessageMenu={activeMessageMenu}
                            setActiveMessageMenu={setActiveMessageMenu}
                            onReply={() => setReplyTo(message)}
                            onEdit={() => { setEditingMessage(message); setDraft(message.content); }}
                            onDelete={() => setDmDeleteScope({ messageId: message.id })}
                            onReact={(emoji) => toggleReaction(message.id, emoji)}
                          />
                        )}
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
                  <textarea ref={dmDraftRef} value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (editingMessage) {
                        editMutation.mutate({ messageId: editingMessage.id, body: draft });
                      } else {
                        sendMutation.mutate();
                      }
                    }
                  }} placeholder="Message" rows={1} />
                  <button className="chat-send-btn" disabled={sendMutation.isPending || editMutation.isPending || (!draft.trim() && !attachments.length)} onClick={() => {
                    if (editingMessage) {
                      editMutation.mutate({ messageId: editingMessage.id, body: draft });
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

      {enlargedAvatarUrl && (
        <div 
          onClick={() => setEnlargedAvatarUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <img 
            src={enlargedAvatarUrl || undefined} 
            alt="Enlarged Avatar" 
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              transform: 'scale(1)',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      )}

      {showCreateModal && (
        <CreateGroupModal
          session={session}
          onClose={() => setShowCreateModal(false)}
          onCreated={(group) => {
            queryClient.invalidateQueries({ queryKey: ['groups', 'list'] });
            openGroup(group.id);
          }}
        />
      )}

      {showInviteModal && activeGroupId && (
        <InviteModal
          groupId={activeGroupId}
          session={session}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Leave Group Confirmation Dialog */}
      {showLeaveDialog && (
        <div
          className="group-modal-overlay"
          style={{ zIndex: 4000 }}
          onClick={e => { if (e.target === e.currentTarget) setShowLeaveDialog(false); }}
        >
          <div className="group-modal" style={{ maxWidth: 420, width: '90%' }}>
            <button className="group-modal-close" onClick={() => setShowLeaveDialog(false)}><X size={18} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LogOut size={20} style={{ color: '#f87171' }} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Leave Group?</h3>
            </div>
            {myRole === 'owner' ? (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                  You are the <strong style={{ color: 'var(--text-main)' }}>Owner</strong> of this group.
                  You cannot leave unless you first transfer ownership to another member or delete the group.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  Go to <strong style={{ color: 'var(--text-main)' }}>Members</strong> to transfer ownership.
                </p>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Are you sure you want to leave <strong style={{ color: 'var(--text-main)' }}>{activeGroup?.name || 'this group'}</strong>?
                You will stop receiving messages and will need a new invitation or approval to rejoin.
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button
                className="group-btn-secondary"
                style={{ padding: '0.5rem 1.1rem', fontSize: '0.9rem' }}
                onClick={() => setShowLeaveDialog(false)}
                disabled={leavingGroup}
              >
                Cancel
              </button>
              {myRole !== 'owner' && (
                <button
                  style={{
                    padding: '0.5rem 1.1rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: leavingGroup ? 'not-allowed' : 'pointer',
                    opacity: leavingGroup ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                  onClick={performLeaveGroup}
                  disabled={leavingGroup}
                >
                  {leavingGroup ? <Loader2 size={14} className="spin" /> : <LogOut size={14} />}
                  Leave Group
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {groupDeleteScope && ((scope) => {
        const msg = groupMessages.find(m => m.id === scope.messageId);
        const canDeleteEveryone = msg && (msg.sender_id === me || ['admin', 'owner', 'moderator'].includes(myRole));
        return (
          <div className="group-modal-overlay" style={{ zIndex: 3000 }} onClick={e => e.target === e.currentTarget && setGroupDeleteScope(null)}>
            <div className="group-modal" style={{ maxWidth: 340, width: '90%' }}>
              <button className="group-modal-close" onClick={() => setGroupDeleteScope(null)}><X size={18} /></button>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Delete message</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="group-btn-secondary" style={{ justifyContent: 'flex-start', gap: 8, padding: '0.6rem 0.8rem' }}
                  onClick={() => { deleteGroupMessage(scope.messageId, 'me'); setGroupDeleteScope(null); }}>
                  <X size={14} />Delete for me
                </button>
                {canDeleteEveryone && (
                  <button className="group-btn-secondary" style={{ justifyContent: 'flex-start', gap: 8, padding: '0.6rem 0.8rem', color: '#f87171' }}
                    onClick={() => { deleteGroupMessage(scope.messageId, 'everyone'); setGroupDeleteScope(null); }}>
                    <Trash2 size={14} />Delete for everyone
                  </button>
                )}
              </div>
              <div style={{ marginTop: '0.5rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="group-btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => setGroupDeleteScope(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })(groupDeleteScope)}

      {dmDeleteScope && ((scope) => {
        const msg = messages.find(m => m.id === scope.messageId);
        const canDeleteEveryone = msg && msg.sender_id === me;
        return (
          <div className="group-modal-overlay" style={{ zIndex: 3000 }} onClick={e => e.target === e.currentTarget && setDmDeleteScope(null)}>
            <div className="group-modal" style={{ maxWidth: 340, width: '90%' }}>
              <button className="group-modal-close" onClick={() => setDmDeleteScope(null)}><X size={18} /></button>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Delete message</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="group-btn-secondary" style={{ justifyContent: 'flex-start', gap: 8, padding: '0.6rem 0.8rem' }}
                  onClick={() => { deleteMessage(scope.messageId, 'me').catch((err) => toast.error(err.message)); setDmDeleteScope(null); }}>
                  <X size={14} />Delete for me
                </button>
                {canDeleteEveryone && (
                  <button className="group-btn-secondary" style={{ justifyContent: 'flex-start', gap: 8, padding: '0.6rem 0.8rem', color: '#f87171' }}
                    onClick={() => { deleteMessage(scope.messageId, 'everyone').catch((err) => toast.error(err.message)); setDmDeleteScope(null); }}>
                    <Trash2 size={14} />Delete for everyone
                  </button>
                )}
              </div>
              <div style={{ marginTop: '0.5rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="group-btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => setDmDeleteScope(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })(dmDeleteScope)}

      {/* Forward Message Modal */}
      {forwardMessage && session && (
        <ForwardModal
          message={forwardMessage}
          session={session}
          me={me}
          onClose={() => setForwardMessage(null)}
        />
      )}

      {/* Message Info Modal */}
      {messageInfoMsg && (
        <MessageInfoModal
          message={messageInfoMsg as GroupMessage}
          members={members}
          me={me}
          onClose={() => setMessageInfoMsg(null)}
        />
      )}

      {groupContextMenu && (() => {
        const isGroup = !!activeGroupId;
        const ctxMsg = isGroup
          ? groupMessages.find(m => m.id === groupContextMenu.messageId)
          : messages.find(m => m.id === groupContextMenu.messageId);

        if (!ctxMsg) return null;
        const mine = ctxMsg.sender_id === me;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const menuWidth = 210;
        let optionCount = 2; // Reply, Copy are always present
        if (isGroup) optionCount += 1; // Forward
        if (mine && !ctxMsg.deleted_at) optionCount += 1; // Edit
        if (isGroup && mine) optionCount += 1; // Message Info
        const hasDelete = !ctxMsg.deleted_at;
        if (hasDelete) optionCount += 1; // Delete

        const menuHeight = 46 + (optionCount * 38) + (hasDelete ? 8 : 0) + 16;

        // Flipped positioning based on viewport space
        const x = groupContextMenu.x + menuWidth + 12 > vw
          ? Math.max(12, groupContextMenu.x - menuWidth)
          : groupContextMenu.x;

        const y = groupContextMenu.y + menuHeight + 12 > vh
          ? Math.max(12, groupContextMenu.y - menuHeight)
          : groupContextMenu.y;
        const groupMsg = isGroup ? ctxMsg as GroupMessage : null;
        const dmMsg = !isGroup ? ctxMsg as ChatMessage : null;

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 4000 }}
            onClick={() => setGroupContextMenu(null)}
            onContextMenu={e => { e.preventDefault(); setGroupContextMenu(null); }}
          >
            <div
              className="group-context-menu"
              style={{ left: x, top: y }}
              onClick={e => e.stopPropagation()}
            >
              {/* Emojis row at the top of the context menu */}
              <div className="group-context-menu-emojis">
                {EMOJI_QUICK.map(emoji => {
                  const reactions = isGroup ? groupMsg!.reactions : (messageReactions[ctxMsg.id] || []);
                  const isActive = me && reactions?.find((r: any) => r.emoji === emoji)?.users.includes(me);
                  return (
                    <button
                      key={emoji}
                      className={isActive ? 'active' : ''}
                      onClick={() => {
                        if (isGroup) {
                          reactToGroupMessage(ctxMsg.id, emoji);
                        } else {
                          toggleReaction(ctxMsg.id, emoji);
                        }
                        setGroupContextMenu(null);
                      }}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
              <div className="group-context-menu-divider" />
              <button className="group-context-menu-item" onClick={() => { isGroup ? setReplyToGroup(groupMsg!) : setReplyTo(dmMsg!); setGroupContextMenu(null); }}>
                <Reply size={14} />Reply
              </button>
              {isGroup && (
                <button className="group-context-menu-item" onClick={() => { setForwardMessage(groupMsg!); setGroupContextMenu(null); }}>
                  <Forward size={14} />Forward
                </button>
              )}
              <button className="group-context-menu-item" onClick={() => { navigator.clipboard.writeText(ctxMsg.content || ''); toast.success('Copied'); setGroupContextMenu(null); }}>
                <Copy size={14} />Copy
              </button>
              {mine && !ctxMsg.deleted_at && (
                <button className="group-context-menu-item" onClick={() => { isGroup ? setEditingGroupMessage(groupMsg!) : setEditingMessage(dmMsg!); setDraft(ctxMsg.content); setGroupContextMenu(null); }}>
                  <Edit3 size={14} />Edit
                </button>
              )}
              {isGroup && mine && (
                <button className="group-context-menu-item" onClick={() => { setMessageInfoMsg(groupMsg!); setGroupContextMenu(null); }}>
                  <Info size={14} />Message Info
                </button>
              )}
              {!ctxMsg.deleted_at && (
                <>
                  <div className="group-context-menu-divider" />
                  <button className="group-context-menu-item danger" onClick={() => { isGroup ? setGroupDeleteScope({ messageId: ctxMsg.id }) : setDmDeleteScope({ messageId: ctxMsg.id }); setGroupContextMenu(null); }}>
                    <Trash2 size={14} />Delete
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}
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

// Formatting and link parsing helpers for chat messages
function renderFormattedMessage(content: string, mine: boolean) {
  if (!content) return null;

  const decoded = decodeHTMLEntities(content);
  const segments = parseLinksInText(decoded);

  return (
    <p>
      {segments.map((seg, i) => {
        if (seg.type === 'link') {
          return (
            <a
              key={i}
              href={seg.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                color: mine ? '#93c5fd' : '#3b82f6',
                textDecoration: 'underline',
                fontWeight: 600,
                wordBreak: 'break-all',
                cursor: 'pointer',
              }}
            >
              {seg.display}
            </a>
          );
        }
        return <React.Fragment key={i}>{renderChatParagraphs(seg.content)}</React.Fragment>;
      })}
    </p>
  );
}

function renderChatParagraphs(text: string): React.ReactNode[] {
  if (!text) return [];
  const lines = text.split(/\n/g);
  return lines.flatMap((line, idx) => {
    return [
      ...renderFormattedTextChat(line),
      ...(idx < lines.length - 1 ? [<br key={`br-${idx}`} />] : [])
    ];
  });
}

function renderFormattedTextChat(text: string, listType: 'ul' | 'ol' | null = null): React.ReactNode[] {
  if (!text) return [];
  const regex = /(<strong\b[^>]*>[\s\S]*?<\/strong>|<b\b[^>]*>[\s\S]*?<\/b>|<em\b[^>]*>[\s\S]*?<\/em>|<i\b[^>]*>[\s\S]*?<\/i>|<u\b[^>]*>[\s\S]*?<\/u>|<code\b[^>]*>[\s\S]*?<\/code>|<ul\b[^>]*>[\s\S]*?<\/ul>|<ol\b[^>]*>[\s\S]*?<\/ol>|<li\b[^>]*>[\s\S]*?<\/li>|\*\*[^*]+\*\*|\*[^*]+\*|<u>[^<]+<\/u>|`[^`]+`)/gi;
  const parts = text.split(regex);
  let liCounter = 1;
  return parts.map((part, idx) => {
    if (!part) return null;
    if (listType && !/^<li\b/i.test(part)) return null;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{renderFormattedTextChat(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{renderFormattedTextChat(part.slice(1, -1))}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.85em' }}>{part.slice(1, -1)}</code>;
    }
    if (/^<strong\b/i.test(part)) {
      const inner = part.replace(/^<strong\b[^>]*>|<\/strong>$/gi, '');
      return <strong key={idx}>{renderFormattedTextChat(inner)}</strong>;
    }
    if (/^<b\b/i.test(part)) {
      const inner = part.replace(/^<b\b[^>]*>|<\/b>$/gi, '');
      return <strong key={idx}>{renderFormattedTextChat(inner)}</strong>;
    }
    if (/^<em\b/i.test(part)) {
      const inner = part.replace(/^<em\b[^>]*>|<\/em>$/gi, '');
      return <em key={idx}>{renderFormattedTextChat(inner)}</em>;
    }
    if (/^<i\b/i.test(part)) {
      const inner = part.replace(/^<i\b[^>]*>|<\/i>$/gi, '');
      return <em key={idx}>{renderFormattedTextChat(inner)}</em>;
    }
    if (/^<u\b/i.test(part)) {
      const inner = part.replace(/^<u\b[^>]*>|<\/u>$/gi, '');
      return <u key={idx}>{renderFormattedTextChat(inner)}</u>;
    }
    if (/^<code\b/i.test(part)) {
      const inner = part.replace(/^<code\b[^>]*>|<\/code>$/gi, '');
      return <code key={idx} style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.85em' }}>{inner}</code>;
    }
    if (/^<ul\b/i.test(part)) {
      const inner = part.replace(/^<ul\b[^>]*>|<\/ul>$/gi, '').trim();
      return <ul key={idx} style={{ margin: '0.2rem 0', paddingLeft: '1rem', listStyleType: 'disc' }}>{renderFormattedTextChat(inner, 'ul')}</ul>;
    }
    if (/^<ol\b/i.test(part)) {
      const inner = part.replace(/^<ol\b[^>]*>|<\/ol>$/gi, '').trim();
      return <ol key={idx} style={{ margin: '0.2rem 0', paddingLeft: '1rem', listStyleType: 'decimal' }}>{renderFormattedTextChat(inner, 'ol')}</ol>;
    }
    if (/^<li\b/i.test(part)) {
      const inner = part.replace(/^<li\b[^>]*>|<\/li>$/gi, '').trim();
      const currentNumber = liCounter++;
      const marker = listType === 'ol' ? `${currentNumber}.` : '•';
      return (
        <li key={idx} style={{ 
          marginBottom: '0.2rem', 
          display: 'flex', 
          alignItems: 'flex-start',
          gap: '0.4rem',
          lineHeight: '1.4'
        }}>
          <span style={{ opacity: 0.7, flexShrink: 0, minWidth: listType === 'ol' ? '1rem' : 'auto' }}>{marker}</span>
          <div style={{ flex: 1 }}>{renderFormattedTextChat(inner)}</div>
        </li>
      );
    }
    return part;
  }).filter(Boolean) as React.ReactNode[];
}
