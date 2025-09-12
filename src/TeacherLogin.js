// src/TeacherLogin.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { ref, get } from 'firebase/database';

export default function TeacherLogin() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [user, setUser]                 = useState(null);
  const [isTeacher, setIsTeacher]       = useState(false);
  const [checkingTeacher, setChecking]  = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsTeacher(false);
      setError('');
      if (u) {
        setChecking(true);
        try {
          const snap = await get(ref(database, `admins/${u.uid}`));
          setIsTeacher(snap.val() === true);
        } finally {
          setChecking(false);
        }
      }
    });
    return unsub;
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // success falls through to onAuthStateChanged → shows welcome bar
    } catch (err) {
      setError(err?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setEmail('');
    setPassword('');
    setIsTeacher(false);
  };

  // If you'd prefer an automatic redirect when teacher is detected, uncomment:
  // useEffect(() => {
  //   if (user && isTeacher) navigate('/teacher/dashboard', { replace: true });
  // }, [user, isTeacher, navigate]);

  return (
    <div style={{ maxWidth: 420, margin: '48px auto', padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>Teacher sign in</h2>

      {user && (
        <div style={{ background: '#f6f9fe', border: '1px solid #cfe3ff', padding: 12, borderRadius: 6, margin: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <strong>Welcome{isTeacher ? ' (teacher)' : ''}!</strong>
              <div style={{ fontSize: 13, color: '#555' }}>{user.email}</div>
              {!isTeacher && !checkingTeacher && (
                <div style={{ color: '#b00020', marginTop: 6 }}>
                  This account is not marked as a teacher/admin.
                </div>
              )}
            </div>
            <div>
              <button
                onClick={() => navigate('/teacher/dashboard')}
                disabled={!isTeacher}
                style={{ marginRight: 8 }}
              >
                Go to dashboard
              </button>
              <button onClick={handleLogout}>Log out</button>
            </div>
          </div>
        </div>
      )}

      {!user && (
        <form onSubmit={handleLogin}>
          <label>
            Email<br />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={{ width: '100%' }}
            />
          </label>
          <br />
          <label>
            Password<br />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </label>
          {error && <div style={{ color: '#b00020', marginTop: 8 }}>{error}</div>}
          <button type="submit" disabled={submitting} style={{ marginTop: 12, width: '100%' }}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
    </div>
  );
}