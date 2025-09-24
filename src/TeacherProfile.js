// src/TeacherProfile.js
import React, { useEffect, useState } from 'react';
import { auth, database } from './firebase';
import { ref, onValue, update } from 'firebase/database';
import BrandBar from './BrandBar';

export default function TeacherProfile() {
  const uid = auth.currentUser?.uid || null;

  const [email, setEmail] = useState('');
  const [firstName, setFn] = useState('');
  const [lastName, setLn] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!uid) return;
    return onValue(ref(database, `users/${uid}`), (snap) => {
      const v = snap.val() || {};
      setEmail(v.email || auth.currentUser?.email || '');
      setFn(v.firstName || '');
      setLn(v.lastName || '');
    });
  }, [uid]);

  const withToast = (msg, ms = 1800) => {
    setToast(msg);
    setTimeout(() => setToast(''), ms);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    try {
      await update(ref(database, `users/${uid}`), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email || auth.currentUser?.email || '',
        updatedAt: Date.now(),
      });
      withToast('Profile updated');
    } catch (e2) {
      console.warn(e2);
      withToast('Save failed', 2200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <BrandBar showLogout />

      <div className="toast-rail">
        <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
      </div>

      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ marginTop: 8 }}>Teacher Profile</h1>

        {!uid ? (
          <p>Please log in.</p>
        ) : (
          <form onSubmit={save} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Email</div>
              <input
                type="email"
                value={email}
                readOnly
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb' }}
              />
            </label>

            <label>
              <div style={{ fontSize: 12, color: '#6b7280' }}>First name</div>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFn(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10 }}
              />
            </label>

            <label>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Last name</div>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLn(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10 }}
              />
            </label>

            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}
      </div>
    </>
  );
}