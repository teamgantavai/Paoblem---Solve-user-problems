import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import Feed from '@/components/Feed';
import SidebarRight from '@/components/SidebarRight';

export default function Home() {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        <Feed />
        <SidebarRight />
      </div>
    </div>
  );
}
