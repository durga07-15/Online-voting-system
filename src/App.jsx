import { useEffect, useState } from 'react';
import * as db from './db';
import Auth from './Auth.jsx';
import VoterDashboard, { ResultCard } from './VoterDashboard.jsx';
import AdminDashboard from './AdminDashboard.jsx';

const NAV = [
  ['vote', 'Vote'],
  ['results', 'Results'],
  ['about', 'About'],
];

function PublicResults() {
  const published = db.getElections().filter((e) => e.published);
  return (
    <section>
      <h2>Election results</h2>
      {published.length === 0 && (
        <p className="empty">No results have been published yet. Results appear here after voting closes.</p>
      )}
      <div className="grid">
        {published.map((e) => (
          <ResultCard key={e.id} election={e} />
        ))}
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="about">
      <h2>About this project</h2>
      <p>
        The Online Voting System is a secure web-based platform for running digital elections.
        Registered voters log in, choose one candidate or party, and receive a confirmation receipt.
        Administrators create elections, manage voters and candidates, and publish results.
      </p>
      <ul>
        <li>One voter, one vote per election.</li>
        <li>Elections open and close automatically at the scheduled time.</li>
        <li>Results are shown only after the administrator publishes them.</li>
      </ul>
    </section>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('vote');
  const [, setClock] = useState(0);
  db.useDB();

  useEffect(() => {
    db.seed().then(() => {
      db.syncNotifications();
      setReady(true);
    });
    // every 30s: refresh statuses and create "voting started / closing soon" notifications
    const timer = setInterval(() => {
      db.syncNotifications();
      setClock((n) => n + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  if (!ready) return <p className="loading">Loading…</p>;

  const user = db.currentUser();

  const handleLogout = () => {
    db.logout();
    setPage('vote');
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">Online Voting System</h1>
        <nav className="nav" aria-label="Main">
          {NAV.map(([key, label]) => (
            <button
              key={key}
              className={'nav-link' + (page === key ? ' on' : '')}
              onClick={() => setPage(key)}
            >
              {label}
            </button>
          ))}
          {user && <span className="nav-user">{user.name}</span>}
          {user && (
            <button className="nav-link" onClick={handleLogout}>
              Log out
            </button>
          )}
        </nav>
      </header>

      <main className="content">
        {page === 'results' && <PublicResults />}
        {page === 'about' && <About />}
        {page === 'vote' && !user && <Auth />}
        {page === 'vote' && user && user.role === 'admin' && <AdminDashboard user={user} />}
        {page === 'vote' && user && user.role === 'voter' && <VoterDashboard user={user} />}
      </main>

      <footer className="footer">
        <p>© 2026 Online Voting System | Full Stack Web Development Project</p>
      </footer>
    </div>
  );
}