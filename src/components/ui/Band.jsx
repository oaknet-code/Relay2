import React from 'react';
import { Signal } from 'lucide-react';
import { BAND_COLORS } from '../../constants/states';

export function Band({ b }) {
  const c = BAND_COLORS[b] || "var(--steel)";
  
  return (
    <span className="band" style={{ color: c }}>
      <Signal size={11} />
      {b}
    </span>
  );
}