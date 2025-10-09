import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from './firebase';
import headlines from './headlines';
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
  const [qrForGame, setQrForGame] = useState(null); // {id, code, name} | null

  useEffect(() => {
    if (!uid) return;
    const uref = ref(database, `users/${uid}`);
    return onValue(uref, (snap) => setProfile(snap.val() || null));
  }, [uid]);

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
      () => setGames([])
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
  const reseedHeadlines = async () => {
    if (!window.confirm('Overwrite constants/headlines with the latest file?')) return;
    try {
      await update(ref(database), { 'constants/headlines': headlines });
      alert('Headlines re-seeded ✔');
    } catch (e) {
      console.warn('Re-seed failed', e);
      alert(e?.message || 'Re-seed failed');
    }
  };

  const QrModal = ({ game, onClose }) => {
    if (!game) return null;
    const base = window.location.origin;
    const joinUrl = `${base}/j/${game.code || ''}`;
    const copy = async () => {
      try { await navigator.clipboard.writeText(joinUrl); alert('Join link copied!'); }
      catch { alert(joinUrl); }
    };
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal-card review-big modal-card--xl" onClick={(e) => e.stopPropagation()}>
          <div className="modal-card__header">
            <h3>Join “{game.name}”</h3>
            <button className="btn btn--link" onClick={onClose}>Close</button>
          </div>
          <div className="modal-card__qr">
            <QRCodeCanvas
              value={joinUrl}
              size={Math.min(480, Math.floor(window.innerWidth * 0.6))}  /* ~360–480px on laptops */
              level="M"
              includeMargin
            />
          </div>
          <div className="modal-card__link">{joinUrl}</div>
          <div className="modal-card__actions">
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

      <div className="page-container">
        <header className="teacher-topbar">
          <h1 className="teacher-topbar__title">
            {displayName ? `${displayName}'s Dashboard` : 'Teacher Dashboard'}
          </h1>
          <div className="teacher-topbar__actions">
            <button className="btn" onClick={() => navigate('/teacher/profile')}>Profile</button>
          </div>
        </header>

        <section className="panel">
          <h3>Create a new game</h3>
          {msg && <div className="notice">{msg}</div>}
          <form className="form-row" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Game name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="btn" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create Game'}
            </button>
          </form>
          <p className="muted">Codes are 6 letters only (e.g., <strong>FWZKQP</strong>).</p>
        </section>

        <section className="games-section">
          <h3>Your games</h3>
          {games.length === 0 ? (
            <p className="muted">No games yet. Create your first game above.</p>
          ) : (
            <div className="cards">
              {games.map((g) => (
                <div key={g.id} className="card panel">
                  <div className="card__header">
                    <div className="card__title">
                      <div className="card__name">{g.name}</div>
                      <div className="card__meta">
                        Code: <code>{g.code}</code> • Month {g.currentRound + 1} ({monthLabel(g.currentRound)}) • State: {g.state}
                      </div>
                    </div>
                    <div className="card__actions">
                      <button className="btn" onClick={() => navigate(`/teacher/game/${g.id}`)}>Manage</button>
                      <button className="btn btn--neutral" onClick={() => setQrForGame({ id: g.id, code: g.code, name: g.name })}>Show QR</button>
                      {/* <button className="btn" onClick={reseedHeadlines}>Re-seed Headlines</button> */}
                    </div>
                  </div>

                  <div className="table-scroll">
                    <table className="trade-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Status</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.teams.length === 0 ? (
                          <tr><td colSpan={4} className="muted">No teams yet.</td></tr>
                        ) : (
                          [...g.teams]
                            .sort((a, b) => {
                              const rank = (s) => (s === 'pending' ? 0 : s === 'approved' ? 1 : 2);
                              return rank(a.status) - rank(b.status);
                            })
                            .map((t) => (
                              <tr key={t.uid}>
                                <td>{t.teamName}</td>
                                <td>{t.status === 'approved' ? '✅ approved' : t.status === 'pending' ? '⏳ pending' : t.status}</td>
                                <td>{t.joinedAt ? new Date(t.joinedAt).toLocaleString() : '—'}</td>
                                <td>
                                  {t.status === 'pending' ? (
                                    <>
                                      <button className="btn" onClick={() => approveTeam(g.id, t.uid)}>Approve</button>
                                      <button className="btn btn--danger" onClick={() => kickTeam(g.id, t.uid)}>Kick</button>
                                    </>
                                  ) : (
                                    <span className="muted">—</span>
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

      {qrForGame && <QrModal game={qrForGame} onClose={() => setQrForGame(null)} />}
    </div>
  );
}