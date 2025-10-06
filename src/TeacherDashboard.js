// src/TeacherDashboard.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import {
  ref,
  onValue,
  query,
  orderByChild,
  equalTo,
  push,
  set,
  get,
  update,
  remove,
} from 'firebase/database';
import BrandBar from './BrandBar';
import { QRCodeCanvas } from 'qrcode.react';

function sixCharCode() {
  // Letters only; skip I and O to avoid confusion with 1/0
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 6; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return s;
}
async function generateUniqueCode() {
  for (let i = 0; i < 5; i++) {
    const code = sixCharCode();
    const snap = await get(ref(database, `gamesByCode/${code}`));
    if (!snap.exists()) return code;
  }
  return sixCharCode();
}
function monthLabel(idx) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const n = Number(idx) || 0;
  return months[n % 12];
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid || null;

  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [msg, setMsg] = useState('');

  // QR modal state
  const [qrForGame, setQrForGame] = useState(null); // {id, code, name} | null

  // Profile
  useEffect(() => {
    if (!uid) return;
    const uref = ref(database, `users/${uid}`);
    return onValue(uref, (snap) => setProfile(snap.val() || null));
  }, [uid]);

  // My games
  useEffect(() => {
    if (!uid) return;
    const qref = query(ref(database, 'games'), orderByChild('createdBy'), equalTo(uid));
    const off = onValue(
      qref,
      (snap) => {
        const val = snap.val() || {};
        const list = Object.entries(val).map(([id, g]) => {
          const teamsObj = g?.teams || {};
          const teams = Object.entries(teamsObj).map(([tuid, t]) => ({
            uid: tuid,
            teamName: t?.teamName || t?.name || '(unnamed)',
            status: t?.status || 'pending',
            joinedAt: t?.joinedAt || 0,
          }));
          let pending = 0, approved = 0;
          teams.forEach((t) => (t.status === 'approved' ? approved++ : pending++));
          return {
            id,
            name: g?.name || '(unnamed)',
            code: g?.code || '',
            createdAt: g?.createdAt || 0,
            currentRound: g?.currentRound ?? 0,
            state: g?.state || 'play',
            teams,
            pending,
            approved,
          };
        });
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setGames(list);
      },
      (err) => {
        console.warn('Dashboard query error:', err);
        setGames([]);
      }
    );
    return () => off();
  }, [uid]);

  const displayName = useMemo(() => {
    if (!profile) return '';
    const fn = profile.firstName || '';
    const ln = profile.lastName || '';
    const full = `${fn} ${ln}`.trim();
    return full || profile.email || '';
  }, [profile]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!uid || creating) return;

    const name = (newName || '').trim() || `Game ${new Date().toLocaleDateString()}`;
    setCreating(true);
    setMsg('');

    try {
      const code = await generateUniqueCode();

      const gamesRef = ref(database, 'games');
      const newRef = push(gamesRef);
      const gameId = newRef.key;

      const now = Date.now();
      const payload = {
        name,
        createdBy: uid,
        createdAt: now,
        currentRound: 0,
        state: 'play',
        code,
      };

      await set(newRef, payload);
      await set(ref(database, `gamesByCode/${code}`), gameId);

      setNewName('');
      navigate(`/teacher/game/${gameId}`);
    } catch (err) {
      console.warn('Create game failed', err);
      setMsg(err?.message || 'Failed to create game.');
    } finally {
      setCreating(false);
    }
  };

  // Approve: status -> approved, seed portfolio if missing
  const approveTeam = useCallback(async (gameId, teamUid) => {
    try {
      await update(ref(database, `games/${gameId}/teams/${teamUid}`), { status: 'approved' });
      const pRef = ref(database, `games/${gameId}/portfolios/${teamUid}`);
      const pSnap = await get(pRef);
      if (!pSnap.exists()) {
        await set(pRef, { cash: 10000, creditCap: 5000, positions: {} });
      }
    } catch (e) {
      console.warn('Approve failed', e);
      alert(e?.message || 'Failed to approve team.');
    }
  }, []);

  // Kick: delete team (and portfolio) so it disappears
  const kickTeam = useCallback(async (gameId, teamUid) => {
    try {
      const sure = window.confirm('Remove this team from the game? This will also delete their portfolio.');
      if (!sure) return;
      await remove(ref(database, `games/${gameId}/teams/${teamUid}`));
      await remove(ref(database, `games/${gameId}/portfolios/${teamUid}`));
    } catch (e) {
      console.warn('Kick failed', e);
      alert(e?.message || 'Failed to remove team.');
    }
  }, []);

  // QR modal content
  const QrModal = ({ game, onClose }) => {
    if (!game) return null;
    const base = window.location.origin;
    const joinUrl = `${base}/lobby?code=${game.code || ''}`;

    const copy = async () => {
      try {
        await navigator.clipboard.writeText(joinUrl);
        alert('Join link copied!');
      } catch {
        alert(joinUrl);
      }
    };

    return (
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'grid', placeItems: 'center', zIndex: 1000
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ background: '#fff', padding: 16, borderRadius: 12, width: 360, maxWidth: '92vw' }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Join “{game.name}”</h3>
          <p style={{ margin: 0, color: '#374151' }}>
            Scan to open the Lobby with the code pre-filled:
          </p>

          <div style={{ display: 'grid', placeItems: 'center', margin: '12px 0' }}>
            <QRCodeCanvas value={joinUrl} size={224} level="M" includeMargin />
          </div>

          <div style={{ fontSize: 12, color: '#6b7280', wordBreak: 'break-all', marginBottom: 10 }}>
            {joinUrl}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={copy}>Copy link</button>
            <button className="btn btn--primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <BrandBar showLogout />

      <div style={{ maxWidth: 1000, margin: '16px auto', padding: '0 12px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ margin: 0 }}>
            {displayName ? `${displayName}'s Dashboard` : 'Teacher Dashboard'}
          </h1>
          <button className="btn" onClick={() => navigate('/teacher/profile')}>Profile</button>
        </header>

        {/* Create Game */}
        <section style={{ marginTop: 16, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Create a new game</h3>
          {msg && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
              {msg}
            </div>
          )}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Game name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', minWidth: 260 }}
            />
            <button className="btn" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create Game'}
            </button>
          </form>
          <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 12 }}>
            Codes are 6 letters only (e.g., <strong>FWZKQP</strong>).
          </p>
        </section>

        {/* Games with team approvals + QR */}
        <section style={{ marginTop: 20 }}>
          <h3>Your games</h3>
          {games.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No games yet. Create your first game above.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {games.map((g) => (
                <div key={g.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{g.name}</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>
                        Code: <code>{g.code}</code> &nbsp;•&nbsp; Month {g.currentRound + 1} ({monthLabel(g.currentRound)}) &nbsp;•&nbsp; State: {g.state}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn" onClick={() => navigate(`/teacher/game/${g.id}`)}>
                        Manage
                      </button>
                      <button className="btn btn--neutral" onClick={() => setQrForGame({ id: g.id, code: g.code, name: g.name })}>
                        Show QR
                      </button>
                    </div>
                  </div>

                  {/* Teams nested table */}
                  <div style={{ marginTop: 12, overflowX: 'auto' }}>
                    <table className="trade-table">
                      <thead>
                        <tr>
                          <th style={{ minWidth: 180 }}>Team</th>
                          <th>Status</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.teams.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ color: '#6b7280' }}>No teams yet.</td>
                          </tr>
                        ) : (
                          [...g.teams]
                            .sort((a, b) => {
                              const rank = (s) => (s === 'pending' ? 0 : s === 'approved' ? 1 : 2);
                              return rank(a.status) - rank(b.status);
                            })
                            .map((t) => (
                              <tr key={t.uid}>
                                <td>{t.teamName}</td>
                                <td>
                                  {t.status === 'approved' ? '✅ approved'
                                    : t.status === 'pending' ? '⏳ pending'
                                    : t.status}
                                </td>
                                <td>{t.joinedAt ? new Date(t.joinedAt).toLocaleString() : '—'}</td>
                                <td>
                                  {t.status === 'pending' ? (
                                    <>
                                      <button className="btn" onClick={() => approveTeam(g.id, t.uid)}>
                                        Approve
                                      </button>
                                      <button
                                        className="btn"
                                        onClick={() => kickTeam(g.id, t.uid)}
                                        style={{ marginLeft: 8, background: '#c33', color: '#fff' }}
                                      >
                                        Kick
                                      </button>
                                    </>
                                  ) : (
                                    <span style={{ color: '#6b7280' }}>—</span>
                                  )}
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* QR modal */}
      {qrForGame && <QrModal game={qrForGame} onClose={() => setQrForGame(null)} />}
    </div>
  );
}