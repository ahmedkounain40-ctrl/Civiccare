# CivicCare — Public Grievance & Civic Issue Reporting System

**Tagline:** *Report. Track. Improve Your Community.*  
**Academic Context:** VTU 3rd-Semester BE (Artificial Intelligence & Data Science) Community / Societal Project Prototype

---

## 1. Project Purpose & Scope

CivicCare is a working full-stack civic technology prototype that enables citizens to report neighborhood infrastructure issues (potholes, streetlight failures, garbage accumulation, drainage problems, water leaks, and general hazards), upload photographic evidence, capture or pin GPS coordinates, receive unique tracking IDs (`CIV-2026-XXX`), and track resolution progress in real time.

A protected **Administrator Dashboard** allows demonstration reviewers to inspect complaints, verify evidence, detect duplicate submissions, assign demonstration departments, update severity and status (`Submitted -> Verified -> In Progress -> Resolved` or `Rejected`), view OpenStreetMap spatial hotspots, and inspect Chart.js analytics.

> **Important Prototype Limitation:**  
> CivicCare is an academic demonstration prototype. Submitted complaints are persisted in a local SQLite database (`data/civiccare.db`) and are **not** automatically forwarded to municipal authorities or government portals. All administrative actions are demonstration workflow actions.

---

## 2. Technology Stack

| Layer | Technology Used |
| --- | --- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide Icons |
| **Charts** | Chart.js (Bar, Doughnut, and Line trend charts) |
| **Maps** | Leaflet with OpenStreetMap tiles (location picker, color-coded pins, hotspot overlay) |
| **Backend** | Node.js + Express (`server.ts` with Vite middleware in dev) |
| **Database** | SQLite via `better-sqlite3` (`data/civiccare.db`) |
| **File Uploads** | `multer` with MIME type & 5 MB size validation (`uploads/`) |
| **AI Road Inspection** | Server-side `@google/genai` (`gemini-4-hydrogen`) multimodal vision inspection |

*(Note: Adapted from the Flask specification to the Node.js + Express + Vite + SQLite runtime supported in this environment while preserving all functional, database, Chart.js, Leaflet, and AI capabilities.)*

---

## 3. Administrator Authentication & Configuration

Administrator access is protected by server-side `scrypt` password hashing, rate-limited login attempts, and signed HTTP-only session tokens. No default or demo credentials are shipped or displayed in the frontend.

Configure your administrator account using either method:

1. **Environment / Secrets (Recommended for Production):** Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in `.env` or AI Studio **Settings → Secrets**. On startup, `server/auth.ts` hashes the password with `crypto.scryptSync` and syncs the record into SQLite without storing plaintext.
2. **One-Time Initial Setup:** If no `ADMIN_PASSWORD` is configured yet, open **Admin Portal → First-time setup** to set your personal administrator email and password once (the setup endpoint locks permanently afterward).

---

## 4. Project Folder Structure

```text
.
├── index.html                 # HTML entry point & Google Fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono)
├── package.json               # Dependencies and dev/build/start scripts
├── server.ts                  # Express backend + Vite middleware + API routes + static uploads
├── server/
│   ├── db.ts                  # SQLite schema initialization, CIV-YYYY-NNN generator, sample seed records
│   ├── auth.ts                # scrypt password hashing, HMAC session tokens, login rate limiting
│   ├── priority.ts            # Transparent rule-based priority scoring engine (0–100)
│   ├── duplicates.ts          # Category, text similarity (Jaccard), and Haversine GPS duplicate detector
│   └── ai.ts                  # Server-side Gemini Vision road/pothole inspection module
├── src/
│   ├── App.tsx                # Hash-based client router & shared state
│   ├── index.css              # Tailwind CSS v4 + Leaflet CSS + tabular figure utilities
│   ├── types/civic.ts         # Shared TypeScript interfaces & civic domain constants
│   ├── components/
│   │   ├── Navbar.tsx         # Responsive 3-zone top navigation bar
│   │   ├── Footer.tsx         # Footer with navigation and prototype disclaimer
│   │   ├── StatusBadge.tsx    # Semantic status, severity, and priority indicators
│   │   ├── LeafletMap.tsx     # Reusable OpenStreetMap picker & color-coded viewer/hotspot map
│   │   └── AnalyticsCharts.tsx# Chart.js Bar, Doughnut, and Line chart components
│   └── pages/
│       ├── HomePage.tsx       # Hero, live SQLite stats, category cards, how-it-works
│       ├── ReportIssuePage.tsx# Validated form, GPS/map pin, photo preview, duplicate check, AI inspect
│       ├── TrackComplaintPage.tsx # ID lookup, 4-step progress timeline, remarks, status history
│       ├── PublicIssuesPage.tsx   # Privacy-safe public ledger (cards, table, interactive map)
│       ├── AboutContactPage.tsx   # Project overview, limitations, and SQLite contact form
│       └── AdminPortalPage.tsx    # Demo login, KPIs, Chart.js, CRUD updates, map dashboard, AI lab
├── data/
│   └── civiccare.db           # Auto-created SQLite database with 10 realistic sample records
└── uploads/                   # Uploaded citizen photographs
```

