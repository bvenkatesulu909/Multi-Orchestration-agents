# Project Management Dashboard — Implementation Plan

**Tech Stack:** React 18 + Vite + @dnd-kit + Express + node:sqlite (Node 22+) + JWT + bcryptjs + Zod  
**Scope:** Projects → Tasks → Kanban → List → Auth → Comments → Polish  
**Rule:** Each task = 2–5 minutes of work. Test after every phase.

---

## Directory Structure (Every File, Purpose)

```
pm-dashboard/
├── index.html                    # Vite entry HTML (mount #root)
├── package.json                  # Dependencies + scripts
├── vite.config.js                # Vite + React plugin + proxy to :5000
├── .env                          # JWT_SECRET, PORT=5000
│
├── server/
│   ├── index.js                  # Express entry: app.listen, cors, routes
│   ├── db.js                     # node:sqlite — schema init + helper exports
│   ├── seed.js                   # Demo data: users, projects, tasks, statuses
│   ├── auth.js                   # JWT sign/verify middleware + Zod login schema
│   ├── test-runner.js            # Automated integration tests (all endpoints)
│   │
│   └── routes/
│       ├── projects.js           # CRUD /api/projects
│       ├── tasks.js              # CRUD /api/projects/:id/tasks + reorder
│       ├── statuses.js           # GET /api/projects/:id/statuses
│       ├── comments.js           # CRUD /api/tasks/:id/comments
│       ├── auth-routes.js        # POST /api/auth/register, /api/auth/login
│       └── search.js             # GET /api/search?q=...
│
├── src/
│   ├── main.jsx                  # ReactDOM.createRoot(<App/>)
│   ├── App.jsx                   # Router + auth context + layout shell
│   ├── App.css                   # Global styles (CSS custom properties)
│   │
│   ├── components/
│   │   ├── Layout.jsx            # Sidebar + topbar + Outlet wrapper
│   │   ├── Sidebar.jsx           # Nav links: Projects, Board, List, etc.
│   │   ├── ProtectedRoute.jsx    # Auth gate — redirects to /login
│   │   ├── TaskCard.jsx          # Draggable card for Kanban/Sprint views
│   │   ├── KanbanColumn.jsx      # Droppable column with header + cards
│   │   ├── TaskForm.jsx          # Create/edit task modal (Zod-validated)
│   │   ├── CommentList.jsx       # Threaded comments under a task
│   │   ├── SearchBar.jsx         # Global search input w/ debounce
│   │   └── LoadingSpinner.jsx    # Reusable spinner
│   │
│   ├── views/
│   │   ├── Login.jsx             # Login form → POST /api/auth/login
│   │   ├── Register.jsx          # Register form → POST /api/auth/register
│   │   ├── Dashboard.jsx         # Project list + "New Project" button
│   │   ├── KanbanBoard.jsx       # @dnd-kit DnD context + columns
│   │   ├── ListView.jsx          # Sortable table of tasks (filter/search)
│   │   ├── SprintView.jsx        # Backlog ↔ Sprint columns + move tasks
│   │   ├── GanttView.jsx         # SVG timeline bars (horizontal)
│   │   ├── TaskDetail.jsx        # Single task: details, comments, labels
│   │   └── ProjectSettings.jsx   # Manage members, statuses, labels
│   │
│   ├── hooks/
│   │   ├── useAuth.js            # Auth context consumer hook
│   │   ├── useProjects.js        # Fetch projects, CRUD helpers
│   │   ├── useTasks.js           # Fetch/mutate tasks for a project
│   │   └── useDebounce.js        # Debounce search input
│   │
│   └── utils/
│       ├── api.js                # Fetch wrapper with JWT header injection
│       ├── authContext.jsx        # React context for auth state
│       └── helpers.js            # Date formatting, status colors, etc.
```

---

## Phase 0 — Project Scaffold (1 task, 2 min)

**Task 0.1:** Create missing files: `index.html`, `.env`, `src/main.jsx`, `src/App.jsx`, `src/App.css`
- Verify: `npm install` completes without errors, `npm run dev` starts server + vite

---

## Phase 1 — Database + Auth Backend (5 tasks, ~20 min)

### Task 1.1 — `server/db.js` — Database schema + connection

**Dependencies:** None  
**File:** `server/db.js`

```js
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, 'pm.db');

let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('PRAGMA foreign_keys=ON');
  }
  return db;
}

export function initDb() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#6b7280'
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status_id INTEGER NOT NULL REFERENCES task_statuses(id) ON DELETE CASCADE,
      sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      position REAL NOT NULL,
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6'
    );

    CREATE TABLE IF NOT EXISTS task_labels (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, label_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}
```

**Verify:** `node -e "import('./server/db.js').then(m => m.initDb())"` creates `pm.db` with all 10 tables.

### Task 1.2 — `server/auth.js` — JWT middleware + Zod schemas

**Dependencies:** Task 1.1  
**File:** `server/auth.js`

```js
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(4).max(100),
});

export function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

**Verify:** Import and call `signToken` + `authMiddleware` in a test script.

### Task 1.3 — `server/routes/auth-routes.js` — Register + Login

**Dependencies:** Tasks 1.1, 1.2  
**File:** `server/routes/auth-routes.js`

```js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { loginSchema, registerSchema, signToken } from '../auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, name, password } = parsed.data;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (email, name, password) VALUES (?, ?, ?)').run(email, name, hash);

  // Create a default workspace for the new user
  db.prepare('INSERT INTO workspaces (name, slug) VALUES (?, ?)').run(`${name}'s Workspace`, `ws-${result.lastInsertRowid}`);

  const user = { id: result.lastInsertRowid, email, name, role: 'member' };
  const token = signToken(user);
  res.status(201).json({ user, token });
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(row);
  res.json({ user: { id: row.id, email: row.email, name: row.name, role: row.role }, token });
});

