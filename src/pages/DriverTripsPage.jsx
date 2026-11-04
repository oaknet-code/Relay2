import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Navigation, Package, Phone, RefreshCw, Truck } from "lucide-react";
import { confirmDispatchPickup, getDispatches, markDispatchArrived, reportDispatchIncident } from "../services/api";
import { FleetModal } from "../components/FleetModal";
import { lineLabel, tripStage } from "../utils/dispatchLines";
import "../styles/custody.css";
import "../styles/driver.css";

// "My Trips" for a driver: the released dispatches assigned to them. Each
// trip moves through Collect (check the load, sign) → On the way (report a
// problem, mark arrival) → At site (the Site Engineer counts it and the
// driver signs the handover on the engineer's device) → Delivered.

const INCIDENT_TYPES = [
  ["breakdown", "Vehicle breakdown"],
  ["accident", "Accident"],
  ["road_block", "Road blocked"],
  ["delay", "Delay"],
  ["other", "Other problem"],
];
const INCIDENT_LABEL = Object.fromEntries(INCIDENT_TYPES);

const fmt = (value) => value
  ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  : "";

const STAGE = {
  collect: { label: "Collect from warehouse", className: "collect" },
  on_the_way: { label: "On the way", className: "moving" },
  at_site: { label: "At site · waiting for receipt", className: "site" },
  delivered: { label: "Delivered", className: "done" },
};

