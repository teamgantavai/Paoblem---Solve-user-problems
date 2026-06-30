'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

type InviteData = {
  invite: {
    id: string;
    group_id: string;
    invited_by: string;
    status: string;
    expires_at: string | null;
  };
  group: {
    id: string;
    name: string;
    description: string | null;
    avatar_url: string | null;
    privacy: string;
    member_count: number;
  };
  invited_by_profile: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

function InvitePageContent() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const [session, setSession] = useState<any>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const { data, isLoading, error } = useQuery<InviteData>({
    queryKey: ['group-invite', code],
    queryFn: async () => {
      const res = await fetch(`/api/groups/invite/${code}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Invalid invite link');
      return res.json();
    },
    enabled: !!code,
    retry: false,
  });

  const handleJoin = async () => {
    if (!session) {
      toast.error('Please sign in to join the group.');
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/groups/invite/${code}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to join group');
      toast.success('Successfully joined the group!');
      router.replace(`/chats?groupId=${resData.groupId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="group-invite-page">
        <Loader2 className="spin" size={32} style={{ color: 'var(--accent-primary)', animation: 'spinAnim 0.8s linear infinite' }} />
        <style jsx global>{`
          @keyframes spinAnim {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="group-invite-page">
        <div className="group-invite-card">
          <AlertCircle size={48} style={{ color: 'var(--accent-danger)', marginBottom: '1rem' }} />
          <h1>Invite Link Error</h1>
          <p>{error instanceof Error ? error.message : 'This invite link is invalid or has expired.'}</p>
          <button className="group-btn-secondary" onClick={() => router.replace('/chats')}>
            Go to Chats
          </button>
        </div>
      </div>
    );
  }

  const { group, invited_by_profile } = data;

  return (
    <div className="group-invite-page">
      <div className="group-invite-card">
        <div className="group-invite-card-avatar">
          {group.avatar_url ? (
            <img src={group.avatar_url} alt={group.name} style={{ width: '100%', height: '100%', borderRadius: 20, objectFit: 'cover' }} />
          ) : (
            group.name[0].toUpperCase()
          )}
        </div>
        <h1>Join "{group.name}"</h1>
        <p style={{ margin: '0.5rem 0 1.5rem', color: 'var(--text-muted)' }}>
          @{invited_by_profile?.username || 'user'} invited you to join this {group.privacy} group chat.
        </p>
        {group.description && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '1rem', marginBottom: '1.5rem', fontSize: '0.88rem', color: 'var(--text-body)', textAlign: 'left', border: '1px solid var(--border-color)' }}>
            {group.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          <Users size={16} />
          <span>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
        </div>
        <button className="group-btn-primary" onClick={handleJoin} disabled={joining}>
          {joining ? <Loader2 className="spin" size={16} style={{ animation: 'spinAnim 0.8s linear infinite' }} /> : null}
          {joining ? 'Joining...' : 'Accept Invite'}
        </button>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="group-invite-page"><Loader2 className="spin" size={32} style={{ animation: 'spinAnim 0.8s linear infinite' }} /></div>}>
      <InvitePageContent />
    </Suspense>
  );
}