export default router;
```

**Verify:** `curl -X POST localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.com","name":"Test","password":"1234"}'` returns `{user, token}`.

### Task 1.4 — `server/routes/projects.js` + `server/routes/tasks.js` + `server/routes/statuses.js`

**Dependencies:** Tasks 1.1, 1.2  
**Files:** `server/routes/projects.js`, `server/routes/tasks.js`, `server/routes/statuses.js`

**`server/routes/projects.js`:**
```js
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  workspace_id: z.number().int().positive(),
});

router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*, u.name AS owner_name,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS task_count
    FROM projects p JOIN users u ON p.owner_id = u.id
    WHERE p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
    ORDER BY p.created_at DESC
  `).all(req.user.id, req.user.id);
  res.json(projects);
});

router.post('/', (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const db = getDb();
  const { name, description, workspace_id } = parsed.data;
  const result = db.prepare('INSERT INTO projects (name, description, workspace_id, owner_id) VALUES (?, ?, ?, ?)').run(name, description, workspace_id, req.user.id);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  // Create default statuses for the new project
  const defaults = [
    { name: 'Backlog', color: '#6b7280', pos: 0 },
    { name: 'To Do', color: '#3b82f6', pos: 1 },
    { name: 'In Progress', color: '#f59e0b', pos: 2 },
    { name: 'Done', color: '#10b981', pos: 3 },
  ];
  const stmt = db.prepare('INSERT INTO task_statuses (project_id, name, position, color) VALUES (?, ?, ?, ?)');
  for (const s of defaults) stmt.run(project.id, s.name, s.pos, s.color);
  res.status(201).json(project);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json(project);
});

router.put('/:id', (req, res) => {
  const parsed = projectSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const db = getDb();
  const { name, description } = parsed.data;
  db.prepare('UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?').run(name, description, req.params.id);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
```

**`server/routes/tasks.js`:**
```js
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

const taskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).default(''),
  status_id: z.number().int().positive(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignee_id: z.number().int().positive().nullable().default(null),
  sprint_id: z.number().int().positive().nullable().default(null),
  due_date: z.string().nullable().default(null),
  position: z.number().optional(),
});

router.get('/', (req, res) => {
  const db = getDb();
  const tasks = db.prepare(`
    SELECT t.*, u.name AS assignee_name
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.project_id = ?
    ORDER BY t.position ASC
  `).all(req.params.id);
  res.json(tasks);
});

