import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Modal } from '../components/ui.jsx';

export default function Projects({ setView, setSelProject }) {
  const [projects, setProjects] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#6366f1' });
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);
  const load = () => api('/projects').then(r => setProjects(r.data)).catch(() => {});
  const u = k => e => setForm({ ...form, [k]: e.target.value });

  const create = async e => {
    e.preventDefault(); setError('');
    try {
      const ws = await api('/workspaces');
      const wid = ws.data?.[0]?.id;
      if (!wid) throw new Error('No workspace found');
      await api('/projects', { method: 'POST', body: { ...form, workspace_id: wid } });
      setShowCreate(false); load();
    } catch (err) { setError(err.message); }
  };

  const remove = async id => { if (!confirm('Delete project?')) return; await api(`/projects/${id}`, { method: 'DELETE' }); load(); };

  return (
    <div>
      <div className="topbar"><div><h1>Projects</h1><div className="sub">Manage your workspaces</div></div>
        <button className="btn" onClick={() => setShowCreate(true)}>+ New Project</button>
      </div>
      <div className="content">
        <div className="stat-row">
          {projects.map(p => (
            <div key={p.id} className="stat-card" style={{ cursor: 'pointer' }}
              onClick={() => { setSelProject(p); setView('board'); }}>
              <div className="label">{p.name}</div>
              <div className="value" style={{ fontSize: 16 }}>{p.task_count || 0} tasks</div>
              <div className="sub-value" style={{ color: 'var(--muted)', fontSize: 12 }}>{p.description || '—'}</div>
              <button className="btn danger small" style={{ marginTop: 8 }} onClick={e => { e.stopPropagation(); remove(p.id); }}>Delete</button>
            </div>
          ))}
          {projects.length === 0 && <div className="empty">No projects. Create one!</div>}
        </div>
      </div>
      {showCreate && (
        <Modal title="New Project" onClose={() => setShowCreate(false)}>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={create}>
            <div className="field" style={{ marginBottom: 12 }}><label>Name</label><input value={form.name} onChange={u('name')} required /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Description</label><textarea value={form.description} onChange={u('description')} /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Color</label><input type="color" value={form.color} onChange={u('color')} /></div>
            <button className="btn">Create Project</button>
          </form>
        </Modal>
      )}
    </div>
  );
}