import { useEffect, useMemo, useState } from "react";
import { Fuel, Loader2, Plus, Wrench, Package, Gauge, AlertTriangle } from "lucide-react";
import {
  adjustSparePartStock,
  createFuelLog,
  createMaintenanceRecord,
  createMileageRecord,
  createSparePart,
  decideMileageRecord,
  getDrivers,
  getFuelLogs,
  getMaintenanceRecords,
  getMileageOptions,
  getMileageRecords,
  getSpareParts,
  getVehicles,
  updateMaintenanceStatus,
} from "../services/api";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_FUEL = { vehicleId: "", date: today(), odometerKm: "", litres: "", totalCost: "", supplier: "", reference: "", notes: "" };
const EMPTY_MAINTENANCE = { vehicleId: "", date: today(), description: "", vendor: "", cost: "", odometerKm: "", nextDueOdometerKm: "", notes: "" };
const EMPTY_PART = { name: "", code: "", unit: "each", quantity: 0, reorderLevel: 0, unitCost: 0, notes: "" };
const EMPTY_MILEAGE = { movementPlanId: "", tripId: "", vehicleId: "", driverId: "", startOdometerKm: "", endOdometerKm: "" };
const formatKes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const displayDate = (value) => value ? new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const driverLabel = (record) => `${record.driverName} · ${record.planReference} / ${record.tripId}`;

function Status({ value }) {
  return <span className={`fleet-status ${value === "approved" || value === "completed" ? "moving" : value === "rejected" || value === "open" ? "maintenance" : "parked"}`}>{value}</span>;
}

