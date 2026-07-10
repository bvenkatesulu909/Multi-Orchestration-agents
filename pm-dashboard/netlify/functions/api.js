const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'agent-tasks.json');

// ── Persistence ──────────────────────────────────────────────────────────
function readTasks() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
      return [];
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch { return []; }
}

function writeTasks(tasks) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

let nextId = Date.now();
function genId() { return ++nextId; }

// ── Agent definitions ─────────────────────────────────────────────────────
const AGENTS = [
  { id: 'manager',     name: 'Manager Agent',     icon: '🧠', color: '#6366f1', role: 'Orchestrator' },
  { id: 'planner',     name: 'Planning Agent',     icon: '📋', color: '#f59e0b', role: 'Architect' },
  { id: 'research',    name: 'Research Agent',     icon: '🔍', color: '#3b82f6', role: 'Analyst' },
  { id: 'coding',      name: 'Coding Agent',       icon: '💻', color: '#22c55e', role: 'Builder' },
  { id: 'specialized', name: 'Specialized Agent',  icon: '🎯', color: '#ec4899', role: 'Expert' },
  { id: 'worker',      name: 'Worker Agent',       icon: '🔧', color: '#8b5cf6', role: 'Operator' },
  { id: 'memory',      name: 'Memory Agent',       icon: '🧠', color: '#06b6d4', role: 'Archivist' },
];

// ── Agent Logic (deterministic, no API key needed) ────────────────────────
function executeAgent(agentId, task) {
  const outputs = {
    manager:     `✓ Task decomposed into ${Math.max(1, Math.floor(Math.random() * 4) + 2)} subtasks\n` +
                 `  Subtasks assigned to: Planning, Research, Coding, Worker`,
    planner:     `📋 Implementation plan generated:\n` +
                 `  Phase 1: Requirements analysis\n` +
                 `  Phase 2: Architecture design\n` +
                 `  Phase 3: Implementation\n` +
                 `  Phase 4: Testing & deployment`,
    research:    `🔍 Research findings for "${task.title}":\n` +
                 `  • Best practices identified\n` +
                 `  • 3 API alternatives found\n` +
                 `  • Performance benchmarks: 230ms avg latency`,
    coding:      `💻 Code generated for "${task.title}":\n` +
                 `  src/features/${task.title.toLowerCase().replace(/\s+/g, '-')}/index.js\n` +
                 `  src/features/${task.title.toLowerCase().replace(/\s+/g, '-')}/styles.css\n` +
                 `  Tests written: 4 passing, 0 failing`,
    specialized: `🎯 Expert analysis for "${task.title}":\n` +
                 `  • Security: No vulnerabilities detected\n` +
                 `  • Performance: Optimized query plan\n` +
                 `  • Accessibility: WCAG 2.1 AA compliant`,
    worker:      `🔧 Execution results for "${task.title}":\n` +
                 `  ✓ Dependencies installed (0 vulnerabilities)\n` +
                 `  ✓ Build passed (2.3s)\n` +
                 `  ✓ Tests: 12/12 passing\n` +
                 `  ✓ Deployed to staging`,
    memory:      `🧠 State saved for "${task.title}":\n` +
                 `  Session: ${new Date().toISOString().split('T')[0]}\n` +
                 `  Context: Task completed across ${Math.floor(Math.random() * 3) + 2} agents\n` +
                 `  Artifacts: 3 files created, 2 modified`,
  };
  return outputs[agentId] || `✓ Agent ${agentId} processed task: ${task.title}`;
}

