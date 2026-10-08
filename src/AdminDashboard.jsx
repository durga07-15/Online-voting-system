import { useState } from 'react';
import * as db from './db';
import { ResultCard } from './VoterDashboard.jsx';

const TABS = [
  ['overview', 'Monitoring'],
  ['elections', 'Elections'],
  ['candidates', 'Candidates'],
  ['voters', 'Voters'],
  ['verify', 'Verification'],
  ['activity', 'Activity'],
  ['reports', 'Reports'],
];

export default function AdminDashboard() {
  db.useDB();
  const [tab, setTab] = useState('overview');
  return (
    <section>
      <nav className="tabs" aria-label="Admin sections">
        {TABS.map(([key, label]) => (
          <button key={key} className={'tab' + (tab === key ? ' on' : '')} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>
      {tab === 'overview' && <Overview />}
      {tab === 'elections' && <Elections />}
      {tab === 'candidates' && <Candidates />}
      {tab === 'voters' && <Voters />}
      {tab === 'verify' && <Verify />}
      {tab === 'activity' && <Activity />}
      {tab === 'reports' && <Reports />}
    </section>
  );
}

const Pill = ({ s }) => <span className={'status ' + s.toLowerCase()}>{s}</span>;

function Overview() {
  const elections = db.getElections();
  const voters = db.getVoters();
  const votes = db.getVotes();
  const count = (s) => elections.filter((e) => db.electionStatus(e) === s).length;
  const stats = [
    ['Registered voters', voters.length],
    ['Elections', elections.length],
    ['Draft', count('Draft')],
    ['Scheduled', count('Scheduled')],
    ['Active now', count('Active')],
    ['Closed', count('Closed')],
    ['Archived', count('Archived')],
    ['Votes cast', votes.length],
  ];
  const reset = () => {
    if (window.confirm('Reset ALL data (users, elections, votes, notifications, activity) back to the demo data? You will be logged out.')) db.resetAllData();
  };
  return (
    <div>
      <h2>System monitoring</h2>
      <div className="stats">
        {stats.map(([label, value]) => (
          <div key={label} className="stat"><strong>{value}</strong><span>{label}</span></div>
        ))}
      </div>
      <h3>Election status and turnout</h3>
      {elections.length === 0 && <p className="empty">No elections yet. Create one in the Elections tab.</p>}
      <div className="table-wrap">
        {elections.length > 0 && (
          <table>
            <thead><tr><th>Election</th><th>Status</th><th>Votes</th><th>Turnout</th></tr></thead>
            <tbody>
              {elections.map((e) => {
                const total = db.tally(e).total;
                const pct = voters.length ? Math.round((total / voters.length) * 100) : 0;
                return (
                  <tr key={e.id}>
                    <td>{e.title}</td>
                    <td><Pill s={db.electionStatus(e)} /></td>
                    <td>{total}</td>
                    <td>
                      <div className="bar"><div className="fill" style={{ width: pct + '%' }} /></div>
                      <small>{pct}%</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="card danger-zone">
        <h3>Demo data</h3>
        <p className="meta">Clears the Local Storage database and restores the sample elections and admin account.</p>
        <button className="btn danger" onClick={reset}>Reset all data</button>
      </div>
    </div>
  );
}

const EMPTY = { id: '', title: '', description: '', start: '', end: '', draft: false };

function Elections() {
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const elections = db.getElections();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const say = (res, okText) => setMsg(res.ok ? { type: 'ok', text: okText } : { type: 'error', text: res.error });

  const submit = (e) => {
    e.preventDefault();
    const res = db.saveElection(form);
    say(res, form.id ? 'Election updated.' : form.draft ? 'Draft election saved.' : 'Election created and voters notified.');
    if (res.ok) setForm(EMPTY);
  };

  const edit = (el) => {
    setForm({ id: el.id, title: el.title, description: el.description, start: el.start, end: el.end, draft: el.override === 'draft' });
    setMsg({ type: '', text: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = (el) => {
    if (window.confirm(`Delete "${el.title}" and all its votes? This cannot be undone.`)) say(db.deleteElection(el.id), 'Election deleted.');
  };

  return (
    <div>
      <form className="card" onSubmit={submit}>
        <h2>{form.id ? 'Edit election' : 'Create and schedule an election'}</h2>
        <div className="form-grid">
          <label>Title<input value={form.title} onChange={set('title')} /></label>
          <label>Voting opens<input type="datetime-local" value={form.start} onChange={set('start')} /></label>
          <label>Voting closes<input type="datetime-local" value={form.end} onChange={set('end')} /></label>
          <label className="wide">Description<textarea rows="2" value={form.description} onChange={set('description')} /></label>
          <label className="check wide">
            <input type="checkbox" checked={form.draft} onChange={(e) => setForm({ ...form, draft: e.target.checked })} />
            Save as draft (hidden from voters until scheduled)
          </label>
        </div>
        {msg.text && <p className={'msg ' + msg.type}>{msg.text}</p>}
        <div className="row-gap">
          <button className="btn primary" type="submit">{form.id ? 'Save changes' : 'Create election'}</button>
          {form.id && <button type="button" className="btn ghost" onClick={() => setForm(EMPTY)}>Cancel edit</button>}
        </div>
      </form>

      <h2>All elections</h2>
      {elections.length === 0 && <p className="empty">No elections yet. Use the form above to create one.</p>}
      <div className="table-wrap">
        {elections.length > 0 && (
          <table>
            <thead><tr><th>Election</th><th>Voting period</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {elections.map((el) => {
                const s = db.electionStatus(el);
                return (
                  <tr key={el.id}>
                    <td>{el.title}<br /><small>{el.candidates.length} candidate(s){el.published ? ' · results published' : ''}</small></td>
                    <td>{db.fmt(el.start)}<br />to {db.fmt(el.end)}</td>
                    <td><Pill s={s} /></td>
                    <td className="actions">
                      {s !== 'Archived' && <button className="btn small" onClick={() => edit(el)}>Edit</button>}
                      {s === 'Draft' && <button className="btn small" onClick={() => say(db.setElectionStatus(el.id, 'schedule'), 'Election scheduled.')}>Schedule</button>}
                      {(s === 'Draft' || s === 'Scheduled') && <button className="btn small" onClick={() => say(db.setElectionStatus(el.id, 'activate'), 'Election activated.')}>Activate</button>}
                      {s === 'Active' && <button className="btn small" onClick={() => say(db.setElectionStatus(el.id, 'close'), 'Election closed.')}>Close</button>}
                      {s === 'Closed' && <button className="btn small" onClick={() => say(db.togglePublish(el.id), 'Result visibility updated.')}>{el.published ? 'Unpublish' : 'Publish results'}</button>}
                      <button className="btn small" onClick={() => say(db.toggleArchive(el.id), s === 'Archived' ? 'Election restored.' : 'Election archived.')}>{s === 'Archived' ? 'Restore' : 'Archive'}</button>
                      <button className="btn small danger" onClick={() => remove(el)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const EMPTY_C = { electionId: '', id: '', name: '', party: '', symbol: '', manifesto: '' };

function Candidates() {
  const elections = db.getElections();
  const [form, setForm] = useState(EMPTY_C);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const editing = !!form.id;

  const submit = (e) => {
    e.preventDefault();
    const res = editing ? db.updateCandidate(form.electionId, form.id, form) : db.addCandidate(form.electionId, form);
    if (!res.ok) return setMsg({ type: 'error', text: res.error });
    setMsg({ type: 'ok', text: editing ? 'Candidate updated.' : 'Candidate added.' });
    setForm(editing ? EMPTY_C : { ...form, name: '', party: '', symbol: '', manifesto: '' });
  };

  const edit = (electionId, c) => {
    setForm({ electionId, id: c.id, name: c.name, party: c.party || '', symbol: c.symbol || '', manifesto: c.manifesto || '' });
    setMsg({ type: '', text: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = (e, c) => {
    if (!window.confirm(`Remove ${c.name}? Votes for this candidate are removed too.`)) return;
    const res = db.removeCandidate(e.id, c.id);
    setMsg(res.ok ? { type: 'ok', text: 'Candidate removed.' } : { type: 'error', text: res.error });
  };

  return (
    <div>
      <form className="card" onSubmit={submit}>
        <h2>{editing ? 'Edit candidate' : 'Add a candidate'}</h2>
        <div className="form-grid">
          <label>Election
            <select value={form.electionId} onChange={set('electionId')} disabled={editing}>
              <option value="">Select an election</option>
              {elections.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </label>
          <label>Candidate or option name<input value={form.name} onChange={set('name')} /></label>
          <label>Party or group<input value={form.party} onChange={set('party')} /></label>
          <label>Symbol (a letter or emoji)<input maxLength="2" value={form.symbol} onChange={set('symbol')} /></label>
          <label className="wide">Manifesto<textarea rows="2" value={form.manifesto} onChange={set('manifesto')} /></label>
        </div>
        {msg.text && <p className={'msg ' + msg.type}>{msg.text}</p>}
        <div className="row-gap">
          <button className="btn primary" type="submit">{editing ? 'Save candidate' : 'Add candidate'}</button>
          {editing && <button type="button" className="btn ghost" onClick={() => setForm(EMPTY_C)}>Cancel edit</button>}
        </div>
      </form>

      <h2>Candidate management</h2>
      {elections.length === 0 && <p className="empty">Create an election before adding candidates.</p>}
      {elections.map((e) => (
        <article key={e.id} className="card">
          <div className="row"><h3>{e.title}</h3><Pill s={db.electionStatus(e)} /></div>
          {e.candidates.length === 0 && <p className="empty">No candidates yet.</p>}
          <ul className="plain">
            {e.candidates.map((c) => (
              <li key={c.id} className="row">
                <span><strong>{c.name}</strong>{c.party ? ` — ${c.party}` : ''}<small>ID: {c.id}</small></span>
                <span className="row-gap">
                  <button className="btn small" onClick={() => edit(e.id, c)}>Edit</button>
                  <button className="btn small danger" onClick={() => remove(e, c)}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function Voters() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState('');
  const all = db.getVoters();
  const voters = all.filter((v) => {
    const text = (v.name + ' ' + v.voterId + ' ' + v.email).toLowerCase();
    return text.includes(q.trim().toLowerCase()) && (filter === 'all' || (filter === 'blocked') === v.blocked);
  });
  const votesBy = (id) => db.getVotes().filter((x) => x.userId === id).length;

  return (
    <div>
      <h2>Voter management</h2>
      <div className="toolbar">
        <label>Search voters<input type="search" value={q} placeholder="Name, voter ID or email" onChange={(e) => setQ(e.target.value)} /></label>
        <label>Status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All voters</option>
            <option value="allowed">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
      </div>
      {msg && <p className="msg error" role="alert">{msg}</p>}
      {all.length === 0 && <p className="empty">No voters have registered yet.</p>}
      {all.length > 0 && voters.length === 0 && <p className="empty">No voters match your search.</p>}
      <div className="table-wrap">
        {voters.length > 0 && (
          <table>
            <thead><tr><th>Name</th><th>Voter ID</th><th>Email</th><th>Registered</th><th>Votes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {voters.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td><td>{v.voterId}</td><td>{v.email}</td><td>{db.fmt(v.createdAt)}</td><td>{votesBy(v.id)}</td>
                  <td><span className={'status ' + (v.blocked ? 'closed' : 'active')}>{db.userStatus(v)}</span></td>
                  <td className="actions">
                    <button className="btn small" onClick={() => db.setBlocked(v.id, !v.blocked)}>{v.blocked ? 'Unblock' : 'Block'}</button>
                    <button className="btn small danger" onClick={() => window.confirm(`Remove ${v.name}?`) && setMsg(db.deleteVoter(v.id).ok ? '' : 'Could not remove voter.')}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Verify() {
  const elections = db.getElections();
  const votes = db.getVotes();
  const voterIds = new Set(db.getUsers().map((u) => u.id));
  return (
    <div>
      <h2>Result verification</h2>
      <p className="meta">Each check compares stored votes with the tally and looks for duplicate or orphaned votes. The winner is declared only after voting closes.</p>
      {elections.length === 0 && <p className="empty">No elections to verify.</p>}
      <div className="grid">
        {elections.map((e) => {
          const ev = votes.filter((v) => v.electionId === e.id);
          const { rows, total } = db.tally(e);
          const sum = rows.reduce((a, r) => a + r.count, 0);
          const dupes = ev.length - new Set(ev.map((v) => v.userId)).size;
          const orphan = ev.filter((v) => !voterIds.has(v.userId)).length;
          const ok = sum === ev.length && dupes === 0 && orphan === 0;
          const status = db.electionStatus(e);
          const win = status === 'Closed' || (status === 'Archived' && new Date(e.end) < new Date()) ? db.winners(e) : null;
          return (
            <article key={e.id} className="card">
              <div className="row"><h3>{e.title}</h3><span className={'status ' + (ok ? 'active' : 'closed')}>{ok ? 'Verified' : 'Mismatch'}</span></div>
              <div className="table-wrap flat">
                <table>
                  <thead><tr><th>Candidate</th><th>Votes</th></tr></thead>
                  <tbody>
                    {rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.count}</td></tr>)}
                    <tr><td><strong>Total votes</strong></td><td><strong>{total}</strong></td></tr>
                  </tbody>
                </table>
              </div>
              <p className="meta">
                {win === null && `Winner shown after voting closes (status: ${status}).`}
                {win && win.length === 0 && 'No votes were cast.'}
                {win && win.length === 1 && <>Winner: <strong>{win[0].name}</strong></>}
                {win && win.length > 1 && <>Tie between: <strong>{win.map((w) => w.name).join(', ')}</strong></>}
              </p>
              <ul className="plain meta">
                <li>Duplicate votes: {dupes}</li>
                <li>Votes from removed voters: {orphan}</li>
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Activity() {
  const logs = db.getLogs();
  return (
    <div>
      <h2>Activity tracking</h2>
      {logs.length === 0 && <p className="empty">No activity recorded yet.</p>}
      <div className="table-wrap">
        {logs.length > 0 && (
          <table>
            <thead><tr><th>Time</th><th>User</th><th>Action</th></tr></thead>
            <tbody>
              {logs.slice(0, 100).map((l) => (
                <tr key={l.id}><td>{db.fmt(l.at)}</td><td>{l.who}</td><td>{l.action}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const csvCell = (c) => `"${String(c ?? '').replace(/"/g, '""')}"`;

function downloadCSV(lines, filename) {
  const csv = lines.map((r) => r.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function electionRows(e) {
  const { rows, total } = db.tally(e);
  return rows.map((r) => [e.title, db.electionStatus(e), r.name, r.party, r.count, total, total ? ((r.count / total) * 100).toFixed(1) + '%' : '0%']);
}
const HEAD = ['Election', 'Status', 'Candidate', 'Group', 'Votes', 'Total votes', 'Percent'];

function Reports() {
  const elections = db.getElections();

  const one = (e) => {
    downloadCSV([HEAD, ...electionRows(e)], e.title.replace(/[^a-z0-9]+/gi, '_') + '_report.csv');
    db.logActivity('Admin', `Generated report for "${e.title}"`);
  };
  const all = () => {
    downloadCSV([HEAD, ...elections.flatMap(electionRows)], 'all_elections_report.csv');
    db.logActivity('Admin', 'Generated report for all elections');
  };

  return (
    <div>
      <div className="row">
        <h2>Election reports</h2>
        <span className="row-gap">
          {elections.length > 0 && <button className="btn" onClick={all}>Export all elections (CSV)</button>}
          <button className="btn ghost" onClick={() => window.print()}>Print this page</button>
        </span>
      </div>
      {elections.length === 0 && <p className="empty">No elections to report on.</p>}
      <div className="grid">
        {elections.map((e) => (
          <div key={e.id}>
            <ResultCard election={e} />
            <button className="btn small report-btn" onClick={() => one(e)}>Export Election Report (CSV)</button>
          </div>
        ))}
      </div>
    </div>
  );
}