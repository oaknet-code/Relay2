import React, { useEffect, useRef, useState } from 'react';
import {
  Package, Plus, Search, Filter, Eye, Wrench, Upload, Loader2,
  AlertTriangle, CheckCircle2, Trash2, Edit, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { Band, StatePill, Dot } from '../components/ui';
import { getSiteKits, importSiteKitsExcel } from '../services/api';

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
    id: k.kitId || k.id,
    name: k.name,
    band: k.band,
    status: k.status,
    sites: k.sites || [],
    components: (k.components || []).map(c => ({
      type: c.type,
      model: c.model,
      qty: c.qtyRequired || c.qty,
      available: c.qtyAvailable || c.available,
    })),
    lastUpdated: timeAgo(k.updatedAt || k.createdAt),
    createdAt: k.createdAt || new Date().toISOString().split("T")[0],
  };
}

const KIT_STATUS = {
  ready: { label: "Ready", c: "var(--teal)" },
  incomplete: { label: "Incomplete", c: "var(--red)" },
  pending: { label: "Pending Parts", c: "var(--amber)" },
  dispatched: { label: "Dispatched", c: "var(--violet)" }
};

export function SiteKits({ canEdit = true }) {
  const [view, setView] = useState("list"); // list, create, edit
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKit, setEditingKit] = useState(null);
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    band: "4GHz",
    status: "incomplete",
    sites: "",
    components: [{ type: "IDU", model: "", qty: 0, available: 0 }],
  });

  const loadKitsFromStorage = () => {
    try {
      const stored = localStorage.getItem("relay_kits");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load kits from storage:", e);
      return [];
    }
  };

  const saveKitsToStorage = (kitsToSave) => {
    try {
      localStorage.setItem("relay_kits", JSON.stringify(kitsToSave));
    } catch (e) {
      console.error("Failed to save kits to storage:", e);
    }
  };

  const loadKits = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to load from API first
      try {
        const data = await getSiteKits();
        const normalizedKits = data.map(fromApiKit);
        setKits(normalizedKits);
        saveKitsToStorage(normalizedKits);
      } catch (apiErr) {
        // Fall back to localStorage
        const storedKits = loadKitsFromStorage();
        setKits(storedKits);
      }
    } catch (err) {
      setError("Failed to load kits");
      const storedKits = loadKitsFromStorage();
      setKits(storedKits);
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
    } catch (err) {
      setImportMsg({ ok: false, text: err.response?.data?.message || "Import failed." });
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      band: "4GHz",
      status: "incomplete",
      sites: "",
      components: [{ type: "IDU", model: "", qty: 0, available: 0 }],
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
      status: kit.status,
      sites: kit.sites.join(", "),
      components: kit.components || [{ type: "IDU", model: "", qty: 0, available: 0 }],
    });
    setView("edit");
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
      [field]: field === "type" || field === "model" ? value : parseInt(value) || 0
    };
    setFormData(prev => ({
      ...prev,
      components: newComponents
    }));
  };

  const addComponent = () => {
    setFormData(prev => ({
      ...prev,
      components: [...prev.components, { type: "ODU", model: "", qty: 0, available: 0 }]
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
      if (!formData.name || !formData.band) {
        setError("Kit name and band are required");
        setIsSubmitting(false);
        return;
      }

      let updatedKits;
      const kitData = {
        id: editingKit?.id || Date.now().toString(),
        name: formData.name,
        kitId: editingKit?.id || `KIT-${Date.now()}`,
        band: formData.band,
        status: formData.status,
        sites: formData.sites.split(",").map(s => s.trim()).filter(s => s),
        components: formData.components,
        createdAt: editingKit?.createdAt || new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
      };

      if (editingKit) {
        updatedKits = kits.map(k => k.id === editingKit.id ? kitData : k);
        setSuccess("Kit updated successfully!");
      } else {
        updatedKits = [kitData, ...kits];
        setSuccess("Kit created successfully!");
      }

      saveKitsToStorage(updatedKits);
      setKits(updatedKits);
      resetForm();
      setView("list");
    } catch (err) {
      setError("Failed to save kit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKit = (kitId, kitName) => {
    if (!window.confirm(`Are you sure you want to delete kit "${kitName}"? This cannot be undone.`)) {
      return;
    }

    const updatedKits = kits.filter(k => k.id !== kitId);
    saveKitsToStorage(updatedKits);
    setKits(updatedKits);
    setSuccess("Kit deleted successfully!");
  };

  const filteredKits = kits.filter(kit => {
    const matchesSearch = kit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kit.kitId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kit.band.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || kit.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // CREATE/EDIT VIEW
  if (view === "create" || view === "edit") {
    return (
      <div className="view">
        <div className="view-head">
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
                >
                  <option value="4GHz">4 GHz</option>
                  <option value="6GHz">6 GHz</option>
                  <option value="8GHz">8 GHz</option>
                  <option value="11GHz">11 GHz</option>
                  <option value="13GHz">13 GHz</option>
                  <option value="15GHz">15 GHz</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                  Status
                </label>
                <select
                  className="form-input"
                  value={formData.status}
                  onChange={(e) => handleFormChange("status", e.target.value)}
                >
                  <option value="ready">Ready</option>
                  <option value="incomplete">Incomplete</option>
                  <option value="pending">Pending Parts</option>
                  <option value="dispatched">Dispatched</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--muted)" }}>
                Sites (comma-separated)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Site A, Site B, Site C"
                value={formData.sites}
                onChange={(e) => handleFormChange("sites", e.target.value)}
              />
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
                  <div key={idx} style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 80px 80px 40px",
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
                      <option value="Dish">Dish</option>
                      <option value="Cable">Cable</option>
                      <option value="Connector">Connector</option>
                    </select>

                    <input
                      type="text"
                      className="form-input"
                      placeholder="Model"
                      value={comp.model}
                      onChange={(e) => handleComponentChange(idx, "model", e.target.value)}
                      style={{ fontSize: 12 }}
                    />

                    <input
                      type="number"
                      className="form-input"
                      placeholder="Qty"
                      min="0"
                      value={comp.qty}
                      onChange={(e) => handleComponentChange(idx, "qty", e.target.value)}
                      style={{ fontSize: 12 }}
                    />

                    <input
                      type="number"
                      className="form-input"
                      placeholder="Available"
                      min="0"
                      value={comp.available}
                      onChange={(e) => handleComponentChange(idx, "available", e.target.value)}
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
            <button
              className="btn ghost"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
              {importing ? "Importing…" : "Import Excel"}
            </button>
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
              <div>
                <h3>{kit.kitId}</h3>
                <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                  {kit.name}
                </div>
              </div>
              <div className="ph-r">
                <StatePill state={kit.status} meta={KIT_STATUS} />
              </div>
            </div>
            <div className="panel-b">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Band band={kit.band} />
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {kit.sites.length > 0 ? kit.sites.join(" ⟷ ") : "No sites"}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: "var(--faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Kit Components
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {kit.components.map((comp, i) => (
                    <div key={i} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      fontSize: 11,
                      borderBottom: i < kit.components.length - 1 ? "1px solid var(--line)" : "none"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Dot c={comp.available >= comp.qty ? "var(--teal)" : "var(--red)"} />
                        <span style={{ fontFamily: "var(--mono)" }}>{comp.type}</span>
                        <span>{comp.model}</span>
                      </div>
                      <div style={{
                        fontFamily: "var(--mono)",
                        color: comp.available >= comp.qty ? "var(--teal)" : "var(--red)"
                      }}>
                        {comp.available}/{comp.qty}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 10, color: "var(--faint)" }}>
                  Updated {kit.lastUpdated}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn ghost sm"
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
                        onClick={() => handleDeleteKit(kit.id, kit.name)}
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
            {kits.length === 0
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
