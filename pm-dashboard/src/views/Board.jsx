import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Modal, Badge } from '../components/ui.jsx';

export default function Board() {
  const [projects, setProjects] = useState([]);
  const [selProj, setSelProj] = useState(null);
  const [board, setBoard] = useState(null);
  const [showTask, setShowTask] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', assignee_id: '', status_id: '' });
  const [error, setError] = useState('');

  useEffect(() => { api('/projects').then(r => setProjects(r.data)).catch(() => {}); }, []);

  const loadBoard = (pid) => {
    api(`/projects/${pid}`).then(r => { setBoard(r.data); setSelProj(r.data); }).catch(() => {});
  };

  const openCreate = (statusId) => {
    setForm({ title: '', description: '', priority: 'medium', assignee_id: '', status_id: statusId || '' });
    setShowCreate(true);
  };

  const createTask = async e => {
    e.preventDefault(); setError('');
    try {
      await api('/tasks', { method: 'POST', body: { ...form, project_id: selProj.id, status_id: Number(form.status_id), assignee_id: form.assignee_id ? Number(form.assignee_id) : null } });
      setShowCreate(false); loadBoard(selProj.id);
    } catch (err) { setError(err.message); }
  };

  const moveTask = async (taskId, newStatusId) => {
    await api(`/tasks/${taskId}`, { method: 'PUT', body: { status_id: newStatusId } });
    loadBoard(selProj.id);
  };

  const openEdit = (task) => {
    setEditTask(task);
    setForm({ title: task.title, description: task.description || '', priority: task.priority, assignee_id: task.assignee_id || '', status_id: task.status_id || '' });
    setShowTask(true);
  };

  const updateTask = async e => {
    e.preventDefault(); setError('');
    try {
      await api(`/tasks/${editTask.id}`, { method: 'PUT', body: { ...form, assignee_id: form.assignee_id ? Number(form.assignee_id) : null } });
      setShowTask(false); loadBoard(selProj.id);
    } catch (err) { setError(err.message); }
  };

  const deleteTask = async id => { if (!confirm('Delete task?')) return; await api(`/tasks/${id}`, { method: 'DELETE' }); loadBoard(selProj.id); setShowTask(false); };

  const u = k => e => setForm({ ...form, [k]: e.target.value });

  if (!board) {
    return (
      <div>
        <div className="topbar"><div><h1>Board</h1><div className="sub">Select a project to view its board</div></div></div>
        <div className="content">
          <div className="stat-row">
            {projects.map(p => (
              <div key={p.id} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => loadBoard(p.id)}>
                <div className="label">{p.name}</div>
                <div className="value" style={{ fontSize: 16 }}>{p.task_count || 0} tasks</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div><h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: board.color || 'var(--primary)', display: 'inline-block' }} />
          {board.name}
        </h1><div className="sub">{board.description || 'Project board'}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {projects.filter(p => p.id !== board.id).map(p => (
            <button key={p.id} className="btn secondary small" onClick={() => { setSelProj(null); setBoard(null); loadBoard(p.id); }}>{p.name}</button>
          ))}
        </div>
      </div>
      <div className="content">
        <div className="kanban">
          {board.statuses?.map(col => (
            <div key={col.id} className="kanban-col">
              <div className="kanban-col-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                  {col.name}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{board.tasks?.filter(t => t.status_id === col.id).length || 0}</span>
              </div>
              <div className="kanban-cards">
                {board.tasks?.filter(t => t.status_id === col.id).map(task => (
                  <div key={task.id} className="kanban-card" onClick={() => openEdit(task)}>
                    <div className="title">{task.title}</div>
                    {task.description && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{task.description.substring(0, 60)}{task.description.length > 60 ? '…' : ''}</div>}
                    <div className="meta">
                      <Badge kind={task.priority}>{task.priority}</Badge>
                      <span>{task.assignee_name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {task.labels?.map(l => <span key={l.id} style={{ background: l.color+'33', color: l.color, padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>{l.name}</span>)}
                    </div>
                  </div>
                ))}
                <button className="btn secondary small" style={{ margin: '4px 0', width: '100%' }} onClick={() => openCreate(col.id)}>+ Add Task</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <Modal title="New Task" onClose={() => setShowCreate(false)}>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={createTask}>
            <div className="field" style={{ marginBottom: 12 }}><label>Title *</label><input value={form.title} onChange={u('title')} required /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Description</label><textarea value={form.description} onChange={u('description')} /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Priority</label>
              <select value={form.priority} onChange={u('priority')}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}><label>Status</label>
              <select value={form.status_id} onChange={u('status_id')}>
                {board.statuses?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}><label>Assignee</label>
              <select value={form.assignee_id} onChange={u('assignee_id')}>
                <option value="">— Unassigned —</option>
                {board.members?.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </div>
            <button className="btn">Create Task</button>
          </form>
        </Modal>
      )}

      {showTask && editTask && (
        <Modal title="Edit Task" onClose={() => setShowTask(false)}>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={updateTask}>
            <div className="field" style={{ marginBottom: 12 }}><label>Title *</label><input value={form.title} onChange={u('title')} required /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Description</label><textarea value={form.description} onChange={u('description')} /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Priority</label>
              <select value={form.priority} onChange={u('priority')}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}><label>Status</label>
              <select value={form.status_id} onChange={u('status_id')}>
                {board.statuses?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}><label>Assignee</label>
              <select value={form.assignee_id} onChange={u('assignee_id')}>
                <option value="">— Unassigned —</option>
                {board.members?.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button className="btn" type="submit">Save</button>
              <button className="btn danger" type="button" onClick={() => deleteTask(editTask.id)}>Delete</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}