import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, Image as ImageIcon, Loader2, Paperclip, Plus, Trash2, Wallet } from "lucide-react";
import { FleetModal } from "./FleetModal";
import { createPerDiemRecord, getPerDiemDocument, getPerDiemOptions } from "../services/api";
import "../styles/driver.css";

// Driver per diem is "go and spend, then claim": the driver pays during the
// trip, then claims what they spent, line by line, with the receipts
// attached. Used on Fleet → Per diem (the office, possibly on a driver's
// behalf) and on the driver's My Vehicle page.

const PER_DIEM_CATEGORIES = [
  ["meals", "Meals"],
  ["accommodation", "Accommodation"],
  ["transport", "Transport"],
  ["other", "Other"],
];
const CATEGORY_LABEL = Object.fromEntries(PER_DIEM_CATEGORIES);
const LINKS = [["plan_trip", "Movement plan trip"], ["dispatch", "Dispatch"], ["other", "Other trip"]];
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024;

const today = () => new Date().toISOString().slice(0, 10);
const kes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDay = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const newLine = (date = today()) => ({ category: "meals", date, description: "", amount: "" });

function perDiemLinkLabel(record) {
  if (record.linkKind === "dispatch") return `Dispatch ${record.waybillId}`;
  if (record.linkKind === "other") return record.purpose || "Other trip";
  return [record.planReference, record.tripId].filter(Boolean).join(" / ");
}

// Opens a receipt in a new tab (fetched with the session cookie).
async function openDocument(claimId, doc, setError) {
  const win = window.open("", "_blank");
  try {
    const blob = await getPerDiemDocument(claimId, doc.file);
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    win?.close();
    setError?.(err.message || "Couldn't open the receipt.");
  }
}

const PER_DIEM_STATUS = { pending: ["Awaiting review", "collect"], approved: ["Approved", "done"], rejected: ["Rejected", "bad"] };

