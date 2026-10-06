import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Upload, Loader2, AlertTriangle, CheckCircle2, ListOrdered, Layers } from "lucide-react";
import { getBoqItems, importBoqExcel } from "../services/api";

const fmt = (n) => Number(n).toLocaleString("en-GB");

// Project inventory from the BOQ (Line 1 & 2), stored in the database.
export function BoqInventory({ canImport = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [line, setLine] = useState("all");
  const [section, setSection] = useState("all");
  const [category, setCategory] = useState("all");
  const [mode, setMode] = useState("items"); // "items" | "parts" (combined by part number)
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getBoqItems());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await importBoqExcel(file);
      setImportMsg({ ok: true, text: res.message + (res.problems?.length ? ` ${res.problems.length} row(s) skipped.` : "") });
      await load();
    } catch (err) {
      setImportMsg({ ok: false, text: err.response?.data?.message || "Import failed." });
    } finally {
      setImporting(false);
    }
  };

  const lines = useMemo(() => [...new Set(items.map((i) => i.line))].sort((a, b) => a - b), [items]);
  const categories = useMemo(() => {
    const c = {};
    items.forEach((i) => { c[i.category] = (c[i.category] || 0) + 1; });
    return Object.entries(c).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) =>
      (line === "all" || i.line === Number(line)) &&
      (section === "all" || i.section === section) &&
      (category === "all" || i.category === category) &&
      (!s || i.description.toLowerCase().includes(s) || i.partNumber.toLowerCase().includes(s))
    );
  }, [items, q, line, section, category]);

  // Same part number summed across lines and main/spares.
  const parts = useMemo(() => {
    const m = new Map();
    filtered.forEach((i) => {
      const key = i.partNumber || i.description;
      const p = m.get(key) || { partNumber: i.partNumber, description: i.description, category: i.category, quantity: 0, byLine: {} };
      p.quantity += i.quantity;
      p.byLine[i.line] = (p.byLine[i.line] || 0) + i.quantity;
      m.set(key, p);
    });
    return [...m.values()].sort((a, b) => a.category.localeCompare(b.category) || a.partNumber.localeCompare(b.partNumber));
  }, [filtered]);

  const totalQty = filtered.reduce((n, i) => n + i.quantity, 0);
  const qtyForLine = (l) => items.filter((i) => i.line === l).reduce((n, i) => n + i.quantity, 0);
  const spareQty = items.filter((i) => i.section === "spares").reduce((n, i) => n + i.quantity, 0);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--faint)" }}>
        <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 12 }}>Loading inventory…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--red)" }}>
        <AlertTriangle size={24} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 13, marginBottom: 10 }}>{error}</div>
        <button className="btn sm" onClick={load}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="k-top"><ListOrdered size={14} /> BOQ line items</div>
          <div className="k-val">{fmt(items.length)}</div>
          <div className="k-sub">{new Set(items.map((i) => i.partNumber)).size} distinct part numbers</div>
        </div>
        <div className="kpi">
          <div className="k-top"><Layers size={14} /> Total quantity</div>
          <div className="k-val">{fmt(items.reduce((n, i) => n + i.quantity, 0))}</div>
          <div className="k-sub">incl. {fmt(spareQty)} spares</div>
        </div>
        {lines.map((l) => (
          <div className="kpi" key={l}>
            <div className="k-top">Line {l}</div>
            <div className="k-val">{fmt(qtyForLine(l))}</div>
            <div className="k-sub">{items.filter((i) => i.line === l).length} line items</div>
          </div>
        ))}
      </div>

      {importMsg && (
        <div className={`boq-banner ${importMsg.ok ? "ok" : "err"}`}>
          {importMsg.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span>{importMsg.text}</span>
        </div>
      )}

      <div className="boq-toolbar">
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search description or part number…"
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inventory" />
        </div>
        <select className="form-input" value={line} onChange={(e) => setLine(e.target.value)} aria-label="Line">
          <option value="all">All lines</option>
          {lines.map((l) => <option key={l} value={l}>Line {l}</option>)}
        </select>
        <select className="form-input" value={section} onChange={(e) => setSection(e.target.value)} aria-label="Main or spares">
          <option value="all">Main + spares</option>
          <option value="main">Main only</option>
          <option value="spares">Spares only</option>
        </select>
        <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
        </select>
        {canImport && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={handleFile} />
            <button className="btn ghost" disabled={importing} onClick={() => fileRef.current?.click()}
              title='Upload a BOQ workbook with sheets named "Line 1 BOQ", "Line 2 BOQ", … — replaces those lines'>
              {importing ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
              {importing ? "Importing…" : "Import BOQ"}
            </button>
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-h">
          <ListOrdered size={15} className="ph-ico" />
          <h3>{mode === "items" ? "BOQ items" : "Combined by part number"}</h3>
          <div className="ph-r" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="faint" style={{ fontSize: 12 }}>
              {mode === "items" ? `${filtered.length} items` : `${parts.length} parts`} · qty {fmt(totalQty)}
            </span>
            <div className="tab-buttons" role="tablist" aria-label="View">
              <button role="tab" aria-selected={mode === "items"} className={`tab-btn ${mode === "items" ? "active" : ""}`} onClick={() => setMode("items")}>Items</button>
              <button role="tab" aria-selected={mode === "parts"} className={`tab-btn ${mode === "parts" ? "active" : ""}`} onClick={() => setMode("parts")}>By part</button>
            </div>
          </div>
        </div>
        <div className="tbl-wrap">
          {mode === "items" ? (
            <table className="tbl boq-tbl">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>#</th>
                  <th>Description</th>
                  <th>Part number</th>
                  <th>Category</th>
                  <th className="num">Qty</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i._id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>
                      L{i.line}{i.section === "spares" && <span className="spare-chip">Spare</span>}
                    </td>
                    <td className="mono faint">{i.itemNo}</td>
                    <td className="boq-desc">{i.description}</td>
                    <td className="mono" style={{ color: "var(--teal)", whiteSpace: "nowrap" }}>{i.partNumber || "—"}</td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{i.category}</td>
                    <td className="mono num">{fmt(i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="tbl boq-tbl">
              <thead>
                <tr>
                  <th>Part number</th>
                  <th>Description</th>
                  <th>Category</th>
                  {lines.map((l) => <th key={l} className="num">Line {l}</th>)}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.partNumber || p.description}>
                    <td className="mono" style={{ color: "var(--teal)", whiteSpace: "nowrap" }}>{p.partNumber || "—"}</td>
                    <td className="boq-desc">{p.description}</td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{p.category}</td>
                    {lines.map((l) => <td key={l} className="mono num">{p.byLine[l] ? fmt(p.byLine[l]) : <span className="faint">—</span>}</td>)}
                    <td className="mono num" style={{ fontWeight: 600 }}>{fmt(p.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filtered.length === 0 && (
            <div className="faint" style={{ textAlign: "center", padding: 28, fontSize: 13 }}>
              {items.length === 0 ? "No inventory yet — import a BOQ workbook." : "No items match these filters."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
