# HR Pattern Detection Module

## Scope
This module is deterministic, HR-only, and decision-support only. It never auto-punishes users or accused employees.

## Security Guarantees
- Endpoints are protected by `authMiddleware` + `requireRole('hr', 'committee', 'admin')`.
- No query joins `identity_vault`.
- Data sources are limited to:
  - `complaints`
  - `anonymous_users`
  - `accused_profiles`
  - `verdicts`
  - `credibility_history`
  - `department_risk_metrics`
  - `evidence_files`
- Every pattern-detection API access writes an audit log action.

## Endpoints
- `GET /api/v1/hr/pattern-detection/overview`
- `GET /api/v1/hr/pattern-detection/repeat-offenders`
- `GET /api/v1/hr/pattern-detection/targeting-alerts`
- `GET /api/v1/hr/pattern-detection/department-risk`
- `GET /api/v1/hr/pattern-detection/time-trends`
- `GET /api/v1/hr/pattern-detection/credibility-risk`
- `GET /api/v1/hr/pattern-detection/insights`
- `GET /api/v1/hr/pattern-detection/risk-acceleration`
- `GET /api/v1/hr/pattern-detection/accused/:accusedHash/breakdown`

## Core Metrics
- Escalation index:
  - current 30-day complaints
  - previous 30-day complaints
  - percentage change + trend classification
- Repeat offenders:
  - accused with `total_complaints >= 2` and (`guilty_count >= 1` or `risk_level = 'high'`)
  - includes recurrence interval (avg days between complaints)
- Targeting alerts:
  - accused with `complaints >= 3`, `guilty_count = 0`, `avg complainant credibility < 60`
  - alert level is `high` for strong concentration patterns
- Low evidence ratio:
  - percentage of complaints without `evidence_files`
  - trend comparison for last 30 days vs previous 30 days
- Department risk:
  - latest risk score per department
  - escalation flag if increase > 20% over previous score
- Time trends:
  - 12-week weekly aggregates for complaint volume, avg severity, guilty verdict rate
- Suspicious complainants:
  - `credibility_score < 60`, `complaint_count >= 3`, rejected ratio > 50%
- Risk acceleration:
  - accused with `2+` complaints in last 14 days

## Insight Rules
- Escalation index > 25% -> volume increase warning.
- Department escalation detected -> department-specific warning.
- Decreasing recurrence interval among repeat offenders -> behavioral escalation signal.
- High-level targeting alerts -> possible coordinated targeting warning.
- High low-evidence ratio -> evidence quality decline warning.

## Performance
- Overview endpoint is cached in-memory for 5 minutes.
- Migration adds indexes on high-frequency filter/group columns.
- Migration also creates `hr_pattern_weekly_mv` materialized view for trend workloads.

## Operational Notes
- This module generates flags only.
- It should be used to prioritize review workflows, not as an automated verdict engine.
