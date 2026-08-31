import React from 'react';

export function Dot({ c }) {
  return (
    <span 
      className="dot" 
      style={{
        background: c,
        boxShadow: `0 0 6px ${c}`
      }} 
    />
  );
}