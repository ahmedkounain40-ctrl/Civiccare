import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { calculateRuleBasedPriority } from './priority.ts';

export interface ComplaintRow {
  id: number;
  complaint_code: string;
  category: string;
  title: string;
  description: string;
  location_text: string;
  ward_area: string;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  citizen_name: string | null;
  citizen_contact: string | null;
  status: string;
  severity: string;
  priority_score: number;
  priority_level: string;
  priority_explanation: string;
  assigned_department: string | null;
  admin_remarks: string | null;
  ai_pothole_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryRow {
  id: number;
  complaint_id: number;
  status: string;
  remark: string;
  changed_by: string;
  created_at: string;
}

export interface ContactRow {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
}

function resolveWritableDir(preferred: string, fallbackName: string): string {
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const tmpDir = path.join(os.tmpdir(), fallbackName);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

const DATA_DIR = resolveWritableDir(path.join(process.cwd(), 'data'), 'civiccare-data');
const DB_PATH = path.join(DATA_DIR, 'civiccare.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_code TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location_text TEXT NOT NULL,
      ward_area TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      image_url TEXT,
      citizen_name TEXT,
      citizen_contact TEXT,
      status TEXT NOT NULL DEFAULT 'Submitted',
      severity TEXT NOT NULL DEFAULT 'Medium',
      priority_score INTEGER NOT NULL DEFAULT 40,
      priority_level TEXT NOT NULL DEFAULT 'Standard',
      priority_explanation TEXT NOT NULL DEFAULT '[]',
      assigned_department TEXT,
      admin_remarks TEXT,
      ai_pothole_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaint_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      remark TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      session_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_complaints_code ON complaints(complaint_code);
    CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
    CREATE INDEX IF NOT EXISTS idx_history_complaint_id ON complaint_history(complaint_id);
  `);

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM complaints').get() as { count: number };
  if (countRow.count === 0) {
    seedSampleData();
  }
}

export function generateNextComplaintCode(): string {
  const year = new Date().getFullYear();
  const prefix = `CIV-${year}-`;
  const rows = db
    .prepare('SELECT complaint_code FROM complaints WHERE complaint_code LIKE ?')
    .all(`${prefix}%`) as Array<{ complaint_code: string }>;

  let maxNum = 0;
  for (const row of rows) {
    const parts = row.complaint_code.split('-');
    const parsed = Number.parseInt(parts[2] ?? '0', 10);
    if (!Number.isNaN(parsed) && parsed > maxNum) {
      maxNum = parsed;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

function seedSampleData(): void {
  const samples = [
    {
      code: 'CIV-2026-001',
      category: 'Pothole/Damaged Road',
      title: 'Deep pothole near 100 Feet Road school crossing',
      description:
        'A wide asphalt crater approximately 1.2m across has formed right before the pedestrian crossing outside the primary school gate, causing two-wheelers to swerve abruptly.',
      location_text: '100 Feet Road, near 12th Main Junction, Indiranagar',
      ward_area: 'Indiranagar',
      latitude: 12.9718,
      longitude: 77.6412,
      image_url: '/sample-images/sample_pothole_road_1794514607155.jpg',
      citizen_name: 'Ananya Rao',
      citizen_contact: '+91 98450 11223',
      status: 'In Progress',
      severity: 'High',
      assigned_department: 'Roads & Infrastructure (Demo)',
      admin_remarks:
        'Site verified via photo & GPS coordinates. Demo road repair crew scheduled for cold-mix patching.',
      created_at: '2026-11-04T09:15:00.000Z',
      updated_at: '2026-11-06T14:30:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Citizen submitted complaint with road photograph and GPS coordinates.',
          changed_by: 'Citizen Submission',
          created_at: '2026-11-04T09:15:00.000Z',
        },
        {
          status: 'Verified',
          remark: 'Verified high-priority hazard near school crossing.',
          changed_by: 'Demo Admin',
          created_at: '2026-11-05T10:20:00.000Z',
        },
        {
          status: 'In Progress',
          remark: 'Demo road repair crew scheduled for cold-mix patching.',
          changed_by: 'Demo Admin',
          created_at: '2026-11-06T14:30:00.000Z',
        },
      ],
    },
    {
      code: 'CIV-2026-002',
      category: 'Streetlight Failure',
      title: 'Three consecutive LED streetlamps unlit on 4th Block Avenue',
      description:
        'Poles SL-402 through SL-404 have remained completely dark since Tuesday evening, leaving the footpath near the bus stop poorly lit after 6:30 PM.',
      location_text: '8th Cross, 4th Block Residential Avenue, Koramangala',
      ward_area: 'Koramangala',
      latitude: 12.9352,
      longitude: 77.6245,
      image_url: '/sample-images/sample_streetlight_dusk_1794514606907.jpg',
      citizen_name: 'Rohan Kulkarni',
      citizen_contact: 'rohan.k@example.com',
      status: 'Verified',
      severity: 'Medium',
      assigned_department: 'Street Lighting Wing (Demo)',
      admin_remarks: 'Confirmed outage on feeder line B-4. Assigned to demo electrical maintenance team.',
      created_at: '2026-11-08T18:45:00.000Z',
      updated_at: '2026-11-09T11:10:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Citizen reported streetlight outage with twilight photo.',
          changed_by: 'Citizen Submission',
          created_at: '2026-11-08T18:45:00.000Z',
        },
        {
          status: 'Verified',
          remark: 'Confirmed outage on feeder line B-4. Assigned to demo electrical maintenance team.',
          changed_by: 'Demo Admin',
          created_at: '2026-11-09T11:10:00.000Z',
        },
      ],
    },
    {
      code: 'CIV-2026-003',
      category: 'Drainage Problem',
      title: 'Blocked storm drain grate causing rainwater pooling',
      description:
        'Dry leaves, plastic wrappers, and silt have clogged the roadside storm drain grate, causing standing water across the pedestrian curb after brief rain.',
      location_text: '11th Main Road, near South End Circle, Jayanagar',
      ward_area: 'Jayanagar',
      latitude: 12.9308,
      longitude: 77.5838,
      image_url: '/sample-images/sample_drainage_overflow_1794514607607.jpg',
      citizen_name: 'Meera Nair',
      citizen_contact: '+91 99001 44556',
      status: 'Resolved',
      severity: 'High',
      assigned_department: 'Stormwater & Drainage (Demo)',
      admin_remarks: 'Grate cleared of debris and silt trap flushed during demonstration inspection cycle.',
      created_at: '2026-10-12T08:30:00.000Z',
      updated_at: '2026-10-16T16:00:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Citizen reported blocked storm drain grate.',
          changed_by: 'Citizen Submission',
          created_at: '2026-10-12T08:30:00.000Z',
        },
        {
          status: 'Verified',
          remark: 'Verified blockage from submitted site photograph.',
          changed_by: 'Demo Admin',
          created_at: '2026-10-13T09:45:00.000Z',
        },
        {
          status: 'In Progress',
          remark: 'Desilting team dispatched in demo workflow.',
          changed_by: 'Demo Admin',
          created_at: '2026-10-14T11:00:00.000Z',
        },
        {
          status: 'Resolved',
          remark: 'Grate cleared of debris and silt trap flushed during demonstration inspection cycle.',
          changed_by: 'Demo Admin',
          created_at: '2026-10-16T16:00:00.000Z',
        },
      ],
    },
    {
      code: 'CIV-2026-004',
      category: 'Garbage Accumulation',
      title: 'Uncollected waste bags piled beside community park corner',
      description:
        'Mixed domestic waste bags have accumulated for three days beside the east entrance of the neighborhood park, attracting stray dogs.',
      location_text: 'Margosa Road, 15th Cross Corner, Malleshwaram',
      ward_area: 'Malleshwaram',
      latitude: 13.0031,
      longitude: 77.5643,
      image_url: null,
      citizen_name: 'Karthik Shetty',
      citizen_contact: '+91 98802 33119',
      status: 'Submitted',
      severity: 'Medium',
      assigned_department: null,
      admin_remarks: 'Awaiting initial triage by demo administrator.',
      created_at: '2026-11-11T07:50:00.000Z',
      updated_at: '2026-11-11T07:50:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Complaint submitted by citizen for garbage accumulation.',
          changed_by: 'Citizen Submission',
          created_at: '2026-11-11T07:50:00.000Z',
        },
      ],
    },
    {
      code: 'CIV-2026-005',
      category: 'Water Leakage',
      title: 'Continuous potable water main valve leak flooding lane',
      description:
        'A cracked supply valve junction near the community clinic is leaking clean water continuously onto the asphalt for the past 18 hours.',
      location_text: 'ITPL Main Road, near Hope Farm Junction, Whitefield',
      ward_area: 'Whitefield',
      latitude: 12.9815,
      longitude: 77.7498,
      image_url: null,
      citizen_name: 'Deepak Verma',
      citizen_contact: 'deepak.v@example.com',
      status: 'In Progress',
      severity: 'High',
      assigned_department: 'Water Supply Board (Demo)',
      admin_remarks: 'Marked Urgent due to continuous water loss near clinic. Valve replacement crew assigned (Demo).',
      created_at: '2026-11-09T06:20:00.000Z',
      updated_at: '2026-11-10T13:15:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Citizen reported continuous water main leak.',
          changed_by: 'Citizen Submission',
          created_at: '2026-11-09T06:20:00.000Z',
        },
        {
          status: 'Verified',
          remark: 'Confirmed urgent water loss near clinic.',
          changed_by: 'Demo Admin',
          created_at: '2026-11-09T10:00:00.000Z',
        },
        {
          status: 'In Progress',
          remark: 'Valve replacement crew assigned (Demo).',
          changed_by: 'Demo Admin',
          created_at: '2026-11-10T13:15:00.000Z',
        },
      ],
    },
    {
      code: 'CIV-2026-006',
      category: 'Pothole/Damaged Road',
      title: 'Broken road shoulder near bus bay',
      description:
        'Edge of the asphalt road has eroded into a 15cm drop along the passenger boarding zone, creating a trip hazard during peak morning hours.',
      location_text: '27th Main Road, Sector 1 Bus Stop, HSR Layout',
      ward_area: 'HSR Layout',
      latitude: 12.9121,
      longitude: 77.6446,
      image_url: null,
      citizen_name: 'Sneha Bhat',
      citizen_contact: '+91 97412 55678',
      status: 'Resolved',
      severity: 'Medium',
      assigned_department: 'Roads & Infrastructure (Demo)',
      admin_remarks: 'Road shoulder resurfaced and compacted in demonstration resolution log.',
      created_at: '2026-09-18T10:10:00.000Z',
      updated_at: '2026-09-25T17:40:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Citizen submitted complaint for broken road shoulder.',
          changed_by: 'Citizen Submission',
          created_at: '2026-09-18T10:10:00.000Z',
        },
        {
          status: 'Verified',
          remark: 'Verified damage at Sector 1 bus bay.',
          changed_by: 'Demo Admin',
          created_at: '2026-09-19T12:00:00.000Z',
        },
        {
          status: 'Resolved',
          remark: 'Road shoulder resurfaced and compacted in demonstration resolution log.',
          changed_by: 'Demo Admin',
          created_at: '2026-09-25T17:40:00.000Z',
        },
      ],
    },
    {
      code: 'CIV-2026-007',
      category: 'Other',
      title: 'Damaged pedestrian railing near subway stairs',
      description:
        'A two-meter section of the steel safety railing beside the pedestrian underpass stairs is bent and loose.',
      location_text: 'Chord Road, near Vijayanagar Metro Station',
      ward_area: 'Vijayanagar',
      latitude: 12.9708,
      longitude: 77.5371,
      image_url: null,
      citizen_name: 'Prashanth Gowda',
      citizen_contact: '+91 94480 99812',
      status: 'Submitted',
      severity: 'Low',
      assigned_department: null,
      admin_remarks: 'Queued for verification.',
      created_at: '2026-11-10T15:05:00.000Z',
      updated_at: '2026-11-10T15:05:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Submitted by citizen.',
          changed_by: 'Citizen Submission',
          created_at: '2026-11-10T15:05:00.000Z',
        },
      ],
    },
    {
      code: 'CIV-2026-008',
      category: 'Garbage Accumulation',
      title: 'Overflowing public bin near market square',
      description:
        'Public waste receptacle has overflowed onto the footpath following weekend market hours.',
      location_text: '4th T Block Market Lane, Jayanagar',
      ward_area: 'Jayanagar',
      latitude: 12.9255,
      longitude: 77.5938,
      image_url: null,
      citizen_name: 'Lakshmi Devi',
      citizen_contact: '+91 98441 77820',
      status: 'Resolved',
      severity: 'Medium',
      assigned_department: 'Solid Waste Management (Demo)',
      admin_remarks: 'Bin emptied and surrounding pavement swept (Demo).',
      created_at: '2026-08-22T09:00:00.000Z',
      updated_at: '2026-08-24T14:20:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Citizen reported overflowing public bin.',
          changed_by: 'Citizen Submission',
          created_at: '2026-08-22T09:00:00.000Z',
        },
        {
          status: 'Resolved',
          remark: 'Bin emptied and surrounding pavement swept (Demo).',
          changed_by: 'Demo Admin',
          created_at: '2026-08-24T14:20:00.000Z',
        },
      ],
    },
    {
      code: 'CIV-2026-009',
      category: 'Streetlight Failure',
      title: 'Test submission for private driveway lamp',
      description:
        'Request to replace an interior residential gate bulb inside a private apartment driveway.',
      location_text: 'Private Courtyard Gate, Indiranagar',
      ward_area: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      image_url: null,
      citizen_name: 'Vikram Menon',
      citizen_contact: 'vikram@example.com',
      status: 'Rejected',
      severity: 'Low',
      assigned_department: 'Street Lighting Wing (Demo)',
      admin_remarks:
        'Rejected: Reported fixture is inside a private apartment premises rather than a public municipal street.',
      created_at: '2026-10-28T19:15:00.000Z',
      updated_at: '2026-10-29T10:30:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Citizen submitted lighting complaint.',
          changed_by: 'Citizen Submission',
          created_at: '2026-10-28T19:15:00.000Z',
        },
        {
          status: 'Rejected',
          remark: 'Rejected: Reported fixture is inside a private apartment premises rather than a public municipal street.',
          changed_by: 'Demo Admin',
          created_at: '2026-10-29T10:30:00.000Z',
        },
      ],
    },
    {
      code: 'CIV-2026-010',
      category: 'Pothole/Damaged Road',
      title: 'Multiple surface potholes after heavy rain near flyover ramp',
      description:
        'Cluster of 4 medium potholes along the left service lane approaching the Hebbal junction ramp, slowing peak-hour traffic.',
      location_text: 'Bellary Road Service Lane, Hebbal Junction',
      ward_area: 'Hebbal',
      latitude: 13.0358,
      longitude: 77.5970,
      image_url: null,
      citizen_name: 'Arjun Deshmukh',
      citizen_contact: '+91 96112 88004',
      status: 'Verified',
      severity: 'High',
      assigned_department: 'Roads & Infrastructure (Demo)',
      admin_remarks: 'Verified cluster hazard on service lane. Queued for demo resurfacing batch.',
      created_at: '2026-11-11T16:40:00.000Z',
      updated_at: '2026-11-12T08:15:00.000Z',
      history: [
        {
          status: 'Submitted',
          remark: 'Citizen reported multiple potholes on service lane.',
          changed_by: 'Citizen Submission',
          created_at: '2026-11-11T16:40:00.000Z',
        },
        {
          status: 'Verified',
          remark: 'Verified cluster hazard on service lane. Queued for demo resurfacing batch.',
          changed_by: 'Demo Admin',
          created_at: '2026-11-12T08:15:00.000Z',
        },
      ],
    },
  ];

  const insertComplaint = db.prepare(`
    INSERT INTO complaints (
      complaint_code, category, title, description, location_text, ward_area,
      latitude, longitude, image_url, citizen_name, citizen_contact,
      status, severity, priority_score, priority_level, priority_explanation,
      assigned_department, admin_remarks, ai_pothole_summary, created_at, updated_at
    ) VALUES (
      @complaint_code, @category, @title, @description, @location_text, @ward_area,
      @latitude, @longitude, @image_url, @citizen_name, @citizen_contact,
      @status, @severity, @priority_score, @priority_level, @priority_explanation,
      @assigned_department, @admin_remarks, @ai_pothole_summary, @created_at, @updated_at
    )
  `);

  const insertHistory = db.prepare(`
    INSERT INTO complaint_history (complaint_id, status, remark, changed_by, created_at)
    VALUES (@complaint_id, @status, @remark, @changed_by, @created_at)
  `);

  const tx = db.transaction(() => {
    for (const s of samples) {
      const priority = calculateRuleBasedPriority({
        category: s.category,
        severity: s.severity,
        title: s.title,
        description: s.description,
        locationText: s.location_text,
        latitude: s.latitude,
        longitude: s.longitude,
      });

      const info = insertComplaint.run({
        complaint_code: s.code,
        category: s.category,
        title: s.title,
        description: s.description,
        location_text: s.location_text,
        ward_area: s.ward_area,
        latitude: s.latitude,
        longitude: s.longitude,
        image_url: s.image_url,
        citizen_name: s.citizen_name,
        citizen_contact: s.citizen_contact,
        status: s.status,
        severity: s.severity,
        priority_score: priority.score,
        priority_level: priority.level,
        priority_explanation: JSON.stringify(priority.factors),
        assigned_department: s.assigned_department,
        admin_remarks: s.admin_remarks,
        ai_pothole_summary: null,
        created_at: s.created_at,
        updated_at: s.updated_at,
      });

      const complaintId = Number(info.lastInsertRowid);
      for (const h of s.history) {
        insertHistory.run({
          complaint_id: complaintId,
          status: h.status,
          remark: h.remark,
          changed_by: h.changed_by,
          created_at: h.created_at,
        });
      }
    }
  });

  tx();
}
