// src/BrandBar.js
import React, { useLayoutEffect, useRef } from 'react';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function BrandBar({
  title,
  logoSrc = '/SE-logo.svg',
  showLogout = false,
  right = null,
  onLogout
}) {
  const barRef = useRef(null);
  const navigate = useNavigate();

  // Keep HUD below real brandbar height (no overlap)
  useLayoutEffect(() => {
    const apply = () => {
      const h = barRef.current?.offsetHeight || 64;
      document.documentElement.style.setProperty('--brandbar-h', `${h}px`);
    };
    apply();
    let ro;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(apply);
      if (barRef.current) ro.observe(barRef.current);
    } else {
      window.addEventListener('resize', apply);
    }
    return () => {
      if (ro && barRef.current) ro.unobserve(barRef.current);
      window.removeEventListener('resize', apply);
    };
  }, []);

  const defaultLogout = async () => {
    try {
      await signOut(auth);
      navigate('/lobby');
    } catch (e) {
      console.warn('Logout failed:', e);
      alert('Logout failed.');
    }
  };

  return (
    <div className="brandbar" ref={barRef}>
      {/* left: logo + title (keep classes to match your brandbar.css) */}
      {logoSrc ? <img className="logo" src={logoSrc} alt="" /> : null}
      <div className="title">
        {title ?? (
          <>
            The <span className="brand">SMARTER ENGLISH</span>{' '}
            <span className="brand-break" />
            Trading Game
          </>
        )}
      </div>

      {/* right side controls */}
      <div className="spacer" />
      {right}
      {showLogout && (
        <button className="btn" onClick={onLogout ?? defaultLogout}>
          Log Out
        </button>
      )}
    </div>
  );
}