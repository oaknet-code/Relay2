import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { getConsumables, getKitBoqShortages, getDashboard, getActivity } from '../services/api';

// Alerts and Activity Log, from live data: consumables below their reorder
// level, kit parts the BOQ can't cover, kits out in the field
// too long, and the audit log of recent changes.

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const activityText = (e) => {
  if (e.notes) return e.notes;
  if (e.action === 'STATUS_CHANGE') return `${e.entityType} ${e.fromStatus || '?'} → ${e.toStatus || '?'}`;
  return `${e.entityType} ${e.action.toLowerCase().replace('_', ' ')}`;
};

export function NotificationsPage({ onNavigate }) {
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getConsumables(), getKitBoqShortages(), getDashboard(), getActivity(50)]).then(
      ([cons, boq, dash, act]) => {
        if (cancelled) return;
        const list = [];
        const failed = [];

        if (cons.status === 'fulfilled') {
          for (const c of cons.value) {
            if (c.qtyOnHand > 0 && c.qtyOnHand >= (c.reorderThreshold || 0)) continue;
            list.push({
              key: `c-${c._id}`,
              level: c.qtyOnHand <= 0 ? 'red' : 'amber',
              title: `${c.qtyOnHand <= 0 ? 'Out of stock' : 'Low stock'}: ${c.type} · ${c.model}`,
              sub: `${c.qtyOnHand} ${c.unit || 'ea'} on hand · reorder at ${c.reorderThreshold || 0}`,
              tab: 'inventory',
            });
          }
        } else failed.push('consumables');

        if (boq.status === 'fulfilled') {
          for (const p of boq.value.shortages || []) {
            list.push({
              key: `b-${p.model}`,
              level: 'red',
              title: `BOQ short: ${p.model}`,
              sub: `Kits need ${p.required}, BOQ has ${p.inBoq} · short ${p.short} · ${p.kits.length} kit${p.kits.length === 1 ? '' : 's'}`,
              tab: 'sites',
            });
          }
          for (const p of boq.value.notInBoq || []) {
            list.push({
              key: `n-${p.model}`,
              level: 'amber',
              title: `Not in BOQ: ${p.model}`,
              sub: `${p.required} needed across ${p.kits.length} kit${p.kits.length === 1 ? '' : 's'}`,
              tab: 'sites',
            });
          }
        } else failed.push('BOQ stock');

        if (dash.status === 'fulfilled') {
          for (const kitId of dash.value.kits?.overdue || []) {
            list.push({
              key: `o-${kitId}`,
              level: 'amber',
              title: `Overdue in the field: ${kitId}`,
              sub: `Dispatched more than ${dash.value.overdueDays} days ago and not marked installed`,
              tab: 'dispatch',
            });
          }
        } else failed.push('kit status');

        if (act.status === 'fulfilled') setActivity(act.value);
        else failed.push('activity log');

        setAlerts(list);
        setErrors(failed);
        setLoading(false);
      }
    );
    return () => { cancelled = true; };
  }, []);

  const redCount = alerts.filter(a => a.level === 'red').length;

  return (
    <div>
      <div className="view-head">
        <span className="tagchip">
          <Bell size={11} />
          System &amp; Administration
        </span>
        <h2>Notifications</h2>
        <p>Stock alerts and recent activity across the rollout.</p>
      </div>

      {errors.length > 0 && (
        <div className="faint" style={{ fontSize: 12, marginBottom: 12, color: 'var(--amber)' }}>
          Couldn&apos;t load: {errors.join(', ')}.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="panel">
          <div className="panel-h">
            <AlertTriangle size={15} className="ph-ico" />
            <h3>Alerts</h3>
            <span className="ph-r" style={{ color: redCount ? "var(--red)" : alerts.length ? "var(--amber)" : "var(--teal)" }}>
              {loading ? '…' : `${alerts.length} active`}
            </span>
          </div>
          <div className="panel-b">
            {loading && (
              <div className="faint" style={{ fontSize: 13 }}><Loader2 size={13} className="spin" /> Loading…</div>
            )}
            {!loading && alerts.length === 0 && (
              <div className="faint" style={{ fontSize: 13 }}>No active alerts.</div>
            )}
            {alerts.map(a => (
              <div key={a.key} className="alert"
                style={{ cursor: onNavigate ? 'pointer' : undefined }}
                onClick={onNavigate ? () => onNavigate(a.tab) : undefined}
                title={onNavigate ? `Open ${a.tab}` : undefined}>
                <div className="ai" style={{ color: a.level === 'red' ? "var(--red)" : "var(--amber)" }}>
                  {a.level === 'red' ? <AlertTriangle size={15} /> : <Clock size={15} />}
                </div>
                <div>
                  <div className="at">{a.title}</div>
                  <div className="as">{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <Clock size={15} className="ph-ico" />
            <h3>Activity Log</h3>
            <span className="ph-r">{loading ? '…' : `${activity.length} events`}</span>
          </div>
          <div className="panel-b ledger">
            {!loading && activity.length === 0 && (
              <div className="faint" style={{ fontSize: 13 }}>No activity recorded yet.</div>
            )}
            {activity.map(e => (
              <div className="lr" key={e._id}>
                <span className="lt">{fmtWhen(e.at)}</span>
                <span style={{ flex: 1 }}>{activityText(e)}</span>
                <span className="lt" style={{ color: "var(--teal2)" }}>{e.by}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
