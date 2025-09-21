// src/Scoreboard.js
import React, { useEffect, useState } from 'react';
import { database } from './firebase';
import { ref, onValue, get } from 'firebase/database';

// Should match INITIAL_CAPITAL from GamePage
const INITIAL_CAPITAL = 10000;
// Credit multiplier is irrelevant here; we show raw balance

export default function Scoreboard({ gameId, currentRound }) {
  const [balances, setBalances] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [priceMap, setPriceMap] = useState({});

  useEffect(() => {
    // 1) Load commodity prices
    get(ref(database, 'constants/commodities')).then((snap) => {
      const data = snap.val() || [];
      setPriceMap(Object.fromEntries(data.map((c) => [c.id, c.prices])));
    });
    // 2) Load user profiles
    get(ref(database, 'users')).then((snap) => {
      const users = snap.val() || {};
      const map = {};
      Object.entries(users).forEach(([uid, uData]) => {
        map[uid] = uData.profile?.name || uid;
      });
      setProfiles(map);
    });
  }, []);

  useEffect(() => {
    if (priceMap && Object.keys(priceMap).length && profiles) {
      const tradesRef = ref(database, `games/${gameId}/trades`);
      const unsub = onValue(tradesRef, (snap) => {
        const allTrades = snap.val() || {};
        const result = Object.entries(allTrades).map(([uid, trades]) => {
          let bal = INITIAL_CAPITAL;
          Object.values(trades).forEach((t) => {
            const prices = priceMap[t.commodity] || [];
            if (t.round < currentRound) {
              const exit = prices[t.round + 1] ?? t.price;
              const delta = t.action === 'buy' ? exit - t.price : t.price - exit;
              bal += delta * t.quantity;
            } else if (t.round === currentRound) {
              // credit shorts, deduct buys upfront
              bal += t.action === 'short' ? t.price * t.quantity : -t.price * t.quantity;
            }
          });
          return { uid, name: profiles[uid] || uid, balance: bal };
        });
        // sort descending
        result.sort((a, b) => b.balance - a.balance);
        setBalances(result);
      });
      return unsub;
    }
  }, [priceMap, profiles, currentRound, gameId]);

  return (
    <div>
      <h3>Balances</h3>
      {balances.length === 0 ? (
        <p>No players yet.</p>
      ) : (
        <ol>
          {balances.map(({ uid, name, balance }) => (
            <li key={uid}>
              {name}: ${balance.toFixed(2)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
