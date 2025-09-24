// src/BrandBar.js
import React from 'react';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import './brandbar.css';

export default function BrandBar({ showLogout = false }) {
  const onLogout = async () => {
    try { await signOut(auth); } catch (e) { console.warn('Logout failed', e); }
  };

  return (
    <div className="brandbar">
      <div className="brand-left">
        {/* Logo file should be in /public/SE-logo.svg */}
        <img src="/SE-logo.svg" alt="Smarter English" className="brand-logo" />
        <div className="brand-title">
          <span className="brand-prefix">The</span>{' '}
          <span className="accent">SMARTER ENGLISH</span>
          {/* Line break only on mobile via CSS */}
          <span className="mobile-br"><br /></span>{' '}
          <span className="brand-suffix">Trading Game</span>
        </div>
      </div>

      {showLogout && (
        <button className="logout-btn" onClick={onLogout}>
          Log Out
        </button>
      )}
    </div>
  );
}