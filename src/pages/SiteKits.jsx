import React, { useEffect, useRef, useState } from 'react';
import {
  Package, Plus, Search, Filter, Eye, Wrench, Upload, Loader2,
  AlertTriangle, CheckCircle2, Trash2, Edit, X, ChevronDown, ChevronUp, Zap,
  ArrowLeft, Truck, PackageCheck, Undo2, ClipboardList
} from 'lucide-react';
import { Band, StatePill, Dot } from '../components/ui';
import { getSiteKits, createSiteKit, updateSiteKit, deleteSiteKit, importSiteKitsExcel, getLinks, sendKitToDispatch, setKitSite, reserveKitBoq, releaseKitBoq, getKitBoqShortages } from '../services/api';

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function fromApiKit(k) {
  return {
    id: k._id,
    kitId: k.kitId,
    name: k.name,
    band: k.band,
    status: k.status,
    linkId: k.link?._id,
    linkName: k.link?.linkId,
    siteRef: k.site?._id || null,
    siteLabel: k.site ? `${k.site.siteId} · ${k.site.name}` : null,
    components: (k.components || []).map(c => ({
      _id: c._id,
      type: c.type,
      model: c.model,
      description: c.description || "",
      qtyRequired: c.qtyRequired,
      qtyAvailable: c.qtyAvailable || 0,
      sourceType: c.sourceType || "consumable",
      // BOQ availability, worked out by the server (not edited here).
      boq: c.boq || null,
    })),
    boqSummary: k.boqSummary || null,
    lastUpdated: timeAgo(k.updatedAt || k.createdAt),
    createdAt: k.createdAt || new Date().toISOString().split("T")[0],
  };
}

const KIT_STATUS = {
  DRAFT: { label: "Draft", c: "var(--steel)" },
  READY_FOR_STAGING: { label: "Ready", c: "var(--teal)" },
  // Legacy: kits checked in to the (removed) Staging Bay — still sendable.
  STAGING: { label: "Ready", c: "var(--teal)" },
  STAGED: { label: "Sent to Dispatch", c: "var(--violet)" },
  DISPATCHED: { label: "Dispatched", c: "var(--amber)" },
  INSTALLED: { label: "Installed", c: "var(--teal)" }
};

// A kit line against the BOQ: reserved (green), in the BOQ but not yet
// reserved (blue), or more than the BOQ has left (red).
function lineState(comp) {
  if (comp.qtyAvailable >= comp.qtyRequired) return { c: "var(--teal)", label: "Reserved" };
  if (comp.boq && comp.boq.shortfall === 0) return { c: "var(--blue)", label: "In BOQ, not reserved" };
  return { c: "var(--red)", label: "Short in BOQ" };
}

// Short note on the BOQ position of a line not yet fully reserved.
function boqNote(comp) {
  const b = comp.boq;
  if (!b || comp.qtyAvailable >= comp.qtyRequired) return null;
  if (b.inBoq === 0) return "not in BOQ";
  if (b.shortfall > 0) return `short ${b.shortfall}`;
  return `${b.free} free`;
}

const LEGEND = [["var(--teal)", "Reserved"], ["var(--blue)", "In BOQ, not reserved"], ["var(--red)", "Short in BOQ"]];

function BoqLegend() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 10.5, color: "var(--faint)" }}>
      {LEGEND.map(([c, label]) => (
        <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Dot c={c} />{label}</span>
      ))}
    </div>
  );
}

// One-line kit summary, e.g. "40/52 reserved · 10 in stock · 2 short".
function BoqSummary({ summary }) {
  if (!summary || !summary.lines) return null;
  const parts = [
    <span key="r" style={{ color: summary.covered === summary.lines ? "var(--teal)" : undefined }}>{summary.covered}/{summary.lines} reserved</span>,
  ];
  if (summary.reservable) parts.push(<span key="s" style={{ color: "var(--blue)" }}>{summary.reservable} in stock</span>);
  if (summary.short) parts.push(<span key="x" style={{ color: "var(--red)" }}>{summary.short} short</span>);
  return (
    <span style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--muted)" }}>
      {parts.flatMap((p, i) => (i ? [<span key={`d${i}`}> · </span>, p] : [p]))}
    </span>
  );
}

