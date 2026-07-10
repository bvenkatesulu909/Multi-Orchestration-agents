const fs = require('fs');
const path = require('path');
const { executeAgentWithLLM, retrieveRelevantDocs, addKnowledgeDoc, KNOWLEDGE_DOCS, generateFallbackOutput } = require('./llm.js');

const DATA_FILE = '/tmp/agent-tasks.json';

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

    // GET /api/agents/rag — list RAG knowledge documents
    if (method === 'GET' && pathParts[0] === 'rag' && pathParts.length === 1) {
      return { statusCode: 200, headers, body: JSON.stringify({ data: KNOWLEDGE_DOCS.map(d => ({ id: d.id, title: d.title, tags: d.tags })) }) };
    }

    // POST /api/agents/rag — add knowledge document
    if (method === 'POST' && pathParts[0] === 'rag' && pathParts.length === 1) {
      const { title, content, tags } = body;
      if (!title || !content) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Title and content required' }) };
      const doc = addKnowledgeDoc(title, content, tags || []);
      return { statusCode: 201, headers, body: JSON.stringify({ data: doc }) };
    }

    // GET /api/agents/rag/search — search knowledge
    if (method === 'GET' && pathParts[0] === 'rag' && pathParts[1] === 'search') {
      const query = event.queryStringParameters?.q || '';
      if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query required' }) };
      const results = retrieveRelevantDocs(query, 5);
      return { statusCode: 200, headers, body: JSON.stringify({ data: results }) };
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

    // POST /api/agents/:agentId/tasks — create task & execute via LLM
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
        model_used: null,
        rag_used: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      tasks.push(task);
      writeTasks(tasks);

      // Execute agent with real LLM + RAG
      try {
        const result = await executeAgentWithLLM(agentId, task);
        task.output_data = result.content;
        task.model_used = result.model;
        task.rag_used = !!result.ragContext;
        task.status = 'completed';
        task.updated_at = new Date().toISOString();
        
        // If Manager, also create subtasks for other agents
        if (agentId === 'manager' && task.output_data) {
          const subtaskAgents = ['planner', 'research', 'coding', 'worker'];
          for (const subAgentId of subtaskAgents) {
            const subTask = {
              id: genId(),
              agent_id: subAgentId,
              title: `Subtask: ${task.title} — ${subAgentId}`,
              description: `Auto-generated subtask from Manager: ${task.output_data.substring(0, 200)}`,
              input_data: task.output_data,
              assignee: subAgentId,
              priority: task.priority,
              status: 'pending',
              output_data: null,
              model_used: null,
              rag_used: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            tasks.push(subTask);
          }
        }
      } catch (err) {
        task.status = 'failed';
        task.output_data = `Error: ${err.message}`;
        task.updated_at = new Date().toISOString();
      }

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

      // If status changed to in_progress, execute via LLM
      if (status === 'in_progress' && tasks[idx].status !== 'completed') {
        try {
          const result = await executeAgentWithLLM(tasks[idx].agent_id, tasks[idx]);
          tasks[idx].output_data = result.content;
          tasks[idx].model_used = result.model;
          tasks[idx].rag_used = !!result.ragContext;
          tasks[idx].status = 'completed';
          tasks[idx].updated_at = new Date().toISOString();
        } catch (err) {
          tasks[idx].status = 'failed';
          tasks[idx].output_data = `Error: ${err.message}`;
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