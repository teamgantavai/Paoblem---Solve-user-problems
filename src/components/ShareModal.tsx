'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Link2, Download, Share2, Check } from 'lucide-react';
import { Post } from '@/lib/types';
import { trackEvent } from '@/lib/analytics-track';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  session: any;
}

export default function ShareModal({ isOpen, onClose, post, session }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [svgUrl, setSvgUrl] = useState('');
  const [showImageCard, setShowImageCard] = useState(false);

  const postUrl = typeof window !== 'undefined'
    ? (post.type === 'startup'
        ? `${window.location.origin}/startups/${post.id}`
        : `${window.location.origin}/post/${post.slug || post.id}`)
    : '';

  useEffect(() => {
    if (isOpen) {
      setSvgUrl(`/api/og?postId=${post.id}&t=${Date.now()}`);
      setCopied(false);
      setErrorMsg(null);
      setShowImageCard(false);
    }
  }, [isOpen, post.id]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent(post.id, 'POST_SHARE', session?.access_token, { method: 'copy_link' });
      fetch('/api/posts/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, counter: 'shares', delta: 1 }),
      }).catch(() => { });
    } catch (err) {
      setErrorMsg('Failed to copy link to clipboard');
    }
  };

  const getShareLink = (platform: 'whatsapp' | 'telegram' | 'twitter' | 'instagram' | 'facebook') => {
    const title = post.title;
    const text = `${title} - Shared via Paoblem`;

    switch (platform) {
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + postUrl)}`;
      case 'telegram':
        return `https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(text)}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
      case 'instagram':
        // Instagram doesn't support direct link sharing, redirect to their profile or web page
        return `https://www.instagram.com/`;
      default:
        return '';
    }
  };

  const trackShareEvent = (platform: string) => {
    trackEvent(post.id, 'POST_SHARE', session?.access_token, { method: 'social', platform });
    fetch('/api/posts/quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, counter: 'shares', delta: 1 }),
    }).catch(() => { });
  };

  // Canvas card generation helper
  const drawImageToCanvas = (): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error('Canvas not found'));
        return;
      }

      setCanvasLoading(true);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setCanvasLoading(false);
        reject(new Error('Could not get 2D context'));
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = svgUrl;

      img.onload = () => {
        canvas.width = 800;
        canvas.height = 800;
        ctx.clearRect(0, 0, 800, 800);
        ctx.drawImage(img, 0, 0, 800, 800);
        setCanvasLoading(false);
        resolve(canvas);
      };

      img.onerror = () => {
        setCanvasLoading(false);
        reject(new Error('Failed to load card image'));
      };
    });
  };

  const handleDownloadImage = async () => {
    try {
      setErrorMsg(null);
      const canvas = await drawImageToCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${post.slug || 'post'}-card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      trackShareEvent('download_image');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to download card');
    }
  };

  const handleShareImageNative = async () => {
    try {
      setErrorMsg(null);
      if (!navigator.share || !navigator.canShare) {
        setErrorMsg('Web Share is not supported on this browser/device');
        return;
      }

      const canvas = await drawImageToCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setErrorMsg('Failed to create image blob');
          return;
        }

        const file = new File([blob], `${post.slug || 'post'}-card.png`, { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: post.title,
            text: post.type === 'startup' ? 'Check out this startup on Paoblem!' : 'Check out this problem on Paoblem!',
          });
          trackShareEvent('share_image_native');
        } else {
          setErrorMsg('Sharing this file format is not allowed by your browser');
        }
      }, 'image/png');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to share image');
    }
  };

  const socials = [
    {
      name: 'Facebook',
      key: 'facebook' as const,
      color: '#1877F2',
      bgHover: 'rgba(24, 119, 242, 0.08)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      )
    },
    {
      name: 'X',
      key: 'twitter' as const,
      color: 'var(--text-main, #ffffff)',
      bgHover: 'var(--bg-hover, rgba(255, 255, 255, 0.08))',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      )
    },
    {
      name: 'Instagram',
      key: 'instagram' as const,
      color: '#E1306C',
      bgHover: 'rgba(225, 48, 108, 0.08)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
      )
    },
    {
      name: 'WhatsApp',
      key: 'whatsapp' as const,
      color: '#25D366',
      bgHover: 'rgba(37, 211, 102, 0.08)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      )
    },
    {
      name: 'Telegram',
      key: 'telegram' as const,
      color: '#0088cc',
      bgHover: 'rgba(0, 136, 204, 0.08)',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-.962 4.084-1.362 5.767-.168.714-.42 1.012-.662 1.034-.528.047-.927-.35-1.439-.684-.8-.523-1.252-.849-2.031-1.359-.9-.59-.317-.914.196-1.445.134-.139 2.47-2.257 2.516-2.453.006-.025.01-.118-.046-.168-.056-.05-.138-.033-.197-.02-.085.019-1.44.912-4.062 2.684-.384.263-.732.392-1.043.385-.343-.007-1.004-.194-1.495-.353-.603-.196-1.082-.3-1.04-.633.021-.173.262-.35.721-.53 2.822-1.229 4.704-2.04 5.647-2.433 2.68-.112 3.239-.131 3.599-.131.08 0 .257.02.371.113.096.079.123.187.129.27.006.075.009.214.004.354z" />
        </svg>
      )
    }
  ];

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
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Share
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
              transition: 'background-color 0.2s, transform 0.1s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border-color)', margin: '0 -1.75rem 1.5rem -1.75rem' }} />

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section A: Share via socials */}
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-main)', margin: '0 0 1rem 0' }}>
              Share this link via
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              {socials.map((social) => (
                <a
                  key={social.key}
                  href={getShareLink(social.key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackShareEvent(social.key)}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: social.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = social.color;
                    e.currentTarget.style.backgroundColor = social.bgHover;
                    e.currentTarget.style.transform = 'scale(1.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title={`Share on ${social.name}`}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Section B: Copy Link Input Group */}
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-main)', margin: '0 0 0.85rem 0' }}>
              Or copy link
            </h4>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--search-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.3rem 0.3rem 0.3rem 0.85rem',
                gap: '0.5rem',
                transition: 'border-color 0.2s'
              }}
            >
              <Link2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

              <input
                type="text"
                readOnly
                value={postUrl}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  padding: '0.4rem 0',
                  width: '100%',
                }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />

              <button
                onClick={handleCopyLink}
                style={{
                  background: copied ? 'var(--accent-success, #22c55e)' : 'var(--accent-primary, #7c3aed)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.55rem 1.3rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Collapsible/Elegant Extra: Download Image Card */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
            <button
              onClick={() => setShowImageCard(!showImageCard)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: 0,
                outline: 'none',
                width: 'auto'
              }}
            >
              <span style={{
                fontSize: '0.65rem',
                transform: showImageCard ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                display: 'inline-block'
              }}>▶</span> Share as Image Card
            </button>

            {showImageCard && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                {/* Image Preview */}
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: '#0d0e12',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                    flexShrink: 0
                  }}
                >
                  {svgUrl && (
                    <img
                      src={svgUrl}
                      alt="Card Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  )}
                </div>

                {/* Actions & Description */}
                <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                    Generate a styled post card with the problem title, description, and stats. Perfect for social media stories.
                  </p>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={handleDownloadImage}
                      disabled={canvasLoading}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem 0.6rem',
                        borderRadius: '8px',
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-color)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                    >
                      <Download size={12} /> {canvasLoading ? 'Wait...' : 'PNG'}
                    </button>

                    <button
                      onClick={handleShareImageNative}
                      disabled={canvasLoading}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem 0.6rem',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <Share2 size={12} /> Share
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '0.78rem' }}>
              ⚠️ {errorMsg}
            </div>
          )}

        </div>

        {/* Hidden canvas used for rendering SVG to PNG */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
