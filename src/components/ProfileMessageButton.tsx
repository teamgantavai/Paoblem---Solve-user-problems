'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ProfileMessageButtonProps {
  profileId: string;
}

export default function ProfileMessageButton({ profileId }: ProfileMessageButtonProps) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
      } else {
        setCurrentUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Don't show the button if there's no user logged in, or if the user is viewing their own profile
  if (!currentUserId || currentUserId === profileId) {
    return null;
  }

  return (
    <button
      onClick={() => router.push(`/chats?userId=${profileId}`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.8rem',
        backgroundColor: 'var(--accent-blue)',
        color: '#fff',
        borderRadius: '12px',
        fontWeight: 600,
        fontSize: '0.82rem',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.opacity = '0.9';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <MessageCircle size={15} />
      Message
    </button>
  );
}
