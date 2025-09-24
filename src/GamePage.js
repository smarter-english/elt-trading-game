// src/GamePage.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { ref, onValue, get, runTransaction } from 'firebase/database';
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
  const [toastType, setToastType] = useState('success');

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

  // Seed portfolio ONLY if missing (never overwrite)
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !gameId) return;
    const pfRef = ref(database, `games/${gameId}/portfolios/${uid}`);
    // Use a one-shot read via onValue to check existence and seed transactionally
    let first = true;
    const off = onValue(pfRef, (snap) => {
      if (first && !snap.exists()) {
        runTransaction(pfRef, (cur) => {
          // Only set defaults if node is still missing
          return cur || {
            cash: INITIAL_CAPITAL,
            positions: {},
            creditCap: Math.round(INITIAL_CAPITAL * CREDIT_MULTIPLIER),
          };
        });
      }
      first = false;
    });
    return () => off();
  }, [gameId]);

  // Subscribe to portfolio (do NOT fallback to INITIAL_CAPITAL if snapshot is empty)
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !gameId) return;
    const pfRef = ref(database, `games/${gameId}/portfolios/${uid}`);
    return onValue(pfRef, (snap) => {
      if (!snap.exists()) {
        // Keep previous UI values to avoid "snap back" during teacher multi-path updates
        return;
      }
      const raw = snap.val() || {};
      const cash =
        typeof raw.cash === 'number' ? raw.cash : (portfolio?.cash ?? INITIAL_CAPITAL);
      const positions = raw.positions || {};
      const creditCap =
        typeof raw.creditCap === 'number'
          ? raw.creditCap
          : Math.round(cash * CREDIT_MULTIPLIER);
      setPf({ cash, positions, creditCap });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]); // don't depend on portfolio here to avoid loops

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

  // Headlines per round (one-time per round) – kept for desktop only
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

  // qty helpers
  const clampQty = (n) => (Number.isFinite(n) && n >= 1 ? n : 1);
  const decQty = (cid) =>
    setQtys((q) => {
      const curr = clampQty(Math.floor(Number(q[cid] ?? 1)));
      return { ...q, [cid]: String(Math.max(1, curr - 1)) };
    });
  const incQty = (cid) =>
    setQtys((q) => {
      const curr = clampQty(Math.floor(Number(q[cid] ?? 1)));
      return { ...q, [cid]: String(curr + 1) };
    });

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
        // Use current DB values; if missing, seed from INITIAL_CAPITAL (first trade case only)
        const prevCash = typeof curr?.cash === 'number' ? curr.cash : INITIAL_CAPITAL;
        const prevCap =
          typeof curr?.creditCap === 'number'
            ? curr.creditCap
            : Math.round(prevCash * CREDIT_MULTIPLIER);

        const newCash = prevCash + (action === 'short' ? cost : -cost);
        const newPos = { ...(curr?.positions || {}) };
        newPos[cid] = (newPos[cid] || 0) + (action === 'buy' ? qty : -qty);

        return { cash: newCash, positions: newPos, creditCap: prevCap };
      });

      const name = commodities.find((c) => c.id === cid)?.name || cid;
      setToastType('success');
      setToast(`${action === 'buy' ? 'Bought' : 'Shorted'} ${qty} ${name} @ $${price.toFixed(2)}`);
      setTimeout(() => setToast(''), 2000);
      setQtys((prev) => ({ ...prev, [cid]: '' }));
    } catch (e) {
      console.error('Trade failed:', e);
      setToastType('error');
      setToast(e?.message || 'Trade failed');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setSub(false);
    }
  };

  // helper for colored position text
  const renderPositionText = (cid, unit) => {
    const pos = Number(positions[cid] || 0);
    const tot = pos * unit;
    const sign = pos > 0 ? '+' : pos < 0 ? '-' : '';
    const totSign = tot > 0 ? '+' : tot < 0 ? '-' : '';
    const cls = pos > 0 ? 'pos-long' : pos < 0 ? 'pos-short' : 'pos-flat';
    return (
      <span className={cls}>
        {`${sign}${Math.abs(pos)} units @ $${unit.toFixed(2)} each (total ${totSign}$${Math.abs(tot).toFixed(2)})`}
      </span>
    );
  };

  return (
    <div>
      <BrandBar showLogout />

      {/* Sticky HUD */}
      <div className="hud-sticky">
        <div style={{ fontWeight: 600 }}>
          Game: {game.name} &nbsp;•&nbsp; Team: {teamName || '(team not named)'} &nbsp;•&nbsp; Month {round + 1}
        </div>

        <div className="statgrid hud-stats">
          <MoneyOdometer label="Cash" value={cash} slotCh={16} />
          <MoneyOdometer label="Credit Cap" value={creditCap} slotCh={16} />
          <MoneyOdometer label="Used" value={used} slotCh={16} />
          <MoneyOdometer label="Available" value={available} slotCh={16} />
        </div>

        {/* Toast slot (no layout shift) */}
        <div className="toast-rail" style={{ position: 'static', height: 36, padding: 0, border: 'none' }}>
          {toast ? (
            <div className={`toast show ${toastType === 'error' ? 'error' : ''}`}>{toast}</div>
          ) : (
            <div className="toast" style={{ visibility: 'hidden' }}>.</div>
          )}
        </div>
      </div>

      {/* Headlines – desktop only */}
      <div className="hide-on-mobile" style={{ border: '1px solid #ccc', padding: 12, margin: '12px', borderRadius: 8 }}>
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

      {/* ===== Desktop table ===== */}
      <div className="desktop-only" style={{ padding: '0 12px 24px' }}>
        <table className="trade-table">
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
            {commodities.map((c) => {
              const unit = Number(c.prices?.[round] || 0);
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>${unit.toFixed(2)}</td>
                  <td>
                    <input
                      className="input-qty"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      disabled={game.state === 'review'}
                      value={qtys[c.id] ?? ''}
                      onWheel={(e) => e.currentTarget.blur()}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-', '.', ' ', ','].includes(e.key)) e.preventDefault();
                      }}
                      onChange={(e) =>
                        setQtys((q) => {
                          const n = Math.floor(Number(e.target.value));
                          return { ...q, [c.id]: Number.isFinite(n) && n >= 1 ? String(n) : '' };
                        })
                      }
                    />
                  </td>
                  <td className="actions">
                    <button
                      className="btn"
                      onClick={() => handleTrade(c.id, 'buy')}
                      disabled={submitting || game.state === 'review'}
                    >
                      Buy
                    </button>
                    <button
                      className="btn"
                      onClick={() => handleTrade(c.id, 'short')}
                      disabled={submitting || game.state === 'review'}
                      style={{ marginLeft: 8 }}
                    >
                      Short
                    </button>
                  </td>
                  <td>{renderPositionText(c.id, unit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile cards (3 lines + steppers) ===== */}
      <div className="mobile-only trade-cards">
        {commodities.map((c) => {
          const unit = Number(c.prices?.[round] || 0);

          return (
            <div className="card-compact" key={c.id}>
              {/* line 1: commodity — price */}
              <div className="row">
                <div className="title">{c.name}</div>
                <div className="price">${unit.toFixed(2)}</div>
              </div>

              {/* line 2: [-] [qty] [+]  |  Buy / Short */}
              <div className="row">
                <div className="qtyCluster" aria-label="Quantity controls">
                  <button
                    type="button"
                    className="stepperBtn"
                    onClick={() => decQty(c.id)}
                    disabled={submitting || game.state === 'review'}
                    aria-label={`Decrease ${c.name} quantity`}
                  >
                    −
                  </button>
                  <div className="qty">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      disabled={game.state === 'review'}
                      value={qtys[c.id] ?? ''}
                      onWheel={(e) => e.currentTarget.blur()}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-', '.', ' ', ','].includes(e.key)) e.preventDefault();
                      }}
                      onChange={(e) =>
                        setQtys((q) => {
                          const n = Math.floor(Number(e.target.value));
                          return { ...q, [c.id]: Number.isFinite(n) && n >= 1 ? String(n) : '' };
                        })
                      }
                      aria-label={`${c.name} quantity`}
                    />
                  </div>
                  <button
                    type="button"
                    className="stepperBtn"
                    onClick={() => incQty(c.id)}
                    disabled={submitting || game.state === 'review'}
                    aria-label={`Increase ${c.name} quantity`}
                  >
                    +
                  </button>
                </div>

                <div className="actions">
                  <button
                    className="btn primary"
                    onClick={() => handleTrade(c.id, 'buy')}
                    disabled={submitting || game.state === 'review'}
                  >
                    Buy
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleTrade(c.id, 'short')}
                    disabled={submitting || game.state === 'review'}
                  >
                    Short
                  </button>
                </div>
              </div>

              {/* line 3: position (colored) */}
              <div className="row">
                <div className="position">{renderPositionText(c.id, unit)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}