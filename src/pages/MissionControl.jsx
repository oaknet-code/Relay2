import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Gauge, PackageCheck, Truck, Boxes, Layers, MapPin, List,
  Loader2, AlertTriangle, RefreshCw, Package, ExternalLink
} from 'lucide-react';
import { Ring, Band, Dot } from '../components/ui';
import { LINK_STATUS } from '../constants/states';
import { getDashboard } from '../services/api';

// Everything here comes from GET /api/dashboard (live links, sites, kits,
// reserved stock and assets) — no sample data.

const linkStatus = (s) => LINK_STATUS[String(s || "").toUpperCase()] || { label: String(s || "—"), c: "var(--faint)" };

// Leaflet draws on canvas/SVG, which can't read CSS variables — resolve
// "var(--teal)" to its actual colour.
const cssColor = (c) => {
  const m = /^var\((--[\w-]+)\)$/.exec(c);
  if (!m || typeof document === "undefined") return c;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || "#8a94a6";
};

const GROUPS = [
  { name: "Lamu Route Backbone", short: "Lamu" },
  { name: "Mandera Links", short: "Mandera" },
];

// Asset lifecycle, in pipeline order (backend statuses).
const ASSET_STAGES = [
  ["STOCKED", "Stocked", "var(--steel)"],
  ["ALLOCATED", "Allocated", "var(--blue)"],
  ["STAGING", "Staging", "var(--blue)"],
  ["QA_PASSED", "QA passed", "var(--blue)"],
  ["STAGED", "Staged", "var(--violet)"],
  ["DISPATCHED", "Dispatched", "#f5a524"],
  ["IN_TRANSIT", "In transit", "#f5a524"],
  ["ARRIVED", "Arrived", "#f5a524"],
  ["FIELD_INSTALLATION", "Installing", "#f5a524"],
  ["INSTALLED", "Installed", "var(--teal)"],
  ["COMMISSIONED", "Commissioned", "var(--teal)"],
  ["LIVE", "Live", "var(--teal)"],
  ["MAINTENANCE", "Maintenance", "var(--red)"],
  ["RETIRED", "Retired", "var(--faint)"],
];

// Map marker colour: live link > kit fully stocked > stock outstanding > no kit.
// (The theme's --amber is blue, so outstanding uses a literal amber.)
const OUTSTANDING = "#f5a524";
const siteState = (s) =>
  s.live ? { c: "var(--teal)", label: "Link live" }
  : !s.kits.length ? { c: "var(--faint)", label: "No kit" }
  : s.stockPct === 100 ? { c: "var(--violet)", label: "Kit stocked" }
  : { c: OUTSTANDING, label: "Stock outstanding" };

const hasGps = (s) => typeof s.latitude === "number" && typeof s.longitude === "number";
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

