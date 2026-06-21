import React from 'react';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';

export const metadata = {
  title: 'Terms & Conditions | Paoblem',
  description: 'Understand the terms of service, guidelines, and rules for using Paoblem.',
};

export default function TermsAndConditions() {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        
        <main className="center-feed" style={{ maxWidth: '780px' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              Terms & Conditions
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Last Updated: June 21, 2026
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-body)' }}>
              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  1. Acceptance of Terms
                </h2>
                <p>
                  By registering an account or accessing the website, you agree to comply with and be bound by these Terms & Conditions. If you do not agree, you must not use or access our services.
                </p>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  2. User Accounts & Security
                </h2>
                <p>
                  You are responsible for keeping your login credentials confidential and for all actions that occur under your account. You agree to provide accurate, current, and complete profile information at all times.
                </p>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  3. Code of Conduct & Content
                </h2>
                <p>
                  Paoblem encourages open collaboration, feedback, and solution building. However, you agree not to post content that:
                </p>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li>Is unlawful, abusive, harassing, defamatory, or deceptive.</li>
                  <li>Infringes on any intellectual property or proprietary rights of others.</li>
                  <li>Contains malicious scripts, malware, or spam links.</li>
                </ul>
                <p style={{ marginTop: '0.5rem' }}>
                  We reserve the right to remove any post, solution, or comment that violates these guidelines, or to suspend accounts.
                </p>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  4. Intellectual Property
                </h2>
                <p>
                  You retain ownership of the original text, ideas, and solutions you submit to Paoblem. However, by posting content to the platform, you grant us a worldwide, non-exclusive, royalty-free license to display, distribute, and reproduce that content in connection with providing and promoting our services.
                </p>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  5. Disclaimer of Warranties
                </h2>
                <p>
                  Our services are provided "as is" and "as available" without any warranties of any kind, express or implied. We do not guarantee that the site will always be secure, error-free, or uninterrupted.
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
