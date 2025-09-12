// src/TeacherDashboard.js
import React, { useEffect, useState } from 'react';
import { auth, database } from './firebase';
import {
  ref,
  push,
  set,
  query,
  orderByChild,
  equalTo,
  onValue,
} from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [newGameName, setNewGameName] = useState('');
  const [myGames, setMyGames] = useState([]);
  const navigate = useNavigate();

  // Track auth state so we can show the teacher’s name/email and query their games
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Load only this teacher's games once we have a user
  useEffect(() => {
    if (!user) return;
    const gamesRef = query(
      ref(database, 'games'),
      orderByChild('createdBy'),
      equalTo(user.uid)
    );
    return onValue(gamesRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, g]) => ({ id, ...g }));
      setMyGames(list);
    });
  }, [user]);

  const handleCreateGame = async () => {
    if (!user) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newGameRef = push(ref(database, 'games'));
    const gameId = newGameRef.key;

    await set(newGameRef, {
      name: newGameName || `Game ${Date.now()}`,
      createdBy: user.uid,
      createdAt: Date.now(),
      currentRound: 0,
      state: 'trading',
      code,
    });

    // map invite code → gameId
    await set(ref(database, `gamesByCode/${code}`), gameId);
    setNewGameName('');
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/teacher/login');
  };

  const userLabel = user?.displayName || user?.email || 'Teacher';

  return (
    <div style={{ padding: 20 }}>
      {/* Header with teacher identity + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>{userLabel}'s Dashboard</h2>
        <div>
          <button onClick={() => navigate('/teacher/login')} style={{ marginRight: 8 }}>
            Teacher Login
          </button>
          <button onClick={handleLogout}>Log out</button>
          <button onClick={() => navigate('/teacher/profile')} style={{ marginRight: 8 }}>Profile</button>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </div>

      {/* Create Game */}
      <div style={{ margin: '1em 0' }}>
        <input
          type="text"
          placeholder="New Game Name"
          value={newGameName}
          onChange={(e) => setNewGameName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button onClick={handleCreateGame} disabled={!user}>
          Create Game
        </button>
      </div>

      <h3>My Games & Codes</h3>
      <ul>
        {myGames.map((game) => (
          <li key={game.id} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong>{game.name}</strong>{' '}
                <small>(Code: {game.code})</small>
                <p style={{ margin: '4px 0' }}>Month {game.currentRound + 1}</p>
              </div>
              <Link to={`/teacher/game/${game.id}`}>
                <button>Manage Game</button>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}