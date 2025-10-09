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

  // Narrow meta prevents headlines reloading on trades
  const [meta, setMeta] = useState({ name: '', state: 'play', currentRound: 0 });

  const [headlines, setHeadlines] = useState([]);
  const [loadingHL, setLoadingHL] = useState(true);
  const [revealed, setRevealed] = useState({});

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

  /* meta listeners */
  useEffect(() => {
    if (!gameId) return;

    const offName = onValue(
      ref(database, `games/${gameId}/name`),
      s => setMeta(m => ({ ...m, name: s.val() || '' }))
    );
    const offState = onValue(
      ref(database, `games/${gameId}/state`),
      s => setMeta(m => ({ ...m, state: s.val() || 'play' }))
    );
    const offRound = onValue(
      ref(database, `games/${gameId}/currentRound`),
      s => setMeta(m => ({ ...m, currentRound: s.val() ?? 0 }))
    );

    return () => { offName(); offState(); offRound(); };
  }, [gameId]);

  /* teams & portfolios */
  useEffect(() => {
    if (!gameId) return;
    const tRef = ref(database, `games/${gameId}/teams`);
    return onValue(tRef, (snap) => setTeams(snap.val() || {}), () => setTeams({}));
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    const pRef = ref(database, `games/${gameId}/portfolios`);
    return onValue(pRef, (snap) => setPortfolios(snap.val() || {}), () => setPortfolios({}));
  }, [gameId]);

  /* commodities (one-time) */
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

  /* headlines per month */
  useEffect(() => {
    setLoadingHL(true);
    setRevealed({});
    let alive = true;
    (async () => {
      const snap = await get(ref(database, `constants/headlines/${meta.currentRound}`));
      const data = snap.val();
      const list = Array.isArray(data) ? data : data ? Object.values(data) : [];
      if (alive) {
        setHeadlines(list);
        setLoadingHL(false);
      }
    })();
    return () => { alive = false; };
  }, [meta.currentRound]);

  /* penalties by month */
  useEffect(() => {
    if (!gameId) return;
    const pRef = ref(database, `games/${gameId}/penalties/${meta.currentRound}`);
    return onValue(pRef, (snap) => {
      const obj = snap.val() || {};
      setPenalties(obj);
      const f = Math.max(0, Math.floor(Number(obj?.fine ?? DEFAULT_FINE)));
      setFine(f);
    });
  }, [gameId, meta.currentRound]);

  const { currentRound, state } = meta;
  const monthLabel = (i) => `Month ${i + 1}`;

  const revealedEffectsMap = useMemo(() => {
    const map = {};
    headlines.forEach((h, idx) => {
      if (!revealed[idx]) return;
      const eff = Array.isArray(h?.effects) ? h.effects[0] : null;
      if (eff?.commodity && eff?.change) {
        map[normName(eff.commodity)] = String(eff.change);
      }
    });
    return map;
  }, [headlines, revealed]);

  const openStandings = async () => {
    const snap = await get(ref(database, `games/${gameId}/standings/${meta.currentRound}`));
    const saved = snap.val();
    if (saved?.list && Array.isArray(saved.list)) {
      setStandings(saved.list);
      setStandingsRound(saved.round ?? meta.currentRound);
      setShowStandings(true);
    } else {
      setStatusText('No saved standings for this round yet.');
      setStatusPersist(true);
    }
  };

  const savePenalty = async (uid, value) => {
    const n = Math.max(0, Math.min(200, Math.floor(Number(value) || 0)));
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
      await update(ref(database, `games/${gameId}`), {
        currentRound: nextRound,
        state: 'play',
        lastAdvanceAt: Date.now()
      });

      const commSnap = await get(ref(database, 'constants/commodities'));
      const raw = commSnap.val() || {};
      const comms = Array.isArray(raw)
        ? raw.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
        : Object.entries(raw).map(([id, c]) => ({ id, ...c }));
      const priceAt = (cid, r) => {
        const c = comms.find((x) => x.id === cid);
        return Number(c?.prices?.[r] ?? 0);
      };

      const [pfSnap, teamsSnap, penSnap] = await Promise.all([
        get(ref(database, `games/${gameId}/portfolios`)),
        get(ref(database, `games/${gameId}/teams`)),
        get(ref(database, `games/${gameId}/penalties/${currentRound}`))
      ]);
      const portfoliosNow = pfSnap.val() || {};
      const teamsNow = teamsSnap.val() || {};
      const penaltiesNow = penSnap.val() || {};
      const fineNow = Math.max(0, Math.floor(Number(penaltiesNow?.fine ?? fine ?? DEFAULT_FINE)));

      for (const [uid] of Object.entries(portfoliosNow)) {
        await runTransaction(ref(database, `games/${gameId}/portfolios/${uid}`), (curr) => {
          if (!curr) return curr;
          let newCash = Number(curr.cash || 0);
          const pos = curr.positions || {};
          Object.entries(pos).forEach(([cid, qty]) => {
            const q = Number(qty) || 0;
            if (!q) return;
            const p = priceAt(cid, nextRound);
            newCash += q * p;
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

      <div className="hud-sticky">
        <div className="teacher-topbar">
          <div className="teacher-topbar__title">
            Game: {meta.name} • {monthLabel(currentRound)} • State: <em>{state}</em>
          </div>
          <div className="teacher-topbar__actions">
            <button className="btn btn--neutral" onClick={() => navigate('/teacher/dashboard')}>
              ← Back to Dashboard
            </button>
            <button className="btn btn--neutral" onClick={openStandings} disabled={advancing}>
              Show Standings
            </button>
            <button className="btn btn--neutral" onClick={handleToggleReview} disabled={advancing}>
              {state !== 'review' ? 'Enter Review' : 'Back to Trading'}
            </button>
            <button className="btn btn--primary" onClick={handleAdvance} disabled={advancing}>
              {advancing ? 'Advancing…' : `Advance to Month ${currentRound + 2}`}
            </button>
          </div>
        </div>

        <div className="toast-rail toast-rail--spaced">
          {statusText ? (
            <div className="toast show">
              {statusText}{' '}
              <button className="btn" onClick={openStandings}>Show standings</button>
              {statusPersist && (
                <button className="btn" onClick={() => { setStatusText(''); setStatusPersist(false); }}>
                  Dismiss
                </button>
              )}
            </div>
          ) : (
            <div className="toast toast--hidden">.</div>
          )}
        </div>
      </div>

      {state !== 'review' ? (
        <div className="panel headlines--play">
          {loadingHL ? (
            <span>Loading headlines…</span>
          ) : headlines.length ? (
            <ul>{headlines.map((h, i) => <li key={i}>{h.text}</li>)}</ul>
          ) : (
            <span>No headlines this round.</span>
          )}
        </div>
      ) : (
        <>
          {/* Headline reveal table */}
          <div className="panel panel--reveal">
            <h3 className="table-title table-title--reveal">
              Headline Review — {monthLabel(currentRound)}
            </h3>
            <div className="review-big">
              <table className="trade-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Headline</th>
                    <th>Commodity</th>
                    <th>Impact (S/D)</th>
                    <th>Δ next month</th>
                    <th>Show</th>
                  </tr>
                </thead>
                <tbody>
                  {headlines.map((h, idx) => {
                    const isRevealed = !!revealed[idx];
                    const eff = Array.isArray(h.effects) ? h.effects[0] : null;

                    const commName = eff?.commodity || '';
                    const comm = commodities.find(c => (c.name || '').toLowerCase() === commName.toLowerCase());

                    const pNow  = Number(comm?.prices?.[currentRound] ?? NaN);
                    const pNext = Number(comm?.prices?.[currentRound + 1] ?? NaN);
                    const pct = Number.isFinite(pNow) && Number.isFinite(pNext) && pNow > 0
                      ? ((pNext - pNow) / pNow) * 100
                      : null;

                    const impactKey = eff?.impact || null;
                    const impactLabel = !isRevealed || !impactKey
                      ? '—'
                      : impactKey.startsWith('demand')
                        ? `Demand ${impactKey.endsWith('up') ? '↑' : '↓'}`
                        : `Supply ${impactKey.endsWith('up') ? '↑' : '↓'}`;

                    const deltaLabel = isRevealed && pct != null
                      ? `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`
                      : '—';

                    return (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{h.text}</td>
                        <td>{isRevealed ? (commName || '—') : '—'}</td>
                        <td>{impactLabel}</td>
                        <td>{deltaLabel}</td>
                        <td>
                          <button className="btn" onClick={() => toggleReveal(idx)} disabled={advancing}>
                            {isRevealed ? '🙈' : '👁️'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Review positions table */}
          <div className="panel panel--positions">
            <h3 className="table-title table-title--positions">
              Positions by Commodity — {monthLabel(currentRound)}
            </h3>
            <div className="review-big">
              <ReviewTable
                gameId={gameId}
                portfolios={portfolios}
                teams={teams}
                commodities={commodities}
                highlightedEffects={revealedEffectsMap}
              />
            </div>
          </div>

          {/* Penalties table */}
          <div className="panel panel--penalties review-big">
            <h3 className="table-title table-title--penalties">
              Penalties — {monthLabel(currentRound)}
            </h3>

            <div className="penalties-bar">
              <label htmlFor="fine-input"><strong>Penalty fine ($)</strong></label>
              <input
                id="fine-input"
                type="number"
                min="0"
                step="1"
                className="penalties-bar__fine"
                value={fine}
                onChange={(e) => setFine(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                onBlur={() => saveFine(fine)}
                disabled={savingFine || advancing}
              />
              {savingFine && <span className="penalties-bar__saving">Saving…</span>}
            </div>

            <table className="trade-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Penalties</th>
                  <th>Fine next month</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(teams).map(([uid, t]) => {
                  const name = t.teamName || t.name || '(Team)';
                  const count = Math.max(0, Math.floor(Number(penalties?.[uid]?.count) || 0));
                  return (
                    <tr key={uid}>
                      <td>{name}</td>
                      <td>
                        <div className="penalties-stepper penalties-stepper--compact">
                          <button
                            type="button"
                            className="stepperBtn"
                            onClick={() => savePenalty(uid, Math.max(count - 1, 0))}
                            disabled={advancing || count <= 0}
                            aria-label={`Decrease penalties for ${name}`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            className="penalties-count__input"
                            value={count}
                            onChange={(e) => savePenalty(uid, e.target.value)}
                            disabled={advancing}
                            aria-label={`Penalties for ${name}`}
                          />
                          <button
                            type="button"
                            className="stepperBtn"
                            onClick={() => savePenalty(uid, count + 1)}
                            disabled={advancing}
                            aria-label={`Increase penalties for ${name}`}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>${(count * fine).toFixed(2)}</td>
                    </tr>
                  );
                })}
                {Object.keys(teams).length === 0 && (
                  <tr>
                    <td colSpan="3">No teams yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showStandings && (
        <div className="modal-backdrop" onClick={() => setShowStandings(false)} role="dialog" aria-modal="true">
          <div className="modal-card review-big modal-card--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h3>Standings {standingsRound != null ? `(${monthLabel(standingsRound)})` : ''}</h3>
              <button className="btn btn--link" onClick={() => setShowStandings(false)} aria-label="Close standings">Close</button>
            </div>
            <table className="trade-table modal-card__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Cash</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.uid}>
                    <td>{i + 1}</td>
                    <td>{row.teamName}</td>
                    <td>${Number(row.cash || 0).toFixed(2)}</td>
                  </tr>
                ))}
                {standings.length === 0 && (
                  <tr>
                    <td colSpan="3">No teams yet.</td>
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