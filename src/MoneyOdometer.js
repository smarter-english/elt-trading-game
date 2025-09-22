// src/MoneyOdometer.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Odometer from 'react-odometerjs';

function usePrevious(v) {
  const r = useRef(v);
  useEffect(() => void (r.current = v), [v]);
  return r.current;
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function commaify(str) {
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function sampleString(maxIntegerDigits = 6, decimals = 2) {
  const ints = '8'.repeat(Math.max(1, maxIntegerDigits));
  const decs = decimals > 0 ? '.' + '8'.repeat(decimals) : '';
  return commaify(ints) + decs;
}

/**
 * MoneyOdometer – fixed-width odometer with reserved arrow slot (no layout shift)
 * Props:
 *  - label: string
 *  - value: number
 *  - baseDurationMs/min/max: animation duration controls (delta-aware)
 *  - decimals: number of decimals used to size the sizer text (default 2)
 *  - maxIntegerDigits: reserve width for up to this many integer digits (default 6)
 *  - format: odometer format pattern (default '(,ddd).dd')
 *  - colorize: show up/down accent + arrow while changing
 */
export default function MoneyOdometer({
  label,
  value,
  baseDurationMs = 1200,
  minDurationMs = 600,
  maxDurationMs = 2200,
  decimals = 2,
  maxIntegerDigits = 6,
  format = '(,ddd).dd',
  colorize = true,
  style
}) {
  const prev = usePrevious(value);
  const [flash, setFlash] = useState('');
  const delta = useMemo(() => (prev === undefined ? 0 : value - prev), [value, prev]);

  // delta-aware duration
  const duration = useMemo(() => {
    if (prefersReducedMotion) return 0;
    if (!prev && prev !== 0) return baseDurationMs;
    const mag = Math.abs(delta);
    const scale =
      value !== 0 ? Math.min(1, Math.max(0, mag / Math.max(50, Math.abs(value) * 0.02))) : 1;
    const ms = Math.round(baseDurationMs + scale * (maxDurationMs - baseDurationMs));
    return Math.max(minDurationMs, Math.min(ms, maxDurationMs));
  }, [prev, delta, baseDurationMs, minDurationMs, maxDurationMs, value, maxDurationMs]);

  useEffect(() => {
    if (prev === undefined) return;
    if (delta > 0) setFlash('up');
    else if (delta < 0) setFlash('down');
    const t = setTimeout(() => setFlash(''), 900);
    return () => clearTimeout(t);
  }, [delta, prev]);

  const baseBox = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 2,
    padding: '6px 10px',
    borderRadius: 8,
    transition: 'background-color .3s ease, box-shadow .3s ease',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  };
  const flashStyle =
    colorize && flash === 'up'
      ? { background: '#ecfdf3', boxShadow: '0 0 0 2px #d1fadf inset' }
      : colorize && flash === 'down'
      ? { background: '#fef3f2', boxShadow: '0 0 0 2px #fecaca inset' }
      : null;

  const sizer = `$${sampleString(maxIntegerDigits, decimals)}`;

  const Arrow = () =>
    !colorize || !flash ? (
      // reserve the arrow slot so width never changes
      <span aria-hidden="true" style={{ display: 'inline-block', width: 12 }} />
    ) : (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 12,
          textAlign: 'center',
          fontSize: 12,
          lineHeight: 1,
          opacity: 0.85,
          color: flash === 'up' ? '#16a34a' : '#dc2626'
        }}
      >
        {flash === 'up' ? '↑' : '↓'}
      </span>
    );

  return (
    <div style={{ ...baseBox, ...(flashStyle || {}), ...(style || {}) }}>
      <div style={{ fontSize: 12, color: '#667085', letterSpacing: '.02em' }}>{label}</div>

      {/* Value row: arrow slot + fixed-width odometer box */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Arrow />
        <span
          style={{
            position: 'relative',
            display: 'inline-grid',
            // Both children occupy the same grid cell -> sizer defines width, odometer overlays it
            gridTemplateColumns: '1fr',
            alignItems: 'center'
          }}
        >
          {/* Sizer: reserves constant width, stays in normal flow */}
          <span
            aria-hidden="true"
            style={{
              visibility: 'hidden',
              whiteSpace: 'nowrap',
              fontSize: 22
            }}
          >
            {sizer}
          </span>

          {/* Live overlay: same grid cell, on top */}
          <span
            style={{
              gridColumn: '1 / 1',
              gridRow: '1 / 1',
              position: 'absolute',
              inset: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              fontSize: 22,
              color: '#111827'
            }}
          >
            <span style={{ opacity: 0.8 }}>$</span>
            <Odometer value={Number(value)} duration={duration} format={format} />
          </span>
        </span>
      </div>

      {/* A11y: politely announce updates */}
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          clip: 'rect(1px, 1px, 1px, 1px)',
          clipPath: 'inset(50%)',
          height: 1,
          width: 1,
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}
      >
        {label} updated to ${Number(value).toFixed(decimals)}
      </span>
    </div>
  );
}