---

## 5. SQLite Database Schema

- **`complaints`**: Stores `complaint_code` (`CIV-2026-001`), `category`, `title`, `description`, `location_text`, `ward_area`, `latitude`, `longitude`, `image_url`, private `citizen_name` & `citizen_contact`, `status`, `severity`, `priority_score`, `priority_level`, `priority_explanation`, `assigned_department`, `admin_remarks`, `ai_pothole_summary`, `created_at`, and `updated_at`.
- **`complaint_history`**: Audit log of every submission and status/remark update (`complaint_id`, `status`, `remark`, `changed_by`, `created_at`).
- **`contact_messages`**: Stores inquiries submitted on the About & Contact page.

---

## 6. AI & Data Science Features

1. **AI Road & Pothole Inspection (`/api/ai/pothole-detect`)**:
   - Uses `@google/genai` (`gemini-4-hydrogen`) on the server to analyze uploaded road photographs and return structured visual observations, damage type, and suggested severity.
   - **Honesty Principle**: Because a zero-shot multimodal LLM does not output calibrated softmax class probabilities, CivicCare intentionally avoids displaying synthetic confidence percentages and documents how a custom PyTorch/ONNX CNN model trained on road pothole datasets can replace `analyzeRoadPhotograph()` in `server/ai.ts`.
2. **Transparent Rule-Based Priority (`server/priority.ts`)**:
   - Explicitly separated from AI prediction. Computes a deterministic 0–100 score from Issue Category weight (15–30), Severity (8–35), Safety context keywords near schools/hospitals/junctions (up to +25), and attached GPS coordinates (+10).
3. **Duplicate Complaint Detection (`server/duplicates.ts`)**:
   - Flags potentially matching existing open complaints by comparing category, Jaccard token overlap on title/description/location, and Haversine GPS distance ($\le 400\text{m}$).

---

## 7. Local Installation & Running Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment variables** (copy `.env.example` to `.env` and add `GEMINI_API_KEY` if testing live AI photo inspection):
   ```bash
   cp .env.example .env
   ```
3. **Run in development mode** (Express + Vite + SQLite on port 3000):
   ```bash
   npm run dev
   ```
4. **Build and run for production**:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

---

## 8. End-to-End Demonstration Walkthrough

1. Open **Report Issue**, select *Pothole/Damaged Road*, upload a road photo, pin a location on the map, and submit.
2. Copy the generated Complaint ID (e.g., `CIV-2026-011`).
3. Click **Admin Portal** and sign in with your configured administrator email and password.
4. Open **Complaint Management**, locate `CIV-2026-011`, and click **Inspect & Update**.
5. Click **Verify**, then update status to **In Progress** with a remark and save.
6. Return to the Citizen Site (**Track Complaint**), search `CIV-2026-011`, and observe the updated timeline and remark.
7. Return to the Admin Portal, mark `CIV-2026-011` as **Resolved**, and verify the final resolved state in **Track Complaint**.
