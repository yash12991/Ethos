function detectPatterns(complaints) {
  const accusedCounter = complaints.reduce((acc, item) => {
    const accusedHash = item.accused_employee_hash;
    if (!accusedHash) return acc;
    acc[accusedHash] = (acc[accusedHash] || 0) + 1;
    return acc;
  }, {});

  const repeatedAccused = Object.entries(accusedCounter)
    .filter(([, count]) => count >= 2)
    .map(([accusedHash, count]) => ({ accused_employee_hash: accusedHash, count }));

  return {
    repeatedAccused,
    totalComplaints: complaints.length,
  };
}

module.exports = {
  detectPatterns,
};
