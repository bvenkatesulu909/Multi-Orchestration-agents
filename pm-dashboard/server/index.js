import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from './db.js';
import { hashPassword, verifyPassword, signToken, requireAuth, requireAdmin } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

function publicUser(u) { if (!u) return null; const { password_hash, ...rest } = u; return rest; }

// ===== AUTH =====
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, display_name, password } = req.body || {};
    if (!email || !display_name || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 chars' });
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const info = db.prepare('INSERT INTO users (email, display_name, password_hash) VALUES (?,?,?)').run(email, display_name, hashPassword(password));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    // Auto-create workspace
    const ws = db.prepare('INSERT INTO workspaces (name, slug, description) VALUES (?,?,?)').run(`${display_name}'s Workspace`, email.split('@')[0] + '-ws', 'Auto-created workspace');
    const project = db.prepare('INSERT INTO projects (workspace_id, name, description) VALUES (?,?,?)').run(ws.lastInsertRowid, 'My First Project', 'Getting started');
    const pid = project.lastInsertRowid;
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(pid, user.id, 'admin');
    // Create default statuses
    const statuses = [['Todo', '#6b7280', 0], ['In Progress', '#3b82f6', 1], ['Done', '#22c55e', 2]];
    for (const [name, color, pos] of statuses) {
      db.prepare('INSERT INTO task_statuses (project_id, name, color, position) VALUES (?,?,?,?)').run(pid, name, color, pos);
    }
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

// ===== WORKSPACES =====
app.get('/api/workspaces', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT w.*, (SELECT COUNT(*) FROM projects WHERE workspace_id = w.id) AS project_count
     FROM workspaces w ORDER BY w.name`
  ).all();
  res.json({ data: rows });
});

app.post('/api/workspaces', requireAuth, (req, res) => {
  const { name, slug, description } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' });
  const info = db.prepare('INSERT INTO workspaces (name, slug, description) VALUES (?,?,?)').run(name, slug, description || null);
  const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ data: row });
});

// ===== PROJECTS =====
app.get('/api/projects', requireAuth, (req, res) => {
  const { workspace_id } = req.query;
  let q = 'SELECT p.*, (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count FROM projects p';
  const params = [];
  if (workspace_id) { q += ' WHERE p.workspace_id = ?'; params.push(workspace_id); }
  q += ' ORDER BY p.created_at DESC';
  const rows = db.prepare(q).all(...params);
  res.json({ data: rows });
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  const statuses = db.prepare('SELECT * FROM task_statuses WHERE project_id = ? ORDER BY position').all(req.params.id);
  const tasks = db.prepare(
    `SELECT t.*, u.display_name AS assignee_name, u.email AS assignee_email
     FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ? ORDER BY t.position`
  ).all(req.params.id);
  const members = db.prepare(
    `SELECT u.id, u.display_name, u.email, pm.role FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?`
  ).all(req.params.id);
  const sprints = db.prepare('SELECT * FROM sprints WHERE project_id = ? ORDER BY start_date DESC').all(req.params.id);
  const labels = db.prepare('SELECT * FROM labels WHERE id IN (SELECT DISTINCT label_id FROM task_labels WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?))').all(req.params.id);
  res.json({ data: { ...row, statuses, tasks, members, sprints, labels } });
});

app.post('/api/projects', requireAuth, (req, res) => {
  const { workspace_id, name, description, color } = req.body || {};
  if (!workspace_id || !name) return res.status(400).json({ error: 'Workspace and name required' });
  const info = db.prepare('INSERT INTO projects (workspace_id, name, description, color) VALUES (?,?,?,?)').run(workspace_id, name, description || null, color || '#6366f1');
  const pid = info.lastInsertRowid;
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(pid, req.user.id, 'admin');
  const statuses = [['Todo', '#6b7280', 0], ['In Progress', '#3b82f6', 1], ['Done', '#22c55e', 2]];
  for (const [name, color, pos] of statuses) {
    db.prepare('INSERT INTO task_statuses (project_id, name, color, position) VALUES (?,?,?,?)').run(pid, name, color, pos);
  }
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  res.status(201).json({ data: row });
});

app.put('/api/projects/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  const { name, description, color } = req.body || {};
  const sets = []; const vals = [];
  if (name) { sets.push('name = ?'); vals.push(name); }
  if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
  if (color) { sets.push('color = ?'); vals.push(color); }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  vals.push(req.params.id);
  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ data: row });
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== TASKS =====
app.get('/api/tasks', requireAuth, (req, res) => {
  const { project_id, status_id, assignee_id, sprint_id, limit = 100 } = req.query;
  let q = 'SELECT t.*, u.display_name AS assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE 1=1';
  const params = [];
  if (project_id) { q += ' AND t.project_id = ?'; params.push(project_id); }
  if (status_id) { q += ' AND t.status_id = ?'; params.push(status_id); }
  if (assignee_id) { q += ' AND t.assignee_id = ?'; params.push(assignee_id); }
  if (sprint_id) { q += ' AND t.sprint_id = ?'; params.push(sprint_id); }
  q += ' ORDER BY t.position LIMIT ?'; params.push(limit);
  const rows = db.prepare(q).all(...params);
  // Attach labels
  const labeled = rows.map(t => {
    const labels = db.prepare('SELECT l.* FROM labels l JOIN task_labels tl ON l.id = tl.label_id WHERE tl.task_id = ?').all(t.id);
    const comments = db.prepare('SELECT COUNT(*) c FROM comments WHERE task_id = ?').get(t.id).c;
    return { ...t, labels, comment_count: comments };
  });
  res.json({ data: labeled });
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const { project_id, title, description, status_id, priority, assignee_id, due_date, sprint_id } = req.body || {};
  if (!project_id || !title) return res.status(400).json({ error: 'Project and title required' });
  const maxPos = db.prepare('SELECT COALESCE(MAX(position),0) + 1 AS p FROM tasks WHERE project_id = ? AND status_id = ?').get(project_id, status_id || null);
  const info = db.prepare(
    'INSERT INTO tasks (project_id, title, description, status_id, priority, assignee_id, creator_id, due_date, position, sprint_id) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(project_id, title, description || null, status_id || null, priority || 'medium', assignee_id || null, req.user.id, due_date || null, maxPos.p, sprint_id || null);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ data: row });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  const { title, description, status_id, priority, assignee_id, due_date, position, sprint_id } = req.body || {};
  const sets = []; const vals = [];
  if (title) { sets.push('title = ?'); vals.push(title); }
  if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
  if (status_id !== undefined) { sets.push('status_id = ?'); vals.push(status_id); }
  if (priority) { sets.push('priority = ?'); vals.push(priority); }
  if (assignee_id !== undefined) { sets.push('assignee_id = ?'); vals.push(assignee_id); }
  if (due_date !== undefined) { sets.push('due_date = ?'); vals.push(due_date); }
  if (position !== undefined) { sets.push('position = ?'); vals.push(position); }
  if (sprint_id !== undefined) { sets.push('sprint_id = ?'); vals.push(sprint_id); }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  sets.push('updated_at = datetime("now")');
  vals.push(req.params.id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json({ data: row });
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== COMMENTS =====
app.get('/api/tasks/:id/comments', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT c.*, u.display_name AS author_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.task_id = ? ORDER BY c.created_at').all(req.params.id);
  res.json({ data: rows });
});

app.post('/api/tasks/:id/comments', requireAuth, (req, res) => {
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Comment body required' });
  const info = db.prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?,?,?)').run(req.params.id, req.user.id, body);
  const row = db.prepare('SELECT c.*, u.display_name AS author_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(info.lastInsertRowid);
  res.status(201).json({ data: row });
});

// ===== LABELS =====
app.get('/api/labels', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT l.* FROM labels l JOIN task_labels tl ON l.id = tl.label_id JOIN tasks t ON tl.task_id = t.id WHERE t.project_id = ?').all(req.query.project_id);
  res.json({ data: rows });
});

app.post('/api/labels', requireAuth, (req, res) => {
  const { name, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const info = db.prepare('INSERT INTO labels (name, color) VALUES (?,?)').run(name, color || '#6b7280');
  const row = db.prepare('SELECT * FROM labels WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ data: row });
});

app.post('/api/tasks/:id/labels', requireAuth, (req, res) => {
  const { label_id } = req.body || {};
  if (!label_id) return res.status(400).json({ error: 'label_id required' });
  db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?,?)').run(req.params.id, label_id);
  res.json({ success: true });
});

app.delete('/api/tasks/:id/labels/:label_id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM task_labels WHERE task_id = ? AND label_id = ?').run(req.params.id, req.params.label_id);
  res.json({ success: true });
});

// ===== SPRINTS =====
app.get('/api/sprints', requireAuth, (req, res) => {
  const { project_id } = req.query;
  let q = 'SELECT s.*, (SELECT COUNT(*) FROM tasks WHERE sprint_id = s.id) AS task_count FROM sprints s';
  const params = [];
  if (project_id) { q += ' WHERE s.project_id = ?'; params.push(project_id); }
  q += ' ORDER BY s.start_date DESC';
  const rows = db.prepare(q).all(...params);
  res.json({ data: rows });
});

app.post('/api/sprints', requireAuth, (req, res) => {
  const { project_id, name, start_date, end_date } = req.body || {};
  if (!project_id || !name || !start_date || !end_date) return res.status(400).json({ error: 'All fields required' });
  const info = db.prepare('INSERT INTO sprints (project_id, name, start_date, end_date) VALUES (?,?,?,?)').run(project_id, name, start_date, end_date);
  const row = db.prepare('SELECT * FROM sprints WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ data: row });
});

// ===== STATUSES =====
app.put('/api/statuses/:id', requireAuth, (req, res) => {
  const { name, color, position } = req.body || {};
  const sets = []; const vals = [];
  if (name) { sets.push('name = ?'); vals.push(name); }
  if (color) { sets.push('color = ?'); vals.push(color); }
  if (position !== undefined) { sets.push('position = ?'); vals.push(position); }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields' });
  vals.push(req.params.id);
  db.prepare(`UPDATE task_statuses SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ success: true });
});