export function FleetOperations({ user }) {
  const [tab, setTab] = useState("fuel");
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [parts, setParts] = useState([]);
  const [mileage, setMileage] = useState([]);
  const [plans, setPlans] = useState([]);
  const [fuelForm, setFuelForm] = useState({ ...EMPTY_FUEL });
  const [maintenanceForm, setMaintenanceForm] = useState({ ...EMPTY_MAINTENANCE });
  const [partForm, setPartForm] = useState({ ...EMPTY_PART });
  const [mileageForm, setMileageForm] = useState({ ...EMPTY_MILEAGE });
  const [stockForm, setStockForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const role = user?.role;
  const canRecordFuel = ["warehouse_manager", "warehouse_operator", "site_engineer", "site_manager", "super_admin"].includes(role);
  const canMaintain = ["warehouse_manager", "site_engineer", "super_admin"].includes(role);
  const canManageParts = ["warehouse_manager", "super_admin"].includes(role);
  const canAdjustParts = ["warehouse_manager", "warehouse_operator", "super_admin"].includes(role);
  const canReviewMileage = ["warehouse_manager", "site_engineer", "super_admin"].includes(role);

  const load = async () => {
    try {
      const [vehicleRows, driverRows, fuels, maintenanceRows, partRows, mileageRows, planRows] = await Promise.all([
        getVehicles(), getDrivers(), getFuelLogs(), getMaintenanceRecords(), getSpareParts(), getMileageRecords(), getMileageOptions(),
      ]);
      setVehicles(vehicleRows);
      setDrivers(driverRows);
      setFuelLogs(fuels);
      setMaintenance(maintenanceRows);
      setParts(partRows);
      setMileage(mileageRows);
      setPlans(planRows);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const selectedPlan = plans.find((plan) => plan._id === mileageForm.movementPlanId);
  const selectedTrip = selectedPlan?.trips.find((trip) => trip.tripId === mileageForm.tripId);
  const selectedAssignment = selectedTrip?.assignments.find((assignment) =>
    assignment.vehicleId === mileageForm.vehicleId && assignment.driverId === mileageForm.driverId
  );
  const selectedDriver = drivers.find((driver) => driver._id === mileageForm.driverId);
  const estimatedKm = Number(mileageForm.endOdometerKm) - Number(mileageForm.startOdometerKm);
  const estimatedEarnings = estimatedKm > 0 && selectedDriver ? estimatedKm * selectedDriver.ratePerKm : 0;
  const approvedEarnings = useMemo(() => mileage
    .filter((record) => record.status === "approved")
    .reduce((sum, record) => sum + record.earnings, 0), [mileage]);
  const lowStock = parts.filter((part) => part.quantity <= part.reorderLevel).length;

  const run = async (action, success) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await load();
      setNotice(success);
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
    const success = await run(() => createFuelLog({ ...fuelForm, odometerKm: Number(fuelForm.odometerKm), litres: Number(fuelForm.litres), totalCost: Number(fuelForm.totalCost) }), "Fuel entry recorded.");
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

  const submitPart = async (event) => {
    event.preventDefault();
    const payload = { ...partForm, quantity: Number(partForm.quantity), reorderLevel: Number(partForm.reorderLevel), unitCost: Number(partForm.unitCost) };
    const success = await run(() => createSparePart(payload), "Spare part added to stock.");
    if (success) setPartForm({ ...EMPTY_PART });
  };

  const submitStock = async (event) => {
    event.preventDefault();
    if (!stockForm) return;
    const { partId, ...payload } = stockForm;
    const success = await run(() => adjustSparePartStock(partId, { ...payload, quantity: Number(payload.quantity) }), "Spare-part stock updated.");
    if (success) setStockForm(null);
  };

  const submitMileage = async (event) => {
    event.preventDefault();
    const success = await run(() => createMileageRecord({
      ...mileageForm,
      startOdometerKm: Number(mileageForm.startOdometerKm),
      endOdometerKm: Number(mileageForm.endOdometerKm),
    }), "Mileage submitted for review.");
    if (success) setMileageForm({ ...EMPTY_MILEAGE });
  };

  const reviewMileage = async (record, decision) => {
    const comment = window.prompt(`Optional comment for ${decision} mileage for ${record.driverName}:`);
    if (comment === null) return;
    await run(() => decideMileageRecord(record._id, decision, comment), `Mileage ${decision}.`);
  };

  const updatePlan = (planId) => {
    const plan = plans.find((item) => item._id === planId);
    const trip = plan?.trips[0];
    const assignment = trip?.assignments[0];
    setMileageForm({
      ...EMPTY_MILEAGE,
      movementPlanId: planId,
      tripId: trip?.tripId || "",
      vehicleId: assignment?.vehicleId || "",
      driverId: assignment?.driverId || "",
    });
  };
  const updateTrip = (tripId) => {
    const trip = selectedPlan?.trips.find((item) => item.tripId === tripId);
    const assignment = trip?.assignments[0];
    setMileageForm((current) => ({ ...current, tripId, vehicleId: assignment?.vehicleId || "", driverId: assignment?.driverId || "" }));
  };

  const tabs = [
    { id: "fuel", label: "Fuel", icon: Fuel },
    { id: "mileage", label: "Mileage & earnings", icon: Gauge },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
    { id: "parts", label: "Spare parts", icon: Package },
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
              {id === "parts" && lowStock > 0 && <span className="fleet-operation-count">{lowStock}</span>}
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
                <label>Date *<input className="form-input" type="date" required value={fuelForm.date} onChange={(event) => setFuelForm((current) => ({ ...current, date: event.target.value }))} /></label>
                <label>Odometer (km) *<input className="form-input" type="number" min="0" required value={fuelForm.odometerKm} onChange={(event) => setFuelForm((current) => ({ ...current, odometerKm: event.target.value }))} /></label>
                <label>Fuel (litres) *<input className="form-input" type="number" min="0.01" step="0.01" required value={fuelForm.litres} onChange={(event) => setFuelForm((current) => ({ ...current, litres: event.target.value }))} /></label>
                <label>Total cost (KES) *<input className="form-input" type="number" min="0" step="0.01" required value={fuelForm.totalCost} onChange={(event) => setFuelForm((current) => ({ ...current, totalCost: event.target.value }))} /></label>
                <label>Supplier<input className="form-input" maxLength={120} value={fuelForm.supplier} onChange={(event) => setFuelForm((current) => ({ ...current, supplier: event.target.value }))} /></label>
                <label>Receipt / reference<input className="form-input" maxLength={120} value={fuelForm.reference} onChange={(event) => setFuelForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                <div className="fleet-operation-actions wide"><button className="btn amber sm" type="submit" disabled={busy}><Plus size={13} /> Record fuel</button></div>
              </form>
            )}
            <div className="fleet-operation-list">
              {fuelLogs.length === 0 && <div className="fleet-operation-empty">No fuel entries recorded.</div>}
              {fuelLogs.map((record) => (
                <article className="fleet-operation-row" key={record._id}>
                  <div className="fleet-operation-main"><strong>{record.vehicle?.plate || "Vehicle"} · {record.litres} L</strong><span>{displayDate(record.date)} · {record.odometerKm.toLocaleString()} km{record.supplier ? ` · ${record.supplier}` : ""}</span>{record.reference && <small>Receipt / reference: {record.reference}</small>}</div>
                  <div className="fleet-operation-meta"><b>{formatKes(record.totalCost)}</b></div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "mileage" && (
          <>
            <div className="fleet-operation-summary">Approved driver earnings to date: <b>{formatKes(approvedEarnings)}</b>. Pending mileage is not included in payable income.</div>
            {plans.length > 0 && (
              <form className="fleet-operation-form" onSubmit={submitMileage}>
                <label>Published movement plan *
                  <select className="form-input" required value={mileageForm.movementPlanId} onChange={(event) => updatePlan(event.target.value)}>
                    <option value="">Select a plan</option>{plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.reference} · {plan.title}</option>)}
                  </select>
                </label>
                <label>Trip *
                  <select className="form-input" required value={mileageForm.tripId} onChange={(event) => updateTrip(event.target.value)} disabled={!selectedPlan}>
                    <option value="">Select a trip</option>{selectedPlan?.trips.map((trip) => <option key={trip.tripId} value={trip.tripId}>{trip.tripId} · {trip.originName} to {trip.destinationName}</option>)}
                  </select>
                </label>
                <label>Vehicle and driver *
                  <select className="form-input" required value={`${mileageForm.vehicleId}|${mileageForm.driverId}`} onChange={(event) => {
                    const [vehicleId, driverId] = event.target.value.split("|");
                    setMileageForm((current) => ({ ...current, vehicleId, driverId }));
                  }} disabled={!selectedTrip}>
                    <option value="|">Select assignment</option>{selectedTrip?.assignments.map((assignment) => <option key={`${assignment.vehicleId}|${assignment.driverId}`} value={`${assignment.vehicleId}|${assignment.driverId}`}>{assignment.vehiclePlate} · {assignment.driverName}</option>)}
                  </select>
                </label>
                <label>Start odometer (km) *<input className="form-input" type="number" min="0" required value={mileageForm.startOdometerKm} onChange={(event) => setMileageForm((current) => ({ ...current, startOdometerKm: event.target.value }))} /></label>
                <label>End odometer (km) *<input className="form-input" type="number" min={Number(mileageForm.startOdometerKm) + 0.01} step="0.01" required value={mileageForm.endOdometerKm} onChange={(event) => setMileageForm((current) => ({ ...current, endOdometerKm: event.target.value }))} /></label>
                <div className="fleet-operation-estimate"><span>Rate: {formatKes(selectedDriver?.ratePerKm || 0)} / km</span><strong>Estimated income: {formatKes(estimatedEarnings)}</strong></div>
                <div className="fleet-operation-actions wide"><button className="btn amber sm" type="submit" disabled={busy || !selectedAssignment || !selectedDriver?.ratePerKm}><Plus size={13} /> Submit mileage</button></div>
              </form>
            )}
            {plans.length === 0 && <div className="fleet-operation-help">Mileage can be recorded for published movement plans that include you. Drivers need a per-kilometre rate configured by a fleet manager.</div>}
            <div className="fleet-operation-list">
              {mileage.length === 0 && <div className="fleet-operation-empty">No mileage submitted yet.</div>}
              {mileage.map((record) => (
                <article className="fleet-operation-row" key={record._id}>
                  <div className="fleet-operation-main"><strong>{driverLabel(record)} · {record.vehiclePlate}</strong><span>{record.distanceKm.toLocaleString()} km · {record.startOdometerKm.toLocaleString()} → {record.endOdometerKm.toLocaleString()} km · {formatKes(record.ratePerKm)} / km</span>{record.decisionComment && <small>Review note: {record.decisionComment}</small>}</div>
                  <div className="fleet-operation-meta"><b>{formatKes(record.earnings)}</b><Status value={record.status} />
                    {canReviewMileage && record.status === "pending" && <div className="fleet-operation-actions"><button className="btn sm amber" disabled={busy} onClick={() => reviewMileage(record, "approved")}>Approve</button><button className="btn sm ghost" disabled={busy} onClick={() => reviewMileage(record, "rejected")}>Reject</button></div>}
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
                <label>Cost (KES)<input className="form-input" type="number" min="0" step="0.01" value={maintenanceForm.cost} onChange={(event) => setMaintenanceForm((current) => ({ ...current, cost: event.target.value }))} /></label>
                <label>Odometer (km)<input className="form-input" type="number" min="0" value={maintenanceForm.odometerKm} onChange={(event) => setMaintenanceForm((current) => ({ ...current, odometerKm: event.target.value }))} /></label>
                <label>Next service (km)<input className="form-input" type="number" min="0" value={maintenanceForm.nextDueOdometerKm} onChange={(event) => setMaintenanceForm((current) => ({ ...current, nextDueOdometerKm: event.target.value }))} /></label>
                <div className="fleet-operation-actions wide"><button className="btn amber sm" type="submit" disabled={busy}><Plus size={13} /> Add maintenance record</button></div>
              </form>
            )}
            <div className="fleet-operation-list">
              {maintenance.length === 0 && <div className="fleet-operation-empty">No maintenance records.</div>}
              {maintenance.map((record) => (
                <article className="fleet-operation-row" key={record._id}>
                  <div className="fleet-operation-main"><strong>{record.vehicle?.plate || "Vehicle"} · {record.description}</strong><span>{displayDate(record.date)} · {record.vendor || "No vendor"}{record.odometerKm != null ? ` · ${record.odometerKm.toLocaleString()} km` : ""}{record.nextDueOdometerKm != null ? ` · next service at ${record.nextDueOdometerKm.toLocaleString()} km` : ""}</span></div>
                  <div className="fleet-operation-meta"><b>{formatKes(record.cost)}</b><Status value={record.status} />{canMaintain && record.status === "open" && <button className="btn sm ghost" disabled={busy} onClick={() => run(() => updateMaintenanceStatus(record._id, "completed"), "Maintenance marked complete.")}>Complete</button>}</div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "parts" && (
          <>
            {canManageParts && (
              <form className="fleet-operation-form" onSubmit={submitPart}>
                <label>Part name *<input className="form-input" required minLength={2} maxLength={120} value={partForm.name} onChange={(event) => setPartForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Part code<input className="form-input" maxLength={40} value={partForm.code} onChange={(event) => setPartForm((current) => ({ ...current, code: event.target.value }))} /></label>
                <label>Unit<input className="form-input" maxLength={20} value={partForm.unit} onChange={(event) => setPartForm((current) => ({ ...current, unit: event.target.value }))} /></label>
                <label>Opening stock<input className="form-input" type="number" min="0" value={partForm.quantity} onChange={(event) => setPartForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
                <label>Reorder at<input className="form-input" type="number" min="0" value={partForm.reorderLevel} onChange={(event) => setPartForm((current) => ({ ...current, reorderLevel: event.target.value }))} /></label>
                <label>Unit cost (KES)<input className="form-input" type="number" min="0" step="0.01" value={partForm.unitCost} onChange={(event) => setPartForm((current) => ({ ...current, unitCost: event.target.value }))} /></label>
                <div className="fleet-operation-actions wide"><button className="btn amber sm" type="submit" disabled={busy}><Plus size={13} /> Add part</button></div>
              </form>
            )}
            {stockForm && (
              <form className="fleet-operation-form stock-adjustment" onSubmit={submitStock}>
                <strong className="wide">{stockForm.partName} · Adjust stock</strong>
                <label>Action<select className="form-input" value={stockForm.direction} onChange={(event) => setStockForm((current) => ({ ...current, direction: event.target.value }))}><option value="receive">Receive stock</option><option value="issue">Issue stock</option></select></label>
                <label>Quantity<input className="form-input" type="number" min="0.01" step="0.01" required value={stockForm.quantity} onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
                <div className="fleet-operation-actions"><button className="btn amber sm" type="submit" disabled={busy}>Update stock</button><button type="button" className="btn ghost sm" onClick={() => setStockForm(null)}>Cancel</button></div>
              </form>
            )}
            <div className="fleet-operation-list">
              {parts.length === 0 && <div className="fleet-operation-empty">No spare parts in stock.</div>}
              {parts.map((part) => (
                <article className="fleet-operation-row" key={part._id}>
                  <div className="fleet-operation-main"><strong>{part.name}{part.code ? ` · ${part.code}` : ""}</strong><span>{formatKes(part.unitCost)} per {part.unit} · reorder level {part.reorderLevel}</span></div>
                  <div className="fleet-operation-meta"><b className={part.quantity <= part.reorderLevel ? "fleet-low-stock" : ""}>{part.quantity} {part.unit}</b>{part.quantity <= part.reorderLevel && <span className="fleet-status maintenance">Low stock</span>}{canAdjustParts && <button className="btn sm ghost" onClick={() => setStockForm({ partId: part._id, partName: part.name, direction: "receive", quantity: "" })}>Adjust</button>}</div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
