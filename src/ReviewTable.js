import React, { useMemo } from 'react';

const normName = (s) =>
  (s || '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

/**
 * Props:
 * - commodities: [{id, name, prices: number[]}, ...]
 * - teams: { uid: { teamName } }
 * - portfolios: { uid: { cash, positions: { [commodityId]: qty } } }
 * - highlightedEffects: { [normalizedCommodityName]: 'up' | 'down' }
 */
export default function ReviewTable({ commodities = [], teams = {}, portfolios = {}, highlightedEffects = {} }) {
  const teamList = useMemo(
    () =>
      Object.entries(teams).map(([uid, t]) => ({
        uid,
        name: t?.teamName || t?.name || uid.slice(0, 6)
      })),
    [teams]
  );

  const rows = useMemo(() => {
    return commodities.map((c) => {
      const norm = normName(c?.name);
      const eff = highlightedEffects[norm]; // 'up' | 'down' | undefined
      return { ...c, _norm: norm, _eff: eff };
    });
  }, [commodities, highlightedEffects]);

  const cellStyle = (qty, eff) => {
    if (!eff || !qty) return { background: 'transparent' }; // unrevealed or flat
    const good = (eff === 'up' && qty > 0) || (eff === 'down' && qty < 0);
    const bad = (eff === 'up' && qty < 0) || (eff === 'down' && qty > 0);
    if (good) return { background: 'rgba(0, 180, 0, 0.13)' };
    if (bad) return { background: 'rgba(220, 0, 0, 0.12)' };
    return { background: 'transparent' };
  };

  return (
    <table className="trade-table">
      <thead>
        <tr>
          <th>Commodity</th>
          {teamList.map((t) => (
            <th key={t.uid} style={{ textAlign: 'right' }}>{t.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id}>
            <td>{c.name}</td>
            {teamList.map((t) => {
              const qty = Number(portfolios?.[t.uid]?.positions?.[c.id] || 0);
              const sign = qty > 0 ? '+' : qty < 0 ? '' : '';
              return (
                <td key={t.uid} style={{ ...cellStyle(qty, c._eff), textAlign: 'right' }}>
                  {qty ? `${sign}${qty}` : '—'}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}