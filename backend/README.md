# Anonymous Workplace Harassment Reporting Backend

Secure API for anonymous workplace harassment reporting, built to protect reporter identity while enabling HR workflows and auditability.

## Stack
- Node.js + Express
- PostgreSQL (Supabase compatible)
- JWT auth + RBAC
- bcrypt password hashing
- AES-256-GCM encryption for sensitive fields
- SHA-256 evidence hashing
- REST API
- Security middleware: helmet, cors, express-validator, rate-limiter-flexible, multer
- Logging with winston

## Architecture Overview
- Entry: [src/server.js](src/server.js) starts the app and listens on `PORT`.
- App wiring: [src/app.js](src/app.js) configures middleware, logging, and routes under `API_PREFIX`.
- Controllers handle request logic and call model/services.
- Models handle SQL queries via the shared postgres client.
- Services provide encryption, credibility scoring, and pattern detection.
- Middlewares enforce auth, role checks, validation, and rate limiting.

## Folder Structure

```text
backend/
├── src/
│   ├── config/         # DB, JWT, encryption, Supabase clients
│   ├── controllers/    # Request handlers
│   ├── services/       # Encryption, credibility, audit, pattern detection
│   ├── middlewares/    # Auth, roles, validation, rate limits, errors
│   ├── routes/         # API routes
│   ├── models/         # SQL data access
│   ├── utils/          # IDs, hashing, logger
│   ├── app.js
│   └── server.js
├── .env.example
├── package.json
└── README.md
```

## Quick Start
1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development:
   ```bash
   npm run dev
   ```
4. Health check:
   ```bash
   curl http://localhost:5000/health
   ```

## Environment Variables
All variables are in `.env.example`. Required values include:

- `NODE_ENV`, `PORT`, `API_PREFIX`
- `DATABASE_URL` (Postgres connection string; `DATABASE_URL=...` prefix is stripped if present)
- `PG_SSL` (defaults to true)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (service key optional)
- `SUPABASE_EVIDENCE_BUCKET` (optional, defaults to `evidence`)
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`
- `ENCRYPTION_KEY` (64 hex chars for AES-256-GCM)
- `CLIENT_ORIGIN` (comma-separated list allowed)
- `MAX_FILE_SIZE_MB`
- `RESEND_API_KEY`, `HR_OTP_FROM_EMAIL`, `HR_OTP_EMAIL_SUBJECT` (HR OTP delivery via Resend)
- `HR_OTP_EXPOSE_IN_RESPONSE` (optional debug flag to expose OTP codes in non-production)

## API Routes
Base prefix is `API_PREFIX` (default `/api/v1`).

Auth
- `POST /auth/register` register anonymous reporter (alias optional)
- `POST /auth/login` login anonymous reporter
- `GET /auth/me` current user

Complaints
- `POST /complaints` create complaint (reporter or admin)
- `GET /complaints` list complaints (reporter sees own; HR/admin see all)
- `GET /complaints/:complaintId` get complaint by ID
- `PATCH /complaints/:complaintId/status` update status (HR/admin)

Evidence
- `POST /evidence/:complaintId` upload evidence (multipart form)
- `GET /evidence/:complaintId` list evidence for complaint

Chat
- `POST /chat/:complaintId` post message
- `GET /chat/:complaintId` list messages

HR
- `GET /hr/queue` list complaints queue
- `GET /hr/accused-patterns` repeated accused patterns
- `PUT /hr/verdict/:complaintId` save or update verdict
- `GET /hr/verdict/:complaintId` get verdict

Analytics
- `GET /analytics/summary` complaint totals and pattern detection

## Data Model Notes
Tables used by models:

- `anonymous_users` (anonymous reporter identity)
- `complaints` (encrypted incident fields, credibility score, status)
- `evidence` (hashed file content, encrypted notes)
- `case_chat` (encrypted messages)
- `verdicts` (encrypted verdict text)
- `accused_profiles` (accused reference metadata)
- `audit_logs` (audit trail)

Sensitive fields are stored encrypted:
- `incident_details`, `location` in complaints
- `notes` in evidence
- `message` in case chat
- `verdict` in verdicts

## Security Notes
- `bcrypt` with cost 12 for passwords.
- AES-256-GCM encryption for sensitive fields (`ENCRYPTION_KEY`).
- Evidence content hash for integrity (`sha256`).
- JWT access and refresh tokens signed with separate secrets.
- Rate limits on auth, complaint, and upload flows.
- RBAC enforced by middleware (`reporter`, `hr`, `admin`).

## Implementation Details
- `complaint.controller` encrypts fields and computes a credibility score.
- `evidence.controller` hashes content, stores encrypted notes, and creates a storage path reference.
- `chat.controller` encrypts message payloads before storage.
- `analytics.controller` uses simple pattern detection to flag repeated accused IDs.

## API Request/Response Examples
Base URL examples assume `http://localhost:5000/api/v1`.

Register
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
   -H "Content-Type: application/json" \
   -d '{"alias":"Lomira482","password":"StrongPass!123"}'
