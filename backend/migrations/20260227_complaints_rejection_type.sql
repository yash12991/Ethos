BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'rejection_type_enum'
  ) THEN
    CREATE TYPE rejection_type_enum AS ENUM ('insufficient', 'false', 'malicious');
  END IF;
END $$;

ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS rejection_type rejection_type_enum;

COMMIT;
