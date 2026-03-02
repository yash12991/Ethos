BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'case_workflow_status_enum'
  ) THEN
    CREATE TYPE case_workflow_status_enum AS ENUM (
      'open',
      'in_progress',
      'under_review',
      'resolved_accepted',
      'resolved_rejected',
      'reopened'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'investigator_decision_enum'
  ) THEN
    CREATE TYPE investigator_decision_enum AS ENUM ('accept', 'reject');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'committee_vote_enum'
  ) THEN
    CREATE TYPE committee_vote_enum AS ENUM ('support', 'oppose');
  END IF;
END $$;

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS assigned_hr_id uuid REFERENCES hr_users(id),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS workflow_status case_workflow_status_enum DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS investigator_decision investigator_decision_enum,
  ADD COLUMN IF NOT EXISTS investigator_decision_notes text,
  ADD COLUMN IF NOT EXISTS investigator_decision_by uuid REFERENCES hr_users(id),
  ADD COLUMN IF NOT EXISTS investigator_decision_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_complaints_workflow_status
  ON complaints (workflow_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_assigned_hr
  ON complaints (assigned_hr_id, created_at DESC);

CREATE TABLE IF NOT EXISTS committee_votes (
  id bigserial PRIMARY KEY,
  complaint_code text NOT NULL REFERENCES complaints(complaint_code) ON DELETE CASCADE,
  voter_hr_id uuid NOT NULL REFERENCES hr_users(id),
  vote committee_vote_enum NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (complaint_code, voter_hr_id)
);

CREATE INDEX IF NOT EXISTS idx_committee_votes_complaint
  ON committee_votes (complaint_code);

CREATE TABLE IF NOT EXISTS complaint_reaccept_blocks (
  complaint_code text NOT NULL REFERENCES complaints(complaint_code) ON DELETE CASCADE,
  hr_user_id uuid NOT NULL REFERENCES hr_users(id),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (complaint_code, hr_user_id)
);

COMMIT;
