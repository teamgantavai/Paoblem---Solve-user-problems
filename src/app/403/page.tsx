import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function AccessDenied() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '24px',
        padding: '3rem',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <ShieldAlert size={64} color="#ef4444" style={{ marginBottom: '1.5rem', filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.3))' }} />
        
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 900,
          margin: '0 0 0.5rem 0',
          letterSpacing: '-0.025em',
        }}>
          403 Access Denied
        </h1>
        
        <p style={{
          color: '#a3a3a3',
          fontSize: '0.95rem',
          lineHeight: '1.6',
          margin: '0 0 2rem 0',
        }}>
          This administrative dashboard is private and strictly restricted. Only the administrator account associated with <strong style={{ color: '#ffffff' }}>official.diljha@gmail.com</strong> can access these resources.
        </p>

        <Link href="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '0.85rem 1.75rem',
          borderRadius: '16px',
          fontWeight: 600,
          fontSize: '0.9rem',
          textDecoration: 'none',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          border: 'none',
        }}>
          <ArrowLeft size={16} />
          Back to Homepage
        </Link>
      </div>
    </div>
  );
}
