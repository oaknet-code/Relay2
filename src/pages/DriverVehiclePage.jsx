import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Fuel, Gauge, Loader2, RefreshCw, Truck, Wallet, Wrench, XCircle } from "lucide-react";
import { createDriverFuel, createDriverVehicleCheck, getDriverFleet, reportDriverVehicleIssue } from "../services/api";
import { FleetModal } from "../components/FleetModal";
import "../styles/custody.css";
import "../styles/driver.css";

// "My Vehicle" for a driver: the vehicles they drive, with the pre-trip
// check, fuel logging (each fill-up is also a fuel expense claim for CEO
// review) and problem reports; plus their history and per diem.

const today = () => new Date().toISOString().slice(0, 10);
const km = (value) => (value == null ? "—" : `${Number(value).toLocaleString("en-KE")} km`);
const kes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const fmtDay = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const fmtTime = (value) => (value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const errorText = (err, fallback) => err.response?.data?.message || err.message || fallback;

const VEHICLE_STATUS = { available: ["Available", "done"], in_use: ["In use", "moving"], maintenance: ["In maintenance", "collect"] };
const CLAIM_STATUS = { submitted: ["Claim awaiting review", "collect"], approved: ["Claim approved", "done"], rejected: ["Claim rejected", "bad"], paid: ["Paid", "done"] };
const PER_DIEM_STATUS = { pending: ["Awaiting review", "collect"], approved: ["Approved", "done"], rejected: ["Rejected", "bad"] };
const TABS = [["fuel", "Fuel", Fuel], ["checks", "Checks", ClipboardCheck], ["problems", "Problems", Wrench], ["per-diem", "Per diem", Wallet]];

export function DriverVehiclePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("fuel");
  const [modal, setModal] = useState(null); // { kind: "fuel" | "check" | "problem", vehicle }

  const load = useCallback(async () => {
    try {
      setData(await getDriverFleet());
      setError("");
    } catch (err) {
      setError(errorText(err, "Couldn't load your vehicles."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const done = async (message, result) => {
    setModal(null);
    setNotice([message, result?.notificationWarning].filter(Boolean).join(" "));
    await load();
  };

  const vehicles = data?.vehicles || [];

  return (
    <div className="driver-trips">
      <div className="view-head">
        <span className="tagchip"><Truck size={11} /> Driver</span>
        <h2>My vehicle</h2>
        <p>Check the vehicle before every trip, log each fill-up, and report anything wrong straight away.</p>
      </div>

      <div className="driver-toolbar">
        <button type="button" className="btn sm ghost" onClick={() => { setLoading(true); load(); }} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {notice && <div className="driver-notice" role="status"><CheckCircle2 size={14} /> {notice}</div>}
      {error && <div className="driver-error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      {loading && !data ? (
        <div className="faint driver-empty"><Loader2 size={16} className="spin" /> Loading…</div>
      ) : data && vehicles.length === 0 ? (
        <div className="panel driver-empty">
          <Truck size={22} />
          <div>No vehicle is assigned to you yet. The super admin sets your usual vehicle in Fleet; vehicles on your trips show up here too.</div>
        </div>
      ) : (
        vehicles.map((vehicle) => (
          <VehicleCard key={vehicle._id} vehicle={vehicle} onAction={(kind) => { setNotice(""); setModal({ kind, vehicle }); }} />
        ))
      )}

      {data && (
        <section className="driver-history">
          <div className="dv-tabs" role="tablist">
            {TABS.map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={`dv-tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          {tab === "fuel" && <FuelHistory rows={data.fuel} />}
          {tab === "checks" && <CheckHistory rows={data.checks} />}
          {tab === "problems" && <ProblemHistory rows={data.issues} />}
          {tab === "per-diem" && <PerDiemHistory rows={data.perDiem} rate={data.driver?.perDiemRate} />}
        </section>
      )}

      {modal?.kind === "fuel" && (
        <FuelModal vehicles={vehicles} vehicle={modal.vehicle} onClose={() => setModal(null)}
          onSaved={(result) => done("Fuel logged. A fuel claim has gone to the CEO for review.", result)} />
      )}
      {modal?.kind === "check" && (
        <CheckModal vehicle={modal.vehicle} items={data.checkItems} onClose={() => setModal(null)}
          onSaved={(result) => done(result.passed
            ? `${modal.vehicle.plate} checked: all OK. Safe trip!`
            : `${modal.vehicle.plate} check saved. The fleet team has been told about the problem.`, result)} />
      )}
      {modal?.kind === "problem" && (
        <ProblemModal vehicle={modal.vehicle} onClose={() => setModal(null)}
          onSaved={(result) => done("Problem reported. The fleet team has been alerted.", result)} />
      )}
    </div>
  );
}

function VehicleCard({ vehicle, onAction }) {
  const [statusLabel, statusClass] = VEHICLE_STATUS[vehicle.status] || [vehicle.status, "collect"];
  return (
    <article className="panel driver-trip">
      <header className="driver-trip-head">
        <div>
          <div className="driver-trip-id">{vehicle.plate}</div>
          <div className="driver-trip-to">{[vehicle.make, vehicle.body].filter(Boolean).join(" · ")}{vehicle.usual ? "" : " · from your trips"}</div>
        </div>
        <span className={`driver-stage ${statusClass}`}>{statusLabel}</span>
      </header>

      <div className="dv-stats">
        <div><span>Odometer</span><b><Gauge size={12} /> {km(vehicle.odometerKm)}</b></div>
        <div className={vehicle.serviceDue ? "warn" : ""}>
          <span>Next service</span>
          <b>{vehicle.nextServiceKm == null ? "Not set" : vehicle.serviceDue ? `Due now (${km(vehicle.nextServiceKm)})` : km(vehicle.nextServiceKm)}</b>
        </div>
        <div className={vehicle.checkedToday ? (vehicle.lastCheck.passed ? "ok" : "warn") : "warn"}>
          <span>Pre-trip check</span>
          <b>{vehicle.checkedToday ? (vehicle.lastCheck.passed ? "Done today · all OK" : "Done today · problems") : "Not done today"}</b>
        </div>
        {vehicle.openIssues > 0 && <div className="warn"><span>Your open reports</span><b>{vehicle.openIssues}</b></div>}
      </div>

      {vehicle.status === "maintenance" && (
        <div className="driver-wait"><Wrench size={13} /> This vehicle is in maintenance. Don&apos;t drive it until the fleet team clears it.</div>
      )}

      <div className="driver-actions">
        <button type="button" className={`btn driver-big ${vehicle.checkedToday ? "ghost" : "amber"}`} onClick={() => onAction("check")}>
          <ClipboardCheck size={16} /> {vehicle.checkedToday ? "Check again" : "Pre-trip check"}
        </button>
        <button type="button" className="btn driver-big ghost" onClick={() => onAction("fuel")}>
          <Fuel size={16} /> Log fuel
        </button>
        <button type="button" className="btn driver-big ghost" onClick={() => onAction("problem")}>
          <AlertTriangle size={16} /> Report a problem
        </button>
      </div>
    </article>
  );
}

function Chip({ map, value, extra }) {
  const [label, className] = map[value] || [value || "—", "collect"];
  return <span className={`driver-stage ${className}`}>{label}{extra}</span>;
}

function Empty({ children }) {
  return <div className="faint dv-empty">{children}</div>;
}

function FuelHistory({ rows }) {
  if (!rows.length) return <Empty>No fuel logged yet.</Empty>;
  return rows.map((row) => (
    <div key={row._id} className="dv-row">
      <div>
        <strong>{row.vehicle?.plate || "Vehicle"} · {row.litres} L · {kes(row.totalCost)}</strong>
        <span className="faint">{fmtDay(row.date)} · {km(row.odometerKm)}{row.supplier ? ` · ${row.supplier}` : ""}{row.purpose ? ` · ${row.purpose}` : ""}</span>
        {row.expenseClaim?.status === "rejected" && row.expenseClaim.decisionComment && <span className="dv-bad">{row.expenseClaim.decisionComment}</span>}
      </div>
      {row.expenseClaim && <Chip map={CLAIM_STATUS} value={row.expenseClaim.status} />}
    </div>
  ));
}

function CheckHistory({ rows }) {
  if (!rows.length) return <Empty>No vehicle checks yet.</Empty>;
  return rows.map((row) => {
    const failed = row.items.filter((item) => !item.ok);
    return (
      <div key={row._id} className="dv-row">
        <div>
          <strong>{row.vehicle?.plate || "Vehicle"} · {fmtTime(row.createdAt)}</strong>
          <span className="faint">{km(row.odometerKm)}</span>
          {failed.map((item) => <span key={item.key} className="dv-bad">{item.label}: {item.note}</span>)}
        </div>
        <span className={`driver-stage ${row.passed ? "done" : row.safeToDrive ? "collect" : "bad"}`}>
          {row.passed ? "All OK" : row.safeToDrive ? `${failed.length} not OK` : "Unsafe"}
        </span>
      </div>
    );
  });
}

function ProblemHistory({ rows }) {
  if (!rows.length) return <Empty>No problems reported.</Empty>;
  return rows.map((row) => (
    <div key={row._id} className="dv-row">
      <div>
        <strong>{row.vehicle?.plate || "Vehicle"} · {row.description}</strong>
        <span className="faint">{fmtDay(row.date)}{row.odometerKm != null ? ` · ${km(row.odometerKm)}` : ""}{row.severity === "unsafe" ? " · reported unsafe" : ""}</span>
      </div>
      <span className={`driver-stage ${row.status === "completed" ? "done" : "collect"}`}>{row.status === "completed" ? "Fixed" : "Open"}</span>
    </div>
  ));
}

function PerDiemHistory({ rows, rate }) {
  return (
    <>
      <div className="faint dv-empty" style={{ paddingTop: 4 }}>
        {rate > 0 ? `Your rate: ${kes(rate)} per day, for trips outside Nairobi Metropolitan Area. It's recorded by the movement plan team.` : "Per diem is recorded by the movement plan team for trips outside Nairobi Metropolitan Area."}
      </div>
      {rows.length === 0 ? <Empty>No per diem yet.</Empty> : rows.map((row) => (
        <div key={row._id} className="dv-row">
          <div>
            <strong>{row.planReference} / {row.tripId} · {kes(row.totalAmount)}</strong>
            <span className="faint">{row.startDate} to {row.endDate} · {row.eligibleDays} day{row.eligibleDays === 1 ? "" : "s"}{row.vehiclePlate ? ` · ${row.vehiclePlate}` : ""}</span>
            {row.status === "rejected" && row.decisionComment && <span className="dv-bad">{row.decisionComment}</span>}
          </div>
          <Chip map={PER_DIEM_STATUS} value={row.status} />
        </div>
      ))}
    </>
  );
}

function useSubmit(onSaved) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const submit = async (action) => {
    setBusy(true);
    setProblem("");
    try {
      onSaved(await action());
    } catch (err) {
      setProblem(errorText(err, "That didn't go through. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, setProblem, submit };
}

function FormFooter({ busy, problem, onClose, label, icon }) {
  return (
    <>
      {problem && <div role="alert" className="receipt-problem"><AlertTriangle size={13} /> {problem}</div>}
      <div className="receipt-actions">
        <button type="button" className="btn sm ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn amber sm" disabled={busy}>{busy ? <Loader2 size={13} className="spin" /> : icon} {label}</button>
      </div>
    </>
  );
}

function FuelModal({ vehicles, vehicle, onClose, onSaved }) {
  const [form, setForm] = useState({ vehicleId: vehicle._id, date: today(), odometerKm: "", litres: "", totalCost: "", supplier: "", reference: "", purpose: "", notes: "" });
  const { busy, problem, setProblem, submit } = useSubmit(onSaved);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const selected = vehicles.find((item) => item._id === form.vehicleId) || vehicle;
  const perLitre = Number(form.litres) > 0 && Number(form.totalCost) > 0 ? Number(form.totalCost) / Number(form.litres) : null;
  const onSubmit = (event) => {
    event.preventDefault();
    const odometer = Number(form.odometerKm);
    if (!form.odometerKm || Number.isNaN(odometer)) { setProblem("Enter the odometer reading."); return; }
    if (selected.odometerKm != null && odometer < selected.odometerKm) { setProblem(`The odometer can't be lower than the last reading (${km(selected.odometerKm)}).`); return; }
    if (!(Number(form.litres) > 0)) { setProblem("Enter the litres filled."); return; }
    if (!(Number(form.totalCost) > 0)) { setProblem("Enter the total cost on the receipt."); return; }
    if (form.purpose.trim().length < 2) { setProblem("Say what the fuel is for, e.g. the trip or errand."); return; }
    submit(() => createDriverFuel({ ...form, odometerKm: odometer, litres: Number(form.litres), totalCost: Number(form.totalCost), purpose: form.purpose.trim() }));
  };
  return (
    <FleetModal title="Log fuel" description="Fill in what's on the fuel receipt. It's sent to the CEO as a fuel claim." onClose={() => { if (!busy) onClose(); }}>
      <form className="driver-form dv-form" onSubmit={onSubmit} noValidate>
        {vehicles.length > 1 && (
          <label className="receipt-field">Vehicle
            <select className="form-input" value={form.vehicleId} onChange={set("vehicleId")} disabled={busy}>
              {vehicles.map((item) => <option key={item._id} value={item._id}>{item.plate} · {item.make}</option>)}
            </select>
          </label>
        )}
        <div className="dv-grid">
          <label className="receipt-field">Date *<input className="form-input" type="date" max={today()} value={form.date} onChange={set("date")} disabled={busy} /></label>
          <label className="receipt-field">Odometer (km) *
            <input className="form-input" type="number" inputMode="numeric" min={selected.odometerKm || 0} value={form.odometerKm} onChange={set("odometerKm")} placeholder={selected.odometerKm != null ? `Last: ${selected.odometerKm}` : ""} disabled={busy} />
          </label>
          <label className="receipt-field">Litres *<input className="form-input" type="number" inputMode="decimal" min="0" step="0.01" value={form.litres} onChange={set("litres")} disabled={busy} /></label>
          <label className="receipt-field">Total cost (KES) *<input className="form-input" type="number" inputMode="decimal" min="0" step="0.01" value={form.totalCost} onChange={set("totalCost")} disabled={busy} /></label>
          <label className="receipt-field">Fuel station<input className="form-input" maxLength={120} value={form.supplier} onChange={set("supplier")} disabled={busy} /></label>
          <label className="receipt-field">Receipt number<input className="form-input" maxLength={120} value={form.reference} onChange={set("reference")} disabled={busy} /></label>
        </div>
        {perLitre && <div className="faint" style={{ fontSize: 11.5 }}>{kes(perLitre)} per litre</div>}
        <label className="receipt-field">What is it for? *<input className="form-input" maxLength={200} value={form.purpose} onChange={set("purpose")} placeholder="e.g. Dispatch GP-0042 to Mombasa" disabled={busy} /></label>
        <label className="receipt-field">Note (optional)<input className="form-input" maxLength={500} value={form.notes} onChange={set("notes")} disabled={busy} /></label>
        <FormFooter busy={busy} problem={problem} onClose={onClose} label="Log fuel" icon={<Fuel size={13} />} />
      </form>
    </FleetModal>
  );
}

function CheckModal({ vehicle, items, onClose, onSaved }) {
  const [odometerKm, setOdometerKm] = useState("");
  const [answers, setAnswers] = useState(() => Object.fromEntries(items.map((item) => [item.key, { ok: null, note: "" }])));
  const [safeToDrive, setSafeToDrive] = useState(null);
  const [notes, setNotes] = useState("");
  const { busy, problem, setProblem, submit } = useSubmit(onSaved);
  const answer = (key, change) => setAnswers((current) => ({ ...current, [key]: { ...current[key], ...change } }));
  const failed = items.filter((item) => answers[item.key].ok === false);
  const unanswered = items.filter((item) => answers[item.key].ok === null);
  const onSubmit = (event) => {
    event.preventDefault();
    const odometer = Number(odometerKm);
    if (!odometerKm || Number.isNaN(odometer)) { setProblem("Enter the odometer reading."); return; }
    if (vehicle.odometerKm != null && odometer < vehicle.odometerKm) { setProblem(`The odometer can't be lower than the last reading (${km(vehicle.odometerKm)}).`); return; }
    if (unanswered.length) { setProblem(`Mark every item OK or Not OK (${unanswered.length} left).`); return; }
    const noNote = failed.filter((item) => !answers[item.key].note.trim());
    if (noNote.length) { setProblem(`Say what's wrong with: ${noNote.map((item) => item.label).join(", ")}.`); return; }
    if (failed.length && safeToDrive === null) { setProblem("Say whether the vehicle is safe to drive."); return; }
    submit(() => createDriverVehicleCheck({
      vehicleId: vehicle._id,
      odometerKm: odometer,
      items: items.map((item) => ({ key: item.key, ok: answers[item.key].ok, note: answers[item.key].note.trim() })),
      safeToDrive: failed.length ? safeToDrive : true,
      notes: notes.trim(),
    }));
  };
  return (
    <FleetModal title={`Pre-trip check · ${vehicle.plate}`} description="Walk round the vehicle and mark each item." onClose={() => { if (!busy) onClose(); }}>
      <form className="driver-form dv-form" onSubmit={onSubmit} noValidate>
        <label className="receipt-field">Odometer (km) *
          <input className="form-input" type="number" inputMode="numeric" min={vehicle.odometerKm || 0} value={odometerKm} onChange={(event) => setOdometerKm(event.target.value)} placeholder={vehicle.odometerKm != null ? `Last: ${vehicle.odometerKm}` : ""} disabled={busy} />
        </label>
        <ul className="dv-checks">
          {items.map((item) => {
            const value = answers[item.key];
            return (
              <li key={item.key} className={value.ok === false ? "bad" : ""}>
                <div className="dv-check-row">
                  <span>{item.label}</span>
                  <div className="dv-okbtns">
                    <button type="button" className={`driver-chip ${value.ok === true ? "on" : ""}`} aria-pressed={value.ok === true} onClick={() => answer(item.key, { ok: true })} disabled={busy}><CheckCircle2 size={13} /> OK</button>
                    <button type="button" className={`driver-chip ${value.ok === false ? "on bad" : ""}`} aria-pressed={value.ok === false} onClick={() => answer(item.key, { ok: false })} disabled={busy}><XCircle size={13} /> Not OK</button>
                  </div>
                </div>
                {value.ok === false && (
                  <input className="form-input" maxLength={200} placeholder="What's wrong?" value={value.note} onChange={(event) => answer(item.key, { note: event.target.value })} disabled={busy} />
                )}
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn sm ghost" style={{ justifySelf: "start" }} disabled={busy}
          onClick={() => setAnswers((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value.ok === null ? { ...value, ok: true } : value])))}>
          <CheckCircle2 size={13} /> Mark the rest OK
        </button>
        {failed.length > 0 && <SafeQuestion value={safeToDrive} onChange={setSafeToDrive} busy={busy} />}
        <label className="receipt-field">Note (optional)<input className="form-input" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={busy} /></label>
        <FormFooter busy={busy} problem={problem} onClose={onClose} label="Save check" icon={<ClipboardCheck size={13} />} />
      </form>
    </FleetModal>
  );
}

function SafeQuestion({ value, onChange, busy }) {
  return (
    <div className="receipt-field">
      Is the vehicle safe to drive? *
      <div className="driver-choice" role="radiogroup" aria-label="Safe to drive">
        <button type="button" role="radio" aria-checked={value === true} className={`driver-chip ${value === true ? "on" : ""}`} onClick={() => onChange(true)} disabled={busy}>Yes, it can be driven</button>
        <button type="button" role="radio" aria-checked={value === false} className={`driver-chip ${value === false ? "on bad" : ""}`} onClick={() => onChange(false)} disabled={busy}>No, it&apos;s unsafe</button>
      </div>
      {value === false && <span className="dv-bad">The vehicle will be marked as in maintenance until the fleet team clears it.</span>}
    </div>
  );
}

function ProblemModal({ vehicle, onClose, onSaved }) {
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [safeToDrive, setSafeToDrive] = useState(null);
  const { busy, problem, setProblem, submit } = useSubmit(onSaved);
  const onSubmit = (event) => {
    event.preventDefault();
    if (description.trim().length < 3) { setProblem("Say what's wrong with the vehicle."); return; }
    if (safeToDrive === null) { setProblem("Say whether the vehicle is safe to drive."); return; }
    const odometer = odometerKm === "" ? null : Number(odometerKm);
    if (odometer != null && vehicle.odometerKm != null && odometer < vehicle.odometerKm) { setProblem(`The odometer can't be lower than the last reading (${km(vehicle.odometerKm)}).`); return; }
    submit(() => reportDriverVehicleIssue({ vehicleId: vehicle._id, description: description.trim(), notes: notes.trim(), odometerKm: odometer, safeToDrive }));
  };
  return (
    <FleetModal title={`Report a problem · ${vehicle.plate}`} description="The super admin and Project Managers are alerted straight away." onClose={() => { if (!busy) onClose(); }}>
      <form className="driver-form dv-form" onSubmit={onSubmit} noValidate>
        <label className="receipt-field">What&apos;s wrong? *
          <input className="form-input" maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Brake warning light on, noise from front left wheel" disabled={busy} />
        </label>
        <SafeQuestion value={safeToDrive} onChange={setSafeToDrive} busy={busy} />
        <label className="receipt-field">Odometer (km, optional)
          <input className="form-input" type="number" inputMode="numeric" value={odometerKm} onChange={(event) => setOdometerKm(event.target.value)} disabled={busy} />
        </label>
        <label className="receipt-field">More detail (optional)
          <textarea className="form-input" rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={busy} />
        </label>
        <FormFooter busy={busy} problem={problem} onClose={onClose} label="Send report" icon={<AlertTriangle size={13} />} />
      </form>
    </FleetModal>
  );
}
