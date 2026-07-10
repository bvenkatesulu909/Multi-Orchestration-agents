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

// Free models on OpenRouter
const MODELS_INFO = [
  { name: 'Gemini Flash', model: 'google/gemini-2.0-flash-exp:free', short: '⚡GF' },
  { name: 'Mistral 7B', model: 'mistralai/mistral-7b-instruct:free', short: '🔷M7' },
  { name: 'Llama 3.2 3B', model: 'meta-llama/llama-3.2-3b-instruct:free', short: '🦙L3' },
  { name: 'Phi-3 Mini', model: 'microsoft/phi-3-mini-4k-instruct:free', short: '🔶P3' },
  { name: 'Qwen 2.5 7B', model: 'qwen/qwen-2.5-7b-instruct:free', short: '🐉Q2' },
  { name: 'DeepSeek Chat', model: 'deepseek/deepseek-chat:free', short: '🔴DS' },
];

function modelShortName(modelStr) {
  if (!modelStr || modelStr === 'fallback (deterministic)') return '⚙️';
  const m = MODELS_INFO.find(m => modelStr.includes(m.model) || m.model.includes(modelStr));
  return m ? m.short : modelStr.split('/').pop()?.split(':')[0] || '🤖';
}

export default function Agents() {
  const [selected, setSelected] = useState('manager');
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showRag, setShowRag] = useState(false);
  const [ragDocs, setRagDocs] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', input_data: '', assignee: '', priority: 'medium' });
  const [ragForm, setRagForm] = useState({ title: '', content: '', tags: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const [tRes, aRes] = await Promise.all([
        api(`/agents/${selected}/tasks`),
        api('/agents'),
      ]);
      setTasks(tRes.data || []);
      const s = {};
      (aRes.data || []).forEach(r => { s[r.id] = r; });
      setSummary(s);
    } catch { setTasks([]); }
  }, [selected]);

  const loadRagDocs = useCallback(async () => {
    try {
      const r = await api('/agents/rag');
      setRagDocs(r.data || []);
    } catch {}
  }, []);

  useEffect(() => { loadTasks(); const iv = setInterval(loadTasks, 3000); return () => clearInterval(iv); }, [loadTasks]);
  useEffect(() => { loadRagDocs(); }, [loadRagDocs]);

  const activeAgent = AGENTS.find(a => a.id === selected);
  const agentSummary = summary[selected] || { total: 0, done: 0, in_progress: 0, failed: 0 };

  const u = k => e => setForm({ ...form, [k]: e.target.value });
  const ru = k => e => setRagForm({ ...ragForm, [k]: e.target.value });

  const createTask = async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await api(`/agents/${selected}/tasks`, { method: 'POST', body: form });
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

  const addRagDoc = async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api('/agents/rag', { method: 'POST', body: { title: ragForm.title, content: ragForm.content, tags: ragForm.tags.split(',').map(t => t.trim()).filter(Boolean) } });
      setRagForm({ title: '', content: '', tags: '' });
      setShowRag(false);
      loadRagDocs();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div>
      {/* Top Bar */}
      <div className="topbar">
        <div>
          <h1>🤖 Multi-Agent System</h1>
          <div className="sub">7 LLM-powered agents with RAG — OpenRouter free models with auto-fallback</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn secondary small" onClick={() => { setShowRag(true); setError(''); }}>📚 RAG Knowledge</button>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Live</span>
        </div>
      </div>

      <div className="content">
        {/* Model Fallback Chain Indicator */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 6 }}>Model Chain:</span>
          {MODELS_INFO.map((m, i) => (
            <span key={i} title={m.name} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--panel-2)', borderRadius: 4, color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {m.short}
              {i < MODELS_INFO.length - 1 && <span style={{ marginLeft: 2, opacity: 0.5 }}>→</span>}
            </span>
          ))}
          <span title="Deterministic fallback" style={{ fontSize: 11, padding: '2px 6px', background: '#4c1d24', borderRadius: 4, color: '#fca5a5', border: '1px solid #7f1d1d' }}>⚙️ Fallback</span>
        </div>

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
            <div className="stat-card" style={{ borderTop: '3px solid var(--success)' }}><div className="label">LLM Done</div><div className="value" style={{ color: 'var(--success)' }}>{agentSummary.done || 0}</div></div>
            <div className="stat-card" style={{ borderTop: '3px solid #3b82f6' }}><div className="label">In Progress</div><div className="value" style={{ color: '#3b82f6' }}>{agentSummary.in_progress || 0}</div></div>
            <div className="stat-card" style={{ borderTop: '3px solid var(--danger)' }}><div className="label">Failed</div><div className="value" style={{ color: 'var(--danger)' }}>{agentSummary.failed || 0}</div></div>
          </div>
        )}

        {/* Create Button */}
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => { setForm({ title: '', description: '', input_data: '', assignee: '', priority: 'medium' }); setError(''); setShowCreate(true); }}>
            + New Task for {activeAgent?.name.split(' ')[0]} (LLM)
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
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Create a task to execute via LLM with RAG context</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Title</th>
                  <th style={{ width: 80 }}>Priority</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 60 }}>Model</th>
                  <th style={{ width: 40 }}>RAG</th>
                  <th style={{ width: 110 }}>Created</th>
                  <th style={{ width: 90 }}>Actions</th>
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
                    <td title={t.model_used || 'N/A'} style={{ fontSize: 11, textAlign: 'center' }}>
                      {t.output_data ? (t.model_used ? modelShortName(t.model_used) : '⚙️') : '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 12 }}>
                      {t.rag_used ? '📚' : '—'}
                    </td>
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

          {/* Output section for completed tasks */}
          {tasks.filter(t => t.output_data).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>📄 Agent Outputs</h4>
              {tasks.filter(t => t.output_data).slice(0, 5).map(t => (
                <div key={t.id} style={{ padding: 10, background: 'var(--bg)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{t.title}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {t.model_used && <>Model: {t.model_used.split('/').pop()?.split(':')[0] || t.model_used} </>}
                      {t.rag_used && '📚 RAG'}
                    </span>
                  </div>
                  <pre style={{ fontSize: 11, color: 'var(--text)', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.5, maxHeight: 150, overflow: 'auto' }}>
                    {t.output_data}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title={`New Task — ${activeAgent?.name} (LLM)`} onClose={() => setShowCreate(false)}>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={createTask}>
            <div className="field" style={{ marginBottom: 12 }}><label>Title *</label><input value={form.title} onChange={u('title')} required /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Description</label><textarea value={form.description} onChange={u('description')} /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Input Data</label><textarea value={form.input_data} onChange={u('input_data')} placeholder="e.g., Build a login page with React" /></div>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="field"><label>Priority</label>
                <select value={form.priority} onChange={u('priority')}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="field"><label>Assignee</label><input value={form.assignee} onChange={u('assignee')} placeholder="Name or team" /></div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, padding: 8, background: 'var(--bg)', borderRadius: 6 }}>
              ⚡ Task will execute via LLM (OpenRouter free models with auto-fallback) + RAG knowledge retrieval
            </div>
            <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Creating…' : `Create & Execute via LLM`}</button>
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

      {/* RAG Knowledge Modal */}
      {showRag && (
        <Modal title="📚 RAG Knowledge Base" onClose={() => setShowRag(false)}>
          {error && <div className="error-msg">{error}</div>}
          
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ fontSize: 13, marginBottom: 8 }}>Existing Knowledge ({ragDocs.length} docs)</h4>
            {ragDocs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>No documents yet</div>
            ) : (
              ragDocs.map(d => (
                <div key={d.id} style={{ padding: '6px 8px', background: 'var(--bg)', borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{d.title}</span>
                  <span style={{ color: 'var(--muted)', marginLeft: 6 }}>{d.tags?.map(t => `#${t}`).join(' ')}</span>
                </div>
              ))
            )}
          </div>

          <h4 style={{ fontSize: 13, marginBottom: 8 }}>Add Knowledge</h4>
          <form onSubmit={addRagDoc}>
            <div className="field" style={{ marginBottom: 10 }}><label>Title</label><input value={ragForm.title} onChange={ru('title')} required /></div>
            <div className="field" style={{ marginBottom: 10 }}><label>Content</label><textarea value={ragForm.content} onChange={ru('content')} rows={4} required /></div>
            <div className="field" style={{ marginBottom: 12 }}><label>Tags (comma-separated)</label><input value={ragForm.tags} onChange={ru('tags')} placeholder="api, security, deployment" /></div>
            <button className="btn" disabled={busy} type="submit" style={{ width: '100%' }}>{busy ? 'Adding…' : 'Add to RAG Knowledge'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}