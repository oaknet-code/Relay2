import { useCallback, useEffect, useMemo, useState } from "react";
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
  Loader2,
  SatelliteDish,
  LayoutDashboard,
  Fuel,
  Package,
  ListChecks,
  CalendarDays,
  FileText,
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
  getFleetTeamMembers,
  getFleetDocuments,
} from "../services/api";
import { FleetOperations } from "../components/FleetOperations";
import { FleetSchedule } from "../components/FleetSchedule";
import { VehicleSummary } from "../components/VehicleSummary";
import { VehicleTransactions } from "../components/VehicleTransactions";
import { FleetModal } from "../components/FleetModal";
import { FleetDocuments } from "../components/FleetDocuments";

// Company vehicles and drivers, from the database, split into tabs so each
// area (fuel, maintenance, parts, ...) has its own view; forms open in a
// pop-up instead of sitting open on the page. Live tracking (map, speed,
// trips) needs GPS trackers, which aren't connected yet — the page says so
// instead of showing invented positions.

const VEHICLE_STATUS = {
  available: { label: "Available", cls: "parked" },
  in_use: { label: "In use", cls: "moving" },
  maintenance: { label: "Maintenance", cls: "maintenance" },
};
const EMPTY_VEHICLE = { plate: "", make: "", body: "", status: "available", driverId: "", notes: "" };
const EMPTY_DRIVER = { name: "", phone: "", status: "active", userId: "" };

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "vehicles", label: "Vehicles & drivers", icon: Truck },
  { id: "fuel", label: "Fuel", icon: Fuel },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
  { id: "parts", label: "Parts", icon: Package },
  { id: "documents", label: "Documents", icon: FileText, docsOnly: true }, // super admin, CEO, admin
  { id: "transactions", label: "Transactions", icon: ListChecks },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
];
const OPERATION_TABS = new Set(["fuel", "maintenance", "parts"]);
const TAB_STORAGE_KEY = "relay.fleet.tab";

function savedTab() {
  try {
    const value = window.localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some((tab) => tab.id === value) ? value : "overview";
  } catch {
    return "overview";
  }
}

