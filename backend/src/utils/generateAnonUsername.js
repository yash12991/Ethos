const crypto = require('crypto');

function generateAnonUsername(prefix = 'Anon') {
  const randomNum = crypto.randomInt(100, 9999);
  const randomToken = crypto.randomBytes(2).toString('hex');
  return `${prefix}${randomToken}${randomNum}`;
}

module.exports = generateAnonUsername;
