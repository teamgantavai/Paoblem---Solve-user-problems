'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import { Bell, Loader2, CheckCircle2, ChevronLeft } from 'lucide-react';

export default function SettingsNotificationsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [prefReceiveSaves, setPrefReceiveSaves] = useState(true);
  const [prefReceiveAnalytics, setPrefReceiveAnalytics] = useState(true);
  const [prefReceiveSolutions, setPrefReceiveSolutions] = useState(true);
  const [prefReceiveReplies, setPrefReceiveReplies] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoadingSession(false);
      if (s?.user?.id) {
        fetchProfile(s.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoadingSession(false);
      if (s?.user?.id) {
        fetchProfile(s.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const res = await fetch(`/api/profile?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        if (data.profile) {
          setPrefReceiveSaves(data.profile.pref_receive_saves ?? true);
          setPrefReceiveAnalytics(data.profile.pref_receive_analytics ?? true);
          setPrefReceiveSolutions(data.profile.pref_receive_solutions ?? true);
          setPrefReceiveReplies(data.profile.pref_receive_replies ?? true);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleToggle = async (type: string, value: boolean) => {
    if (!session?.access_token) return;
    setSaving(true);
    setSaveStatus('Saving...');

    // Calculate next state
    const nextSaves = type === 'saves' ? value : prefReceiveSaves;
    const nextAnalytics = type === 'analytics' ? value : prefReceiveAnalytics;
    const nextSolutions = type === 'solutions' ? value : prefReceiveSolutions;
    const nextReplies = type === 'replies' ? value : prefReceiveReplies;

    // Update state locally
    if (type === 'saves') setPrefReceiveSaves(value);
    else if (type === 'analytics') setPrefReceiveAnalytics(value);
    else if (type === 'solutions') setPrefReceiveSolutions(value);
    else if (type === 'replies') setPrefReceiveReplies(value);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          pref_receive_saves: nextSaves,
          pref_receive_analytics: nextAnalytics,
          pref_receive_solutions: nextSolutions,
          pref_receive_replies: nextReplies
        })
      });

      if (res.ok) {
        setSaveStatus('All changes saved');
        setTimeout(() => setSaveStatus(null), 2500);
      } else {
        setSaveStatus('Error saving preferences');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('Error saving preferences');
    } finally {
      setSaving(false);
    }
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
            <Bell size={48} style={{ color: 'var(--text-muted)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sign in to manage settings</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>You must be logged in to configure your email and notification preferences.</p>
            <button className="btn btn-primary" onClick={() => router.push('/')}>Go to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        
        <div className="center-feed">
          {/* Back Navigation header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <button 
              onClick={() => router.back()} 
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
              }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Notification Settings
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: 0 }}>
                  Choose which emails and alerts you would like to receive.
                </p>
              </div>
              
              {saveStatus && (
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', 
                  fontSize: '0.78rem', color: saveStatus.includes('Error') ? '#ef4444' : '#22c55e',
                  fontWeight: 600, animation: 'fadeIn 0.2s'
                }}>
                  {saving ? <Loader2 size={12} className="spin" /> : <CheckCircle2 size={14} />}
                  {saveStatus}
                </div>
              )}
            </div>

            {loadingProfile ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                <Loader2 size={24} className="spin" style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                {/* 1. Saves */}
                <div style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' 
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '80%' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Someone saves my post
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Receive in-app alerts and direct emails when a user bookmarks one of your problems.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefReceiveSaves}
                    onChange={(e) => handleToggle('saves', e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      accentColor: 'var(--accent-blue)',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* 2. Analytics */}
                <div style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' 
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '80%' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Post analytics digest
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Receive a bi-daily performance summary email tracking views, upvotes, saves, and comments.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefReceiveAnalytics}
                    onChange={(e) => handleToggle('analytics', e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      accentColor: 'var(--accent-blue)',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* 3. Solutions */}
                <div style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' 
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '80%' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Someone is solving my problem
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Get notified instantly when innovators state they are "building" or have "launched" solutions.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefReceiveSolutions}
                    onChange={(e) => handleToggle('solutions', e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      accentColor: 'var(--accent-blue)',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* 4. Replies */}
                <div style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '80%' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Replies to my comments
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Get batched comment replies delivered to your inbox (aggregated to a maximum of one email per hour).
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefReceiveReplies}
                    onChange={(e) => handleToggle('replies', e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      accentColor: 'var(--accent-blue)',
                      cursor: 'pointer'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <SidebarRight />
      </div>
    </div>
  );
}
