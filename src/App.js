// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, database } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import 'odometer/themes/odometer-theme-minimal.css';

import Lobby from './Lobby';
import TeacherDashboard from './TeacherDashboard';
import TeacherGamePage from './TeacherGamePage';
import GamePage from './GamePage';
import TeacherLogin from './TeacherLogin';
import TeacherProfile from './TeacherProfile';
import TeacherApply from './TeacherApply';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'admin' | 'teacher' | 'pending_teacher' | 'student' | null
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
        setRoleLoaded(true);
        offRole(); // noop safe
        return;
      }

      const roleRef = ref(database, `users/${u.uid}/role`);
      offRole = onValue(
        roleRef,
        (snap) => {
          setRole(snap.val() ?? null);
          setRoleLoaded(true);
        },
        () => setRoleLoaded(true)
      );
    });

    return () => {
      unsub();
      offRole();
    };
  }, []);

  const isTeacher = role === 'teacher' || role === 'admin';
  const Loader = <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/teacher/login" element={<TeacherLogin />} />
        <Route path="/teacher/apply" element={<TeacherApply />} />

        {/* Profile: requires auth but not teacher role */}
        <Route
          path="/teacher/profile"
          element={
            !authLoaded ? (
              Loader
            ) : user ? (
              <TeacherProfile />
            ) : (
              <Navigate to="/teacher/login" replace />
            )
          }
        />

        {/* Root → Lobby */}
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="/lobby" element={<Lobby />} />

        {/* Teacher-only routes (wait for role) */}
        <Route
          path="/teacher/dashboard"
          element={
            !authLoaded ? (
              Loader
            ) : !user ? (
              <Navigate to="/teacher/login" replace />
            ) : !roleLoaded ? (
              Loader
            ) : isTeacher ? (
              <TeacherDashboard />
            ) : (
              <Navigate to="/teacher/login" replace />
            )
          }
        />
        <Route
          path="/teacher/game/:gameId"
          element={
            !authLoaded ? (
              Loader
            ) : !user ? (
              <Navigate to="/teacher/login" replace />
            ) : !roleLoaded ? (
              Loader
            ) : isTeacher ? (
              <TeacherGamePage />
            ) : (
              <Navigate to="/teacher/login" replace />
            )
          }
        />

        {/* Student game: any authenticated user */}
        <Route
          path="/game/:gameId"
          element={!authLoaded ? Loader : user ? <GamePage /> : <Navigate to="/lobby" replace />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