const fullName = (user) => `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

export function DriverTripsPage({ user }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [pickupFor, setPickupFor] = useState(null);
  const [problemFor, setProblemFor] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await getDispatches();
      setTrips(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load your trips.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (dispatch, action, success) => {
    setBusyId(dispatch._id);
    setError("");
    setNotice("");
    try {
      const result = await action();
      await load();
      setNotice([success, result?.notificationWarning].filter(Boolean).join(" "));
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "That didn't go through. Try again.");
      return false;
    } finally {
      setBusyId("");
    }
  };

  const active = trips.filter((trip) => tripStage(trip) !== "delivered");
  const delivered = trips.filter((trip) => tripStage(trip) === "delivered").slice(0, 10);

  return (
    <div className="driver-trips">
      <div className="view-head">
        <span className="tagchip"><Navigation size={11} /> Driver</span>
        <h2>My trips</h2>
        <p>Dispatches assigned to you. Confirm pickup before you leave the warehouse.</p>
      </div>

      <div className="driver-toolbar">
        <button type="button" className="btn sm ghost" onClick={() => { setLoading(true); load(); }} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {notice && <div className="driver-notice" role="status"><CheckCircle2 size={14} /> {notice}</div>}
      {error && <div className="driver-error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      {loading && trips.length === 0 ? (
        <div className="faint driver-empty"><Loader2 size={16} className="spin" /> Loading…</div>
      ) : active.length === 0 ? (
        <div className="panel driver-empty">
          <Truck size={22} />
          <div>No trips right now. You&apos;ll get a notification when a dispatch is released to you.</div>
        </div>
      ) : (
        active.map((trip) => (
          <TripCard
            key={trip._id}
            trip={trip}
            busy={busyId === trip._id}
            onPickup={() => setPickupFor(trip)}
            onProblem={() => setProblemFor(trip)}
            onArrived={() => run(trip, () => markDispatchArrived(trip._id), `${trip.waybillId}: arrival recorded. The Site Engineer has been told.`)}
          />
        ))
      )}

      {delivered.length > 0 && (
        <section className="driver-history">
          <h3>Delivered</h3>
          {delivered.map((trip) => (
            <div key={trip._id} className="driver-history-row">
              <strong>{trip.waybillId}</strong>
              <span>{trip.siteName}</span>
              <span className="faint">{fmt(trip.receipt?.receivedAt)}{trip.receipt?.receivedByName ? ` · received by ${trip.receipt.receivedByName}` : ""}</span>
            </div>
          ))}
        </section>
      )}

      {pickupFor && (
        <PickupModal
          trip={pickupFor}
          defaultName={fullName(user)}
          busy={busyId === pickupFor._id}
          onClose={() => setPickupFor(null)}
          onSubmit={async (body) => {
            const ok = await run(pickupFor, () => confirmDispatchPickup(pickupFor._id, body), `${pickupFor.waybillId} collected. Safe trip!`);
            if (ok) setPickupFor(null);
          }}
        />
      )}
      {problemFor && (
        <ProblemModal
          trip={problemFor}
          busy={busyId === problemFor._id}
          onClose={() => setProblemFor(null)}
          onSubmit={async (body) => {
            const ok = await run(problemFor, () => reportDispatchIncident(problemFor._id, body), "Problem reported. The Project Manager and super admin have been alerted.");
            if (ok) setProblemFor(null);
          }}
        />
      )}
    </div>
  );
}

function TripCard({ trip, busy, onPickup, onProblem, onArrived }) {
  const stage = tripStage(trip);
  const info = STAGE[stage];
  const incidents = trip.trip?.incidents || [];
  return (
    <article className="panel driver-trip">
      <header className="driver-trip-head">
        <div>
          <div className="driver-trip-id">{trip.waybillId}</div>
          <div className="driver-trip-to"><MapPin size={13} /> {[trip.siteId, trip.siteName].filter(Boolean).join(" · ")}</div>
        </div>
        <span className={`driver-stage ${info.className}`}>{info.label}</span>
      </header>

      <div className="driver-trip-meta">
        {trip.vehicle?.plate && <span><Truck size={12} /> {trip.vehicle.plate}{trip.vehicle.make ? ` · ${trip.vehicle.make}` : ""}</span>}
        {trip.linkId && <span>Link {trip.linkId}</span>}
        {trip.trip?.pickedUpAt && <span>Collected {fmt(trip.trip.pickedUpAt)}</span>}
        {trip.trip?.arrivedAt && <span>Arrived {fmt(trip.trip.arrivedAt)}</span>}
      </div>

      <details className="driver-load" open={stage === "collect"}>
        <summary><Package size={13} /> Load · {trip.items.length} line{trip.items.length === 1 ? "" : "s"}</summary>
        <ul>
          {trip.items.map((line) => (
            <li key={String(line.componentId)}>
              <span>{lineLabel(line)}</span>
              <strong>{line.qty}{line.unit && line.unit !== "ea" ? ` ${line.unit}` : ""}</strong>
            </li>
          ))}
        </ul>
      </details>

      {incidents.length > 0 && (
        <ul className="driver-incidents">
          {incidents.map((incident) => (
            <li key={incident._id || incident.at}><AlertTriangle size={12} /> {fmt(incident.at)} · {INCIDENT_LABEL[incident.type] || incident.type}: {incident.note}</li>
          ))}
        </ul>
      )}

      <div className="driver-actions">
        {stage === "collect" && (
          <button type="button" className="btn amber driver-big" onClick={onPickup} disabled={busy}>
            <Package size={16} /> I&apos;ve checked and collected the load
          </button>
        )}
        {stage === "on_the_way" && (
          <button type="button" className="btn amber driver-big" onClick={onArrived} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <MapPin size={16} />} I&apos;ve arrived at site
          </button>
        )}
        {stage === "at_site" && (
          <div className="driver-wait">Hand over to the Site Engineer. They count the load and you sign on their screen.</div>
        )}
        {(stage === "on_the_way" || stage === "at_site") && (
          <button type="button" className="btn driver-big ghost" onClick={onProblem} disabled={busy}>
            <AlertTriangle size={16} /> Report a problem
          </button>
        )}
      </div>
    </article>
  );
}

function PickupModal({ trip, defaultName, busy, onClose, onSubmit }) {
  const [checked, setChecked] = useState(false);
  const [signature, setSignature] = useState(defaultName);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (!checked) { setProblem("Tick the box once you've checked the load against the list."); return; }
    if (signature.trim().length < 2) { setProblem("Type your full name to sign."); return; }
    onSubmit({ signature: signature.trim(), note: note.trim() });
  };
  return (
    <FleetModal title={`Collect ${trip.waybillId}`} description={`For ${trip.siteName}. Check every line before you sign.`} onClose={() => { if (!busy) onClose(); }}>
      <form className="driver-form" onSubmit={submit} noValidate>
        <ul className="driver-checklist">
          {trip.items.map((line) => (
            <li key={String(line.componentId)}>
              <span>{lineLabel(line)}</span>
              <strong>{line.qty}{line.unit && line.unit !== "ea" ? ` ${line.unit}` : ""}</strong>
            </li>
          ))}
        </ul>
        <label className="driver-check">
          <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} disabled={busy} />
          Everything on this list is on the vehicle
        </label>
        <label className="receipt-field">
          Note (optional) — e.g. something missing or packed differently
          <input className="form-input" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} />
        </label>
        <label className="receipt-field">
          Your full name (signature) *
          <input className="form-input" maxLength={150} value={signature} autoComplete="name" onChange={(event) => setSignature(event.target.value)} disabled={busy} />
        </label>
        {problem && <div role="alert" className="receipt-problem"><AlertTriangle size={13} /> {problem}</div>}
        <div className="receipt-actions">
          <button type="button" className="btn sm ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn amber sm" disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} Confirm pickup
          </button>
        </div>
      </form>
    </FleetModal>
  );
}

function ProblemModal({ trip, busy, onClose, onSubmit }) {
  const [type, setType] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (!type) { setProblem("Choose what happened."); return; }
    if (note.trim().length < 3) { setProblem("Say briefly what happened and where."); return; }
    onSubmit({ type, note: note.trim() });
  };
  return (
    <FleetModal title={`Report a problem · ${trip.waybillId}`} description="The Project Manager and super admin are alerted straight away." onClose={() => { if (!busy) onClose(); }}>
      <form className="driver-form" onSubmit={submit} noValidate>
        <div className="driver-choice" role="radiogroup" aria-label="What happened">
          {INCIDENT_TYPES.map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={type === value}
              className={`driver-chip ${type === value ? "on" : ""}`} onClick={() => setType(value)} disabled={busy}>
              {label}
            </button>
          ))}
        </div>
        <label className="receipt-field">
          What happened and where? *
          <textarea className="form-input" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} />
        </label>
        {trip.driver?.phone && <div className="faint" style={{ fontSize: 11 }}><Phone size={11} /> They may call you on {trip.driver.phone}.</div>}
        {problem && <div role="alert" className="receipt-problem"><AlertTriangle size={13} /> {problem}</div>}
        <div className="receipt-actions">
          <button type="button" className="btn sm ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn amber sm" disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <AlertTriangle size={13} />} Send report
          </button>
        </div>
      </form>
    </FleetModal>
  );
}
