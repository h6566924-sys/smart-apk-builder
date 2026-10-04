const API = 'https://api.github.com';
const VERSION = '2026-03-10';

function getToken(req) {
  const h = req.headers?.authorization || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return String(req.headers?.['x-github-token'] || '').trim();
}

function splitRepo(repo) {
  const clean = String(repo || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
  const [owner, name, extra] = clean.split('/');
  if (!owner || !name || extra) throw new Error('اسم المستودع يجب أن يكون owner/repository');
  return { owner, name };
}

async function gh(req, path, init = {}) {
  const token = getToken(req);
  if (!token) throw Object.assign(new Error('لم يتم إرسال مفتاح GitHub'), { status: 401 });
  const headers = {
    accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': VERSION,
    authorization: `Bearer ${token}`,
    ...(init.headers || {})
  };
  if (init.body && !headers['content-type']) headers['content-type'] = 'application/json';
  const r = await fetch(API + path, { ...init, headers });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!r.ok) {
    const msg = data?.message || `GitHub HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    const accepted = r.headers.get('x-accepted-github-permissions');
    if (accepted) err.acceptedPermissions = accepted;
    throw err;
  }
  return { data, headers: r.headers };
}

function json(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 8_000_000) { reject(new Error('البيانات كبيرة جدًا')); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(Object.assign(new Error('JSON غير صالح'), { status: 400 })); } });
    req.on('error', reject);
  });
}

module.exports = { API, getToken, splitRepo, gh, json, readBody };
