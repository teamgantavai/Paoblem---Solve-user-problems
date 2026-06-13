import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'My Profile – Paoblem',
  description: 'View and edit your Paoblem profile, problems and ideas.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content" style={{ justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '860px', padding: '1.5rem 1rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
