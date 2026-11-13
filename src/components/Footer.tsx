import type { AppPage } from '../types/civic.ts';

interface FooterProps {
  onNavigate: (page: AppPage) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2 space-y-3">
            <div className="text-base font-bold tracking-tight text-slate-900">
              CivicCare
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-600">
              Report. Track. Improve Your Community. A VTU 3rd-Semester BE (Artificial Intelligence &amp; Data Science) student prototype for transparent neighborhood civic issue reporting and demonstration triage.
            </p>
            <p className="text-xs leading-relaxed text-slate-500">
              Prototype Notice: Submitted reports are stored in the project SQLite database for demonstration. Issues are not automatically forwarded to official municipal authorities.
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wide text-slate-900">
              Citizen Portal
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <button type="button" onClick={() => onNavigate('home')} className="hover:text-blue-700 cursor-pointer">
                  Home Overview
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('report')} className="hover:text-blue-700 cursor-pointer">
                  Report an Issue
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('track')} className="hover:text-blue-700 cursor-pointer">
                  Track Complaint
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('public')} className="hover:text-blue-700 cursor-pointer">
                  Public Issues Map
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wide text-slate-900">
              Project &amp; Governance
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <button type="button" onClick={() => onNavigate('about')} className="hover:text-blue-700 cursor-pointer">
                  About the Project
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('about')} className="hover:text-blue-700 cursor-pointer">
                  Contact &amp; Feedback
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('admin')} className="hover:text-blue-700 cursor-pointer">
                  Administrator Login
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
          <span>CivicCare · Public Grievance &amp; Civic Issue Reporting System</span>
          <span>VTU Community / Societal Engineering Project Prototype</span>
        </div>
      </div>
    </footer>
  );
}
