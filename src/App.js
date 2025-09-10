// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';

import Lobby from './Lobby';
import TeacherDashboard from './TeacherDashboard';
import TeacherGamePage   from './TeacherGamePage';
import GamePage from './GamePage';
import TeacherLogin    from './TeacherLogin';

export default function App() {
  const [user, setUser] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const snap = await get(ref(database, `admins/${u.uid}`));
          setIsTeacher(snap.exists());
        } catch {
          setIsTeacher(false);
        }
      } else {
        setUser(null);
        setIsTeacher(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <p>Loading…</p>;
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* Teacher login */}
        <Route path="/teacher/login" element={<TeacherLogin />} />

        {/* Redirect root to lobby */}
        <Route path="/" element={<Navigate to="/lobby" replace />} />

        {/* Lobby: join by code (no prior auth required) */}
        <Route path="/lobby" element={<Lobby />} />

        {/* Teacher dashboard: only for admins */}
        <Route
          path="/teacher/dashboard"
          element={
            user && isTeacher ? (
              <TeacherDashboard />
            ) : (
              <Navigate to="/teacher/login" replace />
            )
          }
        />
        <Route
          path="/teacher/game/:gameId"
          element={ user && isTeacher ? <TeacherGamePage /> : <Navigate to="/teacher/login" /> }
        />

        {/* Game view: requires authenticated student/team */}
        <Route
          path="/game/:gameId"
          element={
            user ? <GamePage /> : <Navigate to="/lobby" replace />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
