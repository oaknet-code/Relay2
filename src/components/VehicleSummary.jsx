import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, RefreshCw, AlertTriangle, Printer } from "lucide-react";
import { getVehicleSummary } from "../services/api";

// Per-vehicle totals for fuel, maintenance, parts and trip claims (per diem etc.).
// Leave both dates blank for all time. Reloads whenever the Fleet page
// reloads its vehicles (passed in as `vehicles`), which happens after any
// fleet change on the page.

const STATUS = {
  available: { label: "Available", cls: "parked" },
  in_use: { label: "In use", cls: "moving" },
  maintenance: { label: "Maintenance", cls: "maintenance" },
};
const kes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const num = (value, digits = 0) => Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: digits });
const EMPTY_RANGE = { from: "", to: "" };

export function VehicleSummary({ vehicles, onViewTransactions }) {
  const [range, setRange] = useState(EMPTY_RANGE);
  const [applied, setApplied] = useState(EMPTY_RANGE);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (params) => {
    setLoading(true);
    setError("");
    try {
      const query = {};
      if (params.from) query.from = params.from;
      if (params.to) query.to = params.to;
      setSummary(await getVehicleSummary(query));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(applied); }, [load, applied, vehicles]);

  const rows = useMemo(() => summary?.vehicles || [], [summary]);
  const showPerDiem = Boolean(summary?.includesPerDiem);
  const totals = useMemo(() => rows.reduce((t, r) => ({
    fuel: t.fuel + r.fuel.cost,
    litres: t.litres + r.fuel.litres,
    maintenance: t.maintenance + r.maintenance.cost,
    parts: t.parts + r.parts.cost,
    perDiem: t.perDiem + (r.perDiem?.approved || 0),
    pending: t.pending + (r.perDiem?.pending || 0),
    total: t.total + r.totalCost,
    open: t.open + r.maintenance.open,
    serviceDue: t.serviceDue + (r.serviceDue ? 1 : 0),
  }), { fuel: 0, litres: 0, maintenance: 0, parts: 0, perDiem: 0, pending: 0, total: 0, open: 0, serviceDue: 0 }), [rows]);

  const submit = (event) => {
    event.preventDefault();
    setApplied({ ...range });
  };
  const clear = () => {
    setRange(EMPTY_RANGE);
    setApplied(EMPTY_RANGE);
  };

  const periodLabel = applied.from || applied.to
    ? `${applied.from || "the start"} to ${applied.to || "today"}`
    : "all time";

  return (
    <section className="panel vehicle-summary">
      <div className="panel-h">
        <BarChart3 size={15} className="ph-ico" />
        <h3>Vehicle summary</h3>
        <div className="ph-r vehicle-summary-actions no-print">
          <button className="btn sm ghost" type="button" disabled={loading || !summary} onClick={() => window.print()}>
            <Printer size={13} /> Print
          </button>
          <button className="btn sm ghost" type="button" disabled={loading} onClick={() => load(applied)}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>
      <div className="panel-b">
        <p className="mp-description">
          Running costs per vehicle for {periodLabel}. Maintenance is labour and service only; parts are counted separately.
          {showPerDiem ? " Trip claims count approved and paid amounts." : ""}
          {onViewTransactions ? " Click a plate to see its transactions." : ""}
        </p>
        <form className="fleet-schedule-filters vehicle-summary-filters no-print" onSubmit={submit}>
          <label>From<input className="form-input" type="date" value={range.from} max={range.to || undefined}
            onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label>
          <label>To<input className="form-input" type="date" value={range.to} min={range.from || undefined}
            onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label>
          <div className="vehicle-summary-actions">
            <button className="btn amber sm" type="submit" disabled={loading}>Show summary</button>
            {(applied.from || applied.to) && <button className="btn ghost sm" type="button" onClick={clear}>All time</button>}
          </div>
        </form>

        {error && <div className="fleet-operation-notice error" role="alert"><AlertTriangle size={14} /> {error}</div>}

        {loading && !summary ? (
          <div className="fleet-operation-empty"><Loader2 size={15} className="spin" /> Loading vehicle summary…</div>
        ) : summary && rows.length === 0 ? (
          <div className="fleet-operation-empty">No vehicles in the fleet yet.</div>
        ) : summary && (
          <>
            <div className="vehicle-summary-kpis">
              <div><span>Total cost</span><b>{kes(totals.total)}</b></div>
              <div><span>Fuel</span><b>{kes(totals.fuel)}</b><small>{num(totals.litres, 1)} L</small></div>
              <div><span>Maintenance</span><b>{kes(totals.maintenance)}</b><small>{totals.open} open</small></div>
              <div><span>Parts</span><b>{kes(totals.parts)}</b></div>
              {showPerDiem && <div><span>Trip claims</span><b>{kes(totals.perDiem)}</b>{totals.pending > 0 && <small>{kes(totals.pending)} pending</small>}</div>}
            </div>

            {totals.serviceDue > 0 && (
              <div className="fleet-operation-notice error" role="status">
                <AlertTriangle size={14} /> {totals.serviceDue} vehicle{totals.serviceDue === 1 ? " is" : "s are"} at or past the next service odometer reading.
              </div>
            )}

            <div className="fleet-schedule-table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
              <table className="fleet-schedule-table vehicle-summary-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Fuel</th>
                    <th>Maintenance</th>
                    <th>Parts</th>
                    {showPerDiem && <th>Trip claims</th>}
                    <th>Odometer</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = STATUS[r.status] || STATUS.available;
                    return (
                      <tr key={r.vehicleId}>
                        <td>
                          {onViewTransactions ? (
                            <button type="button" className="vehicle-summary-plate" title={`View ${r.plate} transactions`}
                              onClick={() => onViewTransactions({ vehicleId: r.vehicleId, from: applied.from, to: applied.to })}>
                              {r.plate}
                            </button>
                          ) : <strong>{r.plate}</strong>}{" "}
                          <span className={`fleet-status ${st.cls}`}>{st.label}</span>
                          <small>{r.make}{r.body ? ` · ${r.body}` : ""}{r.driverName ? ` · ${r.driverName}` : ""}</small>
                        </td>
                        <td>
                          {kes(r.fuel.cost)}
                          <small>
                            {r.fuel.entries ? `${num(r.fuel.litres, 1)} L · ${r.fuel.entries} fill${r.fuel.entries === 1 ? "" : "s"}` : "No fuel entries"}
                            {r.fuel.distanceKm > 0 ? ` · ${num(r.fuel.distanceKm)} km` : ""}
                          </small>
                        </td>
                        <td>
                          {kes(r.maintenance.cost)}
                          <small>
                            {r.maintenance.records ? `${r.maintenance.records} record${r.maintenance.records === 1 ? "" : "s"}` : "No records"}
                            {r.maintenance.open ? ` · ${r.maintenance.open} open` : ""}
                          </small>
                        </td>
                        <td>
                          {kes(r.parts.cost)}
                          <small>
                            {r.parts.records
                              ? [["CFAO", r.parts.cfao], ["Isuzu", r.parts.isuzu], ["Imported", r.parts.imported]]
                                .filter(([, v]) => v > 0).map(([k, v]) => `${k} ${kes(v)}`).join(" · ") || `${r.parts.records} record(s)`
                              : "No parts"}
                          </small>
                        </td>
                        {showPerDiem && (
                          <td>
                            {kes(r.perDiem.approved)}
                            <small>
                              {r.perDiem.claims ? `${r.perDiem.claims} claim${r.perDiem.claims === 1 ? "" : "s"}` : "None approved"}
                              {r.perDiem.pending ? ` · ${kes(r.perDiem.pending)} pending` : ""}
                            </small>
                          </td>
                        )}
                        <td>
                          {r.currentOdometerKm != null ? `${num(r.currentOdometerKm)} km` : "—"}
                          {r.nextDueOdometerKm != null && (
                            <small className={r.serviceDue ? "fleet-low-stock" : undefined}>
                              {r.serviceDue ? "Service due" : "Next service"} at {num(r.nextDueOdometerKm)} km
                            </small>
                          )}
                        </td>
                        <td className="num"><strong>{kes(r.totalCost)}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>All vehicles</strong></td>
                    <td>{kes(totals.fuel)}</td>
                    <td>{kes(totals.maintenance)}</td>
                    <td>{kes(totals.parts)}</td>
                    {showPerDiem && <td>{kes(totals.perDiem)}</td>}
                    <td />
                    <td className="num"><strong>{kes(totals.total)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
