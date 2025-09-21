// src/TeacherGamePage.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from './firebase';
import { ref, onValue, get, update, runTransaction, set } from 'firebase/database';
import ReviewTable from './ReviewTable';

const CREDIT_MULTIPLIER = 0.5;

// Normalize names so "Crude oil" == "Crude Oil" == "crude-oil"
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

  // Advancing + status
  const [advancing, setAdvancing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusPersist, setStatusPersist] = useState(false);

  // Standings popup
  const [showStandings, setShowStandings] = useState(false);
  const [standings, setStandings] = useState([]); // [{uid, teamName, cash}]
  const [standingsRound, setStandingsRound] = useState(null);

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

  // Fetch & show saved standings for the current (post-advance) round
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

  // Advance round and liquidate portfolios, then save standings snapshot + return to trading
  const handleAdvance = async () => {
    if (
      !window.confirm(
        `Advance to Month ${currentRound + 2} and liquidate all teams' positions at next-month prices?`
      )
    ) {
      return;
    }

    const nextRound = currentRound + 1;
    setAdvancing(true);
    setStatusText('');
    setStatusPersist(false);

    try {
      // 1) flip to next month + ensure trading state
      await update(ref(database, `games/${gameId}`), {
        currentRound: nextRound,
        state: 'trading'
      });

      // 2) fetch commodity data (one-time)
      const commSnap = await get(ref(database, 'constants/commodities'));
      const raw = commSnap.val() || {};
      const commodities = Array.isArray(raw)
        ? raw.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
        : Object.entries(raw).map(([id, c]) => ({ id, ...c }));

      // 3) fetch all portfolios and teams (one-time)
      const [pfSnap, teamsSnap] = await Promise.all([
        get(ref(database, `games/${gameId}/portfolios`)),
        get(ref(database, `games/${gameId}/teams`))
      ]);
      const portfolios = pfSnap.val() || {};
      const teams = teamsSnap.val() || {};

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

      // 5) re-read portfolios AFTER liquidation to compute standings
      const pfSnap2 = await get(ref(database, `games/${gameId}/portfolios`));
      const portfoliosAfter = pfSnap2.val() || {};

      const list = Object.keys(teams).map((uid) => {
        const t = teams[uid] || {};
        const p = portfoliosAfter[uid] || {};
        return {
          uid,
          teamName: t.teamName || t.name || '(Team)',
          cash: typeof p.cash === 'number' ? p.cash : 0
        };
      });

      // Include any portfolio that exists but team record is missing (edge case)
      Object.keys(portfoliosAfter).forEach((uid) => {
        if (!list.find((x) => x.uid === uid)) {
          const p = portfoliosAfter[uid] || {};
          list.push({
            uid,
            teamName: '(Team)',
            cash: typeof p.cash === 'number' ? p.cash : 0
          });
        }
      });

      // Sort by cash desc
      list.sort((a, b) => b.cash - a.cash);

      // 6) save snapshot to games/{gameId}/standings/{nextRound}
      await set(ref(database, `games/${gameId}/standings/${nextRound}`), {
        round: nextRound,
        computedAt: Date.now(),
        list
      });

      // 7) show persistent banner + allow popup
      setStatusText(
        `✅ Advanced to Month ${nextRound + 1}. Standings snapshot saved for Month ${nextRound}.`
      );
      setStatusPersist(true);
      setStandings(list);
      setStandingsRound(nextRound);
      setShowStandings(true); // auto-open; close when ready
    } catch (err) {
      console.error('Advance failed:', err);
      setStatusText(`❌ Advance failed: ${err?.message || 'Unknown error'}`);
      setStatusPersist(true);
    } finally {
      setAdvancing(false);
    }
  };

  // Toggle review <-> play (no round change)
  const handleToggleReview = async () => {
    if (advancing) return;
    await update(ref(database, `games/${gameId}`), {
      state: state === 'review' ? 'trading' : 'review'
    });
  };

  const toggleReveal = (idx) => setRevealed((r) => ({ ...r, [idx]: !r[idx] }));

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => navigate('/teacher/dashboard')}>&larr; Back to Dashboard</button>
      <h2>Game: {game?.name}</h2>
      <p>
        Month {currentRound + 1} &bull; State: <em>{state}</em>
      </p>

      {/* Status banner (persistent until dismissed if statusPersist) */}
      {statusText && (
        <div
          style={{
            background: statusText.startsWith('✅') ? '#eef9f0' : statusText.startsWith('❌') ? '#fff2f2' : '#eef6ff',
            border: `1px solid ${
              statusText.startsWith('✅') ? '#bfe4c7' : statusText.startsWith('❌') ? '#f3c2c2' : '#cfe3ff'
            }`,
            padding: 8,
            borderRadius: 6,
            margin: '8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'space-between'
          }}
          aria-live="polite"
        >
          <span>{statusText}</span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <button onClick={openStandings}>View full standings</button>
            {statusPersist && (
              <button onClick={() => { setStatusText(''); setStatusPersist(false); }}>Dismiss</button>
            )}
          </span>
        </div>
      )}

      {/* Headlines: list during trading; table with reveal during review */}
      {state !== 'review' ? (
        <div style={{ border: '1px solid #ccc', padding: 12, margin: '1em 0' }}>
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
                    <button onClick={() => toggleReveal(idx)} disabled={advancing}>
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
      <div style={{ margin: '1em 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={handleAdvance} disabled={advancing}>
          {advancing ? 'Advancing…' : `Advance to Month ${currentRound + 2}`}
        </button>
        <button onClick={handleToggleReview} disabled={advancing}>
          {state === 'review' ? 'Back to Play' : 'Enter Review Mode'}
        </button>
        <button onClick={openStandings} disabled={advancing}>
          Show last standings
        </button>
      </div>

      {/* Review positions table */}
      {state === 'review' && (
        <div style={{ border: '1px solid #999', padding: 12 }}>
          <h4>Review Positions for Month {currentRound}</h4>
          <ReviewTable gameId={gameId} highlightedEffects={revealedMap} />
        </div>
      )}
// In your existing TeacherGamePage.js, replace the modal block near the end with this:

      {/* Standings modal */}
      {showStandings && (
        <div
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => e.key === 'Escape' && setShowStandings(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowStandings(false)}
        >
          <div
            style={{ background: '#fff', padding: 16, borderRadius: 10, minWidth: 380, maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 style={{ margin: 0 }}>
                Standings {standingsRound != null ? `(Month ${standingsRound})` : ''}
              </h3>
              <button
                ref={(el) => el && el.focus()}
                onClick={() => setShowStandings(false)}
                aria-label="Close standings"
              >
                Close
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>Rank</th>
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
                    <td colSpan="3" style={{ padding: 12, textAlign: 'center', color: '#666' }}>
                      No teams yet.
                    </td>
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