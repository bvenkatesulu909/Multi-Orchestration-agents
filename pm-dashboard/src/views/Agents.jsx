import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { Modal, Badge } from '../components/ui.jsx';

const AGENTS = [
  { id: 'manager',     name: 'Manager Agent',     icon: '🧠', color: '#6366f1', role: 'Orchestrator', desc: 'Breaks down tasks, spawns agents, validates results, integrates outputs.' },
  { id: 'planner',     name: 'Planning Agent',     icon: '📋', color: '#f59e0b', role: 'Architect',   desc: 'Creates detailed implementation plans with file paths and task sequences.' },
  { id: 'research',    name: 'Research Agent',     icon: '🔍', color: '#3b82f6', role: 'Analyst',     desc: 'Explores APIs, docs, best practices and returns structured findings.' },
  { id: 'coding',      name: 'Coding Agent',       icon: '💻', color: '#22c55e', role: 'Builder',     desc: 'Writes production-ready code — creates files, implements features.' },
  { id: 'specialized', name: 'Specialized Agent',  icon: '🎯', color: '#ec4899', role: 'Expert',      desc: 'Domain expert for UI/UX, Database, Testing, Deployment, Security.' },
  { id: 'worker',      name: 'Worker Agent',       icon: '🔧', color: '#8b5cf6', role: 'Operator',    desc: 'Executes commands: installs deps, runs builds, tests, deploys.' },
  { id: 'memory',      name: 'Memory Agent',       icon: '🧠', color: '#06b6d4', role: 'Archivist',   desc: 'Documents project state, decisions, and cross-session context.' },
];

const STATUS_OPTS = [
  { value: 'pending',     label: 'Pending',     color: '#6b7280' },
  { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'completed',   label: 'Completed',   color: '#22c55e' },
  { value: 'failed',      label: 'Failed',      color: '#ef4444' },
];

