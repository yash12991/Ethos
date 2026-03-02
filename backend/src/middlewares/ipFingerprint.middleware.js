const crypto = require('crypto');
const net = require('net');

const MAX_USER_AGENT_LENGTH = 512;
let warnedAboutMissingSalt = false;

function normalizeUserAgent(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_USER_AGENT_LENGTH);
}

function stripWrapping(value) {
  return String(value || '')
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/^for=/i, '');
}

function parseIpv4(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;

  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => !Number.isInteger(num) || num < 0 || num > 255)) {
    return null;
  }

  return nums;
}

function extractIpToken(rawValue) {
  const value = stripWrapping(rawValue);
  if (!value) return null;

  if (value.startsWith('[')) {
    const closing = value.indexOf(']');
    if (closing === -1) return null;
    return value.slice(1, closing);
  }

  const zoneIndex = value.indexOf('%');
  const withoutZone = zoneIndex >= 0 ? value.slice(0, zoneIndex) : value;

  const plain = withoutZone.startsWith('::ffff:') ? withoutZone.slice(7) : withoutZone;
  if (net.isIP(plain)) return plain;

  const maybeIpv4WithPort = withoutZone.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/);
  if (maybeIpv4WithPort && parseIpv4(maybeIpv4WithPort[1])) {
    return maybeIpv4WithPort[1];
  }

  return null;
}

function parseForwardedForHeader(headerValue) {
  if (!headerValue) return [];
  return String(headerValue)
    .split(',')
    .map((item) => extractIpToken(item))
    .filter(Boolean);
}

function parseForwardedHeader(headerValue) {
  if (!headerValue) return [];

  const values = [];
  const regex = /for=([^;,]+)/gi;
  let match = regex.exec(String(headerValue));

  while (match) {
    const token = extractIpToken(match[1]);
    if (token) values.push(token);
    match = regex.exec(String(headerValue));
  }

  return values;
}

function parseIpv6ToGroups(ip) {
  const source = String(ip).toLowerCase();
  if (!source.includes(':')) return null;

  const splitDouble = source.split('::');
  if (splitDouble.length > 2) return null;

  const leftRaw = splitDouble[0] ? splitDouble[0].split(':') : [];
  const rightRaw = splitDouble[1] ? splitDouble[1].split(':') : [];

  const parseChunk = (chunk) => {
    if (!chunk) return [];
    const items = [];
    for (const part of chunk) {
      if (part.includes('.')) {
        const ipv4 = parseIpv4(part);
        if (!ipv4) return null;
        items.push((ipv4[0] << 8) + ipv4[1]);
        items.push((ipv4[2] << 8) + ipv4[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
        items.push(Number.parseInt(part, 16));
      }
    }
    return items;
  };

  const left = parseChunk(leftRaw);
  const right = parseChunk(rightRaw);
  if (!left || !right) return null;

  if (splitDouble.length === 1) {
    if (left.length !== 8) return null;
    return left;
  }

  const missing = 8 - (left.length + right.length);
  if (missing < 1) return null;

  return [...left, ...new Array(missing).fill(0), ...right];
}

function isPrivateIpv4(ip) {
  const octets = parseIpv4(ip);
  if (!octets) return true;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const groups = parseIpv6ToGroups(ip);
  if (!groups) return true;

  const isLoopback = groups.slice(0, 7).every((value) => value === 0) && groups[7] === 1;
  if (isLoopback) return true;
  if (groups.every((value) => value === 0)) return true;

  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // doc range

  return false;
}

function isPublicIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return !isPrivateIpv4(ip);
  if (version === 6) return !isPrivateIpv6(ip);
  return false;
}

function toIpv4Subnet(ip) {
  const octets = parseIpv4(ip);
  if (!octets) return '0.0.0.0';
  return `${octets[0]}.${octets[1]}.${octets[2]}.0`;
}

function toIpv6Subnet(ip) {
  const groups = parseIpv6ToGroups(ip);
  if (!groups) return '0:0:0:0:0:0:0:0';
  const subnet = [groups[0], groups[1], groups[2], 0, 0, 0, 0, 0];
  return subnet.map((value) => value.toString(16)).join(':');
}

function toIpSubnet(ip) {
  const version = net.isIP(ip);
  if (version === 4) return toIpv4Subnet(ip);
  if (version === 6) return toIpv6Subnet(ip);
  return 'unknown';
}

function resolveClientIp(req) {
  const fromForwardedFor = parseForwardedForHeader(req.headers['x-forwarded-for']);
  const fromForwarded = parseForwardedHeader(req.headers.forwarded);
  const fromReqIp = extractIpToken(req.ip);
  const fromSocket = extractIpToken(req.socket?.remoteAddress);

  const chain = [...fromForwardedFor, ...fromForwarded];
  if (fromReqIp) chain.push(fromReqIp);
  if (fromSocket) chain.push(fromSocket);

  const unique = [...new Set(chain)];
  if (unique.length === 0) return { ip: '0.0.0.0', source: 'unknown' };

  const externalIps = unique.filter((value) => isPublicIp(value));
  if (externalIps.length > 0) {
    return { ip: externalIps[externalIps.length - 1], source: 'proxy_chain' };
  }

  return { ip: unique[unique.length - 1], source: 'internal_chain' };
}

function getFingerprintSalt() {
  const envSalt = process.env.IP_FINGERPRINT_SALT;
  if (envSalt && envSalt.trim()) return envSalt;

  if (!warnedAboutMissingSalt) {
    warnedAboutMissingSalt = true;
    // This keeps local development usable while still signaling insecure setup.
    // Production should always set IP_FINGERPRINT_SALT.
    // eslint-disable-next-line no-console
    console.warn('IP_FINGERPRINT_SALT is not set; using fallback salt source.');
  }

  return process.env.JWT_SECRET || 'unsafe-dev-ip-fingerprint-salt';
}

function createFingerprint({ salt, ipSubnet, normalizedUserAgent }) {
  return crypto
    .createHash('sha256')
    .update(`${salt}|${ipSubnet}|${normalizedUserAgent}`)
    .digest('hex');
}

function ipFingerprintMiddleware(req, res, next) {
  const { ip: clientIp, source } = resolveClientIp(req);
  const ipSubnet = toIpSubnet(clientIp);
  const normalizedUserAgent = normalizeUserAgent(req.headers['user-agent']);
  const fingerprint = createFingerprint({
    salt: getFingerprintSalt(),
    ipSubnet,
    normalizedUserAgent,
  });

  req.clientContext = {
    ip: clientIp,
    ipSubnet,
    normalizedUserAgent,
    source,
  };
  req.ipFingerprint = fingerprint;

  return next();
}

module.exports = {
  ipFingerprintMiddleware,
  normalizeUserAgent,
  toIpSubnet,
  resolveClientIp,
  createFingerprint,
};