// Detail-view line under a part: where its BOQ stock stands.
function BoqDetail({ comp }) {
  const b = comp.boq;
  const bits = [];
  if (b.mapped) bits.push(`BOQ as ${b.parts.join(" / ")}`);
  if (b.inBoq === 0) {
    bits.push("not in the BOQ");
  } else {
    bits.push(`BOQ ${b.inBoq}${b.spares ? ` (${b.main} main + ${b.spares} spares)` : ""}`);
    if (b.reservedByOthers) bits.push(`${b.reservedByOthers} held by other kits`);
    bits.push(`${b.free} free`);
  }
  if (b.reservedFromSpares) bits.push(`${b.reservedFromSpares} of this kit's from spares`);
  return (
    <span style={{ display: "block", fontSize: 10.5, marginTop: 2, fontFamily: "var(--mono)", color: "var(--faint)" }}>
      {bits.join(" · ")}
      {b.shortfall > 0 && <span style={{ color: "var(--red)" }}> · short {b.shortfall}</span>}
    </span>
  );
}

// Project-wide check of every part the kits use against the BOQ.
function BoqShortagesPanel({ data }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  const problems = [...data.shortages, ...data.notInBoq];
  const ok = problems.length === 0;
  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-h">
        <ClipboardList size={16} className="ph-ico" />
        <h3>BOQ check</h3>
        <span style={{ fontSize: 11.5, color: ok ? "var(--teal)" : "var(--red)", marginLeft: 8 }}>
          {data.covered} of {data.parts} kit parts covered{ok ? "" : ` · ${problems.length} short`}
        </span>
        {!ok && (
          <div className="ph-r">
            <button type="button" className="btn ghost sm" aria-expanded={open} onClick={() => setOpen(o => !o)}>
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {open ? "Hide" : "Show"} shortages
            </button>
          </div>
        )}
      </div>
      {open && !ok && (
        <div className="panel-b" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: "var(--faint)" }}>
            Total needed by all kits vs. the BOQ (main + spares). Reserving uses main stock first, then spares.
          </div>
          {problems.map(p => (
            <div key={p.model} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 11 }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontFamily: "var(--mono)" }}>{p.model}</span>
                {p.mapped && <span className="faint" style={{ fontFamily: "var(--mono)" }}> → {p.boqParts.join(" / ")}</span>}
                <span className="faint" style={{ display: "block", fontSize: 10.5, marginTop: 2 }}>
                  {p.description}{p.description ? " · " : ""}{p.kits.length} kit{p.kits.length === 1 ? "" : "s"}: {p.kits.map(k => k.replace(/^KIT-/, "")).join(", ")}
                </span>
              </div>
              <div style={{ fontFamily: "var(--mono)", textAlign: "right", flexShrink: 0 }}>
                <div style={{ color: "var(--red)" }}>{p.inBoq === 0 ? "not in BOQ" : `short ${p.short}`}</div>
                <div className="faint" style={{ fontSize: 10 }}>need {p.required} · BOQ {p.inBoq}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// `limit` shows only the first few lines (kit cards); the kit's detail view
// shows them all, with each part's description and BOQ breakdown.
function ComponentsTable({ components, limit, onShowAll }) {
  const shown = limit ? components.slice(0, limit) : components;
  const hidden = components.length - shown.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {shown.map((comp, i) => (
        <div key={i} style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "6px 0",
          fontSize: 11,
          borderBottom: i < shown.length - 1 || hidden > 0 ? "1px solid var(--line)" : "none"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span title={lineState(comp).label} style={{ display: "inline-flex" }}><Dot c={lineState(comp).c} /></span>
            <span style={{ fontFamily: "var(--mono)", flexShrink: 0 }}>{comp.type}</span>
            <span style={{ minWidth: 0 }}>
              {comp.model}
              {!limit && comp.description && (
                <span className="faint" style={{ display: "block", fontSize: 10.5, marginTop: 2 }}>{comp.description}</span>
              )}
              {!limit && comp.boq && <BoqDetail comp={comp} />}
            </span>
          </div>
          <div style={{ fontFamily: "var(--mono)", textAlign: "right", flexShrink: 0 }}>
            <div style={{ color: lineState(comp).c }}>{comp.qtyAvailable}/{comp.qtyRequired}</div>
            {boqNote(comp) && (
              <div style={{ fontSize: 10, color: comp.boq?.shortfall ? "var(--red)" : "var(--faint)" }}>{boqNote(comp)}</div>
            )}
          </div>
        </div>
      ))}
      {hidden > 0 && (
        <button type="button" className="site-open" style={{ fontSize: 11, alignSelf: "flex-start" }} onClick={onShowAll}>
          +{hidden} more part{hidden === 1 ? "" : "s"} — view all
        </button>
      )}
    </div>
  );
}

