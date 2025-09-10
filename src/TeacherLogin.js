// src/TeacherLogin.js
import React, { useState } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function TeacherLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw]       = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      nav('/teacher/dashboard', { replace: true });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ maxWidth: 320, margin: 'auto', padding: 16 }}>
      <h2>Teacher Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 8 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={pw}
        onChange={e => setPw(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 16 }}
      />
      <button onClick={handleLogin} style={{ width: '100%' }}>
        Log In
      </button>
    </div>
  );
}