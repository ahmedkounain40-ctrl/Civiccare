import {
  ArrowRight,
  Construction,
  Droplets,
  HelpCircle,
  Lightbulb,
  Search,
  Trash2,
  Waves,
} from 'lucide-react';
import heroCivicImg from '../assets/images/hero_civic_street_1794514606660.jpg';
import type { AppPage, IssueCategory, PublicStats } from '../types/civic.ts';

interface HomePageProps {
  stats: PublicStats | null;
  onNavigate: (page: AppPage) => void;
  onReportCategory: (category: IssueCategory) => void;
}

const CATEGORY_CARDS: Array<{
  category: IssueCategory;
  description: string;
  icon: typeof Construction;
}> = [
  {
    category: 'Pothole/Damaged Road',
    description: 'Road craters, broken shoulders, sunken manholes, and hazardous pavement cracks.',
    icon: Construction,
  },
  {
    category: 'Streetlight Failure',
    description: 'Unlit neighborhood poles, flickering LED fixtures, or dark pedestrian crossings.',
    icon: Lightbulb,
  },
  {
    category: 'Garbage Accumulation',
    description: 'Overflowing public bins, uncollected waste piles, and roadside dumping spots.',
    icon: Trash2,
  },
  {
    category: 'Drainage Problem',
    description: 'Clogged storm grates, waterlogging after rain, and overflowing roadside drains.',
    icon: Waves,
  },
  {
    category: 'Water Leakage',
    description: 'Burst supply pipes, leaking street valves, and continuous potable water wastage.',
    icon: Droplets,
  },
  {
    category: 'Other',
    description: 'Damaged railings, broken footpaths, fallen signage, or general neighborhood hazards.',
    icon: HelpCircle,
  },
];

const HOW_IT_WORKS = [
  {
    step: '01. Submit Issue & Photo',
    detail: 'Select a category, describe the problem, attach a site photograph, and pin GPS coordinates.',
  },
  {
    step: '02. Receive Unique ID',
    detail: 'The SQLite backend generates a unique tracking code (such as CIV-2026-011) and computes rule-based priority.',
  },
  {
    step: '03. Admin Verification & Triage',
    detail: 'A demonstration administrator inspects the evidence, checks duplicates, sets severity, and updates progress.',
  },
  {
    step: '04. Track Until Resolved',
    detail: 'Enter your complaint ID anytime to inspect timestamps, status milestones, and official remarks.',
  },
];

export function HomePage({ stats, onNavigate, onReportCategory }: HomePageProps) {
  return (
    <div>
      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-xs font-semibold tracking-wide text-blue-700">
                Public Grievance &amp; Civic Issue Reporting Platform
              </p>
              <h1 className="mt-3 text-[clamp(2.25rem,4vw,3.35rem)] font-bold leading-[1.12] tracking-tight text-slate-900 [text-wrap:balance]">
                Report. Track. Improve Your Community.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                CivicCare connects residents with a structured civic issue ledger. Log neighborhood road damage, streetlight outages, drainage blockages, or water leaks with photos and coordinates, then follow every milestone through resolution.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('report')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <span>Report an Issue</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('track')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <span>Track Complaint</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <img
                  src={heroCivicImg}
                  alt="Clean urban neighborhood boulevard with paved roads, trees, and civic streetlamps"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Full-width KPI Summary Strip below hero split */}
          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-slate-200 pt-8 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-medium text-slate-500">Total Complaints Logged</div>
              <div className="mt-1 font-mono-tabular text-2xl font-bold text-slate-900">
                {stats ? stats.total : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-medium text-slate-500">Resolved Issues</div>
              <div className="mt-1 font-mono-tabular text-2xl font-bold text-emerald-700">
                {stats ? stats.resolved : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-medium text-slate-500">Pending &amp; Active</div>
              <div className="mt-1 font-mono-tabular text-2xl font-bold text-amber-700">
                {stats ? stats.pending : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-xs font-medium text-slate-500">In Progress</div>
              <div className="mt-1 font-mono-tabular text-2xl font-bold text-blue-700">
                {stats ? stats.inProgress : '—'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Issue Categories Grid */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Civic Issue Categories
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Select a category below to begin a structured grievance report with photo evidence and location details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('public')}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Browse Public Issues &rarr;
          </button>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_CARDS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.category}
                type="button"
                onClick={() => onReportCategory(item.category)}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-700 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {item.category}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                  <span>Report this issue</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              How CivicCare Works
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              An end-to-end transparent workflow connecting citizen submissions to demonstration administrative review.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="border-t-2 border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">{item.step}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
