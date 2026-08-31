import React from 'react';

export function Ring({ 
  pct, 
  c = "var(--amber)", 
  size = 66, 
  stroke = 7, 
  children 
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const off = C * (1 - Math.max(0, Math.min(1, pct / 100)));
  
  return (
    <svg 
      width={size} 
      height={size} 
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle 
        cx={size / 2} 
        cy={size / 2} 
        r={r} 
        fill="none" 
        stroke="var(--line)" 
        strokeWidth={stroke} 
      />
      <circle 
        cx={size / 2} 
        cy={size / 2} 
        r={r} 
        fill="none" 
        stroke={c} 
        strokeWidth={stroke}
        strokeDasharray={C} 
        strokeDashoffset={off} 
        strokeLinecap="round" 
        style={{ transition: "stroke-dashoffset .5s" }} 
      />
      {children && (
        <g style={{ 
          transform: "rotate(90deg)", 
          transformOrigin: "center" 
        }}>
          {children}
        </g>
      )}
    </svg>
  );
}