import React, { useEffect, useRef, useState } from 'react';
import { Package, Plus, Search, Filter, Eye, Wrench, Upload, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

// Normalizes a backend SiteKit doc (kitId, components[{qtyRequired,qtyAvailable}])
// into the shape this page renders with (id, components[{qty,available}]).
function fromApiKit(k) {
  return {
    id: k.kitId,
    name: k.name,
    band: k.band,
    status: k.status,
    sites: k.sites || [],
    components: (k.components || []).map(c => ({
      type: c.type,
      model: c.model,
      qty: c.qtyRequired,
      available: c.qtyAvailable,
    })),
    lastUpdated: timeAgo(k.updatedAt),
  };
}

const KIT_STATUS = {
  ready: { label: "Ready", c: "var(--teal)" },
  incomplete: { label: "Incomplete", c: "var(--red)" }, 
  pending: { label: "Pending Parts", c: "var(--amber)" },
  dispatched: { label: "Dispatched", c: "var(--violet)" }
};

export function SiteKits({ canEdit = true }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const fileInputRef = useRef(null);

  const loadKits = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSiteKits();
      setKits(data.map(fromApiKit));
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't reach the platform to load kits.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadKits(); }, []);

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
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

  const filteredKits = kits.filter(kit => {
    const matchesSearch = kit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kit.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kit.band.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || kit.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleCreateKit = () => {
    console.log("Create new kit");
  };

  const handleViewKit = (kitId) => {
    console.log("View kit:", kitId);
  };

  const handleConfigureKit = (kitId) => {
    console.log("Configure kit:", kitId);
  };

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

      <div style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
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
            <button className="btn amber" onClick={handleCreateKit}>
              <Plus size={16} />
              New Kit
            </button>
          </>
        )}
      </div>

      {importMsg && (
        <div
          style={{
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
          }}
        >
          {importMsg.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {importMsg.text}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--faint)" }}>
          <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 12 }}>Loading site kits…</div>
        </div>
      )}

      {!loading && error && (
        <div style={{
          textAlign: "center", padding: 40, color: "var(--red)",
          background: "rgba(255,90,90,.05)", border: "1px solid rgba(255,90,90,.25)", borderRadius: 14
        }}>
          <AlertTriangle size={24} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 13, marginBottom: 10 }}>{error}</div>
          <button className="btn sm" onClick={loadKits}>Retry</button>
        </div>
      )}

      {!loading && !error && (
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        {filteredKits.map(kit => (
          <div key={kit.id} className="panel">
            <div className="panel-h">
              <Package size={16} className="ph-ico" />
              <div>
                <h3>{kit.id}</h3>
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
                  {kit.sites.join(" ⟷ ")}
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
                    onClick={() => handleViewKit(kit.id)}
                  >
                    <Eye size={14} />
                    View
                  </button>
                  {canEdit && (
                    <button 
                      className="btn sm"
                      onClick={() => handleConfigureKit(kit.id)}
                    >
                      <Wrench size={14} />
                      Configure
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {!loading && !error && filteredKits.length === 0 && (
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
              ? "Import an Excel sheet to load your first site kits."
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
