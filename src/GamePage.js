// src/GamePage.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { ref, onValue, get, runTransaction } from 'firebase/database';
import { signOut } from 'firebase/auth';
import MoneyOdometer from './MoneyOdometer';
import BrandBar from './BrandBar';

const INITIAL_CAPITAL = 10000;
const CREDIT_MULTIPLIER = 0.5;

export default function GamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [commodities, setCommod] = useState([]);
  const [portfolio, setPf] = useState(null);
  const [qtys, setQtys] = useState({});
  const [submitting, setSub] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [toast, setToast] = useState('');

  const [headlinesList, setHeadlinesList] = useState([]);
  const [headlineLoading, setHeadlineLoading] = useState(true);

  // Game meta
  useEffect(() => {
    if (!gameId) return;
    return onValue(ref(database, `games/${gameId}`), (snap) => setGame(snap.val()));
  }, [gameId]);

  // Team name
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !gameId) return;
    const teamRef = ref(database, `games/${gameId}/teams/${uid}`);
    return onValue(teamRef, (snap) => {
      const t = snap.val();
      setTeamName((t && (t.name || t.teamName)) || '');
    });
  }, [gameId]);

  // Portfolio
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !gameId) return;
    return onValue(ref(database, `games/${gameId}/portfolios/${uid}`), (snap) => {
      const raw = snap.val() || {};
      const cash = typeof raw.cash === 'number' ? raw.cash : INITIAL_CAPITAL;
      const positions = raw.positions || {};
      const creditCap =
        typeof raw.creditCap === 'number' ? raw.creditCap : cash * CREDIT_MULTIPLIER;
      setPf({ cash, positions, creditCap });
    });
  }, [gameId]);

  // Commodities (one-time)
  useEffect(() => {
    get(ref(database, 'constants/commodities')).then((snap) => {
      const raw = snap.val() || {};
      const list = Array.isArray(raw)
        ? raw.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
        : Object.entries(raw).map(([id, c]) => ({ id, ...c }));
      setCommod(list);
    });
  }, []);

  // Headlines per round (one-time per round)
  useEffect(() => {
    const round = game?.currentRound;
    if (round == null) return;
    setHeadlineLoading(true);

    let alive = true;
    (async () => {
      try {
        const snap = await get(ref(database, `constants/headlines/${round}`));
        const data = snap.val();
        const list = Array.isArray(data) ? data : data ? Object.values(data) : [];
        if (alive) setHeadlinesList(list);
      } finally {
        if (alive) setHeadlineLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [game?.currentRound]);

  if (!game || !portfolio || commodities.length === 0) return <p>Loading…</p>;

  const { cash, positions, creditCap } = portfolio;
  const round = game.currentRound;

  // Credit usage (only shorts use credit)
  const used = Object.entries(positions).reduce((sum, [cid, qty]) => {
    if (qty < 0) {
      const price = commodities.find((c) => c.id === cid)?.prices[round] || 0;
      return sum + Math.abs(qty) * price;
    }
    return sum;
  }, 0);
  const available = creditCap - used;

  // Trading
  const handleTrade = async (cid, action) => {
    if (game.state === 'review') return alert('Trading disabled during review');
    if (submitting) return;

    const raw = qtys[cid] ?? 1;
    const qty = Math.max(1, Math.floor(Number(raw)));
    if (!qty || Number.isNaN(qty)) return;

    const price = commodities.find((c) => c.id === cid)?.prices[round] || 0;
    const cost = price * qty;

    if (action === 'buy' && cost > cash) return alert('Insufficient funds');
    if (action === 'short' && cost > available) return alert('Insufficient credit');

    setSub(true);
    try {
      const uid = auth.currentUser.uid;
      const pfRef = ref(database, `games/${gameId}/portfolios/${uid}`);
      await runTransaction(pfRef, (curr) => {
        const prevCash = curr?.cash ?? INITIAL_CAPITAL;
        const prevCap =
          typeof curr?.creditCap === 'number' ? curr.creditCap : prevCash * CREDIT_MULTIPLIER;

        const newCash = prevCash + (action === 'short' ? cost : -cost);
        const newPos = { ...(curr?.positions || {}) };
        newPos[cid] = (newPos[cid] || 0) + (action === 'buy' ? qty : -qty);

        return { cash: newCash, positions: newPos, creditCap: prevCap };
      });

      const name = commodities.find((c) => c.id === cid)?.name || cid;
      setToast(`${action === 'buy' ? 'Bought' : 'Shorted'} ${qty} ${name} @ $${price.toFixed(2)}`);
      setTimeout(() => setToast(''), 2000);
      setQtys((prev) => ({ ...prev, [cid]: '' }));
    } catch (e) {
      console.error('Trade failed:', e);
      alert(e.message);
    } finally {
      setSub(false);
    }
  };

  // Input helpers
  const blockWheel = (e) => e.currentTarget.blur();
  const blockBadKeys = (e) => {
    if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
  };
  const clampQty = (val) => {
    const n = Math.floor(Number(val));
    return Number.isFinite(n) && n >= 1 ? String(n) : '';
  };

  return (
    <div>
      <BrandBar showLogout />      

      {/* Page header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          padding: '12px 12px 4px'
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            Game: {game.name} <span style={{ color: '#64748b', fontWeight: 500 }}>&nbsp;•&nbsp;Month {round + 1}</span>
          </h2>
          <div style={{ color: '#555', marginTop: 4 }}>Team: {teamName || '(team not named)'}</div>
        </div>
      </header>

      {/* Stat bar (odometer cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          alignItems: 'stretch',
          margin: '8px 12px 14px'
        }}
      >
        <MoneyOdometer label="Cash" value={cash} slotCh={16} />
        <MoneyOdometer label="Credit Cap" value={creditCap} slotCh={16} />
        <MoneyOdometer label="Used" value={used} slotCh={16} />
        <MoneyOdometer label="Available" value={available} slotCh={16} />
      </div>

      {toast && (
        <div
          style={{
            background: '#eef9f0',
            border: '1px solid #bfe4c7',
            padding: 8,
            margin: '8px 12px',
            borderRadius: 6
          }}
          aria-live="polite"
        >
          {toast}
        </div>
      )}

      {/* Headlines */}
      <div style={{ border: '1px solid #ccc', padding: 12, margin: '12px', borderRadius: 8 }}>
        {headlineLoading ? (
          <span>Loading headlines…</span>
        ) : headlinesList.length ? (
          <ul>
            {headlinesList.map((h, i) => (
              <li key={i}>{h.text || h}</li>
            ))}
          </ul>
        ) : (
          <span>No headlines this round.</span>
        )}
      </div>

      {/* Trade table */}
      <div style={{ padding: '0 12px 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr>
              <th>Commodity</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Action</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            {commodities.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>${c.prices[round]}</td>
                <td>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    disabled={game.state === 'review'}
                    value={qtys[c.id] ?? ''}
                    style={{ width: 70 }}
                    onWheel={blockWheel}
                    onKeyDown={blockBadKeys}
                    onChange={(e) =>
                      setQtys((q) => ({ ...q, [c.id]: clampQty(e.target.value) }))
                    }
                  />
                </td>
                <td>
                  <button
                    onClick={() => handleTrade(c.id, 'buy')}
                    disabled={submitting || game.state === 'review'}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => handleTrade(c.id, 'short')}
                    disabled={submitting || game.state === 'review'}
                    style={{ marginLeft: 8 }}
                  >
                    Short
                  </button>
                </td>
                <td>
                  {(() => {
                    const pos = positions[c.id] || 0;
                    const unit = c.prices[round] || 0;
                    const tot = pos * unit;
                    const sign = pos > 0 ? '+' : pos < 0 ? '-' : '';
                    const totSign = tot > 0 ? '+' : tot < 0 ? '-' : '';
                    return `${sign}${Math.abs(pos)} units @ $${unit.toFixed(
                      2
                    )} each (total ${totSign}$${Math.abs(tot).toFixed(2)})`;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}