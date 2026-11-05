import { useEffect, useState } from "react";
import { Fuel, Loader2, Plus, Wrench, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { FleetModal } from "./FleetModal";
import { FLEET_ENTRY_ROLES } from "../utils/access";
import {
  createFuelLog,
  createMaintenanceRecord,
  createPartSourcingRecord,
  getClaimOptions,
  getFuelLogs,
  getMaintenanceRecords,
  getPartSourcingRecords,
  updateMaintenanceStatus,
} from "../services/api";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_FUEL = { vehicleId: "", movementPlanId: "", purpose: "", date: today(), odometerKm: "", litres: "", totalCost: "", supplier: "", reference: "", notes: "" };
const EMPTY_MAINTENANCE = { vehicleId: "", date: today(), description: "", vendor: "", cost: "", odometerKm: "", nextDueOdometerKm: "", notes: "" };
const EMPTY_PART_SOURCING = { vehicleId: "", maintenanceRecordId: "", date: today(), partDescription: "", source: "cfao", supplier: "", totalCost: "", reference: "", notes: "" };
const formatKes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const displayDate = (value) => value ? new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const userLabel = (user) => user
  ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unknown"
  : "Unknown";

function Status({ value, label = value }) {
  return <span className={`fleet-status ${["approved", "completed", "paid"].includes(value) ? "moving" : value === "rejected" || value === "open" ? "maintenance" : "parked"}`}>{label}</span>;
}

// One Fleet page tab ("fuel", "maintenance" or "parts"): the
// records as a list, with the form to add one in a pop-up. Vehicles and
// drivers come from the Fleet page so both stay in sync; onFleetChange
// reloads them there (e.g. after maintenance changes a vehicle's status).
export function FleetOperations({ user, section = "fuel", vehicles = [], onFleetChange }) {
  const [formOpen, setFormOpen] = useState(null); // section whose form is showing
  const [formError, setFormError] = useState("");
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [partSourcing, setPartSourcing] = useState([]);
  // Plans the user can claim expenses against — each fuel log is claimed on one.
  const [claimPlans, setClaimPlans] = useState([]);
  const [fuelForm, setFuelForm] = useState({ ...EMPTY_FUEL });
  const [maintenanceForm, setMaintenanceForm] = useState({ ...EMPTY_MAINTENANCE });
  const [partSourcingForm, setPartSourcingForm] = useState({ ...EMPTY_PART_SOURCING });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null); // { ok, text }
  const role = user?.role;
  // Same rules as the backend (Relay3 routes/fleet.routes.js): fuel and
  // maintenance by project managers and site engineers; parts and per-diem
  // review by super admin / CEO. Admins view only.
  const canRecordFuel = FLEET_ENTRY_ROLES.has(role);
  const canMaintain = FLEET_ENTRY_ROLES.has(role);
  const canManageParts = ["ceo", "super_admin"].includes(role);

  const load = async () => {
    try {
      const [fuels, maintenanceRows, partRows, claimOptions] = await Promise.all([
        getFuelLogs(), getMaintenanceRecords(), getPartSourcingRecords(),
        canRecordFuel ? getClaimOptions() : Promise.resolve({ plans: [] }),
      ]);
      setFuelLogs(fuels);
      setMaintenance(maintenanceRows);
      setPartSourcing(partRows);
      setClaimPlans(claimOptions.plans || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);


  // Errors from a form stay in its pop-up so nothing typed is lost; a
  // success closes the pop-up and shows the message on the tab.
  const run = async (action, success) => {
    const fromForm = Boolean(formOpen);
    setBusy(true);
    setNotice(null);
    setFormError("");
    try {
      const result = await action();
      await Promise.all([load(), onFleetChange?.()]);
      setFormOpen(null);
      setNotice({ ok: true, text: result?.notificationWarning ? `${success} ${result.notificationWarning}` : success });
      return true;
    } catch (err) {
      if (fromForm) setFormError(err.message);
      else setNotice({ ok: false, text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openForm = (name) => {
    setNotice(null);
    setFormError("");
    setFormOpen(name);
  };
  const closeForm = () => {
    if (busy) return;
    setFormOpen(null);
    setFormError("");
  };

  const submitFuel = async (event) => {
    event.preventDefault();
    const success = await run(
      () => createFuelLog({ ...fuelForm, odometerKm: Number(fuelForm.odometerKm), litres: Number(fuelForm.litres), totalCost: Number(fuelForm.totalCost) }),
      role === "ceo" ? "Fuel entry recorded." : "Fuel entry recorded and claim submitted for CEO review.",
    );
    if (success) setFuelForm({ ...EMPTY_FUEL });
  };

  const submitMaintenance = async (event) => {
    event.preventDefault();
    const payload = {
      ...maintenanceForm,
      cost: Number(maintenanceForm.cost || 0),
      odometerKm: maintenanceForm.odometerKm === "" ? null : Number(maintenanceForm.odometerKm),
      nextDueOdometerKm: maintenanceForm.nextDueOdometerKm === "" ? null : Number(maintenanceForm.nextDueOdometerKm),
    };
    const success = await run(() => createMaintenanceRecord(payload), "Maintenance record added and vehicle marked for maintenance.");
    if (success) setMaintenanceForm({ ...EMPTY_MAINTENANCE });
  };

  const submitPartSourcing = async (event) => {
    event.preventDefault();
    const payload = {
      ...partSourcingForm,
      maintenanceRecordId: partSourcingForm.maintenanceRecordId || null,
      totalCost: Number(partSourcingForm.totalCost),
    };
    const success = await run(() => createPartSourcingRecord(payload), "Workshop/imported part cost recorded.");
    if (success) setPartSourcingForm({ ...EMPTY_PART_SOURCING });
  };


  const SECTIONS = {
    fuel: {
      title: "Fuel", icon: Fuel, count: fuelLogs.length,
      intro: role === "ceo" ? "Fuel entries by others are also submitted as claims for your review. Fuel you record yourself isn't claimed." : "Each fuel entry is also submitted as a claim for CEO review.",
      action: canRecordFuel && { label: "Record fuel", form: "fuel" },
    },
    maintenance: {
      title: "Maintenance", icon: Wrench, count: maintenance.length,
      intro: "Workshop labour and service charges. Parts bought for a repair go under Parts.",
      action: canMaintain && { label: "Add maintenance", form: "maintenance" },
    },
    parts: {
      title: "Parts", icon: Package, count: partSourcing.length,
      intro: "Parts sourced for a specific repair through CFAO, Isuzu or imports. No depot stock is tracked here.",
      action: canManageParts && { label: "Record part cost", form: "parts" },
    },
  };
  const current = SECTIONS[section] || SECTIONS.fuel;
  const SectionIcon = current.icon;

  if (loading) return <div className="fleet-operation-empty"><Loader2 size={18} className="spin" /> Loading {current.title.toLowerCase()}…</div>;
  if (error) return <div className="fleet-operation-notice error" role="alert"><AlertTriangle size={14} /> {error} <button className="btn sm ghost" onClick={load}>Retry</button></div>;

  const formErrorBanner = formError && (
    <div className="fleet-operation-notice error wide" role="alert"><AlertTriangle size={14} /> {formError}</div>
  );
  const formActions = (label, disabled = false) => (
    <div className="fleet-operation-actions wide fleet-modal-actions">
      <button className="btn ghost sm" type="button" onClick={closeForm} disabled={busy}>Cancel</button>
      <button className="btn amber sm" type="submit" disabled={busy || disabled}>
        {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} {label}
      </button>
    </div>
  );

  return (
    <section className="panel fleet-operations">
      <div className="panel-h">
        <SectionIcon size={15} className="ph-ico" />
        <h3>{current.title}</h3>
        <span className="ff-count">{current.count}</span>
        {current.action && (
          <button className="btn sm amber ph-r" type="button" onClick={() => openForm(current.action.form)}>
            <Plus size={13} /> {current.action.label}
          </button>
        )}
      </div>
      <div className="panel-b" style={{ padding: 14 }}>
        <p className="mp-description">{current.intro}</p>
        {notice && (
          <div className={`fleet-operation-notice ${notice.ok ? "" : "error"}`} role={notice.ok ? "status" : "alert"}>
            {notice.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {notice.text}
          </div>
        )}

        {section === "fuel" && (
          <div className="fleet-operation-list">
            {fuelLogs.length === 0 && <div className="fleet-operation-empty">No fuel entries recorded.</div>}
            {fuelLogs.map((record) => (
              <article className="fleet-operation-row" key={record._id}>
                <div className="fleet-operation-main"><strong>{record.vehicle?.plate || "Vehicle"} · {record.litres} L</strong><span>{displayDate(record.date)} · {record.odometerKm.toLocaleString()} km{record.supplier ? ` · ${record.supplier}` : ""} · Logged by {userLabel(record.recordedBy)}</span>{record.reference && <small>Receipt / reference: {record.reference}</small>}{(record.movementPlan || record.purpose) && <small>{[record.movementPlan && `Plan ${record.movementPlan.reference}`, record.purpose].filter(Boolean).join(" · ")}</small>}</div>
                <div className="fleet-operation-meta"><b>{formatKes(record.totalCost)}</b>{record.expenseClaim ? <Status value={record.expenseClaim.status} label={`claim ${record.expenseClaim.status}`} /> : <small className="faint">no claim</small>}</div>
              </article>
            ))}
          </div>
        )}

        {section === "maintenance" && (
          <div className="fleet-operation-list">
            {maintenance.length === 0 && <div className="fleet-operation-empty">No maintenance records.</div>}
            {maintenance.map((record) => (
              <article className="fleet-operation-row" key={record._id}>
                <div className="fleet-operation-main"><strong>{record.vehicle?.plate || "Vehicle"} · {record.description}</strong>{record.reportedByDriver && <span style={{ color: record.severity === "unsafe" ? "var(--red)" : "var(--amber)" }}>Reported by driver{record.severity === "unsafe" ? " · unsafe to drive" : ""}{record.notes ? ` · ${record.notes}` : ""}</span>}<span>{displayDate(record.date)} · {record.vendor || "No vendor"}{record.odometerKm != null ? ` · ${record.odometerKm.toLocaleString()} km` : ""}{record.nextDueOdometerKm != null ? ` · next service at ${record.nextDueOdometerKm.toLocaleString()} km` : ""} · Logged by {userLabel(record.recordedBy)}</span></div>
                <div className="fleet-operation-meta"><b>{formatKes(record.cost)}</b><Status value={record.status} />{canMaintain && record.status === "open" && <button className="btn sm ghost" disabled={busy} onClick={() => run(() => updateMaintenanceStatus(record._id, "completed"), "Maintenance marked complete.")}>Complete</button>}</div>
              </article>
            ))}
          </div>
        )}

        {section === "parts" && (
          <div className="fleet-operation-list">
            {partSourcing.length === 0 && <div className="fleet-operation-empty">No workshop or imported-part costs recorded.</div>}
            {partSourcing.map((record) => (
              <article className="fleet-operation-row" key={record._id}>
                <div className="fleet-operation-main">
                  <strong>{record.vehicle?.plate || "Vehicle"} · {record.partDescription}</strong>
                  <span>{displayDate(record.date)} · {record.source === "cfao" ? "CFAO" : record.source === "isuzu" ? "Isuzu" : "Imported"}{record.supplier ? ` · ${record.supplier}` : ""}</span>
                  <small>Logged by {userLabel(record.recordedBy)}</small>
                  {record.maintenanceRecord && <small>Maintenance: {record.maintenanceRecord.description}</small>}
                  {record.reference && <small>Invoice / reference: {record.reference}</small>}
                </div>
                <div className="fleet-operation-meta"><b>{formatKes(record.totalCost)}</b></div>
              </article>
            ))}
          </div>
        )}
      </div>

      {formOpen === "fuel" && (
        <FleetModal title="Record fuel" description="This also submits an expense claim for the cost in your name, for CEO review. Do not claim the same fuel again on the Expense Claims page." onClose={closeForm}>
          <form className="fleet-operation-form fleet-modal-form" onSubmit={submitFuel}>
            {formErrorBanner}
            <label>Vehicle *
              <select className="form-input" required value={fuelForm.vehicleId} onChange={(event) => setFuelForm((c) => ({ ...c, vehicleId: event.target.value }))}>
                <option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.plate} · {vehicle.make}</option>)}
              </select>
            </label>
            <label>Date *<input className="form-input" type="date" required value={fuelForm.date} onChange={(event) => setFuelForm((c) => ({ ...c, date: event.target.value }))} /></label>
            <label className="wide">Movement plan
              <select className="form-input" value={fuelForm.movementPlanId} onChange={(event) => setFuelForm((c) => ({ ...c, movementPlanId: event.target.value }))}>
                <option value="">None — other errand</option>{claimPlans.map((plan) => <option key={plan._id} value={plan._id}>{plan.reference} · {plan.title}</option>)}
              </select>
            </label>
            <label className="wide">Purpose / errand{fuelForm.movementPlanId ? "" : " *"}
              <input className="form-input" maxLength={200} minLength={fuelForm.movementPlanId ? undefined : 2} required={!fuelForm.movementPlanId}
                placeholder={fuelForm.movementPlanId ? "Optional note" : "e.g. Collecting spares from CFAO Industrial Area"}
                value={fuelForm.purpose} onChange={(event) => setFuelForm((c) => ({ ...c, purpose: event.target.value }))} />
            </label>
            <label>Odometer (km) *<input className="form-input" type="number" min="0" required value={fuelForm.odometerKm} onChange={(event) => setFuelForm((c) => ({ ...c, odometerKm: event.target.value }))} /></label>
            <label>Fuel (litres) *<input className="form-input" type="number" min="0.01" step="0.01" required value={fuelForm.litres} onChange={(event) => setFuelForm((c) => ({ ...c, litres: event.target.value }))} /></label>
            <label>Total cost (KES) *<input className="form-input" type="number" min="0.01" step="0.01" required value={fuelForm.totalCost} onChange={(event) => setFuelForm((c) => ({ ...c, totalCost: event.target.value }))} /></label>
            <label>Supplier<input className="form-input" maxLength={120} value={fuelForm.supplier} onChange={(event) => setFuelForm((c) => ({ ...c, supplier: event.target.value }))} /></label>
            <label className="wide">Receipt / reference<input className="form-input" maxLength={120} value={fuelForm.reference} onChange={(event) => setFuelForm((c) => ({ ...c, reference: event.target.value }))} /></label>
            {formActions("Record fuel and claim")}
          </form>
        </FleetModal>
      )}

      {formOpen === "maintenance" && (
        <FleetModal title="Add maintenance" description="Labour or service charges only. The vehicle is marked as in maintenance until the record is completed." onClose={closeForm}>
          <form className="fleet-operation-form fleet-modal-form" onSubmit={submitMaintenance}>
            {formErrorBanner}
            <label>Vehicle *
              <select className="form-input" required value={maintenanceForm.vehicleId} onChange={(event) => setMaintenanceForm((c) => ({ ...c, vehicleId: event.target.value }))}>
                <option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.plate} · {vehicle.make}</option>)}
              </select>
            </label>
            <label>Date *<input className="form-input" type="date" required value={maintenanceForm.date} onChange={(event) => setMaintenanceForm((c) => ({ ...c, date: event.target.value }))} /></label>
            <label className="wide">Work / issue *<input className="form-input" required maxLength={300} value={maintenanceForm.description} onChange={(event) => setMaintenanceForm((c) => ({ ...c, description: event.target.value }))} /></label>
            <label>Vendor<input className="form-input" maxLength={120} value={maintenanceForm.vendor} onChange={(event) => setMaintenanceForm((c) => ({ ...c, vendor: event.target.value }))} /></label>
            <label>Labour / service cost (KES)<input className="form-input" type="number" min="0" step="0.01" value={maintenanceForm.cost} onChange={(event) => setMaintenanceForm((c) => ({ ...c, cost: event.target.value }))} /></label>
            <label>Odometer (km)<input className="form-input" type="number" min="0" value={maintenanceForm.odometerKm} onChange={(event) => setMaintenanceForm((c) => ({ ...c, odometerKm: event.target.value }))} /></label>
            <label>Next service (km)<input className="form-input" type="number" min="0" value={maintenanceForm.nextDueOdometerKm} onChange={(event) => setMaintenanceForm((c) => ({ ...c, nextDueOdometerKm: event.target.value }))} /></label>
            {formActions("Add maintenance record")}
          </form>
        </FleetModal>
      )}

      {formOpen === "parts" && (
        <FleetModal title="Record part cost" description="Parts or work sourced for a repair. Link it to the maintenance record it belongs to, if there is one." onClose={closeForm}>
          <form className="fleet-operation-form fleet-modal-form" onSubmit={submitPartSourcing}>
            {formErrorBanner}
            <label>Vehicle *
              <select className="form-input" required value={partSourcingForm.vehicleId} onChange={(event) => setPartSourcingForm((c) => ({ ...c, vehicleId: event.target.value, maintenanceRecordId: "" }))}>
                <option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.plate} · {vehicle.make}</option>)}
              </select>
            </label>
            <label>Date *<input className="form-input" type="date" required value={partSourcingForm.date} onChange={(event) => setPartSourcingForm((c) => ({ ...c, date: event.target.value }))} /></label>
            <label className="wide">Part(s) or work description *
              <input className="form-input" required maxLength={200} value={partSourcingForm.partDescription} onChange={(event) => setPartSourcingForm((c) => ({ ...c, partDescription: event.target.value }))} placeholder="Describe parts supplied or fitted" />
            </label>
            <label>Source *
              <select className="form-input" value={partSourcingForm.source} onChange={(event) => setPartSourcingForm((c) => ({ ...c, source: event.target.value }))}>
                <option value="cfao">CFAO workshop / parts</option><option value="isuzu">Isuzu workshop / parts</option><option value="imported">Imported</option>
              </select>
            </label>
            <label>Workshop / supplier<input className="form-input" maxLength={120} value={partSourcingForm.supplier} onChange={(event) => setPartSourcingForm((c) => ({ ...c, supplier: event.target.value }))} /></label>
            <label>Total cost (KES) *
              <input className="form-input" type="number" min="0" step="0.01" required value={partSourcingForm.totalCost} onChange={(event) => setPartSourcingForm((c) => ({ ...c, totalCost: event.target.value }))} />
            </label>
            <label>Invoice / reference<input className="form-input" maxLength={120} value={partSourcingForm.reference} onChange={(event) => setPartSourcingForm((c) => ({ ...c, reference: event.target.value }))} /></label>
            <label className="wide">Related maintenance record
              <select className="form-input" value={partSourcingForm.maintenanceRecordId} onChange={(event) => setPartSourcingForm((c) => ({ ...c, maintenanceRecordId: event.target.value }))} disabled={!partSourcingForm.vehicleId}>
                <option value="">{partSourcingForm.vehicleId ? "Not linked" : "Select a vehicle first"}</option>
                {maintenance.filter((record) => record.vehicle?._id === partSourcingForm.vehicleId).map((record) => (
                  <option key={record._id} value={record._id}>{displayDate(record.date)} · {record.description}</option>
                ))}
              </select>
            </label>
            <label className="wide">Notes<input className="form-input" maxLength={500} value={partSourcingForm.notes} onChange={(event) => setPartSourcingForm((c) => ({ ...c, notes: event.target.value }))} /></label>
            {formActions("Record part cost")}
          </form>
        </FleetModal>
      )}

    </section>
  );
}
