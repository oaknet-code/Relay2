import React from "react";
import { RadioTower, LogOut, Settings, X } from "lucide-react";
import { NAV_GROUPS } from "../../utils/navigation";

export function Sidebar({
  navigation,
  currentTab,
  onTabChange,
  user,
  onLogout,
  onChangePassword,
  isOpen,
  onClose,
}) {
  // Logout clears an HttpOnly cookie, which only the server can do — wait
  // for that request to finish before navigating away, or the browser can
  // cancel it mid-flight and leave the session cookie intact.
  const handleLogoutClick = async (e) => {
    e.preventDefault();

    if (typeof onLogout === "function") {
      try {
        await onLogout();
      } catch (err) {
        console.error("Logout handler error:", err);
      }
    }

    // Force reload/redirect to reset application state to login
    window.location.href = "/";
  };

  return (
    <>
      {/* Mobile backdrop — click outside to close */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-badge">
            <RadioTower size={19} />
          </div>
          <div>
            <h1>RELAY</h1>
            <small>MW Rollout Ops</small>
          </div>
          {/* Close button — only visible on mobile */}
          <button
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {NAV_GROUPS.map((group) => {
          const items = navigation.filter((n) => n.group === group.id);
          if (items.length === 0) return null;

          return (
            <React.Fragment key={group.id}>
              <div className="nav-label">{group.label}</div>
              <div className="nav">
                {items.map((n) => (
                  <button
                    key={n.id}
                    className={`nav-item ${currentTab === n.id ? "on" : ""}`}
                    onClick={() => onTabChange(n.id)}
                  >
                    <n.ico size={17} className="ni-ico" />
                    {n.label}
                    {n.step && <span className="nav-step">{n.step}</span>}
                  </button>
                ))}
              </div>
            </React.Fragment>
          );
        })}

        <div className="sb-foot">
          <div className="avatar">{user?.initials || "WM"}</div>
          <div style={{ lineHeight: 1.2, flex: 1, overflow: "hidden" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: "500",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "var(--ink)",
              }}
            >
              {user?.name || user?.firstName || "J. Okoth"}
            </div>
            <div
              className="faint"
              style={{
                fontSize: 10,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.title || "Warehouse Manager"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {onChangePassword && (
              <button
                onClick={onChangePassword}
                className="iconbtn"
                title="Change Password"
                style={{
                  padding: "6px",
                  color: "var(--muted)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                }}
              >
                <Settings size={16} />
              </button>
            )}

            {/* Log Out Button */}
            <button
              onClick={handleLogoutClick}
              className="iconbtn"
              title="Log out"
              style={{
                padding: "6px",
                color: "var(--muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
