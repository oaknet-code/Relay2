import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, History, Image as ImageIcon, Loader2, Paperclip, Pencil, Plus, RefreshCw, Search, Trash2, Truck, User } from "lucide-react";
import { FleetModal } from "./FleetModal";
import { createFleetDocument, deleteFleetDocument, getFleetDocumentFile, getFleetDocuments, updateFleetDocument } from "../services/api";
import "../styles/driver.css";

// Fleet → Documents: each vehicle's and driver's papers (insurance,
// inspection, driving licence...), with expiry status and what's
// missing. Super admins and the CEO add, update, renew and delete; admins
// view. Expiry alerts are sent automatically (30, 14, 7, 1 day before, on
// the day, then weekly), and a weekly summary lists missing required ones.
// Logbooks and ID / passport copies are deliberately not kept (fraud risk).

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;
const fmtDay = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const ymd = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const STATUS = {
  valid: ["Valid", "done"],
  expiring: ["Expiring", "collect"],
  expired: ["Expired", "bad"],
  no_expiry: ["On file", "done"],
};

function statusText(doc) {
  if (doc.status === "expired") return `Expired ${fmtDay(doc.expiresOn)} (${-doc.daysLeft} day${doc.daysLeft === -1 ? "" : "s"} ago)`;
  if (doc.status === "expiring") return doc.daysLeft === 0 ? "Expires today" : `Expires in ${doc.daysLeft} day${doc.daysLeft === 1 ? "" : "s"} · ${fmtDay(doc.expiresOn)}`;
  if (doc.status === "valid") return `Valid until ${fmtDay(doc.expiresOn)}`;
  return "No expiry";
}

async function openCopy(id, version, setError) {
  const win = window.open("", "_blank");
  try {
    const url = URL.createObjectURL(await getFleetDocumentFile(id, version));
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    win?.close();
    setError(err.message);
  }
}

