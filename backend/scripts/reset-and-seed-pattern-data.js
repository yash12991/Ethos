#!/usr/bin/env node

require('dotenv').config();

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sql } = require('../src/config/db');
const { encryptText } = require('../src/config/encryption');

const ANON_USER_COUNT = 25;
const DEFAULT_PASSWORD = 'AnonSeed@123';

const ACCUSED_DIRECTORY = [
  { hash: 'EMP-ALPHA-001', department: 'Engineering' },
  { hash: 'EMP-BETA-002', department: 'Sales' },
  { hash: 'EMP-GAMMA-003', department: 'Human Resources' },
  { hash: 'EMP-DELTA-004', department: 'Operations' },
  { hash: 'EMP-EPSILON-005', department: 'Finance' },
  { hash: 'EMP-ZETA-006', department: 'Marketing' },
  { hash: 'EMP-ETA-007', department: 'Customer Support' },
  { hash: 'EMP-THETA-008', department: 'Legal' },
];

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function tableExists(tx, tableName) {
  const result = await tx.unsafe(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = $1
     LIMIT 1`,
    [tableName]
  );
  return result.length > 0;
}

async function getTableColumns(tx, tableName) {
  const result = await tx.unsafe(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );
  return new Set(result.map((row) => row.column_name));
}

async function hasUniqueConstraintOnColumn(tx, tableName, columnName) {
  const result = await tx.unsafe(
    `SELECT 1
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
     WHERE tc.table_schema = 'public'
       AND tc.table_name = $1
       AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
       AND kcu.column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  return result.length > 0;
}

async function deleteAll(tx, tableName) {
  await tx.unsafe(`DELETE FROM ${quoteIdentifier(tableName)}`);
}

async function insertDynamic(tx, tableName, data, returning = '*') {
  const columns = Object.keys(data);
  if (columns.length === 0) {
    throw new Error(`No insertable columns provided for ${tableName}`);
  }

  const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
  const colSql = columns.map((col) => quoteIdentifier(col)).join(', ');
  const values = columns.map((col) => data[col]);
  const returnSql = returning ? ` RETURNING ${returning}` : '';

  const rows = await tx.unsafe(
    `INSERT INTO ${quoteIdentifier(tableName)} (${colSql})
     VALUES (${placeholders})${returnSql}`,
    values
  );

  return rows[0] || null;
}

function toDateDaysAgo(daysAgo, hourOffset = 9) {
  const dt = new Date();
  dt.setUTCHours(hourOffset, 0, 0, 0);
  dt.setUTCDate(dt.getUTCDate() - daysAgo);
  return dt;
}

function complaintCode(index) {
  return `CMP-SEED-${String(index).padStart(4, '0')}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildComplaintPlans() {
  const plans = [];

  const add = (payload) => plans.push(payload);

  const repeatA = [175, 162, 149, 136, 123, 110, 97, 84, 71, 58, 32, 11];
  repeatA.forEach((daysAgo, idx) => {
    const resolved = daysAgo > 55;
    add({
      userIndex: 5 + (idx % 12),
      accusedHash: 'EMP-ALPHA-001',
      department: 'Engineering',
      daysAgo,
      severity: 72 + (idx % 18),
      status: resolved ? 'resolved' : (idx % 2 === 0 ? 'under_review' : 'submitted'),
      verdict: resolved ? (idx % 3 === 0 ? 'not_guilty' : 'guilty') : null,
      hasEvidence: daysAgo > 40,
    });
  });

  const repeatB = [168, 147, 126, 105, 83, 61, 39, 14];
  repeatB.forEach((daysAgo, idx) => {
    const resolved = daysAgo > 45;
    add({
      userIndex: 17 + (idx % 8),
      accusedHash: 'EMP-BETA-002',
      department: 'Sales',
      daysAgo,
      severity: 60 + ((idx * 5) % 24),
      status: resolved ? 'resolved' : (idx % 2 === 0 ? 'under_review' : 'submitted'),
      verdict: resolved ? (idx % 4 === 1 ? 'guilty' : 'not_guilty') : null,
      hasEvidence: idx % 3 !== 0,
    });
  });

  const targeting = [118, 95, 74, 53, 37, 21, 9];
  targeting.forEach((daysAgo, idx) => {
    add({
      userIndex: [0, 1, 2, 3, 4, 0, 1][idx],
      accusedHash: 'EMP-GAMMA-003',
      department: 'Human Resources',
      daysAgo,
      severity: 36 + ((idx * 7) % 18),
      status: daysAgo > 20 ? 'rejected' : 'under_review',
      verdict: daysAgo > 50 ? 'not_guilty' : null,
      hasEvidence: false,
    });
  });

  [12, 8, 4].forEach((daysAgo, idx) => {
    add({
      userIndex: 6 + idx,
      accusedHash: 'EMP-DELTA-004',
      department: 'Operations',
      daysAgo,
      severity: 65 + idx * 8,
      status: idx === 2 ? 'submitted' : 'under_review',
      verdict: null,
      hasEvidence: false,
    });
  });

  const extraRejected = [
    { userIndex: 0, daysAgo: 66 },
    { userIndex: 1, daysAgo: 44 },
    { userIndex: 2, daysAgo: 28 },
    { userIndex: 0, daysAgo: 17 },
    { userIndex: 1, daysAgo: 6 },
  ];
  extraRejected.forEach(({ userIndex, daysAgo }, idx) => {
    add({
      userIndex,
      accusedHash: 'EMP-ZETA-006',
      department: 'Marketing',
      daysAgo,
      severity: 42 + idx * 5,
      status: 'rejected',
      verdict: idx % 2 === 0 ? 'insufficient_evidence' : null,
      hasEvidence: false,
    });
  });

  const miscAccused = [
    { accusedHash: 'EMP-EPSILON-005', department: 'Finance' },
    { accusedHash: 'EMP-ETA-007', department: 'Customer Support' },
    { accusedHash: 'EMP-THETA-008', department: 'Legal' },
  ];
  const miscDays = [
    182, 171, 159, 146, 131, 119, 106, 94, 88, 81, 76, 63,
    57, 49, 42, 33, 27, 22, 16, 13, 7, 3,
  ];
  miscDays.forEach((daysAgo, idx) => {
    const target = miscAccused[idx % miscAccused.length];
    const resolved = daysAgo > 35;
    add({
      userIndex: (idx + 3) % ANON_USER_COUNT,
      accusedHash: target.accusedHash,
      department: target.department,
      daysAgo,
      severity: 48 + ((idx * 4) % 36),
      status: resolved ? (idx % 4 === 0 ? 'rejected' : 'resolved') : (idx % 2 ? 'submitted' : 'under_review'),
      verdict: resolved ? (idx % 5 === 0 ? 'guilty' : idx % 3 === 0 ? 'insufficient_evidence' : 'not_guilty') : null,
      hasEvidence: daysAgo > 30 ? idx % 4 !== 0 : idx % 7 === 0,
    });
  });

  return plans.sort((a, b) => b.daysAgo - a.daysAgo);
}

function riskLevel(totalComplaints, guiltyCount) {
  if (guiltyCount >= 2 || totalComplaints >= 6) return 'high';
  if (guiltyCount >= 1 || totalComplaints >= 3) return 'medium';
  return 'low';
}

async function rebuildAccusedProfiles(tx) {
  if (!(await tableExists(tx, 'accused_profiles'))) return;

  const columns = await getTableColumns(tx, 'accused_profiles');
  const accusedHashCol = ['accused_employee_hash', 'employee_ref', 'accused_hash'].find((name) => columns.has(name));
  if (!accusedHashCol) return;

  await deleteAll(tx, 'accused_profiles');

  const aggregated = await tx.unsafe(
    `SELECT
      c.accused_employee_hash,
      COUNT(*)::int AS total_complaints,
      SUM(CASE WHEN v.verdict = 'guilty' THEN 1 ELSE 0 END)::int AS guilty_count,
      ROUND(AVG(au.credibility_score)::numeric, 2) AS avg_credibility
    FROM complaints c
    LEFT JOIN verdicts v
      ON v.complaint_id = c.id
    LEFT JOIN anonymous_users au
      ON au.id = c.anon_user_id
    GROUP BY c.accused_employee_hash`
  );

  const deptMap = new Map(ACCUSED_DIRECTORY.map((row) => [row.hash, row.department]));

  for (const row of aggregated) {
    const totalComplaints = Number(row.total_complaints || 0);
    const guiltyCount = Number(row.guilty_count || 0);
    const payload = {};

    payload[accusedHashCol] = row.accused_employee_hash;
    if (columns.has('total_complaints')) payload.total_complaints = totalComplaints;
    if (columns.has('complaint_count')) payload.complaint_count = totalComplaints;
    if (columns.has('guilty_count')) payload.guilty_count = guiltyCount;
    if (columns.has('risk_level')) payload.risk_level = riskLevel(totalComplaints, guiltyCount);
    if (columns.has('credibility_score')) payload.credibility_score = Number(row.avg_credibility || 50);
    if (columns.has('department')) payload.department = deptMap.get(row.accused_employee_hash) || 'General';
    if (columns.has('updated_at')) payload.updated_at = new Date();

    await insertDynamic(tx, 'accused_profiles', payload, '');
  }
}

async function seedDepartmentRiskMetrics(tx, complaintsInserted) {
  if (!(await tableExists(tx, 'department_risk_metrics'))) return;

  let columns = await getTableColumns(tx, 'department_risk_metrics');

  if (!columns.has('department') && columns.has('department_hash')) {
    await tx.unsafe('ALTER TABLE department_risk_metrics RENAME COLUMN department_hash TO department');
    columns = await getTableColumns(tx, 'department_risk_metrics');
  }

  if (!columns.has('department') && columns.has('department_name')) {
    await tx.unsafe('ALTER TABLE department_risk_metrics RENAME COLUMN department_name TO department');
    columns = await getTableColumns(tx, 'department_risk_metrics');
  }

  if (!columns.has('department')) {
    throw new Error(
      'department_risk_metrics must contain a department-like column (department/department_hash/department_name).'
    );
  }
  const deptCol = 'department';
  const uniquePerDepartment = await hasUniqueConstraintOnColumn(tx, 'department_risk_metrics', deptCol);

  await deleteAll(tx, 'department_risk_metrics');

  const byDepartment = new Map();
  for (const record of complaintsInserted) {
    const key = record.department;
    if (!byDepartment.has(key)) {
      byDepartment.set(key, { complaintCount: 0, guiltyCount: 0 });
    }
    const bucket = byDepartment.get(key);
    bucket.complaintCount += 1;
    if (record.verdict === 'guilty') bucket.guiltyCount += 1;
  }

  const departments = Array.from(byDepartment.keys());

  for (let i = 0; i < departments.length; i += 1) {
    const department = departments[i];
    const stats = byDepartment.get(department);
    const currentCount = stats.complaintCount;
    const currentGuilty = stats.guiltyCount;
    const currentRisk = clamp(Math.round(currentCount * 6 + currentGuilty * 10 + (currentCount > 6 ? 10 : 0)), 8, 96);
    const previousRisk = clamp(Math.round(currentRisk * (i % 2 === 0 ? 0.72 : 0.9)), 5, 95);

    if (!uniquePerDepartment) {
      const previousPayload = {};
      previousPayload[deptCol] = department;
      if (columns.has('complaint_count')) previousPayload.complaint_count = Math.max(0, currentCount - 1);
      if (columns.has('guilty_count')) previousPayload.guilty_count = Math.max(0, currentGuilty - (i % 3 === 0 ? 1 : 0));
      if (columns.has('risk_score')) previousPayload.risk_score = previousRisk;
      if (columns.has('last_updated')) previousPayload.last_updated = toDateDaysAgo(35, 10);
      if (columns.has('created_at')) previousPayload.created_at = toDateDaysAgo(35, 10);
      await insertDynamic(tx, 'department_risk_metrics', previousPayload, '');
    }

    const currentPayload = {};
    currentPayload[deptCol] = department;
    if (columns.has('complaint_count')) currentPayload.complaint_count = currentCount;
    if (columns.has('guilty_count')) currentPayload.guilty_count = currentGuilty;
    if (columns.has('risk_score')) currentPayload.risk_score = currentRisk;
    if (columns.has('last_updated')) currentPayload.last_updated = toDateDaysAgo(2, 11);
    if (columns.has('created_at')) currentPayload.created_at = toDateDaysAgo(2, 11);
    await insertDynamic(tx, 'department_risk_metrics', currentPayload, '');
  }
}

async function main() {
  const start = Date.now();

  await sql.begin(async (tx) => {
    const requiredTables = ['anonymous_users', 'complaints'];
    for (const tableName of requiredTables) {
      if (!(await tableExists(tx, tableName))) {
        throw new Error(`Required table missing: ${tableName}`);
      }
    }

    const hasHrUsers = await tableExists(tx, 'hr_users');
    const hasVerdicts = await tableExists(tx, 'verdicts');
    const hasEvidenceFiles = await tableExists(tx, 'evidence_files');
    const hasCredibilityHistory = await tableExists(tx, 'credibility_history');
    const hasChatThreads = await tableExists(tx, 'chat_threads');
    const hasChatMessages = await tableExists(tx, 'chat_messages');
    const hasComplaintMetadata = await tableExists(tx, 'complaint_metadata');
    const hasSuspiciousClusters = await tableExists(tx, 'suspicious_clusters');

    if (hasChatMessages) await deleteAll(tx, 'chat_messages');
    if (hasChatThreads) await deleteAll(tx, 'chat_threads');
    if (hasVerdicts) await deleteAll(tx, 'verdicts');
    if (hasEvidenceFiles) await deleteAll(tx, 'evidence_files');
    if (hasCredibilityHistory) await deleteAll(tx, 'credibility_history');
    if (hasComplaintMetadata) await deleteAll(tx, 'complaint_metadata');
    if (hasSuspiciousClusters) await deleteAll(tx, 'suspicious_clusters');
    await deleteAll(tx, 'complaints');
    await deleteAll(tx, 'anonymous_users');
    if (await tableExists(tx, 'accused_profiles')) await deleteAll(tx, 'accused_profiles');
    if (await tableExists(tx, 'department_risk_metrics')) await deleteAll(tx, 'department_risk_metrics');

    const anonColumns = await getTableColumns(tx, 'anonymous_users');
    const complaintColumns = await getTableColumns(tx, 'complaints');
    const evidenceColumns = hasEvidenceFiles ? await getTableColumns(tx, 'evidence_files') : new Set();
    const historyColumns = hasCredibilityHistory ? await getTableColumns(tx, 'credibility_history') : new Set();
    const verdictColumns = hasVerdicts ? await getTableColumns(tx, 'verdicts') : new Set();

    let deciderId = null;
    if (hasHrUsers) {
      const hrRows = await tx.unsafe('SELECT id FROM hr_users ORDER BY created_at ASC LIMIT 1');
      deciderId = hrRows[0]?.id || null;
    }

    const canInsertVerdicts = hasVerdicts
      && (!verdictColumns.has('decided_by') || Boolean(deciderId));

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const users = [];
    for (let i = 0; i < ANON_USER_COUNT; i += 1) {
      const userNo = i + 1;
      const credibilityScore = userNo <= 5
        ? [42, 38, 55, 48, 52][i]
        : userNo <= 15
          ? 64 + ((i * 3) % 17)
          : 79 + ((i * 2) % 16);

      const payload = {
        username: `anon_seed_${String(userNo).padStart(2, '0')}`,
        password_hash: passwordHash,
      };
      if (anonColumns.has('credibility_score')) payload.credibility_score = credibilityScore;
      if (anonColumns.has('trust_flag')) payload.trust_flag = credibilityScore >= 70;
      if (anonColumns.has('created_at')) payload.created_at = toDateDaysAgo(240 - userNo * 3, 8);
      if (anonColumns.has('last_login')) payload.last_login = toDateDaysAgo(Math.max(2, 35 - userNo), 10);

      const inserted = await insertDynamic(tx, 'anonymous_users', payload);
      users.push({
        id: inserted.id,
        username: inserted.username,
        credibilityScore,
      });
    }

    const complaintPlans = buildComplaintPlans();
    const complaintsInserted = [];

    for (let i = 0; i < complaintPlans.length; i += 1) {
      const plan = complaintPlans[i];
      const reporter = users[plan.userIndex % users.length];
      const createdAt = toDateDaysAgo(plan.daysAgo, 11 + (i % 5));
      const incidentDate = toDateDaysAgo(plan.daysAgo + 3, 9);
      const updatedAt = new Date(createdAt.getTime() + (6 + (i % 48)) * 60 * 60 * 1000);
      const description = [
        `Observed repeated inappropriate conduct involving ${plan.accusedHash}.`,
        `Department context: ${plan.department}.`,
        `This report is part of seeded timeline data for pattern detection validation.`,
      ].join(' ');
      const location = ['Head Office', 'Remote', 'Branch Office', 'Floor 3', 'Conference Room'][i % 5];

      const complaintPayload = {
        complaint_code: complaintCode(i + 1),
        anon_user_id: reporter.id,
        accused_employee_hash: plan.accusedHash,
        incident_date: incidentDate.toISOString().slice(0, 10),
        location: encryptText(location),
        description: encryptText(description),
        status: plan.status,
        severity_score: plan.severity,
      };
      if (complaintColumns.has('created_at')) complaintPayload.created_at = createdAt;
      if (complaintColumns.has('updated_at')) complaintPayload.updated_at = updatedAt;

      const complaintRow = await insertDynamic(tx, 'complaints', complaintPayload);

      if (hasEvidenceFiles && plan.hasEvidence) {
        const fileHash = crypto
          .createHash('sha256')
          .update(`${complaintRow.id}:${complaintPayload.complaint_code}:seed`)
          .digest('hex');
        const evidencePayload = {
          complaint_id: complaintRow.id,
          file_url: `https://storage.example.com/evidence/${complaintPayload.complaint_code}.pdf`,
          file_hash_sha256: fileHash,
        };
        if (evidenceColumns.has('metadata')) {
          evidencePayload.metadata = JSON.stringify({
            originalName: `${complaintPayload.complaint_code}.pdf`,
            mimeType: 'application/pdf',
            seeded: true,
          });
        }
        if (evidenceColumns.has('uploaded_at')) {
          evidencePayload.uploaded_at = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
        }
        await insertDynamic(tx, 'evidence_files', evidencePayload, '');
      }

      if (canInsertVerdicts && plan.verdict) {
        const verdictPayload = {
          complaint_id: complaintRow.id,
          verdict: plan.verdict,
          notes: 'Seeded verdict for pattern detection dataset.',
        };
        if (verdictColumns.has('decided_by') && deciderId) verdictPayload.decided_by = deciderId;
        if (verdictColumns.has('decided_at')) verdictPayload.decided_at = new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000);
        await insertDynamic(tx, 'verdicts', verdictPayload, '');
      }

      if (hasCredibilityHistory) {
        const historyPayload = {
          anon_user_id: reporter.id,
          complaint_id: complaintRow.id,
          change_amount:
            plan.verdict === 'guilty' ? 4
              : plan.status === 'rejected' ? -6
                : plan.verdict === 'insufficient_evidence' ? -3 : 1,
          reason:
            plan.verdict === 'guilty' ? 'Complaint substantiated'
              : plan.status === 'rejected' ? 'Complaint rejected after review'
                : 'Complaint submitted for review',
        };
        if (historyColumns.has('created_at')) {
          historyPayload.created_at = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
        }
        await insertDynamic(tx, 'credibility_history', historyPayload, '');
      }

      complaintsInserted.push({
        id: complaintRow.id,
        accusedHash: plan.accusedHash,
        department: plan.department,
        verdict: plan.verdict || null,
        status: plan.status,
      });
    }

    await rebuildAccusedProfiles(tx);
    await seedDepartmentRiskMetrics(tx, complaintsInserted);

    const complaintCount = await tx.unsafe('SELECT COUNT(*)::int AS count FROM complaints');
    const anonCount = await tx.unsafe('SELECT COUNT(*)::int AS count FROM anonymous_users');
    const verdictCount = hasVerdicts
      ? await tx.unsafe('SELECT COUNT(*)::int AS count FROM verdicts')
      : [{ count: 0 }];

    console.log('Seed completed');
    console.log(`anonymous_users: ${anonCount[0].count}`);
    console.log(`complaints: ${complaintCount[0].count}`);
    console.log(`verdicts: ${verdictCount[0].count}`);
    console.log(`default anon password: ${DEFAULT_PASSWORD}`);
    if (hasVerdicts && !canInsertVerdicts) {
      console.log('verdict insertion skipped: hr_users is empty while verdicts.decided_by is present.');
    }
  });

  const elapsedMs = Date.now() - start;
  console.log(`Done in ${(elapsedMs / 1000).toFixed(2)}s`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