router.post('/', (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const db = getDb();
  const { title, description, status_id, priority, assignee_id, sprint_id, due_date } = parsed.data;
  // Get max position for this status
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM tasks WHERE status_id = ?').get(status_id);
  const position = parsed.data.position ?? maxPos.next;
  const result = db.prepare(`
    INSERT INTO tasks (project_id, status_id, sprint_id, title, description, priority, assignee_id, position, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, status_id, sprint_id, title, description, priority, assignee_id, position, due_date);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

router.put('/:taskId', (req, res) => {
  const parsed = taskSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const db = getDb();
  const fields = ['title', 'description', 'status_id', 'priority', 'assignee_id', 'sprint_id', 'position', 'due_date'];
  const sets = fields.filter(f => req.body[f] !== undefined).map(f => `${f} = ?`).join(', ');
  const vals = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
  if (!sets) return res.status(400).json({ error: 'No fields to update' });
  vals.push(req.params.taskId);
  db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...vals);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
  res.json(task);
});

router.delete('/:taskId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
  res.json({ ok: true });
});

export default router;
```

**`server/routes/statuses.js`:**
```js
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = getDb();
  const statuses = db.prepare('SELECT * FROM task_statuses WHERE project_id = ? ORDER BY position ASC').all(req.params.id);
  res.json(statuses);
});

const statusSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().default('#6b7280'),
  position: z.number().int().optional(),
});

router.post('/', (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const db = getDb();
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM task_statuses WHERE project_id = ?').get(req.params.id);
  const result = db.prepare('INSERT INTO task_statuses (project_id, name, position, color) VALUES (?, ?, ?, ?)').run(req.params.id, parsed.data.name, parsed.data.position ?? maxPos.next, parsed.data.color);
  res.status(201).json({ id: result.lastInsertRowid, ...parsed.data });
});

router.put('/:statusId', (req, res) => {
  const parsed = statusSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const db = getDb();
  db.prepare('UPDATE task_statuses SET name = COALESCE(?, name), color = COALESCE(?, color), position = COALESCE(?, position) WHERE id = ?').run(parsed.data.name, parsed.data.color, parsed.data.position, req.params.statusId);
  res.json({ ok: true });
});

router.delete('/:statusId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM task_statuses WHERE id = ?').run(req.params.statusId);
  res.json({ ok: true });
});

export default router;
```

**Verify:** `node server/test-runner.js` (full test suite) or individual curl calls.

### Task 1.5 — `server/index.js` — Main server entry point

**Dependencies:** Tasks 1.1–1.4  
**File:** `server/index.js`

```js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import authRoutes from './routes/auth-routes.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import statusRoutes from './routes/statuses.js';
import commentRoutes from './routes/comments.js';
import searchRoutes from './routes/search.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize database
initDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:id/tasks', taskRoutes);
app.use('/api/projects/:id/statuses', statusRoutes);
app.use('/api/tasks/:id/comments', commentRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Verify:** `node server/index.js` → server starts on port 5000, `curl localhost:5000/api/health` returns `{"status":"ok"}`.

---

## Phase 2 — Seed Data (1 task, 3 min)

### Task 2.1 — `server/seed.js`

**Dependencies:** Phase 1 completed  
**File:** `server/seed.js`

```js
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initDb, getDb } from './db.js';

initDb();
const db = getDb();

// Clear existing data
db.exec('DELETE FROM comments; DELETE FROM task_labels; DELETE FROM tasks; DELETE FROM sprints; DELETE FROM task_statuses; DELETE FROM project_members; DELETE FROM projects; DELETE FROM workspaces; DELETE FROM users;');

// Create users
const hash = bcrypt.hashSync('password', 10);
db.prepare("INSERT INTO users (id, email, name, password, role) VALUES (1, 'alice@test.com', 'Alice', ?, 'admin')").run(hash);
db.prepare("INSERT INTO users (id, email, name, password, role) VALUES (2, 'bob@test.com', 'Bob', ?, 'member')").run(hash);

// Create workspace
db.prepare("INSERT INTO workspaces (id, name, slug) VALUES (1, 'Demo Workspace', 'demo-ws')").run();

// Create project
db.prepare("INSERT INTO projects (id, name, description, workspace_id, owner_id) VALUES (1, 'Q3 Product Launch', 'Main product launch for Q3', 1, 1)").run();
db.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (1, 1, 'admin'), (1, 2, 'member')").run();

// Create statuses (Backlog, To Do, In Progress, Done)
db.prepare("INSERT INTO task_statuses (id, project_id, name, position, color) VALUES (1, 1, 'Backlog', 0, '#6b7280')").run();
db.prepare("INSERT INTO task_statuses (id, project_id, name, position, color) VALUES (2, 1, 'To Do', 1, '#3b82f6')").run();
db.prepare("INSERT INTO task_statuses (id, project_id, name, position, color) VALUES (3, 1, 'In Progress', 2, '#f59e0b')").run();
db.prepare("INSERT INTO task_statuses (id, project_id, name, position, color) VALUES (4, 1, 'Done', 3, '#10b981')").run();

// Create tasks
db.prepare("INSERT INTO tasks (id, project_id, status_id, title, description, priority, assignee_id, position, due_date) VALUES (1, 1, 2, 'Design landing page', 'Create Figma mockups for the new landing page', 'high', 1, 1.0, '2025-08-15')").run();
db.prepare("INSERT INTO tasks (id, project_id, status_id, title, description, priority, assignee_id, position, due_date) VALUES (2, 1, 2, 'Set up CI/CD pipeline', 'Configure GitHub Actions for automated deployments', 'medium', 2, 2.0, '2025-08-20')").run();
db.prepare("INSERT INTO tasks (id, project_id, status_id, title, description, priority, assignee_id, position, due_date) VALUES (3, 1, 3, 'Implement user auth', 'Add JWT-based authentication with register/login endpoints', 'urgent', 1, 1.0, '2025-08-10')").run();
db.prepare("INSERT INTO tasks (id, project_id, status_id, title, description, priority, assignee_id, position, due_date) VALUES (4, 1, 3, 'Write API docs', 'Document all REST endpoints with examples', 'low', 2, 2.0, '2025-08-25')").run();
db.prepare("INSERT INTO tasks (id, project_id, status_id, title, description, priority, assignee_id, position, due_date) VALUES (5, 1, 4, 'Set up project repo', 'Initialize the monorepo with all config files', 'medium', 1, 1.0, '2025-08-01')").run();
db.prepare("INSERT INTO tasks (id, project_id, status_id, title, description, priority, assignee_id, position, due_date) VALUES (6, 1, 1, 'Add dark mode', 'Implement dark/light theme toggle', 'low', null, 1.0, null)").run();
db.prepare("INSERT INTO tasks (id, project_id, status_id, title, description, priority, assignee_id, position, due_date) VALUES (7, 1, 1, 'Performance audit', 'Run Lighthouse audit and optimize', 'medium', null, 2.0, null)").run();

// Create sprint
db.prepare("INSERT INTO sprints (id, project_id, name, start_date, end_date, is_active) VALUES (1, 1, 'Sprint 1', '2025-08-01', '2025-08-14', 1)").run();

// Create labels
db.prepare("INSERT INTO labels (id, project_id, name, color) VALUES (1, 1, 'bug', '#ef4444'), (2, 1, 'feature', '#3b82f6'), (3, 1, 'design', '#8b5cf6')").run();

// Link labels
db.prepare("INSERT INTO task_labels (task_id, label_id) VALUES (1, 2), (1, 3), (3, 2), (5, 2)").run();

// Add comments
db.prepare("INSERT INTO comments (task_id, user_id, body) VALUES (3, 2, 'Should we use bcrypt or argon2?')").run();
db.prepare("INSERT INTO comments (task_id, user_id, body) VALUES (3, 1, 'bcrypt is fine for MVP, we can upgrade later')").run();

console.log('✅ Seed data inserted successfully!');
```

**Verify:** `npm run seed` outputs "✅ Seed data inserted", then `node -e "import('./server/db.js').then(m => console.log(m.getDb().prepare('SELECT COUNT(*) FROM tasks').get()))"` shows 7 tasks.

---

## Phase 3 — React Frontend (8 tasks, ~30 min)

### Task 3.1 — `src/utils/api.js` + `src/utils/authContext.jsx` + `src/utils/helpers.js`

**Dependencies:** Phase 1  
**File:** `src/utils/api.js`

```js
const API_BASE = '/api';

export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const auth = {
  login: (body) => api('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => api('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me: () => api('/auth/me'),
};

export const projectsApi = {
  list: () => api('/projects'),
  get: (id) => api(`/projects/${id}`),
  create: (body) => api('/projects', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => api(`/projects/${id}`, { method: 'DELETE' }),
};

export const tasksApi = {
  list: (projectId) => api(`/projects/${projectId}/tasks`),
  create: (projectId, body) => api(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(body) }),
  update: (projectId, taskId, body) => api(`/projects/${projectId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (projectId, taskId) => api(`/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
};

export const statusesApi = {
  list: (projectId) => api(`/projects/${projectId}/statuses`),
};

export const commentsApi = {
  list: (taskId) => api(`/tasks/${taskId}/comments`),
  create: (taskId, body) => api(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify(body) }),
};

export const searchApi = {
  search: (q) => api(`/search?q=${encodeURIComponent(q)}`),
};
```

**File:** `src/utils/authContext.jsx`
```jsx
import { createContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('user');
    if (token && saved) {
      setUser(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const login = useCallback((userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**File:** `src/utils/helpers.js`
```js
export const priorityColors = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#6b7280',
};

export const statusColors = {
  Backlog: '#6b7280',
  'To Do': '#3b82f6',
  'In Progress': '#f59e0b',
  Done: '#10b981',
};

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
```

### Task 3.2 — `src/main.jsx` + `src/App.jsx` + `src/App.css`

**Dependencies:** Task 3.1  
**File:** `src/main.jsx`

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './utils/authContext';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

**File:** `src/App.jsx`
```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './utils/authContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './views/Login';
import Register from './views/Register';
import Dashboard from './views/Dashboard';
import KanbanBoard from './views/KanbanBoard';
import ListView from './views/ListView';
import TaskDetail from './views/TaskDetail';

export default function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div className="loading-screen">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="project/:projectId/board" element={<KanbanBoard />} />
        <Route path="project/:projectId/list" element={<ListView />} />
        <Route path="project/:projectId/task/:taskId" element={<TaskDetail />} />
      </Route>
    </Routes>
  );
}
```

**File:** `src/App.css`
```css
:root {
  --bg: #0f172a;
  --bg-card: #1e293b;
  --bg-sidebar: #0f172a;
  --text: #f1f5f9;
  --text-muted: #94a3b8;
  --border: #334155;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --danger: #ef4444;
  --success: #10b981;
  --warning: #f59e0b;
  --radius: 8px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--text); }

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

button {
  cursor: pointer; border: none; border-radius: var(--radius);
  padding: 8px 16px; font-size: 14px; font-weight: 500;
  background: var(--accent); color: white; transition: opacity 0.15s;
}
button:hover { opacity: 0.85; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.danger { background: var(--danger); }
button.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }

input, textarea, select {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 8px 12px;
  color: var(--text); font-size: 14px; width: 100%;
}
input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

.card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px;
}

.loading-screen {
  display: flex; align-items: center; justify-content: center;
  height: 100vh; font-size: 18px; color: var(--text-muted);
}

.flex { display: flex; }
.flex-col { flex-direction: column; }
.gap-2 { gap: 8px; }
.gap-4 { gap: 16px; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.text-muted { color: var(--text-muted); }
.text-sm { font-size: 13px; }
.font-bold { font-weight: 700; }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }
.mb-4 { margin-bottom: 16px; }
.p-4 { padding: 16px; }
```

### Task 3.3 — `src/components/Layout.jsx` + `Sidebar.jsx` + `ProtectedRoute.jsx`

**Dependencies:** Task 3.2  
**File:** `src/components/Layout.jsx`
```jsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import SearchBar from './SearchBar';

export default function Layout() {
  return (
    <div className="flex" style={{ height: '100vh' }}>
      <Sidebar />
      <div className="flex-col" style={{ flex: 1, overflow: 'auto' }}>
        <header className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <SearchBar />
        </header>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**File:** `src/components/Sidebar.jsx`
```jsx
import { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../utils/authContext';

export default function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside style={{
      width: 240, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)',
      padding: '16px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>PM Dashboard</h2>
      <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>Projects</NavLink>
      <div style={{ flex: 1 }} />
      <div className="text-sm text-muted">{user?.name}</div>
      <div className="text-sm text-muted">{user?.email}</div>
      <button className="ghost" onClick={handleLogout} style={{ marginTop: 8 }}>Logout</button>
    </aside>
  );
}

function linkStyle(isActive) {
  return {
    display: 'block', padding: '8px 12px', borderRadius: 'var(--radius)',
    background: isActive ? 'var(--bg-card)' : 'transparent',
    color: 'var(--text)', fontWeight: isActive ? 600 : 400,
    textDecoration: 'none', fontSize: 14,
  };
}
```

**File:** `src/components/ProtectedRoute.jsx`
```jsx
import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../utils/authContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}
```

### Task 3.4 — `src/views/Login.jsx` + `Register.jsx`

**Dependencies:** Task 3.1, 3.2  
**File:** `src/views/Login.jsx`
```jsx
import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../utils/authContext';
import { auth } from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await auth.login({ email, password });
      login(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center" style={{ height: '100vh', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 360, padding: 32 }}>
        <h1 style={{ marginBottom: 24 }}>Login</h1>
        {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <div className="flex-col gap-2 mb-4">
          <label className="text-sm">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="flex-col gap-2 mb-4">
          <label className="text-sm">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit" style={{ width: '100%' }}>Login</button>
        <p className="text-sm text-muted mt-4" style={{ textAlign: 'center' }}>
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
```

**File:** `src/views/Register.jsx` (mirror pattern, adds `name` field)

### Task 3.5 — `src/views/Dashboard.jsx` — Project list

**Dependencies:** Task 3.1, 3.2  
**File:** `src/views/Dashboard.jsx`

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../utils/api';
import { formatDate } from '../utils/helpers';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(console.error);
  }, []);

  const createProject = async (e) => {
    e.preventDefault();
    const p = await projectsApi.create({ name, description: desc, workspace_id: 1 });
    setProjects(prev => [p, ...prev]);
    setShowForm(false);
    setName('');
    setDesc('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 style={{ fontSize: 24 }}>Projects</h1>
        <button onClick={() => setShowForm(true)}>+ New Project</button>
      </div>

      {showForm && (
        <form onSubmit={createProject} className="card mb-4" style={{ padding: 20 }}>
          <div className="flex-col gap-2 mb-4">
            <label className="text-sm">Project Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="flex-col gap-2 mb-4">
            <label className="text-sm">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <button type="submit">Create</button>
            <button type="button" className="ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {projects.length === 0 && <p className="text-muted">No projects yet. Create one to get started.</p>}

      <div className="flex-col gap-2">
        {projects.map(p => (
          <div key={p.id} className="card flex items-center justify-between"
               onClick={() => navigate(`/project/${p.id}/board`)}
               style={{ cursor: 'pointer' }}>
            <div>
              <div className="font-bold">{p.name}</div>
              <div className="text-sm text-muted">{p.description || 'No description'}</div>
            </div>
            <div className="text-sm text-muted" style={{ textAlign: 'right' }}>
              <div>{p.task_count} tasks</div>
              <div>{formatDate(p.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Task 3.6 — `src/views/KanbanBoard.jsx` — Drag-and-drop board

**Dependencies:** Tasks 3.1, 3.3, 3.5  
**Install:** `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`  
**Note:** `react-beautiful-dnd` is deprecated; `@dnd-kit` is the modern replacement.

**File:** `src/views/KanbanBoard.jsx`
```jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DndContext, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { tasksApi, statusesApi } from '../utils/api';
import KanbanColumn from '../components/KanbanColumn';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';

export default function KanbanBoard() {
  const { projectId } = useParams();
  const [statuses, setStatuses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    statusesApi.list(projectId).then(setStatuses);
    tasksApi.list(projectId).then(setTasks);
  }, [projectId]);

  const getTasksByStatus = (statusId) =>
    tasks.filter(t => t.status_id === statusId).sort((a, b) => a.position - b.position);

  const handleDragStart = (event) => {
    const task = tasks.find(t => t.id === Number(event.active.id));
    setActiveTask(task);
  };

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = Number(active.id);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let newStatusId;
    // If dropped on a column (status), use that status
    const overStatus = statuses.find(s => s.id === Number(over.id));
    if (overStatus) {
      newStatusId = overStatus.id;
    } else {
      // Dropped on a task — find its status
      const overTask = tasks.find(t => t.id === Number(over.id));
      if (!overTask) return;
      newStatusId = overTask.status_id;
    }

    if (newStatusId === task.status_id && taskId === Number(over.id)) return;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status_id: newStatusId } : t
    ));

    try {
      await tasksApi.update(projectId, taskId, { status_id: newStatusId });
      const updated = await tasksApi.list(projectId);
      setTasks(updated);
    } catch (err) {
      console.error('Drag update failed:', err);
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status_id: task.status_id } : t
      ));
    }
    setActiveTask(null);
  }, [tasks, statuses, projectId]);

  const handleTaskCreated = (task) => {
    setTasks(prev => [...prev, task]);
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 style={{ fontSize: 24 }}>Kanban Board</h1>
        <button onClick={() => setShowForm(true)}>+ Add Task</button>
      </div>

      {showForm && (
        <TaskForm
          projectId={projectId}
          statuses={statuses}
          onSuccess={handleTaskCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners}
                  onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4" style={{ overflowX: 'auto', minHeight: '60vh', paddingBottom: 16 }}>
          {statuses.map(status => (
            <KanbanColumn key={status.id} status={status}>
              <SortableContext items={getTasksByStatus(status.id).map(t => String(t.id))}
                               strategy={verticalListSortingStrategy}>
                <div className="flex-col gap-2">
                  {getTasksByStatus(status.id).map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </SortableContext>
            </KanbanColumn>
          ))}
        </div>
      </DndContext>
    </div>
  );
}
```

### Task 3.7 — `src/components/KanbanColumn.jsx` + `TaskCard.jsx` + `TaskForm.jsx`

**Dependencies:** Task 3.6  
**File:** `src/components/KanbanColumn.jsx`
```jsx
import { useDroppable } from '@dnd-kit/core';

export default function KanbanColumn({ status, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: String(status.id) });

  return (
    <div ref={setNodeRef} style={{
      minWidth: 280, maxWidth: 320, flex: 1,
      background: 'var(--bg-card)', borderRadius: 'var(--radius)',
      border: isOver ? '2px solid var(--accent)' : '1px solid var(--border)',
      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div className="flex items-center gap-2" style={{ paddingBottom: 8, borderBottom: `3px solid ${status.color}` }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: status.color }} />
        <span className="font-bold">{status.name}</span>
      </div>
      {children}
    </div>
  );
}
```

**File:** `src/components/TaskCard.jsx`
```jsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { priorityColors, formatDate } from '../utils/helpers';

export default function TaskCard({ task }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
         className="card"
         onClick={() => navigate(`/project/${projectId}/task/${task.id}`)}
         onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: priorityColors[task.priority] || '#6b7280',
          display: 'inline-block',
        }} />
        <span className="text-sm font-bold">{task.title}</span>
      </div>
      {task.assignee_name && (
        <div className="text-sm text-muted">{task.assignee_name}</div>
      )}
      {task.due_date && (
        <div className="text-sm text-muted">Due: {formatDate(task.due_date)}</div>
      )}
    </div>
  );
}
```

**File:** `src/components/TaskForm.jsx`
```jsx
import { useState } from 'react';
import { tasksApi } from '../utils/api';

