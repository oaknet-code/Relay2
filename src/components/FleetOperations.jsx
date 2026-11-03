import { useEffect, useMemo, useState } from "react";
import { Fuel, Loader2, Plus, Wrench, Package, Wallet, AlertTriangle } from "lucide-react";
import {
  createFuelLog,
  createMaintenanceRecord,
  createPartSourcingRecord,
  createPerDiemRecord,
  decidePerDiemRecord,
  getExpenseClaimOptions,
  getFuelLogs,
  getMaintenanceRecords,
  getPartSourcingRecords,
  getPerDiemOptions,
  getPerDiemRecords,
  updateMaintenanceStatus,
} from "../services/api";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_FUEL = { vehicleId: "", movementPlanId: "", purpose: "", date: today(), odometerKm: "", litres: "", totalCost: "", supplier: "", reference: "", notes: "" };
const EMPTY_MAINTENANCE = { vehicleId: "", date: today(), description: "", vendor: "", cost: "", odometerKm: "", nextDueOdometerKm: "", notes: "" };
const EMPTY_PART_SOURCING = { vehicleId: "", maintenanceRecordId: "", date: today(), partDescription: "", source: "cfao", supplier: "", totalCost: "", reference: "", notes: "" };
const EMPTY_PER_DIEM = { movementPlanId: "", tripId: "", vehicleId: "", driverId: "" };
const formatKes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const displayDate = (value) => value ? new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const inclusiveDays = (start, end) => {
  if (!start || !end) return 0;
  const first = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
  const last = new Date(`${end.slice(0, 10)}T00:00:00.000Z`);
  const days = Math.floor((last.getTime() - first.getTime()) / 86400000) + 1;
  return Number.isInteger(days) && days > 0 ? days : 0;
};
const driverLabel = (record) => `${record.driverName} · ${record.planReference} / ${record.tripId}`;
const userLabel = (user) => user
  ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unknown"
  : "Unknown";

function Status({ value, label = value }) {
  return <span className={`fleet-status ${["approved", "completed", "paid"].includes(value) ? "moving" : value === "rejected" || value === "open" ? "maintenance" : "parked"}`}>{label}</span>;
}

