import React, { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Agents from './views/Agents.jsx';

const MOCK_USER = { display_name: 'Admin', role: 'admin', email: 'admin@pm.test' };

export default function App() {
  const [user] = useState(MOCK_USER);
  const [view, setView] = useState('agents');

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} user={user} />
      <div className="main"><Agents /></div>
    </div>
  );
}