import React, { useState, useEffect } from 'react';
import {
  Antenna, RadioTower, CheckCircle2, Circle, SatelliteDish, MapPin,
  Plus, AlertTriangle, Loader2, Pencil, Trash2
} from 'lucide-react';
import { TypeIcon, Band, Dot } from '../components/ui';
import { STATE_META, LINK_STATUS, BAND_COLORS } from '../constants/states';
import { getLinks, getAssets, createLink, updateLink, deleteLink } from '../services/api';

const BANDS = ["4 GHz", "6 GHz", "8 GHz", "11 GHz", "13 GHz", "15 GHz", "18 GHz", "23 GHz"];

const emptyForm = () => ({
  linkId: "",
  name: "",
  band: "",
  pathLengthKm: "",
  dishSize: "",
  siteA: { siteId: "", name: "", region: "" },
  siteB: { siteId: "", name: "", region: "" },
  notes: "",
});

// Prefill the form from an existing link. Keeps any GPS/address already on
// each end, since saving replaces the whole site object.
const formFromLink = (link) => {
  const site = (s) => ({
    ...(s?.lat != null ? { lat: s.lat } : {}),
    ...(s?.lng != null ? { lng: s.lng } : {}),
    ...(s?.address ? { address: s.address } : {}),
    siteId: s?.siteId || "",
    name: s?.name || "",
    region: s?.region || "",
  });
  return {
    linkId: link.linkId,
    name: link.name || "",
    band: link.band || "",
    pathLengthKm: link.pathLengthKm ?? "",
    dishSize: link.dishSize || "",
    siteA: site(link.siteA),
    siteB: site(link.siteB),
    notes: link.notes || "",
  };
};

