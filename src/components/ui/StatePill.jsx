import React from 'react';
import { Dot } from './Dot';
import { STATE_META } from '../../constants/states';

// `meta` maps a state to { label, c }; defaults to the asset states.
export function StatePill({ s, meta = STATE_META }) {
  const m = meta[s] || { label: s, c: "var(--faint)" };
  
  return (
    <span 
      className="pill" 
      style={{
        color: m.c,
        background: `color-mix(in srgb, ${m.c} 13%, transparent)`,
        border: `1px solid color-mix(in srgb, ${m.c} 32%, transparent)`
      }}
    >
      <Dot c={m.c} />
      {m.label}
    </span>
  );
}