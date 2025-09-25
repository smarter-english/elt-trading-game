// src/TeacherGamePage.js
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from './firebase';
import { ref, onValue, get, update, runTransaction, set } from 'firebase/database';
import BrandBar from './BrandBar';
import ReviewTable from './ReviewTable';

const CREDIT_MULTIPLIER = 0.5;
const DEFAULT_FINE = 100;

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
  const [revealed, setRevealed] = useState({}); // {index: true|false}

  const [commodities, setCommodities] = useState([]);
  const [teams, setTeams] = useState({});
  const [portfolios, setPortfolios] = useState({});
  const [penalties, setPenalties] = useState({});
  const [fine, setFine] = useState(DEFAULT_FINE);
  const [savingFine, setSavingFine] = useState(false);

  const [advancing, setAdvancing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusPersist, setStatusPersist] = useState(false);

  const [showStandings, setShowStandings] = useState(false);
  const [standings, setStandings] = useState([]);
  const [standingsRound, setStandingsRound] = useState(null);

  // Game meta
  useEffect(() => {
    if (!gameId) return;
    const path = `games/${gameId}`;
    const gRef = ref(database, path);
    const unsub = onValue(
      gRef,
      (snap) => setGame(snap.val()),
      (err) => {
        console.groupCollapsed('Game read error');
        console.log('path:', path);
        console.warn('Firebase error:', err?.code, err?.message);
        console.groupEnd();
      }
    );
    return unsub;
  }, [gameId]);

  // Teams
  useEffect(() => {
    if (!gameId) return;
    const path = `games/${gameId}/teams`;
    const tRef = ref(database, path);
    const unsub = onValue(
      tRef,
      (snap) => setTeams(snap.val() || {}),
      (err) => {
        console.groupCollapsed('Teams read error');
        console.log('path:', path);
        console.warn('Firebase error:', err?.code, err?.message);
        console.groupEnd();
      }
    );
    return unsub;
  }, [gameId]);

  // Portfolios (live positions)
  useEffect(() => {
    if (!gameId) return;
    const path = `games/${gameId}/portfolios`;
    const pRef = ref(database, path);
    const unsub = onValue(
      pRef,
      (snap) => {
        const val = snap.val() || {};
        setPortfolios(val);
      },
      (err) => {
        console.groupCollapsed('Portfolios read error');
        console.log('path:', path);
        console.warn('Firebase error:', err?.code, err?.message);
        console.groupEnd();
      }
    );
    return unsub;
  }, [gameId]);

  // One-time commodities
  useEffect(() => {
    let alive = true;
    (async () => {
      const snap = await get(ref(database, 'constants/commodities'));
      const raw = snap.val() || {};
      const list = Array.isArray(raw)
        ? raw.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
        : Object.entries(raw).map(([id, c]) => ({ id, ...c }));
      if (alive) setCommodities(list);
    })();
    return () => { alive = false; };
  }, []);

  // Headlines for current round
  useEffect(() => {
    if (!game) return;
    setLoadingHL(true);
    setRevealed({});
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
    return () => { alive = false; };
  }, [game?.currentRound, game, gameId]);

  // Penalties (current round)
  useEffect(() => {
    if (!game) return;
    const path = `games/${gameId}/penalties/${game.currentRound}`;
    const pRef = ref(database, path);
    return onValue(pRef, (snap) => {
      const obj = snap.val() || {};
      setPenalties(obj);
      const f = Math.max(0, Math.floor(Number(obj?.fine ?? DEFAULT_FINE)));
      setFine(f);
    });
  }, [gameId, game?.currentRound, game]);

  // Effects map used by ReviewTable to highlight good/poor choices
  const revealedEffectsMap = useMemo(() => {
    const map = {};
    headlines.forEach((h, idx) => {
      if (!revealed[idx]) return;
      const eff = Array.isArray(h?.effects) ? h.effects[0] : null;
      if (eff?.commodity && eff?.change) {
        map[normName(eff.commodity)] = String(eff.change); // 'up' | 'down'
      }
    });
    return map;
  }, [headlines, revealed]);

  if (!game) return <p>Loading game…</p>;
  const { currentRound, state } = game;
  const monthLabel = (i) => `Month ${i + 1}`;

  // ===== actions =====
  const openStandings = async () => {
    const snap = await get(ref(database, `games/${gameId}/standings/${game.currentRound}`));
    const saved = snap.val();
    if (saved?.list && Array.isArray(saved.list)) {
      setStandings(saved.list);
      setStandingsRound(saved.round ?? game.currentRound);
      setShowStandings(true);
    } else {
      setStatusText('No saved standings for this round yet.');
      setStatusPersist(true);
    }
  };

  const savePenalty = async (uid, value) => {
    const n = Math.max(0, Math.min(50, Math.floor(Number(value) || 0)));
    await set(ref(database, `games/${gameId}/penalties/${currentRound}/${uid}`), { count: n });
  };

  const saveFine = async (value) => {
    const n = Math.max(0, Math.min(100000, Math.floor(Number(value) || 0)));
    setFine(n);
    setSavingFine(true);
    try {
      await set(ref(database, `games/${gameId}/penalties/${currentRound}/fine`), n);
    } finally {
      setSavingFine(false);
    }
  };

  const handleAdvance = async () => {
    if (!window.confirm(
      `Advance to ${monthLabel(currentRound + 1)} and liquidate all teams' positions at that month's prices?\nPenalties for ${monthLabel(currentRound)} will also be applied (fine = $${fine}).`
    )) return;

    const nextRound = currentRound + 1;
    setAdvancing(true);
    setStatusText('');
    setStatusPersist(false);

    try {
      // Flip month & set play
      await update(ref(database, `games/${gameId}`), {
        currentRound: nextRound,
        state: 'play',
        lastAdvanceAt: Date.now()
      });

      // Fetch commodities for next prices
      const commSnap = await get(ref(database, 'constants/commodities'));
      const raw = commSnap.val() || {};
      const comms = Array.isArray(raw)
        ? raw.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
        : Object.entries(raw).map(([id, c]) => ({ id, ...c }));
      const priceAt = (cid, r) => {
        const c = comms.find((x) => x.id === cid);
        return Number(c?.prices?.[r] ?? 0);
      };

      // Snapshot data
      const [pfSnap, teamsSnap, penSnap] = await Promise.all([
        get(ref(database, `games/${gameId}/portfolios`)),
        get(ref(database, `games/${gameId}/teams`)),
        get(ref(database, `games/${gameId}/penalties/${currentRound}`))
      ]);
      const portfoliosNow = pfSnap.val() || {};
      const teamsNow = teamsSnap.val() || {};
      const penaltiesNow = penSnap.val() || {};
      const fineNow = Math.max(0, Math.floor(Number(penaltiesNow?.fine ?? fine ?? DEFAULT_FINE)));

      // Liquidate & apply penalties
      for (const [uid] of Object.entries(portfoliosNow)) {
        await runTransaction(ref(database, `games/${gameId}/portfolios/${uid}`), (curr) => {
          if (!curr) return curr;
          let newCash = Number(curr.cash || 0);
          const pos = curr.positions || {};
          Object.entries(pos).forEach(([cid, qty]) => {
            const q = Number(qty) || 0;
            if (!q) return;
            const p = priceAt(cid, nextRound);
            newCash += q * p; // long sells add, short (negative q) buys back subtracts
          });
          const count = Math.max(0, Math.floor(Number(penaltiesNow?.[uid]?.count) || 0));
          newCash -= count * fineNow;
          return {
            cash: newCash,
            positions: {},
            creditCap: Math.round(newCash * CREDIT_MULTIPLIER)
          };
        });
      }

      // Standings snapshot
      const pfSnap2 = await get(ref(database, `games/${gameId}/portfolios`));
      const portfoliosAfter = pfSnap2.val() || {};
      const list = Object.keys(teamsNow).map((uid) => {
        const t = teamsNow[uid] || {};
        const p = portfoliosAfter[uid] || {};
        return {
          uid,
          teamName: t.teamName || t.name || '(Team)',
          cash: typeof p.cash === 'number' ? p.cash : 0
        };
      });
      Object.keys(portfoliosAfter).forEach((uid) => {
        if (!list.find((x) => x.uid === uid)) {
          const p = portfoliosAfter[uid] || {};
          list.push({ uid, teamName: '(Team)', cash: typeof p.cash === 'number' ? p.cash : 0 });
        }
      });
      list.sort((a, b) => b.cash - a.cash);

      await set(ref(database, `games/${gameId}/standings/${nextRound}`), {
        round: nextRound,
        computedAt: Date.now(),
        list
      });

      setStatusText(
        `✅ Advanced to ${monthLabel(nextRound)}. Penalties applied for ${monthLabel(currentRound)} (fine $${fineNow}). Standings saved for ${monthLabel(nextRound)}.`
      );
      setStatusPersist(true);
      setStandings(list);
      setStandingsRound(nextRound);
      setShowStandings(true);
    } catch (err) {
      console.error('Advance failed:', err);
      setStatusText(`❌ Advance failed: ${err?.message || 'Unknown error'}`);
      setStatusPersist(true);
    } finally {
      setAdvancing(false);
    }
  };

  const handleToggleReview = async () => {
    if (advancing) return;
    try {
      await update(ref(database, `games/${gameId}`), {
        state: state === 'review' ? 'play' : 'review'
      });
    } catch (e) {
      console.warn('Toggle state failed:', e);
      alert(e?.message || 'Failed to toggle state');
    }
  };

  const toggleReveal = (idx) => setRevealed((r) => ({ ...r, [idx]: !r[idx] }));

  return (
    <div>
      <BrandBar showLogout />

      <div className="hud-sticky" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>
            Game: {game?.name} &nbsp;•&nbsp; {monthLabel(currentRound)} &nbsp;•&nbsp; State: <em>{state}</em>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn--link" onClick={() => navigate('/teacher/dashboard')}>
              ← Back to Dashboard
            </button>
            {state !== 'review' ? (
              <button className="btn btn--neutral" onClick={handleToggleReview} disabled={advancing}>
                Enter Review
              </button>
            ) : (
              <button className="btn btn--neutral" onClick={handleToggleReview} disabled={advancing}>
                Back to Trading
              </button>
            )}
            <button className="btn btn--primary" onClick={handleAdvance} disabled={advancing}>
              {advancing ? 'Advancing…' : `Advance to Month ${currentRound + 2}`}
            </button>
          </div>
        </div>

        {/* Status banner (sticky rail) */}
        <div className="toast-rail" style={{ position: 'static', minHeight: 44, marginTop: 8 }}>
          {statusText ? (
            <div
              className="toast show"
              style={{
                whiteSpace: 'pre-line',
                background: statusText.startsWith('✅') ? '#eef9f0' : statusText.startsWith('❌') ? '#fff2f2' : '#eef6ff',
                border: `1px solid ${
                  statusText.startsWith('✅') ? '#bfe4c7' : statusText.startsWith('❌') ? '#f3c2c2' : '#cfe3ff'
                }`,
                color: '#222'
              }}
              aria-live="polite"
            >
              {statusText}{' '}
              <button className="btn" onClick={openStandings} style={{ marginLeft: 8 }}>
                Show standings
              </button>
              {statusPersist && (
                <button className="btn" onClick={() => { setStatusText(''); setStatusPersist(false); }} style={{ marginLeft: 8 }}>
                  Dismiss
                </button>
              )}
            </div>
          ) : (
            <div className="toast" style={{ visibility: 'hidden' }}>.</div>
          )}
        </div>
      </div>

      {/* Headlines vs Review UI */}
      {state !== 'review' ? (
        <div 
          className="headlines--play"
          style={{ 
            border: '1px solid #ccc',
            padding: 12,
            margin: '12px',
            borderRadius: 8,
            fontSize: 'clamp(20px, 3.2vw, 36px)',
            lineHeight: 1.25,
            fontWeight: 700
          }}>
          {loadingHL ? (
            <span>Loading headlines…</span>
          ) : headlines.length ? (
            <ul>
              {headlines.map((h, i) => (
                <li key={i}>{h.text}</li>
              ))}
            </ul>
          ) : (
            <span>No headlines this round.</span>
          )}
        </div>
      ) : (
        <>
          {/* Reveal table */}
          <div style={{ padding: 12 }}>
            <h3>Headline review: {monthLabel(currentRound)}</h3>
            <table className="trade-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Headline</th>
                  <th className="hide-on-mobile">Commodity</th>
                  <th className="hide-on-mobile">Direction</th>
                  <th>Reveal</th>
                </tr>
              </thead>
              <tbody>
                {headlines.map((h, idx) => {
                  const isRevealed = !!revealed[idx];
                  const effect = Array.isArray(h.effects) ? h.effects[0] : {};
                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{h.text}</td>
                      <td className="hide-on-mobile">{isRevealed ? (effect.commodity || '—') : '—'}</td>
                      <td className="hide-on-mobile">{isRevealed ? (effect.change || '—') : '—'}</td>
                      <td>
                        <button className="btn" onClick={() => toggleReveal(idx)} disabled={advancing}>
                          {isRevealed ? 'Hide' : 'Reveal'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Review positions table (with highlighting) */}
          <div style={{ border: '1px solid #999', padding: 12, margin: '12px' }}>
            <h4>Review Positions for {monthLabel(currentRound)}</h4>
            <ReviewTable
              gameId={gameId}
              portfolios={portfolios}
              teams={teams}
              commodities={commodities}
              highlightedEffects={revealedEffectsMap}
            />
          </div>

          {/* Penalties editor — moved to bottom */}
          <div style={{ border: '1px solid #bbb', padding: 12, borderRadius: 8, margin: '12px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <label htmlFor="fine-input"><strong>Penalty fine for {monthLabel(currentRound)} ($)</strong></label>
              <input
                id="fine-input"
                type="number"
                min="0"
                step="1"
                style={{ width: 120 }}
                value={fine}
                onChange={(e) => setFine(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                onBlur={() => saveFine(fine)}
                disabled={savingFine || advancing}
              />
              {savingFine && <span style={{ color: '#666' }}>Saving…</span>}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Team</th>
                  <th style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #ddd' }}>
                    Penalties ({monthLabel(currentRound)})
                  </th>
                  <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #ddd' }}>
                    Fine next month
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(teams).map(([uid, t]) => {
                  const name = t.teamName || t.name || '(Team)';
                  const count = Math.max(0, Math.floor(Number(penalties?.[uid]?.count) || 0));
                  return (
                    <tr key={uid}>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{name}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          style={{ width: 80 }}
                          value={count}
                          onChange={(e) => savePenalty(uid, e.target.value)}
                          disabled={advancing}
                        />
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                        ${(count * fine).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                {Object.keys(teams).length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ padding: 12, textAlign: 'center', color: '#666' }}>No teams yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Standings modal */}
      {showStandings && (
        <div
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => e.key === 'Escape' && setShowStandings(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 1000 }}
          onClick={() => setShowStandings(false)}
        >
          <div
            style={{ background: '#fff', padding: 16, borderRadius: 10, minWidth: 360, maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 style={{ margin: 0 }}>Standings {standingsRound != null ? `(${monthLabel(standingsRound)})` : ''}</h3>
              <button onClick={() => setShowStandings(false)} aria-label="Close standings">Close</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>#</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Team</th>
                  <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #ddd' }}>Cash</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.uid}>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{i + 1}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{row.teamName}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                      ${Number(row.cash || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ padding: 12, textAlign: 'center', color: '#666' }}>No teams yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}