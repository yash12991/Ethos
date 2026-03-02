const crypto = require('crypto');

function generateComplaintId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const entropy = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CMP-${stamp}-${entropy}`;
}

module.exports = generateComplaintId;
