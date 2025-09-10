// src/Lobby.js
import React, { useState } from 'react';
import { auth, database } from './firebase';
import { ref, get, set } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';

// Helper to turn teamName+gameId into a fake email
function makeEmail(teamName, gameId) {
  const safeName = teamName.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `${safeName}-${gameId}@eltgame.local`;
}

export default function Lobby() {
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [error, setError] = useState('');

  const handleJoinByCode = async () => {
    setError('');
    console.log('JoinByCode invoked', { codeInput, teamName, teamPassword });

    if (!codeInput || !teamName || !teamPassword) {
      setError('Please enter game code, team name & password.');
      console.warn('Missing field(s)');
      return;
    }

    let credential;
    try {
      // Step A: Provisional auth using codeInput in email
      const provisionalEmail = makeEmail(teamName, codeInput);
      console.log('Provisional email:', provisionalEmail);

      try {
        credential = await createUserWithEmailAndPassword(
          auth,
          provisionalEmail,
          teamPassword
        );
        console.log('Created provisional user:', credential.user.uid);
      } catch (e) {
        console.log('Provisional sign-up failed:', e.code);
        if (e.code === 'auth/email-already-in-use') {
          credential = await signInWithEmailAndPassword(
            auth,
            provisionalEmail,
            teamPassword
          );
          console.log('Signed in provisional user:', credential.user.uid);
        } else {
          throw e;
        }
      }

      // Wait for auth.currentUser to update
      await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => {
          if (u && u.uid === credential.user.uid) {
            console.log('Auth state ready for UID:', u.uid);
            unsub();
            resolve();
          }
        });
      });
    } catch (e) {
      console.error('Auth error before game lookup:', e.code, e.message);
      setError('Authentication failed: ' + e.message);
      return;
    }

    console.log('Authenticated user ready:', auth.currentUser.uid);

    let gameId;
    try {
      // Step B: Lookup gameId by code
      const codeRef = `gamesByCode/${codeInput}`;
      console.log('Looking up code at:', codeRef);
      const snap = await get(ref(database, codeRef));
      if (!snap.exists()) {
        setError('Invalid game code');
        console.warn('Code lookup failed:', codeInput);
        return;
      }
      gameId = snap.val();
      console.log('Code maps to gameId:', gameId);
    } catch (e) {
      console.error('Error reading gamesByCode:', e);
      setError('Could not look up game code.');
      return;
    }

    try {
      // Step C: If provisional codeInput ≠ actual gameId, re-auth
      const finalEmail = makeEmail(teamName, gameId);
      if (!auth.currentUser.email.startsWith(gameId)) {
        console.log('Re-auth with correct email:', finalEmail);
        // Try sign-in / sign-up again against finalEmail
        try {
          credential = await signInWithEmailAndPassword(
            auth,
            finalEmail,
            teamPassword
          );
          console.log('Re-signed in final user:', credential.user.uid);
        } catch (e) {
          console.log('Final sign-in failed, creating account:', e.code);
          credential = await createUserWithEmailAndPassword(
            auth,
            finalEmail,
            teamPassword
          );
          console.log('Created final user:', credential.user.uid);
        }
        // Wait for auth
        await new Promise((resolve) => {
          const unsub = onAuthStateChanged(auth, (u) => {
            if (u && u.uid === credential.user.uid) {
              console.log('Auth state ready for final UID:', u.uid);
              unsub();
              resolve();
            }
          });
        });
      }
    } catch (e) {
      console.error('Re-auth error:', e.code, e.message);
      setError('Re-authentication failed');
      return;
    }

    const uid = auth.currentUser.uid;
    console.log('Final authenticated UID:', uid);

    try {
      // Step D: Write team record
      const teamRefPath = `games/${gameId}/teams/${uid}`;
      console.log('Writing team record to:', teamRefPath);
      await set(ref(database, teamRefPath), {
        teamName,
        teamPassword,
        joinedAt: Date.now(),
      });
      console.log('Team record write succeeded');

      console.log('Navigating to /game/' + gameId);
      navigate(`/game/${gameId}`);
    } catch (e) {
      console.error('DB write error:', e.code, e.message);
      setError('Failed to join game: ' + e.message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: 'auto', padding: 16 }}>
      <h2>Join Game by Code</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input
        value={codeInput}
        placeholder="Game code"
        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
      />
      <input
        style={{ marginTop: 8 }}
        value={teamName}
        placeholder="Team Name"
        onChange={(e) => setTeamName(e.target.value)}
      />
      <input
        style={{ marginTop: 8 }}
        type="password"
        value={teamPassword}
        placeholder="Team Password"
        onChange={(e) => setTeamPassword(e.target.value)}
      />
      <button onClick={handleJoinByCode} style={{ marginTop: 12 }}>
        Join Game
      </button>
    </div>
  );
}