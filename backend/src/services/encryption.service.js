const { encryptText, decryptText } = require('../config/encryption');

function encryptFields(payload, fields = []) {
  const next = { ...payload };

  for (const field of fields) {
    if (next[field] !== undefined && next[field] !== null) {
      next[field] = encryptText(next[field]);
    }
  }

  return next;
}

function decryptFields(payload, fields = []) {
  const next = { ...payload };

  for (const field of fields) {
    if (next[field]) {
      next[field] = decryptText(next[field]);
    }
  }

  return next;
}

module.exports = {
  encryptFields,
  decryptFields,
};
