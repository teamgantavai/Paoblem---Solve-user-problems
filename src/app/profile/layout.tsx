import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'My Profile – Paoblem',
  description: 'View and edit your Paoblem profile, problems and ideas.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content profile-main-wrapper" style={{ justifyContent: 'center' }}>
        <div className="profile-inner-wrapper">
          {children}
        </div>
      </div>
    </div>
  );
}
