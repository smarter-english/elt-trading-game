// src/Lobby.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { ref, get, set } from 'firebase/database';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth';
import BrandBar from './BrandBar';

const NAME_REGEX = /^[A-Za-z0-9 ._\-]{1,20}$/; // keep in sync with DB rules
const CODE_REGEX = /^[A-Z]{6}$/;               // letters only

// Normalize for matching (case/space-insensitive), but keep original for display
function normalizeName(s) {
  return String(s).trim().replace(/\s+/g, ' ').toLowerCase();
}
function cleanTeamName(s) {
  return String(s).trim().replace(/\s+/g, ' ').slice(0, 20);
}

// Fallback email generator (used on first creation only)
function makeEmail(teamName, gameId) {
  const safe = String(teamName).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'team';
  return `${safe}--${gameId}@eltgame.local`;
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
    if (busy) return;

    setMsg('');
    const code = codeInput.trim().toUpperCase();
    const enteredName = cleanTeamName(teamName);
    const pass = teamPassword.trim();

    if (!CODE_REGEX.test(code)) return setMsg('Invalid code. Use 6 letters (A–Z).');
    if (!NAME_REGEX.test(enteredName)) return setMsg('Team name: 1–20 chars, letters/numbers/spaces/._- only.');
    if (pass.length < 3 || pass.length > 20) return setMsg('Password must be 3–20 characters.');

    setBusy(true);
    try {
      // 1) Code → gameId (public read)
      const codeSnap = await get(ref(database, `gamesByCode/${code}`));
      if (!codeSnap.exists()) {
        setMsg('Game code not found.');
        return;
      }
      const gameId = codeSnap.val();

      // 2) Ensure we're authenticated BEFORE reading teams
      //    (rules typically require auth != null to read /games/{id}/teams)
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (anonErr) {
          // Most likely Anonymous sign-in not enabled
          setMsg('Login setup error. Please ask your teacher to enable Anonymous sign-in.');
          console.warn('Anonymous sign-in failed:', anonErr);
          return;
        }
      }

      // 3) Read teams and try to find existing by normalized name
      const teamsSnap = await get(ref(database, `games/${gameId}/teams`));
      const normEntered = normalizeName(enteredName);

      let existing = null;
      if (teamsSnap.exists()) {
        const teamsVal = teamsSnap.val() || {};
        for (const [uid, t] of Object.entries(teamsVal)) {
          const tName = t?.teamName || '';
          if (normalizeName(tName) === normEntered) {
            existing = { uid, ...t };
            break;
          }
        }
      }

      if (existing) {
        // 4A) Existing team: sign in using stored loginEmail (don’t touch status)
        const loginEmail = existing.loginEmail || makeEmail(existing.teamName || enteredName, gameId);
        try {
          await signInWithEmailAndPassword(auth, loginEmail, pass);
        } catch (err) {
          setMsg('Wrong password for this team name.');
          return;
        }
        navigate(`/game/${gameId}`);
        return;
      }

      // 4B) New team: create account + team node with status: "pending" (one-time)
      const newEmail = makeEmail(enteredName, gameId);
      await createUserWithEmailAndPassword(auth, newEmail, pass);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Auth failed. Please try again.');

      await set(ref(database, `games/${gameId}/teams/${uid}`), {
        teamName: enteredName,
        teamPassword: pass,   // classroom use only
        loginEmail: newEmail, // stable re-login key
        joinedAt: Date.now(),
        status: 'pending',
      });

      navigate(`/game/${gameId}`);
    } catch (err) {
      console.error('Join error details', {
        codeInput,
        teamName: enteredName,
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
          Enter the 6-letter code your teacher gave you, then choose a team name and password.
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
              placeholder="Game code (e.g. ABCDEF)"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              inputMode="latin"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
              required
            />

            <input
              aria-label="Team name"
              placeholder="Team name (max 20 chars)"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={20}
              autoComplete="off"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
              required
            />

            <input
              aria-label="Team password"
              type="password"
              placeholder="Team password (3–20 chars)"
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

        <p style={{ marginTop: 10, color: '#6b7280', fontSize: 12 }}>
          If your team already exists, enter the same team name and password to continue. New teams
          will appear as <strong>pending</strong> until the teacher approves them.
        </p>
      </div>
    </div>
  );
}