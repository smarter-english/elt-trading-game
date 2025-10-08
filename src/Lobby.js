import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, database } from './firebase';
import { ref, get, set } from 'firebase/database';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth';
import BrandBar from './BrandBar';

const NAME_REGEX = /^[A-Za-z0-9 ._\-]{1,20}$/;
const CODE_REGEX = /^[A-Z]{6}$/;

function normalizeName(s) { return String(s).trim().replace(/\s+/g, ' ').toLowerCase(); }
function cleanTeamName(s) { return String(s).trim().replace(/\s+/g, ' ').slice(0, 20); }
function makeEmail(teamName, gameId) {
  const safe = String(teamName).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'team';
  return `${safe}--${gameId}@eltgame.local`;
}

export default function Lobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const teamInputRef = useRef(null);

  const [codeInput, setCodeInput] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = (params.get('code') || '').toUpperCase();
    const code = raw.replace(/[^A-Z]/g, '');
    if (CODE_REGEX.test(code)) {
      setCodeInput(code);
      setTimeout(() => teamInputRef.current?.focus(), 0);
    }
  }, [location.search]);

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
      const codeSnap = await get(ref(database, `gamesByCode/${code}`));
      if (!codeSnap.exists()) {
        setMsg('Game code not found.');
        return;
      }
      const gameId = codeSnap.val();

      if (!auth.currentUser) {
        try { await signInAnonymously(auth); }
        catch (anonErr) {
          setMsg('Login setup error. Ask your teacher to enable Anonymous sign-in.');
          console.warn('Anonymous sign-in failed:', anonErr);
          return;
        }
      }

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
        const loginEmail = existing.loginEmail || makeEmail(existing.teamName || enteredName, gameId);
        try { await signInWithEmailAndPassword(auth, loginEmail, pass); }
        catch { setMsg('Wrong password for this team name.'); return; }
        navigate(`/game/${gameId}`);
        return;
      }

      const newEmail = makeEmail(enteredName, gameId);
      await createUserWithEmailAndPassword(auth, newEmail, pass);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Auth failed. Please try again.');

      await set(ref(database, `games/${gameId}/teams/${uid}`), {
        teamName: enteredName,
        teamPassword: pass,
        loginEmail: newEmail,
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
      <div className="page-narrow">
        <h2>Join Game</h2>
        <p className="muted">
          Enter the 6-letter code your teacher gave you, then choose a team name and password.
        </p>

        {msg && <div className="notice">{msg}</div>}

        <form className="form-vertical" onSubmit={joinByCode}>
          <input
            aria-label="Game code"
            placeholder="Game code (e.g. ABCDEF)"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            maxLength={6}
            autoComplete="off"
            inputMode="latin"
            required
          />

          <input
            ref={teamInputRef}
            aria-label="Team name"
            placeholder="Team name (max 20 chars)"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            maxLength={20}
            autoComplete="off"
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
            required
          />

          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Joining…' : 'Join Game'}
          </button>
        </form>

        <p className="muted small">
          If your team already exists, enter the same team name and password to continue. New teams
          will appear as <strong>pending</strong> until the teacher approves them.
        </p>
      </div>
    </div>
  );
}