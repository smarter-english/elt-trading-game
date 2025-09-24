// src/TeacherLogin.js
import React, { useEffect, useState } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, database } from './firebase';
import { ref, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import BrandBar from './BrandBar';

export default function TeacherLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPw] = useState('');
  const [authed, setAuthed] = useState(!!auth.currentUser);
  const [role, setRole] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthed(!!u);
      if (u) {
        const off = onValue(ref(database, `users/${u.uid}`), (s) => {
          const v = s.val() || {};
          setRole(v.role || null);
        });
        return () => off();
      } else {
        setRole(null);
      }
    });
    return () => unsub();
  }, []);

  const withToast = (msg, ms = 1800) => {
    setToast(msg);
    setTimeout(() => setToast(''), ms);
  };

  const doLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      withToast('Logged in');
    } catch (e2) {
      withToast(e2?.message || 'Login failed', 2200);
    }
  };

  return (
    <>
      <BrandBar showLogout={authed} />

      <div className="toast-rail">
        <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
      </div>

      <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ marginTop: 8 }}>Teacher Login</h1>

        {authed ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: '#374151' }}>
              You are signed in{role ? ` as ${role}` : ''}.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={() => navigate('/teacher/dashboard')}>
                Go to Dashboard
              </button>
              <button className="btn" onClick={() => signOut(auth)}>
                Log Out
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={doLogin} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10 }}
            />
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPw(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10 }}
            />
            <button className="btn primary" type="submit">Log In</button>
            <div style={{ color: '#6b7280', fontSize: 14 }}>
              New teacher? Ask an admin to approve your account (or use the Apply page if enabled).
            </div>
          </form>
        )}
      </div>
    </>
  );
}