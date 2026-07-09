const TOKEN_KEY = 'pm_token';
export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

// LocalStorage fallback for agent tasks when backend is unavailable (Netlify deploy)
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function lsSet(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

let agentTaskId = Date.now();
function nextId() { return ++agentTaskId; }

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch (e) { data = { error: 'Invalid response' }; }
    if (!res.ok) throw new Error((data && data.error) || `Error (${res.status})`);
    return data;
  } catch (err) {
    // LocalStorage fallback for agent endpoints
    if (path.startsWith('/agents/') || path.startsWith('/agents')) {
      return lsAgentFallback(path, method, body);
    }
    throw err;
  }
}

function lsAgentFallback(path, method, body) {
  const m = path.match(/^\/agents\/([^/]+)\/tasks(?:\/(\d+))?$/);
  const m2 = path.match(/^\/agents\/tasks\/(\d+)$/);
  const m3 = path === '/agents/summary';

  if (m3) {
    const all = lsGet('agent_tasks');
    const grouped = {};
    all.forEach(t => {
      if (!grouped[t.agent_id]) grouped[t.agent_id] = { total: 0, done: 0, in_progress: 0, failed: 0 };
      grouped[t.agent_id].total++;
      if (t.status === 'completed') grouped[t.agent_id].done++;
      else if (t.status === 'in_progress') grouped[t.agent_id].in_progress++;
      else if (t.status === 'failed') grouped[t.agent_id].failed++;
    });
    return { data: Object.entries(grouped).map(([k, v]) => ({ agent_id: k, ...v })) };
  }

  if (m2) {
    // PUT or DELETE by ID
    const all = lsGet('agent_tasks');
    if (method === 'DELETE') {
      const idx = all.findIndex(t => t.id === parseInt(m2[1]));
      if (idx === -1) throw new Error('Not found');
      all.splice(idx, 1);
      lsSet('agent_tasks', all);
      return { success: true };
    }
    if (method === 'PUT') {
      const idx = all.findIndex(t => t.id === parseInt(m2[1]));
      if (idx === -1) throw new Error('Not found');
      all[idx] = { ...all[idx], ...body, updated_at: new Date().toISOString() };
      lsSet('agent_tasks', all);
      return { data: all[idx] };
    }
    return { data: all.filter(t => t.id === parseInt(m2[1])) };
  }

  if (m) {
    const agentId = m[1];
    const taskId = m[2];
    const all = lsGet('agent_tasks');

    if (method === 'GET') {
      return { data: all.filter(t => t.agent_id === agentId) };
    }
    if (method === 'POST') {
      const task = {
        id: nextId(),
        agent_id: agentId,
        ...body,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      all.push(task);
      lsSet('agent_tasks', all);
      return { data: task };
    }
  }

  throw new Error('Storage unavailable');
}