import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../../services/api";

// The signed-in person's notifications: an unread count on the bell and a
// drop-down list. Clicking one marks it read and opens its page (when the
// person can open that page). Checks for new ones every minute while the
// tab is visible. The same notifications are also emailed.

const POLL_MS = 60_000;
const ago = (value) => {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

export function NotificationBell({ allowedTabs, onNavigate, alertsTab }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications({ limit: 30 });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnread(Number(data?.unread) || 0);
      setError("");
    } catch {
      setError("Couldn't load notifications.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  // Close on outside click or Esc.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!wrapRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
    }
  };

  const openItem = async (item) => {
    if (!item.readAt) {
      setItems((current) => current.map((entry) => (entry._id === item._id ? { ...entry, readAt: new Date().toISOString() } : entry)));
      setUnread((count) => Math.max(0, count - 1));
      markNotificationRead(item._id).catch(() => {});
    }
    if (item.tab && allowedTabs.includes(item.tab)) {
      onNavigate(item.tab);
      setOpen(false);
    }
  };

  const readAll = async () => {
    setItems((current) => current.map((entry) => ({ ...entry, readAt: entry.readAt || new Date().toISOString() })));
    setUnread(0);
    await markAllNotificationsRead().catch(() => load());
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className="iconbtn" onClick={toggle} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open} aria-haspopup="true" title="Notifications">
        <Bell size={16} />
        {unread > 0 && <span className="notif-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="btn sm ghost" onClick={readAll}><CheckCheck size={13} /> Mark all read</button>
            )}
          </div>
          <div className="notif-list">
            {loading && items.length === 0 && <div className="notif-empty"><Loader2 size={14} className="spin" /> Loading…</div>}
            {error && <div className="notif-empty" role="alert">{error}</div>}
            {!loading && !error && items.length === 0 && <div className="notif-empty">You are all caught up.</div>}
            {items.map((item) => (
              <button key={item._id} type="button" className={`notif-item ${item.readAt ? "" : "unread"}`} onClick={() => openItem(item)}>
                <span className="notif-item-title">
                  {item.actionRequired && !item.readAt && <span className="notif-action">Action</span>}
                  {item.title}
                </span>
                {item.body && <span className="notif-item-body">{item.body}</span>}
                <span className="notif-item-when">{ago(item.createdAt)}</span>
              </button>
            ))}
          </div>
          {alertsTab && (
            <button type="button" className="notif-panel-foot" onClick={() => { onNavigate(alertsTab); setOpen(false); }}>
              Stock alerts and activity log
            </button>
          )}
        </div>
      )}
    </div>
  );
}
