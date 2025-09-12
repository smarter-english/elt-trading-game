// src/TeacherProfile.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';

export default function TeacherProfile() {
  const [user, setUser] = useState(null);
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setMsg('');
      if (!u) return;

      setEmail(u.email || '');

      // Prefill from RTDB profile if present; else from displayName
      const snap = await get(ref(database, `users/${u.uid}`));
      const profile = snap.val();
      if (profile?.firstName || profile?.lastName) {
        setFirst(profile.firstName || '');
        setLast(profile.lastName || '');
      } else if (u.displayName) {
        const parts = u.displayName.split(' ');
        setFirst(parts[0] || '');
        setLast(parts.slice(1).join(' ') || '');
      }
    });
    return unsub;
  }, []);

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <p>You need to be signed in as a teacher.</p>
        <button onClick={() => navigate('/teacher/login')}>Go to Teacher Login</button>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      const displayName = `${firstName} ${lastName}`.trim();
      await updateProfile(auth.currentUser, { displayName });
      await set(ref(database, `users/${user.uid}`), {
        firstName,
        lastName,
        role: 'teacher',
        email: email || user.email || ''
      });
      setMsg('Profile updated!');
    } catch (err) {
      setMsg(err?.message || 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '48px auto', padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>Teacher Profile</h2>
      <form onSubmit={handleSave}>
        <label>First name<br />
          <input value={firstName} onChange={e=>setFirst(e.target.value)} required style={{ width:'100%' }} />
        </label><br />
        <label>Last name<br />
          <input value={lastName} onChange={e=>setLast(e.target.value)} required style={{ width:'100%' }} />
        </label><br />
        <label>Email<br />
          <input value={email} disabled style={{ width:'100%', opacity: 0.7 }} />
        </label>
        <button type="submit" disabled={submitting} style={{ marginTop: 12, width: '100%' }}>
          {submitting ? 'Saving…' : 'Save profile'}
        </button>
        {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
      </form>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => navigate('/teacher/dashboard')}>Back to Dashboard</button>
      </div>
    </div>
  );
}