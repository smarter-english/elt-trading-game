// src/BrandBar.js
import React from 'react';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function BrandBar({
  title = (
    <>
      The{' '}
      <span style={{ color: '#2563eb', fontWeight: 700, letterSpacing: '.2px' }}>
        SMARTER ENGLISH
      </span>{' '}
      Trading Game
    </>
  ),
  logoSrc = '/SE-logo.svg',  // put your file in public/
  showLogout = false,
  right = null,
  onLogout, // optional override
}) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/lobby');
    } catch (e) {
      console.warn('Logout failed', e);
      alert('Logout failed.');
    }
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 12px',
        background: '#fafafa',
        borderBottom: '1px solid #eee'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {logoSrc && (
          <img
            src={logoSrc}
            alt="Smarter English"
            style={{ width: 28, height: 28, objectFit: 'contain' }}
          />
        )}
        <div
          style={{
            fontWeight: 600,
            letterSpacing: '.2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={title}
        >
          {title}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {right}
        {showLogout && (
          <button onClick={onLogout ?? handleLogout}>Log Out</button>
        )}
      </div>
    </div>
  );
}