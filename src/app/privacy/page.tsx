import React from 'react';
import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';

export const metadata = {
  title: 'Privacy Policy | Paoblem',
  description: 'Learn how Paoblem handles, collects, and protects your personal data.',
};

export default function PrivacyPolicy() {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        
        <main className="center-feed" style={{ maxWidth: '780px' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              Privacy Policy
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Last Updated: June 21, 2026
            </p>

            <div className="legal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-body)' }}>
              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  1. Information We Collect
                </h2>
                <p>
                  At Paoblem, we collect information to provide a better experience for our community. This includes:
                </p>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li><strong>Account Information:</strong> When you register, we collect your email address, username, profile picture, and bio details.</li>
                  <li><strong>Content and Activity:</strong> We store posts (problems, ideas), solutions, comments, votes, and follows created or performed by you on the platform.</li>
                  <li><strong>Usage Data:</strong> We automatically log interactions, device attributes, and page dwell times to analyze platform performance.</li>
                </ul>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  2. How We Use Information
                </h2>
                <p>
                  We use the collected information for the following core purposes:
                </p>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li>To verify and authenticate your account.</li>
                  <li>To show your posts, solutions, comments, and profile to other users on the service.</li>
                  <li>To power analytics metrics (like view counts and demographic distributions) for authors.</li>
                  <li>To debug, maintain, and secure the platform.</li>
                </ul>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  3. Sharing and Disclosures
                </h2>
                <p>
                  Paoblem is a public platform. When you create problems, ideas, or solutions, they are visible to anyone. We do not sell your personal data. We may share data with service providers (like Supabase for database hosting or Vercel for hosting) under strict privacy protection terms.
                </p>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  4. Your Rights and Controls
                </h2>
                <p>
                  You are in control of your data. Through your Settings, you can edit your profile details, change your role, or choose to delete specific content you have created. To permanently delete your account, please reach out to our support team.
                </p>
              </section>

              <hr style={{ borderColor: 'var(--border-color)', margin: '0.5rem 0' }} />

              <section>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  5. Contact Us
                </h2>
                <p>
                  If you have any questions or concerns regarding this Privacy Policy, please send an email to <a href="mailto:support@paoblem.com" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>support@paoblem.com</a>.
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