```
Response
```json
{
   "success": true,
   "data": {
      "user": {
         "id": "<uuid>",
         "username": "Lomira482",
         "created_at": "2026-02-22T08:00:00.000Z",
         "role": "reporter"
      },
      "tokens": {
         "accessToken": "<jwt>",
         "refreshToken": "<jwt>"
      }
   }
}
```

Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
   -H "Content-Type: application/json" \
   -d '{"alias":"Lomira482","password":"StrongPass!123"}'
```
Response
```json
{
   "success": true,
   "data": {
      "user": {
         "id": "<uuid>",
         "anon_alias": "Lomira482",
         "role": "reporter"
      },
      "tokens": {
         "accessToken": "<jwt>",
         "refreshToken": "<jwt>"
      }
   }
}
```

Create complaint
```bash
curl -X POST http://localhost:5000/api/v1/complaints \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer <accessToken>" \
   -d '{
      "title": "Inappropriate comments",
      "incident_category": "verbal",
      "incident_details": "Details of the incident and timeline...",
      "incident_date": "2026-02-10",
      "location": "Head Office",
      "accused_employee_id": "EMP-114"
   }'
```

Upload evidence
```bash
curl -X POST http://localhost:5000/api/v1/evidence/CMP-ABC-123 \
   -H "Authorization: Bearer <accessToken>" \
   -F "file=@/path/to/evidence.pdf" \
   -F "notes=Screenshot from Slack"
```

## Database Schema (Suggested)
There are no migrations in this repo yet. The models assume the following tables.

```sql
CREATE TABLE anonymous_users (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   username text UNIQUE NOT NULL,
   password_hash text NOT NULL,
   created_at timestamptz DEFAULT now()
);

CREATE TABLE complaints (
   id bigserial PRIMARY KEY,
   complaint_id text UNIQUE NOT NULL,
   reporter_user_id uuid REFERENCES anonymous_users(id),
   accused_employee_id text,
   title text NOT NULL,
   incident_category text NOT NULL,
   incident_details_encrypted text NOT NULL,
   incident_date date NOT NULL,
   location_encrypted text NOT NULL,
   status text NOT NULL,
   credibility_score int NOT NULL,
   updated_by_hr_user_id uuid,
   created_at timestamptz DEFAULT now(),
   updated_at timestamptz DEFAULT now()
);

CREATE TABLE evidence (
   id bigserial PRIMARY KEY,
   complaint_id text REFERENCES complaints(complaint_id),
   uploaded_by_user_id uuid REFERENCES anonymous_users(id),
   file_name text NOT NULL,
   mime_type text NOT NULL,
   size_bytes int NOT NULL,
   sha256_hash text NOT NULL,
   storage_path text NOT NULL,
   notes_encrypted text,
   created_at timestamptz DEFAULT now()
);

CREATE TABLE case_chat (
   id bigserial PRIMARY KEY,
   complaint_id text REFERENCES complaints(complaint_id),
   sender_user_id uuid REFERENCES anonymous_users(id),
   message_encrypted text NOT NULL,
   created_at timestamptz DEFAULT now()
);

CREATE TABLE verdicts (
   id bigserial PRIMARY KEY,
   complaint_id text UNIQUE REFERENCES complaints(complaint_id),
   hr_user_id uuid,
   verdict_encrypted text NOT NULL,
   resolution_status text NOT NULL,
   created_at timestamptz DEFAULT now(),
   updated_at timestamptz DEFAULT now()
);

CREATE TABLE accused_profiles (
   id bigserial PRIMARY KEY,
   employee_ref text UNIQUE NOT NULL,
   department text,
   metadata jsonb DEFAULT '{}'::jsonb,
   created_at timestamptz DEFAULT now(),
   updated_at timestamptz DEFAULT now()
);

CREATE TABLE audit_logs (
   id bigserial PRIMARY KEY,
   user_type text NOT NULL,
   user_id uuid,
   action text NOT NULL,
   ip_hash text,
   created_at timestamptz DEFAULT now()
);
```

## Auth Token Storage and Usage
- The backend issues an access token and refresh token on login/register.
- Access tokens are required via the `Authorization: Bearer <token>` header.
- Refresh token rotation and revocation are not implemented yet.
- For production, store tokens in HTTP-only cookies or a secure token store; avoid localStorage for high-risk clients.

## Deployment Checklist
- Set all environment variables from `.env.example` with production values.
- Use a managed Postgres (Supabase) with SSL enabled.
- Replace in-memory rate limiter with Redis-backed limiter.
- Use object storage for evidence files (Supabase Storage, S3) and store signed URLs.
- Use a reverse proxy (nginx) or platform load balancer with TLS termination.
- Add request IDs and trace correlation (OpenTelemetry or similar).
- Configure log rotation and central log aggregation.

## Testing and CI Notes
- No tests are included yet. Suggested stack: Jest + Supertest.
- Cover auth flows, complaint creation, and access control edge cases.
- Add CI for linting and tests before merge.

## Development Notes
- Rate limiting uses in-memory storage. Replace with Redis for production.
- Multer uses memory storage. Persist to Supabase Storage or object storage in production.
- Logs are written to `logs/combined.log` and `logs/error.log`.

## Scripts
- `npm run dev` start with nodemon
- `npm start` start with node
- `npm run lint` placeholder
