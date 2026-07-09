import React from 'react';

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'projects', label: 'Projects', icon: '📁' },
  { key: 'board', label: 'Board', icon: '📋' },
  { key: 'tasks', label: 'Tasks', icon: '✅' },
  { key: 'agents', label: 'Agents', icon: '🤖' },
];

export default function Sidebar({ view, setView, user, onLogout }) {
  const initials = (user?.display_name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="sidebar">
      <div className="sidebar-top" style={{ background: 'var(--primary)', padding: 16 }}>
        <div style={{ color: '#000', fontSize: 18, fontWeight: 800 }}>📋 PM</div>
        <div style={{ color: '#000', opacity: 0.7, fontSize: 11 }}>Dashboard</div>
      </div>
      {NAV.map(n => (
        <button key={n.key} className={`nav-item ${view === n.key ? 'active' : ''}`} onClick={() => setView(n.key)}>
          <span>{n.icon}</span><span className="txt">{n.label}</span>
        </button>
      ))}
      <div className="nav-spacer" />
      <div className="sidebar-user" style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="avatar" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{initials}</div>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{user?.display_name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.role}</div></div>
        <button className="btn small" onClick={onLogout} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '4px 8px', fontSize: 11 }}>Logout</button>
      </div>
    </div>
  );
}