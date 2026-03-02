-- Migration: Normalize credibility scores to 0-100 range
-- Date: 2026-02-28
-- Description: Cap all credibility scores that exceed 100 to exactly 100

-- Update anonymous_users table
UPDATE anonymous_users
SET credibility_score = LEAST(100, credibility_score)
WHERE credibility_score > 100;

-- Update accused_profiles table
UPDATE accused_profiles
SET credibility_score = LEAST(100, credibility_score)
WHERE credibility_score > 100;

-- Verify the updates (these should return 0 rows if successful)
-- SELECT COUNT(*) as scores_over_100_anon FROM anonymous_users WHERE credibility_score > 100;
-- SELECT COUNT(*) as scores_over_100_accused FROM accused_profiles WHERE credibility_score > 100;
