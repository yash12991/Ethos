-- Switch department_risk_metrics to store plain department names instead of hashed values.
-- NOTE: If historical values are hashes, this migration can only copy/rename them as-is.
--       Replace those values with real department names via a controlled backfill/update.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'department_risk_metrics'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'department_risk_metrics'
        AND column_name = 'department_hash'
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'department_risk_metrics'
          AND column_name = 'department'
      ) THEN
        ALTER TABLE department_risk_metrics
          RENAME COLUMN department_hash TO department;
      ELSE
        UPDATE department_risk_metrics
        SET department = COALESCE(NULLIF(department, ''), department_hash)
        WHERE department IS NULL OR department = '';

        ALTER TABLE department_risk_metrics
          DROP COLUMN department_hash;
      END IF;
    END IF;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_department_risk_metrics_dept_updated;
CREATE INDEX IF NOT EXISTS idx_department_risk_metrics_dept_updated
  ON department_risk_metrics (department, last_updated DESC);
