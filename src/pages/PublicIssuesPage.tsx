import { LayoutGrid, List, MapPin, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LeafletMap } from '../components/LeafletMap.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import {
  COMPLAINT_STATUSES,
  formatDateShort,
  ISSUE_CATEGORIES,
  type Complaint,
} from '../types/civic.ts';

interface PublicIssuesPageProps {
  onTrackCode: (code: string) => void;
}

export function PublicIssuesPage({ onTrackCode }: PublicIssuesPageProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    const fetchPublic = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (categoryFilter !== 'All') params.set('category', categoryFilter);
        if (statusFilter !== 'All') params.set('status', statusFilter);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        const res = await fetch(`/api/complaints/public?${params.toString()}`);
        if (res.ok) {
          const data = (await res.json()) as { complaints: Complaint[] };
          setComplaints(data.complaints);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPublic();
  }, [categoryFilter, statusFilter, searchQuery]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Public Civic Issues Ledger
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Browse community-reported issues and locations. Private citizen names and contact details are strictly excluded.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer ${
              showMap
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
          </button>

          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, landmark, or area..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
        >
          <option value="All">All Categories</option>
          {ISSUE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
        >
          <option value="All">All Statuses</option>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Optional Interactive Leaflet Map */}
      {showMap && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              Public Complaint Locations ({complaints.filter((c) => c.latitude !== null).length} geocoded)
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-600" aria-hidden="true" /> Pending / Verified
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true" /> In Progress
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" aria-hidden="true" /> Resolved
              </span>
            </div>
          </div>
          <LeafletMap
            mode="viewer"
            complaints={complaints}
            onSelectComplaint={(c) => onTrackCode(c.complaint_code)}
            heightClass="h-80"
          />
        </div>
      )}

      {/* Results */}
      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : complaints.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              No public complaints match your current filter criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('All');
                setStatusFilter('All');
                setSearchQuery('');
              }}
              className="mt-3 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {complaints.map((item) => (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-mono-tabular font-semibold text-blue-700">
                      {item.complaint_code}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <h2 className="mt-3 text-base font-semibold leading-snug text-slate-900">
                    {item.title}
                  </h2>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {item.category} · {item.ward_area} · {formatDateShort(item.created_at)}
                  </p>
                  <p className="mt-2.5 line-clamp-2 text-sm text-slate-600">
                    {item.location_text}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="font-mono-tabular text-[11px] text-slate-400">
                    {item.latitude !== null && item.longitude !== null
                      ? `${item.latitude.toFixed(3)}, ${item.longitude.toFixed(3)}`
                      : 'No GPS pin'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onTrackCode(item.complaint_code)}
                    className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    Track Details &rarr;
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Complaint ID</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Title &amp; Location</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-blue-700 whitespace-nowrap">
                      {item.complaint_code}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                      {item.category}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-500">
                        {item.location_text} · {item.ward_area}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                      {formatDateShort(item.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onTrackCode(item.complaint_code)}
                        className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                      >
                        Track
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
