BEGIN;

CREATE TABLE IF NOT EXISTS complaint_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE RESTRICT,
  hr_id uuid NOT NULL REFERENCES hr_users(id) ON DELETE RESTRICT,
  action_type text NOT NULL,
  metadata jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_audit_logs_complaint_created
  ON complaint_audit_logs (complaint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaint_audit_logs_hr_action_created
  ON complaint_audit_logs (hr_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaint_audit_logs_created_at
  ON complaint_audit_logs (created_at DESC);

CREATE OR REPLACE FUNCTION prevent_complaint_audit_logs_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'complaint_audit_logs is append-only. % is not allowed.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_complaint_audit_logs_mutation ON complaint_audit_logs;
CREATE TRIGGER trg_prevent_complaint_audit_logs_mutation
BEFORE UPDATE OR DELETE ON complaint_audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_complaint_audit_logs_mutation();

REVOKE ALL ON complaint_audit_logs FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON complaint_audit_logs FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON complaint_audit_logs FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT ON complaint_audit_logs TO service_role;
  END IF;
END $$;

ALTER TABLE complaint_audit_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
