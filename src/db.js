// Local Storage "database": every collection is stored as JSON under an ovs_* key.
import { useEffect, useState } from 'react';

const K = {
  users: 'ovs_users',
  elections: 'ovs_elections',
  votes: 'ovs_votes',
  notes: 'ovs_notifications',
  logs: 'ovs_activity',
  session: 'ovs_session',
};

const read = (key, fallback = []) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('ovs-change'));
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const shortId = (prefix) => prefix + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();

// re-render a component whenever the database changes
export function useDB() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    window.addEventListener('ovs-change', handler);
    return () => window.removeEventListener('ovs-change', handler);
  }, []);
}

/* ---------- helpers ---------- */
export async function hash(text) {
  if (window.crypto && window.crypto.subtle) {
    const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; // fallback for non-secure contexts
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return 'f' + (h >>> 0).toString(16);
}

const toInput = (ms) => {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export const fmt = (s) => new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function duration(start, end) {
  const mins = Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const parts = [];
  if (d) parts.push(d + (d === 1 ? ' day' : ' days'));
  if (h) parts.push(h + (h === 1 ? ' hr' : ' hrs'));
  if (!d && m) parts.push(m + ' min');
  return parts.join(' ') || '0 min';
}

/* ---------- seed data ---------- */
export async function seed() {
  if (localStorage.getItem(K.users) !== null) return;
  const now = Date.now();
  const day = 86400000;
  write(K.users, [
    {
      id: 'u_admin', name: 'Administrator', email: 'admin@vote.com', voterId: 'ADMIN001',
      phone: '', role: 'admin', blocked: false, passwordHash: await hash('admin123'), createdAt: now,
    },
  ]);
  write(K.elections, [
    {
      id: 'e_active', title: 'Student Council President 2026',
      description: 'Choose the student who will lead the council for the coming academic year.',
      start: toInput(now - day), end: toInput(now + 3 * day), archived: false, published: false, override: null,
      candidates: [
        { id: 'CAN-001', name: 'Aarav Sharma', party: 'Unity Front', symbol: 'U', manifesto: 'Better labs, 24x7 library access.' },
        { id: 'CAN-002', name: 'Meera Reddy', party: 'Campus First', symbol: 'C', manifesto: 'Transparent budgets and more clubs.' },
        { id: 'CAN-003', name: 'Rohan Varma', party: 'Forward Alliance', symbol: 'F', manifesto: 'Internships and industry tie-ups.' },
      ],
    },
    {
      id: 'e_upcoming', title: 'Sports Committee Proposal Vote',
      description: 'Vote on the proposal for the new sports complex.',
      start: toInput(now + 5 * day), end: toInput(now + 7 * day), archived: false, published: false, override: null,
      candidates: [
        { id: 'CAN-004', name: 'Approve proposal', party: 'Proposal', symbol: 'Y', manifesto: 'Build the new sports complex.' },
        { id: 'CAN-005', name: 'Reject proposal', party: 'Proposal', symbol: 'N', manifesto: 'Keep the existing facilities.' },
      ],
    },
  ]);
  write(K.votes, []);
  write(K.notes, []);
  write(K.logs, []);
}

// Admin reset: clears every ovs_* key (including the session) and re-creates the demo data.
export async function resetAllData() {
  if (!isAdmin()) return;
  Object.values(K).forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  await seed();
}

/* ---------- session ---------- */
function readSession() {
  try {
    const raw = sessionStorage.getItem(K.session) ?? localStorage.getItem(K.session);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(id, remember) {
  sessionStorage.removeItem(K.session);
  localStorage.removeItem(K.session);
  // "Remember me" keeps the session in Local Storage; otherwise it lasts for the browser tab only
  (remember ? localStorage : sessionStorage).setItem(K.session, JSON.stringify(id));
  window.dispatchEvent(new Event('ovs-change'));
}

/* ---------- users ---------- */
export const getUsers = () => read(K.users);
export const getVoters = () => getUsers().filter((u) => u.role === 'voter');
export const saveUsers = (list) => write(K.users, list);
export const userStatus = (u) => (u.blocked ? 'Blocked' : 'Active');

export function currentUser() {
  const id = readSession();
  if (!id) return null;
  const user = getUsers().find((u) => u.id === id);
  return user && !user.blocked ? user : null;
}

const isAdmin = () => {
  const u = currentUser();
  return !!u && u.role === 'admin';
};
const DENIED = { ok: false, error: 'You are not authorized to perform this action.' };

export function findUser(identifier) {
  const id = String(identifier || '').trim().toLowerCase();
  if (!id) return null;
  return getUsers().find((u) => u.email === id || u.voterId.toLowerCase() === id) || null;
}

export function logActivity(who, action) {
  const logs = read(K.logs);
  logs.unshift({ id: uid(), at: Date.now(), who, action });
  write(K.logs, logs.slice(0, 300));
}
export const getLogs = () => read(K.logs);

export async function registerUser({ name, email, voterId, phone, password }) {
  const users = getUsers();
  const mail = email.trim().toLowerCase();
  if (users.some((u) => u.email === mail)) return { ok: false, error: 'This email is already registered.' };
  if (users.some((u) => u.voterId.toLowerCase() === voterId.trim().toLowerCase()))
    return { ok: false, error: 'This Voter ID is already registered.' };
  const user = {
    id: uid(), name: name.trim(), email: mail, voterId: voterId.trim(), phone: (phone || '').trim(),
    role: 'voter', blocked: false, passwordHash: await hash(password), createdAt: Date.now(),
  };
  saveUsers([...users, user]);
  logActivity(user.name, 'Registered as a voter');
  notify(user.id, 'Your voter registration is complete. You can now log in and vote.', 'Welcome');
  return { ok: true };
}

export async function login(identifier, password, role = 'voter', remember = true) {
  const bad = { ok: false, error: 'Invalid Voter ID/Email or Password.' };
  const user = findUser(identifier);
  if (!user) return bad;
  if (user.passwordHash !== (await hash(password))) return bad;
  if (user.role !== role) return { ok: false, error: 'You are not authorized to login with this role.' };
  if (user.blocked) return { ok: false, error: 'This account has been blocked by the administrator.' };
  setSession(user.id, remember);
  logActivity(user.name, 'Logged in as ' + user.role);
  return { ok: true, user };
}

export function logout() {
  const u = currentUser();
  if (u) logActivity(u.name, 'Logged out');
  sessionStorage.removeItem(K.session);
  localStorage.removeItem(K.session);
  window.dispatchEvent(new Event('ovs-change'));
}

export async function updateProfile(id, { name, phone, newPassword }) {
  const me = currentUser();
  if (!me || me.id !== id) return; // users can edit only their own profile; role is never changed
  const users = getUsers().map((u) => ({ ...u }));
  const user = users.find((u) => u.id === id);
  if (!user) return;
  user.name = name.trim();
  user.phone = phone.trim();
  if (newPassword) user.passwordHash = await hash(newPassword);
  saveUsers(users);
  logActivity(user.name, 'Updated profile');
}

export function setBlocked(id, blocked) {
  if (!isAdmin()) return DENIED;
  const users = getUsers().map((u) => (u.id === id && u.role === 'voter' ? { ...u, blocked } : u));
  saveUsers(users);
  const u = users.find((x) => x.id === id);
  logActivity('Admin', `${blocked ? 'Blocked' : 'Unblocked'} voter ${u ? u.name : id}`);
  return { ok: true };
}

export function deleteVoter(id) {
  if (!isAdmin()) return DENIED;
  const u = getUsers().find((x) => x.id === id && x.role === 'voter');
  if (!u) return { ok: false, error: 'Voter not found.' };
  saveUsers(getUsers().filter((x) => x.id !== id));
  logActivity('Admin', `Removed voter ${u.name}`);
  return { ok: true };
}

/* ---------- notifications ---------- */
export const getNotes = (userId) => read(K.notes).filter((n) => n.userId === userId);

export function notify(userId, message, title = 'Notification') {
  const notes = read(K.notes);
  notes.unshift({ id: uid(), userId, title, message, at: Date.now(), read: false });
  write(K.notes, notes);
}
export const notifyAllVoters = (message, title) => getVoters().forEach((v) => notify(v.id, message, title));

export function markNotesRead(userId) {
  write(K.notes, read(K.notes).map((n) => (n.userId === userId ? { ...n, read: true } : n)));
}

/* ---------- elections ---------- */
export const getElections = () => read(K.elections);

// Status: Draft | Scheduled | Active | Closed | Archived
// 'override' is an admin decision (draft / active / closed); otherwise the voting period decides.
export function electionStatus(e) {
  if (e.archived) return 'Archived';
  if (e.override === 'draft') return 'Draft';
  if (e.override === 'closed') return 'Closed';
  const now = Date.now();
  if (now > new Date(e.end).getTime()) return 'Closed';
  if (e.override === 'active') return 'Active';
  if (now < new Date(e.start).getTime()) return 'Scheduled';
  return 'Active';
}

export function saveElection({ id, title, description, start, end, draft }) {
  if (!isAdmin()) return DENIED;
  if (!title.trim()) return { ok: false, error: 'Election title is required.' };
  if (!start || !end) return { ok: false, error: 'Choose a start and end time.' };
  if (new Date(end) <= new Date(start)) return { ok: false, error: 'The end time must be after the start time.' };
  const list = getElections();
  if (id) {
    write(K.elections, list.map((e) => {
      if (e.id !== id) return e;
      let override = e.override || null;
      if (draft) override = 'draft';
      else if (override === 'draft') override = null;
      return { ...e, title: title.trim(), description: description.trim(), start, end, override, notifiedStart: false, notifiedClosing: false };
    }));
    logActivity('Admin', `Updated election "${title.trim()}"`);
  } else {
    write(K.elections, [
      ...list,
      {
        id: uid(), title: title.trim(), description: description.trim(), start, end,
        archived: false, published: false, override: draft ? 'draft' : null, candidates: [],
      },
    ]);
    logActivity('Admin', `Created ${draft ? 'draft ' : ''}election "${title.trim()}"`);
    if (!draft) notifyAllVoters(`New election scheduled: ${title.trim()} (starts ${fmt(start)}).`, 'New election');
  }
  return { ok: true };
}

export function patchElection(id, patch) {
  write(K.elections, getElections().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

// action: 'activate' | 'close' | 'schedule' | 'draft'
export function setElectionStatus(id, action) {
  if (!isAdmin()) return DENIED;
  const e = getElections().find((x) => x.id === id);
  if (!e) return { ok: false, error: 'Election not found.' };
  if (action === 'activate') {
    if (new Date(e.end).getTime() < Date.now()) return { ok: false, error: 'The voting period has already ended. Edit the end time first.' };
    if (e.candidates.length === 0) return { ok: false, error: 'Add at least one candidate before activating.' };
    patchElection(id, { override: 'active' });
  } else if (action === 'close') {
    patchElection(id, { override: 'closed' });
  } else if (action === 'schedule') {
    patchElection(id, { override: null });
    if (e.override === 'draft') notifyAllVoters(`New election scheduled: ${e.title} (starts ${fmt(e.start)}).`, 'New election');
  } else if (action === 'draft') {
    patchElection(id, { override: 'draft' });
  }
  logActivity('Admin', `Set election "${e.title}" to ${action}`);
  return { ok: true };
}

export function deleteElection(id) {
  if (!isAdmin()) return DENIED;
  const e = getElections().find((x) => x.id === id);
  write(K.elections, getElections().filter((x) => x.id !== id));
  write(K.votes, read(K.votes).filter((v) => v.electionId !== id));
  logActivity('Admin', `Deleted election "${e ? e.title : id}"`);
  return { ok: true };
}

export function toggleArchive(id) {
  if (!isAdmin()) return DENIED;
  const e = getElections().find((x) => x.id === id);
  if (!e) return { ok: false, error: 'Election not found.' };
  patchElection(id, { archived: !e.archived });
  logActivity('Admin', `${e.archived ? 'Restored' : 'Archived'} election "${e.title}"`);
  return { ok: true };
}

export function togglePublish(id) {
  if (!isAdmin()) return DENIED;
  const e = getElections().find((x) => x.id === id);
  if (!e) return { ok: false, error: 'Election not found.' };
  if (!e.published && electionStatus(e) !== 'Closed')
    return { ok: false, error: 'Results can be published only after voting has closed.' };
  patchElection(id, { published: !e.published });
  logActivity('Admin', `${e.published ? 'Unpublished' : 'Published'} results for "${e.title}"`);
  if (!e.published) notifyAllVoters(`Results are out for: ${e.title}.`, 'Result published');
  return { ok: true };
}

// Creates "Voting started" and "Voting closing soon" notifications once per election.
export function syncNotifications() {
  const list = getElections();
  let changed = false;
  const next = list.map((e) => {
    const s = electionStatus(e);
    const copy = { ...e };
    if (s === 'Active' && !e.notifiedStart) {
      notifyAllVoters(`Voting has started for "${e.title}". Cast your vote before ${fmt(e.end)}.`, 'Voting started');
      copy.notifiedStart = true;
      changed = true;
    }
    if (s === 'Active' && !e.notifiedClosing && new Date(e.end).getTime() - Date.now() < 86400000) {
      notifyAllVoters(`Voting for "${e.title}" closes soon (${fmt(e.end)}).`, 'Voting closing soon');
      copy.notifiedClosing = true;
      changed = true;
    }
    return copy;
  });
  if (changed) write(K.elections, next);
}

/* ---------- candidates ---------- */
export function addCandidate(electionId, { name, party, symbol, manifesto }) {
  if (!isAdmin()) return DENIED;
  if (!name.trim()) return { ok: false, error: 'Candidate name is required.' };
  const e = getElections().find((x) => x.id === electionId);
  if (!e) return { ok: false, error: 'Choose an election first.' };
  patchElection(electionId, {
    candidates: [
      ...e.candidates,
      { id: shortId('CAN'), name: name.trim(), party: (party || '').trim(), symbol: (symbol || '').trim(), manifesto: (manifesto || '').trim() },
    ],
  });
  logActivity('Admin', `Added candidate ${name.trim()} to "${e.title}"`);
  return { ok: true };
}

export function updateCandidate(electionId, candidateId, { name, party, symbol, manifesto }) {
  if (!isAdmin()) return DENIED;
  if (!name.trim()) return { ok: false, error: 'Candidate name is required.' };
  const e = getElections().find((x) => x.id === electionId);
  if (!e) return { ok: false, error: 'Election not found.' };
  patchElection(electionId, {
    candidates: e.candidates.map((c) =>
      c.id === candidateId
        ? { ...c, name: name.trim(), party: (party || '').trim(), symbol: (symbol || '').trim(), manifesto: (manifesto || '').trim() }
        : c
    ),
  });
  logActivity('Admin', `Updated candidate ${name.trim()} in "${e.title}"`);
  return { ok: true };
}

export function removeCandidate(electionId, candidateId) {
  if (!isAdmin()) return DENIED;
  const e = getElections().find((x) => x.id === electionId);
  if (!e) return { ok: false, error: 'Election not found.' };
  patchElection(electionId, { candidates: e.candidates.filter((c) => c.id !== candidateId) });
  write(K.votes, read(K.votes).filter((v) => !(v.electionId === electionId && v.candidateId === candidateId)));
  logActivity('Admin', `Removed a candidate from "${e.title}"`);
  return { ok: true };
}

/* ---------- votes ---------- */
export const getVotes = () => read(K.votes);
export const hasVoted = (userId, electionId) =>
  getVotes().some((v) => v.userId === userId && v.electionId === electionId);

export function castVote(user, electionId, candidateId) {
  const me = currentUser();
  if (!me || me.role !== 'voter' || me.id !== user.id) return { ok: false, error: 'Only a logged-in voter can vote.' };
  const e = getElections().find((x) => x.id === electionId);
  if (!e) return { ok: false, error: 'Election not found.' };
  if (electionStatus(e) !== 'Active') return { ok: false, error: 'Voting is not open for this election.' };
  if (!e.candidates.some((c) => c.id === candidateId)) return { ok: false, error: 'Select a valid candidate.' };
  if (hasVoted(user.id, electionId)) return { ok: false, error: 'You have already voted in this election.' };
  const vote = { id: 'RCPT-' + uid().toUpperCase(), electionId, userId: user.id, candidateId, at: Date.now() };
  write(K.votes, [...getVotes(), vote]);
  logActivity(user.name, `Voted in "${e.title}"`);
  notify(user.id, `Your vote in "${e.title}" was recorded. Receipt: ${vote.id}`, 'Vote confirmed');
  return { ok: true, vote };
}

export function tally(election) {
  const votes = getVotes().filter((v) => v.electionId === election.id);
  const rows = election.candidates.map((c) => ({
    ...c, count: votes.filter((v) => v.candidateId === c.id).length,
  }));
  return { rows, total: votes.length };
}

export function winners(election) {
  const { rows } = tally(election);
  const top = Math.max(0, ...rows.map((r) => r.count));
  return top === 0 ? [] : rows.filter((r) => r.count === top);
}