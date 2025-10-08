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

  // team info
  const [teamName, setTeamName] = useState('');
  const [teamStatus, setTeamStatus] = useState(undefined); // 'pending' | 'approved' | 'kicked' | 'rejected' | undefined

  // portfolio & market
  const [portfolio, setPf] = useState(null);
  const [commodities, setCommod] = useState([]);

  // UI
  const [qtys, setQtys] = useState({});
  const [submitting, setSub] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');

  // headlines (desktop)
  const [headlinesList, setHeadlinesList] = useState([]);
  const [headlineLoading, setHeadlineLoading] = useState(true);

  // ----- Game meta -----
  useEffect(() => {
    if (!gameId) return;
    return onValue(ref(database, `games/${gameId}`), (snap) => setGame(snap.val()));
  }, [gameId]);

  // ----- Team record (name + status) -----
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !gameId) return;
    const teamRef = ref(database, `games/${gameId}/teams/${uid}`);
    return onValue(teamRef, (snap) => {
      const t = snap.val();
      setTeamName((t && (t.name || t.teamName)) || '');
      setTeamStatus(t?.status);
    });
  }, [gameId]);

  // ----- Seed portfolio ONLY when approved -----
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !gameId) return;
    if (teamStatus !== 'approved') return;

    const pfRef = ref(database, `games/${gameId}/portfolios/${uid}`);
    let first = true;
    const off = onValue(pfRef, (snap) => {
      if (first && !snap.exists()) {
        runTransaction(pfRef, (cur) => {
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
  }, [gameId, teamStatus]);

  // ----- Subscribe to portfolio (approved only) -----
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !gameId) return;
    if (teamStatus !== 'approved') {
      setPf(null);
      return;
    }
    const pfRef = ref(database, `games/${gameId}/portfolios/${uid}`);
    return onValue(pfRef, (snap) => {
      if (!snap.exists()) return;
      const raw = snap.val() || {};
      const cash = typeof raw.cash === 'number' ? raw.cash : INITIAL_CAPITAL;
      const positions = raw.positions || {};
      const creditCap =
        typeof raw.creditCap === 'number'
          ? raw.creditCap
          : Math.round(cash * CREDIT_MULTIPLIER);
      setPf({ cash, positions, creditCap });
    });
  }, [gameId, teamStatus]);

  // ----- Commodities (one-time) -----
  useEffect(() => {
    get(ref(database, 'constants/commodities')).then((snap) => {
      const raw = snap.val() || {};
      const list = Array.isArray(raw)
        ? raw.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
        : Object.entries(raw).map(([id, c]) => ({ id, ...c }));
      setCommod(list);
    });
  }, []);

  // ----- Headlines per round (desktop) -----
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

  // Early skeleton while loading game
  if (!game) return <p>Loading…</p>;

  const round = game.currentRound ?? 0;

  // ----- Gate: not in a team -----
  if (teamStatus === undefined) {
    return (
      <div>
        <BrandBar showLogout />
        <div className="hud-sticky">
          <p className="meta-line">
            <span>Game: {game.name}</span>
            <span className="meta-dot only-desktop" />
            <span>Month {round + 1}</span>
          </p>
          <div className="toast-rail" />
        </div>

        <h2>Not joined</h2>
        <p>
          You’re not part of this game yet. Go back to the lobby and join with the teacher’s code.
        </p>
        <button className="btn" onClick={() => navigate('/lobby')}>
          Back to Lobby
        </button>

        {/* Context headlines on desktop */}
        <div className="hide-on-mobile">
          {headlineLoading ? (
            <span>Loading headlines…</span>
          ) : headlinesList.length ? (
            <ul>{headlinesList.map((h, i) => <li key={i}>{h.text || h}</li>)}</ul>
          ) : (
            <span>No headlines this round.</span>
          )}
        </div>
      </div>
    );
  }

  // ----- Gate: pending / kicked / rejected -----
  if (teamStatus !== 'approved') {
    const statusMsg =
      teamStatus === 'pending'
        ? 'Waiting for teacher approval'
        : teamStatus === 'kicked'
        ? 'Your team has been removed from this game.'
        : 'Your join request was not approved.';

    return (
      <div>
        <BrandBar showLogout />
        <div className="hud-sticky">
          <p className="meta-line">
            <span>Game: {game?.name || '—'}</span>
            <span className="meta-dot only-desktop" />
            <span>Month {Number(game?.currentRound ?? 0) + 1}</span>
            <br className="only-mobile" />
            <span className="meta-dot only-desktop" />
            <span className="team-ellip">Team: {teamName || '—'}</span>
          </p>
          <div className="toast-rail" />
        </div>

        <h2>{statusMsg}</h2>
        <p>
          Team <strong>{teamName || '(unnamed team)'}</strong> cannot trade until approved by the
          teacher.
        </p>

        {/* Headlines on desktop */}
        <div className="hide-on-mobile">
          {headlineLoading ? (
            <span>Loading headlines…</span>
          ) : headlinesList.length ? (
            <ul>{headlinesList.map((h, i) => <li key={i}>{h.text || h}</li>)}</ul>
          ) : (
            <span>No headlines this round.</span>
          )}
        </div>
      </div>
    );
  }

  // From here on, team is APPROVED and portfolio should be available/seeded
  if (!portfolio || commodities.length === 0) return <p>Loading…</p>;

  const { cash, positions, creditCap } = portfolio;

  // Credit usage (shorts only)
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
    if (teamStatus !== 'approved') return alert('Trading is disabled until your team is approved.');
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
        <p className="meta-line">
          <span>Game: {game.name}</span>
          <span className="meta-dot only-desktop" />
          <span>Month {round + 1}</span>
          <br className="only-mobile" />
          <span className="meta-dot only-desktop" />
          <span className="team-ellip">Team: {teamName || '(team not named)'}</span>
        </p>

        <div className="statgrid hud-stats">
          <MoneyOdometer label="Cash" value={cash} slotCh={16} />
          <MoneyOdometer label="Credit Cap" value={creditCap} slotCh={16} />
          <MoneyOdometer label="Used" value={used} slotCh={16} />
          <MoneyOdometer label="Available" value={available} slotCh={16} />
        </div>

        {/* Toast slot (no layout shift) */}
        <div className="toast-rail">
          {toast && (
            <div className={`toast show ${toastType === 'error' ? 'error' : ''}`}>{toast}</div>
          )}
        </div>
      </div>

      {/* Headlines – desktop only */}
      <div className="hide-on-mobile">
        {headlineLoading ? (
          <span>Loading headlines…</span>
        ) : headlinesList.length ? (
          <ul>{headlinesList.map((h, i) => <li key={i}>{h.text || h}</li>)}</ul>
        ) : (
          <span>No headlines this round.</span>
        )}
      </div>

      {/* ===== Desktop table ===== */}
      <div className="desktop-only">
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
                    className="btn btn--primary"
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