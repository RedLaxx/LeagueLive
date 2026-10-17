'use strict';

const crypto = require('crypto');
const db = require('./db');

const DEFAULT_PASSWORD = 'leaguelive';
const SESSION_HOURS = 12;

function adminPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

function secret() {
  let s = db.getMeta('auth_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    db.setMeta('auth_secret', s);
  }
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function login(password) {
  if (String(password) !== adminPassword()) return null;
  return sign({ sub: 'admin', exp: Date.now() + SESSION_HOURS * 3600 * 1000 });
}

function middleware(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  const payload = verify(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized. Sign in to the admin panel.' });
  }
  req.admin = payload;
  return next();
}

module.exports = { login, verify, middleware, adminPassword, DEFAULT_PASSWORD };