function Banner({ ok, children }) {
  return (
    <div className={`boq-banner ${ok ? "ok" : "err"}`} role={ok ? "status" : "alert"}>
      {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      <span>{children}</span>
    </div>
  );
}

export function FleetManagement({ canEdit = false, user }) {
  // Documents: super admins and the CEO edit (canEdit), admins view.
  const canSeeDocuments = ["super_admin", "ceo", "admin"].includes(user?.role);
  const tabs = TABS.filter((item) => !item.docsOnly || canSeeDocuments);
  const [tab, setTab] = useState(() => {
    const saved = savedTab();
    return tabs.some((item) => item.id === saved) ? saved : "overview";
  });
  // Expired / expiring / missing documents, for the tab badge and banner.
  const [docSummary, setDocSummary] = useState(null);
  const loadDocSummary = useCallback(() => {
    if (!canSeeDocuments) return;
    getFleetDocuments().then((data) => setDocSummary(data.summary)).catch(() => setDocSummary(null));
  }, [canSeeDocuments]);
  useEffect(() => { loadDocSummary(); }, [loadDocSummary]);
  const docIssues = docSummary ? docSummary.expired + docSummary.expiring + docSummary.missing : 0;
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null); // { ok, text }
  const [statusFilter, setStatusFilter] = useState("all");
  const [vehicleForm, setVehicleForm] = useState(null); // { id?, ...fields } while adding/editing
  const [driverForm, setDriverForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  // Set when a plate is clicked in the Vehicle summary: opens the
  // Transactions tab filtered to that vehicle.
  const [transactionsRequest, setTransactionsRequest] = useState(null);

  const chooseTab = (id) => {
    setTab(id);
    setNotice(null);
    try { window.localStorage.setItem(TAB_STORAGE_KEY, id); } catch { /* not remembered; fine */ }
  };

  const load = async () => {
    try {
      const [v, d, members] = await Promise.all([
        getVehicles(),
        getDrivers(),
        canEdit ? getFleetTeamMembers() : Promise.resolve([]),
      ]);
      setVehicles(v);
      setDrivers(d);
      setTeamMembers(members);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Called by Fleet Operations after it changes something (e.g. maintenance
  // moves a vehicle in or out of "maintenance"). Unlike load(), a failure
  // here keeps the page up and just says so.
  const refreshFleet = async () => {
    try {
      const [v, d] = await Promise.all([getVehicles(), getDrivers()]);
      setVehicles(v);
      setDrivers(d);
    } catch (err) {
      setNotice({ ok: false, text: `Couldn't refresh vehicles and drivers: ${err.message}` });
    }
  };

  const counts = useMemo(() => ({
    all: vehicles.length,
    available: vehicles.filter((v) => v.status === "available").length,
    in_use: vehicles.filter((v) => v.status === "in_use").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
  }), [vehicles]);

  const filtered = statusFilter === "all" ? vehicles : vehicles.filter((v) => v.status === statusFilter);
  const activeDrivers = drivers.filter((d) => d.status === "active");

  // Errors from a pop-up form stay in it; a success closes it.
  const run = async (fn, successText, { fromForm = false } = {}) => {
    setBusy(true);
    setNotice(null);
    setFormError("");
    try {
      await fn();
      await load();
      setNotice({ ok: true, text: successText });
      return true;
    } catch (err) {
      if (fromForm) setFormError(err.message);
      else setNotice({ ok: false, text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openVehicleForm = (fields) => { setNotice(null); setFormError(""); setVehicleForm(fields); };
  const openDriverForm = (fields) => { setNotice(null); setFormError(""); setDriverForm(fields); };
  const closeForms = () => {
    if (busy) return;
    setVehicleForm(null);
    setDriverForm(null);
    setFormError("");
  };

  const saveVehicle = async (e) => {
    e.preventDefault();
    const { id, ...fields } = vehicleForm;
    const payload = { ...fields, driverId: fields.driverId || null };
    const ok = await run(
      () => (id ? updateVehicle(id, payload) : createVehicle(payload)),
      `${fields.plate.toUpperCase()} ${id ? "updated" : "added to the fleet"}.`,
      { fromForm: true },
    );
    if (ok) setVehicleForm(null);
  };

  const saveDriver = async (e) => {
    e.preventDefault();
    const { id, ...fields } = driverForm;
    const payload = { ...fields, userId: fields.userId || null };
    const ok = await run(
      () => (id ? updateDriver(id, payload) : createDriver(payload)),
      `Driver ${fields.name} ${id ? "updated" : "added"}.`,
      { fromForm: true },
    );
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

  const formErrorBanner = formError && (
    <div className="fleet-operation-notice error wide" role="alert"><AlertTriangle size={14} /> {formError}</div>
  );
  const formActions = (label) => (
    <div className="fleet-operation-actions wide fleet-modal-actions">
      <button className="btn ghost sm" type="button" onClick={closeForms} disabled={busy}>Cancel</button>
      <button className="btn amber sm" type="submit" disabled={busy}>
        {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} {label}
      </button>
    </div>
  );

  const vehiclesPanel = (
    <div className="panel">
      <div className="panel-h">
        <Truck size={15} className="ph-ico" />
        <h3>Vehicles</h3>
        <span className="ff-count">{vehicles.length}</span>
        {canEdit && (
          <button className="btn sm amber ph-r" type="button" onClick={() => openVehicleForm({ ...EMPTY_VEHICLE })}>
            <Plus size={13} /> Add vehicle
          </button>
        )}
      </div>
      <div className="panel-b" style={{ padding: "12px 14px" }}>
        <div className="fleet-filters">
          {["all", "available", "in_use", "maintenance"].map((s) => (
            <button key={s} type="button" className={`fleet-filter-btn ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
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
                    <button className="btn sm ghost" type="button" aria-label={`Edit ${v.plate}`} title="Edit"
                      onClick={() => openVehicleForm({ id: v._id, plate: v.plate, make: v.make, body: v.body || "", status: v.status, driverId: v.driver?._id || "", notes: v.notes || "" })}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn sm ghost" type="button" style={{ color: "var(--red)" }} aria-label={`Remove ${v.plate}`} title="Remove" onClick={() => removeVehicle(v)}>
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
  );

  const driversPanel = (
    <div className="panel">
      <div className="panel-h">
        <User size={15} className="ph-ico" />
        <h3>Drivers</h3>
        <span className="ff-count">{drivers.length}</span>
        {canEdit && (
          <button className="btn sm amber ph-r" type="button" onClick={() => openDriverForm({ ...EMPTY_DRIVER })}>
            <Plus size={13} /> Add driver
          </button>
        )}
      </div>
      <div className="panel-b" style={{ padding: "12px 14px" }}>
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
                    {d.user && <> · team member: {d.user.firstName} {d.user.lastName}</>}
                    {assigned.length > 0 && <> · usual driver of {assigned.join(", ")}</>}
                  </div>
                </div>
                {canEdit && (
                  <div className="fv-right fleet-row-actions">
                    <button className="btn sm ghost" type="button" aria-label={`Edit ${d.name}`} title="Edit"
                      onClick={() => openDriverForm({ id: d._id, name: d.name, phone: d.phone || "", status: d.status, userId: d.user?._id || "" })}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn sm ghost" type="button" style={{ color: "var(--red)" }} aria-label={`Remove ${d.name}`} title="Remove" onClick={() => removeDriver(d)}>
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
  );

  return (
    <div>
      {/* Header */}
      <div className="view-head">
        <span className="tagchip">
          <MapPin size={11} />
          Fleet
        </span>
        <h2>Fleet Management</h2>
        <p>Manage vehicles, drivers, fuel, maintenance, and workshop or imported-part costs. Per diem and other claims are under Claims.</p>
      </div>

      <nav className="fleet-tabs" aria-label="Fleet sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={`fleet-operation-tab ${tab === id ? "active" : ""}`}
            aria-current={tab === id ? "page" : undefined} onClick={() => chooseTab(id)}>
            <Icon size={14} /> {label}
            {id === "documents" && docIssues > 0 && <span className={`fd-badge ${docSummary.expired ? "bad" : ""}`}>{docIssues}</span>}
          </button>
        ))}
      </nav>

      {docSummary && docSummary.expired > 0 && tab !== "documents" && (
        <div className="fleet-operation-notice error" role="alert" style={{ marginBottom: 12 }}>
          <AlertTriangle size={14} /> {docSummary.expired} vehicle/driver document{docSummary.expired === 1 ? " has" : "s have"} expired.
          <button className="btn sm ghost" type="button" onClick={() => chooseTab("documents")}>View documents</button>
        </div>
      )}

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
        <div className="fleet-tab-body">
          {tab === "overview" && (
            <>
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
              <VehicleSummary vehicles={vehicles} onViewTransactions={(req) => { setTransactionsRequest({ ...req }); chooseTab("transactions"); }} />
            </>
          )}

          {tab === "vehicles" && <div className="fleet-manage">{vehiclesPanel}{driversPanel}</div>}

          {OPERATION_TABS.has(tab) && (
            <FleetOperations user={user} section={tab} vehicles={vehicles} onFleetChange={refreshFleet} />
          )}

          {tab === "transactions" && <VehicleTransactions vehicles={vehicles} request={transactionsRequest} />}

          {tab === "schedule" && <FleetSchedule vehicles={vehicles} />}

          {tab === "documents" && canSeeDocuments && <FleetDocuments canEdit={canEdit} onChanged={loadDocSummary} />}
        </div>
      )}

      {vehicleForm && (
        <FleetModal title={vehicleForm.id ? `Edit ${vehicleForm.plate}` : "Add vehicle"} onClose={closeForms}>
          <form className="fleet-operation-form fleet-modal-form" onSubmit={saveVehicle}>
            {formErrorBanner}
            <label>Number plate *
              <input className="form-input" required maxLength={15} placeholder="KDY 919A" value={vehicleForm.plate}
                onChange={(e) => setVehicleForm((f) => ({ ...f, plate: e.target.value }))} />
            </label>
            <label>Make / model *
              <input className="form-input" required maxLength={60} placeholder="Isuzu D-Max" value={vehicleForm.make}
                onChange={(e) => setVehicleForm((f) => ({ ...f, make: e.target.value }))} />
            </label>
            <label>Body
              <input className="form-input" maxLength={40} placeholder="Double Cab" value={vehicleForm.body}
                onChange={(e) => setVehicleForm((f) => ({ ...f, body: e.target.value }))} />
            </label>
            <label>Status
              <select className="form-input" value={vehicleForm.status}
                onChange={(e) => setVehicleForm((f) => ({ ...f, status: e.target.value }))}>
                {Object.entries(VEHICLE_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
            </label>
            <label className="wide">Usual driver
              <select className="form-input" value={vehicleForm.driverId}
                onChange={(e) => setVehicleForm((f) => ({ ...f, driverId: e.target.value }))}>
                <option value="">— None —</option>
                {activeDrivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </label>
            {formActions(vehicleForm.id ? "Save" : "Add vehicle")}
          </form>
        </FleetModal>
      )}

      {driverForm && (
        <FleetModal title={driverForm.id ? `Edit ${driverForm.name}` : "Add driver"} onClose={closeForms}>
          <form className="fleet-operation-form fleet-modal-form" onSubmit={saveDriver}>
            {formErrorBanner}
            <label className="wide">Full name *
              <input className="form-input" required minLength={2} maxLength={80} placeholder="Ali Osman" value={driverForm.name}
                onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label>Phone
              <input className="form-input" type="tel" maxLength={20} placeholder="+254 712 345 678" value={driverForm.phone}
                onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
            <label>Status
              <select className="form-input" value={driverForm.status}
                onChange={(e) => setDriverForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>Link team member
              <select className="form-input" value={driverForm.userId || ""} onChange={(e) => setDriverForm((f) => ({ ...f, userId: e.target.value }))}>
                <option value="">External / no account linked</option>
                {teamMembers.filter((member) => !drivers.some((driver) =>
                  driver._id !== driverForm.id && driver.user?._id === member._id
                )).map((member) => <option key={member._id} value={member._id}>{member.name} · {member.email}</option>)}
              </select>
            </label>
            {formActions(driverForm.id ? "Save" : "Add driver")}
          </form>
        </FleetModal>
      )}
    </div>
  );
}