export function FleetDocuments({ canEdit = false, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState("vehicle"); // vehicle | driver
  const [filter, setFilter] = useState("attention"); // attention | expired | expiring | missing | all
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(""); // the vehicle/driver whose documents are open
  const [modal, setModal] = useState(null); // { mode: "add"|"edit"|"renew", ownerKind, owner, doc? }

  const load = useCallback(async () => {
    try {
      setData(await getFleetDocuments());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saved = async (message) => {
    setModal(null);
    setNotice(message);
    await load();
    onChanged?.();
  };

  const remove = async (doc, owner) => {
    if (!window.confirm(`Delete the ${doc.label.toLowerCase()} for ${owner.plate || owner.name}, with its copies? This can't be undone.`)) return;
    try {
      await deleteFleetDocument(doc._id);
      await saved(`${doc.label} deleted.`);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading && !data) return <div className="fleet-operation-empty"><Loader2 size={18} className="spin" /> Loading documents…</div>;
  if (error && !data) return <div className="fleet-operation-notice error" role="alert"><AlertTriangle size={14} /> {error} <button className="btn sm ghost" onClick={load}>Retry</button></div>;

  const { summary } = data;
  const owners = kind === "vehicle" ? data.vehicles : data.drivers;
  const hasIssue = (owner) => owner.expired > 0 || owner.expiring > 0 || owner.missing.length > 0;
  const matches = (owner) => {
    if (filter === "expired" && !owner.expired) return false;
    if (filter === "expiring" && !owner.expiring) return false;
    if (filter === "missing" && !owner.missing.length) return false;
    if (filter === "attention" && !hasIssue(owner)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [owner.plate, owner.make, owner.name, owner.phone, ...owner.documents.map((doc) => `${doc.label} ${doc.number}`)]
      .filter(Boolean).some((text) => String(text).toLowerCase().includes(q));
  };
  // Most urgent first: expired, then soonest expiry, then missing, then A–Z.
  const urgency = (owner) => {
    const soonest = (status) => Math.min(...owner.documents.filter((d) => d.status === status).map((d) => d.daysLeft));
    if (owner.expired) return [0, soonest("expired")];
    if (owner.expiring) return [1, soonest("expiring")];
    if (owner.missing.length) return [2, 0];
    return [3, 0];
  };
  const shown = owners.filter(matches).sort((a, b) => {
    const [ua, da] = urgency(a);
    const [ub, db] = urgency(b);
    return ua - ub || da - db || String(a.plate || a.name).localeCompare(String(b.plate || b.name));
  });
  const types = data.types[kind];
  const pillTypes = (owner) => types.filter((t) => t.type !== "other" && (t.required || owner.documents.some((d) => d.type === t.type)));
  const shortLabel = (label) => label.replace(/ \(.*\)$/, "").replace(/ certificate$/i, "").replace(/^Certificate of /, "");
  const actions = (owner) => ({
    onAdd: (type) => { setNotice(""); setModal({ mode: "add", ownerKind: kind, owner, type }); },
    onEdit: (doc) => { setNotice(""); setModal({ mode: "edit", ownerKind: kind, owner, doc }); },
    onRenew: (doc) => { setNotice(""); setModal({ mode: "renew", ownerKind: kind, owner, doc }); },
    onDelete: (doc) => remove(doc, owner),
  });
  const pickFilter = (value) => { setFilter(value); setOpenId(""); };

  return (
    <section className="panel fleet-operations">
      <div className="panel-h">
        <FileText size={15} className="ph-ico" />
        <h3>Vehicle &amp; driver documents</h3>
        <button className="btn sm ghost ph-r" type="button" onClick={() => { setLoading(true); load(); }} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>
      <div className="panel-b fd-body">
        <div className="fd-summary">
          {[["expired", "expired", summary.expired, "bad"], ["expiring", "expiring in 30 days", summary.expiring, "warn"], ["missing", "required, missing", summary.missing, "warn"]].map(([value, label, count, tone]) => (
            <button key={value} type="button" className={`${count ? tone : ""} ${filter === value ? "on" : ""}`} aria-pressed={filter === value}
              onClick={() => pickFilter(filter === value ? "attention" : value)}>
              <b>{count}</b><span>{label}</span>
            </button>
          ))}
        </div>

        {notice && <div className="fleet-operation-notice" role="status"><CheckCircle2 size={14} /> {notice}</div>}
        {error && <div className="fleet-operation-notice error" role="alert"><AlertTriangle size={14} /> {error}</div>}

        <div className="fd-toolbar">
          <div className="fd-kinds" role="tablist" aria-label="Documents for">
            {[["vehicle", "Vehicles", Truck, data.vehicles], ["driver", "Drivers", User, data.drivers]].map(([value, label, Icon, list]) => {
              const issues = list.filter(hasIssue).length;
              return (
                <button key={value} type="button" role="tab" aria-selected={kind === value} className={`dv-tab ${kind === value ? "on" : ""}`}
                  onClick={() => { setKind(value); setOpenId(""); }}>
                  <Icon size={13} /> {label} <span className="faint">{list.length}</span>
                  {issues > 0 && <span className="fd-badge">{issues}</span>}
                </button>
              );
            })}
          </div>
          <label className="fd-search">
            <Search size={13} />
            <input className="form-input" type="search" placeholder={kind === "vehicle" ? "Search plate or number" : "Search name or number"}
              value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search" />
          </label>
          <select className="form-input fd-filter" value={filter} onChange={(event) => pickFilter(event.target.value)} aria-label="Show">
            <option value="attention">Needs attention</option>
            <option value="expired">Expired</option>
            <option value="expiring">Expiring in 30 days</option>
            <option value="missing">Missing required</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="fd-list">
          {shown.length === 0 && (
            <div className="faint fd-empty">
              {search.trim() ? "Nothing matches your search." : filter === "attention" ? `All ${kind === "vehicle" ? "vehicles" : "drivers"} are up to date.` : "Nothing to show."}
            </div>
          )}
          {shown.map((owner) => {
            const open = openId === owner._id;
            const others = owner.documents.filter((d) => d.type === "other").length;
            return (
              <div key={owner._id} className={`fd-item ${open ? "open" : ""}`}>
                <button type="button" className="fd-row" aria-expanded={open} onClick={() => setOpenId(open ? "" : owner._id)}>
                  <span className="fd-name">
                    <b>{kind === "vehicle" ? owner.plate : owner.name}</b>
                    <small className="faint">{kind === "vehicle" ? owner.make : owner.status === "inactive" ? "inactive" : owner.phone || ""}</small>
                  </span>
                  <span className="fd-pills">
                    {pillTypes(owner).map((t) => {
                      const doc = owner.documents.find((d) => d.type === t.type);
                      const state = doc ? doc.status : "missing";
                      return <span key={t.type} className={`fd-pill ${state}`} title={doc ? statusText(doc) : "Not on file"}>{shortLabel(t.label)}</span>;
                    })}
                    {others > 0 && <span className="fd-pill no_expiry" title="Other documents">+{others}</span>}
                  </span>
                  <span className="fd-state">
                    {owner.expired > 0 ? <span className="driver-stage bad">{owner.expired} expired</span>
                      : owner.expiring > 0 ? <span className="driver-stage collect">{owner.expiring} expiring</span>
                        : owner.missing.length > 0 ? <span className="driver-stage collect">{owner.missing.length} missing</span>
                          : <span className="driver-stage done">Up to date</span>}
                    <ChevronDown size={14} className="fd-chevron" />
                  </span>
                </button>
                {open && <OwnerCard owner={owner} types={types} canEdit={canEdit} onError={setError} {...actions(owner)} />}
              </div>
            );
          })}
        </div>

        <p className="faint fd-foot">
          Reminders go to super admins, the CEO and the driver 30, 14, 7 and 1 day before a document expires, on the day, and weekly while it stays expired.
          {canEdit ? "" : " You can view; super admins and the CEO keep the documents up to date."}
        </p>
      </div>

      {modal && (
        <DocumentForm {...modal} types={data.types[modal.ownerKind]} onClose={() => setModal(null)} onSaved={saved} />
      )}
    </section>
  );
}

function OwnerCard({ owner, types, canEdit, onAdd, onEdit, onRenew, onDelete, onError }) {
  const [showHistory, setShowHistory] = useState({});
  return (
    <div className="fd-owner">
      {owner.documents.map((doc) => {
        const [label, className] = STATUS[doc.status] || STATUS.valid;
        return (
          <div key={doc._id} className="fd-doc">
            <div>
              <b>{doc.label}</b>
              <span className="faint">{[doc.number, doc.provider, doc.issuedOn ? `issued ${fmtDay(doc.issuedOn)}` : ""].filter(Boolean).join(" · ") || "No details"}</span>
              <span className={doc.status === "expired" ? "dv-bad" : doc.status === "expiring" ? "fd-warn" : "faint"}>{statusText(doc)}</span>
              {doc.notes && <span className="faint">Note: {doc.notes}</span>}
              <div className="pd-docs">
                {doc.file && (
                  <button type="button" className="pd-doc" onClick={() => openCopy(doc._id, undefined, onError)}>
                    {doc.file.contentType === "application/pdf" ? <FileText size={12} /> : <ImageIcon size={12} />} {doc.file.name}
                  </button>
                )}
                {!doc.file && <span className="faint" style={{ fontSize: 11.5 }}>No copy attached</span>}
                {doc.history?.length > 0 && (
                  <button type="button" className="pd-doc" onClick={() => setShowHistory((current) => ({ ...current, [doc._id]: !current[doc._id] }))}>
                    <History size={12} /> {doc.history.length} earlier
                  </button>
                )}
              </div>
              {showHistory[doc._id] && (
                <ul className="fd-history">
                  {doc.history.map((old, index) => (
                    <li key={index}>
                      {[old.number, old.expiresOn ? `expired ${fmtDay(old.expiresOn)}` : "", `replaced ${fmtDay(old.replacedAt)}${old.replacedByName ? ` by ${old.replacedByName}` : ""}`].filter(Boolean).join(" · ")}
                      {old.file && <button type="button" className="pd-doc" onClick={() => openCopy(doc._id, index, onError)}><FileText size={12} /> copy</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="pd-side">
              <span className={`driver-stage ${className}`}>{label}</span>
              {canEdit && (
                <div className="fleet-row-actions">
                  {doc.expiresOn && <button className="btn sm amber" type="button" onClick={() => onRenew(doc)} title="Renew"><RefreshCw size={12} /> Renew</button>}
                  <button className="btn sm ghost" type="button" aria-label={`Edit ${doc.label}`} title="Edit" onClick={() => onEdit(doc)}><Pencil size={12} /></button>
                  <button className="btn sm ghost" type="button" aria-label={`Delete ${doc.label}`} title="Delete" style={{ color: "var(--red)" }} onClick={() => onDelete(doc)}><Trash2 size={12} /></button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {owner.missing.map((item) => (
        <div key={item.type} className="fd-doc missing">
          <div><b>{item.label}</b><span className="fd-warn">Required, not on file</span></div>
          <div className="pd-side">
            <span className="driver-stage collect">Missing</span>
            {canEdit && <button className="btn sm amber" type="button" onClick={() => onAdd(item.type)}><Plus size={12} /> Add</button>}
          </div>
        </div>
      ))}
      {canEdit && (
        <button className="btn sm ghost" type="button" style={{ justifySelf: "start" }} onClick={() => onAdd(types.find((t) => !owner.documents.some((d) => d.type === t.type))?.type || "other")}>
          <Plus size={12} /> Add document
        </button>
      )}
    </div>
  );
}

function DocumentForm({ mode, ownerKind, owner, doc, type: initialType, types, onClose, onSaved }) {
  const renew = mode === "renew";
  const [form, setForm] = useState(() => ({
    type: doc?.type || initialType || types[0].type,
    title: doc?.title || "",
    number: renew ? "" : doc?.number || "",
    provider: doc?.provider || "",
    issuedOn: renew ? "" : ymd(doc?.issuedOn),
    expiresOn: renew ? "" : ymd(doc?.expiresOn),
    notes: renew ? "" : doc?.notes || "",
  }));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const info = types.find((t) => t.type === form.type) || {};
  const taken = new Set(owner.documents.map((d) => d.type));
  const ownerName = owner.plate || owner.name;

  const submit = async (event) => {
    event.preventDefault();
    if (form.type === "other" && !form.title.trim()) return setProblem("Give the document a name.");
    if (info.expires && !form.expiresOn) return setProblem("Enter the expiry date.");
    if (form.issuedOn && form.expiresOn && form.expiresOn < form.issuedOn) return setProblem("The expiry date can't be before the issue date.");
    if (renew && form.expiresOn === ymd(doc.expiresOn)) return setProblem("Enter the new expiry date.");
    if (file && file.size > MAX_BYTES) return setProblem("The copy is over 5 MB. Take the photo at a lower size or scan it to PDF.");
    setBusy(true);
    setProblem("");
    const fields = { title: form.title.trim(), number: form.number.trim(), provider: form.provider.trim(), issuedOn: form.issuedOn, expiresOn: form.expiresOn, notes: form.notes.trim() };
    try {
      if (mode === "add") await createFleetDocument({ ownerKind, ownerId: owner._id, type: form.type, ...fields }, file);
      else await updateFleetDocument(doc._id, { ...fields, renew }, file);
      onSaved(`${info.label === "Other" ? form.title.trim() : info.label} for ${ownerName} ${mode === "add" ? "added" : renew ? "renewed" : "updated"}.`);
    } catch (err) {
      setProblem(err.message);
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "add" ? `Add document · ${ownerName}` : `${renew ? "Renew" : "Edit"} ${doc.label} · ${ownerName}`;
  const description = renew
    ? "Enter the new document's details and attach the new copy. The current one is kept in the history."
    : mode === "add" ? "Enter the details and attach a photo or PDF of the document." : "Correct the details or replace the copy. To record a new document, use Renew instead.";

  return (
    <FleetModal title={title} description={description} onClose={() => { if (!busy) onClose(); }}>
      <form className="driver-form dv-form" onSubmit={submit} noValidate>
        {mode === "add" && (
          <label className="receipt-field">Document *
            <select className="form-input" value={form.type} onChange={set("type")} disabled={busy}>
              {types.map((t) => (
                <option key={t.type} value={t.type} disabled={t.type !== "other" && taken.has(t.type)}>
                  {t.label}{t.required ? " (required)" : ""}{t.type !== "other" && taken.has(t.type) ? " · already on file" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {form.type === "other" && (
          <label className="receipt-field">Name *<input className="form-input" maxLength={120} value={form.title} onChange={set("title")} placeholder="e.g. County parking permit" disabled={busy} /></label>
        )}
        <div className="dv-grid">
          <label className="receipt-field">{ownerKind === "driver" ? "Number" : "Number / policy"}<input className="form-input" maxLength={80} value={form.number} onChange={set("number")} disabled={busy} /></label>
          <label className="receipt-field">{form.type === "insurance" ? "Insurer" : "Issued by"}<input className="form-input" maxLength={120} value={form.provider} onChange={set("provider")} disabled={busy} /></label>
          <label className="receipt-field">Issue date<input className="form-input" type="date" value={form.issuedOn} onChange={set("issuedOn")} disabled={busy} /></label>
          <label className="receipt-field">Expiry date{info.expires ? " *" : ""}<input className="form-input" type="date" value={form.expiresOn} onChange={set("expiresOn")} disabled={busy} /></label>
        </div>
        <div className="receipt-field">Copy (photo or PDF, up to 5 MB){renew ? " — the new document" : ""}
          <label className="pd-upload">
            <Paperclip size={14} /> {file ? file.name : doc?.file && !renew ? `Replace ${doc.file.name}` : "Attach a copy"}
            <input type="file" accept={ACCEPT} onChange={(event) => { setFile(event.target.files?.[0] || null); event.target.value = ""; }} disabled={busy} />
          </label>
        </div>
        <label className="receipt-field">Note (optional)<input className="form-input" maxLength={500} value={form.notes} onChange={set("notes")} disabled={busy} /></label>
        <div className="faint" style={{ fontSize: 11.5 }}>Don&apos;t upload logbooks, ID cards or passports: copies can be misused for fraud. Keep the originals in the office safe.</div>
        {problem && <div role="alert" className="receipt-problem"><AlertTriangle size={13} /> {problem}</div>}
        <div className="receipt-actions">
          <button type="button" className="btn sm ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn amber sm" disabled={busy}>
            {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} {mode === "add" ? "Add document" : renew ? "Save renewal" : "Save changes"}
          </button>
        </div>
      </form>
    </FleetModal>
  );
}
