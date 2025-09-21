// src/TeacherGamePage.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from './firebase';
import { ref, onValue, get, update, runTransaction } from 'firebase/database';
import ReviewTable from './ReviewTable';

const CREDIT_MULTIPLIER = 0.5;

// 🔹 Normalize names so "Crude oil" == "Crude Oil" == "crude-oil"
const normName = (s) =>
  (s || '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

export default function TeacherGamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [headlines, setHeadlines] = useState([]);
  const [loadingHL, setLoadingHL] = useState(true);
  const [revealed, setRevealed] = useState({});

  // Subscribe to game metadata (state/round/name can change live)
  useEffect(() => {
    const gameRef = ref(database, `games/${gameId}`);
    return onValue(gameRef, (snap) => setGame(snap.val()));
  }, [gameId]);

  // One-time fetch headlines whenever the round changes (constants don't need live listeners)
  useEffect(() => {
    if (!game) return;
    setLoadingHL(true);
    setRevealed({}); // reset reveal toggles each month

    let alive = true;
    (async () => {
      const snap = await get(ref(database, `constants/headlines/${game.currentRound}`));
      const data = snap.val();
      const list = Array.isArray(data) ? data : data ? Object.values(data) : [];
      if (alive) {
        setHeadlines(list);
        setLoadingHL(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [game?.currentRound, game]); // re-run when month changes

  if (!game) return <p>Loading game…</p>;

  const { currentRound, state } = game;

  // Build map of revealed effects => { [normalizedCommodityName]: 'up'|'down' }
  const revealedMap = {};
  Object.entries(revealed).forEach(([idx, isOn]) => {
    if (isOn && Array.isArray(headlines[idx]?.effects)) {
      const eff = headlines[idx].effects[0];
      if (eff?.commodity && eff?.change) {
        revealedMap[normName(eff.commodity)] = eff.change;
      }
    }
  });

  // Advance round and liquidate portfolios, then return to trading
  const handleAdvance = async () => {
    const nextRound = currentRound + 1;

    // 1) flip to next month + ensure trading state
    await update(ref(database, `games/${gameId}`), {
      currentRound: nextRound,
      state: 'trading'
    });

    // 2) fetch all portfolios (one-time)
    const pfSnap = await get(ref(database, `games/${gameId}/portfolios`));
    const portfolios = pfSnap.val() || {};

    // 3) fetch commodity data (one-time)
    const commSnap = await get(ref(database, 'constants/commodities'));
    const raw = commSnap.val() || {};
    const commodities = Array.isArray(raw)
      ? raw.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
      : Object.entries(raw).map(([id, c]) => ({ id, ...c }));

    // 4) liquidate each portfolio at *next* round prices and reset creditCap
    for (const [uid] of Object.entries(portfolios)) {
      await runTransaction(ref(database, `games/${gameId}/portfolios/${uid}`), (curr) => {
        if (!curr) return curr;
        let newCash = curr.cash || 0;
        const pos = curr.positions || {};
        Object.entries(pos).forEach(([cid, qty]) => {
          const comm = commodities.find((c) => c.id === cid);
          const price = comm?.prices?.[nextRound] ?? 0;
          newCash += qty * price;
        });
        return {
          cash: newCash,
          positions: {},
          creditCap: newCash * CREDIT_MULTIPLIER
        };
      });
    }
  };

  // Toggle review <-> play (no round change)
  const handleToggleReview = async () => {
    await update(ref(database, `games/${gameId}`), {
      state: state === 'review' ? 'trading' : 'review'
    });
  };

  const toggleReveal = (idx) => {
    setRevealed((r) => ({ ...r, [idx]: !r[idx] }));
  };

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => navigate('/teacher/dashboard')}>&larr; Back to Dashboard</button>
      <h2>Game: {game?.name}</h2>
      <p>
        Month {currentRound + 1} &bull; State: <em>{state}</em>
      </p>

      {/* Headlines: list during trading; table with reveal during review */}
      {state !== 'review' ? (
        <div style={{ border: '1px solid #ccc', padding: 12, margin: '1em 0' }}>
          {loadingHL ? (
            <span>Loading headlines…</span>
          ) : headlines.length ? (
            <ul>{headlines.map((h, i) => <li key={i}>{h.text}</li>)}</ul>
          ) : (
            <span>No headlines this round.</span>
          )}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '1em 0' }}>
          <thead>
            <tr>
              <th>Headline</th>
              <th>Commodity</th>
              <th>Price Change</th>
              <th>Reveal</th>
            </tr>
          </thead>
          <tbody>
            {headlines.map((h, idx) => {
              const isRevealed = !!revealed[idx];
              const effect = Array.isArray(h.effects) ? h.effects[0] : {};
              const commodity = effect.commodity || '---';
              const change = effect.change || '---';
              return (
                <tr key={idx}>
                  <td style={{ padding: 8, border: '1px solid #ddd' }}>{h.text}</td>
                  <td style={{ padding: 8, border: '1px solid #ddd' }}>
                    {isRevealed ? commodity : '•••'}
                  </td>
                  <td style={{ padding: 8, border: '1px solid #ddd' }}>
                    {isRevealed ? change : '•••'}
                  </td>
                  <td style={{ padding: 8, border: '1px solid #ddd' }}>
                    <button onClick={() => toggleReveal(idx)}>
                      {isRevealed ? 'Hide' : 'Show'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Controls */}
      <div style={{ margin: '1em 0' }}>
        <button onClick={handleAdvance}>Advance to Month {currentRound + 2}</button>
        <button onClick={handleToggleReview} style={{ marginLeft: 8 }}>
          {state === 'review' ? 'Back to Play' : 'Enter Review Mode'}
        </button>
      </div>

      {/* Review positions table */}
      {state === 'review' && (
        <div style={{ border: '1px solid #999', padding: 12 }}>
          <h4>Review Positions for Month {currentRound}</h4>
          <ReviewTable gameId={gameId} highlightedEffects={revealedMap} />
        </div>
      )}
    </div>
  );
}