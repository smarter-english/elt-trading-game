// src/ReviewTable.js
import React, { useEffect, useState } from 'react';
import { database } from './firebase';
import { ref, get } from 'firebase/database';

export default function ReviewTable({ gameId, highlightedEffects = {} }) {
  const [teams, setTeams] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [positionsMap, setPositionsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      // Load teams and their names
      const teamsSnap = await get(ref(database, `games/${gameId}/teams`));
      const teamsRaw = teamsSnap.val() || {};
      const teamsArr = Object.entries(teamsRaw).map(([uid, data]) => ({ uid, teamName: data.teamName }));
      setTeams(teamsArr);

      // Load commodities list
      const commSnap = await get(ref(database, 'constants/commodities'));
      const commRaw = commSnap.val() || {};
      const commList = Array.isArray(commRaw)
        ? commRaw.map((c, i) => ({ id: c.id || `commodity-${i}`, name: c.name }))
        : Object.entries(commRaw).map(([id, c]) => ({ id, name: c.name }));
      setCommodities(commList);

      // Load positions for each team
      const posMap = {};
      for (const { uid } of teamsArr) {
        const posSnap = await get(ref(database, `games/${gameId}/portfolios/${uid}/positions`));
        posMap[uid] = posSnap.val() || {};
      }
      setPositionsMap(posMap);
      setLoading(false);
    }

    loadData();
  }, [gameId]);

  if (loading) return <p>Loading review table…</p>;
  if (teams.length === 0) return <p>No teams have joined this game yet.</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
      <thead>
        <tr>
          <th style={{ padding: 8, border: '1px solid #ddd' }}>Commodity</th>
          {teams.map(t => (
            <th key={t.uid} style={{ padding: 8, border: '1px solid #ddd' }}>{t.teamName}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {commodities.map(c => (
          <tr key={c.id}>
            <td style={{ padding: 8, border: '1px solid #ddd' }}>{c.name}</td>
            {teams.map(t => {
              const qty = positionsMap[t.uid]?.[c.id] ?? 0;
              const effect = highlightedEffects[c.name]; // 'up' or 'down'
              let bg = 'transparent';
              if (effect === 'down') {
                bg = qty < 0 ? '#d4edda' /* green */ : '#f8d7da' /* red */;
              } else if (effect === 'up') {
                bg = qty > 0 ? '#d4edda' : '#f8d7da';
              }
              return (
                <td
                  key={t.uid}
                  style={{
                    textAlign: 'center',
                    padding: 8,
                    border: '1px solid #ddd',
                    backgroundColor: bg
                  }}
                >
                  {qty}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
