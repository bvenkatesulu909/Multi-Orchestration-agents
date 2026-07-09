import React, { useState } from 'react';
import { Badge } from '../components/ui.jsx';

const AGENTS = [
  {
    id: 'manager',
    name: 'Manager Agent',
    icon: '🧠',
    color: '#6366f1',
    description: 'Orchestrates the entire workflow — breaks down tasks, spawns agents, validates results, integrates outputs.',
    responsibilities: ['Task breakdown', 'Agent coordination', 'Result validation', 'Integration'],
    status: 'active',
  },
  {
    id: 'planner',
    name: 'Planning Agent',
    icon: '📋',
    color: '#f59e0b',
    description: 'Creates detailed implementation plans with exact file paths, code snippets, and bite-sized tasks (2-5 min each).',
    responsibilities: ['Architecture design', 'File mapping', 'Task sequencing', 'Risk analysis'],
    status: 'active',
  },
  {
    id: 'research',
    name: 'Research Agent',
    icon: '🔍',
    color: '#3b82f6',
    description: 'Explores APIs, documentation, best practices, and design patterns. Returns structured findings.',
    responsibilities: ['Domain research', 'API exploration', 'Pattern discovery', 'Recommendations'],
    status: 'idle',
  },
  {
    id: 'coding',
    name: 'Coding Agent',
    icon: '💻',
    color: '#22c55e',
    description: 'Writes production-ready code — creates files, implements features, follows specs from the Planner.',
    responsibilities: ['Code implementation', 'File creation', 'Feature building', 'Quality assurance'],
    status: 'active',
  },
  {
    id: 'specialized',
    name: 'Specialized Agent',
    icon: '🎯',
    color: '#ec4899',
    description: 'Domain experts for specific areas: UI/UX, Database, Testing, Deployment, Security. Run in parallel.',
    responsibilities: ['UI/UX design', 'Database optimization', 'Test writing', 'Deployment config'],
    status: 'idle',
  },
  {
    id: 'worker',
    name: 'Worker Agent',
    icon: '🔧',
    color: '#8b5cf6',
    description: 'Executes terminal commands: installs deps, runs builds, executes tests, deploys code.',
    responsibilities: ['Package installation', 'Build execution', 'Test running', 'Deployment'],
    status: 'active',
  },
  {
    id: 'memory',
    name: 'Memory Agent',
    icon: '🧠',
    color: '#06b6d4',
    description: 'Documents project state, architecture decisions, and context across sessions for continuity.',
    responsibilities: ['State persistence', 'Decision logging', 'Cross-session context', 'Documentation'],
    status: 'idle',
  },
];

const WORKFLOW_STEPS = [
  { from: 'Manager', to: 'Planner', label: 'Delegates planning' },
  { from: 'Planner', to: 'Coding', label: 'Provides specs' },
  { from: 'Research', to: 'Planner', label: 'Informs design' },
  { from: 'Coding', to: 'Worker', label: 'Sends for build' },
  { from: 'Specialized', to: 'Coding', label: 'Parallel experts' },
  { from: 'Worker', to: 'Memory', label: 'Records state' },
];

export default function Agents() {
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <div className="topbar">
        <div><h1>🤖 Multi-Agent System</h1><div className="sub">7 specialized agents working in orchestration</div></div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>System Online</span>
        </div>
      </div>
      <div className="content">
        {/* Agent Cards Grid */}
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {AGENTS.map(agent => (
            <div
              key={agent.id}
              className="stat-card"
              style={{
                cursor: 'pointer',
                borderColor: selected === agent.id ? agent.color : 'var(--border)',
                borderWidth: selected === agent.id ? 2 : 1,
              }}
              onClick={() => setSelected(selected === agent.id ? null : agent.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: agent.color + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>
                  {agent.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{agent.name}</div>
                  <div style={{ marginTop: 3 }}>
                    <Badge kind={agent.status === 'active' ? 'active' : 'info'}>
                      {agent.status === 'active' ? '● Active' : '○ Idle'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 8 }}>
                {agent.description}
              </div>
              {selected === agent.id && (
                <div style={{ marginTop: 8, padding: 10, background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
                    Responsibilities
                  </div>
                  {agent.responsibilities.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: agent.color }}>◆</span> {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Architecture Flow */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>🏗️ Agent Workflow</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap', padding: '16px 0' }}>
            {AGENTS.map((agent, i) => (
              <React.Fragment key={agent.id}>
                <div style={{
                  background: agent.color + '15',
                  border: `1px solid ${agent.color}40`,
                  borderRadius: 10, padding: '10px 14px',
                  textAlign: 'center', minWidth: 100,
                }}>
                  <div style={{ fontSize: 22 }}>{agent.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, color: agent.color }}>{agent.name.split(' ')[0]}</div>
                </div>
                {i < AGENTS.length - 1 && (
                  <div style={{ color: 'var(--muted)', fontSize: 16, padding: '0 4px' }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
            Manager orchestrates → Planner designs → Coding builds → Worker tests → Memory preserves
          </div>
        </div>

        {/* How It Works */}
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><h3>⚡ Execution Flow</h3></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { phase: '1. Research', desc: 'Research Agent explores domain, APIs, patterns', agent: '🔍' },
                { phase: '2. Plan', desc: 'Planning Agent creates file-by-file implementation plan', agent: '📋' },
                { phase: '3. Build', desc: 'Coding Agents + Specialized Agents write code in parallel', agent: '💻' },
                { phase: '4. Test', desc: 'Worker Agent installs deps, runs builds, executes tests', agent: '🔧' },
                { phase: '5. Deploy', desc: 'Worker pushes to GitHub, deploys to Netlify', agent: '🚀' },
                { phase: '6. Memory', desc: 'Memory Agent saves project state for continuity', agent: '🧠' },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ fontSize: 20 }}>{step.agent}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{step.phase}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>📊 Agent Stats</h3></div>
            <table className="compact">
              <thead><tr><th>Agent</th><th>Role</th><th>Status</th><th>Tasks</th></tr></thead>
              <tbody>
                {AGENTS.map(a => (
                  <tr key={a.id}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{a.icon}</span>
                      <span style={{ fontWeight: 500 }}>{a.name.split(' ')[0]}</span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{a.name.includes('Agent') ? 'Specialist' : 'Core'}</td>
                    <td><Badge kind={a.status === 'active' ? 'active' : 'info'}>{a.status}</Badge></td>
                    <td>{a.responsibilities.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}