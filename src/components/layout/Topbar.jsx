import React from 'react';
import { Bell, RadioTower, Menu } from 'lucide-react';
import { Dot } from '../ui/Dot';

export function Topbar({ currentView, liveLinks, totalLinks, onMenuToggle }) {
  return (
    <header className="topbar">
      {/* Hamburger — only shown on mobile via CSS */}
      <button className="hamburger" onClick={onMenuToggle} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <div className="crumb">
        RELAY <span className="faint">/</span> <b>{currentView}</b>
      </div>

      <div className="topbar-r">
        <span className="netpill netpill-live">
          <Dot c="var(--teal)" />
          {liveLinks} live
        </span>
        <span className="netpill netpill-planned" style={{ color: 'var(--muted)' }}>
          <RadioTower size={12} />
          {totalLinks} planned
        </span>
        <button className="iconbtn">
          <Bell size={16} />
          <span className="notif-dot" />
        </button>
      </div>
    </header>
  );
}