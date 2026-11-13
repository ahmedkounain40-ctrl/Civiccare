import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { analyzeRoadPhotograph } from './server/ai.ts';
import {
  checkLoginRateLimit,
  clearFailedLogins,
  createAdminSessionToken,
  getRateLimitKey,
  hashPassword,
  isAdminConfigured,
  recordFailedLogin,
  syncAdminFromEnvironment,
  verifyAdminSessionToken,
  verifyPassword,
  type AdminUserRow,
} from './server/auth.ts';
import {
  db,
  generateNextComplaintCode,
  initializeDatabase,
  type ComplaintRow,
  type HistoryRow,
} from './server/db.ts';
import { findPotentialDuplicates, type StoredComplaintForDup } from './server/duplicates.ts';
import { calculateRuleBasedPriority } from './server/priority.ts';

const VALID_CATEGORIES = new Set([
  'Pothole/Damaged Road',
  'Streetlight Failure',
  'Garbage Accumulation',
  'Drainage Problem',
  'Water Leakage',
  'Other',
]);

const VALID_STATUSES = new Set(['Submitted', 'Verified', 'In Progress', 'Resolved', 'Rejected']);
const VALID_SEVERITIES = new Set(['Low', 'Medium', 'High']);

const COOKIE_NAME = 'civiccare_admin_session';

initializeDatabase();
syncAdminFromEnvironment();

