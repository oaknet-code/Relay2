import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function Layout({
  navigation,
  currentTab,
  onTabChange,
  currentView,
  liveLinks,
  totalLinks,
  user,
  onLogout,
  onChangePassword,
  children
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleTabChange = (id) => {
    onTabChange(id);
    setMenuOpen(false); // close drawer on navigation
  };

  return (
    <div className="shell">
      <Sidebar
        navigation={navigation}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        user={user}
        onLogout={onLogout}
        onChangePassword={onChangePassword}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="main">
        <Topbar
          currentView={currentView}
          liveLinks={liveLinks}
          totalLinks={totalLinks}
          onMenuToggle={() => setMenuOpen(o => !o)}
        />
        <div className="body">
          {children}
        </div>
      </div>
    </div>
  );
}