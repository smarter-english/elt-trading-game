// src/TeacherApply.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, set } from 'firebase/database';

export default function TeacherApply() {
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const { uid } = cred.user;

      // Only write to users/{uid}; no teacherApplications write.
      await set(ref(database, `users/${uid}`), {
        firstName,
        lastName,
        email: email.trim(),
        role: 'pending_teacher',
        createdAt: Date.now(),
      });

      await signOut(auth);
      setMsg('Thanks! Your request has been submitted. An admin will approve your account.');
    } catch (err) {
      console.warn('Apply error:', err);
      setMsg(err?.message || 'Sign-up failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '48px auto',
        padding: 24,
        border: '1px solid #ddd',
        borderRadius: 8,
      }}
    >
      <h2>Apply for a Teacher Account</h2>
      <form onSubmit={handleSubmit}>
        <label>
          First name
          <br />
          <input
            value={firstName}
            onChange={(e) => setFirst(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>
        <br />
        <label>
          Last name
          <br />
          <input
            value={lastName}
            onChange={(e) => setLast(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>
        <br />
        <label>
          Email
          <br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>
        <br />
        <label>
          Password
          <br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPass(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>
        <button type="submit" disabled={submitting} style={{ marginTop: 12, width: '100%' }}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>
      {msg && <div style={{ marginTop: 12 }}>{msg}</div>}
      <div style={{ marginTop: 12 }}>
        <button onClick={() => navigate('/teacher/login')}>Back to Teacher Login</button>
      </div>
    </div>
  );
}
