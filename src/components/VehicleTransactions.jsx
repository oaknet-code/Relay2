import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ListChecks, Loader2, RefreshCw, AlertTriangle, Printer } from "lucide-react";
import { getFleetTransactions } from "../services/api";

// Every fuel, maintenance, parts and trip-claim entry as one ledger — the
// detail behind the Vehicle summary. `request` ({ vehicleId, from, to, key })
// is set when someone clicks a vehicle in the summary: it applies those
// filters and scrolls here. Reloads whenever the Fleet page reloads its
// vehicles, so new entries appear.

const TYPES = {
  fuel: "Fuel",
  maintenance: "Maintenance",
  parts: "Parts",
  per_diem: "Trip claim",
};
const EMPTY_FILTERS = { from: "", to: "", vehicleId: "", type: "" };
const kes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const displayDate = (value) => new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

// Quote for CSV, and neutralise values a spreadsheet would run as a formula.
const csvCell = (value) => {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export function VehicleTransactions({ vehicles, request }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sectionRef = useRef(null);

  const load = useCallback(async (params) => {
    setLoading(true);
    setError("");
    try {
      const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
      setData(await getFleetTransactions(query));
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(applied); }, [load, applied, vehicles]);

  useEffect(() => {
    if (!request) return;
    const next = { ...EMPTY_FILTERS, vehicleId: request.vehicleId || "", from: request.from || "", to: request.to || "" };
    setFilters(next);
    setApplied(next);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [request]);

  const rows = useMemo(() => data?.transactions || [], [data]);
  const includesPerDiem = Boolean(data?.includesPerDiem);
  const totals = useMemo(() => {
    const byType = { fuel: 0, maintenance: 0, parts: 0, per_diem: 0 };
    for (const r of rows) if (r.counted) byType[r.type] += r.amount;
    return { byType, total: Object.values(byType).reduce((a, b) => a + b, 0) };
  }, [rows]);

  const submit = (event) => {
    event.preventDefault();
    setApplied({ ...filters });
  };
  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };

  const downloadCsv = () => {
    const header = ["Date", "Vehicle", "Type", "Description", "Details", "Reference", "Status", "Recorded by", "Amount (KES)", "Counted in totals"];
    const lines = rows.map((r) => [
      dateKey(r.date), r.plate, TYPES[r.type], r.description, r.detail, r.reference, r.status, r.recordedBy,
      Number(r.amount || 0).toFixed(2), r.counted ? "Yes" : "No",
    ].map(csvCell).join(","));
    // Leading byte-order mark so Excel reads the file as UTF-8.
    const blob = new Blob([String.fromCharCode(0xfeff), [header.map(csvCell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const plate = vehicles.find((v) => v._id === applied.vehicleId)?.plate;
    const name = ["fleet-transactions", plate?.replace(/\s+/g, ""), applied.from, applied.to].filter(Boolean).join("_");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filtered = Object.values(applied).some(Boolean);
  const typeOptions = Object.entries(TYPES).filter(([k]) => k !== "per_diem" || includesPerDiem);

  return (
    <section className="panel vehicle-summary" ref={sectionRef}>
      <div className="panel-h">
        <ListChecks size={15} className="ph-ico" />
        <h3>Transaction details</h3>
        <div className="ph-r vehicle-summary-actions no-print">
          <button className="btn sm ghost" type="button" disabled={loading || rows.length === 0} onClick={() => window.print()}>
            <Printer size={13} /> Print
          </button>
          <button className="btn sm ghost" type="button" disabled={loading || rows.length === 0} onClick={downloadCsv}>
            <Download size={13} /> CSV
          </button>
          <button className="btn sm ghost" type="button" disabled={loading} onClick={() => load(applied)}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>
      <div className="panel-b">
        <p className="mp-description">
          Every fuel, maintenance, parts{includesPerDiem ? " and trip claim" : ""} entry, newest first. Leave the dates blank for all time.
          {includesPerDiem ? " Claims awaiting review or rejected are listed but not counted in totals." : ""}
        </p>
        <form className="fleet-schedule-filters vehicle-transactions-filters no-print" onSubmit={submit}>
          <label>From<input className="form-input" type="date" value={filters.from} max={filters.to || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></label>
          <label>To<input className="form-input" type="date" value={filters.to} min={filters.from || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></label>
          <label>Vehicle
            <select className="form-input" value={filters.vehicleId} onChange={(e) => setFilters((f) => ({ ...f, vehicleId: e.target.value }))}>
              <option value="">All vehicles</option>
              {vehicles.map((v) => <option key={v._id} value={v._id}>{v.plate} · {v.make}</option>)}
            </select>
          </label>
          <label>Type
            <select className="form-input" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
              <option value="">All types</option>
              {typeOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <div className="vehicle-summary-actions">
            <button className="btn amber sm" type="submit" disabled={loading}>Show</button>
            {filtered && <button className="btn ghost sm" type="button" onClick={reset}>Clear</button>}
          </div>
        </form>

        {error && <div className="fleet-operation-notice error" role="alert"><AlertTriangle size={14} /> {error}</div>}

        {loading && !data ? (
          <div className="fleet-operation-empty"><Loader2 size={15} className="spin" /> Loading transactions…</div>
        ) : data && rows.length === 0 ? (
          <div className="fleet-operation-empty">No transactions match these filters.</div>
        ) : data && (
          <>
            <div className="vehicle-summary-kpis">
              <div><span>{rows.length} transaction{rows.length === 1 ? "" : "s"}</span><b>{kes(totals.total)}</b></div>
              {typeOptions.filter(([k]) => !applied.type || applied.type === k).map(([k, label]) => (
                <div key={k}><span>{label}</span><b>{kes(totals.byType[k])}</b></div>
              ))}
            </div>
            <div className="fleet-schedule-table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
              <table className="fleet-schedule-table vehicle-summary-table">
                <thead>
                  <tr><th>Date</th><th>Vehicle</th><th>Type</th><th>Description</th><th>Reference</th><th>Recorded by</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.type}-${r._id}`}>
                      <td>{displayDate(r.date)}</td>
                      <td><strong>{r.plate}</strong></td>
                      <td>
                        {TYPES[r.type]}
                        {r.status && <small><span className={`fleet-status ${r.status === "approved" || r.status === "completed" ? "moving" : r.status === "rejected" || r.status === "open" ? "maintenance" : "parked"}`}>{r.status}</span></small>}
                      </td>
                      <td className="vehicle-transactions-desc">{r.description}{r.detail && <small>{r.detail}</small>}</td>
                      <td>{r.reference || <span className="faint">—</span>}</td>
                      <td>{r.recordedBy || <span className="faint">—</span>}</td>
                      <td className="num">
                        <span className={r.counted ? undefined : "faint"}>{kes(r.amount)}</span>
                        {!r.counted && <small>not counted</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={6}><strong>Total</strong></td><td className="num"><strong>{kes(totals.total)}</strong></td></tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