export default function TaskForm({ projectId, statuses, onSuccess, onCancel, task }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [statusId, setStatusId] = useState(task?.status_id || statuses[0]?.id || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.due_date || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const body = { title, description, status_id: Number(statusId), priority, due_date: dueDate || null };
      if (task) {
        const updated = await tasksApi.update(projectId, task.id, body);
        onSuccess(updated);
      } else {
        const created = await tasksApi.create(projectId, body);
        onSuccess(created);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card mb-4" style={{ padding: 20 }}>
      {error && <div style={{ color: 'var(--danger)', marginBottom: 8, fontSize: 13 }}>{error}</div>}
      <div className="flex-col gap-2 mb-4">
        <label className="text-sm">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required />
      </div>
      <div className="flex-col gap-2 mb-4">
        <label className="text-sm">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="mb-4">
        <div className="flex-col gap-2">
          <label className="text-sm">Status</label>
          <select value={statusId} onChange={e => setStatusId(e.target.value)}>
            {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex-col gap-2">
          <label className="text-sm">Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)}>
            {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="flex-col gap-2 mb-4">
        <label className="text-sm">Due Date</label>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="submit">{task ? 'Update' : 'Create'} Task</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

### Task 3.8 — `src/views/ListView.jsx` + `src/views/TaskDetail.jsx` + `src/components/CommentList.jsx` + `SearchBar.jsx`

**Dependencies:** Tasks 3.1, 3.3, 3.6  
**File:** `src/views/ListView.jsx`
```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tasksApi, statusesApi } from '../utils/api';
import { priorityColors, formatDate, cn } from '../utils/helpers';

export default function ListView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    tasksApi.list(projectId).then(setTasks);
    statusesApi.list(projectId).then(setStatuses);
  }, [projectId]);

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status_id === Number(filter));
  const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 style={{ fontSize: 24 }}>List View</h1>
        <select value={filter} onChange={e => setFilter(e.target.value)}
                style={{ width: 200 }}>
          <option value="all">All Statuses</option>
          {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Title</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Priority</th>
              <th style={{ padding: '12px 16px' }}>Assignee</th>
              <th style={{ padding: '12px 16px' }}>Due</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(task => (
              <tr key={task.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => navigate(`/project/${projectId}/task/${task.id}`)}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{task.title}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: statusMap[task.status_id]?.color || '#6b7280',
                    color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12,
                  }}>
                    {statusMap[task.status_id]?.name || 'Unknown'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ color: priorityColors[task.priority] }}>{task.priority}</span>
                </td>
                <td style={{ padding: '12px 16px' }} className="text-muted">{task.assignee_name || '—'}</td>
                <td style={{ padding: '12px 16px' }} className="text-muted">{formatDate(task.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-muted p-4">No tasks found.</p>}
      </div>
    </div>
  );
}
```

**File:** `src/views/TaskDetail.jsx`
```jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tasksApi, commentsApi } from '../utils/api';
import CommentList from '../components/CommentList';
import { priorityColors, formatDate } from '../utils/helpers';

export default function TaskDetail() {
  const { projectId, taskId } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tasksApi.list(projectId).then(tasks => {
      const found = tasks.find(t => t.id === Number(taskId));
      setTask(found);
      setLoading(false);
    });
  }, [projectId, taskId]);

  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!task) return <div className="loading-screen">Task not found</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <Link to={`/project/${projectId}/board`} className="text-sm text-muted" style={{ marginBottom: 16, display: 'block' }}>
        ← Back to Board
      </Link>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>{task.title}</h1>
        <div className="flex gap-2 mb-4">
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: priorityColors[task.priority] || '#6b7280',
            display: 'inline-block', alignSelf: 'center',
          }} />
          <span style={{ textTransform: 'capitalize' }}>{task.priority}</span>
          {task.assignee_name && <span className="text-muted">· {task.assignee_name}</span>}
          {task.due_date && <span className="text-muted">· Due {formatDate(task.due_date)}</span>}
        </div>
        <p className="text-muted" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {task.description || 'No description'}
        </p>
      </div>

      <CommentList taskId={taskId} />
    </div>
  );
}
```

**File:** `src/components/CommentList.jsx`
```jsx
import { useState, useEffect } from 'react';
import { commentsApi } from '../utils/api';
import { formatDate } from '../utils/helpers';

export default function CommentList({ taskId }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    commentsApi.list(taskId).then(setComments).catch(console.error);
  }, [taskId]);

  const addComment = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setError('');
    try {
      const comment = await commentsApi.create(taskId, { body });
      setComments(prev => [...prev, comment]);
      setBody('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ marginBottom: 16 }}>Comments ({comments.length})</h3>

      {comments.map(c => (
        <div key={c.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
            <span className="font-bold text-sm">{c.user_name || 'User'}</span>
            <span className="text-sm text-muted">{formatDate(c.created_at)}</span>
          </div>
          <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{c.body}</p>
        </div>
      ))}

      {comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}

      <form onSubmit={addComment} style={{ marginTop: 16 }}>
        {error && <div style={{ color: 'var(--danger)', marginBottom: 8, fontSize: 13 }}>{error}</div>}
        <textarea value={body} onChange={e => setBody(e.target.value)}
                  placeholder="Write a comment..." rows={2}
                  style={{ marginBottom: 8 }} />
        <button type="submit" disabled={!body.trim()}>Add Comment</button>
      </form>
    </div>
  );
}
```

**File:** `src/components/SearchBar.jsx`
```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../utils/api';
import { useDebounce } from '../hooks/useDebounce';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const debounced = useDebounce(query, 300);

  const handleSearch = async (val) => {
    setQuery(val);
    if (val.length < 2) { setResults([]); return; }
    try {
      const data = await searchApi.search(val);
      setResults(data);
      setShow(true);
    } catch { setResults([]); }
  };

  const selectTask = (task) => {
    setShow(false);
    setQuery('');
    navigate(`/project/${task.project_id}/task/${task.id}`);
  };

  return (
    <div style={{ position: 'relative', width: 300 }}>
      <input
        type="search"
        placeholder="Search tasks..."
        value={query}
        onChange={e => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 200)}
      />
      {show && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', zIndex: 100, marginTop: 4,
          maxHeight: 300, overflow: 'auto',
        }}>
          {results.map(t => (
            <div key={t.id} onMouseDown={() => selectTask(t)}
                 style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
              <div>{t.title}</div>
              <div className="text-muted text-sm">{t.project_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Phase 4 — Comments Route + Search Route (1 task, 3 min)

### Task 4.1 — `server/routes/comments.js` + `server/routes/search.js`

**Dependencies:** Phase 1  
**File:** `server/routes/comments.js`
```js
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router({ mergeParams: true });
router.use(authMiddleware);

const commentSchema = z.object({ body: z.string().min(1).max(5000) });

router.get('/', (req, res) => {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.name AS user_name FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

router.post('/', (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const db = getDb();
  const result = db.prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)').run(req.params.id, req.user.id, parsed.data.body);
  const comment = db.prepare(`
    SELECT c.*, u.name AS user_name FROM comments c
    JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(comment);
});

export default router;
```

**File:** `server/routes/search.js`
```js
import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) return res.json([]);
  const db = getDb();
  const like = `%${q}%`;
  const tasks = db.prepare(`
    SELECT t.id, t.title, t.project_id, p.name AS project_name
    FROM tasks t JOIN projects p ON t.project_id = p.id
    WHERE t.title LIKE ? AND (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
    LIMIT 20
  `).all(like, req.user.id, req.user.id);
  res.json(tasks);
});

export default router;
```

---

## Phase 5 — Integration Test Suite (1 task, 5 min)

### Task 5.1 — `server/test-runner.js`

**Dependencies:** Phase 1–4  
**File:** `server/test-runner.js`

```js
import 'dotenv/config';
import { initDb, getDb } from './db.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}

// Init DB
initDb();
const db = getDb();

// 1. Tables exist
console.log('\n📦 Schema Tests');
const tables = ['users', 'workspaces', 'projects', 'project_members', 'task_statuses', 'tasks', 'sprints', 'labels', 'task_labels', 'comments'];
for (const t of tables) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
  assert(!!row, `Table '${t}' exists`);
}

// 2. Insert user
console.log('\n👤 User Tests');
import bcrypt from 'bcryptjs';
const hash = bcrypt.hashSync('test1234', 10);
db.prepare("INSERT OR IGNORE INTO users (id, email, name, password, role) VALUES (999, 'test@test.com', 'Tester', ?, 'member')").run(hash);
const user = db.prepare("SELECT * FROM users WHERE id = 999").get();
assert(!!user, 'User inserted');
assert(bcrypt.compareSync('test1234', user.password), 'Password hashing works');

// 3. Insert workspace + project
console.log('\n📁 Project Tests');
db.prepare("INSERT OR IGNORE INTO workspaces (id, name, slug) VALUES (999, 'Test WS', 'test-ws')").run();
db.prepare("INSERT OR IGNORE INTO projects (id, name, workspace_id, owner_id) VALUES (999, 'Test Project', 999, 999)").run();
const project = db.prepare("SELECT * FROM projects WHERE id = 999").get();
assert(!!project, 'Project created');

// 4. Insert statuses + tasks
console.log('\n📋 Task Tests');
db.prepare("INSERT OR IGNORE INTO task_statuses (id, project_id, name, position, color) VALUES (999, 999, 'Test Status', 0, '#ff0000')").run();
db.prepare("INSERT INTO tasks (project_id, status_id, title, position) VALUES (999, 999, 'Test Task', 1.0)").run();
const task = db.prepare("SELECT * FROM tasks WHERE project_id = 999").get();
assert(!!task, 'Task created');
assert(task.title === 'Test Task', 'Task title matches');

// 5. Insert comment
console.log('\n💬 Comment Tests');
db.prepare("INSERT INTO comments (task_id, user_id, body) VALUES (?, 999, 'Test comment')").run(task.id);
const comment = db.prepare("SELECT * FROM comments WHERE task_id = ?").get(task.id);
assert(!!comment, 'Comment created');
assert(comment.body === 'Test comment', 'Comment body matches');

// 6. Labels
console.log('\n🏷️ Label Tests');
db.prepare("INSERT OR IGNORE INTO labels (id, project_id, name, color) VALUES (999, 999, 'bug', '#ef4444')").run();
db.prepare("INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, 999)").run(task.id);
const label = db.prepare("SELECT l.* FROM labels l JOIN task_labels tl ON l.id = tl.label_id WHERE tl.task_id = ?").get(task.id);
assert(!!label, 'Label linked to task');

// 7. Cascade delete
console.log('\n🗑️ Cascade Tests');
db.prepare("DELETE FROM projects WHERE id = 999").run();
const orphan = db.prepare("SELECT * FROM tasks WHERE project_id = 999").get();
assert(!orphan, 'Tasks cascade on project delete');

// Cleanup test user
db.prepare("DELETE FROM users WHERE id = 999").run();

console.log(`\n${'='.repeat(30)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(30)}`);
process.exit(failed > 0 ? 1 : 0);
```

**Verify:** `npm test` outputs all ✅ and "12 passed, 0 failed" (or similar count).

---

## Dependency Graph (Build Order)

```
Phase 0: Scaffold
    └─ Task 0.1: index.html, main.jsx, App.jsx, App.css
Phase 1: Backend Core
    ├─ Task 1.1: server/db.js (schema)
    ├─ Task 1.2: server/auth.js (JWT + Zod)
    ├─ Task 1.3: server/routes/auth-routes.js
    ├─ Task 1.4: server/routes/projects.js + tasks.js + statuses.js
    └─ Task 1.5: server/index.js (wires everything)
Phase 2: Seed Data
    └─ Task 2.1: server/seed.js
Phase 3: React Frontend (parallelizable)
    ├─ Task 3.1: api.js + authContext.jsx + helpers.js
    ├─ Task 3.2: main.jsx + App.jsx + App.css
    ├─ Task 3.3: Layout.jsx + Sidebar.jsx + ProtectedRoute.jsx
    ├─ Task 3.4: Login.jsx + Register.jsx
    ├─ Task 3.5: Dashboard.jsx (project list)
    ├─ Task 3.6: KanbanBoard.jsx (drag-and-drop)
    ├─ Task 3.7: KanbanColumn.jsx + TaskCard.jsx + TaskForm.jsx
    └─ Task 3.8: ListView.jsx + TaskDetail.jsx + CommentList.jsx + SearchBar.jsx
Phase 4: Additional Routes
    └─ Task 4.1: comments.js + search.js (server routes)
Phase 5: Integration Tests
    └─ Task 5.1: server/test-runner.js
```

---

## Testing Verification Steps (Build-Phase Checklist)

| Phase | Verification |
|-------|--------------|
| 0 | `npm install` succeeds; `npm run dev` starts both servers |
| 1.1 | `node -e "import('./server/db.js').then(m => m.initDb())"` creates `pm.db` with 10 tables |
| 1.2 | Import auth module; sign + verify a token in Node REPL |
| 1.3 | `curl -X POST localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.com","name":"Test","password":"1234"}'` returns `{user, token}` |
| 1.4 | `curl -H "Authorization: Bearer <token>" localhost:5000/api/projects` returns `[]` or projects |
| 1.5 | `curl localhost:5000/api/health` returns `{"status":"ok"}` |
| 2 | `npm run seed` outputs ✅; verify 7 tasks in DB |
| 3.2 | Browser shows dark login page at `localhost:5173` |
| 3.4 | Register new user, login, redirects to `/` |
| 3.5 | Dashboard shows project list, create button works |
| 3.6 | Kanban board renders 4 columns with tasks, drag-and-drop works |
| 3.7 | Task cards display priority dot, title, assignee; form creates tasks |
| 3.8 | List view shows table; task detail shows comments; search works |
| 4 | Comments POST/GET return correct data; search returns matching tasks |
| 5 | `npm test` exits 0 with all tests passing |

---

## Post-MVP Polish (Future Phases)

| Feature | Effort | Notes |
|---------|--------|-------|
| Sprint View (backlog ↔ sprint) | 2 tasks | Dual-column DnD, filter by sprint_id |
| Gantt/Timeline (SVG bars) | 3 tasks | Custom SVG, date calculations, zoom |
| Labels UI | 1 task | Color badges on cards, filter by label |
| Roles/Permissions | 2 tasks | Admin/Editor/Viewer, route-level checks |
| Notifications | 2 tasks | SSE or polling endpoint, bell icon |
| Dark/Light theme toggle | 1 task | CSS custom properties swap |
| Project settings | 1 task | Manage members, statuses, labels |
| Pagination | 1 task | Server-side offset/limit on tasks |
| Rich text descriptions | 1 task | Markdown render in task detail |

---

## Quick Start (for Developers)

```bash
cd pm-dashboard
npm install
npm run seed      # Populate demo data
npm run dev       # Starts server:5000 + vite:5173
npm test          # Run integration tests
```

**Login:** `alice@test.com` / `password` (or register a new account)