function resolveUploadsDir(): string {
  const preferred = path.join(process.cwd(), 'uploads');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const tmpDir = path.join(os.tmpdir(), 'civiccare-uploads');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

const UPLOADS_DIR = resolveUploadsDir();

const SAMPLE_IMAGES_DIR = path.join(process.cwd(), 'src', 'assets', 'images');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const token = crypto.randomBytes(10).toString('hex');
    cb(null, `civic-${Date.now()}-${token}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image file uploads (JPG, PNG, WEBP) are allowed.'));
    }
  },
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image file uploads (JPG, PNG, WEBP) are allowed.'));
    }
  },
});

function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

function getAuthenticatedAdmin(req: Request): AdminUserRow | null {
  const cookies = parseCookies(req.headers.cookie);
  const cookieAdmin = verifyAdminSessionToken(cookies[COOKIE_NAME]);
  if (cookieAdmin) return cookieAdmin;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyAdminSessionToken(authHeader.slice(7).trim());
  }
  return null;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24,
  });
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }
  next();
}

function sanitizePublicComplaint(row: ComplaintRow) {
  return {
    id: row.id,
    complaint_code: row.complaint_code,
    category: row.category,
    title: row.title,
    description: row.description,
    location_text: row.location_text,
    ward_area: row.ward_area,
    latitude: row.latitude,
    longitude: row.longitude,
    image_url: row.image_url,
    status: row.status,
    severity: row.severity,
    priority_score: row.priority_score,
    priority_level: row.priority_level,
    priority_explanation: safeJsonParseArray(row.priority_explanation),
    assigned_department: row.assigned_department,
    admin_remarks: row.admin_remarks,
    ai_pothole_summary: row.ai_pothole_summary ? safeJsonParseObj(row.ai_pothole_summary) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function sanitizeAdminComplaint(row: ComplaintRow) {
  return {
    ...sanitizePublicComplaint(row),
    citizen_name: row.citizen_name,
    citizen_contact: row.citizen_contact,
  };
}

function safeJsonParseArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeJsonParseObj(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function inferWardArea(locationText: string, explicitWard?: string): string {
  if (explicitWard && explicitWard.trim()) return explicitWard.trim();
  const known = [
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
    'BTM Layout',
  ];
  const lower = locationText.toLowerCase();
  for (const w of known) {
    if (lower.includes(w.toLowerCase())) return w;
  }
  return 'Central Ward';
}

function getAllForDuplicates(): StoredComplaintForDup[] {
  return db
    .prepare(
      'SELECT id, complaint_code, category, title, description, location_text, latitude, longitude, status, created_at FROM complaints ORDER BY id DESC'
    )
    .all() as StoredComplaintForDup[];
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(UPLOADS_DIR));
  if (fs.existsSync(SAMPLE_IMAGES_DIR)) {
    app.use('/sample-images', express.static(SAMPLE_IMAGES_DIR));
  }

  app.get('/api/health', (_req, res) => {
    const row = db.prepare('SELECT COUNT(*) AS count FROM complaints').get() as { count: number };
    res.json({
      ok: true,
      mode: process.env.NODE_ENV || 'development',
      complaintsCount: row.count,
    });
  });

  // Public Summary Stats
  app.get('/api/stats', (_req, res) => {
    const counts = db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) AS submitted,
          SUM(CASE WHEN status = 'Verified' THEN 1 ELSE 0 END) AS verified,
          SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS inProgress,
          SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
          SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
        FROM complaints`
      )
      .get() as Record<string, number>;

    const total = counts.total || 0;
    const resolved = counts.resolved || 0;
    const pending = (counts.submitted || 0) + (counts.verified || 0) + (counts.inProgress || 0);
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    res.json({
      total,
      submitted: counts.submitted || 0,
      verified: counts.verified || 0,
      inProgress: counts.inProgress || 0,
      resolved,
      rejected: counts.rejected || 0,
      pending,
      resolutionRate,
    });
  });

  // Public Issues List (omits citizen_name & citizen_contact)
  app.get('/api/complaints/public', (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const rows = db
      .prepare('SELECT * FROM complaints ORDER BY datetime(created_at) DESC, id DESC')
      .all() as ComplaintRow[];

    const filtered = rows
      .filter((r) => {
        if (category && category !== 'All' && r.category !== category) return false;
        if (status && status !== 'All' && r.status !== status) return false;
        if (search) {
          const hay = `${r.complaint_code} ${r.title} ${r.location_text} ${r.ward_area} ${r.category}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      })
      .map(sanitizePublicComplaint);

    res.json({ complaints: filtered });
  });

  // Check Potential Duplicates
  app.post('/api/complaints/check-duplicates', (req, res) => {
    const { category, title, description, location_text, latitude, longitude } = req.body ?? {};
    if (!category || (!title && !location_text)) {
      res.json({ matches: [] });
      return;
    }
    const existing = getAllForDuplicates();
    const matches = findPotentialDuplicates(
      {
        category: String(category),
        title: String(title || ''),
        description: String(description || ''),
        locationText: String(location_text || ''),
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
      },
      existing
    );
    res.json({ matches });
  });

  // Track Single Complaint by Code (public, excludes private citizen details)
  app.get('/api/complaints/track/:code', (req, res) => {
    const code = req.params.code.trim().toUpperCase();
    const row = db
      .prepare('SELECT * FROM complaints WHERE UPPER(complaint_code) = ?')
      .get(code) as ComplaintRow | undefined;

    if (!row) {
      res.status(404).json({
        error: `No complaint found matching ID "${code}". Check the ID format (e.g., CIV-2026-001).`,
      });
      return;
    }

    const history = db
      .prepare('SELECT * FROM complaint_history WHERE complaint_id = ? ORDER BY datetime(created_at) ASC, id ASC')
      .all(row.id) as HistoryRow[];

    res.json({
      complaint: sanitizePublicComplaint(row),
      history,
    });
  });

  const optionalPhotoUpload = (req: Request, res: Response, next: NextFunction) => {
    if (req.is('multipart/form-data')) {
      upload.single('photo')(req, res, next);
    } else {
      next();
    }
  };

  // Submit New Complaint (supports both multipart/form-data and application/json)
  app.post('/api/complaints', optionalPhotoUpload, (req, res) => {
    try {
      const body = req.body ?? {};
      const category = String(body.category || '').trim();
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      const locationText = String(body.location_text || '').trim();
      const wardArea = inferWardArea(locationText, body.ward_area ? String(body.ward_area) : undefined);
      const citizenName = body.citizen_name ? String(body.citizen_name).trim() : null;
      const citizenContact = body.citizen_contact ? String(body.citizen_contact).trim() : null;
      const aiSummary = body.ai_pothole_summary
        ? typeof body.ai_pothole_summary === 'string'
          ? body.ai_pothole_summary
          : JSON.stringify(body.ai_pothole_summary)
        : null;

      if (!VALID_CATEGORIES.has(category)) {
        res.status(400).json({ error: 'Please select a valid civic issue category.' });
        return;
      }
      if (title.length < 3 || title.length > 140) {
        res.status(400).json({ error: 'Complaint title must be between 3 and 140 characters.' });
        return;
      }
      if (description.length < 10 || description.length > 2000) {
        res.status(400).json({ error: 'Please provide a clear description (at least 10 characters).' });
        return;
      }
      if (locationText.length < 3 || locationText.length > 250) {
        res.status(400).json({ error: 'Please enter a valid area, street, or landmark (at least 3 characters).' });
        return;
      }

      const rawLat = body.latitude !== undefined && body.latitude !== null && body.latitude !== '' ? Number(body.latitude) : null;
      const rawLng = body.longitude !== undefined && body.longitude !== null && body.longitude !== '' ? Number(body.longitude) : null;
      const latitude = rawLat !== null && !Number.isNaN(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : null;
      const longitude = rawLng !== null && !Number.isNaN(rawLng) && rawLng >= -180 && rawLng <= 180 ? rawLng : null;

      const requestedSeverity = String(body.severity || 'Medium');
      const severity = VALID_SEVERITIES.has(requestedSeverity) ? requestedSeverity : 'Medium';

      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const nowIso = new Date().toISOString();

      const priority = calculateRuleBasedPriority({
        category,
        severity,
        title,
        description,
        locationText,
        latitude,
        longitude,
      });

      const insertStmt = db.prepare(`
        INSERT INTO complaints (
          complaint_code, category, title, description, location_text, ward_area,
          latitude, longitude, image_url, citizen_name, citizen_contact,
          status, severity, priority_score, priority_level, priority_explanation,
          assigned_department, admin_remarks, ai_pothole_summary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?, NULL, ?, ?, ?, ?)
      `);

      const historyStmt = db.prepare(`
        INSERT INTO complaint_history (complaint_id, status, remark, changed_by, created_at)
        VALUES (?, 'Submitted', ?, 'Citizen Submission', ?)
      `);

      const createTx = db.transaction(() => {
        const complaintCode = generateNextComplaintCode();
        const result = insertStmt.run(
          complaintCode,
          category,
          title,
          description,
          locationText,
          wardArea,
          latitude,
          longitude,
          imageUrl,
          citizenName || null,
          citizenContact || null,
          severity,
          priority.score,
          priority.level,
          JSON.stringify(priority.factors),
          'Complaint received in CivicCare prototype queue. Awaiting administrator review.',
          aiSummary,
          nowIso,
          nowIso
        );
        const complaintId = Number(result.lastInsertRowid);
        historyStmt.run(
          complaintId,
          imageUrl
            ? 'Citizen submitted complaint with supporting photograph.'
            : 'Citizen submitted complaint via CivicCare web portal.',
          nowIso
        );
        return complaintId;
      });

      const createdId = createTx();
      const createdRow = db.prepare('SELECT * FROM complaints WHERE id = ?').get(createdId) as ComplaintRow;
      const duplicates = findPotentialDuplicates(
        {
          id: createdId,
          category,
          title,
          description,
          locationText,
          latitude,
          longitude,
        },
        getAllForDuplicates()
      );

      res.status(201).json({
        complaint: sanitizePublicComplaint(createdRow),
        potentialDuplicates: duplicates,
      });
    } catch (err) {
      console.error('Error creating complaint:', err);
      const msg = err instanceof Error ? err.message : 'Unable to submit complaint.';
      res.status(400).json({ error: msg });
    }
  });

  // Contact / Feedback Form
  app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body ?? {};
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim();
    const cleanSubject = String(subject || '').trim();
    const cleanMessage = String(message || '').trim();

    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (cleanSubject.length < 3 || cleanMessage.length < 10) {
      res.status(400).json({ error: 'Please enter a subject and message (at least 10 characters).' });
      return;
    }

    const nowIso = new Date().toISOString();
    db.prepare(
      'INSERT INTO contact_messages (name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(cleanName, cleanEmail, cleanSubject, cleanMessage, nowIso);

    res.status(201).json({ ok: true, message: 'Thank you. Your inquiry has been recorded.' });
  });

  // AI Road / Pothole Inspection Endpoint (Gemini Vision)
  app.post('/api/ai/pothole-detect', memoryUpload.single('photo'), async (req, res) => {
    try {
      let base64Data = '';
      let mimeType = 'image/jpeg';

      if (req.file) {
        base64Data = req.file.buffer.toString('base64');
        mimeType = req.file.mimetype;
      } else if (req.body && typeof req.body.samplePath === 'string') {
        const cleanName = path.basename(req.body.samplePath);
        const targetSample = path.join(SAMPLE_IMAGES_DIR, cleanName);
        if (!fs.existsSync(targetSample)) {
          res.status(404).json({ error: 'Sample image file not found.' });
          return;
        }
        base64Data = fs.readFileSync(targetSample).toString('base64');
        mimeType = cleanName.endsWith('.png') ? 'image/png' : 'image/jpeg';
      } else {
        res.status(400).json({ error: 'Please upload a road photograph (JPG, PNG, or WEBP) to inspect.' });
        return;
      }

      const result = await analyzeRoadPhotograph(base64Data, mimeType);
      res.json({ result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI image inspection failed.';
      res.status(500).json({ error: msg });
    }
  });

  // Admin Authentication Routes
  app.get('/api/admin/setup-status', (_req, res) => {
    res.json({ configured: isAdminConfigured() });
  });

  app.post('/api/admin/setup', (req, res) => {
    if (isAdminConfigured()) {
      res.status(403).json({
        error: 'Administrator account is already configured. Please sign in.',
      });
      return;
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid administrator email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Administrator password must be at least 8 characters long.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const passwordHash = hashPassword(password);
    const info = db
      .prepare(
        'INSERT INTO admin_users (email, password_hash, session_version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)'
      )
      .run(email, passwordHash, nowIso, nowIso);

    const createdAdmin = db
      .prepare('SELECT * FROM admin_users WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as AdminUserRow;

    const token = createAdminSessionToken(createdAdmin);
    setSessionCookie(req, res, token);
    res.status(201).json({
      authenticated: true,
      user: createdAdmin.email,
      token,
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const email = String(req.body?.username || req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!isAdminConfigured()) {
      res.status(403).json({
        error: 'Administrator credentials are not configured yet. Complete initial setup or configure ADMIN_PASSWORD.',
      });
      return;
    }

    const limitKey = getRateLimitKey(req, email);
    const rate = checkLoginRateLimit(limitKey);
    if (!rate.allowed) {
      res.status(429).json({
        error: `Too many failed sign-in attempts. Please wait ${rate.retryAfterSec} seconds and try again.`,
      });
      return;
    }

    if (!email || !password) {
      res.status(400).json({ error: 'Please enter both your administrator email and password.' });
      return;
    }

    const admin = db
      .prepare('SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)')
      .get(email) as AdminUserRow | undefined;

    if (!admin || !verifyPassword(password, admin.password_hash)) {
      recordFailedLogin(limitKey);
      res.status(401).json({
        error: 'Invalid administrator email or password.',
      });
      return;
    }

    clearFailedLogins(limitKey);
    const token = createAdminSessionToken(admin);
    setSessionCookie(req, res, token);
    res.json({
      authenticated: true,
      user: admin.email,
      token,
    });
  });

  app.post('/api/admin/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/admin/me', (req, res) => {
    const admin = getAuthenticatedAdmin(req);
    if (!admin) {
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, user: admin.email });
  });

  app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    const currentAdmin = getAuthenticatedAdmin(req);
    if (!currentAdmin) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const newEmail = req.body?.newEmail ? String(req.body.newEmail).trim().toLowerCase() : currentAdmin.email;

    if (!verifyPassword(currentPassword, currentAdmin.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      res.status(400).json({ error: 'Please provide a valid administrator email address.' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const nextHash = hashPassword(newPassword);
    const nowIso = new Date().toISOString();
    db.prepare(
      'UPDATE admin_users SET email = ?, password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?'
    ).run(newEmail, nextHash, nowIso, currentAdmin.id);

    const updatedAdmin = db
      .prepare('SELECT * FROM admin_users WHERE id = ?')
      .get(currentAdmin.id) as AdminUserRow;

    const token = createAdminSessionToken(updatedAdmin);
    setSessionCookie(req, res, token);
    res.json({
      ok: true,
      user: updatedAdmin.email,
      token,
    });
  });

  // Admin Protected: List All Complaints (with search, filters, sorting)
  app.get('/api/admin/complaints', requireAdmin, (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const sortBy = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'newest';

    const rows = db.prepare('SELECT * FROM complaints').all() as ComplaintRow[];

    const filtered = rows.filter((r) => {
      if (category && category !== 'All' && r.category !== category) return false;
      if (status && status !== 'All' && r.status !== status) return false;
      if (dateFrom && r.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.created_at.slice(0, 10) > dateTo) return false;
      if (search) {
        const hay = `${r.complaint_code} ${r.title} ${r.location_text} ${r.ward_area} ${r.category} ${r.citizen_name || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const sevRank: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
    filtered.sort((a, b) => {
      if (sortBy === 'oldest') return a.created_at.localeCompare(b.created_at);
      if (sortBy === 'priority') return b.priority_score - a.priority_score;
      if (sortBy === 'severity') return (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0);
      return b.created_at.localeCompare(a.created_at);
    });

    res.json({ complaints: filtered.map(sanitizeAdminComplaint) });
  });

  // Admin Protected: Complaint Details + History + Duplicate Check
  app.get('/api/admin/complaints/:id', requireAdmin, (req, res) => {
    const idParam = req.params.id;
    const row = db
      .prepare('SELECT * FROM complaints WHERE id = ? OR UPPER(complaint_code) = ?')
      .get(Number(idParam) || -1, idParam.toUpperCase()) as ComplaintRow | undefined;

    if (!row) {
      res.status(404).json({ error: 'Complaint not found.' });
      return;
    }

    const history = db
      .prepare('SELECT * FROM complaint_history WHERE complaint_id = ? ORDER BY datetime(created_at) ASC, id ASC')
      .all(row.id) as HistoryRow[];

    const duplicates = findPotentialDuplicates(
      {
        id: row.id,
        category: row.category,
        title: row.title,
        description: row.description,
        locationText: row.location_text,
        latitude: row.latitude,
        longitude: row.longitude,
      },
      getAllForDuplicates()
    );

    res.json({
      complaint: sanitizeAdminComplaint(row),
      history,
      duplicates,
    });
  });

  // Admin Protected: Update Complaint Status, Severity, Department, Remarks
  app.patch('/api/admin/complaints/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id) as ComplaintRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Complaint not found.' });
      return;
    }

    const { status, severity, assigned_department, admin_remarks } = req.body ?? {};
    const nextStatus = status ? String(status) : existing.status;
    const nextSeverity = severity ? String(severity) : existing.severity;
    const nextDepartment =
      assigned_department !== undefined
        ? assigned_department
          ? String(assigned_department).trim()
          : null
        : existing.assigned_department;
    const nextRemarks =
      admin_remarks !== undefined ? String(admin_remarks).trim() : existing.admin_remarks || '';

    if (!VALID_STATUSES.has(nextStatus)) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }
    if (!VALID_SEVERITIES.has(nextSeverity)) {
      res.status(400).json({ error: 'Invalid severity value.' });
      return;
    }
    if (nextStatus === 'Rejected' && nextRemarks.length < 5) {
      res.status(400).json({
        error: 'Please provide an explanation in Administrator Remarks when rejecting a complaint.',
      });
      return;
    }

    const priority = calculateRuleBasedPriority({
      category: existing.category,
      severity: nextSeverity,
      title: existing.title,
      description: existing.description,
      locationText: existing.location_text,
      latitude: existing.latitude,
      longitude: existing.longitude,
    });

    const nowIso = new Date().toISOString();

    const updateTx = db.transaction(() => {
      db.prepare(
        `UPDATE complaints
         SET status = ?, severity = ?, priority_score = ?, priority_level = ?, priority_explanation = ?,
             assigned_department = ?, admin_remarks = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        nextStatus,
        nextSeverity,
        priority.score,
        priority.level,
        JSON.stringify(priority.factors),
        nextDepartment,
        nextRemarks,
        nowIso,
        id
      );

      const statusChanged = nextStatus !== existing.status;
      const remarkChanged = nextRemarks !== (existing.admin_remarks || '');
      const historyRemark =
        nextRemarks ||
        (statusChanged
          ? `Status updated from ${existing.status} to ${nextStatus}.`
          : `Updated severity or department assignment.`);

      if (statusChanged || remarkChanged || nextDepartment !== existing.assigned_department || nextSeverity !== existing.severity) {
        db.prepare(
          'INSERT INTO complaint_history (complaint_id, status, remark, changed_by, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(id, nextStatus, historyRemark, 'Administrator', nowIso);
      }
    });

    updateTx();

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id) as ComplaintRow;
    const history = db
      .prepare('SELECT * FROM complaint_history WHERE complaint_id = ? ORDER BY datetime(created_at) ASC, id ASC')
      .all(id) as HistoryRow[];

    res.json({
      complaint: sanitizeAdminComplaint(updated),
      history,
    });
  });

  // Admin Protected: Analytics Aggregation for Chart.js
  app.get('/api/admin/analytics', requireAdmin, (_req, res) => {
    const byCategory = db
      .prepare('SELECT category, COUNT(*) AS count FROM complaints GROUP BY category ORDER BY count DESC')
      .all() as Array<{ category: string; count: number }>;

    const byStatus = db
      .prepare('SELECT status, COUNT(*) AS count FROM complaints GROUP BY status')
      .all() as Array<{ status: string; count: number }>;

    const byMonth = db
      .prepare(
        `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS total,
         SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved
         FROM complaints
         GROUP BY month
         ORDER BY month ASC`
      )
      .all() as Array<{ month: string; total: number; resolved: number }>;

    const byArea = db
      .prepare(
        `SELECT ward_area AS area,
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
          SUM(CASE WHEN status IN ('Submitted', 'Verified', 'In Progress') THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN severity = 'High' THEN 1 ELSE 0 END) AS highSeverity
         FROM complaints
         GROUP BY ward_area
         ORDER BY total DESC`
      )
      .all() as Array<{
        area: string;
        total: number;
        resolved: number;
        active: number;
        highSeverity: number;
      }>;

    const resolvedRows = db
      .prepare("SELECT created_at, updated_at FROM complaints WHERE status = 'Resolved'")
      .all() as Array<{ created_at: string; updated_at: string }>;

    let avgResolutionHours = 0;
    if (resolvedRows.length > 0) {
      const totalHrs = resolvedRows.reduce((acc, r) => {
        const diff = Math.max(0, new Date(r.updated_at).getTime() - new Date(r.created_at).getTime());
        return acc + diff / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round(totalHrs / resolvedRows.length);
    }

    const totalRow = db.prepare('SELECT COUNT(*) AS total FROM complaints').get() as { total: number };
    const messagesCount = db.prepare('SELECT COUNT(*) AS count FROM contact_messages').get() as { count: number };

    res.json({
      byCategory,
      byStatus,
      byMonth,
      byArea,
      resolutionStats: {
        totalComplaints: totalRow.total,
        resolvedCount: resolvedRows.length,
        resolutionRate:
          totalRow.total > 0 ? Math.round((resolvedRows.length / totalRow.total) * 100) : 0,
        avgResolutionHours,
        contactInquiries: messagesCount.count,
      },
    });
  });

  // Multer & API error handler
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err) {
      console.error('Express middleware error:', err);
      res.status(400).json({ error: err.message || 'Invalid request.' });
      return;
    }
    next();
  });

  // Vite dev middleware or static dist serving
  const distDir = path.join(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'index.html'));
  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found.' });
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = process.env.DEFAULT_APP_PORT
    ? Number(process.env.DEFAULT_APP_PORT)
    : process.env.PORT
      ? Number(process.env.PORT)
      : 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CivicCare server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CivicCare server:', err);
  process.exit(1);
});
