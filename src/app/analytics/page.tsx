import Navbar from '@/components/Navbar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

// Force hot-module-reload route recompile
export default function AnalyticsPage() {
  return (
    <div className="app-container">
      <Navbar />
      <div className="main-content">
        <SidebarLeft />
        <main className="analytics-page-main">
          <AnalyticsDashboard />
        </main>
        <SidebarRight />
      </div>
    </div>
  );
}
