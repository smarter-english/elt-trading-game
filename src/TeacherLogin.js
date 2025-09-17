// src/TeacherLogin.js
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { ref, onValue } from 'firebase/database';

export default function TeacherLogin() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const [user, setUser]             = useState(null);
  const [role, setRole]             = useState(null); // 'admin' | 'teacher' | 'pending_teacher' | 'student' | null
  const [profile, setProfile]       = useState(null);
  const [loadingRole, setLoadingRole] = useState(false);

  const navigate = useNavigate();
  const navOnceRef = useRef(false); // guard against accidental multiple navigations

  useEffect(() => {
    let offProfile = () => {};
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setError('');
      setRole(null);
      setProfile(null);
      if (u) {
        setLoadingRole(true);
        const profRef = ref(database, `users/${u.uid}`);
        offProfile = onValue(
          profRef,
          (snap) => {
            const p = snap.val() || null;
            setProfile(p);
            setRole(p?.role || null);
            setLoadingRole(false);
          },
          () => setLoadingRole(false)
        );
      }
    });
    return () => {
      unsub();
      offProfile();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged will populate user/role
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
    navOnceRef.current = false; // reset guard on logout
  };

  const isAdmin   = role === 'admin';
  const isTeacher = role === 'teacher' || isAdmin;
  const isPending = role === 'pending_teacher';
  const userLabel =
    (profile?.firstName || profile?.lastName)
      ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
      : (user?.displayName || user?.email || 'Teacher');

  // ⛔ Removed auto-redirect effect to avoid loops in StrictMode/onValue churn

  const handleGoDashboard = () => {
    if (!isTeacher) return;
    if (navOnceRef.current) return; // guard multiple calls
    navOnceRef.current = true;
    console.log('[TeacherLogin] Navigating to /teacher/dashboard for role:', role);
    navigate('/teacher/dashboard'); // no replace → avoids replaceState spam
  };

  return (
    <div style={{ maxWidth: 420, margin: '48px auto', padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>Teacher sign in</h2>

      {user && (
        <div style={{ background: '#f6f9fe', border: '1px solid #cfe3ff', padding: 12, borderRadius: 6, margin: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <strong>
                Welcome{isTeacher ? ' (teacher)' : isPending ? ' (pending approval)' : ''}!
              </strong>
              <div style={{ fontSize: 13, color: '#555' }}>
                {userLabel} • {user?.email}
              </div>

              {!loadingRole && !isTeacher && !isPending && (
                <div style={{ color: '#b00020', marginTop: 6 }}>
                  This account is not a teacher. If you applied, please wait for approval.
                </div>
              )}
              {!loadingRole && isPending && (
                <div style={{ color: '#9a6b00', marginTop: 6 }}>
                  Your teacher account is pending approval by an admin.
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={handleGoDashboard}
                disabled={!isTeacher}
                style={{ marginRight: 8 }}
              >
                Go to dashboard
              </button>
              <button type="button" onClick={handleLogout}>Log out</button>
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

          <div style={{ marginTop: 8 }}>
            New teacher?{' '}
            <button
              type="button"
              onClick={() => navigate('/teacher/apply')}
              style={{ background: 'none', border: 'none', color: '#06f', cursor: 'pointer', padding: 0 }}
            >
              Apply here
            </button>
          </div>
        </form>
      )}
    </div>
  );
}