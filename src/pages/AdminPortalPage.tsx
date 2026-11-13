import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  ImageOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Map as MapIcon,
  ScanEye,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  CategoryBarChart,
  MonthlyTrendChart,
  StatusDoughnutChart,
} from '../components/AnalyticsCharts.tsx';
import { LeafletMap } from '../components/LeafletMap.tsx';
import { PriorityText, SeverityText, StatusBadge } from '../components/StatusBadge.tsx';
import {
  COMPLAINT_STATUSES,
  DEMO_DEPARTMENTS,
  formatDateShort,
  formatDateTime,
  ISSUE_CATEGORIES,
  SEVERITY_LEVELS,
  type AnalyticsData,
  type Complaint,
  type DuplicateMatch,
  type HistoryEntry,
  type PublicStats,
  type RoadInspectionResult,
} from '../types/civic.ts';

interface AdminPortalPageProps {
  onExitToCitizen: () => void;
  onStatsChanged: () => void;
}

type AdminSection = 'overview' | 'complaints' | 'map' | 'ai' | 'security';

const SAMPLE_TEST_PHOTOS = [
  {
    label: 'Sample Road Pothole',
    filename: 'sample_pothole_road_1794514607155.jpg',
    url: '/sample-images/sample_pothole_road_1794514607155.jpg',
  },
  {
    label: 'Sample Storm Drain',
    filename: 'sample_drainage_overflow_1794514607607.jpg',
    url: '/sample-images/sample_drainage_overflow_1794514607607.jpg',
  },
  {
    label: 'Sample Streetlight',
    filename: 'sample_streetlight_dusk_1794514606907.jpg',
    url: '/sample-images/sample_streetlight_dusk_1794514606907.jpg',
  },
];

