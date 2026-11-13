import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export function AboutContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (name.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (subject.trim().length < 3 || message.trim().length < 10) {
      setErrorMsg('Please enter a subject and message (at least 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : { error: `Server returned status ${res.status}.` };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not submit inquiry.');
      } else {
        setSuccessMsg(data.message || 'Inquiry saved successfully.');
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
      }
    } catch {
      setErrorMsg('Network error while submitting inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-12">
      {/* Header */}
      <section className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-blue-700">
          VTU 3rd-Semester BE (AI &amp; Data Science) · Community / Societal Project
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          About CivicCare
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          CivicCare is a working academic prototype of a Public Grievance and Civic Issue Reporting System built to demonstrate structured neighborhood issue logging, transparent tracking, spatial mapping, rule-based triage, and AI-assisted road photograph inspection.
        </p>
      </section>

      {/* Purpose, Problems, Benefits */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2.5">
          <h2 className="text-lg font-bold text-slate-900">Purpose of the Project</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Provide residents with an intuitive single portal to report local infrastructure issues with photographic evidence and GPS coordinates, while giving reviewers a centralized SQLite-backed console to verify, prioritize, and update each ticket through completion.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2.5">
          <h2 className="text-lg font-bold text-slate-900">Problems Addressed</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Informal complaints sent over chat or phone often lack exact coordinates, duplicate existing reports, or vanish without status visibility. CivicCare enforces structured categories, unique tracking IDs, duplicate similarity warnings, and an auditable status history.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2.5">
          <h2 className="text-lg font-bold text-slate-900">How the Platform Works</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Citizens submit reports via a validated form with Leaflet map pinning and optional photo upload. The backend persists each entry in SQLite, calculates a transparent rule-based priority score, and logs every subsequent administrator transition (Submitted &rarr; Verified &rarr; In Progress &rarr; Resolved or Rejected).
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2.5">
          <h2 className="text-lg font-bold text-slate-900">Social Benefits</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Encourages civic participation, highlights recurring neighborhood hotspots on OpenStreetMap, protects reporter privacy on public pages, and supports faster triage of hazards near schools, hospitals, and busy corridors.
          </p>
        </div>
      </section>

      {/* Explicit Real-World Limitations */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="text-base font-bold text-amber-950">
              Prototype Scope &amp; Real-World Limitations
            </h2>
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-amber-900">
              <li>
                <strong>No Automatic Government Dispatch:</strong> This is a student engineering prototype. Submitted complaints are <strong>not</strong> automatically forwarded to municipal corporations, BBMP, or government departments.
              </li>
              <li>
                <strong>Demonstration Admin Actions:</strong> All verification, department assignment, and resolution updates inside the Admin Dashboard are demonstration actions stored in the project SQLite database.
              </li>
              <li>
                <strong>AI Road Inspection Scope:</strong> Road photo analysis uses multimodal Gemini Vision inspection rather than a locally trained softmax CNN classifier; therefore, synthetic probability scores are intentionally omitted.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="grid gap-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Contact &amp; Project Feedback
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Questions about the CivicCare VTU project demonstration, dataset schema, or rule-based triage logic? Send a message below to record your inquiry in the database.
          </p>
          <div className="pt-2 text-xs text-slate-500 space-y-1">
            <div>Team: 4-Member BE AI &amp; Data Science (3rd Semester)</div>
            <div>Database: Persistent SQLite (<span className="font-mono-tabular">data/civiccare.db</span>)</div>
          </div>
        </div>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 lg:col-span-7">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contactName" className="block text-xs font-semibold text-slate-700">
                Full Name *
              </label>
              <input
                id="contactName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="contactEmail" className="block text-xs font-semibold text-slate-700">
                Email Address *
              </label>
              <input
                id="contactEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contactSubject" className="block text-xs font-semibold text-slate-700">
              Subject *
            </label>
            <input
              id="contactSubject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="contactMessage" className="block text-xs font-semibold text-slate-700">
              Message *
            </label>
            <textarea
              id="contactMessage"
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Send Message</span>
          </button>
        </form>
      </section>
    </div>
  );
}
