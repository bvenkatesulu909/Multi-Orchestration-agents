import db from './db.js';
import { hashPassword } from './auth.js';

const adminEmail = 'admin@pm.test';
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
let adminId, devId, wsId, proj1Id, proj2Id;

if (!existing) {
  // Users
  const a = db.prepare('INSERT INTO users (email, display_name, password_hash, role) VALUES (?,?,?,?)').run(adminEmail, 'Admin User', hashPassword('admin123'), 'admin');
  adminId = a.lastInsertRowid;
  const d = db.prepare('INSERT INTO users (email, display_name, password_hash) VALUES (?,?,?)').run('dev@pm.test', 'Dev User', hashPassword('dev123'));
  devId = d.lastInsertRowid;

  // Workspace
  const w = db.prepare('INSERT INTO workspaces (name, slug, description) VALUES (?,?,?)').run('My Workspace', 'my-workspace', 'Main workspace');
  wsId = w.lastInsertRowid;

  // Projects
  const p1 = db.prepare('INSERT INTO projects (workspace_id, name, description, color) VALUES (?,?,?,?)').run(wsId, 'Website Redesign', 'Modernize the company website', '#6366f1');
  proj1Id = p1.lastInsertRowid;
  const p2 = db.prepare('INSERT INTO projects (workspace_id, name, description, color) VALUES (?,?,?,?)').run(wsId, 'Mobile App', 'React Native mobile app', '#22c55e');
  proj2Id = p2.lastInsertRowid;

  // Members
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(proj1Id, adminId, 'admin');
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(proj1Id, devId, 'member');
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?,?,?)').run(proj2Id, adminId, 'admin');

  // Statuses for Project 1
  const s1 = [['Backlog', '#6b7280', 0], ['Todo', '#3b82f6', 1], ['In Progress', '#f59e0b', 2], ['Review', '#8b5cf6', 3], ['Done', '#22c55e', 4]];
  for (const [n, c, p] of s1) db.prepare('INSERT INTO task_statuses (project_id, name, color, position) VALUES (?,?,?,?)').run(proj1Id, n, c, p);

  // Statuses for Project 2
  const s2 = [['Todo', '#3b82f6', 0], ['In Progress', '#f59e0b', 1], ['Done', '#22c55e', 2]];
  for (const [n, c, p] of s2) db.prepare('INSERT INTO task_statuses (project_id, name, color, position) VALUES (?,?,?,?)').run(proj2Id, n, c, p);

  // Labels
  const l1 = db.prepare('INSERT INTO labels (name, color) VALUES (?,?)').run('bug', '#ef4444').lastInsertRowid;
  const l2 = db.prepare('INSERT INTO labels (name, color) VALUES (?,?)').run('feature', '#22c55e').lastInsertRowid;
  const l3 = db.prepare('INSERT INTO labels (name, color) VALUES (?,?)').run('enhancement', '#3b82f6').lastInsertRowid;

  // Tasks for Project 1
  const st1 = db.prepare('SELECT id FROM task_statuses WHERE project_id = ? ORDER BY position').all(proj1Id);
  const t1s = [
    ['Design new homepage layout', 'Create wireframes for the new homepage with hero section, features grid, and CTA', 'high', st1[1].id],
    ['Implement dark mode toggle', 'Add dark mode support with CSS variables and user preference detection', 'medium', st1[2].id],
    ['Fix mobile navigation bug', 'Hamburger menu doesn\'t close on route change in mobile', 'high', st1[0].id],
    ['Set up CI/CD pipeline', 'Configure GitHub Actions for automated deployment', 'medium', st1[3].id],
    ['Write unit tests for API', 'Achieve 80% code coverage on backend routes', 'low', st1[4].id],
    ['Update footer links', 'Replace outdated social media links', 'low', st1[0].id],
  ];
  for (let i = 0; i < t1s.length; i++) {
    const tk = db.prepare('INSERT INTO tasks (project_id, title, description, priority, status_id, creator_id, assignee_id, position) VALUES (?,?,?,?,?,?,?,?)')
      .run(proj1Id, t1s[i][0], t1s[i][1], t1s[i][2], t1s[i][3], adminId, i % 2 === 0 ? adminId : devId, i + 1);
    if (i === 0) db.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?,?)').run(tk.lastInsertRowid, l2);
    if (i === 2) db.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?,?)').run(tk.lastInsertRowid, l1);
  }

  // Tasks for Project 2
  const st2 = db.prepare('SELECT id FROM task_statuses WHERE project_id = ? ORDER BY position').all(proj2Id);
  const t2s = [
    ['Set up React Navigation', 'Configure navigation structure with bottom tabs and stack navigators', 'high', st2[1].id],
    ['Build login screen UI', 'Implement login form with validation and biometric support', 'medium', st2[0].id],
    ['Implement push notifications', 'Integrate Firebase Cloud Messaging for push alerts', 'medium', st2[2].id],
  ];
  for (let i = 0; i < t2s.length; i++) {
    db.prepare('INSERT INTO tasks (project_id, title, description, priority, status_id, creator_id, assignee_id, position) VALUES (?,?,?,?,?,?,?,?)')
      .run(proj2Id, t2s[i][0], t2s[i][1], t2s[i][2], t2s[i][3], adminId, adminId, i + 1);
  }

  // Comments
  const tasks = db.prepare('SELECT id FROM tasks LIMIT 2').all();
  if (tasks.length >= 2) {
    db.prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?,?,?)').run(tasks[0].id, adminId, 'Let me review the wireframes first');
    db.prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?,?,?)').run(tasks[1].id, devId, 'Dark mode is almost ready, just need to test on Safari');
  }

  console.log('Seed complete!');
  console.log('Admin: admin@pm.test / admin123');
  console.log('Dev:   dev@pm.test / dev123');
} else {
  console.log('Already seeded');
}