export function MissionControl() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('map'); // 'map' | 'links'
  const [group, setGroup] = useState(""); // "" = all routes
  const [selectedId, setSelectedId] = useState(null); // site siteId

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getDashboard());
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load Mission Control.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const isClient = data && !data.sites; // clients only get their links
  const sites = useMemo(() => data?.sites || [], [data]);
  const siteById = useMemo(() => new Map(sites.map((s) => [s.siteId, s])), [sites]);
  const inGroup = useCallback((s) => !group || s.groups.includes(group), [group]);
  const shownSites = useMemo(() => sites.filter(inGroup), [sites, inGroup]);
  const shownLinks = useMemo(() => (data?.linkList || []).filter((l) => {
    if (!group) return true;
    const a = siteById.get(l.siteA?.siteId), b = siteById.get(l.siteB?.siteId);
    return (a && a.groups.includes(group)) || (b && b.groups.includes(group));
  }), [data, group, siteById]);
  const gpsCount = shownSites.filter(hasGps).length;
  const selected = selectedId ? siteById.get(selectedId) : null;
  const selectedLinks = useMemo(
    () => (selected ? (data?.linkList || []).filter((l) => l.siteA?.siteId === selected.siteId || l.siteB?.siteId === selected.siteId) : []),
    [data, selected]
  );

  // Create the map while the Map tab is shown.
  useEffect(() => {
    if (activeTab !== 'map' || !mapRef.current || !data || isClient) return;
    const L = window.L;
    if (!L) return;
    const map = L.map(mapRef.current, { center: [0.2, 38.3], zoom: 6, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // OpenStreetMap tiles, darkened via CSS (.mc-map .leaflet-tile-pane).
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    layersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => {
      clearTimeout(t);
      map.remove();
      mapInstanceRef.current = null;
      layersRef.current = null;
    };
  }, [activeTab, data, isClient]);

  // Draw the sites that have GPS, and links whose two ends both do.
  useEffect(() => {
    const L = window.L;
    const layers = layersRef.current;
    const map = mapInstanceRef.current;
    if (activeTab !== 'map' || !L || !layers || !map) return;
    layers.clearLayers();

    for (const l of shownLinks) {
      const a = siteById.get(l.siteA?.siteId), b = siteById.get(l.siteB?.siteId);
      if (!a || !b || !hasGps(a) || !hasGps(b)) continue;
      const live = ["LIVE", "COMMISSIONED"].includes(l.status);
      L.polyline([[a.latitude, a.longitude], [b.latitude, b.longitude]], {
        color: cssColor(linkStatus(l.status).c),
        weight: live ? 3 : 1.5,
        dashArray: live ? null : '4, 4',
        opacity: 0.85,
      }).bindTooltip(`${l.linkId} · ${l.name}`).addTo(layers);
    }

    const points = [];
    for (const s of shownSites.filter(hasGps)) {
      const isSel = s.siteId === selectedId;
      points.push([s.latitude, s.longitude]);
      L.circleMarker([s.latitude, s.longitude], {
        radius: isSel ? 9 : 7,
        fillColor: cssColor(siteState(s).c),
        color: isSel ? '#ffffff' : '#080b10',
        weight: isSel ? 2 : 1.5,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .bindTooltip(`${s.siteId} · ${s.name}`, { permanent: points.length <= 25, direction: 'top', className: `map-tooltip ${isSel ? 'selected' : ''}`, offset: [0, -8] })
        .on('click', () => setSelectedId(s.siteId))
        .addTo(layers);
    }
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 9 });
    else if (points.length === 1) map.setView(points[0], 9);
  }, [activeTab, shownSites, shownLinks, siteById, selectedId]);

  const openSite = (siteId) => {
    if (!siteId || !siteById.has(siteId)) return;
    setSelectedId(siteId);
    setActiveTab('map');
  };

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "var(--faint)" }}>
        <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 12 }}>Loading Mission Control…</div>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--red)" }}>
        <AlertTriangle size={24} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 13, marginBottom: 10 }}>{error}</div>
        <button className="btn sm" onClick={load}>Retry</button>
      </div>
    );
  }

  const L = data.links;
  const K = data.kits;
  const A = data.assets;
  const assetSegs = A ? ASSET_STAGES.filter(([k]) => A.byStatus[k]).map(([k, label, c]) => ({ k, label, c, n: A.byStatus[k] })) : [];

  return (
    <div>
      <div className="view-head">
        <span className="tagchip">
          <Gauge size={11} />
          Project Success Metrics
        </span>
        <h2>Mission Control</h2>
        <p>
          Live rollout health across {isClient ? "your" : "all"} microwave links — link completion,
          kit stock, dispatch custody and tracked hardware, straight from the system.
        </p>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ "--gl": "rgba(51,220,174,.10)" }}>
          <div className="k-top"><PackageCheck size={14} /> Link Completeness</div>
          <div className="k-val">
            {L.completePct}
            <span style={{ fontSize: 18, color: "var(--faint)" }}>%</span>
          </div>
          <div className="k-sub">{L.complete} of {L.total} links commissioned or live · {L.planned} planned</div>
          <div className="k-ring"><Ring pct={L.completePct} c="var(--teal)" /></div>
        </div>

        {!isClient && (
          <>
            <div className="kpi" style={{ "--gl": "rgba(95,168,255,.10)" }}>
              <div className="k-top"><Package size={14} /> Kit Stock Reserved</div>
              <div className="k-val">
                {K.stockPct}
                <span style={{ fontSize: 18, color: "var(--faint)" }}>%</span>
              </div>
              <div className="k-sub">
                {K.coveredLines} of {K.lines} part lines reserved · {K.stocked} of {K.total} kits fully stocked
              </div>
              <div className="k-ring"><Ring pct={K.stockPct} c="var(--blue)" /></div>
            </div>

            <div className="kpi" style={{ "--gl": "rgba(255,95,95,.10)" }}>
              <div className="k-top"><Truck size={14} /> Dispatch &amp; Custody</div>
              <div className="k-val" style={{ color: K.overdue.length ? "var(--red)" : "var(--ink)" }}>
                {K.dispatched}
                <span style={{ fontSize: 16, color: "var(--faint)" }}> / {K.total}</span>
              </div>
              <div className="k-sub">
                kits dispatched · {K.installed} installed ·{" "}
                <span style={{ color: K.overdue.length ? "var(--red)" : "inherit" }}>
                  {K.overdue.length} out &gt; {data.overdueDays} d, not installed
                </span>
              </div>
              <div className="k-ring"><Ring pct={pct(K.dispatched, K.total)} c="var(--amber)" /></div>
            </div>

            <div className="kpi" style={{ "--gl": "rgba(173,139,255,.10)" }}>
              <div className="k-top"><Boxes size={14} /> Serialized Assets Tracked</div>
              <div className="k-val">{A.total}</div>
              <div className="k-sub">
                {(A.byStatus.INSTALLED || 0) + (A.byStatus.COMMISSIONED || 0) + (A.byStatus.LIVE || 0)} installed ·{" "}
                {A.byStatus.STAGED || 0} staged · {(A.byStatus.DISPATCHED || 0) + (A.byStatus.IN_TRANSIT || 0)} in transit
              </div>
              <div className="k-ring">
                <Ring pct={pct((A.byStatus.INSTALLED || 0) + (A.byStatus.COMMISSIONED || 0) + (A.byStatus.LIVE || 0), A.total)} c="var(--violet)" />
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={15} className="ph-ico" />
              <h3>{activeTab === 'map' ? 'Kenya Operations Map' : 'Links & Kit Stock'}</h3>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {!isClient && (
                <select className="form-input" style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
                  value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Route">
                  <option value="">All routes</option>
                  {GROUPS.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
              )}
              <div className="tab-buttons">
                {!isClient && (
                  <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
                    <MapPin size={12} style={{ marginRight: 4 }} /> Map
                  </button>
                )}
                <button className={`tab-btn ${activeTab === 'links' || isClient ? 'active' : ''}`} onClick={() => setActiveTab('links')}>
                  <List size={12} style={{ marginRight: 4 }} /> Links
                </button>
              </div>
              <button className="btn sm ghost" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh">
                <RefreshCw size={13} className={loading ? "spin" : ""} />
              </button>
            </div>
          </div>

          {activeTab === 'map' && !isClient ? (
            <div className="map-view-container">
              <div className="map-wrapper">
                <div ref={mapRef} className="mc-map" style={{ width: '100%', height: '100%', minHeight: '400px', background: 'var(--bg)' }} />
                <div className="map-legend">
                  <span><Dot c="var(--teal)" /> Link live</span>
                  <span><Dot c="var(--violet)" /> Kit stocked</span>
                  <span><Dot c={OUTSTANDING} /> Stock outstanding</span>
                  <span><Dot c="var(--faint)" /> No kit</span>
                </div>
                {gpsCount < shownSites.length && (
                  <div className="mc-gps-note">
                    {gpsCount} of {shownSites.length} sites have GPS · the rest appear once GPS is added on the Sites page
                  </div>
                )}
              </div>

              <div className="site-details-panel">
                {selected ? (
                  <div className="site-details-card">
                    <div className="sd-header">
                      <div>
                        <h4>{selected.name}</h4>
                        <span className="mono">
                          Site {selected.siteId}{selected.groups.length ? ` · ${selected.groups.map((g) => GROUPS.find((x) => x.name === g)?.short || g).join(" + ")}` : ""}
                        </span>
                      </div>
                      <button className="sd-close" onClick={() => setSelectedId(null)} aria-label="Close">×</button>
                    </div>
                    <div className="sd-body">
                      <div className="sd-section">
                        <h5>Status</h5>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                          <Dot c={siteState(selected).c} /> {siteState(selected).label}
                          {hasGps(selected) ? (
                            <a className="site-maplink" style={{ marginLeft: "auto" }} target="_blank" rel="noopener noreferrer"
                              href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}>
                              <ExternalLink size={11} /> GPS
                            </a>
                          ) : <span className="faint" style={{ marginLeft: "auto", fontSize: 11 }}>No GPS yet</span>}
                        </div>
                      </div>

                      <div className="sd-section">
                        <h5>Links ({selectedLinks.length})</h5>
                        {selectedLinks.length === 0 ? (
                          <div className="sd-empty">No links at this site.</div>
                        ) : (
                          <div className="sd-links-list">
                            {selectedLinks.map((l) => {
                              const other = l.siteA?.siteId === selected.siteId ? l.siteB : l.siteA;
                              return (
                                <div key={l.linkId} className="sd-link-item">
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <span className="mono font-semibold">{l.linkId}</span>
                                    <span className="pill" style={{ color: linkStatus(l.status).c, border: "1px solid var(--line2)" }}>
                                      {linkStatus(l.status).label}
                                    </span>
                                  </div>
                                  <div className="faint mono" style={{ fontSize: 10, marginTop: 2 }}>
                                    to{" "}
                                    <button className="site-open" style={{ fontSize: 10 }} onClick={() => openSite(other?.siteId)}>
                                      {other?.name || "—"}
                                    </button>
                                    {" "}· {l.band || "—"} · {l.dishSize || "—"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="sd-section">
                        <h5>Site kits ({selected.kits.length})</h5>
                        {selected.kits.length === 0 ? (
                          <div className="sd-empty">No kit filed under this site.</div>
                        ) : (
                          <div className="sd-assets-list">
                            {selected.kits.map((k) => (
                              <div key={k.kitId} className="sd-asset-row">
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span className="text-xs">{k.name}</span>
                                  <span className="faint text-xxs mono">
                                    {k.covered}/{k.lines} lines reserved{k.short ? ` · ${k.short} short in BOQ` : ""}
                                  </span>
                                </div>
                                <span className="mono" style={{ fontSize: 12, color: k.stocked ? "var(--teal)" : OUTSTANDING }}>
                                  {pct(k.covered, k.lines)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="sd-placeholder">
                    <MapPin size={28} className="sd-placeholder-icon" />
                    <h4>Site details</h4>
                    <p>Pick a site on the map, or from this list, to see its links and kit stock.</p>
                    <select className="form-input" style={{ marginTop: 12, maxWidth: 280 }} value=""
                      onChange={(e) => setSelectedId(e.target.value || null)} aria-label="Choose a site">
                      <option value="">Choose a site…</option>
                      {shownSites.map((s) => <option key={s.siteId} value={s.siteId}>{s.siteId} · {s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel-b">
              {!isClient && A.total > 0 && (
                <>
                  <div className="stackbar">
                    {assetSegs.map((s) => (
                      <i key={s.k} style={{ width: `${(s.n / A.total) * 100}%`, background: s.c }} title={`${s.label}: ${s.n}`} />
                    ))}
                  </div>
                  <div className="legend">
                    {assetSegs.map((s) => (
                      <span key={s.k}><Dot c={s.c} />{s.label} <b className="mono" style={{ color: "var(--ink)" }}>{s.n}</b></span>
                    ))}
                  </div>
                  <div style={{ height: 1, background: "var(--line)", margin: "16px 0" }} />
                </>
              )}
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Sites</th>
                      <th>Band</th>
                      <th>Dish</th>
                      {!isClient && <th title="Part lines reserved for the kits at each end">Kit stock (A / B)</th>}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownLinks.map((l) => {
                      const a = siteById.get(l.siteA?.siteId), b = siteById.get(l.siteB?.siteId);
                      const stock = (s) => (!s ? "—" : s.stockPct == null ? "no kit" : `${s.stockPct}%`);
                      return (
                        <tr key={l.linkId}>
                          <td className="mono">{l.linkId}</td>
                          <td style={{ fontSize: 12 }}>
                            {isClient ? (l.siteA?.name || "—") : <button className="site-open" onClick={() => openSite(l.siteA?.siteId)}>{l.siteA?.name || "—"}</button>}
                            <span className="faint"> → </span>
                            {isClient ? (l.siteB?.name || "—") : <button className="site-open" onClick={() => openSite(l.siteB?.siteId)}>{l.siteB?.name || "—"}</button>}
                          </td>
                          <td>{l.band ? <Band b={l.band} /> : "—"}</td>
                          <td className="mono muted" style={{ fontSize: 11 }}>{l.dishSize || "—"}</td>
                          {!isClient && <td className="mono" style={{ fontSize: 11 }}>{stock(a)} / {stock(b)}</td>}
                          <td>
                            <span className="pill" style={{ color: linkStatus(l.status).c }}>
                              <Dot c={linkStatus(l.status).c} />
                              {linkStatus(l.status).label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {shownLinks.length === 0 && (
                      <tr><td colSpan={6} className="faint" style={{ textAlign: "center", padding: 24 }}>No links yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
