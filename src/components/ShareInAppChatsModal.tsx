'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Check, Loader2, MessageSquare } from 'lucide-react';
import { Post } from '@/lib/types';
import toast from 'react-hot-toast';
import Avatar from './Avatar';

interface ShareInAppChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  session: any;
}

export default function ShareInAppChatsModal({ isOpen, onClose, post, session }: ShareInAppChatsModalProps) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const postUrl = typeof window !== 'undefined'
    ? (post.type === 'startup'
        ? `${window.location.origin}/startups/${post.id}`
        : `${window.location.origin}/post/${post.slug || post.id}`)
    : '';

  // Helpers to clean body description to 2 lines
  const stripHtmlTags = (html: string): string => {
    if (!html) return '';
    let text = html;
    text = text.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '$1');
    text = text.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, '$1');
    text = text.replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, '$1');
    text = text.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, '$1');
    text = text.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, '$1');
    text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '$1');
    text = text.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '');
    text = text.replace(/\*\*/g, '');
    text = text.replace(/\*/g, '');
    text = text.replace(/`/g, '');
    return text.trim();
  };

  const cleanBody = stripHtmlTags(post.body || '');
  const lines = cleanBody.split('\n').map(l => l.trim()).filter(Boolean);
  const descriptionSnippet = lines.slice(0, 2).join('\n') || (cleanBody.slice(0, 120) + (cleanBody.length > 120 ? '...' : ''));
  const shareText = `${post.title}\n\n${descriptionSnippet}\n\n${postUrl}`;

  useEffect(() => {
    if (isOpen && session?.access_token) {
      setLoading(true);
      setErrorMsg(null);
      setSelectedChats([]);
      setSearchQuery('');
      
      fetch('/api/messages', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to load conversations');
          return res.json();
        })
        .then(data => {
          const list = data.conversations || data.messages || [];
          setConversations(list);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setErrorMsg('Failed to load active chats.');
          setLoading(false);
        });
    }
  }, [isOpen, session?.access_token]);

  if (!isOpen) return null;

  const handleToggleSelect = (conversationId: string) => {
    setSelectedChats(prev => 
      prev.includes(conversationId)
        ? prev.filter(id => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  const handleSendBroadcast = async () => {
    if (selectedChats.length === 0 || !session?.access_token) return;

    setSending(true);
    setErrorMsg(null);

    try {
      const promises = selectedChats.map(convId => 
        fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            conversationId: convId,
            body: shareText
          })
        }).then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to send message');
          }
          return res.json();
        })
      );

      await Promise.all(promises);
      toast.success(`Shared successfully with ${selectedChats.length} chat${selectedChats.length > 1 ? 's' : ''}!`);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to share message to one or more chats.');
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const partnerName = (conv.partner?.full_name || '').toLowerCase();
    const partnerUser = (conv.partner?.username || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return partnerName.includes(query) || partnerUser.includes(query);
  });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '460px', 
          width: '92%', 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          padding: '1.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={20} style={{ color: '#7c3aed' }} /> Share in Chats
          </h2>
          <button 
            onClick={onClose} 
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--bg-hover)',
              border: 'none',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search input */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: 'var(--search-bg)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '12px', 
            padding: '0.45rem 0.85rem',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}
        >
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '0.88rem',
            }}
          />
        </div>

        {/* Scrollable list of chats */}
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            minHeight: '150px',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            paddingRight: '0.25rem',
            marginRight: '-0.5rem',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spin" style={{ marginRight: '0.5rem' }} />
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              {searchQuery ? 'No matching conversations.' : 'No active chats found.'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedChats.includes(conv.id);
              const partner = conv.partner || {};
              const partnerName = partner.full_name || partner.username || 'User';
              const partnerSub = partner.username ? `@${partner.username}` : '';

              return (
                <div
                  key={conv.id}
                  onClick={() => handleToggleSelect(conv.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                    border: '1px solid',
                    borderColor: isSelected ? 'rgba(124, 58, 237, 0.24)' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Avatar src={partner.avatar_url} name={partnerName} size={38} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {partnerName}
                      </span>
                      {partnerSub && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {partnerSub}
                        </span>
                      )}
                    </div>
                  </div>

                  <div 
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: '1.5px solid',
                      borderColor: isSelected ? '#7c3aed' : 'var(--border-color)',
                      background: isSelected ? '#7c3aed' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
                  </div>
                </div>
              );
            })
          )}
        </div>



        {/* Footer Errors & Buttons */}
        {errorMsg && (
          <div style={{ margin: '1rem 0 0 0', padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '0.78rem' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            onClick={onClose}
            disabled={sending}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-hover)',
              color: 'var(--text-main)',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => { if (!sending) e.currentTarget.style.backgroundColor = 'var(--border-color)'; }}
            onMouseLeave={(e) => { if (!sending) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleSendBroadcast}
            disabled={selectedChats.length === 0 || sending}
            style={{
              padding: '0.55rem 1.4rem',
              borderRadius: '12px',
              border: 'none',
              background: selectedChats.length === 0 ? 'var(--border-color)' : '#7c3aed',
              color: selectedChats.length === 0 ? 'var(--text-muted)' : '#fff',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: selectedChats.length === 0 || sending ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedChats.length > 0 && !sending) e.currentTarget.style.backgroundColor = '#6d28d9';
            }}
            onMouseLeave={(e) => {
              if (selectedChats.length > 0 && !sending) e.currentTarget.style.backgroundColor = '#7c3aed';
            }}
          >
            {sending ? (
              <>
                <Loader2 size={14} className="spin" /> Sending...
              </>
            ) : (
              `Send${selectedChats.length > 0 ? ` (${selectedChats.length})` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
