// src/MoneyFlip.js
import React, { useEffect, useRef, useState } from 'react';
import FlipNumbers from 'react-flip-numbers';

function usePrevious(val) {
  const r = useRef(val);
  useEffect(() => void (r.current = val), [val]);
  return r.current;
}
function fmt(val, decimals = 2) {
  return Number(val).toFixed(decimals);
}

/**
 * StatFlip – label + flipping number with a subtle flash when it changes.
 * Inline styles ensure it works even without external CSS.
 */
export default function StatFlip({
  label,
  value,
  decimals = 2,
  width = 18,
  height = 28,
  style
}) {
  const prev = usePrevious(value);
  const [flash, setFlash] = useState('');
  const display = fmt(value, decimals);

  useEffect(() => {
    if (prev === undefined) return;
    if (value > prev) setFlash('up');
    else if (value < prev) setFlash('down');
    else setFlash('');
    if (value !== prev) {
      const t = setTimeout(() => setFlash(''), 900);
      return () => clearTimeout(t);
    }
  }, [value, prev]);

  const base = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    padding: '6px 10px',
    borderRadius: 8,
    transition: 'background-color .3s ease, box-shadow .3s ease',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  };

  const flashStyle =
    flash === 'up'
      ? { background: '#ecfdf3', boxShadow: '0 0 0 2px #d1fadf inset' }
      : flash === 'down'
      ? { background: '#fef3f2', boxShadow: '0 0 0 2px #fecaca inset' }
      : null;

  return (
    <div style={{ ...base, ...(flashStyle || {}), ...(style || {}) }}>
      <div style={{ fontSize: 12, color: '#667085', letterSpacing: '.02em' }}>{label}</div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 18,
          lineHeight: 1,
          color: '#111827'
        }}
      >
        <span style={{ opacity: 0.8, marginRight: 2 }}>$</span>
        <FlipNumbers
          numbers={display}
          height={height}
          width={width}
          play
          perspective={600}
          duration={2.0}
        />
      </div>
    </div>
  );
}