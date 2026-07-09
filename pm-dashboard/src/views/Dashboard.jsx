import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Badge } from '../components/ui.jsx';

const AGENTS = [
  { id: 'manager', name: 'Manager Agent', icon: '🧠', color: '#6366f1', desc: 'Orchestrates the entire workflow — breaks down tasks, spawns agents, validates results.' },
  { id: 'planner', name: 'Planning Agent', icon: '📋', color: '#f59e0b', desc: 'Creates detailed implementation plans with exact file paths and bite-sized tasks.' },
  { id: 'research', name: 'Research Agent', icon: '🔍', color: '#3b82f6', desc: 'Explores APIs, documentation, best practices, and design patterns.' },
  { id: 'coding', name: 'Coding Agent', icon: '💻', color: '#22c55e', desc: 'Writes production-ready code — creates files, implements features.' },
  { id: 'specialized', name: 'Specialized Agent', icon: '🎯', color: '#ec4899', desc: 'Domain experts: UI/UX, Database, Testing, Deployment, Security.' },
  { id: 'worker', name: 'Worker Agent', icon: '🔧', color: '#8b5cf6', desc: 'Executes commands: installs deps, runs builds, tests, deploys.' },
  { id: 'memory', name: 'Memory Agent', icon: '🧠', color: '#06b6d4', desc: 'Documents project state, decisions, and context across sessions.' },
];

const MOCK = { projects: [], myTasks: [] };
export default function Dashboard({ setView, setSelProject }) {
  const [data, setData] = useState(null);
  useEffect(() => { api('/dashboard').then(d => setData(d)).catch(() => setData(MOCK)); }, []);

  if (!data) return <div className="loading">Loading dashboard…</div>;

  const totalTasks = data.projects?.reduce((s, p) => s + (p.task_count || 0), 0) || 0;
  const doneTasks = data.projects?.reduce((s, p) => s + (p.done_count || 0), 0) || 0;

  return (
    <div>
      <div className="topbar">
        <div><h1>Dashboard</h1><div className="sub">Project overview & multi-agent orchestration</div></div>
        <button className="btn" onClick={() => setView('projects')}>+ New Project</button>
      </div>
      <div className="content">

        {/* Stats */}
        <div className="stat-row">
          <div className="stat-card"><div className="label">Projects</div><div className="value">{data.projects?.length || 0}</div></div>
          <div className="stat-card"><div className="label">Total Tasks</div><div className="value">{totalTasks}</div></div>
          <div className="stat-card"><div className="label">Completed</div><div className="value">{doneTasks}</div></div>
          <div className="stat-card"><div className="label">My Tasks</div><div className="value">{data.myTasks?.length || 0}</div></div>
        </div>

        {/* Agent Cards */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>🤖 Multi-Agent System — 7 Agents Online</h3>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>All Systems Operational</span>
            </span>
          </div>
          <div className="stat-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {AGENTS.map(agent => (
              <div key={agent.id} className="stat-card" style={{ padding: 14, borderLeft: `3px solid ${agent.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 24 }}>{agent.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{agent.name}</div>
                    <Badge kind="active">● Active</Badge>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{agent.desc}</div>
              </div>
            ))}
          </div>
          {/* Workflow visualization */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 2, marginTop: 10, padding: '12px 0', flexWrap: 'wrap',
            background: 'var(--bg)', borderRadius: 8
          }}>
            {AGENTS.map((a, i) => (
              <React.Fragment key={a.id}>
                <div style={{ textAlign: 'center', padding: '4px 8px' }}>
                  <div style={{ fontSize: 18 }}>{a.icon}</div>
                  <div style={{ fontSize: 9, color: a.color, fontWeight: 600 }}>{a.name.split(' ')[0]}</div>
                </div>
                {i < AGENTS.length - 1 && <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="grid-2">
          {/* Projects */}
          <div className="card">
            <div className="card-header"><h3>Projects</h3><button className="btn secondary small" onClick={() => setView('projects')}>View All</button></div>
            {data.projects?.length === 0 && <div className="empty">No projects yet</div>}
            {data.projects?.map(p => (
              <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => { setSelProject(p); setView('board'); }}>
                <div><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.task_count} tasks · {p.done_count} done</div></div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || 'var(--primary)' }} />
              </div>
            ))}
          </div>
          {/* My Tasks */}
          <div className="card">
            <div className="card-header"><h3>My Tasks</h3></div>
            {data.myTasks?.length === 0 && <div className="empty">No tasks assigned to you</div>}
            {data.myTasks?.map(t => (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.project_name} · {t.due_date || 'No due date'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Stats Table */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><h3>📊 Agent Performance</h3></div>
          <table className="compact">
            <thead><tr><th>Agent</th><th>Role</th><th>Status</th><th>Specialty</th></tr></thead>
            <tbody>
              <tr><td>🧠 Manager</td><td>Orchestrator</td><td><Badge kind="active">Active</Badge></td><td>Task breakdown, coordination, validation</td></tr>
              <tr><td>📋 Planner</td><td>Architect</td><td><Badge kind="active">Active</Badge></td><td>Implementation plans, file mapping</td></tr>
              <tr><td>🔍 Research</td><td>Analyst</td><td><Badge kind="info">Idle</Badge></td><td>API research, pattern discovery</td></tr>
              <tr><td>💻 Coding</td><td>Builder</td><td><Badge kind="active">Active</Badge></td><td>Code implementation, file creation</td></tr>
              <tr><td>🎯 Specialized</td><td>Expert</td><td><Badge kind="info">Idle</Badge></td><td>UI/UX, DB, Testing, Security</td></tr>
              <tr><td>🔧 Worker</td><td>Operator</td><td><Badge kind="active">Active</Badge></td><td>Build, test, deploy</td></tr>
              <tr><td>🧠 Memory</td><td>Archivist</td><td><Badge kind="info">Idle</Badge></td><td>State persistence, documentation</td></tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}