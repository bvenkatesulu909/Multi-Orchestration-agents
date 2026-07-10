const fs = require('fs');
const path = require('path');

const DATA_FILE = '/tmp/agent-tasks.json';

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
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

let nextId = Date.now();
function genId() { return ++nextId; }

const AGENTS = [
  { id: 'manager',     name: 'Manager Agent',     icon: '🧠', color: '#6366f1', role: 'Orchestrator' },
  { id: 'planner',     name: 'Planning Agent',     icon: '📋', color: '#f59e0b', role: 'Architect' },
  { id: 'research',    name: 'Research Agent',     icon: '🔍', color: '#3b82f6', role: 'Analyst' },
  { id: 'coding',      name: 'Coding Agent',       icon: '💻', color: '#22c55e', role: 'Builder' },
  { id: 'specialized', name: 'Specialized Agent',  icon: '🎯', color: '#ec4899', role: 'Expert' },
  { id: 'worker',      name: 'Worker Agent',       icon: '🔧', color: '#8b5cf6', role: 'Operator' },
  { id: 'memory',      name: 'Memory Agent',       icon: '🧠', color: '#06b6d4', role: 'Archivist' },
];

function generateAgentOutput(agentId, task) {
  const outputs = {
    manager:     '✓ Task decomposed into 3 subtasks\n  Subtasks assigned to: Planning, Research, Coding',
    planner:     '📋 Implementation plan for "' + task.title + '":\n  Phase 1: Analysis\n  Phase 2: Design\n  Phase 3: Implementation\n  Phase 4: Testing',
    research:    '🔍 Research findings for "' + task.title + '":\n  Best practices identified, 3 approaches found, recommendations included',
    coding:      '💻 Code structure for "' + task.title + '":\n  src/index.js — Main logic\n  src/utils.js — Helper functions\n  Tests: 3 test cases identified',
    specialized: '🎯 Expert analysis for "' + task.title + '":\n  Architecture: Optimal\n  Performance: Within range\n  Security: Standard measures applied',
    worker:      '🔧 Execution plan for "' + task.title + '":\n  1. Install dependencies\n  2. Run build\n  3. Execute tests\n  4. Deploy',
    memory:      '🧠 State recorded for "' + task.title + '":\n  Session context saved\n  Decisions documented\n  Artifacts cataloged',
  };
  return outputs[agentId] || 'Agent ' + agentId + ' processed task: ' + task.title;
}

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
        return { ...a, total: agentTasks.length, done: agentTasks.filter(t => t.status === 'completed').length, in_progress: agentTasks.filter(t => t.status === 'in_progress').length, failed: agentTasks.filter(t => t.status === 'failed').length, pending: agentTasks.filter(t => t.status === 'pending').length };
      });
      return { statusCode: 200, headers, body: JSON.stringify({ data: agentsWithStats }) };
    }

    // GET /api/agents/stats
    if (method === 'GET' && pathParts[0] === 'stats') {
      const tasks = readTasks();
      return { statusCode: 200, headers, body: JSON.stringify({ data: { total: tasks.length, done: tasks.filter(t => t.status === 'completed').length, in_progress: tasks.filter(t => t.status === 'in_progress').length, failed: tasks.filter(t => t.status === 'failed').length, pending: tasks.filter(t => t.status === 'pending').length } }) };
    }

    // GET /api/agents/:agentId/tasks
    if (method === 'GET' && pathParts.length === 2 && pathParts[1] === 'tasks') {
      const tasks = readTasks().filter(t => t.agent_id === pathParts[0]).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { statusCode: 200, headers, body: JSON.stringify({ data: tasks }) };
    }

    // POST /api/agents/:agentId/tasks — create & execute
    if (method === 'POST' && pathParts.length === 2 && pathParts[1] === 'tasks') {
      const agentId = pathParts[0];
      const { title, description, input_data, assignee, priority } = body;
      if (!title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Title required' }) };

      const tasks = readTasks();
      const task = { id: genId(), agent_id: agentId, title, description: description || null, input_data: input_data || null, assignee: assignee || null, priority: priority || 'medium', status: 'completed', output_data: generateAgentOutput(agentId, { title, description }), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      tasks.push(task);

      // If Manager, create subtasks
      if (agentId === 'manager') {
        for (const subId of ['planner', 'research', 'coding', 'worker']) {
          tasks.push({ id: genId(), agent_id: subId, title: 'Subtask: ' + title + ' — ' + subId, description: 'Auto-generated', status: 'pending', output_data: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        }
      }

      writeTasks(tasks);
      return { statusCode: 201, headers, body: JSON.stringify({ data: task }) };
    }

    // PUT /api/agents/tasks/:id
    const taskMatch = pathParts[0] === 'tasks' && pathParts.length === 2;
    if (method === 'PUT' && taskMatch) {
      const taskId = parseInt(pathParts[1]);
      const tasks = readTasks();
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
      const { title, description, status, input_data, output_data, assignee, priority } = body;
      if (title) tasks[idx].title = title;
      if (description !== undefined) tasks[idx].description = description;
      if (status) tasks[idx].status = status;
      if (input_data !== undefined) tasks[idx].input_data = input_data;
      if (output_data !== undefined) tasks[idx].output_data = output_data;
      if (assignee !== undefined) tasks[idx].assignee = assignee;
      if (priority) tasks[idx].priority = priority;
      tasks[idx].updated_at = new Date().toISOString();
      if (status === 'in_progress') { tasks[idx].output_data = generateAgentOutput(tasks[idx].agent_id, tasks[idx]); tasks[idx].status = 'completed'; }
      writeTasks(tasks);
      return { statusCode: 200, headers, body: JSON.stringify({ data: tasks[idx] }) };
    }

    // DELETE /api/agents/tasks/:id
    if (method === 'DELETE' && taskMatch) {
      const taskId = parseInt(pathParts[1]);
      let tasks = readTasks();
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
      tasks.splice(idx, 1);
      writeTasks(tasks);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ data: AGENTS }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};