import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import Feed from '@/components/Feed';
import SidebarRight from '@/components/SidebarRight';

export default function SolutionsPage() {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        {/* Pass filter=idea to display only solutions */}
        <Feed defaultFilter="idea" />
        <SidebarRight />
      </div>
    </div>
  );
}
