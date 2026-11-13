import {
  CheckCircle2,
  Clock,
  ImageOff,
  Loader2,
  MapPin,
  Search,
  XCircle,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { PriorityText, SeverityText, StatusBadge } from '../components/StatusBadge.tsx';
import { formatDateTime, type Complaint, type HistoryEntry } from '../types/civic.ts';

interface TrackComplaintPageProps {
  initialCode?: string;
}

const TIMELINE_STEPS = ['Submitted', 'Verified', 'In Progress', 'Resolved'] as const;

export function TrackComplaintPage({ initialCode }: TrackComplaintPageProps) {
  const [queryCode, setQueryCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    complaint: Complaint;
    history: HistoryEntry[];
  } | null>(null);

  const fetchComplaint = async (codeToTrack: string) => {
    const clean = codeToTrack.trim().toUpperCase();
    if (!clean) {
      setErrorMsg('Please enter a Complaint ID (for example, CIV-2026-001).');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/complaints/track/${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setErrorMsg(data.error || 'Complaint not found.');
      } else {
        setResult(data);
      }
    } catch {
      setErrorMsg('Unable to connect to the server while tracking complaint.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      setQueryCode(initialCode);
      fetchComplaint(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetchComplaint(queryCode);
  };

  const complaint = result?.complaint;
  const history = result?.history || [];
  const isRejected = complaint?.status === 'Rejected';
  const currentStepIndex = complaint
    ? TIMELINE_STEPS.indexOf(complaint.status as (typeof TIMELINE_STEPS)[number])
    : -1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Track Your Complaint
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Enter your unique complaint ID to view current progress, administrator remarks, photo evidence, and chronological status history.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={queryCode}
              onChange={(e) => setQueryCode(e.target.value.toUpperCase())}
              placeholder="Enter Complaint ID (e.g., CIV-2026-001)"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 font-mono-tabular text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Track Status</span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Try sample IDs:</span>
          {['CIV-2026-001', 'CIV-2026-003', 'CIV-2026-004', 'CIV-2026-009'].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => {
                setQueryCode(sample);
                fetchComplaint(sample);
              }}
              className="font-mono-tabular font-medium text-blue-700 hover:underline cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </div>
      </form>

      {errorMsg && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Tracking Result */}
      {complaint && (
        <div className="mt-8 space-y-6">
          {/* Header & Timeline Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono-tabular font-semibold text-blue-700">
                    {complaint.complaint_code}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{complaint.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>Submitted {formatDateTime(complaint.created_at)}</span>
                </div>
                <h2 className="mt-1.5 text-xl font-bold text-slate-900">
                  {complaint.title}
                </h2>
              </div>
              <StatusBadge status={complaint.status} />
            </div>

            {/* Status Progress Timeline */}
            <div className="mt-6">
              {isRejected ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-semibold text-red-900">
                        Complaint Marked as Rejected
                      </div>
                      <p className="mt-1 text-sm text-red-800">
                        {complaint.admin_remarks || 'This complaint was rejected during demonstration administrative review.'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <ol className="grid gap-3 sm:grid-cols-4">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const completed = currentStepIndex >= idx;
                    const isCurrent = currentStepIndex === idx;
                    return (
                      <li
                        key={step}
                        className={`rounded-lg border p-3.5 transition-colors ${
                          isCurrent
                            ? 'border-blue-300 bg-blue-50/70'
                            : completed
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-tabular text-[11px] font-semibold text-slate-500">
                            0{idx + 1}
                          </span>
                          {completed ? (
                            <CheckCircle2
                              className={`h-4 w-4 ${isCurrent ? 'text-blue-700' : 'text-emerald-600'}`}
                              aria-hidden="true"
                            />
                          ) : (
                            <Clock className="h-4 w-4 text-slate-300" aria-hidden="true" />
                          )}
                        </div>
                        <div
                          className={`mt-2 text-sm font-semibold ${
                            completed ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {step}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>

          {/* Details & Photo Grid */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Issue Description</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {complaint.description}
                </p>
              </div>

              <div className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Location &amp; Ward</div>
                  <div className="mt-1 flex items-start gap-1.5 font-medium text-slate-900">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span>
                      {complaint.location_text} ({complaint.ward_area})
                    </span>
                  </div>
                  {complaint.latitude !== null && complaint.longitude !== null && (
                    <div className="mt-1 font-mono-tabular text-xs text-slate-500">
                      {complaint.latitude.toFixed(5)}, {complaint.longitude.toFixed(5)}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-500">Assigned Demo Unit</div>
                  <div className="mt-1 font-medium text-slate-900">
                    {complaint.assigned_department || 'Pending Assignment (Demo)'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Severity Rating</div>
                  <div className="mt-1">
                    <SeverityText severity={complaint.severity} />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Rule-Based Priority</div>
                  <div className="mt-1">
                    <PriorityText level={complaint.priority_level} score={complaint.priority_score} />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="text-xs font-semibold text-slate-700">
                  Administrator Remarks (Demo Review)
                </div>
                <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700">
                  {complaint.admin_remarks || 'No remarks added yet.'}
                </p>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900">Submitted Photograph</h3>
                {complaint.image_url ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <img
                      src={complaint.image_url}
                      alt={`Submitted evidence for ${complaint.complaint_code}`}
                      referrerPolicy="no-referrer"
                      className="h-56 w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="mt-3 flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                    <ImageOff className="h-6 w-6" aria-hidden="true" />
                    <span className="mt-2 text-xs">No photograph attached</span>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900">Status Change History</h3>
                <ul className="mt-4 space-y-4">
                  {history.map((item) => (
                    <li key={item.id} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">{item.status}</span>
                        <span className="font-mono-tabular text-[11px] text-slate-500">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.remark}</p>
                      <div className="mt-1 text-[11px] text-slate-400">By {item.changed_by}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