export function AdminPortalPage({
  onExitToCitizen,
  onStatsChanged,
}: AdminPortalPageProps) {
  const [authChecking, setAuthChecking] = useState(true);
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() =>
    localStorage.getItem('civiccare_admin_token')
  );

  // Login & One-Time Setup State
  const [setupConfigured, setSetupConfigured] = useState<boolean | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  // Account Security (Password & Email Rotation)
  const [secCurrentPassword, setSecCurrentPassword] = useState('');
  const [secNewEmail, setSecNewEmail] = useState('');
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secConfirmPassword, setSecConfirmPassword] = useState('');
  const [secSaving, setSecSaving] = useState(false);
  const [secFeedback, setSecFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Active Section
  const [section, setSection] = useState<AdminSection>('overview');

  // Data
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Filters for Complaint Management
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Selected Complaint Detail & Update State
  const [selectedDetail, setSelectedDetail] = useState<{
    complaint: Complaint;
    history: HistoryEntry[];
    duplicates: DuplicateMatch[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editSeverity, setEditSeverity] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Map Dashboard
  const [showHotspots, setShowHotspots] = useState(true);

  // AI Pothole Lab
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiSampleFile, setAiSampleFile] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<RoadInspectionResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const authHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  }, [authToken]);

  const clearSession = useCallback(() => {
    localStorage.removeItem('civiccare_admin_token');
    setAuthToken(null);
    setAdminUser(null);
    setSelectedDetail(null);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const [meRes, statusRes] = await Promise.all([
          fetch('/api/admin/me', { headers: authHeaders() }),
          fetch('/api/admin/setup-status'),
        ]);
        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as { configured: boolean };
          setSetupConfigured(statusData.configured);
        }
        if (meRes.ok) {
          const data = (await meRes.json()) as { authenticated: boolean; user?: string };
          if (data.authenticated && data.user) {
            setAdminUser(data.user);
            setSecNewEmail(data.user);
          }
        } else if (meRes.status === 401 && authToken) {
          localStorage.removeItem('civiccare_admin_token');
          setAuthToken(null);
        }
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, [authHeaders, authToken]);

  const loadDashboardData = useCallback(async () => {
    if (!adminUser) return;
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'All') params.set('category', categoryFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('sort', sortBy);

      const [statsRes, analyticsRes, listRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/admin/analytics', { headers: authHeaders() }),
        fetch(`/api/admin/complaints?${params.toString()}`, { headers: authHeaders() }),
      ]);

      if (analyticsRes.status === 401 || listRes.status === 401) {
        clearSession();
        return;
      }

      if (statsRes.ok) setStats(await statsRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (listRes.ok) {
        const listData = (await listRes.json()) as { complaints: Complaint[] };
        setComplaints(listData.complaints);
      }
    } finally {
      setListLoading(false);
    }
  }, [adminUser, authHeaders, categoryFilter, clearSession, statusFilter, dateFrom, dateTo, searchQuery, sortBy]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Authentication failed.');
      } else {
        if (data.token) {
          localStorage.setItem('civiccare_admin_token', data.token);
          setAuthToken(data.token);
        }
        setPassword('');
        setAdminUser(data.user);
        setSecNewEmail(data.user);
      }
    } catch {
      setLoginError('Unable to reach server for authentication.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleInitialSetup = async (e: FormEvent) => {
    e.preventDefault();
    setSetupError(null);
    if (setupPassword.length < 8) {
      setSetupError('Password must be at least 8 characters long.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setSetupError('Passwords do not match.');
      return;
    }
    setSetupSubmitting(true);
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: setupEmail, password: setupPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error || 'Unable to save administrator credentials.');
      } else {
        if (data.token) {
          localStorage.setItem('civiccare_admin_token', data.token);
          setAuthToken(data.token);
        }
        setSetupConfigured(true);
        setSetupMode(false);
        setSetupPassword('');
        setSetupConfirm('');
        setAdminUser(data.user);
        setSecNewEmail(data.user);
      }
    } catch {
      setSetupError('Unable to reach server to complete setup.');
    } finally {
      setSetupSubmitting(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSecFeedback(null);
    if (secNewPassword.length < 8) {
      setSecFeedback({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (secNewPassword !== secConfirmPassword) {
      setSecFeedback({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    setSecSaving(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          currentPassword: secCurrentPassword,
          newEmail: secNewEmail,
          newPassword: secNewPassword,
        }),
      });
      const data = await res.json();
      if (res.status === 401 && data.error === 'Administrator authentication required.') {
        clearSession();
        return;
      }
      if (!res.ok) {
        setSecFeedback({ type: 'error', text: data.error || 'Failed to update credentials.' });
      } else {
        if (data.token) {
          localStorage.setItem('civiccare_admin_token', data.token);
          setAuthToken(data.token);
        }
        setAdminUser(data.user);
        setSecCurrentPassword('');
        setSecNewPassword('');
        setSecConfirmPassword('');
        setSecFeedback({
          type: 'success',
          text: 'Administrator credentials updated and stored securely with scrypt hashing.',
        });
      }
    } catch {
      setSecFeedback({ type: 'error', text: 'Network error while updating credentials.' });
    } finally {
      setSecSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    clearSession();
  };

  const openComplaintDetail = async (idOrCode: number | string) => {
    setDetailLoading(true);
    setUpdateFeedback(null);
    try {
      const res = await fetch(`/api/admin/complaints/${idOrCode}`, { headers: authHeaders() });
      if (res.status === 401) {
        clearSession();
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as {
          complaint: Complaint;
          history: HistoryEntry[];
          duplicates: DuplicateMatch[];
        };
        setSelectedDetail(data);
        setEditStatus(data.complaint.status);
        setEditSeverity(data.complaint.severity);
        setEditDept(data.complaint.assigned_department || '');
        setEditRemarks(data.complaint.admin_remarks || '');
        setSection('complaints');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const submitComplaintUpdate = async (overrideStatus?: string, overrideRemark?: string) => {
    if (!selectedDetail) return;
    const statusToSave = overrideStatus || editStatus;
    const remarkToSave = overrideRemark !== undefined ? overrideRemark : editRemarks;

    setSavingUpdate(true);
    setUpdateFeedback(null);
    try {
      const res = await fetch(`/api/admin/complaints/${selectedDetail.complaint.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          status: statusToSave,
          severity: editSeverity,
          assigned_department: editDept || null,
          admin_remarks: remarkToSave,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUpdateFeedback({ type: 'error', text: data.error || 'Update failed.' });
      } else {
        setSelectedDetail((prev) =>
          prev
            ? {
                ...prev,
                complaint: data.complaint,
                history: data.history,
              }
            : null
        );
        setEditStatus(data.complaint.status);
        setEditSeverity(data.complaint.severity);
        setEditDept(data.complaint.assigned_department || '');
        setEditRemarks(data.complaint.admin_remarks || '');
        setUpdateFeedback({
          type: 'success',
          text: `Saved complaint update (${data.complaint.status}) to SQLite & status history.`,
        });
        await loadDashboardData();
        onStatsChanged();
      }
    } catch {
      setUpdateFeedback({ type: 'error', text: 'Network error while saving update.' });
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleAiFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setAiResult(null);
    setAiError(null);
    setAiSampleFile(null);
    if (!f) {
      setAiFile(null);
      setAiPreview(null);
      return;
    }
    setAiFile(f);
    const reader = new FileReader();
    reader.onload = () => setAiPreview(String(reader.result || ''));
    reader.readAsDataURL(f);
  };

  const handleSelectSampleAiPhoto = (sample: (typeof SAMPLE_TEST_PHOTOS)[number]) => {
    setAiFile(null);
    setAiSampleFile(sample.filename);
    setAiPreview(sample.url);
    setAiResult(null);
    setAiError(null);
  };

  const runAiPotholeInspection = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      let res: Response;
      if (aiFile) {
        const form = new FormData();
        form.append('photo', aiFile);
        res = await fetch('/api/ai/pothole-detect', { method: 'POST', body: form });
      } else if (aiSampleFile) {
        res = await fetch('/api/ai/pothole-detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ samplePath: aiSampleFile }),
        });
      } else {
        setAiError('Select or upload a road photograph first.');
        setAiLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'AI inspection failed.');
      } else {
        setAiResult(data.result);
      }
    } catch {
      setAiError('Unable to reach AI detection endpoint.');
    } finally {
      setAiLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
      </div>
    );
  }

  // Admin Login Screen
  if (!adminUser) {
    return (
      <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <button
          type="button"
          onClick={onExitToCitizen}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to Citizen Website</span>
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {setupMode ? 'Configure Administrator' : 'Administrator Login'}
              </h1>
              <p className="text-xs text-slate-500">
                CivicCare Secure Triage Console
              </p>
            </div>
          </div>

          {!setupMode ? (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              {setupConfigured === false && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                  Administrator password is not configured yet. Configure{' '}
                  <span className="font-mono-tabular font-semibold">ADMIN_PASSWORD</span> in your
                  server secrets or complete the one-time setup below.
                </div>
              )}

              {loginError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {loginError}
                </div>
              )}

              <div>
                <label htmlFor="adminUser" className="block text-xs font-semibold text-slate-700">
                  Admin Email or Username
                </label>
                <input
                  id="adminUser"
                  type="email"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter administrator email"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="adminPass" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <input
                  id="adminPass"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                {loggingIn && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>Sign In to Admin Dashboard</span>
              </button>

              {setupConfigured === false && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginError(null);
                      setSetupMode(true);
                    }}
                    className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    First-time setup? Set administrator password
                  </button>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleInitialSetup} className="mt-6 space-y-4">
              {setupError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {setupError}
                </div>
              )}

              <div>
                <label htmlFor="setupEmail" className="block text-xs font-semibold text-slate-700">
                  Administrator Email
                </label>
                <input
                  id="setupEmail"
                  type="email"
                  autoComplete="email"
                  required
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  placeholder="Enter your personal administrator email"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="setupPass" className="block text-xs font-semibold text-slate-700">
                  Create Password (minimum 8 characters)
                </label>
                <input
                  id="setupPass"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="setupConfirm" className="block text-xs font-semibold text-slate-700">
                  Confirm Password
                </label>
                <input
                  id="setupConfirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={setupSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                {setupSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>Save Credentials &amp; Sign In</span>
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setSetupError(null);
                    setSetupMode(false);
                  }}
                  className="text-xs font-semibold text-slate-600 hover:underline cursor-pointer"
                >
                  Back to Administrator Login
                </button>
              </div>
            </form>
          )}

          <p className="mt-5 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-500">
            Protected console: Sessions are authenticated server-side with salted scrypt password verification and signed HTTP-only tokens.
          </p>
        </div>
      </div>
    );
  }

  const sectionLabels: Record<AdminSection, string> = {
    overview: 'Overview & Analytics',
    complaints: 'Complaint Management',
    map: 'Map Dashboard',
    ai: 'AI Pothole Lab',
    security: 'Account Security',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full border-b border-slate-200 bg-white lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="text-base font-bold tracking-tight text-slate-900">
            CivicCare Admin
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-red-700 lg:hidden cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>

        <nav className="flex overflow-x-auto gap-1 p-3 lg:flex-col" aria-label="Admin sidebar navigation">
          {(
            [
              { id: 'overview', label: 'Overview & Analytics', icon: BarChart3 },
              { id: 'complaints', label: 'Complaint Management', icon: ClipboardList },
              { id: 'map', label: 'Map Dashboard', icon: MapIcon },
              { id: 'ai', label: 'AI Pothole Lab', icon: ScanEye },
              { id: 'security', label: 'Account Security', icon: KeyRound },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  if (item.id !== 'complaints') setSelectedDetail(null);
                }}
                className={`inline-flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block mt-auto border-t border-slate-200 p-4 text-xs text-slate-500 space-y-2">
          <div className="font-semibold text-slate-800">Administrator Session</div>
          <div className="font-mono-tabular truncate">{adminUser}</div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Authenticated console. All updates persist to SQLite.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Admin Top Header */}
        <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="text-sm font-medium text-slate-600 truncate">
            <span>Admin Portal</span>
            <span className="mx-2 text-slate-300">/</span>
            <span className="font-semibold text-slate-900">
              {selectedDetail ? `Complaint ${selectedDetail.complaint.complaint_code}` : sectionLabels[section]}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onExitToCitizen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Citizen Site</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 space-y-6">
          {/* SECTION 1: OVERVIEW & ANALYTICS */}
          {section === 'overview' && (
            <div className="space-y-6">
              {/* 6 KPI Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: 'Total', value: stats?.total ?? 0, color: 'text-slate-900' },
                  { label: 'Pending (Submitted)', value: stats?.submitted ?? 0, color: 'text-slate-700' },
                  { label: 'Verified', value: stats?.verified ?? 0, color: 'text-blue-700' },
                  { label: 'In Progress', value: stats?.inProgress ?? 0, color: 'text-amber-700' },
                  { label: 'Resolved', value: stats?.resolved ?? 0, color: 'text-emerald-700' },
                  { label: 'Rejected', value: stats?.rejected ?? 0, color: 'text-red-700' },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-medium text-slate-500">{kpi.label}</div>
                    <div className={`mt-1.5 font-mono-tabular text-2xl font-bold ${kpi.color}`}>
                      {kpi.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart.js Grid */}
              {analytics && (
                <>
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
                      <h2 className="text-sm font-semibold text-slate-900">
                        Complaints by Category
                      </h2>
                      <div className="mt-4">
                        <CategoryBarChart data={analytics.byCategory} />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <h2 className="text-sm font-semibold text-slate-900">
                        Complaints by Status
                      </h2>
                      <div className="mt-4">
                        <StatusDoughnutChart data={analytics.byStatus} />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-12">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
                      <h2 className="text-sm font-semibold text-slate-900">
                        Monthly Complaint Trend
                      </h2>
                      <div className="mt-4">
                        <MonthlyTrendChart data={analytics.byMonth} />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 flex flex-col justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                          Resolution Statistics
                        </h2>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
                            <div className="text-xs text-slate-500">Resolution Rate</div>
                            <div className="mt-1 font-mono-tabular text-xl font-bold text-emerald-700">
                              {analytics.resolutionStats.resolutionRate}%
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
                            <div className="text-xs text-slate-500">Avg Resolution Time</div>
                            <div className="mt-1 font-mono-tabular text-xl font-bold text-slate-900">
                              {analytics.resolutionStats.avgResolutionHours} hrs
                            </div>
                          </div>
                        </div>

                        <h3 className="mt-6 text-xs font-semibold text-slate-700">
                          Area-Wise Summary
                        </h3>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-200 text-slate-500">
                              <tr>
                                <th className="py-2 font-medium">Ward / Area</th>
                                <th className="py-2 text-right font-medium">Total</th>
                                <th className="py-2 text-right font-medium">Active</th>
                                <th className="py-2 text-right font-medium">Resolved</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono-tabular">
                              {analytics.byArea.slice(0, 6).map((row) => (
                                <tr key={row.area}>
                                  <td className="py-2 font-sans font-medium text-slate-800">{row.area}</td>
                                  <td className="py-2 text-right text-slate-700">{row.total}</td>
                                  <td className="py-2 text-right text-amber-700">{row.active}</td>
                                  <td className="py-2 text-right text-emerald-700">{row.resolved}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SECTION 2: COMPLAINT MANAGEMENT & DETAILS */}
          {section === 'complaints' && !selectedDetail && (
            <div className="space-y-5">
              {/* Filter & Sort Controls */}
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
                <div className="relative lg:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, title, citizen, area..."
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="All">All Categories</option>
                  {ISSUE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  {COMPLAINT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Filter from date"
                  className="rounded-lg border border-slate-300 px-2.5 py-2 font-mono-tabular text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                />

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="priority">Sort: Highest Rule Priority</option>
                  <option value="severity">Sort: Highest Severity</option>
                </select>
              </div>

              {/* Complaints Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                {listLoading ? (
                  <div className="p-8 text-center text-sm text-slate-500">Loading complaints...</div>
                ) : complaints.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-600">
                    No complaints match the selected filters.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Complaint ID</th>
                        <th className="px-4 py-3 font-semibold">Category</th>
                        <th className="px-4 py-3 font-semibold">Title &amp; Location</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Severity</th>
                        <th className="px-4 py-3 font-semibold">Rule Priority</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {complaints.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-mono-tabular font-semibold text-blue-700 whitespace-nowrap">
                            {c.complaint_code}
                          </td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.category}</td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="truncate font-medium text-slate-900">{c.title}</div>
                            <div className="truncate text-[11px] text-slate-500">
                              {c.location_text} · {c.ward_area}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono-tabular text-slate-600 whitespace-nowrap">
                            {formatDateShort(c.created_at)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <SeverityText severity={c.severity} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <PriorityText level={c.priority_level} score={c.priority_score} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openComplaintDetail(c.id)}
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                            >
                              Inspect &amp; Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* COMPLAINT DETAILS & UPDATE WORKFLOW */}
          {section === 'complaints' && selectedDetail && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Back to Complaint List</span>
                </button>
                <div className="text-xs text-slate-500">
                  Administrator Actions: Updates reflect immediately on Citizen Track Complaint
                </div>
              </div>

              {detailLoading ? (
                <div className="p-10 text-center text-sm text-slate-500">Loading details...</div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-12">
                  {/* Left: Complete Information + Photo + History */}
                  <div className="space-y-6 lg:col-span-7">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                        <div>
                          <div className="font-mono-tabular text-xs font-semibold text-blue-700">
                            {selectedDetail.complaint.complaint_code} · {selectedDetail.complaint.category}
                          </div>
                          <h2 className="mt-1 text-xl font-bold text-slate-900">
                            {selectedDetail.complaint.title}
                          </h2>
                        </div>
                        <StatusBadge status={selectedDetail.complaint.status} />
                      </div>

                      <p className="text-sm leading-relaxed text-slate-700">
                        {selectedDetail.complaint.description}
                      </p>

                      <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 text-xs">
                        <div>
                          <div className="text-slate-500">Location &amp; Ward</div>
                          <div className="mt-0.5 font-medium text-slate-900">
                            {selectedDetail.complaint.location_text} ({selectedDetail.complaint.ward_area})
                          </div>
                          {selectedDetail.complaint.latitude !== null &&
                            selectedDetail.complaint.longitude !== null && (
                              <div className="mt-0.5 font-mono-tabular text-slate-500">
                                {selectedDetail.complaint.latitude.toFixed(5)},{' '}
                                {selectedDetail.complaint.longitude.toFixed(5)}
                              </div>
                            )}
                        </div>
                        <div>
                          <div className="text-slate-500">Submitted Timestamp</div>
                          <div className="mt-0.5 font-mono-tabular font-medium text-slate-900">
                            {formatDateTime(selectedDetail.complaint.created_at)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Citizen Name (Authorized View)</div>
                          <div className="mt-0.5 font-medium text-slate-900">
                            {selectedDetail.complaint.citizen_name || 'Not provided'}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Citizen Contact (Authorized View)</div>
                          <div className="mt-0.5 font-mono-tabular font-medium text-slate-900">
                            {selectedDetail.complaint.citizen_contact || 'Not provided'}
                          </div>
                        </div>
                      </div>

                      {/* Rule-Based Priority Breakdown */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">
                            Transparent Rule-Based Priority
                          </span>
                          <PriorityText
                            level={selectedDetail.complaint.priority_level}
                            score={selectedDetail.complaint.priority_score}
                          />
                        </div>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-600">
                          {selectedDetail.complaint.priority_explanation.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Potential Duplicate Alerts */}
                      {selectedDetail.duplicates.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs">
                          <div className="flex items-center gap-2 font-semibold text-amber-900">
                            <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
                            <span>Potential Duplicate Complaints Detected</span>
                          </div>
                          <ul className="mt-2 space-y-1.5 text-amber-900">
                            {selectedDetail.duplicates.map((dup) => (
                              <li key={dup.complaint_code} className="flex items-center justify-between gap-2">
                                <span>
                                  <strong className="font-mono-tabular">{dup.complaint_code}</strong>: {dup.title} ({dup.reasons.join(', ')})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openComplaintDetail(dup.complaint_code)}
                                  className="font-semibold text-blue-700 hover:underline shrink-0 cursor-pointer"
                                >
                                  Open
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Photo Evidence */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <h3 className="text-sm font-semibold text-slate-900">Uploaded Photograph</h3>
                      {selectedDetail.complaint.image_url ? (
                        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          <img
                            src={selectedDetail.complaint.image_url}
                            alt={`Evidence for ${selectedDetail.complaint.complaint_code}`}
                            referrerPolicy="no-referrer"
                            className="max-h-72 w-full object-contain bg-slate-900/5"
                          />
                        </div>
                      ) : (
                        <div className="mt-3 flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                          <ImageOff className="h-6 w-6" aria-hidden="true" />
                          <span className="mt-1.5 text-xs">No photograph uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Update Actions + History */}
                  <div className="space-y-6 lg:col-span-5">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Update Complaint
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Changes persist to SQLite and appear in Citizen Track Complaint.
                        </p>
                      </div>

                      {updateFeedback && (
                        <div
                          className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                            updateFeedback.type === 'success'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-red-200 bg-red-50 text-red-800'
                          }`}
                        >
                          {updateFeedback.text}
                        </div>
                      )}

                      {/* Quick Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={savingUpdate}
                          onClick={() =>
                            submitComplaintUpdate(
                              'Verified',
                              editRemarks || 'Complaint verified by administrator.'
                            )
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Verify</span>
                        </button>
                        <button
                          type="button"
                          disabled={savingUpdate}
                          onClick={() =>
                            submitComplaintUpdate(
                              'In Progress',
                              editRemarks || 'Assigned to field crew for resolution.'
                            )
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer"
                        >
                          <span>Mark In Progress</span>
                        </button>
                        <button
                          type="button"
                          disabled={savingUpdate}
                          onClick={() =>
                            submitComplaintUpdate(
                              'Resolved',
                              editRemarks || 'Issue marked resolved by administrator.'
                            )
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Mark Resolved</span>
                        </button>
                        <button
                          type="button"
                          disabled={savingUpdate}
                          onClick={() => submitComplaintUpdate('Rejected', editRemarks)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 cursor-pointer"
                        >
                          <span>Reject</span>
                        </button>
                      </div>

                      <div className="space-y-3 border-t border-slate-200 pt-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700">Status</label>
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            >
                              {COMPLAINT_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700">Severity</label>
                            <select
                              value={editSeverity}
                              onChange={(e) => setEditSeverity(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            >
                              {SEVERITY_LEVELS.map((lv) => (
                                <option key={lv} value={lv}>{lv}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Assigned Department (Demo Field)
                          </label>
                          <select
                            value={editDept}
                            onChange={(e) => setEditDept(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                          >
                            <option value="">Unassigned</option>
                            {DEMO_DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Administrator Remarks (Required when Rejecting)
                          </label>
                          <textarea
                            rows={3}
                            value={editRemarks}
                            onChange={(e) => setEditRemarks(e.target.value)}
                            placeholder="Add inspection notes, action taken, or rejection reason..."
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={savingUpdate}
                          onClick={() => submitComplaintUpdate()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                        >
                          {savingUpdate && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                          <span>Save Complaint Update</span>
                        </button>
                      </div>
                    </div>

                    {/* History Log */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5">
                      <h3 className="text-sm font-semibold text-slate-900">Complaint History</h3>
                      <ul className="mt-3 space-y-3">
                        {selectedDetail.history.map((h) => (
                          <li key={h.id} className="border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-900">{h.status}</span>
                              <span className="font-mono-tabular text-[11px] text-slate-500">
                                {formatDateTime(h.created_at)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">{h.remark}</p>
                            <div className="mt-0.5 text-[11px] text-slate-400">By {h.changed_by}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: MAP DASHBOARD */}
          {section === 'map' && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Spatial Map &amp; Hotspot Dashboard
                  </h2>
                  <p className="text-xs text-slate-600">
                    Click any marker to inspect details and update status. Hotspot circles highlight unresolved cluster zones.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHotspots((v) => !v)}
                  className={`rounded-lg border px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                    showHotspots
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {showHotspots ? 'Hide Hotspot Overlay' : 'Show Hotspot Overlay'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-5 border-y border-slate-100 py-2.5 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-amber-600" aria-hidden="true" /> Pending (Submitted / Verified)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-blue-600" aria-hidden="true" /> In Progress
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-600" aria-hidden="true" /> Resolved
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-600" aria-hidden="true" /> Rejected
                </span>
              </div>

              <LeafletMap
                mode="viewer"
                complaints={complaints}
                showHotspots={showHotspots}
                onSelectComplaint={(c) => openComplaintDetail(c.id)}
                heightClass="h-[520px]"
              />
            </div>
          )}

          {/* SECTION 4: AI POTHOLE LAB */}
          {section === 'ai' && (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 lg:col-span-7">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    AI Road &amp; Pothole Visual Inspection
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Upload a road photograph or pick a sample civic image below to run multimodal classification via server-side Gemini Vision (<span className="font-mono-tabular">gemini-4-hydrogen</span>).
                  </p>
                </div>

                {/* Quick Sample Photos */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Quick Sample Images
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_TEST_PHOTOS.map((s) => (
                      <button
                        key={s.filename}
                        type="button"
                        onClick={() => handleSelectSampleAiPhoto(s)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                          aiSampleFile === s.filename
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Or Upload Custom Road Image
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAiFileChange}
                    className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:px-3 py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-100"
                  />
                </div>

                {aiPreview && (
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <img
                      src={aiPreview}
                      alt="Selected road inspection preview"
                      className="max-h-72 w-full object-contain bg-slate-900/5"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={aiLoading || (!aiFile && !aiSampleFile)}
                  onClick={runAiPotholeInspection}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ScanEye className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{aiLoading ? 'Analyzing Photograph...' : 'Run AI Pothole Classification'}</span>
                </button>

                {aiError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                    {aiError}
                  </div>
                )}

                {aiResult && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <div>
                        <div className="text-xs text-slate-500">Detected Classification</div>
                        <div className="text-base font-bold text-slate-900">
                          {aiResult.damageType}
                        </div>
                      </div>
                      <span
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                          aiResult.potholeDetected
                            ? 'border-red-200 bg-red-50 text-red-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {aiResult.potholeDetected ? 'Pothole / Hazard Detected' : 'No Pothole Detected'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">Road Surface Visible:</span>{' '}
                        <strong className="text-slate-900">{aiResult.isRoadSurface ? 'Yes' : 'No'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Suggested Severity:</span>{' '}
                        <SeverityText severity={aiResult.recommendedSeverity} />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-700">Visual Observations</div>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">
                        {aiResult.visualObservations.map((obs, idx) => (
                          <li key={idx}>{obs}</li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-xs text-slate-700">{aiResult.assessmentNote}</p>
                    <p className="border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                      Model: <span className="font-mono-tabular">{aiResult.analyzedWithModel}</span> · {aiResult.confidenceNote}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-5 lg:col-span-5">
                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 text-xs text-slate-600">
                  <h3 className="text-sm font-bold text-slate-900">
                    AI Vision vs. Rule-Based Priority
                  </h3>
                  <p className="leading-relaxed">
                    CivicCare separates <strong>visual classification</strong> from <strong>priority scoring</strong>:
                  </p>
                  <ul className="list-disc space-y-1.5 pl-4">
                    <li>
                      <strong>Gemini Vision Inspection:</strong> Evaluates road surface photos in real time via <span className="font-mono-tabular">/api/ai/pothole-detect</span> and suggests a severity level based on visible pavement cavity/cracking.
                    </li>
                    <li>
                      <strong>Deterministic Rule-Based Priority:</strong> Computes a 0–100 score from Issue Category weight (15–30), Severity (8–35), Safety context keywords (up to +25), and GPS verification (+10).
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 text-xs text-slate-600">
                  <h3 className="text-sm font-bold text-slate-900">
                    Integrating a Custom Trained CNN / PyTorch Model
                  </h3>
                  <p className="leading-relaxed">
                    For VTU AI &amp; DS model experimentation, you can train a binary MobileNetV2 / ResNet-18 pothole classifier (on the Kaggle Pothole Dataset), export it to ONNX or serve it via a local Python microservice, and replace <span className="font-mono-tabular">analyzeRoadPhotograph()</span> in <span className="font-mono-tabular">server/ai.ts</span> to return true softmax probability scores.
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* SECTION 5: ACCOUNT SECURITY */}
          {section === 'security' && (
            <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Administrator Account Security
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Update your administrator email or rotate your password. Passwords are salted and hashed with <span className="font-mono-tabular">scrypt</span> on the server; rotating credentials invalidates prior sessions.
                </p>
              </div>

              {secFeedback && (
                <div
                  className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                    secFeedback.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {secFeedback.text}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label htmlFor="secCurrentPass" className="block text-xs font-semibold text-slate-700">
                    Current Password
                  </label>
                  <input
                    id="secCurrentPass"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={secCurrentPassword}
                    onChange={(e) => setSecCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="secEmail" className="block text-xs font-semibold text-slate-700">
                    Administrator Email
                  </label>
                  <input
                    id="secEmail"
                    type="email"
                    autoComplete="email"
                    required
                    value={secNewEmail}
                    onChange={(e) => setSecNewEmail(e.target.value)}
                    placeholder="Enter administrator email"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="secNewPass" className="block text-xs font-semibold text-slate-700">
                      New Password (min. 8 chars)
                    </label>
                    <input
                      id="secNewPass"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={secNewPassword}
                      onChange={(e) => setSecNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="secConfirmPass" className="block text-xs font-semibold text-slate-700">
                      Confirm New Password
                    </label>
                    <input
                      id="secConfirmPass"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={secConfirmPassword}
                      onChange={(e) => setSecConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={secSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  {secSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  <span>Update Administrator Credentials</span>
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
