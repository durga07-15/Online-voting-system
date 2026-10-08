import { useState } from 'react';
import * as db from './db';

const TABS = [
  ['elections', 'Elections'],
  ['schedule', 'Schedule'],
  ['notifications', 'Notifications'],
  ['history', 'Voting history'],
  ['profile', 'Profile'],
];

export default function VoterDashboard({ user }) {
  db.useDB();
  const [tab, setTab] = useState('elections');
  const unread = db.getNotes(user.id).filter((n) => !n.read).length;

  return (
    <section>
      <nav className="tabs" aria-label="Voter sections">
        {TABS.map(([key, label]) => (
          <button key={key} className={'tab' + (tab === key ? ' on' : '')} onClick={() => setTab(key)}>
            {label}
            {key === 'notifications' && unread > 0 && <span className="badge">{unread}</span>}
          </button>
        ))}
      </nav>
      {tab === 'elections' && <Elections user={user} />}
      {tab === 'schedule' && <Schedule />}
      {tab === 'notifications' && <Notifications user={user} />}
      {tab === 'history' && <History user={user} />}
      {tab === 'profile' && <Profile user={user} />}
    </section>
  );
}

const ORDER = { Active: 0, Scheduled: 1, Closed: 2 };

function Elections({ user }) {
  const [picked, setPicked] = useState({});
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  const visible = db.getElections()
    .filter((e) => !e.archived && db.electionStatus(e) !== 'Draft')
    .sort((a, b) => (ORDER[db.electionStatus(a)] ?? 9) - (ORDER[db.electionStatus(b)] ?? 9));
  const published = db.getElections().filter((e) => !e.archived && e.published);

  const vote = (election) => {
    setError('');
    const candidateId = picked[election.id];
    if (!candidateId) return setError('Select a candidate before voting.');
    const c = election.candidates.find((x) => x.id === candidateId);
    if (!window.confirm(`Cast your vote for ${c.name}? You cannot change it later.`)) return;
    const res = db.castVote(user, election.id, candidateId);
    if (!res.ok) return setError(res.error);
    setReceipt({ election: election.title, candidate: c.name, id: res.vote.id, at: res.vote.at });
  };

  return (
    <div>
      {receipt && (
        <div className="card confirm" role="status">
          <h3>Your vote has been successfully submitted.</h3>
          <p>Election: <strong>{receipt.election}</strong></p>
          <p>Selected candidate: <strong>{receipt.candidate}</strong></p>
          <p>Receipt ID: <code>{receipt.id}</code> · {db.fmt(receipt.at)}</p>
          <button className="btn ghost" onClick={() => setReceipt(null)}>Dismiss</button>
        </div>
      )}
      {error && <p className="msg error" role="alert">{error}</p>}

      <h2>Elections</h2>
      {visible.length === 0 && <p className="empty">No elections are available right now. Check back soon.</p>}
      <div className="grid">
        {visible.map((e) => {
          const status = db.electionStatus(e);
          const open = status === 'Active';
          const voted = db.hasVoted(user.id, e.id);
          return (
            <article key={e.id} className="card">
              <div className="row">
                <h3>{e.title}</h3>
                <span className={'status ' + status.toLowerCase()}>{status}</span>
              </div>
              <p>{e.description}</p>
              <p className="meta">Starts {db.fmt(e.start)} · Ends {db.fmt(e.end)}</p>
              {e.candidates.length === 0 && <p className="empty">Candidates have not been added yet.</p>}
              <ul className="cands">
                {e.candidates.map((c) => (
                  <li key={c.id}>
                    <label className={'cand' + (picked[e.id] === c.id ? ' sel' : '') + (!open || voted ? ' off' : '')}>
                      <input
                        type="radio"
                        name={'el-' + e.id}
                        disabled={!open || voted}
                        checked={picked[e.id] === c.id}
                        onChange={() => setPicked({ ...picked, [e.id]: c.id })}
                      />
                      <span className="symbol" aria-hidden="true">{c.symbol || c.name.charAt(0).toUpperCase()}</span>
                      <span className="cand-info">
                        <strong>{c.name}</strong>
                        <small>ID: {c.id}{c.party ? ` · ${c.party}` : ''}</small>
                        {c.manifesto && <small>{c.manifesto}</small>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {voted && <p className="msg ok">You have voted in this election.</p>}
              {!voted && (
                <button className="btn primary" disabled={!open || e.candidates.length === 0} onClick={() => vote(e)}>
                  {open ? 'Cast vote' : status === 'Scheduled' ? 'Voting opens ' + db.fmt(e.start) : 'Voting closed'}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <h2>Published results</h2>
      {published.length === 0 && <p className="empty">No results have been published yet.</p>}
      <div className="grid">
        {published.map((e) => (
          <ResultCard key={e.id} election={e} />
        ))}
      </div>
    </div>
  );
}

export function ResultCard({ election }) {
  const { rows, total } = db.tally(election);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <article className="card">
      <h3>{election.title}</h3>
      <p className="meta">{total} vote{total === 1 ? '' : 's'} counted</p>
      {rows.map((r) => (
        <div key={r.id} className="bar-row">
          <div className="row"><span>{r.name}</span><span>{r.count} ({total ? Math.round((r.count / total) * 100) : 0}%)</span></div>
          <div className="bar"><div className="fill" style={{ width: (r.count / max) * 100 + '%' }} /></div>
        </div>
      ))}
    </article>
  );
}

function Schedule() {
  const list = db.getElections().filter((e) => !e.archived && db.electionStatus(e) !== 'Draft');
  return (
    <div>
      <h2>Election schedule</h2>
      {list.length === 0 && <p className="empty">No elections are scheduled.</p>}
      <div className="table-wrap">
        {list.length > 0 && (
          <table>
            <thead><tr><th>Election</th><th>Starts</th><th>Ends</th><th>Voting period</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((e) => {
                const s = db.electionStatus(e);
                return (
                  <tr key={e.id}>
                    <td>{e.title}</td><td>{db.fmt(e.start)}</td><td>{db.fmt(e.end)}</td>
                    <td>{db.duration(e.start, e.end)}</td>
                    <td><span className={'status ' + s.toLowerCase()}>{s}</span></td>
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

function Notifications({ user }) {
  const notes = db.getNotes(user.id);
  return (
    <div>
      <div className="row">
        <h2>Notifications</h2>
        {notes.some((n) => !n.read) && <button className="btn ghost" onClick={() => db.markNotesRead(user.id)}>Mark all as read</button>}
      </div>
      {notes.length === 0 && <p className="empty">You have no notifications.</p>}
      <ul className="notes">
        {notes.map((n) => (
          <li key={n.id} className={n.read ? '' : 'unread'}>
            <span><strong>{n.title || 'Notification'}</strong><br />{n.message}</span>
            <small>{db.fmt(n.at)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function History({ user }) {
  const elections = db.getElections();
  const mine = db.getVotes().filter((v) => v.userId === user.id).reverse();
  return (
    <div>
      <h2>Voting history</h2>
      <p className="meta">Simulation: your ballot choice is not shown here, only that your vote was recorded.</p>
      {mine.length === 0 && <p className="empty">You have not voted yet. Open the Elections tab to vote.</p>}
      <div className="table-wrap">
        {mine.length > 0 && (
          <table>
            <thead><tr><th>Election</th><th>Date</th><th>Vote status</th><th>Receipt ID</th></tr></thead>
            <tbody>
              {mine.map((v) => {
                const e = elections.find((x) => x.id === v.electionId);
                return (
                  <tr key={v.id}>
                    <td>{e ? e.title : 'Deleted election'}</td>
                    <td>{db.fmt(v.at)}</td>
                    <td><span className="status active">Recorded</span></td>
                    <td><code>{v.id}</code></td>
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

function Profile({ user }) {
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', password: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setMsg({ type: 'error', text: 'Name cannot be empty.' });
    if (form.phone.trim() && !/^\d{10}$/.test(form.phone.trim())) return setMsg({ type: 'error', text: 'Mobile number must be 10 digits.' });
    if (form.password && form.password.length < 6) return setMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
    await db.updateProfile(user.id, { name: form.name, phone: form.phone, newPassword: form.password });
    setForm({ ...form, password: '' });
    setMsg({ type: 'ok', text: 'Profile saved.' });
  };

  return (
    <form className="card narrow" onSubmit={save}>
      <h2>Profile</h2>
      <p className="meta">Voter ID: {user.voterId} · {user.email} · Role: {user.role} · Status: {db.userStatus(user)}</p>
      <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Mobile number<input value={form.phone} inputMode="numeric" onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
      <label>New password (leave blank to keep current)
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
      </label>
      {msg.text && <p className={'msg ' + msg.type}>{msg.text}</p>}
      <button className="btn primary" type="submit">Save changes</button>
    </form>
  );
}