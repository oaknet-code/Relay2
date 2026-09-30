import React from 'react';
import { Bell, AlertTriangle, Clock } from 'lucide-react';
import { CONSUMABLES } from '../data/mockData';

// Alerts and Activity Log — moved here from Mission Control. Same data
// sources as before (consumable stock levels + the recent activity ledger).
const cStatus = (c) => c.qty <= 0 ? "out" : (c.qty < c.reorder ? "low" : "ok");

const ACTIVITY_LOG = [
  { t: "08:42", a: "Gate pass GP-2207 voided — re-pick", who: "j.okoth" },
  { t: "08:19", a: "AT-1303 → Quarantine (PoST fail)", who: "qc.bay" },
  { t: "07:55", a: "AT-1504 firmware v9.4.2 verified", who: "eng.staging" },
  { t: "07:31", a: "MW-04 manifest dispatched · KDJ-402F", who: "warehouse" },
  { t: "06:58", a: "GRN-8841 received vs PO-4471 (1 short)", who: "stores" }
];

export function NotificationsPage() {
  const lowStock = CONSUMABLES.filter(c => cStatus(c) !== "ok");

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

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="panel">
          <div className="panel-h">
            <AlertTriangle size={15} className="ph-ico" />
            <h3>Alerts</h3>
            <span className="ph-r" style={{ color: lowStock.length ? "var(--red)" : "var(--teal)" }}>
              {lowStock.length} active
            </span>
          </div>
          <div className="panel-b">
            {lowStock.length === 0 && (
              <div className="faint" style={{ fontSize: 13 }}>No active alerts.</div>
            )}
            {lowStock.map(c => (
              <div key={c.sku} className="alert">
                <div className="ai" style={{ color: c.qty <= 0 ? "var(--red)" : "var(--amber)" }}>
                  {c.qty <= 0 ? <AlertTriangle size={15} /> : <Clock size={15} />}
                </div>
                <div>
                  <div className="at">
                    {c.qty <= 0 ? "Out of stock" : "Low stock"}: {c.name}
                  </div>
                  <div className="as">
                    {c.qty} {c.unit} remaining · reorder at {c.reorder}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <Clock size={15} className="ph-ico" />
            <h3>Activity Log</h3>
            <span className="ph-r">{ACTIVITY_LOG.length} events</span>
          </div>
          <div className="panel-b ledger">
            {ACTIVITY_LOG.map((e, i) => (
              <div className="lr" key={i}>
                <span className="lt">{e.t}</span>
                <span style={{ flex: 1 }}>{e.a}</span>
                <span className="lt" style={{ color: "var(--teal2)" }}>@{e.who}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
