import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { AppPage } from '../types/civic.ts';

interface NavbarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

const NAV_LINKS: Array<{ page: AppPage; label: string }> = [
  { page: 'home', label: 'Home' },
  { page: 'report', label: 'Report Issue' },
  { page: 'track', label: 'Track Complaint' },
  { page: 'public', label: 'Public Issues' },
  { page: 'about', label: 'About & Contact' },
];

export function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (page: AppPage) => {
    setMobileOpen(false);
    onNavigate(page);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect width="24" height="24" rx="6" fill="#1D4ED8" />
            <path
              d="M12 5.5C9.51 5.5 7.5 7.51 7.5 10C7.5 13.38 12 18.5 12 18.5C12 18.5 16.5 13.38 16.5 10C16.5 7.51 14.49 5.5 12 5.5ZM12 11.75C11.03 11.75 10.25 10.97 10.25 10C10.25 9.03 11.03 8.25 12 8.25C12.97 8.25 13.75 9.03 13.75 10C13.75 10.97 12.97 11.75 12 11.75Z"
              fill="#FFFFFF"
            />
          </svg>
          <span>CivicCare</span>
        </button>

        {/* Zone 2: 5 concise single-line text links */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Main navigation">
          {NAV_LINKS.map((item) => {
            const active = currentPage === item.page;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => handleNav(item.page)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                  active
                    ? 'text-blue-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[21px] h-0.5 bg-blue-700" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('admin')}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Admin Portal
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex lg:hidden items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 min-h-[40px] min-w-[40px] cursor-pointer"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {NAV_LINKS.map((item) => {
              const active = currentPage === item.page;
              return (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => handleNav(item.page)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium min-h-[44px] cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div className="pt-2 mt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleNav('admin')}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800 min-h-[44px] cursor-pointer"
              >
                Admin Portal
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
