import React from 'react';
import { Dot } from './Dot';
import { STATE_META } from '../../constants/states';

export function StatePill({ s }) {
  const m = STATE_META[s] || { label: s, c: "var(--faint)" };
  
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