// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';

import Lobby from './Lobby';
import TeacherDashboard from './TeacherDashboard';
import TeacherGamePage from './TeacherGamePage';
import GamePage from './GamePage';
import TeacherLogin from './TeacherLogin';
import TeacherProfile from './TeacherProfile';
import TeacherApply from './TeacherApply';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);         // 'admin' | 'teacher' | 'pending_teacher' | 'student' | null
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    let offRole = () => {};
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoaded(true);
      setRole(null);
      setRoleLoaded(false);

      if (!u) {
        // not signed in → no role to load
        setRoleLoaded(true);
        offRole(); // noop first time
        return;
      }

      const roleRef = ref(database, `users/${u.uid}/role`);
      offRole = onValue(
        roleRef,
        (snap) => {
          setRole(snap.val() ?? null);
          setRoleLoaded(true);
        },
        () => setRoleLoaded(true) // even on error, unblock UI
      );
    });

    return () => {
      unsub();
      offRole();
    };
  }, []);

  const isTeacher = role === 'teacher' || role === 'admin';

  // Tiny loader used when a protected route needs role info
  const Loader = <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public / utility routes */}
        <Route path="/teacher/login" element={<TeacherLogin />} />
        <Route path="/teacher/apply" element={<TeacherApply />} />
        <Route path="/teacher/profile" element={<TeacherProfile />} />

        {/* Root → Lobby */}
        <Route path="/" element={<Navigate to="/lobby" replace />} />

        {/* Lobby is open (students can join and will be provisioned) */}
        <Route path="/lobby" element={<Lobby />} />

        {/* Teacher-only routes: wait until roleLoaded before deciding */}
        <Route
          path="/teacher/dashboard"
          element={
            !authLoaded
              ? Loader
              : !user
                ? <Navigate to="/teacher/login" replace />
                : !roleLoaded
                  ? Loader
                  : isTeacher
                    ? <TeacherDashboard />
                    : <Navigate to="/teacher/login" replace />
          }
        />
        <Route
          path="/teacher/game/:gameId"
          element={
            !authLoaded
              ? Loader
              : !user
                ? <Navigate to="/teacher/login" replace />
                : !roleLoaded
                  ? Loader
                  : isTeacher
                    ? <TeacherGamePage />
                    : <Navigate to="/teacher/login" replace />
          }
        />

        {/* Student game view: requires any authenticated user */}
        <Route
          path="/game/:gameId"
          element={
            !authLoaded
              ? Loader
              : user
                ? <GamePage />
                : <Navigate to="/lobby" replace />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}