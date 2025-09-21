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

const DEBUG_LOGIN = false;

export default function TeacherLogin() {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');

  const [user, setUser]               = useState(null);
  const [role, setRole]               = useState(null); // 'admin' | 'teacher' | 'pending_teacher' | 'student' | null
  const [profile, setProfile]         = useState(null);
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
      setLoadingRole(false);

      if (DEBUG_LOGIN) console.log('[TeacherLogin] auth state:', u?.uid || null);

      // Clean up any prior listener
      offProfile();

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
            if (DEBUG_LOGIN) console.log('[TeacherLogin] role loaded:', p?.role);
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
      if (DEBUG_LOGIN) console.warn('[TeacherLogin] login error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } finally {
      setEmail('');
      setPassword('');
      navOnceRef.current = false; // reset guard on logout
    }
  };

  const isAdmin   = role === 'admin';
  const isTeacher = role === 'teacher' || isAdmin;
  const isPending = role === 'pending_teacher';
  const userLabel =
    (profile?.firstName || profile?.lastName)
      ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
      : (user?.displayName || user?.email || 'Teacher');

  // ⛔ Stay passive: no auto-redirect here

  const handleGoDashboard = () => {
    if (!isTeacher || loadingRole) return;
    if (navOnceRef.current) return; // guard multiple calls
    navOnceRef.current = true;
    if (DEBUG_LOGIN) console.log('[TeacherLogin] Navigating to /teacher/dashboard for role:', role);
    navigate('/teacher/dashboard'); // no replace → avoids replaceState spam in Safari
  };

  return (
    <div style={{ maxWidth: 460, margin: '48px auto', padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Teacher sign in</h2>

      {user && (
        <div
          style={{
            background: '#f6f9fe',
            border: '1px solid #cfe3ff',
            padding: 12,
            borderRadius: 6,
            margin: '12px 0'
          }}
          aria-live="polite"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <strong>
                Welcome{isTeacher ? ' (teacher)' : isPending ? ' (pending approval)' : ''}!
              </strong>
              <div style={{ fontSize: 13, color: '#555' }}>
                {userLabel} • {user?.email}
              </div>

              {loadingRole && (
                <div style={{ color: '#555', marginTop: 6 }}>
                  Checking your permissions…
                </div>
              )}

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
                disabled={!isTeacher || loadingRole}
                style={{ marginRight: 8 }}
                title={!isTeacher ? 'Teacher/admin access required' : undefined}
              >
                Go to dashboard
              </button>
              <button type="button" onClick={handleLogout}>Log out</button>
            </div>
          </div>
        </div>
      )}

      {!user && (
        <form onSubmit={handleLogin} noValidate>
          <label>
            Email<br />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={{ width: '100%' }}
              autoComplete="username"
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
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div style={{ color: '#b00020', marginTop: 8 }} role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{ marginTop: 12, width: '100%' }}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <div style={{ marginTop: 8 }}>
            New teacher?{' '}
            <button
              type="button"
              onClick={() => navigate('/teacher/apply')}
              style={{ background: 'none', border: 'none', color: '#06f', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Apply here
            </button>
          </div>
        </form>
      )}
    </div>
  );
}