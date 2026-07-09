/**
 * Ad-hoc verification for server/auth.js
 * Exercises every exported function: hashPassword, verifyPassword,
 * signToken, verifyToken, requireAuth, requireAdmin.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Force the same fallback secret the module uses
process.env.JWT_SECRET = 'pm-dashboard-secret-key-change-in-production';

const mod = await import('file:///C:/Users/User/pm-dashboard/server/auth.js');
const { hashPassword, verifyPassword, signToken, verifyToken, requireAuth, requireAdmin } = mod;

let passed = 0;
let failed = 0;

function assert(ok, label) {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else    { failed++; console.log(`  FAIL  ${label}`); }
}

// 1. hashPassword + verifyPassword round-trip
const pw = 'SuperSecret123!';
const hash = await hashPassword(pw);
assert(typeof hash === 'string' && hash.startsWith('$2a$'), 'hashPassword returns bcrypt hash');

const ok = await verifyPassword(pw, hash);
assert(ok === true, 'verifyPassword matches correct password');

const nok = await verifyPassword('wrong', hash);
assert(nok === false, 'verifyPassword rejects wrong password');

// 2. signToken + verifyToken round-trip
const payload = { id: 42, email: 'alice@example.com', role: 'admin' };
const token = signToken(payload);
assert(typeof token === 'string' && token.split('.').length === 3, 'signToken returns valid JWT');

const decoded = verifyToken(token);
assert(decoded !== null, 'verifyToken returns decoded payload');
assert(decoded.id === 42 && decoded.email === 'alice@example.com', 'verifyToken payload matches');
assert(decoded.role === 'admin', 'verifyToken includes role');

// 3. verifyToken rejects garbage
const bad = verifyToken('nonsense.token.here');
assert(bad === null, 'verifyToken returns null for invalid token');

// 4. Token expiry (should NOT expire in our 7d window, but verify structure)
assert(decoded.exp !== undefined, 'verifyToken payload has exp claim');

// 5. requireAuth middleware — happy path
const authReq = { headers: { authorization: `Bearer ${token}` } };
const authRes = { statusCode: 0, body: null };
const authResMock = {
  status(s) { this.statusCode = s; return this; },
  json(obj) { this.body = obj; }
};
let authNextCalled = false;
requireAuth(authReq, authResMock, () => { authNextCalled = true; });
assert(authNextCalled === true, 'requireAuth passes on valid token');
assert(authReq.user !== undefined, 'requireAuth attaches req.user');
assert(authReq.user.id === 42, 'requireAuth req.user has correct id');

// 6. requireAuth — missing header
const noHeaderReq = { headers: {} };
const noHeaderRes = { statusCode: 0, body: null, calls: [] };
const noHeaderResMock = {
  status(s) { this.statusCode = s; return this; },
  json(obj) { this.body = obj; }
};
let noHeaderNext = false;
requireAuth(noHeaderReq, noHeaderResMock, () => { noHeaderNext = true; });
assert(noHeaderNext === false, 'requireAuth blocks missing header');
assert(noHeaderResMock.statusCode === 401, 'requireAuth returns 401 on missing header');

// 7. requireAuth — malformed header (no Bearer)
const malformedReq = { headers: { authorization: `Token ${token}` } };
const malformedRes = { statusCode: 0, body: null };
const malformedResMock = {
  status(s) { this.statusCode = s; return this; },
  json(obj) { this.body = obj; }
};
let malformedNext = false;
requireAuth(malformedReq, malformedResMock, () => { malformedNext = true; });
assert(malformedNext === false, 'requireAuth blocks malformed header');
assert(malformedResMock.statusCode === 401, 'requireAuth returns 401 on malformed header');

// 8. requireAuth — invalid token
const badTokenReq = { headers: { authorization: 'Bearer dead.beef.cafe' } };
const badTokenRes = { statusCode: 0, body: null };
const badTokenResMock = {
  status(s) { this.statusCode = s; return this; },
  json(obj) { this.body = obj; }
};
let badTokenNext = false;
requireAuth(badTokenReq, badTokenResMock, () => { badTokenNext = true; });
assert(badTokenNext === false, 'requireAuth blocks invalid token');
assert(badTokenResMock.statusCode === 401, 'requireAuth returns 401 on invalid token');

// 9. requireAdmin — happy path
const adminReq = { user: { role: 'admin' } };
const adminResMock = {
  statusCode: 0, body: null,
  status(s) { this.statusCode = s; return this; },
  json(obj) { this.body = obj; }
};
let adminNext = false;
requireAdmin(adminReq, adminResMock, () => { adminNext = true; });
assert(adminNext === true, 'requireAdmin passes for admin role');
assert(adminResMock.statusCode === 0, 'requireAdmin does not send response');

// 10. requireAdmin — non-admin
const userReq = { user: { role: 'user' } };
const userRes = { statusCode: 0, body: null };
const userResMock = {
  status(s) { this.statusCode = s; return this; },
  json(obj) { this.body = obj; }
};
let userNext = false;
requireAdmin(userReq, userResMock, () => { userNext = true; });
assert(userNext === false, 'requireAdmin blocks non-admin');
assert(userResMock.statusCode === 403, 'requireAdmin returns 403');

// 11. requireAdmin — no user (no requireAuth before it)
const noUserReq = {};
const noUserRes = { statusCode: 0, body: null };
const noUserResMock = {
  status(s) { this.statusCode = s; return this; },
  json(obj) { this.body = obj; }
};
let noUserNext = false;
requireAdmin(noUserReq, noUserResMock, () => { noUserNext = true; });
assert(noUserNext === false, 'requireAdmin blocks missing req.user');
assert(noUserResMock.statusCode === 403, 'requireAdmin returns 403 on missing req.user');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);