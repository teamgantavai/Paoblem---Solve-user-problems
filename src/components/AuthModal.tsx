'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

// Inline CheckIcon definition to prevent missing file imports
const CheckIcon = () => (
  <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
  </svg>
);

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
  initialStep?: AuthStep;
}

type AuthStep =
  | 'email'
  | 'password_login'
  | 'password_signup'
  | 'name'
  | 'verification_sent'
  | 'forgot_password'
  | 'forgot_sent'
  | 'success';

export default function AuthModal({ isOpen, onClose, onAuthenticated, initialStep }: AuthModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>(initialStep || 'email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Reset state when modal closes
  const resetState = useCallback(() => {
    setStep('email');
    setEmail('');
    setPassword('');
    setFullName('');
    setError(null);
    setLoading(false);
    setShowPassword(false);
  }, []);

  const handleClose = () => {
    onClose();
    setTimeout(resetState, 300);
  };

  useEffect(() => {
    if (isOpen && initialStep) {
      setStep(initialStep);
    }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  // ─── Step 1: Submit email ───
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setError(null);
    setLoading(true);

    try {
      // 1. Try checking if email exists using public.check_email_exists RPC
      const { data: exists, error: rpcError } = await supabase.rpc('check_email_exists', {
        email_to_check: email.trim().toLowerCase(),
      });

      if (!rpcError && typeof exists === 'boolean') {
        if (exists) {
          setStep('password_login');
        } else {
          setStep('password_signup');
        }
        setLoading(false);
        return;
      }

      // 2. Fallback: Try signing in with a dummy password to check if user exists
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: '__check_user_exists__',
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
          setStep('password_login');
        } else if (msg.includes('email not confirmed')) {
          setStep('verification_sent');
        } else {
          setStep('password_login');
        }
      } else {
        setStep('password_login');
      }
    } catch {
      setStep('password_login');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Submit password (login attempt) ───
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
          setError('No account found with these credentials. Creating a new account...');
          setTimeout(() => {
            setError(null);
            setStep('password_signup');
          }, 1500);
        } else if (msg.includes('email not confirmed')) {
          await supabase.auth.resend({ type: 'signup', email });
          setStep('verification_sent');
        } else {
          setError(signInError.message);
        }
      } else if (data.user) {
        if (onAuthenticated) onAuthenticated();
        handleClose();
        router.push('/profile');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2b: Submit password (signup) ───
  const handlePasswordSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError(null);
    setStep('name');
  };

  // ─── Step 3: Submit name ───
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your name');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setError('This email is already registered. Try logging in instead.');
          setTimeout(() => {
            setError(null);
            setStep('password_login');
          }, 2000);
        } else {
          setError(signUpError.message);
        }
      } else if (data.user) {
        if (data.user.identities && data.user.identities.length === 0) {
          setError('This email is already registered. Try logging in instead.');
          setTimeout(() => {
            setError(null);
            setStep('password_login');
          }, 2000);
        } else {
          setStep('verification_sent');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Demo Account Login Logic ───
  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    const demoEmail = 'demo@paoblem.com';
    const demoPassword = 'demopassword123';

    try {
      // 1. Attempt Sign In
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        // 2. If user doesn't exist, create the demo account dynamically
        if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
          setError('Initializing demo account...');
          const { error: signUpError } = await supabase.auth.signUp({
            email: demoEmail,
            password: demoPassword,
            options: {
              data: {
                full_name: 'Demo Innovator',
                role: 'Innovator',
              },
            },
          });

          if (signUpError) {
            throw new Error(signUpError.message);
          }

          // Retry login
          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
            email: demoEmail,
            password: demoPassword,
          });

          if (retryError) {
            throw new Error('Demo created but email confirmation is active in Supabase. Please check your Supabase configurations.');
          } else if (retryData.user) {
            if (onAuthenticated) onAuthenticated();
            setStep('success');
            setTimeout(() => { handleClose(); router.push('/profile'); }, 800);
          }
        } else {
          throw new Error(signInError.message);
        }
      } else if (data.user) {
        if (onAuthenticated) onAuthenticated();
        setStep('success');
        setTimeout(() => { handleClose(); router.push('/profile'); }, 800);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to authenticate with demo account');
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend Verification Link ───
  const handleResendVerificationLink = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) {
        setError(resendError.message);
      } else {
        setError('✓ A new verification link has been sent to your email');
        setTimeout(() => setError(null), 3000);
      }
    } catch {
      setError('Failed to resend verification link.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Google OAuth ───
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch {
      setError('Failed to connect to Google. Please try again.');
      setLoading(false);
    }
  };

  // ─── Forgot Password ───
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`,
      });
      if (resetError) {
        setError(resetError.message);
      } else {
        setStep('forgot_sent');
      }
    } catch {
      setError('Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    if (onAuthenticated) onAuthenticated();
    handleClose();
  };

  // Google SVG Icon
  const GoogleIcon = () => (
    <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );

  // Back button for sub-steps
  const BackButton = ({ to }: { to: AuthStep }) => (
    <button
      type="button"
      onClick={() => { setError(null); setStep(to); }}
      className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4 cursor-pointer"
      style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', marginBottom: '1rem' }}
    >
      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" onClick={handleClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}></div>
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-[420px] w-full z-10 animate-fade-in relative text-left" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '2rem', maxWidth: '420px', width: '100%', zIndex: 10, position: 'relative', textAlign: 'left', color: 'var(--text-main)' }}>
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-all cursor-pointer"
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ═══════════════════════════════════════ */}
        {/* Step: Email Entry                       */}
        {/* ═══════════════════════════════════════ */}
        {step === 'email' && (
          <div className="space-y-5" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="text-center pt-2 pb-1" style={{ textAlign: 'center' }}>
              <h3 className="text-2xl font-black text-neutral-900" style={{ fontSize: '1.5rem', fontWeight: 900 }}>Log in or sign up</h3>
              <p className="text-neutral-500 text-sm mt-2 leading-relaxed" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Join the community of founders validating startup ideas.
              </p>
            </div>

            {/* Google Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 rounded-2xl text-sm font-semibold text-neutral-800 transition-all cursor-pointer disabled:opacity-50"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Demo Account Access Button */}
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '16px',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: '#818cf8',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M11 3.055A9.003 9.003 0 1020.95 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              Quick Demo Login
            </button>

            {/* Divider */}
            <div className="relative" style={{ position: 'relative', margin: '0.5rem 0' }}>
              <div className="absolute inset-0 flex items-center" style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid var(--border-color)' }}></div>
              <div className="relative flex justify-center text-xs" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <span className="bg-white px-4 text-neutral-400 uppercase tracking-wider font-medium" style={{ backgroundColor: 'var(--bg-card)', padding: '0 0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>or</span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-white border border-neutral-200 hover:border-neutral-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl px-4 py-3.5 text-sm outline-none transition-all placeholder:text-neutral-400"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--search-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '0.85rem 1rem',
                  fontSize: '0.88rem',
                  color: 'var(--text-main)',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 text-white hover:bg-neutral-800 font-semibold py-3.5 rounded-2xl text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontWeight: 600,
                  padding: '0.85rem',
                  borderRadius: '16px',
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </form>

            {error && (
              <p className="text-red-500 text-xs text-center font-medium" style={{ color: '#ef4444', fontSize: '0.78rem', textAlign: 'center' }}>{error}</p>
            )}

            <p className="text-[11px] text-neutral-400 text-center leading-relaxed" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
              By continuing, you agree to our{' '}
              <a href="#" className="underline hover:text-neutral-600" style={{ textDecoration: 'underline' }}>Terms</a> and{' '}
              <a href="#" className="underline hover:text-neutral-600" style={{ textDecoration: 'underline' }}>Privacy Policy</a>.
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step: Password Login                    */}
        {/* ═══════════════════════════════════════ */}
        {step === 'password_login' && (
          <div className="space-y-5" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <BackButton to="email" />
            <div className="pt-1">
              <h3 className="text-2xl font-black text-neutral-900" style={{ fontSize: '1.35rem', fontWeight: 900 }}>Enter your password</h3>
              <p className="text-neutral-500 text-sm mt-2" style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                <span className="font-medium text-neutral-700" style={{ color: 'var(--text-main)', fontWeight: 500 }}>{email}</span>
              </p>
            </div>

            <form onSubmit={handlePasswordLogin} className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="relative" style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  minLength={6}
                  className="w-full bg-white border border-neutral-200 hover:border-neutral-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl px-4 py-3.5 text-sm outline-none transition-all placeholder:text-neutral-400 pr-12"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--search-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '0.85rem 3rem 0.85rem 1rem',
                    fontSize: '0.88rem',
                    color: 'var(--text-main)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer p-1"
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 text-white hover:bg-neutral-800 font-semibold py-3.5 rounded-2xl text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontWeight: 600,
                  padding: '0.85rem',
                  borderRadius: '16px',
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {loading ? 'Signing in...' : 'Log in'}
              </button>
            </form>

            {error && (
              <p className="text-xs text-center font-medium" style={{ fontSize: '0.78rem', color: '#ef4444', textAlign: 'center' }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => { setError(null); setStep('forgot_password'); }}
              className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors cursor-pointer text-center"
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step: Password Signup                   */}
        {/* ═══════════════════════════════════════ */}
        {step === 'password_signup' && (
          <div className="space-y-5" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <BackButton to="email" />
            <div className="pt-1">
              <h3 className="text-2xl font-black text-neutral-900" style={{ fontSize: '1.35rem', fontWeight: 900 }}>Create a password</h3>
              <p className="text-neutral-500 text-sm mt-2" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Setting up your account for <span className="font-medium text-neutral-700" style={{ color: 'var(--text-main)', fontWeight: 500 }}>{email}</span>
              </p>
            </div>

            <form onSubmit={handlePasswordSignup} className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="relative" style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password (min 6 characters)"
                  minLength={6}
                  className="w-full bg-white border border-neutral-200 hover:border-neutral-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl px-4 py-3.5 text-sm outline-none transition-all placeholder:text-neutral-400 pr-12"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--search-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '0.85rem 3rem 0.85rem 1rem',
                    fontSize: '0.88rem',
                    color: 'var(--text-main)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer p-1"
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 text-white hover:bg-neutral-800 font-semibold py-3.5 rounded-2xl text-sm transition-all cursor-pointer disabled:opacity-50"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontWeight: 600,
                  padding: '0.85rem',
                  borderRadius: '16px',
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>
            </form>

            {error && (
              <p className="text-red-500 text-xs text-center font-medium" style={{ color: '#ef4444', fontSize: '0.78rem', textAlign: 'center' }}>{error}</p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step: Name                              */}
        {/* ═══════════════════════════════════════ */}
        {step === 'name' && (
          <div className="space-y-5" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <BackButton to="password_signup" />
            <div className="pt-1">
              <h3 className="text-2xl font-black text-neutral-900" style={{ fontSize: '1.35rem', fontWeight: 900 }}>What's your name?</h3>
              <p className="text-neutral-500 text-sm mt-2" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                This helps us personalize your experience.
              </p>
            </div>

            <form onSubmit={handleNameSubmit} className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-white border border-neutral-200 hover:border-neutral-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl px-4 py-3.5 text-sm outline-none transition-all placeholder:text-neutral-400"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--search-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '0.85rem 1rem',
                  fontSize: '0.88rem',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
                autoFocus
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 text-white hover:bg-neutral-800 font-semibold py-3.5 rounded-2xl text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontWeight: 600,
                  padding: '0.85rem',
                  borderRadius: '16px',
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {loading ? 'Creating account...' : 'Continue'}
              </button>
            </form>

            {error && (
              <p className="text-red-500 text-xs text-center font-medium" style={{ color: '#ef4444', fontSize: '0.78rem', textAlign: 'center' }}>{error}</p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step: Verification Sent (Check Email)   */}
        {/* ═══════════════════════════════════════ */}
        {step === 'verification_sent' && (
          <div className="space-y-6 py-4 text-center" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', alignItems: 'center' }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm animate-pulse mb-2" style={{ display: 'flex', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
              <svg style={{ width: '32px', height: '32px', color: '#818cf8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5m0 0l-2.25-1.5a2 2 0 00-2.5 0l-2.25 1.5m7 5H9" />
              </svg>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-neutral-900" style={{ fontSize: '1.35rem', fontWeight: 900 }}>Verify your email</h3>
              <p className="text-neutral-500 text-sm leading-relaxed px-2" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                We sent a verification link to <span className="font-semibold text-neutral-800" style={{ color: 'var(--text-main)', fontWeight: 600 }}>{email}</span>. Click the link in the email to activate your account.
              </p>
            </div>

            <div className="space-y-3 pt-2" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-3.5 rounded-2xl text-sm transition-all cursor-pointer shadow-md"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontWeight: 600,
                  padding: '0.85rem',
                  borderRadius: '16px',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  textDecoration: 'none',
                }}
              >
                Open Gmail
              </a>

              <button
                type="button"
                onClick={handleResendVerificationLink}
                disabled={loading}
                className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-3.5 rounded-2xl text-sm transition-all cursor-pointer disabled:opacity-50"
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  padding: '0.85rem',
                  borderRadius: '16px',
                  fontSize: '0.88rem',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
              >
                {loading ? 'Sending...' : 'Resend verification link'}
              </button>
            </div>

            {error && (
              <p className="text-xs font-medium text-center" style={{ fontSize: '0.78rem', color: error.startsWith('✓') ? '#22c55e' : '#ef4444' }}>
                {error}
              </p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step: Forgot Password                   */}
        {/* ═══════════════════════════════════════ */}
        {step === 'forgot_password' && (
          <div className="space-y-5" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <BackButton to="password_login" />
            <div className="pt-1">
              <h3 className="text-2xl font-black text-neutral-900" style={{ fontSize: '1.35rem', fontWeight: 900 }}>Reset your password</h3>
              <p className="text-neutral-500 text-sm mt-2" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                We'll send a password reset link to your email.
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-white border border-neutral-200 hover:border-neutral-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl px-4 py-3.5 text-sm outline-none transition-all placeholder:text-neutral-400"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--search-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '0.85rem 1rem',
                  fontSize: '0.88rem',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 text-white hover:bg-neutral-800 font-semibold py-3.5 rounded-2xl text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontWeight: 600,
                  padding: '0.85rem',
                  borderRadius: '16px',
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            {error && (
              <p className="text-red-500 text-xs text-center font-medium" style={{ color: '#ef4444', fontSize: '0.78rem', textAlign: 'center' }}>{error}</p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step: Forgot Password Sent              */}
        {/* ═══════════════════════════════════════ */}
        {step === 'forgot_sent' && (
          <div className="text-center py-6 space-y-4" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm" style={{ display: 'flex', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
              <svg style={{ width: '32px', height: '32px', color: '#818cf8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5m0 0l-2.25-1.5a2 2 0 00-2.5 0l-2.25 1.5m7 5H9" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-neutral-900" style={{ fontSize: '1.35rem', fontWeight: 900 }}>Check your email</h3>
              <p className="text-neutral-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                We've sent a password reset link to <span className="font-medium text-neutral-700" style={{ color: 'var(--text-main)' }}>{email}</span>. Please check your inbox.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 px-6 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-2xl text-sm transition-all cursor-pointer"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'var(--text-main)',
                fontWeight: 600,
                padding: '0.65rem 1.5rem',
                borderRadius: '12px',
                fontSize: '0.82rem',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* Step: Success                           */}
        {/* ═══════════════════════════════════════ */}
        {step === 'success' && (
          <div className="text-center py-6 space-y-4" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 border border-emerald-100 shadow-sm animate-bounce" style={{ display: 'flex', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
              <CheckIcon />
            </div>
            <div>
              <h3 className="text-2xl font-black text-neutral-900 animate-slide-up" style={{ fontSize: '1.35rem', fontWeight: 900 }}>Welcome aboard!</h3>
              <p className="text-neutral-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Your account is set up and your intent has been verified. Welcome to Paoblem!
              </p>
            </div>
            <button
              type="button"
              onClick={handleSuccessClose}
              className="mt-4 px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-2xl text-sm transition-all cursor-pointer"
              style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                fontWeight: 600,
                padding: '0.65rem 1.5rem',
                borderRadius: '12px',
                fontSize: '0.82rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Get started
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
