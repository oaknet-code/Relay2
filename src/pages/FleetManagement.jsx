import React, { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Truck,
  Car,
  User,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  SatelliteDish,
} from "lucide-react";
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
} from "../services/api";

// Company vehicles and drivers, from the database. Live tracking (map,
// speed, fuel, trips) needs GPS trackers, which aren't connected yet — the
// page says so instead of showing invented positions.

const VEHICLE_STATUS = {
  available: { label: "Available", cls: "parked" },
  in_use: { label: "In use", cls: "moving" },
  maintenance: { label: "Maintenance", cls: "maintenance" },
};
const EMPTY_VEHICLE = { plate: "", make: "", body: "", status: "available", driverId: "", notes: "" };
const EMPTY_DRIVER = { name: "", phone: "", status: "active" };

const labelStyle = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--muted)" };

function Banner({ ok, children }) {
  return (
    <div className={`boq-banner ${ok ? "ok" : "err"}`} role={ok ? "status" : "alert"}>
      {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      <span>{children}</span>
    </div>
  );
}

export function FleetManagement({ canEdit = false }) {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null); // { ok, text }
  const [statusFilter, setStatusFilter] = useState("all");
  const [vehicleForm, setVehicleForm] = useState(null); // { id?, ...fields } while adding/editing
  const [driverForm, setDriverForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [v, d] = await Promise.all([getVehicles(), getDrivers()]);
      setVehicles(v);
      setDrivers(d);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    all: vehicles.length,
    available: vehicles.filter((v) => v.status === "available").length,
    in_use: vehicles.filter((v) => v.status === "in_use").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
  }), [vehicles]);

  const filtered = statusFilter === "all" ? vehicles : vehicles.filter((v) => v.status === statusFilter);
  const activeDrivers = drivers.filter((d) => d.status === "active");

  const run = async (fn, successText) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice({ ok: true, text: successText });
      return true;
    } catch (err) {
      setNotice({ ok: false, text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveVehicle = async (e) => {
    e.preventDefault();
    const { id, ...fields } = vehicleForm;
    const payload = { ...fields, driverId: fields.driverId || null };
    const ok = await run(
      () => (id ? updateVehicle(id, payload) : createVehicle(payload)),
      `${fields.plate.toUpperCase()} ${id ? "updated" : "added to the fleet"}.`
    );
    if (ok) setVehicleForm(null);
  };

  const saveDriver = async (e) => {
    e.preventDefault();
    const { id, ...fields } = driverForm;
    const ok = await run(() => (id ? updateDriver(id, fields) : createDriver(fields)), `Driver ${fields.name} ${id ? "updated" : "added"}.`);
    if (ok) setDriverForm(null);
  };

  const removeVehicle = (v) => {
    if (!window.confirm(`Remove ${v.plate} from the fleet?`)) return;
    run(() => deleteVehicle(v._id), `${v.plate} removed.`);
  };

  const removeDriver = (d) => {
    if (!window.confirm(`Remove driver ${d.name}? They'll be unassigned from any vehicle.`)) return;
    run(() => deleteDriver(d._id), `Driver ${d.name} removed.`);
  };

  return (
    <div>
      {/* Header */}
      <div className="view-head">
        <span className="tagchip">
          <MapPin size={11} />
          Fleet
        </span>
        <h2>Fleet Management</h2>
        <p>Company vehicles and drivers used for dispatch runs.</p>
      </div>

      {/* KPI Row */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi" style={{ "--gl": "rgba(51, 220, 174, 0.12)" }}>
          <div className="k-top"><Truck size={14} /> VEHICLES</div>
          <div className="k-val">{counts.all}</div>
          <div className="k-sub">in the fleet</div>
        </div>
        <div className="kpi" style={{ "--gl": "rgba(95, 168, 255, 0.12)" }}>
          <div className="k-top"><CheckCircle2 size={14} /> AVAILABLE</div>
          <div className="k-val">{counts.available}</div>
          <div className="k-sub">{counts.in_use} in use</div>
        </div>
        <div className="kpi" style={{ "--gl": "rgba(255, 95, 95, 0.12)" }}>
          <div className="k-top"><Wrench size={14} /> MAINTENANCE</div>
          <div className="k-val">{counts.maintenance}</div>
          <div className="k-sub">not dispatchable</div>
        </div>
        <div className="kpi" style={{ "--gl": "rgba(173, 139, 255, 0.12)" }}>
          <div className="k-top"><User size={14} /> DRIVERS</div>
          <div className="k-val">{activeDrivers.length}</div>
          <div className="k-sub">active</div>
        </div>
      </div>

      <div className="fleet-notracker" role="note">
        <SatelliteDish size={16} />
        <span>
          <b>No GPS tracker connected.</b> Live position, speed, fuel and trip history will appear here once vehicles have trackers.
        </span>
      </div>

      {notice && <Banner ok={notice.ok}>{notice.text}</Banner>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--faint)" }}>
          <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 12 }}>Loading fleet…</div>
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--red)" }}>
          <AlertTriangle size={24} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 13, marginBottom: 10 }}>{error}</div>
          <button className="btn sm" onClick={load}>Retry</button>
        </div>
      ) : (
        <div className="fleet-manage">
          {/* Vehicles */}
          <div className="panel">
            <div className="panel-h">
              <Truck size={15} className="ph-ico" />
              <h3>Vehicles</h3>
              {canEdit && !vehicleForm && (
                <button className="btn sm amber ph-r" onClick={() => { setNotice(null); setVehicleForm({ ...EMPTY_VEHICLE }); }}>
                  <Plus size={13} /> Add vehicle
                </button>
              )}
            </div>
            <div className="panel-b" style={{ padding: "12px 14px" }}>
              {vehicleForm && (
                <form className="fleet-form" onSubmit={saveVehicle}>
                  <div className="fleet-form-grid">
                    <label style={labelStyle}>
                      Number plate *
                      <input className="form-input" required maxLength={15} placeholder="KDY 919A" value={vehicleForm.plate}
                        onChange={(e) => setVehicleForm((f) => ({ ...f, plate: e.target.value }))} />
                    </label>
                    <label style={labelStyle}>
                      Make / model *
                      <input className="form-input" required maxLength={60} placeholder="Isuzu D-Max" value={vehicleForm.make}
                        onChange={(e) => setVehicleForm((f) => ({ ...f, make: e.target.value }))} />
                    </label>
                    <label style={labelStyle}>
                      Body
                      <input className="form-input" maxLength={40} placeholder="Double Cab" value={vehicleForm.body}
                        onChange={(e) => setVehicleForm((f) => ({ ...f, body: e.target.value }))} />
                    </label>
                    <label style={labelStyle}>
                      Status
                      <select className="form-input" value={vehicleForm.status}
                        onChange={(e) => setVehicleForm((f) => ({ ...f, status: e.target.value }))}>
                        {Object.entries(VEHICLE_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                      </select>
                    </label>
                    <label style={labelStyle}>
                      Usual driver
                      <select className="form-input" value={vehicleForm.driverId}
                        onChange={(e) => setVehicleForm((f) => ({ ...f, driverId: e.target.value }))}>
                        <option value="">— None —</option>
                        {activeDrivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="fleet-form-actions">
                    <button className="btn amber sm" type="submit" disabled={busy}>
                      {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} {vehicleForm.id ? "Save" : "Add vehicle"}
                    </button>
                    <button className="btn ghost sm" type="button" onClick={() => setVehicleForm(null)}><X size={13} /> Cancel</button>
                  </div>
                </form>
              )}

              <div className="fleet-filters">
                {["all", "available", "in_use", "maintenance"].map((s) => (
                  <button key={s} className={`fleet-filter-btn ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
                    {s === "all" ? "All" : VEHICLE_STATUS[s].label}
                    <span className="ff-count">{counts[s]}</span>
                  </button>
                ))}
              </div>

              <div className="fleet-vehicle-list">
                {filtered.length === 0 && (
                  <div className="faint" style={{ fontSize: 13, padding: 16, textAlign: "center" }}>
                    {vehicles.length ? "No vehicles with this status." : "No vehicles yet."}
                  </div>
                )}
                {filtered.map((v) => {
                  const st = VEHICLE_STATUS[v.status] || VEHICLE_STATUS.available;
                  return (
                    <div key={v._id} className="fv-card" style={{ cursor: "default" }}>
                      <div className={`fv-ico ${st.cls}`}>
                        {/cab|truck|pickup|d-max/i.test(`${v.make} ${v.body}`) ? <Truck size={16} /> : <Car size={16} />}
                      </div>
                      <div className="fv-info">
                        <div className="fv-plate">
                          {v.plate}
                          <span className={`fleet-status ${st.cls}`} style={{ marginLeft: 8 }}>{st.label}</span>
                        </div>
                        <div className="fv-detail">
                          {v.make}{v.body ? ` · ${v.body}` : ""} · {v.driver ? v.driver.name : <span className="faint">no usual driver</span>}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="fv-right fleet-row-actions">
                          <button className="btn sm ghost" aria-label={`Edit ${v.plate}`} title="Edit"
                            onClick={() => { setNotice(null); setVehicleForm({ id: v._id, plate: v.plate, make: v.make, body: v.body || "", status: v.status, driverId: v.driver?._id || "", notes: v.notes || "" }); }}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn sm ghost" style={{ color: "var(--red)" }} aria-label={`Remove ${v.plate}`} title="Remove" onClick={() => removeVehicle(v)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Drivers */}
          <div className="panel">
            <div className="panel-h">
              <User size={15} className="ph-ico" />
              <h3>Drivers</h3>
              {canEdit && !driverForm && (
                <button className="btn sm amber ph-r" onClick={() => { setNotice(null); setDriverForm({ ...EMPTY_DRIVER }); }}>
                  <Plus size={13} /> Add driver
                </button>
              )}
            </div>
            <div className="panel-b" style={{ padding: "12px 14px" }}>
              {driverForm && (
                <form className="fleet-form" onSubmit={saveDriver}>
                  <div className="fleet-form-grid">
                    <label style={labelStyle}>
                      Full name *
                      <input className="form-input" required minLength={2} maxLength={80} placeholder="Ali Osman" value={driverForm.name}
                        onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))} />
                    </label>
                    <label style={labelStyle}>
                      Phone
                      <input className="form-input" type="tel" maxLength={20} placeholder="+254 712 345 678" value={driverForm.phone}
                        onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))} />
                    </label>
                    <label style={labelStyle}>
                      Status
                      <select className="form-input" value={driverForm.status}
                        onChange={(e) => setDriverForm((f) => ({ ...f, status: e.target.value }))}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <div className="fleet-form-actions">
                    <button className="btn amber sm" type="submit" disabled={busy}>
                      {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} {driverForm.id ? "Save" : "Add driver"}
                    </button>
                    <button className="btn ghost sm" type="button" onClick={() => setDriverForm(null)}><X size={13} /> Cancel</button>
                  </div>
                </form>
              )}

              <div className="fleet-vehicle-list">
                {drivers.length === 0 && <div className="faint" style={{ fontSize: 13, padding: 16, textAlign: "center" }}>No drivers yet.</div>}
                {drivers.map((d) => {
                  const assigned = vehicles.filter((v) => v.driver?._id === d._id).map((v) => v.plate);
                  return (
                    <div key={d._id} className="fv-card" style={{ cursor: "default" }}>
                      <div className={`fv-ico ${d.status === "active" ? "moving" : "parked"}`}><User size={16} /></div>
                      <div className="fv-info">
                        <div className="fv-plate">
                          {d.name}
                          {d.status !== "active" && <span className="fleet-status parked" style={{ marginLeft: 8 }}>Inactive</span>}
                        </div>
                        <div className="fv-detail">
                          {d.phone || <span className="faint">no phone</span>}
                          {assigned.length > 0 && <> · usual driver of {assigned.join(", ")}</>}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="fv-right fleet-row-actions">
                          <button className="btn sm ghost" aria-label={`Edit ${d.name}`} title="Edit"
                            onClick={() => { setNotice(null); setDriverForm({ id: d._id, name: d.name, phone: d.phone || "", status: d.status }); }}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn sm ghost" style={{ color: "var(--red)" }} aria-label={`Remove ${d.name}`} title="Remove" onClick={() => removeDriver(d)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
