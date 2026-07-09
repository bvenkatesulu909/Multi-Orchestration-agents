import React, { useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken, clearToken } from './api.js';
import Auth from './components/Auth.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './views/Dashboard.jsx';
import Projects from './views/Projects.jsx';
import Board from './views/Board.jsx';
import Tasks from './views/Tasks.jsx';
import Agents from './views/Agents.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [selProject, setSelProject] = useState(null);

  const loadMe = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const { user } = await api('/auth/me');
      setUser(user);
    } catch { clearToken(); setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const handleAuth = (userData, token) => { setToken(token); setUser(userData); loadMe(); };
  const handleLogout = () => { clearToken(); setUser(null); setView('dashboard'); };

  if (loading) return <div className="loading">Loading PM Dashboard…</div>;
  if (!user) return <Auth onAuth={handleAuth} />;

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard setView={setView} setSelProject={setSelProject} />;
      case 'projects': return <Projects setView={setView} setSelProject={setSelProject} />;
      case 'board': return <Board />;
      case 'tasks': return <Tasks setView={setView} />;
      default: return <Dashboard setView={setView} setSelProject={setSelProject} />;
    }
  };

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} user={user} onLogout={handleLogout} />
      <div className="main">{renderView()}</div>
    </div>
  );
}