import { RadioTower, Menu } from 'lucide-react';
import { Dot } from '../ui/Dot';
import { NotificationBell } from './NotificationBell';

export function Topbar({ currentView, liveLinks, totalLinks, onMenuToggle, allowedTabs = [], onNavigate, showBell = true }) {
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
        {/* Each person's own notifications; also links to the admin alerts page for roles that have it. */}
        {showBell && (
          <NotificationBell
            allowedTabs={allowedTabs}
            onNavigate={onNavigate}
            alertsTab={allowedTabs.includes("notifications") ? "notifications" : null}
          />
        )}
      </div>
    </header>
  );
}