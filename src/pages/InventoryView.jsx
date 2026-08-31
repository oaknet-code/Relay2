import React, { useState } from 'react';
import { Search, Boxes } from 'lucide-react';
import { StatePill, TypeIcon, Band } from '../components/ui';

export function InventoryView({ assets }) {
  const [q, setQ] = useState("");
  const [fState, setFState] = useState("all");
  const [fType, setFType] = useState("all");

  const filteredAssets = assets.filter(a => {
    if (fState !== "all" && a.state !== fState) return false;
    if (fType !== "all" && a.type !== fType) return false;
    if (q) {
      const s = (a.serial + a.model + (a.tag || "") + (a.link || "") + a.loc).toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const FilterChip = ({ v, set, cur, children }) => (
    <button 
      className="btn sm ghost" 
      onClick={() => set(v)} 
      style={cur === v ? { borderColor: "var(--amber)", color: "var(--amber)" } : {}}
    >
      {children}
    </button>
  );

  return (
    <div>
      <div className="view-head">
        <span className="tagchip">
          <Boxes size={11} />
          Step 1 / 2 · Asset & Consumable Master
        </span>
        <h2>Inventory</h2>
        <p>
          Serialized units carry frequency-band metadata and a single live lifecycle state; 
          consumables are tracked by quantity against reorder thresholds.
        </p>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-h">
          <Search size={15} className="ph-ico" />
          <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
            <input 
              value={q} 
              onChange={e => setQ(e.target.value)} 
              placeholder="Search serial, model, tag, link…"
              style={{
                width: "100%",
                background: "var(--bg)",
                border: "1px solid var(--line2)",
                borderRadius: 8,
                padding: "8px 11px",
                color: "var(--ink)",
                fontFamily: "var(--mono)",
                fontSize: 12.5,
                outline: "none"
              }}
            />
          </div>
          <span className="ph-r">{filteredAssets.length} serialized units</span>
        </div>
        
        <div className="panel-b">
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <FilterChip v="all" set={setFState} cur={fState}>All States</FilterChip>
            <FilterChip v="stocked" set={setFState} cur={fState}>Stocked</FilterChip>
            <FilterChip v="staged" set={setFState} cur={fState}>Staged</FilterChip>
            <FilterChip v="dispatched" set={setFState} cur={fState}>Dispatched</FilterChip>
            <FilterChip v="installed" set={setFState} cur={fState}>Installed</FilterChip>
          </div>
          
          <div style={{ display: "flex", gap: 8 }}>
            <FilterChip v="all" set={setFType} cur={fType}>All Types</FilterChip>
            <FilterChip v="IDU" set={setFType} cur={fType}>IDU</FilterChip>
            <FilterChip v="ODU" set={setFType} cur={fType}>ODU</FilterChip>
            <FilterChip v="DISH" set={setFType} cur={fType}>DISH</FilterChip>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <Boxes size={15} className="ph-ico" />
          <h3>Serialized Assets</h3>
          <span className="ph-r">{filteredAssets.length} items</span>
        </div>
        <div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Type</th>
                <th>Model</th>
                <th>Band</th>
                <th>State</th>
                <th>Location</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map(a => (
                <tr key={a.uid}>
                  <td>
                    <div className="mono" style={{ fontSize: 12 }}>{a.serial}</div>
                    {a.tag && (
                      <div className="faint mono" style={{ fontSize: 10 }}>{a.tag}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <TypeIcon t={a.type} size={14} />
                      {a.type}
                    </div>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{a.model}</td>
                  <td><Band b={a.band} /></td>
                  <td><StatePill s={a.state} /></td>
                  <td className="muted" style={{ fontSize: 11 }}>{a.loc}</td>
                  <td>
                    {a.link ? (
                      <span className="mono" style={{ fontSize: 11, color: "var(--teal)" }}>
                        {a.link}
                        {a.end && <span className="faint"> · End {a.end}</span>}
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}