// ── Route handler ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const pathParts = event.path.replace(/\/?\.netlify\/functions\/api/, '').replace(/\/api\/agents/, '').split('/').filter(Boolean);
  const method = event.httpMethod;
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  try {
    // GET /api/agents — list all agents with live stats
    if (method === 'GET' && pathParts.length === 0) {
      const tasks = readTasks();
      const agentsWithStats = AGENTS.map(a => {
        const agentTasks = tasks.filter(t => t.agent_id === a.id);
        return {
          ...a,
          total: agentTasks.length,
          done: agentTasks.filter(t => t.status === 'completed').length,
          in_progress: agentTasks.filter(t => t.status === 'in_progress').length,
          failed: agentTasks.filter(t => t.status === 'failed').length,
          pending: agentTasks.filter(t => t.status === 'pending').length,
        };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ data: agentsWithStats }) };
    }

    // GET /api/agents/stats — aggregate stats
    if (method === 'GET' && pathParts[0] === 'stats') {
      const tasks = readTasks();
      return { statusCode: 200, headers, body: JSON.stringify({
        data: {
          total: tasks.length,
          done: tasks.filter(t => t.status === 'completed').length,
          in_progress: tasks.filter(t => t.status === 'in_progress').length,
          failed: tasks.filter(t => t.status === 'failed').length,
          pending: tasks.filter(t => t.status === 'pending').length,
        }
      })};
    }

    // GET /api/agents/:agentId/tasks — list tasks for an agent
    if (method === 'GET' && pathParts.length === 2 && pathParts[1] === 'tasks') {
      const agentId = pathParts[0];
      const tasks = readTasks().filter(t => t.agent_id === agentId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { statusCode: 200, headers, body: JSON.stringify({ data: tasks }) };
    }

    // POST /api/agents/:agentId/tasks — create task & auto-execute
    if (method === 'POST' && pathParts.length === 2 && pathParts[1] === 'tasks') {
      const agentId = pathParts[0];
      const { title, description, input_data, assignee, priority } = body;
      if (!title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Title required' }) };

      const tasks = readTasks();
      const task = {
        id: genId(),
        agent_id: agentId,
        title,
        description: description || null,
        input_data: input_data || null,
        assignee: assignee || null,
        priority: priority || 'medium',
        status: 'in_progress',
        output_data: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Simulate agent execution (async via setTimeout, but we return the result immediately)
      task.output_data = executeAgent(agentId, task);
      task.status = 'completed';
      tasks.push(task);
      writeTasks(tasks);

      return { statusCode: 201, headers, body: JSON.stringify({ data: task }) };
    }

    // PUT /api/agents/tasks/:id — update task
    const taskUpdateMatch = pathParts[0] === 'tasks' && pathParts.length === 2;
    if (method === 'PUT' && taskUpdateMatch) {
      const taskId = parseInt(pathParts[1]);
      const tasks = readTasks();
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Task not found' }) };

      const { title, description, status, input_data, output_data, assignee, priority } = body;
      if (title) tasks[idx].title = title;
      if (description !== undefined) tasks[idx].description = description;
      if (status) tasks[idx].status = status;
      if (input_data !== undefined) tasks[idx].input_data = input_data;
      if (output_data !== undefined) tasks[idx].output_data = output_data;
      if (assignee !== undefined) tasks[idx].assignee = assignee;
      if (priority) tasks[idx].priority = priority;
      tasks[idx].updated_at = new Date().toISOString();

      // If status changed to in_progress, auto-execute the agent
      if (status === 'in_progress' || (status === 'pending' && tasks[idx].status !== 'completed')) {
        const agent = AGENTS.find(a => a.id === tasks[idx].agent_id);
        if (agent) {
          tasks[idx].output_data = executeAgent(agent.id, tasks[idx]);
          tasks[idx].status = 'completed';
          tasks[idx].updated_at = new Date().toISOString();
        }
      }

      writeTasks(tasks);
      return { statusCode: 200, headers, body: JSON.stringify({ data: tasks[idx] }) };
    }

    // DELETE /api/agents/tasks/:id
    if (method === 'DELETE' && taskUpdateMatch) {
      const taskId = parseInt(pathParts[1]);
      let tasks = readTasks();
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Task not found' }) };
      tasks.splice(idx, 1);
      writeTasks(tasks);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // Fallback: list agents
    return { statusCode: 200, headers, body: JSON.stringify({ data: AGENTS }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};