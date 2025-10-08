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
    <div className="page-narrow panel">
      <h2>Apply for a Teacher Account</h2>
      <form className="form-vertical" onSubmit={handleSubmit}>
        <label>
          <span>First name</span>
          <input value={firstName} onChange={(e) => setFirst(e.target.value)} required />
        </label>

        <label>
          <span>Last name</span>
          <input value={lastName} onChange={(e) => setLast(e.target.value)} required />
        </label>

        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPass(e.target.value)} required />
        </label>

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {msg && <div className="notice">{msg}</div>}

      <div className="actions-row">
        <button className="btn" onClick={() => navigate('/teacher/login')}>Back to Teacher Login</button>
      </div>
    </div>
  );
}