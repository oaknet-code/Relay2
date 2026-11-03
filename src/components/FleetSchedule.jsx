import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { getFleetSchedule } from "../services/api";

const dateKey = (date) => date.toISOString().slice(0, 10);
const addDays = (value, days) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
};
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const DEFAULT_FROM = today();
const DEFAULT_FILTERS = { from: DEFAULT_FROM, to: addDays(DEFAULT_FROM, 30), vehicleId: "" };
const displayDate = (value) => new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-KE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const statusLabel = (value) => value.replace(/_/g, " ");

export function FleetSchedule({ vehicles }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (range) => {
    setLoading(true);
    setError("");
    try {
      setSchedule(await getFleetSchedule(range));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(DEFAULT_FILTERS); }, [load]);

  const submit = (event) => {
    event.preventDefault();
    load(filters);
  };

  return (
    <section className="panel fleet-schedule">
      <div className="panel-h">
        <CalendarDays size={15} className="ph-ico" />
        <h3>Vehicle schedule</h3>
        <button className="btn sm ghost ph-r" type="button" disabled={loading} onClick={() => load(filters)}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <div className="panel-b">
        <p className="mp-description">View vehicle bookings from submitted movement plans. Draft plans do not reserve vehicles.</p>
        <form className="fleet-schedule-filters" onSubmit={submit}>
          <label>From<input className="form-input" type="date" required value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
          <label>To<input className="form-input" type="date" required min={filters.from} value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
          <label>Vehicle
            <select className="form-input" value={filters.vehicleId} onChange={(event) => setFilters((current) => ({ ...current, vehicleId: event.target.value }))}>
              <option value="">All vehicles</option>
              {vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.plate} · {vehicle.make}</option>)}
            </select>
          </label>
          <button className="btn amber sm" type="submit" disabled={loading || !filters.from || !filters.to}>Show schedule</button>
        </form>

        {error && <div className="fleet-operation-empty" role="alert">{error}</div>}
        {loading ? (
          <div className="fleet-operation-empty"><Loader2 size={15} className="spin" /> Loading vehicle schedule…</div>
        ) : !error && schedule.length === 0 ? (
          <div className="fleet-operation-empty">No vehicle bookings in this date range.</div>
        ) : !error && (
          <div className="fleet-schedule-table-wrap">
            <table className="fleet-schedule-table">
              <thead><tr><th>Date</th><th>Vehicle</th><th>Driver</th><th>Route</th><th>Plan / trip</th><th>Status</th></tr></thead>
              <tbody>
                {schedule.map((booking) => (
                  <tr key={booking._id}>
                    <td>{displayDate(booking.date)}</td>
                    <td><strong>{booking.vehicleId?.plate || "Vehicle unavailable"}</strong>{booking.vehicleId?.make && <small>{booking.vehicleId.make}</small>}</td>
                    <td>{booking.driverId?.name || "Driver unavailable"}</td>
                    <td>{booking.route}</td>
                    <td>{booking.reference} · {booking.tripId}</td>
                    <td><span className={`fleet-status ${booking.status === "pending_approval" ? "idle" : "moving"}`}>{statusLabel(booking.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
