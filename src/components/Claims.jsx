import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, Image as ImageIcon, Loader2, Paperclip, Plus, Trash2, Wallet } from "lucide-react";
import { FleetModal } from "./FleetModal";
import { createClaim, getClaimDocument, getClaimOptions } from "../services/api";
import "../styles/driver.css";

// Claims: money spent for work, claimed with the receipts — trip per diem
// (meals, accommodation...), other costs and fuel. Go and spend, then claim:
// what was spent, line by line, with a photo or PDF of every receipt. Used
// on the Claims page and on a driver's My Vehicle page.

const CATEGORIES = [
  ["meals", "Meals"],
  ["accommodation", "Accommodation"],
  ["transport", "Transport"],
  ["fuel", "Fuel"],
  ["supplies", "Supplies"],
  ["other", "Other"],
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
const LINKS = [["plan", "Movement plan"], ["dispatch", "Dispatch"], ["other", "Something else"]];
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024;

const today = () => new Date().toISOString().slice(0, 10);
const kes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDay = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const newLine = (date = today()) => ({ category: "meals", date, description: "", amount: "" });

function linkLabel(claim) {
  if (claim.linkKind === "dispatch") return `Dispatch ${claim.waybillId}`;
  if (claim.linkKind === "fuel") return claim.planReference ? `Fuel · ${claim.planReference}` : "Fuel";
  if (claim.linkKind === "other") return claim.purpose || claim.description || "Other";
  return [claim.planReference, claim.tripId].filter(Boolean).join(" / ") || "Movement plan";
}

// Opens a receipt in a new tab (fetched with the session cookie).
async function openDocument(claimId, doc, setError) {
  const win = window.open("", "_blank");
  try {
    const blob = await getClaimDocument(claimId, doc.file);
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    win?.close();
    setError?.(err.message || "Couldn't open the receipt.");
  }
}

const STATUS = { submitted: ["Awaiting review", "collect"], approved: ["Approved", "done"], rejected: ["Rejected", "bad"], paid: ["Paid", "done"] };

// One claim: who, what for, the spending, receipts and status.
export function ClaimRow({ claim, showClaimant = true, actions = null }) {
  const [error, setError] = useState("");
  const [label, className] = STATUS[claim.status] || [claim.status, "collect"];
  const lines = claim.lines || [];
  const byCategory = lines.reduce((sum, line) => ({ ...sum, [line.category]: (sum[line.category] || 0) + line.amount }), {});
  const start = claim.startDate || claim.expenseDate;
  return (
    <div className="dv-row pd-row">
      <div>
        <strong>{showClaimant ? `${claim.claimantName} · ` : ""}{linkLabel(claim)} · {kes(claim.amount)}</strong>
        <span className="faint">
          {fmtDay(start)}{claim.endDate && fmtDay(claim.endDate) !== fmtDay(start) ? ` – ${fmtDay(claim.endDate)}` : ""}
          {claim.vehiclePlate ? ` · ${claim.vehiclePlate}` : ""}
          {claim.onBehalf ? ` · submitted by ${claim.submittedByName}` : ""}
          {claim.fuelLog ? " · from a fleet fuel log" : ""}
        </span>
        {claim.ratePerDay != null && !lines.length ? (
          <span className="faint">Fixed-rate per diem: {claim.eligibleDays} day{claim.eligibleDays === 1 ? "" : "s"} × {kes(claim.ratePerDay)}</span>
        ) : lines.length > 1 || (lines[0] && !claim.description) ? (
          <span className="faint">{Object.entries(byCategory).map(([category, amount]) => `${CATEGORY_LABEL[category] || category} ${kes(amount)}`).join(" · ")}</span>
        ) : claim.description ? (
          <span className="faint">{CATEGORY_LABEL[lines[0]?.category || claim.category] || claim.category} · {claim.description}</span>
        ) : null}
        {claim.receiptReference && <span className="faint">Receipt / reference: {claim.receiptReference}</span>}
        {claim.notes && <span className="faint">Note: {claim.notes}</span>}
        {claim.documents?.length > 0 && (
          <div className="pd-docs">
            {claim.documents.map((doc, i) => (
              <button key={String(doc.file)} type="button" className="pd-doc" onClick={() => openDocument(claim._id, doc, setError)}>
                {doc.contentType === "application/pdf" ? <FileText size={12} /> : <ImageIcon size={12} />} {doc.name || `Receipt ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        {claim.decisionComment && <span className={claim.status === "rejected" ? "dv-bad" : "faint"}>Review note: {claim.decisionComment}</span>}
        {error && <span className="dv-bad">{error}</span>}
      </div>
      <div className="pd-side">
        <span className={`driver-stage ${className}`}>{label}</span>
        {actions}
      </div>
    </div>
  );
}

// The claim form. Anyone with a staff account claims for themselves; some
// roles may also choose someone else (options.canClaimForOthers).
export function ClaimForm({ vehicles = [], onClose, onSaved }) {
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ personKey: "", linkKind: "plan", movementPlanId: "", tripId: "", dispatchId: "", purpose: "", vehicleId: "", startDate: today(), endDate: today(), notes: "" });
  const [lines, setLines] = useState([newLine()]);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    getClaimOptions()
      .then((result) => { setOptions(result); setForm((current) => ({ ...current, personKey: result.me?.key || "" })); })
      .catch((err) => setLoadError(err.message || "Couldn't load the claim options."));
  }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const people = options?.people || [];
  const person = people.find((p) => p.key === form.personKey) || options?.me || null;
  const isDriver = Boolean(person?.driverId);

  // Plans and trips this person is on; their dispatches.
  const plans = useMemo(() => (options?.plans || []).filter((plan) => !person
    || (person.userId && plan.userIds.includes(person.userId))
    || plan.trips.some((trip) => (person.userId && trip.userIds.includes(person.userId)) || (person.driverId && trip.driverIds.includes(person.driverId)))), [options, person]);
  const plan = plans.find((item) => String(item._id) === form.movementPlanId);
  const trips = (plan?.trips || []).filter((trip) => !person || (person.userId && (plan.userIds.includes(person.userId) || trip.userIds.includes(person.userId))) || (person.driverId && trip.driverIds.includes(person.driverId)));
  const dispatches = useMemo(() => (options?.dispatches || []).filter((d) => person?.driverId && (d.driverId === person.driverId
    || (!d.driverId && d.driverName?.trim().toLowerCase() === person.name.trim().toLowerCase()))), [options, person]);
  const links = LINKS.filter(([value]) => value !== "dispatch" || isDriver);

  const choosePerson = (key) => setForm((current) => ({ ...current, personKey: key, movementPlanId: "", tripId: "", dispatchId: "", linkKind: current.linkKind === "dispatch" ? "plan" : current.linkKind }));
  const choosePlan = (id) => setForm((current) => ({ ...current, movementPlanId: id, tripId: "" }));
  const chooseTrip = (tripId) => {
    const trip = trips.find((item) => item.tripId === tripId);
    setForm((current) => ({ ...current, tripId, ...(trip ? { startDate: trip.startDate, endDate: trip.endDate } : {}) }));
    if (trip) setLines((current) => current.map((line) => (line.amount === "" ? { ...line, date: trip.startDate } : line)));
  };
  const chooseDispatch = (id) => {
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
    if (!form.personKey) return setProblem("Choose who the claim is for.");
    if (form.linkKind === "plan" && !form.movementPlanId) return setProblem("Choose the movement plan.");
    if (form.linkKind === "dispatch" && !form.dispatchId) return setProblem("Choose the dispatch.");
    if (form.linkKind === "other" && form.purpose.trim().length < 3) return setProblem("Say what the money was spent for.");
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return setProblem("Check the dates: the end can't be before the start.");
    const bad = lines.findIndex((line) => !(Number(line.amount) > 0) || !line.date);
    if (bad >= 0) return setProblem(`Expense ${bad + 1}: enter the date and the amount spent.`);
    const outside = lines.findIndex((line) => line.date < form.startDate || line.date > form.endDate);
    if (outside >= 0) return setProblem(`Expense ${outside + 1} is dated outside ${form.startDate} to ${form.endDate}.`);
    if (!files.length) return setProblem("Attach the receipts: a photo or PDF of each one.");
    setBusy(true);
    setProblem("");
    try {
      const payload = {
        personKey: form.personKey === options?.me?.key ? "" : form.personKey,
        linkKind: form.linkKind,
        movementPlanId: form.linkKind === "plan" ? form.movementPlanId : null,
        tripId: form.linkKind === "plan" ? form.tripId : "",
        dispatchId: form.linkKind === "dispatch" ? form.dispatchId : null,
        purpose: form.linkKind === "other" ? form.purpose.trim() : "",
        vehicleId: form.linkKind === "other" ? form.vehicleId || null : null,
        startDate: form.startDate,
        endDate: form.endDate,
        lines: lines.map((line) => ({ category: line.category, date: line.date, description: line.description.trim(), amount: Number(line.amount) })),
        notes: form.notes.trim(),
      };
      onSaved(await createClaim(payload, files));
    } catch (err) {
      setProblem(err.message || "The claim didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FleetModal wide title="New claim"
      description="Enter what was spent, line by line, and attach a photo or PDF of every receipt. The CEO reviews it and marks it paid."
      onClose={() => { if (!busy) onClose(); }}>
      {loadError && <div role="alert" className="receipt-problem"><AlertTriangle size={13} /> {loadError}</div>}
      {!options && !loadError ? (
        <div className="faint"><Loader2 size={14} className="spin" /> Loading…</div>
      ) : options && !options.canClaim ? (
        <div className="faint">Your account can&apos;t submit claims.</div>
      ) : options && (
        <form className="driver-form dv-form" onSubmit={submit} noValidate>
          {options.canClaimForOthers && (
            <label className="receipt-field">Claim for *
              <select className="form-input" value={form.personKey} onChange={(event) => choosePerson(event.target.value)} disabled={busy}>
                <option value={options.me.key}>Myself ({options.me.name})</option>
                {people.filter((p) => p.key !== options.me.key).map((p) => (
                  <option key={p.key} value={p.key}>{p.name}{p.role === "driver" ? " · driver" : ""}{p.noAccount ? " (no account)" : ""}</option>
                ))}
              </select>
            </label>
          )}

          <div className="receipt-field">What was it for?
            <div className="driver-choice" role="radiogroup" aria-label="What was it for">
              {links.map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={form.linkKind === value} className={`driver-chip ${form.linkKind === value ? "on" : ""}`} onClick={() => set("linkKind", value)} disabled={busy}>{label}</button>
              ))}
            </div>
          </div>

          {form.linkKind === "plan" && (
            <div className="dv-grid">
              <label className="receipt-field">Movement plan *
                <select className="form-input" value={form.movementPlanId} onChange={(event) => choosePlan(event.target.value)} disabled={busy}>
                  <option value="">{plans.length ? "Choose the plan" : "No approved plans with this person on them"}</option>
                  {plans.map((item) => <option key={item._id} value={item._id}>{item.reference} · {item.title}</option>)}
                </select>
              </label>
              <label className="receipt-field">Trip (optional)
                <select className="form-input" value={form.tripId} onChange={(event) => chooseTrip(event.target.value)} disabled={busy || !plan}>
                  <option value="">{plan ? "Whole plan / not one trip" : "Choose the plan first"}</option>
                  {trips.map((trip) => (
                    <option key={trip.tripId} value={trip.tripId}>{trip.tripId} · {trip.originName} to {trip.destinationName} · {trip.startDate}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {form.linkKind === "dispatch" && (
            <label className="receipt-field">Dispatch *
              <select className="form-input" value={form.dispatchId} onChange={(event) => chooseDispatch(event.target.value)} disabled={busy}>
                <option value="">{dispatches.length ? "Choose the dispatch" : "No recent dispatches for this driver"}</option>
                {dispatches.map((dispatch) => (
                  <option key={dispatch._id} value={dispatch._id}>{dispatch.waybillId} · {dispatch.siteName}{dispatch.vehiclePlate ? ` · ${dispatch.vehiclePlate}` : ""} · {dispatch.startDate}</option>
                ))}
              </select>
            </label>
          )}
          {form.linkKind === "other" && (
            <div className="dv-grid">
              <label className="receipt-field">What was it for? *
                <input className="form-input" maxLength={200} value={form.purpose} onChange={(event) => set("purpose", event.target.value)} placeholder="e.g. Site survey in Nakuru" disabled={busy} />
              </label>
              {vehicles.length > 0 && (
                <label className="receipt-field">Vehicle (optional)
                  <select className="form-input" value={form.vehicleId} onChange={(event) => set("vehicleId", event.target.value)} disabled={busy}>
                    <option value="">None</option>
                    {vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.plate}{vehicle.make ? ` · ${vehicle.make}` : ""}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          <div className="dv-grid">
            <label className="receipt-field">From *<input className="form-input" type="date" max={today()} value={form.startDate} onChange={(event) => set("startDate", event.target.value)} disabled={busy} /></label>
            <label className="receipt-field">To *<input className="form-input" type="date" max={today()} value={form.endDate} onChange={(event) => set("endDate", event.target.value)} disabled={busy} /></label>
          </div>

          <div className="receipt-field">What was spent *
            <div className="pd-lines">
              {lines.map((line, index) => (
                <div key={index} className="pd-line">
                  <select className="form-input" aria-label={`Expense ${index + 1} type`} value={line.category} onChange={(event) => setLine(index, { category: event.target.value })} disabled={busy}>
                    {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input className="form-input" type="date" aria-label={`Expense ${index + 1} date`} min={form.startDate} max={form.endDate} value={line.date} onChange={(event) => setLine(index, { date: event.target.value })} disabled={busy} />
                  <input className="form-input" aria-label={`Expense ${index + 1} details`} maxLength={200} placeholder="Details (optional)" value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} disabled={busy} />
                  <input className="form-input" type="number" inputMode="decimal" min="0" step="0.01" aria-label={`Expense ${index + 1} amount (KES)`} placeholder="KES" value={line.amount} onChange={(event) => setLine(index, { amount: event.target.value })} disabled={busy} />
                  <button type="button" className="btn sm ghost" aria-label={`Remove expense ${index + 1}`} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={busy || lines.length === 1}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            {lines.some((line) => line.category === "fuel") && (
              <span className="faint">Fuel for a fleet vehicle is claimed automatically when it&apos;s logged in Fleet or My Vehicle. Only claim fuel here if it wasn&apos;t logged there.</span>
            )}
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
