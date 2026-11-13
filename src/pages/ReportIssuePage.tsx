import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Crosshair,
  Loader2,
  ScanEye,
  Trash2,
} from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { LeafletMap } from '../components/LeafletMap.tsx';
import {
  ISSUE_CATEGORIES,
  WARD_AREAS,
  type Complaint,
  type DuplicateMatch,
  type IssueCategory,
  type RoadInspectionResult,
} from '../types/civic.ts';

interface ReportIssuePageProps {
  initialCategory?: IssueCategory;
  onSubmitted: () => void;
  onTrackCode: (code: string) => void;
}

export function ReportIssuePage({
  initialCategory,
  onSubmitted,
  onTrackCode,
}: ReportIssuePageProps) {
  const [category, setCategory] = useState<string>(initialCategory || ISSUE_CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [wardArea, setWardArea] = useState<string>(WARD_AREAS[0]);
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<string>('12.9716');
  const [longitude, setLongitude] = useState<string>('77.5946');
  const [citizenName, setCitizenName] = useState('');
  const [citizenContact, setCitizenContact] = useState('');

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<RoadInspectionResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [duplicateHints, setDuplicateHints] = useState<DuplicateMatch[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<{
    complaint: Complaint;
    potentialDuplicates: DuplicateMatch[];
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory);
    }
  }, [initialCategory]);

  // Debounced duplicate check as user enters title or location
  useEffect(() => {
    if (title.trim().length < 5 && locationText.trim().length < 5) {
      setDuplicateHints([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/complaints/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            title,
            description,
            location_text: locationText,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { matches: DuplicateMatch[] };
          setDuplicateHints(data.matches || []);
        }
      } catch {
        // Ignore silent advisory errors
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [category, title, description, locationText, latitude, longitude]);

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAiResult(null);
    setAiError(null);
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file (JPG, PNG, or WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Photograph must be smaller than 10 MB.');
      return;
    }
    setErrorMsg(null);
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setAiResult(null);
    setAiError(null);
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation is not supported in this browser. Click the map or enter coordinates manually.');
      return;
    }
    setGpsLoading(true);
    setGpsStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGpsStatus('GPS coordinates captured from device.');
        setGpsLoading(false);
      },
      () => {
        setGpsStatus('Location permission unavailable. Click any point on the map to pin coordinates.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleRunAiInspection = async () => {
    if (!photoFile) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const form = new FormData();
      form.append('photo', photoFile);
      const res = await fetch('/api/ai/pothole-detect', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'AI inspection failed.');
      } else {
        setAiResult(data.result);
      }
    } catch {
      setAiError('Unable to reach the AI road inspection service.');
    } finally {
      setAiLoading(false);
    }
  };

  async function compressImageIfNeeded(file: File): Promise<File> {
    if (file.size <= 450 * 1024) return file;
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressed = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '.jpg'),
              { type: 'image/jpeg' }
            );
            resolve(compressed.size < file.size ? compressed : file);
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (title.trim().length < 3) {
      setErrorMsg('Please enter a descriptive complaint title (at least 3 characters).');
      return;
    }
    if (description.trim().length < 10) {
      setErrorMsg('Please provide at least 10 characters describing the civic issue.');
      return;
    }
    if (locationText.trim().length < 3) {
      setErrorMsg('Please enter the street name, area, or nearby landmark (at least 3 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const sendRequest = async (): Promise<Response> => {
        if (photoFile) {
          const uploadFile = await compressImageIfNeeded(photoFile);
          const formData = new FormData();
          formData.append('category', category);
          formData.append('title', title.trim());
          formData.append('description', description.trim());
          formData.append('ward_area', wardArea);
          formData.append('location_text', locationText.trim());
          if (latitude.trim()) formData.append('latitude', latitude.trim());
          if (longitude.trim()) formData.append('longitude', longitude.trim());
          if (citizenName.trim()) formData.append('citizen_name', citizenName.trim());
          if (citizenContact.trim()) formData.append('citizen_contact', citizenContact.trim());
          if (aiResult) {
            formData.append('severity', aiResult.recommendedSeverity);
            formData.append('ai_pothole_summary', JSON.stringify(aiResult));
          }
          formData.append('photo', uploadFile);

          return fetch('/api/complaints', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData,
          });
        }
        return fetch('/api/complaints', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            title: title.trim(),
            description: description.trim(),
            ward_area: wardArea,
            location_text: locationText.trim(),
            latitude: latitude.trim() || null,
            longitude: longitude.trim() || null,
            citizen_name: citizenName.trim() || null,
            citizen_contact: citizenContact.trim() || null,
            severity: aiResult?.recommendedSeverity || 'Medium',
            ai_pothole_summary: aiResult || null,
          }),
        });
      };

      let res: Response;
      try {
        res = await sendRequest();
      } catch {
        await new Promise((r) => setTimeout(r, 700));
        res = await sendRequest();
      }

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : { error: `Server returned status ${res.status}. Please try again.` };

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to submit complaint.');
      } else {
        setSubmittedRecord(data);
        onSubmitted();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Complaint submission error:', err);
      const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
      setErrorMsg(
        `Unable to reach the complaint submission API${detail}. If you are on a published URL, re-publish after this update so the latest backend is active.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  if (submittedRecord) {
    const { complaint } = submittedRecord;
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-emerald-200 bg-white p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Complaint Recorded Successfully
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Your grievance has been saved to the CivicCare SQLite database. Keep your unique Complaint ID below to track status updates and administrator remarks.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center">
            <div>
              <div className="text-xs font-medium text-slate-500">Unique Complaint ID</div>
              <div className="mt-1 font-mono-tabular text-2xl font-bold text-blue-700">
                {complaint.complaint_code}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCopyCode(complaint.complaint_code)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy ID'}</span>
              </button>
              <button
                type="button"
                onClick={() => onTrackCode(complaint.complaint_code)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                <span>Track This Complaint</span>
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-xs text-slate-500">Issue Category</div>
              <div className="mt-0.5 font-medium text-slate-900">{complaint.category}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Location &amp; Area</div>
              <div className="mt-0.5 font-medium text-slate-900">
                {complaint.location_text} ({complaint.ward_area})
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Rule-Based Triage Priority</div>
              <div className="mt-0.5 font-medium text-slate-900">
                {complaint.priority_level} (Score {complaint.priority_score}/100)
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Current Status</div>
              <div className="mt-0.5 font-medium text-slate-900">{complaint.status}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
            <p className="text-xs text-slate-500">
              Prototype Notice: Stored locally for demonstration; not dispatched to municipal offices.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmittedRecord(null);
                setTitle('');
                setDescription('');
                setLocationText('');
                clearPhoto();
              }}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer whitespace-nowrap"
            >
              Submit Another Issue
            </button>
          </div>
        </div>
      </div>
    );
  }

  const parsedLat = latitude ? Number(latitude) : null;
  const parsedLng = longitude ? Number(longitude) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Report a Civic Issue
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Provide accurate details, location coordinates, and an optional photograph. You will receive a unique tracking ID immediately upon submission.
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Left Main Form */}
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-7">
          {errorMsg && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="block text-xs font-semibold text-slate-700">
                Issue Category *
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="wardArea" className="block text-xs font-semibold text-slate-700">
                Ward / Neighborhood *
              </label>
              <select
                id="wardArea"
                value={wardArea}
                onChange={(e) => setWardArea(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                {WARD_AREAS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="title" className="block text-xs font-semibold text-slate-700">
              Complaint Title *
            </label>
            <input
              id="title"
              type="text"
              required
              maxLength={140}
              placeholder="e.g., Deep pothole near school bus stop on 12th Main"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-xs font-semibold text-slate-700">
              Detailed Description *
            </label>
            <textarea
              id="description"
              required
              rows={4}
              maxLength={2000}
              placeholder="Describe the size, duration, traffic or pedestrian safety impact, and nearby landmarks..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div>
            <label htmlFor="locationText" className="block text-xs font-semibold text-slate-700">
              Street / Area / Landmark *
            </label>
            <input
              id="locationText"
              type="text"
              required
              maxLength={250}
              placeholder="e.g., 100 Feet Road, opposite Government Primary School"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {/* Live Duplicate Advisory */}
          {duplicateHints.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <div className="text-xs text-amber-900">
                  <div className="font-semibold">
                    Possible Existing Similar Complaints Detected
                  </div>
                  <p className="mt-0.5 text-amber-800">
                    Review if your issue has already been reported before creating a duplicate entry:
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {duplicateHints.map((dup) => (
                      <li key={dup.complaint_code} className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200/80 bg-white/80 px-2.5 py-1.5">
                        <div>
                          <span className="font-mono-tabular font-semibold text-slate-900">{dup.complaint_code}</span>
                          <span className="mx-1.5 text-slate-400">·</span>
                          <span className="text-slate-800">{dup.title}</span>
                          <div className="text-[11px] text-slate-500">{dup.reasons.join(' · ')}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onTrackCode(dup.complaint_code)}
                          className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                        >
                          Track
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Photo Upload & Preview */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Upload Photograph (Optional, JPG/PNG/WEBP max 10 MB)
            </label>
            {!photoPreview ? (
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/30">
                <Camera className="h-6 w-6 text-slate-400" aria-hidden="true" />
                <span className="mt-2 text-sm font-medium text-slate-700">
                  Choose a photo from your device
                </span>
                <span className="mt-0.5 text-xs text-slate-500">
                  Clear daytime photos help administrators verify issues faster
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="sr-only"
                />
              </label>
            ) : (
              <div className="mt-1.5 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white">
                  <img
                    src={photoPreview}
                    alt="Uploaded civic issue preview"
                    className="max-h-60 w-full object-contain bg-slate-900/5"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleRunAiInspection}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60 cursor-pointer"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <ScanEye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>{aiLoading ? 'Inspecting Photo...' : 'Inspect Road Photo with Gemini AI'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Remove photo</span>
                  </button>
                </div>

                {aiError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {aiError}
                  </div>
                )}

                {aiResult && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        AI Visual Inspection: {aiResult.damageType}
                      </span>
                      <span className="font-medium text-blue-700">
                        Suggested Severity: {aiResult.recommendedSeverity}
                      </span>
                    </div>
                    <p className="text-slate-600">{aiResult.assessmentNote}</p>
                    <p className="text-[11px] text-slate-500">{aiResult.confidenceNote}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Optional Citizen Details */}
          <div className="border-t border-slate-200 pt-5">
            <div className="text-xs font-semibold text-slate-700">
              Citizen Contact Details (Optional — Private)
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Visible only to the authorized demo administrator. Never displayed on Public Issues.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Your Name (optional)"
                value={citizenName}
                onChange={(e) => setCitizenName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <input
                type="text"
                placeholder="Phone or Email (optional)"
                value={citizenContact}
                onChange={(e) => setCitizenContact(e.target.value)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {errorMsg && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{submitting ? 'Submitting Complaint...' : 'Submit Complaint'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Interactive Map Location Picker */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Location Coordinates
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Click anywhere on the map or capture GPS from your device.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Crosshair className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                <span>{gpsLoading ? 'Locating...' : 'Use GPS'}</span>
              </button>
            </div>

            {gpsStatus && (
              <p className="text-xs text-blue-700">{gpsStatus}</p>
            )}

            <LeafletMap
              mode="picker"
              selectedLat={parsedLat !== null && !Number.isNaN(parsedLat) ? parsedLat : null}
              selectedLng={parsedLng !== null && !Number.isNaN(parsedLng) ? parsedLng : null}
              onPickLocation={(lat, lng) => {
                setLatitude(String(lat));
                setLongitude(String(lng));
                setGpsStatus('Coordinates pinned on map.');
              }}
              heightClass="h-72"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="latitude" className="block text-[11px] font-medium text-slate-600">
                  Latitude
                </label>
                <input
                  id="latitude"
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="longitude" className="block text-[11px] font-medium text-slate-600">
                  Longitude
                </label>
                <input
                  id="longitude"
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600 space-y-2">
            <div className="font-semibold text-slate-900">
              How Priority Is Calculated
            </div>
            <p className="leading-relaxed">
              CivicCare calculates an initial transparent rule-based priority score (0–100) using your issue category, severity, safety keywords (such as school or hospital proximity), and attached GPS coordinates.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
