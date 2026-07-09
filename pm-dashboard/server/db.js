import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'data', 'pm-dashboard.db');
const db = new DatabaseSync(dbPath);

// ── Pragmas ────────────────────────────────────────────────────────────
db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

// ── Tables ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    slug        TEXT    NOT NULL UNIQUE,
    description TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    display_name  TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'member'
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    description  TEXT,
    color        TEXT    DEFAULT '#6366f1',
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS task_statuses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    color      TEXT    DEFAULT '#6b7280',
    position   INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sprints (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    start_date TEXT,
    end_date   TEXT,
    status     TEXT    NOT NULL DEFAULT 'planned'
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    description TEXT,
    status_id   INTEGER REFERENCES task_statuses(id) ON DELETE SET NULL,
    priority    TEXT    NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    creator_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    due_date    TEXT,
    position    REAL,
    sprint_id   INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    body       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS labels (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL,
    color TEXT    DEFAULT '#6b7280'
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS task_labels (
    task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT    NOT NULL DEFAULT 'member',
    PRIMARY KEY (project_id, user_id)
  )
`);

// ── Indexes ────────────────────────────────────────────────────────────
// projects
db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id)`);

// task_statuses
db.exec(`CREATE INDEX IF NOT EXISTS idx_task_statuses_project_id ON task_statuses(project_id)`);

// tasks
db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id   ON tasks(project_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status_id    ON tasks(status_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id  ON tasks(assignee_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_creator_id   ON tasks(creator_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id    ON tasks(sprint_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date     ON tasks(due_date)`);

// comments
db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)`);

// sprints
db.exec(`CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id)`);

// task_labels
db.exec(`CREATE INDEX IF NOT EXISTS idx_task_labels_label_id ON task_labels(label_id)`);

// project_members
db.exec(`CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id)`);

export default db;