// Rendered inside the Sites page: `site` is the open site ({ _id, siteId,
// name }) or { unassigned: true } for kits not yet filed under a site.
// Without `site` it lists every kit, as before.
export function SiteKits({ canEdit = true, canReserve = canEdit, site = null, sites = [], showHeader = true, onKitsChanged }) {
  const inSite = !!site && !site.unassigned;
  const [view, setView] = useState("list"); // list, create, edit
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [kits, setKits] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKit, setEditingKit] = useState(null);
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef(null);

  const [viewingKit, setViewingKit] = useState(null);
  const [sendingToDispatch, setSendingToDispatch] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsSuccess, setDetailsSuccess] = useState("");
  const [boqBusy, setBoqBusy] = useState(null); // "reserve" | "release" | null
  const [shortages, setShortages] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    band: "",
    linkId: "",
    components: [{ type: "IDU", model: "", qtyRequired: 0, sourceType: "consumable" }],
  });

  const loadKits = async () => {
    setLoading(true);
    setError(null);
    try {
      const [kitsData, linksData] = await Promise.all([
        getSiteKits(),
        getLinks()
      ]);
      const normalizedKits = kitsData.map(fromApiKit);
      setKits(normalizedKits);
      setLinks(linksData);
      // The project-wide BOQ check only shows on the all-kits list.
      if (!site) getKitBoqShortages().then(setShortages).catch(() => setShortages(null));
    } catch (err) {
      setError("Failed to load kits");
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKits();
  }, []);

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const result = await importSiteKitsExcel(file);
      setImportMsg({ ok: true, text: result.message });
      await loadKits();
      onKitsChanged?.();
    } catch (err) {
      setImportMsg({ ok: false, text: err.response?.data?.message || "Import failed." });
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      band: "",
      linkId: "",
      components: [{ type: "IDU", model: "", qtyRequired: 0, sourceType: "consumable" }],
    });
    setEditingKit(null);
  };

  const startCreate = () => {
    setError("");
    setSuccess("");
    resetForm();
    setView("create");
  };

  const startEdit = (kit) => {
    setError("");
    setSuccess("");
    setEditingKit(kit);
    setFormData({
      name: kit.name,
      band: kit.band,
      linkId: kit.linkId || "",
      components: kit.components || [{ type: "IDU", model: "", qtyRequired: 0, sourceType: "consumable" }],
    });
    setView("edit");
  };

  const startView = (kit) => {
    setError("");
    setSuccess("");
    setDetailsError("");
    setDetailsSuccess("");
    setViewingKit(kit);
    setView("details");
  };

  const handleSendToDispatch = async (kit) => {
    setSendingToDispatch(true);
    setDetailsError("");
    setDetailsSuccess("");
    try {
      await sendKitToDispatch(kit.kitId);
      setDetailsSuccess("Kit sent to Dispatch.");
      setViewingKit(prev => (prev ? { ...prev, status: "STAGED" } : prev));
      await loadKits();
    } catch (err) {
      setDetailsError(err.response?.data?.message || "Failed to send kit to dispatch.");
    } finally {
      setSendingToDispatch(false);
    }
  };

  // Reserve (or release) BOQ stock for the whole kit. Other kits' "free"
  // numbers change too, so the list is reloaded.
  const handleBoq = async (kit, action) => {
    setBoqBusy(action);
    setDetailsError("");
    setDetailsSuccess("");
    try {
      const result = action === "reserve" ? await reserveKitBoq(kit.kitId) : await releaseKitBoq(kit.kitId);
      setViewingKit(fromApiKit(result.kit));
      setDetailsSuccess(result.message);
      await loadKits();
      onKitsChanged?.();
    } catch (err) {
      setDetailsError(err.response?.data?.message || `Failed to ${action} stock.`);
    } finally {
      setBoqBusy(null);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleComponentChange = (index, field, value) => {
    const newComponents = [...formData.components];
    newComponents[index] = {
      ...newComponents[index],
      [field]: (field === "type" || field === "model" || field === "sourceType") ? value : parseInt(value) || 0
    };
    setFormData(prev => ({
      ...prev,
      components: newComponents
    }));
  };

  const addComponent = () => {
    setFormData(prev => ({
      ...prev,
      components: [...prev.components, { type: "ODU", model: "", qtyRequired: 0, sourceType: "consumable" }]
    }));
  };

  const removeComponent = (index) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!formData.name || !formData.band || !formData.linkId) {
        setError("Kit name, band, and link are required");
        setIsSubmitting(false);
        return;
      }

      const kitPayload = {
        name: formData.name,
        band: formData.band,
        linkId: formData.linkId,
        ...(inSite && !editingKit ? { site: site._id } : {}),
        components: formData.components.map(c => ({
          _id: c._id,
          type: c.type,
          model: c.model,
          description: c.description,
          qtyRequired: c.qtyRequired,
          sourceType: c.sourceType,
        })),
      };

      if (editingKit) {
        await updateSiteKit(editingKit.kitId, kitPayload);
        setSuccess("Kit updated successfully!");
      } else {
        // Random, unguessable kit ID (was the last 6 digits of the clock).
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const bytes = crypto.getRandomValues(new Uint8Array(8));
        kitPayload.kitId = "KIT-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
        await createSiteKit(kitPayload);
        setSuccess("Kit created successfully!");
      }

      await loadKits();
      onKitsChanged?.();
      resetForm();
      setView("list");
    } catch (err) {
      const message = err.response?.data?.message || "Failed to save kit";
      setError(message);
      console.error("Submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKit = async (kit) => {
    if (!window.confirm(`Are you sure you want to delete kit "${kit.name}"? This cannot be undone.`)) {
      return;
    }

    setError(null);
    setSuccess("");
    try {
      await deleteSiteKit(kit.kitId);
      await loadKits();
      onKitsChanged?.();
      setSuccess(`Kit ${kit.kitId} deleted.`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete kit");
      console.error("Delete error:", err);
    }
  };

  const [movingSite, setMovingSite] = useState(false);
  const handleMoveKit = async (kit, newSiteRef) => {
    // A <select> changes on a stray scroll or arrow key, so confirm first.
    const label = (ref) => { const s = sites.find(x => x._id === ref); return s ? `${s.siteId} · ${s.name}` : "Unassigned"; };
    if (!window.confirm(`Move kit "${kit.name}" from ${label(kit.siteRef)} to ${label(newSiteRef)}?`)) return;
    setMovingSite(true);
    setDetailsError("");
    setDetailsSuccess("");
    try {
      await setKitSite(kit.kitId, newSiteRef || null);
      const target = sites.find(s => s._id === newSiteRef);
      setViewingKit(prev => (prev ? { ...prev, siteRef: newSiteRef || null } : prev));
      setDetailsSuccess(target ? `Kit moved to ${target.siteId} · ${target.name}.` : "Kit is now unassigned.");
      await loadKits();
      onKitsChanged?.();
    } catch (err) {
      setDetailsError(err.response?.data?.message || "Failed to move the kit.");
    } finally {
      setMovingSite(false);
    }
  };

  const filteredKits = kits.filter(kit => {
    const matchesSearch = (kit.siteLabel || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kit.kitId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kit.band.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || kit.status === filterStatus;
    const matchesSite = !site || (site.unassigned ? !kit.siteRef : kit.siteRef === site._id);
    return matchesSearch && matchesFilter && matchesSite;
  });

  // DETAILS VIEW
  if (view === "details" && viewingKit) {
    const isReadyForDispatch = ["READY_FOR_STAGING", "STAGING"].includes(viewingKit.status);
    const isSentToDispatch = ["STAGED", "DISPATCHED", "INSTALLED"].includes(viewingKit.status);

    return (
      <div className="view">
        <div className="view-head">
          <div className="tagchip">
            <Package size={11} />
            Kit Details
          </div>
          <h2>{viewingKit.name || viewingKit.kitId}</h2>
        </div>

        <div style={{ maxWidth: "700px" }}>
          {detailsError && (
            <div style={{
              marginBottom: 20,
              padding: "12px 14px",
              background: "rgba(255,90,90,.1)",
              border: "1px solid rgba(255,90,90,.25)",
              borderRadius: 10,
              color: "var(--red)",
              fontSize: 13,
              display: "flex",
              gap: 8,
              alignItems: "flex-start"
            }}>
              <AlertTriangle size={16} style={{ marginTop: 1 }} />
              <span>{detailsError}</span>
            </div>
          )}

          {detailsSuccess && (
            <div style={{
              marginBottom: 20,
              padding: "12px 14px",
              background: "rgba(51,220,174,.1)",
              border: "1px solid rgba(51,220,174,.25)",
              borderRadius: 10,
              color: "var(--teal)",
              fontSize: 13,
              display: "flex",
              gap: 8,
              alignItems: "center"
            }}>
              <CheckCircle2 size={16} />
              <span>{detailsSuccess}</span>
            </div>
          )}

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-h">
              <Package size={16} className="ph-ico" />
              <h3>Overview</h3>
              <div className="ph-r">
                <StatePill s={viewingKit.status} meta={KIT_STATUS} />
              </div>
            </div>
            <div className="panel-b">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--faint)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Band
                  </div>
                  <Band b={viewingKit.band} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--faint)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Link
                  </div>
                  <div style={{ fontSize: 12.5 }}>{viewingKit.linkName || "No link assigned"}</div>
                </div>
              </div>

              {sites.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "var(--faint)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Site
                  </div>
                  {canEdit ? (
                    <select
                      className="form-input"
                      value={viewingKit.siteRef || ""}
                      disabled={movingSite}
                      onChange={(e) => handleMoveKit(viewingKit, e.target.value)}
                      aria-label="Site this kit belongs to"
                    >
                      <option value="">Unassigned</option>
                      {sites.map(s => (
                        <option key={s._id} value={s._id}>{s.siteId} · {s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ fontSize: 12.5 }}>
                      {(() => { const s = sites.find(x => x._id === viewingKit.siteRef); return s ? `${s.siteId} · ${s.name}` : "Unassigned"; })()}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Kit Components
                  </div>
                  <BoqSummary summary={viewingKit.boqSummary} />
                </div>
                {canReserve && !isSentToDispatch && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <button
                      className="btn amber sm"
                      disabled={!!boqBusy || !viewingKit.boqSummary?.reservable}
                      title={viewingKit.boqSummary?.reservable ? "Hold free BOQ stock for every part this kit still needs" : "Nothing in the BOQ left to reserve for this kit"}
                      onClick={() => handleBoq(viewingKit, "reserve")}
                    >
                      {boqBusy === "reserve" ? <Loader2 size={14} className="spin" /> : <PackageCheck size={14} />}
                      {boqBusy === "reserve" ? "Reserving…" : "Reserve BOQ stock"}
                    </button>
                    {viewingKit.components.some(c => c.boq?.reserved > 0) && (
                      <button
                        className="btn ghost sm"
                        disabled={!!boqBusy}
                        onClick={() => {
                          if (window.confirm(`Release all BOQ stock held for ${viewingKit.kitId}? Other kits can then take it.`)) handleBoq(viewingKit, "release");
                        }}
                      >
                        {boqBusy === "release" ? <Loader2 size={14} className="spin" /> : <Undo2 size={14} />}
                        {boqBusy === "release" ? "Releasing…" : "Release"}
                      </button>
                    )}
                  </div>
                )}
                <div style={{ marginBottom: 8 }}><BoqLegend /></div>
                <ComponentsTable components={viewingKit.components} />
              </div>

              {isReadyForDispatch && (
                <div style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(51,220,174,.06)",
                  border: "1px solid rgba(51,220,174,.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12
                }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--teal)" }}>
                      Ready for Dispatch
                    </div>
                    <div style={{ fontSize: 11, color: "var(--faint)" }}>
                      {viewingKit.boqSummary && viewingKit.boqSummary.covered < viewingKit.boqSummary.lines
                        ? `${viewingKit.boqSummary.lines - viewingKit.boqSummary.covered} of ${viewingKit.boqSummary.lines} part lines aren't reserved yet.`
                        : "All components are reserved — this kit is ready to send to Dispatch."}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      className="btn sm"
                      style={{ background: "var(--teal)", color: "#06111f", whiteSpace: "nowrap" }}
                      disabled={sendingToDispatch}
                      onClick={() => handleSendToDispatch(viewingKit)}
                    >
                      {sendingToDispatch ? <Loader2 size={14} className="spin" /> : <Truck size={14} />}
                      {sendingToDispatch ? "Sending…" : "Send to Dispatch"}
                    </button>
                  )}
                </div>
              )}

              {viewingKit.status === "DRAFT" && (
                <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
                  This kit is still in draft — every component needs enough stock allocated before it becomes eligible for dispatch.
                </div>
              )}

              {isSentToDispatch && (
                <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
                  This kit has already been sent to Dispatch — check the Dispatch screen for next steps.
                </div>
              )}
            </div>
          </div>

          <button
            className="btn ghost"
            onClick={() => { setView("list"); setViewingKit(null); }}
          >
            <ArrowLeft size={14} />
            Back to Kits
          </button>
        </div>
      </div>
    );
  }

  // CREATE/EDIT VIEW
  if (view === "create" || view === "edit") {
    return (
      <div className="view">
        <div className="view-head">
          <button
            className="btn sm"
            onClick={() => { resetForm(); setView("list"); }}
            style={{ marginBottom: 12 }}
          >
            <ArrowLeft size={13} />
            Back to Site Kits
          </button>
          <div className="tagchip">
            <Package size={11} />
            {editingKit ? "Edit Kit" : "New Kit"}
          </div>
          <h2>{editingKit ? "Edit Site Kit" : "Create New Site Kit"}</h2>
          <p>
            {editingKit
              ? "Update kit details and components"
              : "Create a new pre-configured equipment bundle for microwave link installations"}
          </p>
        </div>

        <div style={{ maxWidth: "700px" }}>
          {error && (
            <div style={{
              marginBottom: 20,
              padding: "12px 14px",
              background: "rgba(255,90,90,.1)",
              border: "1px solid rgba(255,90,90,.25)",
              borderRadius: 10,
              color: "var(--red)",
              fontSize: 13,
              display: "flex",
              gap: 8,
              alignItems: "flex-start"
            }}>
              <AlertTriangle size={16} style={{ marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              marginBottom: 20,
              padding: "12px 14px",
              background: "rgba(51,220,174,.1)",
              border: "1px solid rgba(51,220,174,.25)",
              borderRadius: 10,
              color: "var(--teal)",
              fontSize: 13,
              display: "flex",
              gap: 8,
              alignItems: "center"
            }}>
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                Kit Name *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Standard 4GHz Kit"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                  Band *
                </label>
                <select
                  className="form-input"
                  value={formData.band}
                  onChange={(e) => handleFormChange("band", e.target.value)}
                  required
                >
                  <option value="">— Select Band —</option>
                  <option value="4 GHz">4 GHz</option>
                  <option value="6 GHz">6 GHz</option>
                  <option value="8 GHz">8 GHz</option>
                  <option value="11 GHz">11 GHz</option>
                  <option value="13 GHz">13 GHz</option>
                  <option value="15 GHz">15 GHz</option>
                  <option value="18 GHz">18 GHz</option>
                  <option value="23 GHz">23 GHz</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                  Link *
                </label>
                <select
                  className="form-input"
                  value={formData.linkId}
                  onChange={(e) => handleFormChange("linkId", e.target.value)}
                  required
                >
                  <option value="">— Select Link —</option>
                  {links
                    .filter(l => !editingKit || l._id === editingKit.linkId || l.status === "PLANNED")
                    .map(l => (
                      <option key={l._id} value={l._id}>
                        {l.linkId} {l.status === "KIT_ASSIGNED" && editingKit?.linkId !== l._id ? "(has kit)" : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12
              }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)" }}>
                  Kit Components
                </label>
                <button
                  type="button"
                  onClick={addComponent}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--line2)",
                    color: "var(--teal)",
                    padding: "4px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    display: "flex",
                    gap: 4,
                    alignItems: "center"
                  }}
                >
                  <Plus size={14} />
                  Add Component
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {formData.components.map((comp, idx) => (
                  <div key={idx} className="kit-comp-row" style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr 100px 80px 40px",
                    gap: 8,
                    alignItems: "flex-end",
                    padding: 12,
                    background: "var(--bg)",
                    border: "1px solid var(--line)",
                    borderRadius: 8
                  }}>
                    <select
                      className="form-input"
                      value={comp.type}
                      onChange={(e) => handleComponentChange(idx, "type", e.target.value)}
                      style={{ fontSize: 12 }}
                    >
                      <option value="IDU">IDU</option>
                      <option value="ODU">ODU</option>
                      <option value="DISH">DISH</option>
                      <option value="OTHER">Other</option>
                    </select>

                    <input
                      type="text"
                      className="form-input"
                      placeholder="Model"
                      value={comp.model}
                      onChange={(e) => handleComponentChange(idx, "model", e.target.value)}
                      style={{ fontSize: 12 }}
                    />

                    <select
                      className="form-input"
                      value={comp.sourceType}
                      onChange={(e) => handleComponentChange(idx, "sourceType", e.target.value)}
                      style={{ fontSize: 12 }}
                    >
                      <option value="serialized">Serialized</option>
                      <option value="consumable">Consumable</option>
                    </select>

                    <input
                      type="number"
                      className="form-input"
                      placeholder="Qty Req'd"
                      min="0"
                      value={comp.qtyRequired}
                      onChange={(e) => handleComponentChange(idx, "qtyRequired", e.target.value)}
                      style={{ fontSize: 12 }}
                    />

                    <button
                      type="button"
                      onClick={() => removeComponent(idx)}
                      disabled={formData.components.length === 1}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--red)",
                        cursor: formData.components.length === 1 ? "not-allowed" : "pointer",
                        opacity: formData.components.length === 1 ? 0.5 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 6
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: isSubmitting ? "var(--muted)" : "linear-gradient(to right, var(--amber), var(--amber2))",
                  color: "#114e9e",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  transition: "all 130ms"
                }}
              >
                {isSubmitting ? "Saving..." : editingKit ? "Update Kit" : "Create Kit"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setView("list");
                }}
                style={{
                  padding: "10px 16px",
                  background: "var(--panel2)",
                  color: "var(--muted)",
                  border: "1px solid var(--line2)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 130ms"
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="view">
      {!site && showHeader && (
      <div className="view-head">
        <div className="tagchip">
          <Package size={11} />
          Kit Management
        </div>
        <h2>Site Kits</h2>
        <p>
          Pre-configured equipment bundles for microwave link installations. Each kit contains
          all required components (IDU, ODU, dishes) plus consumables for a complete site deployment.
        </p>
      </div>
      )}

      <div style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 250 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
          <input
            type="text"
            placeholder="Search kits by ID, name, or band..."
            className="form-input"
            style={{ paddingLeft: 40 }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="form-input"
          style={{ width: 160 }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="ready">Ready</option>
          <option value="incomplete">Incomplete</option>
          <option value="pending">Pending Parts</option>
          <option value="dispatched">Dispatched</option>
        </select>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={handleFileChosen}
            />
            {!inSite && (
            <button
              className="btn ghost"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
              {importing ? "Importing…" : "Import Excel"}
            </button>
            )}
            <button className="btn amber" onClick={startCreate}>
              <Plus size={16} />
              New Kit
            </button>
          </>
        )}
      </div>

      {importMsg && (
        <div style={{
          marginBottom: 20,
          padding: "10px 14px",
          borderRadius: 10,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: importMsg.ok ? "rgba(51,220,174,.06)" : "rgba(255,90,90,.06)",
          border: `1px solid ${importMsg.ok ? "rgba(51,220,174,.25)" : "rgba(255,90,90,.25)"}`,
          color: importMsg.ok ? "var(--teal)" : "var(--red)",
        }}>
          {importMsg.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {importMsg.text}
        </div>
      )}

      {success && (
        <div style={{
          marginBottom: 20,
          padding: "10px 14px",
          borderRadius: 10,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(51,220,174,.06)",
          border: "1px solid rgba(51,220,174,.25)",
          color: "var(--teal)",
        }}>
          <CheckCircle2 size={14} />
          {success}
        </div>
      )}

      {!site && !loading && <BoqShortagesPanel data={shortages} />}

      {/* Errors from actions on the list (e.g. a delete the server refused). */}
      {!loading && error && kits.length > 0 && (
        <div role="alert" style={{
          marginBottom: 20,
          padding: "10px 14px",
          borderRadius: 10,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,90,90,.06)",
          border: "1px solid rgba(255,90,90,.25)",
          color: "var(--red)",
        }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--faint)" }}>
          <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 12 }}>Loading site kits…</div>
        </div>
      )}

      {!loading && error && !kits.length && (
        <div style={{
          textAlign: "center", padding: 40, color: "var(--red)",
          background: "rgba(255,90,90,.05)", border: "1px solid rgba(255,90,90,.25)", borderRadius: 14
        }}>
          <AlertTriangle size={24} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 13, marginBottom: 10 }}>{error}</div>
          <button className="btn sm" onClick={loadKits}>Retry</button>
        </div>
      )}

      {!loading && (
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        {filteredKits.map(kit => (
          <div key={kit.id} className="panel">
            <div className="panel-h">
              <Package size={16} className="ph-ico" />
              {/* Titled by kit name, e.g. "ACADEMY – LAMU-001". */}
              <h3>{kit.name || kit.kitId}</h3>
              <div className="ph-r">
                <StatePill s={kit.status} meta={KIT_STATUS} />
              </div>
            </div>
            <div className="panel-b">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Band b={kit.band} />
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {kit.linkName || "No link assigned"}
                </div>
                {!site && (
                  <div style={{ fontSize: 11, marginLeft: "auto", color: kit.siteLabel ? "var(--teal)" : "var(--amber)" }}>
                    {kit.siteLabel ? `Site ${kit.siteLabel}` : "Unassigned"}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Kit Components
                  </div>
                  <BoqSummary summary={kit.boqSummary} />
                </div>
                <ComponentsTable components={kit.components} limit={6} onShowAll={() => startView(kit)} />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 10, color: "var(--faint)" }}>
                  Updated {kit.lastUpdated}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn ghost sm"
                    onClick={() => startView(kit)}
                  >
                    <Eye size={14} />
                    View
                  </button>
                  {canEdit && (
                    <>
                      <button
                        className="btn sm"
                        onClick={() => startEdit(kit)}
                        style={{ color: "#06111f" }}
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      <button
                        className="btn sm"
                        onClick={() => handleDeleteKit(kit)}
                        style={{ background: "rgba(255,95,95,.15)", color: "var(--red)" }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {!loading && filteredKits.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: 60,
          color: "var(--faint)",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 14
        }}>
          <Package size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
          <div style={{ fontSize: 14, marginBottom: 4 }}>No kits found</div>
          <div style={{ fontSize: 12 }}>
            {site && !searchTerm && filterStatus === "all"
              ? (site.unassigned ? "Every kit is filed under a site." : "No kits at this site yet — add one with New Kit.")
              : kits.length === 0
              ? "Create your first kit or import an Excel sheet to load site kits."
              : (searchTerm || filterStatus !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Create your first site kit to get started")
            }
          </div>
        </div>
      )}
    </div>
  );
}
