export const ISSUE_CATEGORIES = [
  'Pothole/Damaged Road',
  'Streetlight Failure',
  'Garbage Accumulation',
  'Drainage Problem',
  'Water Leakage',
  'Other',
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const COMPLAINT_STATUSES = [
  'Submitted',
  'Verified',
  'In Progress',
  'Resolved',
  'Rejected',
] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const SEVERITY_LEVELS = ['Low', 'Medium', 'High'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const DEMO_DEPARTMENTS = [
  'Roads & Infrastructure (Demo)',
  'Street Lighting Wing (Demo)',
  'Solid Waste Management (Demo)',
  'Stormwater & Drainage (Demo)',
  'Water Supply Board (Demo)',
  'General Civic Cell (Demo)',
] as const;

export const WARD_AREAS = [
  'Indiranagar',
  'Koramangala',
  'Jayanagar',
  'Malleshwaram',
  'Whitefield',
  'HSR Layout',
  'Vijayanagar',
  'Hebbal',
  'Yelahanka',
  'Rajajinagar',
  'Central Ward',
] as const;

export interface RoadInspectionResult {
  analyzedWithModel: string;
  isRoadSurface: boolean;
  potholeDetected: boolean;
  damageType: string;
  recommendedSeverity: SeverityLevel;
  visualObservations: string[];
  assessmentNote: string;
  confidenceNote: string;
}

export interface Complaint {
  id: number;
  complaint_code: string;
  category: IssueCategory | string;
  title: string;
  description: string;
  location_text: string;
  ward_area: string;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  citizen_name?: string | null;
  citizen_contact?: string | null;
  status: ComplaintStatus | string;
  severity: SeverityLevel | string;
  priority_score: number;
  priority_level: 'Standard' | 'Elevated' | 'Urgent' | string;
  priority_explanation: string[];
  assigned_department: string | null;
  admin_remarks: string | null;
  ai_pothole_summary?: RoadInspectionResult | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: number;
  complaint_id: number;
  status: string;
  remark: string;
  changed_by: string;
  created_at: string;
}

export interface DuplicateMatch {
  complaint_code: string;
  title: string;
  status: string;
  location_text: string;
  similarityScore: number;
  reasons: string[];
  created_at: string;
}

export interface PublicStats {
  total: number;
  submitted: number;
  verified: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  pending: number;
  resolutionRate: number;
}

export interface AnalyticsData {
  byCategory: Array<{ category: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byMonth: Array<{ month: string; total: number; resolved: number }>;
  byArea: Array<{
    area: string;
    total: number;
    resolved: number;
    active: number;
    highSeverity: number;
  }>;
  resolutionStats: {
    totalComplaints: number;
    resolvedCount: number;
    resolutionRate: number;
    avgResolutionHours: number;
    contactInquiries: number;
  };
}

export type AppPage =
  | 'home'
  | 'report'
  | 'track'
  | 'public'
  | 'about'
  | 'admin';

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
