function scoreCredibility({ description = '', evidenceCount = 0, hasWitness = false }) {
  let score = 40;

  if (description.length >= 200) score += 20;
  if (description.length >= 500) score += 10;
  if (evidenceCount > 0) score += Math.min(20, evidenceCount * 5);
  if (hasWitness) score += 10;

  const bounded = Math.max(0, Math.min(100, score));

  return {
    score: bounded,
    tier: bounded >= 75 ? 'high' : bounded >= 50 ? 'medium' : 'low',
  };
}

module.exports = {
  scoreCredibility,
};
