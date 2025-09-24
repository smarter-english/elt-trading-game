// src/TeacherDashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ref,
  push,
  set,
  onValue,
  query,
  orderByChild,
  equalTo,
} from 'firebase/database';
import BrandBar from './BrandBar';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(n = 6) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const [uid, setUid] = useState(auth.currentUser?.uid || null);
  const [profile, setProfile] = useState(null);
  const displayName = useMemo(() => {
    if (!profile) return '';
    if (profile.firstName || profile.lastName)
      return `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    return profile.displayName || profile.email || '';
  }, [profile]);

  const [games, setGames] = useState([]); // [{id, name, code, createdAt, teamCount}]
  const [newGameName, setNewGameName] = useState('');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  // Auth + profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid || null);
      if (u?.uid) {
        onValue(ref(database, `users/${u.uid}`), (snap) => {
          setProfile(snap.val() || { email: u.email || '' });
        });
      } else {
        setProfile(null);
      }
    });
    return () => unsub();
  }, []);

  // Load games created by this teacher
  useEffect(() => {
    if (!uid) return;
    const q = query(ref(database, 'games'), orderByChild('createdBy'), equalTo(uid));
    const off = onValue(q, (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, g]) => {
        const teams = g.teams ? Object.keys(g.teams).length : 0;
        return {
          id,
          name: g.name || '(unnamed)',
          code: g.code,
          createdAt: g.createdAt || 0,
          teamCount: teams,
        };
      });
      // newest first
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setGames(list);
    });
    return () => off();
  }, [uid]);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast('Code copied!');
      setTimeout(() => setToast(''), 1500);
    } catch {
      setToast('Copy failed');
      setTimeout(() => setToast(''), 1500);
    }
  };

  const createGame = async (e) => {
    e.preventDefault();
    if (!uid) return;
    setCreating(true);
    try {
      const code = makeCode(6);
      const gamesRef = ref(database, 'games');
      const newRef = push(gamesRef);
      const gameId = newRef.key;

      const payload = {
        name: newGameName.trim() || `My Game ${new Date().toLocaleDateString()}`,
        createdBy: uid,
        createdAt: Date.now(),
        code,
        currentRound: 0,
        state: 'play', // or 'review'
      };

      await set(newRef, payload);
      await set(ref(database, `gamesByCode/${code}`), gameId);

      setNewGameName('');
      setToast(`Game created. Code: ${code}`);
      setTimeout(() => setToast(''), 2000);

      // Jump into the game management page
      navigate(`/teacher/game/${gameId}`);
    } catch (err) {
      console.warn('Create game failed', err);
      setToast('Failed to create game');
      setTimeout(() => setToast(''), 2000);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <BrandBar showLogout />

      {/* Toast rail (fixed height, no layout shift) */}
      <div className="toast-rail">
        <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
      </div>

      <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ margin: '8px 0 4px' }}>
          {displayName ? `${displayName}'s Dashboard` : 'Teacher Dashboard'}
        </h1>
        <p style={{ color: '#6b7280', margin: '0 0 16px' }}>
          Create a new game and manage existing ones.
        </p>

        {/* Create Game */}
        <form
          onSubmit={createGame}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            margin: '12px 0 20px',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            placeholder="Game name (e.g., 3A Friday)"
            value={newGameName}
            onChange={(e) => setNewGameName(e.target.value)}
            style={{
              flex: '1 1 280px',
              minWidth: 240,
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              fontSize: 16,
            }}
          />
          <button
            type="submit"
            disabled={creating || !uid}
            className="btn primary"
            style={{ height: 42 }}
          >
            {creating ? 'Creating…' : 'Create Game'}
          </button>
        </form>

        {/* Games list */}
        {games.length === 0 ? (
          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 12,
              padding: 16,
              color: '#6b7280',
            }}
          >
            No games yet. Create your first game above.
          </div>
        ) : (
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <table className="trade-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 8px' }}>Name</th>
                  <th style={{ padding: '10px 8px' }}>Code</th>
                  <th style={{ padding: '10px 8px' }}>Teams</th>
                  <th style={{ padding: '10px 8px' }} />
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td style={{ padding: '8px' }}>{g.name}</td>
                    <td style={{ padding: '8px' }}>
                      <code
                        style={{
                          background: '#f3f4f6',
                          padding: '2px 6px',
                          borderRadius: 6,
                          fontWeight: 600,
                        }}
                      >
                        {g.code}
                      </code>
                      <button
                        type="button"
                        className="btn"
                        style={{ marginLeft: 8, padding: '4px 8px' }}
                        onClick={() => copy(g.code)}
                        aria-label="Copy code"
                        title="Copy code"
                      >
                        Copy
                      </button>
                    </td>
                    <td style={{ padding: '8px' }}>{g.teamCount}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <button
                        className="btn primary"
                        onClick={() => navigate(`/teacher/game/${g.id}`)}
                      >
                        Manage Game
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}