export function LinksView({ canEdit = true }) {
  const [links, setLinks] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list, create, edit
  const [formData, setFormData] = useState(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [listError, setListError] = useState("");
  const [deleting, setDeleting] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [linksData, assetsData] = await Promise.all([
        getLinks(),
        getAssets()
      ]);
      setLinks(linksData);
      setAssets(assetsData);
    } catch (err) {
      console.error("Failed to load links/assets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const byLink = (linkId) => assets.filter(a => a.link && a.link._id === linkId);

  const endNode = (link, end) => {
    const site = end === "A" ? link.siteA : link.siteB;
    const us = byLink(link._id);
    const get = (t) => us.find(a => a.assetType === t);

    return (
      <div className="node">
        <div className="nn">{site?.name || "Unknown Site"}</div>
        <div className="nr">
          {site?.siteId || "—"} · {site?.region || "—"}
        </div>
        {["IDU", "ODU", "DISH"].map(t => {
          const u = get(t);
          const live = u && u.status === "INSTALLED";
          return (
            <div key={t} className={`row ${live ? "ok" : (u ? "" : "pend")}`}>
              <TypeIcon t={t} size={13} />
              <span style={{ minWidth: 30 }}>{t}</span>
              <span className="faint" style={{ flex: 1, color: u ? "inherit" : "var(--faint)" }}>
                {u ? u.serialNumber : "— not assigned —"}
              </span>
              {live ? <CheckCircle2 size={13} /> : (u ? <Dot c={(STATE_META[u.status?.toLowerCase?.()] || STATE_META.stocked).c} /> : <Circle size={11} />)}
            </div>
          );
        })}
      </div>
    );
  };

  const startCreate = () => {
    setError("");
    setSuccess("");
    setListError("");
    setFormData(emptyForm());
    setView("create");
  };

  const startEdit = (link) => {
    setError("");
    setSuccess("");
    setListError("");
    setFormData(formFromLink(link));
    setView("edit");
  };

  const removeLink = async (link) => {
    setSuccess("");
    setListError("");
    if (!window.confirm(`Delete link ${link.linkId}? This can't be undone.`)) return;
    setDeleting(link.linkId);
    try {
      await deleteLink(link.linkId);
      setSuccess(`Link ${link.linkId} deleted.`);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to delete link";
      setListError(
        err.response?.status === 409
          ? `${link.linkId} can't be deleted: ${msg}. Only links that are still Planned and have no site kit can be deleted.`
          : msg
      );
    } finally {
      setDeleting(null);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSiteChange = (end, field, value) => {
    setFormData(prev => ({
      ...prev,
      [end]: { ...prev[end], [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.linkId || !formData.band) {
      setError("Link ID and band are required");
      return;
    }

    const editing = view === "edit";
    setIsSubmitting(true);
    try {
      if (editing) {
        await updateLink(formData.linkId, {
          name: formData.name,
          band: formData.band,
          pathLengthKm: formData.pathLengthKm === "" ? null : Number(formData.pathLengthKm),
          dishSize: formData.dishSize,
          siteA: formData.siteA,
          siteB: formData.siteB,
          notes: formData.notes,
        });
      } else {
        await createLink({
          linkId: formData.linkId,
          name: formData.name || undefined,
          band: formData.band,
          pathLengthKm: formData.pathLengthKm ? Number(formData.pathLengthKm) : undefined,
          dishSize: formData.dishSize || undefined,
          siteA: formData.siteA,
          siteB: formData.siteB,
          notes: formData.notes || undefined,
        });
      }
      setSuccess(editing ? `Link ${formData.linkId} updated.` : "Link created successfully!");
      await loadData();
      setFormData(emptyForm());
      setView("list");
    } catch (err) {
      setError(err.response?.data?.message || (editing ? "Failed to update link" : "Failed to create link"));
      console.error("Create link error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // CREATE / EDIT VIEW
  if (view === "create" || view === "edit") {
    const editing = view === "edit";
    return (
      <div className="view">
        <div className="view-head">
          <div className="tagchip">
            <Antenna size={11} />
            {editing ? "Edit Link" : "New Link"}
          </div>
          <h2>{editing ? `Edit ${formData.linkId}` : "Create New Link"}</h2>
          <p>
            {editing
              ? "Update this link's details. The Link ID can't be changed; status changes as the kit moves through the pipeline."
              : "Define a new microwave link between two sites, ready to have a site kit assigned."}
          </p>
        </div>

        <div style={{ maxWidth: "700px" }}>
          {error && (
            <div style={{
              marginBottom: 20, padding: "12px 14px", background: "rgba(255,90,90,.1)",
              border: "1px solid rgba(255,90,90,.25)", borderRadius: 10, color: "var(--red)",
              fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start"
            }}>
              <AlertTriangle size={16} style={{ marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{
            background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12,
            padding: 24, display: "flex", flexDirection: "column", gap: 16
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                  Link ID *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. MW-03"
                  value={formData.linkId}
                  onChange={(e) => handleFormChange("linkId", e.target.value)}
                  disabled={editing}
                  maxLength={40}
                  required
                />
              </div>
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
                  {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                Name
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Riverside Tower – Ngong Ridge"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                  Path Length (km)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="form-input"
                  value={formData.pathLengthKm}
                  onChange={(e) => handleFormChange("pathLengthKm", e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                  Dish Size
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1.2m"
                  value={formData.dishSize}
                  onChange={(e) => handleFormChange("dishSize", e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {["siteA", "siteB"].map((end, i) => (
                <div key={end} style={{
                  padding: 12, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8,
                  display: "flex", flexDirection: "column", gap: 8
                }}>
                  <div className="faint" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Site {i === 0 ? "A" : "B"}
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Site name"
                    style={{ fontSize: 12 }}
                    value={formData[end].name}
                    onChange={(e) => handleSiteChange(end, "name", e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Site ID"
                    style={{ fontSize: 12 }}
                    value={formData[end].siteId}
                    onChange={(e) => handleSiteChange(end, "siteId", e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Region"
                    style={{ fontSize: 12 }}
                    value={formData[end].region}
                    onChange={(e) => handleSiteChange(end, "region", e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                Notes
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  flex: 1, padding: "10px 16px",
                  background: isSubmitting ? "var(--muted)" : "linear-gradient(to right, var(--amber), var(--amber2))",
                  color: "#114e9e", border: "none", borderRadius: 8, fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer", transition: "all 130ms"
                }}
              >
                {isSubmitting ? "Saving..." : (editing ? "Save Changes" : "Create Link")}
              </button>
              <button
                type="button"
                onClick={() => { setFormData(emptyForm()); setView("list"); }}
                style={{
                  padding: "10px 16px", background: "var(--panel2)", color: "var(--muted)",
                  border: "1px solid var(--line2)", borderRadius: 8, cursor: "pointer",
                  fontWeight: 600, transition: "all 130ms"
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
    <div>
      <div className="view-head">
        <span className="tagchip">
          <Antenna size={11} />
          Link Identity Mapping
        </span>
        <h2>Microwave Links</h2>
        <p>
          Equipment never lives in a vacuum. Every IDU is paired to its ODU and dish under a single{" "}
          <b>Link ID</b>, with a locked frequency assignment per hop — so a link is only "complete"
          when both ends are accounted for.
        </p>
      </div>

      {canEdit && (
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn amber" onClick={startCreate}>
            <Plus size={16} />
            New Link
          </button>
        </div>
      )}

      {success && (
        <div style={{
          marginBottom: 20, padding: "10px 14px", borderRadius: 10, fontSize: 12,
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(51,220,174,.06)", border: "1px solid rgba(51,220,174,.25)", color: "var(--teal)",
        }}>
          <CheckCircle2 size={14} />
          {success}
        </div>
      )}

      {listError && (
        <div role="alert" style={{
          marginBottom: 20, padding: "10px 14px", borderRadius: 10, fontSize: 12,
          display: "flex", alignItems: "flex-start", gap: 8,
          background: "rgba(255,90,90,.1)", border: "1px solid rgba(255,90,90,.25)", color: "var(--red)",
        }}>
          <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{listError}</span>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--faint)" }}>
          <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 12 }}>Loading links…</div>
        </div>
      )}

      {!loading && (
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {links.map(link => {
          const statusMeta = LINK_STATUS[link.status] || { label: link.status, c: "var(--faint)" };
          return (
            <div className="linkcard" key={link._id}>
              <div className="lc-top">
                <RadioTower size={17} style={{ color: BAND_COLORS[link.band] || "var(--faint)" }} />
                <span className="lc-id">{link.linkId}</span>
                {link.band && <Band b={link.band} />}
                <span className="pill" style={{ marginLeft: "auto", color: statusMeta.c }}>
                  <Dot c={statusMeta.c} />
                  {statusMeta.label}
                </span>
                {canEdit && (
                  <span style={{ display: "flex", gap: 4 }}>
                    <button className="btn sm ghost" title="Edit" aria-label={`Edit ${link.linkId}`} onClick={() => startEdit(link)}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn sm ghost" title="Delete" aria-label={`Delete ${link.linkId}`}
                      style={{ color: "var(--red)" }} disabled={deleting === link.linkId} onClick={() => removeLink(link)}>
                      {deleting === link.linkId ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                    </button>
                  </span>
                )}
              </div>

              <div className="endpoints">
                {endNode(link, "A")}
                <div className="beam">
                  <SatelliteDish size={15} />
                  <div className="pulse" />
                  <span className="mono" style={{ fontSize: 9, color: "var(--faint)" }}>
                    {link.dishSize || "—"}
                  </span>
                </div>
                {endNode(link, "B")}
              </div>

              <div style={{ display: "flex", gap: 18, fontSize: 11, color: "var(--faint)" }} className="mono">
                <span>
                  <MapPin size={11} style={{ verticalAlign: -2 }} /> {link.pathLengthKm || "—"} km
                </span>
                <span>Dish {link.dishSize || "—"}</span>
                <span style={{ marginLeft: "auto", color: link.status === "KIT_ASSIGNED" ? "var(--teal)" : "var(--red)" }}>
                  {link.status === "KIT_ASSIGNED" ? "Kit assigned" : "Awaiting kit"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {!loading && links.length === 0 && (
        <div style={{
          textAlign: "center", padding: 60, color: "var(--faint)",
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14
        }}>
          <Antenna size={32} style={{ marginBottom: 16, opacity: 0.5 }} />
          <div style={{ fontSize: 14, marginBottom: 4 }}>No links found</div>
          <div style={{ fontSize: 12 }}>
            {canEdit ? "Create your first link to get started." : "No links have been created yet."}
          </div>
        </div>
      )}
    </div>
  );
}
