// src/ReviewTable.js
import React, { useEffect, useMemo, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';

const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

export default function ReviewTable({ gameId, round, commodities, headlines, reveals }) {
  const [teams, setTeams] = useState({});
  const [portfolios, setPortfolios] = useState({});

  useEffect(() => {
    if (!gameId) return;
    const off1 = onValue(ref(database, `games/${gameId}/teams`), (s) => setTeams(s.val() || {}));
    const off2 = onValue(ref(database, `games/${gameId}/portfolios`), (s) => setPortfolios(s.val() || {}));
    return () => { off1(); off2(); };
  }, [gameId]);

  // Map: normalized commodity name -> commodityId
  const nameToId = useMemo(() => {
    const map = {};
    (commodities || []).forEach((c) => {
      if (!c) return;
      map[norm(c.name)] = c.id;
    });
    return map;
  }, [commodities]);

  // Build effect map from revealed headlines for this round
  // { [commodityId]: 'up' | 'down' }
  const effectByCommodityId = useMemo(() => {
    const effMap = {};
    if (!Array.isArray(headlines)) return effMap;
    headlines.forEach((h, idx) => {
      const revealed = reveals?.[idx] === true || reveals?.[idx] === 'true' || reveals?.[idx] === 1;
      if (!revealed) return;
      const eff = Array.isArray(h?.effects) && h.effects.length ? h.effects[0] : null;
      if (!eff) return;
      const cid = nameToId[norm(eff.commodity)];
      if (!cid) return;
      // If multiple revealed headlines hit the same commodity, last one wins (simple approach)
      const dir = String(eff.change || '').toLowerCase() === 'up' ? 'up' : 'down';
      effMap[cid] = dir;
    });
    return effMap;
  }, [headlines, reveals, nameToId]);

  const teamList = useMemo(
    () => Object.entries(teams).map(([uid, t]) => ({ uid, name: t.name || t.teamName || uid })),
    [teams]
  );

  const rows = useMemo(() => commodities || [], [commodities]);

  const cellStyle = (cid, qty) => {
    const dir = effectByCommodityId[cid];
    if (!dir || !qty) return { background: 'transparent' };
    const good = (dir === 'up' && qty > 0) || (dir === 'down' && qty < 0);
    return {
      background: good ? '#ecfdf5' : '#fee2e2',
      color: good ? '#065f46' : '#7c2d12',
      fontWeight: 600
    };
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <table className="trade-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: '10px 8px' }}>Commodity</th>
            {teamList.map((t) => (
              <th key={t.uid} style={{ padding: '10px 8px' }}>{t.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const cid = c.id;
            return (
              <tr key={cid}>
                <td style={{ padding: '8px', fontWeight: 600 }}>{c.name}</td>
                {teamList.map((t) => {
                  const pos = portfolios?.[t.uid]?.positions?.[cid] || 0;
                  return (
                    <td key={t.uid} style={{ padding: '8px', textAlign: 'center', ...cellStyle(cid, pos) }}>
                      {pos ? `${pos > 0 ? '+' : ''}${pos} units` : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}