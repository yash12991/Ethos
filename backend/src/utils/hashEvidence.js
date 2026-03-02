const crypto = require('crypto');

function hashEvidence(contentBuffer) {
  return crypto.createHash('sha256').update(contentBuffer).digest('hex');
}

module.exports = hashEvidence;
