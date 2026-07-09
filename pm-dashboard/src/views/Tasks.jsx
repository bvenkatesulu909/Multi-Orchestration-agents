import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Badge } from '../components/ui.jsx';

export default function Tasks({ setView }) {
  const [projects, setProjects] = useState([]);
  const [selProj, setSelProj] = useState('');
  const [tasks, setTasks] = useState([]);

  useEffect(() => { api('/projects').then(r => setProjects(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!selProj) return;
    api(`/tasks?project_id=${selProj}`).then(r => setTasks(r.data)).catch(() => {});
  }, [selProj]);

  return (
    <div>
      <div className="topbar">
        <div><h1>Tasks</h1><div className="sub">All tasks across projects</div></div>
        <select value={selProj} onChange={e => setSelProj(e.target.value)} style={{ width: 200 }}>
          <option value="">Select project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.task_count || 0})</option>)}
        </select>
      </div>
      <div className="content">
        <div className="card">
          <table>
            <thead><tr><th>Title</th><th>Priority</th><th>Assignee</th><th>Labels</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              {tasks.length === 0 && <tr><td colSpan={6} className="empty">Select a project to view tasks</td></tr>}
              {tasks.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.title}</td>
                  <td><Badge kind={t.priority}>{t.priority}</Badge></td>
                  <td>{t.assignee_name || '—'}</td>
                  <td>{t.labels?.map(l => <span key={l.id} style={{ background: l.color+'33', color: l.color, padding: '2px 6px', borderRadius: 4, fontSize: 10, marginRight: 4 }}>{l.name}</span>)}</td>
                  <td>{t.status_id ? 'Active' : 'Todo'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{t.due_date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}