// One claim: who, what it was for, the spending, receipts and status.
export function PerDiemClaimRow({ record, showDriver = true, actions = null }) {
  const [error, setError] = useState("");
  const [label, className] = PER_DIEM_STATUS[record.status] || [record.status, "collect"];
  const byCategory = (record.lines || []).reduce((sum, line) => ({ ...sum, [line.category]: (sum[line.category] || 0) + line.amount }), {});
  return (
    <div className="dv-row pd-row">
      <div>
        <strong>{showDriver ? `${record.driverName} · ` : ""}{perDiemLinkLabel(record)} · {kes(record.totalAmount)}</strong>
        <span className="faint">
          {fmtDay(record.startDate)}{record.endDate && fmtDay(record.endDate) !== fmtDay(record.startDate) ? ` – ${fmtDay(record.endDate)}` : ""}
          {record.vehiclePlate ? ` · ${record.vehiclePlate}` : ""}
          {record.onBehalf ? ` · submitted by ${record.submittedByName}` : ""}
        </span>
        {record.lines?.length > 0 ? (
          <span className="faint">{Object.entries(byCategory).map(([category, amount]) => `${CATEGORY_LABEL[category] || category} ${kes(amount)}`).join(" · ")}</span>
        ) : record.ratePerDay != null && (
          <span className="faint">Fixed-rate record: {record.eligibleDays} day{record.eligibleDays === 1 ? "" : "s"} × {kes(record.ratePerDay)}</span>
        )}
        {record.notes && <span className="faint">Note: {record.notes}</span>}
        {record.documents?.length > 0 && (
          <div className="pd-docs">
            {record.documents.map((doc, i) => (
              <button key={String(doc.file)} type="button" className="pd-doc" onClick={() => openDocument(record._id, doc, setError)}>
                {doc.contentType === "application/pdf" ? <FileText size={12} /> : <ImageIcon size={12} />} {doc.name || `Receipt ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        {record.decisionComment && <span className={record.status === "rejected" ? "dv-bad" : "faint"}>Review note: {record.decisionComment}</span>}
        {error && <span className="dv-bad">{error}</span>}
      </div>
      <div className="pd-side">
        <span className={`driver-stage ${className}`}>{label}</span>
        {actions}
      </div>
    </div>
  );
}

// The claim form. mode "driver": for the signed-in driver; "office": choose
// the driver (claim on their behalf).
export function PerDiemClaimForm({ mode, drivers = [], vehicles = [], onClose, onSaved }) {
  const isDriver = mode === "driver";
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ driverId: "", linkKind: "plan_trip", movementPlanId: "", tripId: "", dispatchId: "", purpose: "", vehicleId: "", startDate: today(), endDate: today(), notes: "" });
  const [lines, setLines] = useState([newLine()]);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    getPerDiemOptions().then(setOptions).catch((err) => setLoadError(err.message || "Couldn't load your trips."));
  }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const driverId = isDriver ? String(options?.driver?._id || "") : form.driverId;
  const activeDrivers = drivers.filter((driver) => driver.status === "active");

  // Trips and dispatches for the chosen driver.
  const planTrips = useMemo(() => (options?.plans || []).flatMap((plan) => plan.trips
    .filter((trip) => !driverId || trip.assignments.some((a) => a.driverId === driverId))
    .map((trip) => ({ ...trip, planId: plan._id, planReference: plan.reference, planTitle: plan.title }))), [options, driverId]);
  const dispatches = useMemo(() => (options?.dispatches || []).filter((d) => isDriver || !driverId || d.driverId === driverId
    || (!d.driverId && d.driverName?.trim().toLowerCase() === drivers.find((x) => x._id === driverId)?.name?.trim().toLowerCase())), [options, driverId, isDriver, drivers]);

  const pickTrip = (value) => {
    const [planId, tripId] = value.split("|");
    const trip = planTrips.find((item) => item.planId === planId && item.tripId === tripId);
    setForm((current) => ({ ...current, movementPlanId: planId || "", tripId: tripId || "", ...(trip ? { startDate: trip.startDate, endDate: trip.endDate } : {}) }));
    if (trip) setLines((current) => current.map((line) => (line.amount === "" ? { ...line, date: trip.startDate } : line)));
  };
  const pickDispatch = (id) => {
    const dispatch = dispatches.find((item) => item._id === id);
    setForm((current) => ({ ...current, dispatchId: id, ...(dispatch?.startDate ? { startDate: dispatch.startDate, endDate: dispatch.endDate || dispatch.startDate } : {}) }));
  };

  const setLine = (index, change) => setLines((current) => current.map((line, i) => (i === index ? { ...line, ...change } : line)));
  const total = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

  const addFiles = (list) => {
    const picked = Array.from(list || []);
    const tooBig = picked.find((file) => file.size > MAX_BYTES);
    if (tooBig) { setProblem(`"${tooBig.name}" is over 5 MB. Take the photo at a lower size or scan it to PDF.`); return; }
    setProblem("");
    setFiles((current) => [...current, ...picked].slice(0, MAX_FILES));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!isDriver && !form.driverId) return setProblem("Choose the driver.");
    if (form.linkKind === "plan_trip" && !form.tripId) return setProblem("Choose the movement plan trip.");
    if (form.linkKind === "dispatch" && !form.dispatchId) return setProblem("Choose the dispatch.");
    if (form.linkKind === "other" && form.purpose.trim().length < 3) return setProblem("Say what the trip was for.");
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return setProblem("Check the trip dates: the end can't be before the start.");
    const bad = lines.findIndex((line) => !(Number(line.amount) > 0) || !line.date);
    if (bad >= 0) return setProblem(`Expense ${bad + 1}: enter the date and the amount spent.`);
    const outside = lines.findIndex((line) => line.date < form.startDate || line.date > form.endDate);
    if (outside >= 0) return setProblem(`Expense ${outside + 1} is dated outside the trip (${form.startDate} to ${form.endDate}).`);
    if (!files.length) return setProblem("Attach the receipts: a photo or PDF of each one.");
    setBusy(true);
    setProblem("");
    try {
      const payload = {
        ...form,
        driverId: isDriver ? null : form.driverId,
        movementPlanId: form.linkKind === "plan_trip" ? form.movementPlanId : null,
        tripId: form.linkKind === "plan_trip" ? form.tripId : "",
        dispatchId: form.linkKind === "dispatch" ? form.dispatchId : null,
        purpose: form.linkKind === "other" ? form.purpose.trim() : "",
        vehicleId: form.linkKind === "other" ? form.vehicleId || null : null,
        lines: lines.map((line) => ({ category: line.category, date: line.date, description: line.description.trim(), amount: Number(line.amount) })),
        notes: form.notes.trim(),
      };
      onSaved(await createPerDiemRecord(payload, files));
    } catch (err) {
      setProblem(err.message || "The claim didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FleetModal wide title={isDriver ? "Claim per diem" : "Submit a per diem claim"}
      description="Enter what was spent on the trip, line by line, and attach a photo or PDF of every receipt. The super admin or CEO reviews it."
      onClose={() => { if (!busy) onClose(); }}>
      {loadError && <div role="alert" className="receipt-problem"><AlertTriangle size={13} /> {loadError}</div>}
      {!options && !loadError ? (
        <div className="faint"><Loader2 size={14} className="spin" /> Loading trips…</div>
      ) : options && (
        <form className="driver-form dv-form" onSubmit={submit} noValidate>
          {!isDriver && (
            <label className="receipt-field">Driver *
              <select className="form-input" value={form.driverId} onChange={(event) => setForm((current) => ({ ...current, driverId: event.target.value, movementPlanId: "", tripId: "", dispatchId: "" }))} disabled={busy}>
                <option value="">Choose the driver</option>
                {activeDrivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.name}</option>)}
              </select>
            </label>
          )}

          <div className="receipt-field">What was the trip?
            <div className="driver-choice" role="radiogroup" aria-label="Trip">
              {LINKS.map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={form.linkKind === value} className={`driver-chip ${form.linkKind === value ? "on" : ""}`} onClick={() => set("linkKind", value)} disabled={busy}>{label}</button>
              ))}
            </div>
          </div>

          {form.linkKind === "plan_trip" && (
            <label className="receipt-field">Movement plan trip *
              <select className="form-input" value={form.tripId ? `${form.movementPlanId}|${form.tripId}` : ""} onChange={(event) => pickTrip(event.target.value)} disabled={busy || (!isDriver && !form.driverId)}>
                <option value="">{!isDriver && !form.driverId ? "Choose the driver first" : planTrips.length ? "Choose the trip" : "No published plan trips for this driver"}</option>
                {planTrips.map((trip) => (
                  <option key={`${trip.planId}|${trip.tripId}`} value={`${trip.planId}|${trip.tripId}`}>
                    {trip.planReference} / {trip.tripId} · {trip.originName} to {trip.destinationName} · {trip.startDate}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.linkKind === "dispatch" && (
            <label className="receipt-field">Dispatch *
              <select className="form-input" value={form.dispatchId} onChange={(event) => pickDispatch(event.target.value)} disabled={busy || (!isDriver && !form.driverId)}>
                <option value="">{!isDriver && !form.driverId ? "Choose the driver first" : dispatches.length ? "Choose the dispatch" : "No recent dispatches for this driver"}</option>
                {dispatches.map((dispatch) => (
                  <option key={dispatch._id} value={dispatch._id}>{dispatch.waybillId} · {dispatch.siteName}{dispatch.vehiclePlate ? ` · ${dispatch.vehiclePlate}` : ""} · {dispatch.startDate}</option>
                ))}
              </select>
            </label>
          )}
          {form.linkKind === "other" && (
            <div className="dv-grid">
              <label className="receipt-field">What was it for? *
                <input className="form-input" maxLength={200} value={form.purpose} onChange={(event) => set("purpose", event.target.value)} placeholder="e.g. Vehicle service in Nakuru" disabled={busy} />
              </label>
              <label className="receipt-field">Vehicle (optional)
                <select className="form-input" value={form.vehicleId} onChange={(event) => set("vehicleId", event.target.value)} disabled={busy}>
                  <option value="">None</option>
                  {vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.plate}{vehicle.make ? ` · ${vehicle.make}` : ""}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="dv-grid">
            <label className="receipt-field">Trip start *<input className="form-input" type="date" max={today()} value={form.startDate} onChange={(event) => set("startDate", event.target.value)} disabled={busy} /></label>
            <label className="receipt-field">Trip end *<input className="form-input" type="date" max={today()} value={form.endDate} onChange={(event) => set("endDate", event.target.value)} disabled={busy} /></label>
          </div>

          <div className="receipt-field">What was spent *
            <div className="pd-lines">
              {lines.map((line, index) => (
                <div key={index} className="pd-line">
                  <select className="form-input" aria-label={`Expense ${index + 1} type`} value={line.category} onChange={(event) => setLine(index, { category: event.target.value })} disabled={busy}>
                    {PER_DIEM_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input className="form-input" type="date" aria-label={`Expense ${index + 1} date`} min={form.startDate} max={form.endDate} value={line.date} onChange={(event) => setLine(index, { date: event.target.value })} disabled={busy} />
                  <input className="form-input" aria-label={`Expense ${index + 1} details`} maxLength={200} placeholder="Details (optional)" value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} disabled={busy} />
                  <input className="form-input" type="number" inputMode="decimal" min="0" step="0.01" aria-label={`Expense ${index + 1} amount (KES)`} placeholder="KES" value={line.amount} onChange={(event) => setLine(index, { amount: event.target.value })} disabled={busy} />
                  <button type="button" className="btn sm ghost" aria-label={`Remove expense ${index + 1}`} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={busy || lines.length === 1}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <div className="pd-total">
              <button type="button" className="btn sm ghost" onClick={() => setLines((current) => [...current, newLine(current.at(-1)?.date || form.startDate)])} disabled={busy || lines.length >= 50}><Plus size={13} /> Add expense</button>
              <b>Total {kes(total)}</b>
            </div>
          </div>

          <div className="receipt-field">Receipts * <span className="faint">(photos or PDFs, up to {MAX_FILES}, 5 MB each)</span>
            <label className="pd-upload">
              <Paperclip size={14} /> {files.length ? "Add more receipts" : "Attach receipts"}
              <input type="file" accept={ACCEPT} multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} disabled={busy || files.length >= MAX_FILES} />
            </label>
            {files.length > 0 && (
              <ul className="pd-files">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}>
                    {file.type === "application/pdf" ? <FileText size={12} /> : <ImageIcon size={12} />} <span>{file.name}</span>
                    <button type="button" className="btn sm ghost" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} disabled={busy}><Trash2 size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="receipt-field">Note (optional)<input className="form-input" maxLength={500} value={form.notes} onChange={(event) => set("notes", event.target.value)} disabled={busy} /></label>

          {problem && <div role="alert" className="receipt-problem"><AlertTriangle size={13} /> {problem}</div>}
          <div className="receipt-actions">
            <button type="button" className="btn sm ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn amber sm" disabled={busy}>
              {busy ? <Loader2 size={13} className="spin" /> : <Wallet size={13} />} Submit claim · {kes(total)}
            </button>
          </div>
        </form>
      )}
    </FleetModal>
  );
}