// Vehicles and drivers come from the Fleet page so both stay in sync;
// onFleetChange reloads them there (e.g. after maintenance changes a
// vehicle's status).
export function FleetOperations({ user, vehicles = [], drivers = [], onFleetChange }) {
  const [tab, setTab] = useState("fuel");
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [partSourcing, setPartSourcing] = useState([]);
  const [perDiems, setPerDiems] = useState([]);
  const [plans, setPlans] = useState([]);
  // Plans the user can claim expenses against — each fuel log is claimed on one.
  const [claimPlans, setClaimPlans] = useState([]);
  const [fuelForm, setFuelForm] = useState({ ...EMPTY_FUEL });
  const [maintenanceForm, setMaintenanceForm] = useState({ ...EMPTY_MAINTENANCE });
  const [partSourcingForm, setPartSourcingForm] = useState({ ...EMPTY_PART_SOURCING });
  const [perDiemForm, setPerDiemForm] = useState({ ...EMPTY_PER_DIEM });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const role = user?.role;
  const canRecordFuel = ["warehouse_manager", "warehouse_operator", "site_engineer", "site_manager", "admin", "ceo", "super_admin"].includes(role);
  const canMaintain = ["warehouse_manager", "site_engineer", "admin", "ceo", "super_admin"].includes(role);
  const canManageParts = ["warehouse_manager", "admin", "ceo", "super_admin"].includes(role);
  const canReviewPerDiem = ["admin", "ceo", "super_admin"].includes(role);

  const load = async () => {
    try {
      const [fuels, maintenanceRows, partRows, perDiemRows, planRows, claimPlanRows] = await Promise.all([
        getFuelLogs(), getMaintenanceRecords(), getPartSourcingRecords(), getPerDiemRecords(), getPerDiemOptions(),
        canRecordFuel ? getExpenseClaimOptions() : Promise.resolve([]),
      ]);
      setFuelLogs(fuels);
      setMaintenance(maintenanceRows);
      setPartSourcing(partRows);
      setPerDiems(perDiemRows);
      setPlans(planRows);
      setClaimPlans(claimPlanRows);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const selectedPlan = plans.find((plan) => plan._id === perDiemForm.movementPlanId);
  const selectedTrip = selectedPlan?.trips.find((trip) => trip.tripId === perDiemForm.tripId);
  const selectedAssignment = selectedTrip?.assignments.find((assignment) =>
    assignment.vehicleId === perDiemForm.vehicleId && assignment.driverId === perDiemForm.driverId
  );
  const selectedDriver = drivers.find((driver) => driver._id === perDiemForm.driverId);
  const selectedEligibleDays = inclusiveDays(selectedTrip?.startDate || "", selectedTrip?.endDate || "");
  const estimatedPerDiem = selectedEligibleDays && selectedDriver ? selectedEligibleDays * selectedDriver.perDiemRate : 0;
  const approvedPerDiems = useMemo(() => perDiems
    .filter((record) => record.status === "approved")
    .reduce((sum, record) => sum + record.totalAmount, 0), [perDiems]);

  const run = async (action, success) => {
    setBusy(true);
    setNotice("");
    try {
      const result = await action();
      await Promise.all([load(), onFleetChange?.()]);
      setNotice(result?.notificationWarning ? `${success} ${result.notificationWarning}` : success);
      return true;
    } catch (err) {
      setNotice(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitFuel = async (event) => {
    event.preventDefault();
    const success = await run(
      () => createFuelLog({ ...fuelForm, odometerKm: Number(fuelForm.odometerKm), litres: Number(fuelForm.litres), totalCost: Number(fuelForm.totalCost) }),
      "Fuel entry recorded and expense claim submitted for CEO review.",
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

  const submitPerDiem = async (event) => {
    event.preventDefault();
    const success = await run(() => createPerDiemRecord(perDiemForm), "Driver per diem submitted for review.");
    if (success) setPerDiemForm({ ...EMPTY_PER_DIEM });
  };

  const reviewPerDiem = async (record, decision) => {
    const comment = window.prompt(`Optional comment for ${decision} per diem for ${record.driverName}:`);
    if (comment === null) return;
    await run(() => decidePerDiemRecord(record._id, decision, comment), `Driver per diem ${decision}.`);
  };

  const updatePlan = (planId) => {
    const plan = plans.find((item) => item._id === planId);
    const trip = plan?.trips[0];
    const assignment = trip?.assignments[0];
    setPerDiemForm({
      ...EMPTY_PER_DIEM,
      movementPlanId: planId,
      tripId: trip?.tripId || "",
      vehicleId: assignment?.vehicleId || "",
      driverId: assignment?.driverId || "",
    });
  };
  const updateTrip = (tripId) => {
    const trip = selectedPlan?.trips.find((item) => item.tripId === tripId);
    const assignment = trip?.assignments[0];
    setPerDiemForm((current) => ({ ...current, tripId, vehicleId: assignment?.vehicleId || "", driverId: assignment?.driverId || "" }));
  };

  const tabs = [
    { id: "fuel", label: "Fuel", icon: Fuel },
    { id: "per-diem", label: "Driver per diem", icon: Wallet },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
    { id: "parts", label: "Parts sourcing", icon: Package },
  ];

  if (loading) return <div className="fleet-operation-empty"><Loader2 size={18} className="spin" /> Loading fleet operations…</div>;
  if (error) return <div className="fleet-operation-notice error" role="alert"><AlertTriangle size={14} /> {error} <button className="btn sm ghost" onClick={load}>Retry</button></div>;

  return (
    <section className="panel fleet-operations">
      <div className="panel-h"><Wrench size={15} className="ph-ico" /><h3>Fleet Operations</h3></div>
      <div className="panel-b" style={{ padding: 14 }}>
        <div className="fleet-operation-tabs" role="tablist" aria-label="Fleet operations">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button type="button" role="tab" aria-selected={tab === id} className={`fleet-operation-tab ${tab === id ? "active" : ""}`} key={id} onClick={() => setTab(id)}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {notice && <div className="fleet-operation-notice" role="status">{notice}</div>}

        {tab === "fuel" && (
          <>
            {canRecordFuel && (
              <form className="fleet-operation-form" onSubmit={submitFuel}>
                <label>Vehicle *
                  <select className="form-input" required value={fuelForm.vehicleId} onChange={(event) => setFuelForm((current) => ({ ...current, vehicleId: event.target.value }))}>
                    <option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.plate} · {vehicle.make}</option>)}
                  </select>
                </label>
                <label>Movement plan
                  <select className="form-input" value={fuelForm.movementPlanId} onChange={(event) => setFuelForm((current) => ({ ...current, movementPlanId: event.target.value }))}>
                    <option value="">None — other errand</option>{claimPlans.map((plan) => <option key={plan._id} value={plan._id}>{plan.reference} · {plan.title}</option>)}
                  </select>
                </label>
                <label className="wide">Purpose / errand{fuelForm.movementPlanId ? "" : " *"}
                  <input className="form-input" maxLength={200} minLength={fuelForm.movementPlanId ? undefined : 2} required={!fuelForm.movementPlanId}
                    placeholder={fuelForm.movementPlanId ? "Optional note" : "e.g. Collecting spares from CFAO Industrial Area"}
                    value={fuelForm.purpose} onChange={(event) => setFuelForm((current) => ({ ...current, purpose: event.target.value }))} />
                </label>
                <label>Date *<input className="form-input" type="date" required value={fuelForm.date} onChange={(event) => setFuelForm((current) => ({ ...current, date: event.target.value }))} /></label>
                <label>Odometer (km) *<input className="form-input" type="number" min="0" required value={fuelForm.odometerKm} onChange={(event) => setFuelForm((current) => ({ ...current, odometerKm: event.target.value }))} /></label>
                <label>Fuel (litres) *<input className="form-input" type="number" min="0.01" step="0.01" required value={fuelForm.litres} onChange={(event) => setFuelForm((current) => ({ ...current, litres: event.target.value }))} /></label>
                <label>Total cost (KES) *<input className="form-input" type="number" min="0.01" step="0.01" required value={fuelForm.totalCost} onChange={(event) => setFuelForm((current) => ({ ...current, totalCost: event.target.value }))} /></label>
                <label>Supplier<input className="form-input" maxLength={120} value={fuelForm.supplier} onChange={(event) => setFuelForm((current) => ({ ...current, supplier: event.target.value }))} /></label>
                <label>Receipt / reference<input className="form-input" maxLength={120} value={fuelForm.reference} onChange={(event) => setFuelForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                <div className="fleet-operation-help wide">Recording fuel also submits an expense claim for this cost in your name, for CEO review. Do not claim the same fuel again on the Expense Claims page.</div>
                <div className="fleet-operation-actions wide"><button className="btn amber sm" type="submit" disabled={busy}><Plus size={13} /> Record fuel and claim</button></div>
              </form>
            )}
            <div className="fleet-operation-list">
              {fuelLogs.length === 0 && <div className="fleet-operation-empty">No fuel entries recorded.</div>}
              {fuelLogs.map((record) => (
                <article className="fleet-operation-row" key={record._id}>
                  <div className="fleet-operation-main"><strong>{record.vehicle?.plate || "Vehicle"} · {record.litres} L</strong><span>{displayDate(record.date)} · {record.odometerKm.toLocaleString()} km{record.supplier ? ` · ${record.supplier}` : ""} · Logged by {userLabel(record.recordedBy)}</span>{record.reference && <small>Receipt / reference: {record.reference}</small>}{(record.movementPlan || record.purpose) && <small>{[record.movementPlan && `Plan ${record.movementPlan.reference}`, record.purpose].filter(Boolean).join(" · ")}</small>}</div>
                  <div className="fleet-operation-meta"><b>{formatKes(record.totalCost)}</b>{record.expenseClaim ? <Status value={record.expenseClaim.status} label={`claim ${record.expenseClaim.status}`} /> : <small className="faint">no claim</small>}</div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "per-diem" && (
          <>
            <div className="fleet-operation-summary">
              <span>Approved driver per diem to date</span>
              <b>{formatKes(approvedPerDiems)}</b>
            </div>
            {plans.length > 0 && (
              <form className="fleet-operation-form" onSubmit={submitPerDiem}>
                <label>Published movement plan *
                  <select className="form-input" required value={perDiemForm.movementPlanId} onChange={(event) => updatePlan(event.target.value)}>
                    <option value="">Select a plan</option>{plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.reference} · {plan.title}</option>)}
                  </select>
                </label>
                <label>Trip outside Nairobi Metropolitan Area *
                  <select className="form-input" required value={perDiemForm.tripId} onChange={(event) => updateTrip(event.target.value)} disabled={!selectedPlan}>
                    <option value="">Select an eligible trip</option>{selectedPlan?.trips.map((trip) => <option key={trip.tripId} value={trip.tripId}>{trip.tripId} · {trip.originName} to {trip.destinationName}</option>)}
                  </select>
                </label>
                <label>Vehicle and driver *
                  <select className="form-input" required value={`${perDiemForm.vehicleId}|${perDiemForm.driverId}`} onChange={(event) => {
                    const [vehicleId, driverId] = event.target.value.split("|");
                    setPerDiemForm((current) => ({ ...current, vehicleId, driverId }));
                  }} disabled={!selectedTrip}>
                    <option value="|">Select assignment</option>{selectedTrip?.assignments.map((assignment) => <option key={`${assignment.vehicleId}|${assignment.driverId}`} value={`${assignment.vehicleId}|${assignment.driverId}`}>{assignment.vehiclePlate} · {assignment.driverName}</option>)}
                  </select>
                </label>
                <div className="fleet-operation-estimate">
                  <span>{selectedTrip ? `${selectedEligibleDays} calendar day${selectedEligibleDays === 1 ? "" : "s"} · ${displayDate(selectedTrip.startDate)}–${displayDate(selectedTrip.endDate)}` : "Per diem is only available for trips marked outside Nairobi Metropolitan Area."}</span>
                  <strong>{formatKes(selectedDriver?.perDiemRate || 0)} / day · Total {formatKes(estimatedPerDiem)}</strong>
                </div>
                <div className="fleet-operation-actions wide"><button className="btn amber sm" type="submit" disabled={busy || !selectedAssignment || !selectedDriver?.perDiemRate}><Plus size={13} /> Submit per diem</button></div>
              </form>
            )}
            {plans.length === 0 && <div className="fleet-operation-help">Per diem is calculated per driver, per calendar day, for published movement-plan trips marked outside Nairobi Metropolitan Area. Set the daily rate for each driver in Fleet → Drivers.</div>}
            <div className="fleet-operation-list">
              {perDiems.length === 0 && <div className="fleet-operation-empty">No driver per diem submitted yet.</div>}
              {perDiems.map((record) => (
                <article className="fleet-operation-row" key={record._id}>
                  <div className="fleet-operation-main">
                    <strong>{driverLabel(record)} · {record.vehiclePlate}</strong>
                    <span>{record.eligibleDays} day{record.eligibleDays === 1 ? "" : "s"} · {displayDate(record.startDate)}–{displayDate(record.endDate)} · {formatKes(record.ratePerDay)} / day · Submitted by {record.submittedByName || userLabel(record.submittedBy)}</span>
                    {record.decisionComment && <small>Review note: {record.decisionComment}</small>}
                    {record.status === "rejected" && <small>To resubmit, choose the same plan, trip and vehicle in the form above.</small>}
                  </div>
                  <div className="fleet-operation-meta"><b>{formatKes(record.totalAmount)}</b><Status value={record.status} />
                    {canReviewPerDiem && record.status === "pending" && <div className="fleet-operation-actions"><button className="btn sm amber" disabled={busy} onClick={() => reviewPerDiem(record, "approved")}>Approve</button><button className="btn sm ghost" disabled={busy} onClick={() => reviewPerDiem(record, "rejected")}>Reject</button></div>}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "maintenance" && (
          <>
            {canMaintain && (
              <form className="fleet-operation-form" onSubmit={submitMaintenance}>
                <label>Vehicle *
                  <select className="form-input" required value={maintenanceForm.vehicleId} onChange={(event) => setMaintenanceForm((current) => ({ ...current, vehicleId: event.target.value }))}>
                    <option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.plate} · {vehicle.make}</option>)}
                  </select>
                </label>
                <label>Date *<input className="form-input" type="date" required value={maintenanceForm.date} onChange={(event) => setMaintenanceForm((current) => ({ ...current, date: event.target.value }))} /></label>
                <label className="wide">Work / issue *<input className="form-input" required maxLength={300} value={maintenanceForm.description} onChange={(event) => setMaintenanceForm((current) => ({ ...current, description: event.target.value }))} /></label>
                <label>Vendor<input className="form-input" maxLength={120} value={maintenanceForm.vendor} onChange={(event) => setMaintenanceForm((current) => ({ ...current, vendor: event.target.value }))} /></label>
                <label>Labour / service cost (KES)<input className="form-input" type="number" min="0" step="0.01" value={maintenanceForm.cost} onChange={(event) => setMaintenanceForm((current) => ({ ...current, cost: event.target.value }))} /></label>
                <label>Odometer (km)<input className="form-input" type="number" min="0" value={maintenanceForm.odometerKm} onChange={(event) => setMaintenanceForm((current) => ({ ...current, odometerKm: event.target.value }))} /></label>
                <label>Next service (km)<input className="form-input" type="number" min="0" value={maintenanceForm.nextDueOdometerKm} onChange={(event) => setMaintenanceForm((current) => ({ ...current, nextDueOdometerKm: event.target.value }))} /></label>
                <div className="fleet-operation-actions wide"><button className="btn amber sm" type="submit" disabled={busy}><Plus size={13} /> Add maintenance record</button></div>
              </form>
            )}
            {canMaintain && <div className="fleet-operation-help">Enter workshop labour or service charges here. Record separately sourced parts under Parts sourcing to avoid duplicating their cost.</div>}
            <div className="fleet-operation-list">
              {maintenance.length === 0 && <div className="fleet-operation-empty">No maintenance records.</div>}
              {maintenance.map((record) => (
                <article className="fleet-operation-row" key={record._id}>
                  <div className="fleet-operation-main"><strong>{record.vehicle?.plate || "Vehicle"} · {record.description}</strong><span>{displayDate(record.date)} · {record.vendor || "No vendor"}{record.odometerKm != null ? ` · ${record.odometerKm.toLocaleString()} km` : ""}{record.nextDueOdometerKm != null ? ` · next service at ${record.nextDueOdometerKm.toLocaleString()} km` : ""} · Logged by {userLabel(record.recordedBy)}</span></div>
                  <div className="fleet-operation-meta"><b>{formatKes(record.cost)}</b><Status value={record.status} />{canMaintain && record.status === "open" && <button className="btn sm ghost" disabled={busy} onClick={() => run(() => updateMaintenanceStatus(record._id, "completed"), "Maintenance marked complete.")}>Complete</button>}</div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "parts" && (
          <>
            {canManageParts && (
              <form className="fleet-operation-form" onSubmit={submitPartSourcing}>
                <label>Vehicle *
                  <select className="form-input" required value={partSourcingForm.vehicleId} onChange={(event) => setPartSourcingForm((current) => ({ ...current, vehicleId: event.target.value, maintenanceRecordId: "" }))}>
                    <option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.plate} · {vehicle.make}</option>)}
                  </select>
                </label>
                <label>Date *<input className="form-input" type="date" required value={partSourcingForm.date} onChange={(event) => setPartSourcingForm((current) => ({ ...current, date: event.target.value }))} /></label>
                <label>Source *
                  <select className="form-input" value={partSourcingForm.source} onChange={(event) => setPartSourcingForm((current) => ({ ...current, source: event.target.value }))}>
                    <option value="cfao">CFAO workshop / parts</option><option value="isuzu">Isuzu workshop / parts</option><option value="imported">Imported</option>
                  </select>
                </label>
                <label className="wide">Part(s) or work description *
                  <input className="form-input" required maxLength={200} value={partSourcingForm.partDescription} onChange={(event) => setPartSourcingForm((current) => ({ ...current, partDescription: event.target.value }))} placeholder="Describe parts supplied or fitted" />
                </label>
                <label>Workshop / supplier<input className="form-input" maxLength={120} value={partSourcingForm.supplier} onChange={(event) => setPartSourcingForm((current) => ({ ...current, supplier: event.target.value }))} /></label>
                <label>Total cost (KES) *
                  <input className="form-input" type="number" min="0" step="0.01" required value={partSourcingForm.totalCost} onChange={(event) => setPartSourcingForm((current) => ({ ...current, totalCost: event.target.value }))} />
                </label>
                <label>Related maintenance record
                  <select className="form-input" value={partSourcingForm.maintenanceRecordId} onChange={(event) => setPartSourcingForm((current) => ({ ...current, maintenanceRecordId: event.target.value }))} disabled={!partSourcingForm.vehicleId}>
                    <option value="">Not linked</option>
                    {maintenance.filter((record) => record.vehicle?._id === partSourcingForm.vehicleId).map((record) => (
                      <option key={record._id} value={record._id}>{displayDate(record.date)} · {record.description}</option>
                    ))}
                  </select>
                </label>
                <label>Invoice / reference<input className="form-input" maxLength={120} value={partSourcingForm.reference} onChange={(event) => setPartSourcingForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                <label className="wide">Notes<input className="form-input" maxLength={500} value={partSourcingForm.notes} onChange={(event) => setPartSourcingForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                <div className="fleet-operation-actions wide"><button className="btn amber sm" type="submit" disabled={busy}><Plus size={13} /> Record part cost</button></div>
              </form>
            )}
            <div className="fleet-operation-help">Parts are sourced for the specific repair through CFAO, Isuzu or imports; no depot stock is tracked here.</div>
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
          </>
        )}
      </div>
    </section>
  );
}
