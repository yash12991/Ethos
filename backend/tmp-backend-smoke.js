require('dotenv').config({ path: './.env' });
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('./src/app');
const { query, sql } = require('./src/config/db');

(async () => {
  const steps = [];
  const now = Date.now();
  const alias = `smoke${now}`;
  const password = 'Password123!';
  const hrEmail = `smoke.hr.${now}@example.com`;
  const hrPassword = 'HrPassword123!';

  let anonToken = '';
  let hrToken = '';
  let complaintRef = '';

  try {
    const hrHash = await bcrypt.hash(hrPassword, 10);
    await query(
      `INSERT INTO hr_users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['Smoke HR', hrEmail, hrHash, 'hr']
    );

    let res;

    res = await request(app).post('/api/v1/auth/register').send({ alias, password });
    steps.push({ step: 'POST /auth/register', status: res.status, ok: res.status === 201, message: res.body?.message });
    anonToken = res.body?.data?.tokens?.accessToken || '';

    res = await request(app).post('/api/v1/auth/login').send({ alias, password });
    steps.push({ step: 'POST /auth/login', status: res.status, ok: res.status === 200, message: res.body?.message });
    anonToken = res.body?.data?.tokens?.accessToken || anonToken;

    res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${anonToken}`);
    steps.push({ step: 'GET /auth/me (anon)', status: res.status, ok: res.status === 200, message: res.body?.message });

    res = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${anonToken}`)
      .send({
        accused_employee_hash: `accused-${now}`,
        description: 'Detailed incident description for smoke test that is long enough for validation.',
        incident_date: '2026-02-20',
        location: 'Office floor 2',
        evidence_count: 1,
        has_witness: true,
      });
    steps.push({ step: 'POST /complaints', status: res.status, ok: res.status === 201, message: res.body?.message });
    complaintRef = res.body?.data?.complaint_code || '';

    res = await request(app).get('/api/v1/complaints').set('Authorization', `Bearer ${anonToken}`);
    steps.push({ step: 'GET /complaints', status: res.status, ok: res.status === 200, message: res.body?.message });

    if (complaintRef) {
      res = await request(app).get(`/api/v1/complaints/${complaintRef}`).set('Authorization', `Bearer ${anonToken}`);
      steps.push({ step: 'GET /complaints/:id', status: res.status, ok: res.status === 200, message: res.body?.message });

      res = await request(app)
        .post(`/api/v1/evidence/${complaintRef}`)
        .set('Authorization', `Bearer ${anonToken}`)
        .field('notes', 'smoke note')
        .attach('file', Buffer.from('smoke evidence file'), 'evidence.pdf');
      steps.push({ step: 'POST /evidence/:id', status: res.status, ok: res.status === 201, message: res.body?.message });

      res = await request(app).get(`/api/v1/evidence/${complaintRef}`).set('Authorization', `Bearer ${anonToken}`);
      steps.push({ step: 'GET /evidence/:id', status: res.status, ok: res.status === 200, message: res.body?.message });

      res = await request(app)
        .post(`/api/v1/chat/${complaintRef}`)
        .set('Authorization', `Bearer ${anonToken}`)
        .send({ message: 'Anonymous follow-up message for smoke test.' });
      steps.push({ step: 'POST /chat/:id', status: res.status, ok: res.status === 201, message: res.body?.message });

      res = await request(app).get(`/api/v1/chat/${complaintRef}`).set('Authorization', `Bearer ${anonToken}`);
      steps.push({ step: 'GET /chat/:id', status: res.status, ok: res.status === 200, message: res.body?.message });
    }

    res = await request(app).post('/api/v1/auth/hr/login').send({ email: hrEmail, password: hrPassword });
    steps.push({ step: 'POST /auth/hr/login', status: res.status, ok: res.status === 200, message: res.body?.message });
    hrToken = res.body?.data?.tokens?.accessToken || '';

    res = await request(app).get('/api/v1/hr/queue').set('Authorization', `Bearer ${hrToken}`);
    steps.push({ step: 'GET /hr/queue', status: res.status, ok: res.status === 200, message: res.body?.message });

    res = await request(app).get('/api/v1/hr/accused-patterns').set('Authorization', `Bearer ${hrToken}`);
    steps.push({ step: 'GET /hr/accused-patterns', status: res.status, ok: res.status === 200, message: res.body?.message });

    if (complaintRef) {
      res = await request(app)
        .patch(`/api/v1/complaints/${complaintRef}/status`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ status: 'under_review' });
      steps.push({ step: 'PATCH /complaints/:id/status', status: res.status, ok: res.status === 200, message: res.body?.message });

      res = await request(app)
        .put(`/api/v1/hr/verdict/${complaintRef}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ verdict: 'insufficient_evidence', notes: 'Smoke test verdict' });
      steps.push({ step: 'PUT /hr/verdict/:id', status: res.status, ok: res.status === 200, message: res.body?.message });

      res = await request(app)
        .get(`/api/v1/hr/verdict/${complaintRef}`)
        .set('Authorization', `Bearer ${hrToken}`);
      steps.push({ step: 'GET /hr/verdict/:id', status: res.status, ok: res.status === 200, message: res.body?.message });
    }

    res = await request(app).get('/api/v1/analytics/summary').set('Authorization', `Bearer ${hrToken}`);
    steps.push({ step: 'GET /analytics/summary', status: res.status, ok: res.status === 200, message: res.body?.message });

    const failed = steps.filter((s) => !s.ok);
    console.log(JSON.stringify({ ok: failed.length === 0, failedCount: failed.length, steps }, null, 2));
    process.exitCode = failed.length === 0 ? 0 : 1;
  } catch (err) {
    console.log(JSON.stringify({ ok: false, fatal: err.message, steps }, null, 2));
    process.exitCode = 1;
  } finally {
    try { await sql.end({ timeout: 5 }); } catch {}
  }
})();