export default function Agents() {
  const [selected, setSelected] = useState('manager');
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', input_data: '', assignee: '', priority: 'medium' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        api(`/agents/${selected}/tasks`),
        api('/agents/summary'),
      ]);
      setTasks(tRes.data || []);
      const s = {};
      (sRes.data || []).forEach(r => { s[r.agent_id] = r; });
      setSummary(s);
    } catch {
      setTasks([]);
    }
  }, [selected]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const activeAgent = AGENTS.find(a => a.id === selected);
  const agentSummary = summary[selected] || { total: 0, done: 0, in_progress: 0, failed: 0 };

  const u = k => e => setForm({ ...form, [k]: e.target.value });

  const createTask = async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api(`/agents/${selected}/tasks`, { method: 'POST', body: form });
      setShowCreate(false);
      setForm({ title: '', description: '', input_data: '', assignee: '', priority: 'medium' });
      loadTasks();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const updateTask = async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api(`/agents/tasks/${showEdit.id}`, { method: 'PUT', body: form });
      setShowEdit(null);
      setForm({ title: '', description: '', input_data: '', assignee: '', priority: 'medium' });
      loadTasks();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const deleteTask = async id => {
    if (!confirm('Delete this task?')) return;
    await api(`/agents/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
  };

  const quickStatus = async (id, status) => {
    await api(`/agents/tasks/${id}`, { method: 'PUT', body: { status } });
    loadTasks();
  };

  const openEdit = task => {
    setForm({
      title: task.title,
      description: task.description || '',
      input_data: task.input_data || '',
      assignee: task.assignee || '',
      priority: task.priority || 'medium',
    });
    setShowEdit(task);
  };

  return (
    <div>
      {/* Top Bar */}
      <div className="topbar">
        <div>
          <h1>🤖 Multi-Agent System</h1>
          <div className="sub">7 agents with active task management — all data persisted via API</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>System Online</span>
        </div>
      </div>

      <div className="content">
        {/* Agent Nav Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, flexWrap: 'wrap', background: 'var(--panel)', borderRadius: 10, border: '1px solid var(--border)' }}>
          {AGENTS.map(a => {
            const s = summary[a.id] || { total: 0 };
            return (
              <button key={a.id} onClick={() => setSelected(a.id)}
                style={{
                  flex: 1, minWidth: 110, padding: '12px 10px', cursor: 'pointer',
                  background: selected === a.id ? a.color + '20' : 'transparent',
                  border: 'none', borderBottom: selected === a.id ? `3px solid ${a.color}` : '3px solid transparent',
                  color: selected === a.id ? a.color : 'var(--muted)',
                  fontWeight: selected === a.id ? 700 : 500, fontSize: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  transition: 'all .15s',
                }}>
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <span>{a.name.split(' ')[0]}</span>
                {s.total > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>{s.done}/{s.total} done</span>}
              </button>
            );
          })}
        </div>

        {/* Active Agent Info + Stats */}
        {activeAgent && (
          <div className="stat-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
            <div className="stat-card" style={{ borderLeft: `4px solid ${activeAgent.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 32 }}>{activeAgent.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{activeAgent.name}</div>
                  <div style={{ color: activeAgent.color, fontSize: 12, fontWeight: 600 }}>{activeAgent.role}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{activeAgent.desc}</div>
                </div>
              </div>
            </div>
            <div className="stat-card"><div className="label">Total Tasks</div><div className="value">{agentSummary.total || 0}</div></div>
            <div className="stat-card" style={{ borderTop: '3px solid var(--success)' }}><div className="label">Completed</div><div className="value" style={{ color: 'var(--success)' }}>{agentSummary.done || 0}</div></div>
            <div className="stat-card" style={{ borderTop: '3px solid #3b82f6' }}><div className="label">In Progress</div><div className="value" style={{ color: '#3b82f6' }}>{agentSummary.in_progress || 0}</div></div>
            <div className="stat-card" style={{ borderTop: '3px solid var(--danger)' }}><div className="label">Failed</div><div className="value" style={{ color: 'var(--danger)' }}>{agentSummary.failed || 0}</div></div>
          </div>
        )}

        {/* Create Button */}
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => { setForm({ title: '', description: '', input_data: '', assignee: '', priority: 'medium' }); setError(''); setShowCreate(true); }}>
            + New Task for {activeAgent?.name.split(' ')[0]}
          </button>
        </div>

        {/* Task List */}
        <div className="card">
          <div className="card-header">
            <h3>📋 {activeAgent?.name} — Task List</h3>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{tasks.length} tasks</span>
          </div>
          {tasks.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: 32, marginBottom: 8 }}>{activeAgent?.icon}</div>
              <div style={{ fontWeight: 600 }}>No tasks for {activeAgent?.name.split(' ')[0]} yet</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Create your first task to activate this agent</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Title</th>
                  <th style={{ width: 100 }}>Priority</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 100 }}>Assignee</th>
                  <th style={{ width: 160 }}>Created</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <tr key={t.id} style={{ background: t.status === 'failed' ? '#4c1d2415' : t.status === 'completed' ? '#14532d15' : '' }}>
                    <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{t.description.substring(0, 60)}{t.description.length > 60 ? '…' : ''}</div>}
                    </td>
                    <td><Badge kind={t.priority}>{t.priority}</Badge></td>
                    <td>
                      <select value={t.status} onChange={e => quickStatus(t.id, e.target.value)}
                        style={{ padding: '3px 6px', fontSize: 11, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 12 }}>{t.assignee || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn secondary small" onClick={() => openEdit(t)}>✏️</button>
                        <button className="btn danger small" onClick={() => deleteTask(t.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Output/Log Panel for completed tasks */}
        {tasks.filter(t => t.status === 'completed' || t.status === 'failed').length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-header"><h3>📄 Agent Output Log</h3></div>
            <table>
              <thead><tr><th>Task</th><th>Status</th><th>Input</th><th>Output</th></tr></thead>
              <tbody>
                {tasks.filter(t => t.status === 'completed' || t.status === 'failed').slice(0, 10).map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500, fontSize: 12 }}>{t.title}</td>
                    <td><Badge kind={t.status === 'completed' ? 'active' : 'high'}>{t.status}</Badge></td>
                    <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.input_data || '—'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.output_data || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Workflow Visualization */}
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-header"><h3>🏗️ Agent Workflow Pipeline</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap', padding: '16px 0' }}>
            {AGENTS.map((a, i) => (
              <React.Fragment key={a.id}>
                <div onClick={() => setSelected(a.id)} style={{
                  cursor: 'pointer',
                  background: a.color + '15',
                  border: `2px solid ${selected === a.id ? a.color : a.color + '30'}`,
                  borderRadius: 10, padding: '10px 14px',
                  textAlign: 'center', minWidth: 90,
                  transform: selected === a.id ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all .15s',
                }}>
                  <div style={{ fontSize: 24 }}>{a.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, color: a.color }}>{a.name.split(' ')[0]}</div>
                  {(summary[a.id]?.total || 0) > 0 && (
                    <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{summary[a.id]?.done || 0}/{summary[a.id]?.total || 0}</div>
                  )}
                </div>
                {i < AGENTS.length - 1 && (
                  <div style={{ color: 'var(--muted)', fontSize: 16, padding: '0 4px' }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* All Agents Summary */}
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-header"><h3>📊 All Agents — Task Summary</h3></div>
          <table className="compact">
            <thead><tr><th>Agent</th><th>Role</th><th>Total</th><th>Done</th><th>In Progress</th><th>Failed</th><th>Status</th></tr></thead>
            <tbody>
              {AGENTS.map(a => {
                const s = summary[a.id] || { total: 0, done: 0, in_progress: 0, failed: 0 };
                const total = s.total || 0;
                const pct = total > 0 ? Math.round((s.done / total) * 100) : 0;
                return (
                  <tr key={a.id} onClick={() => setSelected(a.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{a.icon}</span>
                      <span style={{ fontWeight: 500 }}>{a.name.split(' ')[0]}</span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{a.role}</td>
                    <td style={{ fontWeight: 600 }}>{total}</td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{s.done}</td>
                    <td style={{ color: '#3b82f6' }}>{s.in_progress}</td>
                    <td style={{ color: s.failed > 0 ? 'var(--danger)' : 'var(--muted)' }}>{s.failed}</td>
                    <td>
                      {total > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 60, height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : 'var(--primary)', borderRadius: 2, transition: 'width .3s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{pct}%</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Idle</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title={`New Task — ${activeAgent?.name}`} onClose={() => setShowCreate(false)}>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={createTask}>
            <div className="field" style={{ marginBottom: 12 }}><label>Title *</label><input value={form.title} onChange={u('title')} required /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Description</label><textarea value={form.description} onChange={u('description')} /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Input Data</label><textarea value={form.input_data} onChange={u('input_data')} placeholder="e.g., API endpoint to call, file to process…" /></div>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="field"><label>Priority</label>
                <select value={form.priority} onChange={u('priority')}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="field"><label>Assignee</label><input value={form.assignee} onChange={u('assignee')} placeholder="Name or team" /></div>
            </div>
            <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Creating…' : 'Create Task'}</button>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <Modal title={`Edit Task — ${showEdit.title.substring(0, 30)}`} onClose={() => setShowEdit(null)}>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={updateTask}>
            <div className="field" style={{ marginBottom: 12 }}><label>Title *</label><input value={form.title} onChange={u('title')} required /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Description</label><textarea value={form.description} onChange={u('description')} /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Input Data</label><textarea value={form.input_data} onChange={u('input_data')} /></div>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="field"><label>Priority</label>
                <select value={form.priority} onChange={u('priority')}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="field"><label>Assignee</label><input value={form.assignee} onChange={u('assignee')} /></div>
            </div>
            <div className="grid-2">
              <button className="btn" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save Changes'}</button>
              <button className="btn danger" type="button" onClick={() => deleteTask(showEdit.id)}>Delete</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}