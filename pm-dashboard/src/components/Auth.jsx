import React, { useState } from 'react';
import { api } from '../api.js';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', display_name: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const u = k => e => setForm({ ...form, [k]: e.target.value });

  const submit = async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'login') {
        const r = await api('/auth/login', { method: 'POST', body: { email: form.email, password: form.password } });
        onAuth(r.user, r.token);
      } else {
        const r = await api('/auth/register', { method: 'POST', body: form });
        onAuth(r.user, r.token);
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="card" style={{ width: 380, padding: 32, textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>📋 PM Dashboard</h1>
        <p style={{ color: 'var(--muted)', margin: '0 0 20px' }}>{mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Display Name</label>
              <input value={form.display_name} onChange={u('display_name')} required />
            </div>
          )}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={u('email')} required />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Password</label>
            <input type="password" value={form.password} onChange={u('password')} required minLength={6} />
          </div>
          <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
        </form>
        <div style={{ marginTop: 14, color: 'var(--muted)', fontSize: 13 }}>
          {mode === 'login' ? (
            <>No account? <a onClick={() => { setMode('register'); setError(''); }} style={{ color: 'var(--primary)', cursor: 'pointer' }}>Create one</a></>
          ) : (
            <>Have an account? <a onClick={() => { setMode('login'); setError(''); }} style={{ color: 'var(--primary)', cursor: 'pointer' }}>Sign in</a></>
          )}
        </div>
        {mode === 'login' && (
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
            Demo: <b>admin@pm.test</b> / <b>admin123</b>
          </div>
        )}
      </div>
    </div>
  );
}