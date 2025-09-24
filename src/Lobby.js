// src/Lobby.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { ref, get, set, runTransaction } from 'firebase/database';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';
import BrandBar from './BrandBar';

// Helper to turn teamName + seed into a stable “fake” email under our domain
function makeEmail(teamName, seed) {
  const safe = String(teamName).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'team';
  return `${safe}-${seed}@eltgame.local`;
}

export default function Lobby() {
  const navigate = useNavigate();

  const [codeInput, setCodeInput] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const joinByCode = async (e) => {
    e.preventDefault();
    setMsg('');
    if (busy) return;

    const code = codeInput.trim().toUpperCase();
    const name = teamName.trim();
    const pass = teamPassword.trim();

    // Basic client validation (aligns with DB rules)
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setMsg('Invalid code. Use 6 letters/numbers.');
      return;
    }
    if (name.length < 2) {
      setMsg('Team name must be at least 2 characters.');
      return;
    }
    if (pass.length < 3 || pass.length > 20) {
      setMsg('Password must be 3–20 characters.');
      return;
    }

    setBusy(true);
    try {
      console.log('JoinByCode invoked', { code, teamName: name });

      // 1) Provisional auth (required because gamesByCode is auth-protected)
      const provisionalEmail = makeEmail(name, code);
      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, provisionalEmail, pass);
        console.log('Created provisional user:', cred.user.uid);
      } catch (err) {
        if (err?.code === 'auth/email-already-in-use') {
          cred = await signInWithEmailAndPassword(auth, provisionalEmail, pass);
          console.log('Signed in provisional user:', cred.user.uid);
        } else {
          throw err;
        }
      }

      // Wait for auth to settle
      await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => {
          if (u && u.uid === cred.user.uid) {
            console.log('Auth state ready for UID:', u.uid);
            unsub();
            resolve();
          }
        });
      });

      // 2) Lookup gameId by code (now that we’re authed)
      const codeSnap = await get(ref(database, `gamesByCode/${code}`));
      if (!codeSnap.exists()) {
        setMsg('Game code not found.');
        return;
      }
      const gameId = codeSnap.val();
      console.log('Code maps to gameId:', gameId);

      // 3) Write team record with ONLY rule-allowed fields
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not authenticated.');
      const teamRef = ref(database, `games/${gameId}/teams/${uid}`);

      await set(teamRef, {
        teamName: name,
        teamPassword: pass,    // allowed by your rules
        joinedAt: Date.now(),
      });
      console.log('Team record write succeeded');

      // 4) Ensure starting portfolio exists
      const pfRef = ref(database, `games/${gameId}/portfolios/${uid}`);
      await runTransaction(pfRef, (curr) => {
        if (curr) return curr;
        return { cash: 10000, creditCap: 5000, positions: {} };
      });

      // 5) Go to the game
      navigate(`/game/${gameId}`);
    } catch (err) {
      console.error('Join error details', {
        codeInput: codeInput,
        teamName,
        teamPassword: '***',
        authUid: auth.currentUser?.uid || null,
        error: err?.code || err?.message || String(err),
      });
      setMsg(`Failed to join game: ${err?.message || 'Permission denied'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <BrandBar />

      <div style={{ maxWidth: 420, margin: '24px auto', padding: '0 12px' }}>
        <h2 style={{ margin: '0 0 12px' }}>Join Game</h2>
        <p style={{ margin: '0 0 16px', color: '#6b7280' }}>
          Enter the 6-character code your teacher gave you, choose a team name and password.
        </p>

        {msg && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '8px 10px',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {msg}
          </div>
        )}

        <form onSubmit={joinByCode}>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              aria-label="Game code"
              placeholder="Game code (e.g. ABC123)"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
              required
            />
            <input
              aria-label="Team name"
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={30}
              autoComplete="off"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
              required
            />
            <input
              aria-label="Team password"
              type="password"
              placeholder="Team password"
              value={teamPassword}
              onChange={(e) => setTeamPassword(e.target.value)}
              minLength={3}
              maxLength={20}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
              required
            />

            <button
              type="submit"
              disabled={busy}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #2563eb',
                background: busy ? '#93c5fd' : '#3b82f6',
                color: 'white',
                fontWeight: 600,
              }}
            >
              {busy ? 'Joining…' : 'Join Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}