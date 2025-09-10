// src/TeacherDashboard.js
import React, { useEffect, useState } from 'react';
import { auth, database } from './firebase';
import { ref, push, set, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { Link } from 'react-router-dom';

export default function TeacherDashboard() {
  const [newGameName, setNewGameName] = useState('');
  const [myGames, setMyGames]       = useState([]);

  // Load games created by this teacher
  useEffect(() => {
    const gamesRef = query(
      ref(database, 'games'),
      orderByChild('createdBy'),
      equalTo(auth.currentUser.uid)
    );
    return onValue(gamesRef, snap => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, g]) => ({ id, ...g }));
      setMyGames(list);
    });
  }, []);

  // Create a new game with invite code
  const handleCreateGame = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newGameRef = push(ref(database, 'games'));
    const gameId = newGameRef.key;
    await set(newGameRef, {
      name: newGameName || `Game ${Date.now()}`,
      createdBy: auth.currentUser.uid,
      createdAt: Date.now(),
      currentRound: 0,
      state: 'trading',
      code
    });
    // map code to gameId for join
    await set(ref(database, `gamesByCode/${code}`), gameId);
    setNewGameName('');
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Teacher Dashboard</h2>

      {/* Create Game */}
      <div style={{ margin: '1em 0' }}>
        <input
          type="text"
          placeholder="New Game Name"
          value={newGameName}
          onChange={e => setNewGameName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button onClick={handleCreateGame}>Create Game</button>
      </div>

      <h3>My Games & Codes</h3>
      <ul>
        {myGames.map(game => (
          <li key={game.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
