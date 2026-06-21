import React from 'react';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';

export const metadata = {
  title: 'Cookie Policy | Paoblem',
  description: 'Understand how Paoblem uses cookies and tracking technologies.',
};

export default function CookiePolicy() {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        
        <main className="center-feed" style={{ maxWidth: '780px' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              Cookie Policy
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Last Updated: June 21, 2026
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-body)' }}>
              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  1. What Are Cookies?
                </h2>
                <p>
                  Cookies are small text files stored on your device by your web browser when you visit a website. They help the website recognize your device, remember preferences, and keep you signed in.
                </p>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  2. How We Use Cookies
                </h2>
                <p>
                  We use cookies for the following purposes:
                </p>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li><strong>Essential Cookies:</strong> Used for authentication (Supabase session tokens) to keep you logged into your account. Without these, the site cannot authenticate you.</li>
                  <li><strong>Preference Cookies:</strong> Used to remember your selected interface theme (e.g. Light or Dark theme).</li>
                  <li><strong>Analytics Cookies:</strong> Used to track page views, dwell times, and query statistics to help us measure and optimize platform performance.</li>
                </ul>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  3. Managing Cookies
                </h2>
                <p>
                  Most browsers allow you to manage cookies through their settings menu. You can block or delete cookies, but doing so will prevent you from signing in to Paoblem. Refer to your browser's documentation to manage cookie settings.
                </p>
              </section>
            </div>
          </div>
        </main>

        <SidebarRight />
      </div>
    </div>
  );
}
