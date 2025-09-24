// src/TeacherGamePage.js
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { ref, onValue, get, update } from 'firebase/database';
import BrandBar from './BrandBar';
import ReviewTable from './ReviewTable';

const CREDIT_MULTIPLIER = 0.5;
const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

export default function TeacherGamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [commodities, setCommodities] = useState([]);
  const [teams, setTeams] = useState({});
  const [portfolios, setPortfolios] = useState({});
  const [headlines, setHeadlines] = useState([]);
  const [reveals, setReveals] = useState({});
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!gameId) return;
    return onValue(ref(database, `games/${gameId}`), (snap) => setGame(snap.val()));
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    const off1 = onValue(ref(database, `games/${gameId}/teams`), (s) => setTeams(s.val() || {}));
    const off2 = onValue(ref(database, `games/${gameId}/portfolios`), (s) => setPortfolios(s.val() || {}));
    return () => { off1(); off2(); };
  }, [gameId]);

  useEffect(() => {
    get(ref(database, 'constants/commodities')).then((s) => {
      const raw = s.val() || {};
      const list = Array.isArray(raw)
        ? raw.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
        : Object.entries(raw).map(([id, c]) => ({ id, ...c }));
      setCommodities(list.map((c) => ({ ...c, _norm: norm(c.name) })));
    });
  }, []);

  useEffect(() => {
    const round = game?.currentRound;
    if (round == null) return;
    get(ref(database, `constants/headlines/${round}`)).then((s) => {
      const data = s.val();
      const list = Array.isArray(data) ? data : data ? Object.values(data) : [];
      setHeadlines(list);
    });
  }, [game?.currentRound]);

  useEffect(() => {
    if (!gameId || game?.currentRound == null) return;
    const r = ref(database, `games/${gameId}/reveals/${game.currentRound}`);
    const off = onValue(r, (snap) => setReveals(snap.val() || {}));
    return () => off();
  }, [gameId, game?.currentRound]);

  const teamList = useMemo(() => Object.entries(teams).map(([uid, t]) => ({ uid, ...t })), [teams]);

  const withToast = (msg, ms = 1800) => { setToast(msg); setTimeout(() => setToast(''), ms); };

  const toggleState = async () => {
    if (!game) return;
    const next = game.state === 'review' ? 'play' : 'review';
    await update(ref(database, `games/${gameId}`), { state: next });
    withToast(`State: ${next === 'review' ? 'Review (trading locked)' : 'Play (trading open)'}`);
  };

  const advanceMonth = async () => {
    if (!game) return;
    const ok = window.confirm(
      `Advance from Month ${game.currentRound + 1} to ${game.currentRound + 2}?\nAll positions will be liquidated at current prices.`
    );
    if (!ok) return;

    try {
      const [pfSnap, coSnap] = await Promise.all([
        get(ref(database, `games/${gameId}/portfolios`)),
        get(ref(database, 'constants/commodities')),
      ]);
      const pf = pfSnap.val() || {};
      const rawCo = coSnap.val() || {};
      const listCo = Array.isArray(rawCo)
        ? rawCo.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
        : Object.entries(rawCo).map(([id, c]) => ({ id, ...c }));

      const priceMap = {};
      for (const c of listCo) priceMap[c.id] = Number(c.prices?.[game.currentRound] || 0);

      const updates = {};
      Object.entries(pf).forEach(([uid, obj]) => {
        const cash = Number(obj?.cash ?? 0);
        const positions = obj?.positions || {};
        let newCash = cash;
        Object.entries(positions).forEach(([cid, qty]) => {
          const q = Number(qty || 0);
          if (!q) return;
          const price = Number(priceMap[cid] || 0);
          newCash += q * price;
        });
        const newCreditCap = Math.max(0, Math.round(newCash * 0.5));
        updates[`games/${gameId}/portfolios/${uid}`] = { cash: newCash, positions: {}, creditCap: newCreditCap };
      });

      updates[`games/${gameId}/currentRound`] = (game.currentRound || 0) + 1;
      updates[`games/${gameId}/state`] = 'play';

      await update(ref(database), updates);
      withToast('Advanced to next month & liquidated positions ✔️', 2200);
    } catch (e) {
      console.warn('Advance failed:', e);
      withToast('Advance failed', 2000);
    }
  };

  if (!game) {
    return (
      <>
        <BrandBar showLogout />
        <div className="toast-rail"><div className="toast" /></div>
        <div style={{ padding: 16 }}>Loading…</div>
      </>
    );
  }

  const round = game.currentRound ?? 0;

  const dirBadge = (dir, shown) => {
    if (!shown) return <span style={{ color: '#9ca3af' }}>—</span>;
    const up = String(dir || '').toLowerCase() === 'up';
    return (
      <span
        style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          color: up ? '#065f46' : '#7c2d12',
          background: up ? '#ecfdf5' : '#ffedd5',
          border: `1px solid ${up ? '#a7f3d0' : '#fed7aa'}`
        }}
      >
        {up ? 'Up' : 'Down'}
      </span>
    );
  };

  // Toggle a single headline reveal
  const toggleReveal = async (idx) => {
    if (game?.currentRound == null) return;
    const path = `games/${gameId}/reveals/${game.currentRound}/${idx}`;
    const next = !(reveals?.[idx] === true || reveals?.[idx] === 'true' || reveals?.[idx] === 1);
    try {
      await update(ref(database), { [path]: next });
    } catch (e) {
      console.warn('Reveal toggle failed:', e);
      withToast('Reveal toggle failed', 2000);
    }
  };

  return (
    <>
      <BrandBar showLogout />

      <div className="toast-rail">
        <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
      </div>

      <div style={{ padding: 16, maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>
            Game: {game.name} &nbsp;•&nbsp; Month {round + 1}
          </h1>
          <div>
            <button className="btn" onClick={() => navigate('/teacher/dashboard')} style={{ marginRight: 8 }}>
              ← Back to Dashboard
            </button>
            <button className="btn" onClick={toggleState} style={{ marginRight: 8 }}>
              {game.state === 'review' ? 'Switch to Play' : 'Switch to Review'}
            </button>
            <button className="btn primary" onClick={advanceMonth}>
              Advance Month
            </button>
          </div>
        </div>

        <div style={{ marginTop: 8, color: '#6b7280' }}>
          Code:{' '}
          <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 6 }}>{game.code}</code>
          {'  '}• State: <strong>{game.state || 'play'}</strong>
          {'  '}• Teams: <strong>{teamList.length}</strong>
        </div>

        {game.state === 'review' ? (
          <>
            {/* Headline reveal table */}
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Headlines — Reveal Effects</h3>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table className="trade-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 8px', width: '55%' }}>Headline</th>
                      <th style={{ padding: '10px 8px', width: '20%' }}>Commodity</th>
                      <th style={{ padding: '10px 8px', width: '15%' }}>Direction</th>
                      <th style={{ padding: '10px 8px', width: '10%' }}>Reveal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headlines.map((h, idx) => {
                      const eff = Array.isArray(h?.effects) && h.effects.length > 0 ? h.effects[0] : null;
                      const revealed = reveals?.[idx] === true || reveals?.[idx] === 'true' || reveals?.[idx] === 1;
                      const comm = eff?.commodity || '';
                      const dir = eff?.change || '';
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '8px' }}>{h?.text || String(h)}</td>
                          <td style={{ padding: '8px' }}>{revealed ? comm : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                          <td style={{ padding: '8px' }}>{dirBadge(dir, revealed)}</td>
                          <td style={{ padding: '8px' }}>
                            <button className="btn" onClick={() => toggleReveal(idx)}>
                              {revealed ? 'Hide' : 'Reveal'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ color: '#6b7280', marginTop: 8 }}>
                Revealed effects will highlight the Review Table below:
                <span style={{ color: '#065f46', fontWeight: 600 }}> green</span> = aligned choice,
                <span style={{ color: '#7c2d12', fontWeight: 600 }}> red</span> = opposite choice.
              </p>
            </div>

            {/* Review table — now receives headlines + reveals for highlighting */}
            <div style={{ marginTop: 16 }}>
              <ReviewTable
                gameId={gameId}
                round={round}
                commodities={commodities}
                headlines={headlines}
                reveals={reveals}
              />
            </div>
          </>
        ) : (
          <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Headlines — Month {round + 1}</h3>
            {headlines.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {headlines.map((h, i) => <li key={i}>{h?.text || String(h)}</li>)}
              </ul>
            ) : (
              <div style={{ color: '#6b7280' }}>No headlines.</div>
            )}
          </div>
        )}

        {/* Simple portfolios table (kept as a quick summary) */}
        <div style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 8 }}>Teams & Cash</h3>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <table className="trade-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 8px' }}>Team</th>
                  <th style={{ padding: '10px 8px' }}>Cash</th>
                </tr>
              </thead>
              <tbody>
                {teamList.map((t) => {
                  const pf = portfolios[t.uid] || {};
                  return (
                    <tr key={t.uid}>
                      <td style={{ padding: '8px' }}>{t.name || t.teamName || t.uid}</td>
                      <td style={{ padding: '8px' }}>${Number(pf.cash ?? 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}