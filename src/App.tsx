import { useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer.tsx';
import { Navbar } from './components/Navbar.tsx';
import { AboutContactPage } from './pages/AboutContactPage.tsx';
import { AdminPortalPage } from './pages/AdminPortalPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { PublicIssuesPage } from './pages/PublicIssuesPage.tsx';
import { ReportIssuePage } from './pages/ReportIssuePage.tsx';
import { TrackComplaintPage } from './pages/TrackComplaintPage.tsx';
import type { AppPage, IssueCategory, PublicStats } from './types/civic.ts';

function parseHashRoute(): { page: AppPage; trackCode?: string } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (raw.startsWith('track/')) {
    return { page: 'track', trackCode: decodeURIComponent(raw.slice(6)) };
  }
  const valid: AppPage[] = ['home', 'report', 'track', 'public', 'about', 'admin'];
  if (valid.includes(raw as AppPage)) {
    return { page: raw as AppPage };
  }
  return { page: 'home' };
}

export default function App() {
  const initialRoute = parseHashRoute();
  const [currentPage, setCurrentPage] = useState<AppPage>(initialRoute.page);
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory | undefined>(undefined);
  const [trackCode, setTrackCode] = useState<string | undefined>(initialRoute.trackCode);
  const [stats, setStats] = useState<PublicStats | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // Ignore silent stats refresh error
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHashRoute();
      setCurrentPage(parsed.page);
      if (parsed.trackCode) setTrackCode(parsed.trackCode);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (page: AppPage) => {
    setCurrentPage(page);
    window.location.hash = page === 'home' ? '' : `#/${page}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToReportWithCategory = (category: IssueCategory) => {
    setSelectedCategory(category);
    navigate('report');
  };

  const navigateToTrackCode = (code: string) => {
    setTrackCode(code);
    setCurrentPage('track');
    window.location.hash = `#/track/${encodeURIComponent(code)}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (currentPage === 'admin') {
    return (
      <AdminPortalPage
        onExitToCitizen={() => navigate('home')}
        onStatsChanged={loadStats}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar currentPage={currentPage} onNavigate={navigate} />

      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage
            stats={stats}
            onNavigate={navigate}
            onReportCategory={navigateToReportWithCategory}
          />
        )}
        {currentPage === 'report' && (
          <ReportIssuePage
            initialCategory={selectedCategory}
            onSubmitted={loadStats}
            onTrackCode={navigateToTrackCode}
          />
        )}
        {currentPage === 'track' && (
          <TrackComplaintPage initialCode={trackCode} />
        )}
        {currentPage === 'public' && (
          <PublicIssuesPage onTrackCode={navigateToTrackCode} />
        )}
        {currentPage === 'about' && <AboutContactPage />}
      </main>

      <Footer onNavigate={navigate} />
    </div>
  );
}
