import React, { useEffect, useMemo, useState } from "react";
import {
  Building2, Search, Plus, ArrowLeft, ChevronRight, Loader2, AlertTriangle,
  CheckCircle2, Pencil, Trash2, Package, Inbox, X, Info,
} from "lucide-react";
import { getSites, createSite, updateSite, deleteSite } from "../services/api";
import { SiteKits } from "./SiteKits";

const fmtDate = (d) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const UNASSIGNED = { unassigned: true, siteId: "—", name: "Unassigned kits" };
const apiMessage = (err, fallback) => err.response?.data?.message || fallback;

function Banner({ kind, children }) {
  const ok = kind === "ok";
  return (
    <div style={{
      marginBottom: 16, padding: "10px 14px", borderRadius: 10, fontSize: 12.5,
      display: "flex", alignItems: "center", gap: 8,
      background: ok ? "rgba(51,220,174,.06)" : "rgba(255,90,90,.06)",
      border: `1px solid ${ok ? "rgba(51,220,174,.25)" : "rgba(255,90,90,.25)"}`,
      color: ok ? "var(--teal)" : "var(--red)",
    }}>
      {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      <span>{children}</span>
    </div>
  );
}

// Sites replace the flat Site Kits list: pick a site to see and manage its kits.
export function SitesPage({ canEdit = false }) {
  const [sites, setSites] = useState([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null); // Site _id, "unassigned", or null for the list
  const [siteTab, setSiteTab] = useState("kits"); // "overview" | "kits" inside an open site

  const [listTab, setListTab] = useState("sites"); // "sites" | "kits" (every kit, all sites)
  const [showCreate, setShowCreate] = useState(false);
  const [newSite, setNewSite] = useState({ name: "", siteId: "" });
  const [editing, setEditing] = useState(null); // { name, siteId } while editing the open site
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const loadSites = async () => {
    try {
      const data = await getSites();
      setSites(data.sites || []);
      setUnassignedCount(data.unassignedKitCount || 0);
      setError("");
    } catch (err) {
      setError(apiMessage(err, "Failed to load sites."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSites(); }, []);

  const nextId = useMemo(() => {
    const max = sites.reduce((m, s) => Math.max(m, Number(s.siteId) || 0), 0);
    return String(max + 1).padStart(3, "0");
  }, [sites]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(s => s.siteId.includes(q) || s.name.toLowerCase().includes(q));
  }, [sites, search]);

  // Opening a site always lands on its Site Kits tab.
  useEffect(() => { setSiteTab("kits"); setEditing(null); }, [openId]);

  const totalKits = sites.reduce((n, s) => n + (s.kitCount || 0), unassignedCount);

  const openSite = openId === "unassigned" ? UNASSIGNED : sites.find(s => s._id === openId) || null;

  const handleCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const payload = { name: newSite.name.trim() };
      if (newSite.siteId.trim()) payload.siteId = newSite.siteId.trim();
      const created = await createSite(payload);
      await loadSites();
      setShowCreate(false);
      setNewSite({ name: "", siteId: "" });
      setNotice(`Site ${created.siteId} · ${created.name} created.`);
    } catch (err) {
      setFormError(apiMessage(err, "Failed to create the site."));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const payload = {};
      if (editing.name.trim() !== openSite.name) payload.name = editing.name.trim();
      if (editing.siteId.trim() !== openSite.siteId) payload.siteId = editing.siteId.trim();
      if (Object.keys(payload).length) await updateSite(openSite.siteId, payload);
      await loadSites();
      setEditing(null);
    } catch (err) {
      setFormError(apiMessage(err, "Failed to update the site."));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete site ${openSite.siteId} · ${openSite.name}? This can't be undone.`)) return;
    setBusy(true);
    setFormError("");
    try {
      await deleteSite(openSite.siteId);
      setNotice(`Site ${openSite.siteId} · ${openSite.name} deleted.`);
      setOpenId(null);
      await loadSites();
    } catch (err) {
      setFormError(apiMessage(err, "Failed to delete the site."));
    } finally {
      setBusy(false);
    }
  };

  // ── Site detail: Overview | Site Kits tabs ────────────────────
  if (openSite) {
    const kitCount = openSite.unassigned ? unassignedCount : openSite.kitCount;
    const tab = openSite.unassigned ? "kits" : siteTab; // Unassigned has no overview

    return (
      <div className="view">
        <button
          className="btn ghost sm"
          style={{ marginBottom: 16 }}
          onClick={() => { setOpenId(null); setEditing(null); setFormError(""); }}
        >
          <ArrowLeft size={14} /> All sites
        </button>

        <div className="view-head">
          <span className="tagchip">
            {openSite.unassigned ? <Inbox size={11} /> : <Building2 size={11} />}
            {openSite.unassigned ? "Not filed under a site" : `Site ${openSite.siteId}`}
          </span>
          <h2>{openSite.name}</h2>
          {openSite.unassigned && (
            <p>Kits created before sites existed. Open a kit and choose its site to file it.</p>
          )}
        </div>

        {!openSite.unassigned && (
          <div className="tab-buttons site-tabs" role="tablist" aria-label="Site sections">
            <button
              role="tab"
              aria-selected={tab === "overview"}
              className={`tab-btn ${tab === "overview" ? "active" : ""}`}
              onClick={() => setSiteTab("overview")}
            >
              <Info size={12} style={{ marginRight: 5 }} /> Overview
            </button>
            <button
              role="tab"
              aria-selected={tab === "kits"}
              className={`tab-btn ${tab === "kits" ? "active" : ""}`}
              onClick={() => setSiteTab("kits")}
            >
              <Package size={12} style={{ marginRight: 5 }} /> Site Kits ({kitCount})
            </button>
          </div>
        )}

        {formError && <Banner kind="error">{formError}</Banner>}

        {tab === "overview" && (
          <div className="panel" style={{ maxWidth: 720 }}>
            <div className="panel-h">
              <Info size={15} className="ph-ico" />
              <h3>Site information</h3>
              {canEdit && !editing && (
                <div className="ph-r" style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost sm" onClick={() => setEditing({ name: openSite.name, siteId: openSite.siteId })}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    className="btn ghost sm"
                    style={{ color: "var(--red)" }}
                    disabled={busy || kitCount > 0}
                    title={kitCount > 0 ? "Move or delete this site's kits first" : "Delete site"}
                    onClick={handleDelete}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
            <div className="panel-b">
              {editing ? (
                <form onSubmit={handleSaveEdit} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                    Site ID
                    <input className="form-input" style={{ width: 110 }} value={editing.siteId}
                      onChange={(e) => setEditing(p => ({ ...p, siteId: e.target.value }))} required pattern="\d{3,6}" />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--muted)", flex: "1 1 220px" }}>
                    Site name
                    <input className="form-input" value={editing.name}
                      onChange={(e) => setEditing(p => ({ ...p, name: e.target.value }))} required maxLength={120} />
                  </label>
                  <button className="btn amber" type="submit" disabled={busy}>
                    {busy ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />} Save
                  </button>
                  <button className="btn ghost" type="button" onClick={() => { setEditing(null); setFormError(""); }}>
                    Cancel
                  </button>
                </form>
              ) : (
                <dl className="site-facts">
                  <div><dt>Site ID</dt><dd className="mono" style={{ color: "var(--teal)" }}>{openSite.siteId}</dd></div>
                  <div><dt>Site name</dt><dd>{openSite.name}</dd></div>
                  <div>
                    <dt>Site kits</dt>
                    <dd>
                      <button className="site-open" onClick={() => setSiteTab("kits")}>
                        {kitCount} kit{kitCount === 1 ? "" : "s"} <ChevronRight size={13} />
                      </button>
                    </dd>
                  </div>
                  {openSite.updatedAt && <div><dt>Last updated</dt><dd>{fmtDate(openSite.updatedAt)}</dd></div>}
                </dl>
              )}
            </div>
          </div>
        )}

        {tab === "kits" && (
          <section aria-label="Site Kits">
            {!openSite.unassigned && (
              <div className="site-kits-head">
                <Package size={15} className="ph-ico" />
                <h3>Site Kits</h3>
                <span className="faint">{kitCount} kit{kitCount === 1 ? "" : "s"} at {openSite.name}</span>
              </div>
            )}
            <SiteKits
              key={openId}
              canEdit={canEdit}
              site={openSite}
              sites={sites}
              onKitsChanged={loadSites}
            />
          </section>
        )}
      </div>
    );
  }

  // ── Site list ──────────────────────────────────────────────────
  return (
    <div className="view">
      <div className="view-head">
        <span className="tagchip">
          <Building2 size={11} />
          Rollout Pipeline
        </span>
        <h2>Sites</h2>
        <p>Every site in the rollout. Open a site to manage its kits, or use Site Kits to see every kit.</p>
      </div>

      <div className="tab-buttons site-tabs" role="tablist" aria-label="Sites sections">
        <button
          role="tab"
          aria-selected={listTab === "sites"}
          className={`tab-btn ${listTab === "sites" ? "active" : ""}`}
          onClick={() => setListTab("sites")}
        >
          <Building2 size={12} style={{ marginRight: 5 }} /> Sites ({sites.length})
        </button>
        <button
          role="tab"
          aria-selected={listTab === "kits"}
          className={`tab-btn ${listTab === "kits" ? "active" : ""}`}
          onClick={() => setListTab("kits")}
        >
          <Package size={12} style={{ marginRight: 5 }} /> Site Kits ({totalKits})
        </button>
      </div>

      {listTab === "kits" ? (
        <section aria-label="All site kits">
          <div className="site-kits-head">
            <Package size={15} className="ph-ico" />
            <h3>All Site Kits</h3>
            <span className="faint">{totalKits} kit{totalKits === 1 ? "" : "s"} across {sites.length} sites</span>
          </div>
          <SiteKits
            canEdit={canEdit}
            sites={sites}
            showHeader={false}
            onKitsChanged={loadSites}
          />
        </section>
      ) : (
      <>
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 40 }}
            placeholder="Search by site ID or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search sites"
          />
        </div>
        {canEdit && !showCreate && (
          <button className="btn amber" onClick={() => { setShowCreate(true); setFormError(""); setNotice(""); }}>
            <Plus size={16} /> New Site
          </button>
        )}
      </div>

      {showCreate && (
        <form className="panel" style={{ marginBottom: 16 }} onSubmit={handleCreate}>
          <div className="panel-h">
            <Building2 size={15} className="ph-ico" />
            <h3>New site</h3>
            <button type="button" className="ph-r" aria-label="Close"
              style={{ background: "none", border: 0, color: "var(--faint)", cursor: "pointer" }}
              onClick={() => { setShowCreate(false); setFormError(""); }}>
              <X size={16} />
            </button>
          </div>
          <div className="panel-b" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--muted)", flex: "1 1 240px" }}>
              Site name
              <input className="form-input" autoFocus required maxLength={120} placeholder="e.g. Loresho"
                value={newSite.name} onChange={(e) => setNewSite(p => ({ ...p, name: e.target.value }))} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--muted)", width: 140 }}>
              Site ID
              <input className="form-input" pattern="\d{3,6}" placeholder={`${nextId} (auto)`}
                value={newSite.siteId} onChange={(e) => setNewSite(p => ({ ...p, siteId: e.target.value }))} />
            </label>
            <button className="btn amber" type="submit" disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Create site
            </button>
          </div>
          {formError && <div className="panel-b" style={{ paddingTop: 0 }}><Banner kind="error">{formError}</Banner></div>}
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--faint)" }}>
          <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 12 }}>Loading sites…</div>
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--red)" }}>
          <AlertTriangle size={24} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 13, marginBottom: 10 }}>{error}</div>
          <button className="btn sm" onClick={() => { setLoading(true); loadSites(); }}>Retry</button>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-h">
            <Building2 size={15} className="ph-ico" />
            <h3>All sites</h3>
            <span className="ph-r">{filtered.length} of {sites.length}</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl sites-tbl">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Site ID</th>
                  <th>Site name</th>
                  <th style={{ width: 90, textAlign: "right" }}>Kits</th>
                  <th style={{ width: 40 }} aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {!search && unassignedCount > 0 && (
                  <tr className="site-row" onClick={() => setOpenId("unassigned")}>
                    <td className="faint mono">—</td>
                    <td>
                      <button className="site-open" onClick={(e) => { e.stopPropagation(); setOpenId("unassigned"); }}>
                        <Inbox size={13} style={{ color: "var(--amber)" }} /> Unassigned kits
                      </button>
                    </td>
                    <td className="mono" style={{ textAlign: "right", color: "var(--amber)" }}>{unassignedCount}</td>
                    <td><ChevronRight size={14} className="faint" /></td>
                  </tr>
                )}
                {filtered.map(s => (
                  <tr key={s._id} className="site-row" onClick={() => setOpenId(s._id)}>
                    <td className="mono" style={{ color: "var(--teal)" }}>{s.siteId}</td>
                    <td>
                      <button className="site-open" onClick={(e) => { e.stopPropagation(); setOpenId(s._id); }}>
                        {s.name}
                      </button>
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {s.kitCount ? <span><Package size={11} style={{ verticalAlign: -1, marginRight: 4 }} />{s.kitCount}</span> : <span className="faint">0</span>}
                    </td>
                    <td><ChevronRight size={14} className="faint" /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="faint" style={{ textAlign: "center", padding: 24 }}>No sites match "{search}".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
