import { useState } from 'react';
import * as db from './db';

function BallotIcon() {
  return (
    <svg className="hero-icon" viewBox="0 0 160 160" role="img" aria-label="Ballot box with a ticked ballot paper">
      <circle cx="80" cy="80" r="76" fill="#ffffff" fillOpacity="0.08" />
      <rect x="44" y="30" width="72" height="62" rx="6" fill="#ffffff" />
      <path d="M62 62l12 12 24-26" fill="none" stroke="#2a7f62" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="28" y="84" width="104" height="52" rx="8" fill="#2a7f62" />
      <rect x="52" y="96" width="56" height="9" rx="4.5" fill="#1d3557" />
      <rect x="28" y="84" width="104" height="52" rx="8" fill="none" stroke="#ffffff" strokeWidth="3" />
    </svg>
  );
}

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function PasswordField({ label, id, value, onChange, error, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} aria-invalid={!!error} />
        <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
          <EyeIcon off={show} />
        </button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

function Field({ label, id, error, ...props }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={!!error} {...props} />
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState({ role: 'voter', identifier: '', password: '', remember: true });
  const [reg, setReg] = useState({ name: '', voterId: '', email: '', phone: '', password: '', confirm: '' });
  const [forgot, setForgot] = useState('');

  const go = (m) => {
    setMode(m);
    setErrors({});
    if (m !== 'login') setNotice('');
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!login.identifier.trim()) errs.identifier = 'Please enter your Voter ID or Email.';
    if (!login.password) errs.password = 'Please enter your password.';
    setErrors(errs);
    setNotice('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await db.login(login.identifier, login.password, login.role, login.remember);
    setBusy(false);
    if (!res.ok) setErrors({ form: res.error });
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!reg.name.trim()) errs.name = 'Please enter your full name.';
    if (!reg.voterId.trim()) errs.voterId = 'Please enter your Voter ID.';
    if (!reg.email.trim()) errs.email = 'Please enter your email.';
    else if (!/^\S+@\S+\.\S+$/.test(reg.email.trim())) errs.email = 'Enter a valid email address.';
    if (reg.phone.trim() && !/^\d{10}$/.test(reg.phone.trim())) errs.phone = 'Mobile number must be 10 digits.';
    if (reg.password.length < 6) errs.password = 'Password must be at least 6 characters.';
    if (reg.confirm !== reg.password) errs.confirm = 'Passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await db.registerUser(reg);
    setBusy(false);
    if (!res.ok) return setErrors({ form: res.error });
    setReg({ name: '', voterId: '', email: '', phone: '', password: '', confirm: '' });
    setMode('login');
    setErrors({});
    setNotice('Registration successful. Please log in with your Voter ID or email.');
  };

  const submitForgot = (e) => {
    e.preventDefault();
    if (!forgot.trim()) return setErrors({ identifier: 'Please enter your Voter ID or Email.' });
    setErrors({});
    setNotice(`If an account exists for "${forgot.trim()}", password reset instructions have been sent. (Simulation: no email is sent in this project.)`);
  };

  return (
    <section className="login-page" aria-label="Account access">
      <aside className="login-hero">
        <BallotIcon />
        <h2>Your Vote Matters</h2>
        <p>Participate in elections securely and make your voice count.</p>
      </aside>

      <div className="login-panel">
        {mode === 'login' && (
          <form className="card auth-card" onSubmit={submitLogin} noValidate>
            <p className="auth-brand">ONLINE VOTING SYSTEM</p>
            <h2>Welcome Back</h2>
            <p className="meta">Sign in to continue to your account.</p>

            {notice && <p className="msg ok" role="status">{notice}</p>}
            {errors.form && <p className="msg error" role="alert">{errors.form}</p>}

            <div className="field">
              <label htmlFor="role">Login as</label>
              <select id="role" value={login.role} onChange={(e) => setLogin({ ...login, role: e.target.value })}>
                <option value="voter">Voter</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Field label="Voter ID / Email" id="identifier" value={login.identifier} error={errors.identifier} autoComplete="username"
              onChange={(e) => setLogin({ ...login, identifier: e.target.value })} />
            <PasswordField label="Password" id="password" value={login.password} error={errors.password} autoComplete="current-password"
              onChange={(e) => setLogin({ ...login, password: e.target.value })} />

            <div className="row opts">
              <label className="check" htmlFor="remember">
                <input id="remember" type="checkbox" checked={login.remember} onChange={(e) => setLogin({ ...login, remember: e.target.checked })} />
                Remember Me
              </label>
              <button type="button" className="btn link" onClick={() => go('forgot')}>Forgot Password?</button>
            </div>

            <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'LOGIN'}</button>

            <p className="divider">Don't have an account?</p>
            <button type="button" className="btn block" onClick={() => go('register')}>Create Voter Account</button>

            <p className="secure"><LockIcon /> <span><strong>Secure Login</strong><small>Your account information is protected.</small></span></p>
            <p className="hint">Demo admin: admin@vote.com / admin123 (choose Admin)</p>
          </form>
        )}

        {mode === 'register' && (
          <form className="card auth-card" onSubmit={submitRegister} noValidate>
            <p className="auth-brand">ONLINE VOTING SYSTEM</p>
            <h2>Create Voter Account</h2>
            <p className="meta">Register once to take part in elections.</p>
            {errors.form && <p className="msg error" role="alert">{errors.form}</p>}
            <Field label="Full name" id="r-name" value={reg.name} error={errors.name} autoComplete="name" onChange={(e) => setReg({ ...reg, name: e.target.value })} />
            <Field label="Voter ID" id="r-voter" value={reg.voterId} error={errors.voterId} onChange={(e) => setReg({ ...reg, voterId: e.target.value })} />
            <Field label="Email" id="r-email" type="email" value={reg.email} error={errors.email} autoComplete="email" onChange={(e) => setReg({ ...reg, email: e.target.value })} />
            <Field label="Mobile number (optional)" id="r-phone" inputMode="numeric" value={reg.phone} error={errors.phone} autoComplete="tel" onChange={(e) => setReg({ ...reg, phone: e.target.value })} />
            <PasswordField label="Password" id="r-pass" value={reg.password} error={errors.password} autoComplete="new-password" onChange={(e) => setReg({ ...reg, password: e.target.value })} />
            <PasswordField label="Confirm password" id="r-confirm" value={reg.confirm} error={errors.confirm} autoComplete="new-password" onChange={(e) => setReg({ ...reg, confirm: e.target.value })} />
            <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
            <button type="button" className="btn link" onClick={() => go('login')}>Already registered? Log in</button>
          </form>
        )}

        {mode === 'forgot' && (
          <form className="card auth-card" onSubmit={submitForgot} noValidate>
            <p className="auth-brand">ONLINE VOTING SYSTEM</p>
            <h2>Forgot Password</h2>
            <p className="meta">Enter your Voter ID or email to receive reset instructions.</p>
            {notice && <p className="msg ok" role="status">{notice}</p>}
            <Field label="Voter ID / Email" id="f-id" value={forgot} error={errors.identifier} onChange={(e) => setForgot(e.target.value)} />
            <button className="btn primary block" type="submit">Send reset instructions</button>
            <button type="button" className="btn link" onClick={() => go('login')}>Back to login</button>
          </form>
        )}
      </div>
    </section>
  );
}