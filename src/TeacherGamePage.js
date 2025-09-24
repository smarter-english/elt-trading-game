// src/TeacherGamePage.js
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import {
  ref,
  onValue,
  get,
  update,
} from 'firebase/database';
import BrandBar from './BrandBar';

const CREDIT_MULTIPLIER = 0.5;

export default function TeacherGamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [commodities, setCommodities] = useState([]);
  const [teams, setTeams] = useState({});
  const [portfolios, setPortfolios] = useState({});
  const [headlines, setHeadlines] = useState([]);
  const [toast, setToast] = useState('');

  // load game
  useEffect(() => {
    if (!gameId) return;
    return onValue(ref(database, `games/${gameId}`), (snap) => {
      setGame(snap.val());
    });
  }, [gameId]);

  // load teams & portfolios
  useEffect(() => {
    if (!gameId) return;
    const off1 = onValue(ref(database, `games/${gameId}/teams`), (s) => setTeams(s.val() || {}));
    const off2 = onValue(ref(database, `games/${gameId}/portfolios`), (s) => setPortfolios(s.val() || {}));
    return () => { off1(); off2(); };
  }, [gameId]);

  // one-time commodities
  useEffect(() => {
    get(ref(database, 'constants/commodities')).then((s) => {
      const raw = s.val() || {};
      const list = Array.isArray(raw)
        ? raw.map((c, i) => ({ id: c.id || `commodity-${i}`, ...c }))
        : Object.entries(raw).map(([id, c]) => ({ id, ...c }));
      setCommodities(list);
    });
  }, []);

  // headlines for current round (simple view)
  useEffect(() => {
    const round = game?.currentRound;
    if (round == null) return;
    get(ref(database, `constants/headlines/${round}`)).then((s) => {
      const data = s.val();
      const list = Array.isArray(data) ? data : data ? Object.values(data) : [];
      setHeadlines(list);
    });
  }, [game?.currentRound]);

  const teamList = useMemo(() => Object.entries(teams).map(([uid, t]) => ({ uid, ...t })), [teams]);

  const withToast = (msg, ms = 1800) => {
    setToast(msg);
    setTimeout(() => setToast(''), ms);
  };

  const toggleState = async () => {
    if (!game) return;
    const next = game.state === 'review' ? 'play' : 'review';
    await update(ref(database, `games/${gameId}`), { state: next });
    withToast(`State: ${next === 'review' ? 'Review (trading locked)' : 'Play (trading open)'}`);
  };

  const advanceMonth = async () => {
    if (!game) return;
    const ok = window.confirm(
      `Advance from Month ${game.currentRound + 1} to ${game.currentRound + 2}?\n` +
      `All positions will be liquidated at current prices.`
    );
    if (!ok) return;

    try {
      // read latest portfolios & commodities
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
      for (const c of listCo) {
        priceMap[c.id] = Number(c.prices?.[game.currentRound] || 0);
      }

      const updates = {};

      // liquidate each team portfolio at current round prices
      Object.entries(pf).forEach(([uid, obj]) => {
        const cash = Number(obj?.cash ?? 0);
        const positions = obj?.positions || {};
        let newCash = cash;

        Object.entries(positions).forEach(([cid, qty]) => {
          const q = Number(qty || 0);
          if (!q) return;
          const price = Number(priceMap[cid] || 0);
          // close position: positive qty -> sell, negative qty -> buy back
          newCash += q * price;
        });

        const newCreditCap = Math.max(0, Math.round(newCash * CREDIT_MULTIPLIER));
        updates[`games/${gameId}/portfolios/${uid}`] = {
          cash: newCash,
          positions: {},
          creditCap: newCreditCap,
        };
      });

      // bump round & return to 'play'
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

  return (
    <>
      <BrandBar showLogout />

      {/* Toast rail (no layout shift) */}
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
          <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 6 }}>
            {game.code}
          </code>
          {'  '}• State: <strong>{game.state || 'play'}</strong>
          {'  '}• Teams: <strong>{teamList.length}</strong>
        </div>

        {/* Headlines (simple view for parity). If you use an advanced ReviewTable, insert it in review state. */}
        <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Headlines — Month {round + 1}</h3>
          {headlines.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {headlines.map((h, i) => (
                <li key={i}>{h?.text || String(h)}</li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#6b7280' }}>No headlines.</div>
          )}
        </div>

        {/* Basic portfolios view (read-only) */}
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

        {/* If you prefer your existing ReviewTable during review: */}
        {/* {game.state === 'review' && (
          <ReviewTable gameId={gameId} round={round} commodities={commodities} />
        )} */}
      </div>
    </>
  );
}