// ===== USERS / MEMBERS =====
app.get('/api/users', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, email, display_name, role FROM users ORDER BY display_name').all();
  res.json({ data: rows });
});

app.post('/api/projects/:id/members', requireAuth, (req, res) => {
  const { user_id, role } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(req.params.id, user_id, role || 'member');
  res.json({ success: true });
});

// ===== DASHBOARD =====
app.get('/api/dashboard', requireAuth, (req, res) => {
  const projects = db.prepare(
    'SELECT p.*, (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count, (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status_id IN (SELECT id FROM task_statuses WHERE project_id = p.id AND name = ?)) AS done_count FROM projects p ORDER BY p.created_at DESC'
  ).all('Done');
  const myTasks = db.prepare('SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.assignee_id = ? AND t.id NOT IN (SELECT task_id FROM task_labels tl JOIN labels l ON tl.label_id = l.id WHERE l.name = ?) ORDER BY t.due_date IS NULL, t.due_date ASC LIMIT 10').all(req.user.id, 'Done');
  res.json({ projects, myTasks });
});

// ===== SEARCH =====
app.get('/api/search', requireAuth, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ data: [] });
  const tasks = db.prepare('SELECT t.*, p.name AS project_name FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.title LIKE ? ORDER BY t.created_at DESC LIMIT 20').all(`%${q}%`);
  const projects = db.prepare('SELECT * FROM projects WHERE name LIKE ? ORDER BY created_at DESC LIMIT 10').all(`%${q}%`);
  res.json({ data: { tasks, projects } });
});

// ===== HEALTH =====
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'PM Dashboard', version: '1.0.0' }));

// ===== STATIC =====
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

const isRunningDirectly = process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('server\\index.js'));
if (isRunningDirectly || process.env.STANDALONE) {
  app.listen(PORT, () => console.log(`PM Dashboard server running on port ${PORT}`));
}

export default app;