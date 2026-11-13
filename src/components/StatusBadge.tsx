import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'Resolved':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 whitespace-nowrap shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          Resolved
        </span>
      );
    case 'In Progress':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap shrink-0">
          <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          In Progress
        </span>
      );
    case 'Verified':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 whitespace-nowrap shrink-0">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
          Verified
        </span>
      );
    case 'Rejected':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 whitespace-nowrap shrink-0">
          <XCircle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0">
          <AlertCircle className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          Submitted
        </span>
      );
  }
}

export function SeverityText({ severity }: { severity: string }) {
  if (severity === 'High') {
    return <span className="text-xs font-semibold text-red-700">High</span>;
  }
  if (severity === 'Low') {
    return <span className="text-xs font-medium text-slate-600">Low</span>;
  }
  return <span className="text-xs font-semibold text-amber-700">Medium</span>;
}

export function PriorityText({ level, score }: { level: string; score: number }) {
  const color =
    level === 'Urgent'
      ? 'text-red-700'
      : level === 'Elevated'
      ? 'text-amber-700'
      : 'text-slate-700';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums ${color}`}>
      <span>{level}</span>
      <span className="font-mono-tabular text-slate-400 font-normal">({score})</span>
    </span>
  );
}
