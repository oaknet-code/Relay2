import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Gauge, PackageCheck, TrendingDown, Clock, Boxes, Layers,
  CheckCircle2, AlertTriangle, MapPin, List
} from 'lucide-react';
import { Ring, StatePill, Band, Dot } from '../components/ui';
import { STATE_META, LINK_STATUS } from '../constants/states';
import { LINKS, CONSUMABLES, SITES } from '../data/mockData';

const cStatus = (c) => c.qty <= 0 ? "out" : (c.qty < c.reorder ? "low" : "ok");

const SITE_COORDS = {
  "NBO-HUB": [-1.2921, 36.8219],
  "RVS-TWR": [-1.2655, 36.8082],
  "NGG-RDG": [-1.3615, 36.6566],
  "MGD-RLY": [-1.9012, 36.2872],
  "SMT-N": [-0.4201, 36.9510],
  "SMT-S": [-0.4350, 36.9600],
  "CST-GW": [-4.0435, 39.6682],
  "ISL-ND": [-4.0505, 39.6730]
};

export function MissionControl({ assets }) {
  const [activeTab, setActiveTab] = useState('map'); // 'map' or 'bom'
  const [selectedSite, setSelectedSite] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const counts = useMemo(() => {
    const c = {};
    assets.forEach(a => { c[a.state] = (c[a.state] || 0) + 1; });
    return c;
  }, [assets]);

  const total = assets.length;
  const completeLinks = LINKS.filter(l => l.bomReady).length;
  const completePct = Math.round(completeLinks / LINKS.length * 100);
  const shrink = assets.filter(a => a.state === "dispatched" && (a.daysOut || 0) > 14);
  const cfgVals = assets.filter(a => a.cfg).map(a => a.cfg);
  const avgCfg = cfgVals.length ? (cfgVals.reduce((x, y) => x + y, 0) / cfgVals.length) : 0;

  const order = ["in_transit", "stocked", "staged", "dispatched", "installed", "maintenance", "quarantine", "retired"];
  const segs = order.filter(k => counts[k]).map(k => ({ k, n: counts[k], c: STATE_META[k].c }));

  const lowStock = CONSUMABLES.filter(c => cStatus(c) !== "ok");
  const ledger = [
    { t: "08:42", a: "Gate pass GP-2207 voided — re-pick", who: "j.okoth" },
    { t: "08:19", a: "AT-1303 → Quarantine (PoST fail)", who: "qc.bay" },
    { t: "07:55", a: "AT-1504 firmware v9.4.2 verified", who: "eng.staging" },
    { t: "07:31", a: "MW-04 manifest dispatched · KDJ-402F", who: "warehouse" },
    { t: "06:58", a: "GRN-8841 received vs PO-4471 (1 short)", who: "stores" }
  ];

  const selectedSiteDetails = useMemo(() => {
    if (!selectedSite) return null;
    const site = SITES[selectedSite];
    if (!site) return null;

    const siteLinks = LINKS.filter(l => l.a === selectedSite || l.b === selectedSite);

    const siteAssets = assets.filter(a => {
      if (a.loc && a.loc.toLowerCase().includes(site.name.toLowerCase())) {
        return true;
      }
      if (a.link) {
        const linkObj = LINKS.find(l => l.id === a.link);
        if (linkObj && (linkObj.a === selectedSite || linkObj.b === selectedSite)) {
          return true;
        }
      }
      return false;
    });

    const iduCount = siteAssets.filter(a => a.type === 'IDU').length;
    const oduCount = siteAssets.filter(a => a.type === 'ODU').length;
    const dishCount = siteAssets.filter(a => a.type === 'DISH').length;

    return {
      code: selectedSite,
      ...site,
      links: siteLinks,
      assets: siteAssets,
      stats: { idus: iduCount, odus: oduCount, dishes: dishCount }
    };
  }, [selectedSite, assets]);

  useEffect(() => {
    if (activeTab !== 'map' || !mapRef.current) return;
    const L = window.L;
    if (!L) return;

    // Initialize Leaflet map if not yet done
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: [-2.1, 38.0], // Centered to fit Mount Kenya down to Mombasa
        zoom: 7,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // CartoDB Dark Matter tile layer for premium dark aesthetic
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers and polylines
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // Draw link lines
    LINKS.forEach(link => {
      const from = SITE_COORDS[link.a];
      const to = SITE_COORDS[link.b];
      if (!from || !to) return;

      const color = LINK_STATUS[link.status]?.c || 'var(--muted)';
      const isLive = link.status === 'live';

      // Map color string to actual hex code
      const hexColor = color.startsWith('var(') 
        ? (color.includes('teal') ? '#33dcae' : (color.includes('blue') ? '#5fa8ff' : '#ff5f5f')) 
        : color;

      L.polyline([from, to], {
        color: hexColor,
        weight: isLive ? 3 : 1.5,
        dashArray: isLive ? null : '4, 4',
        opacity: 0.8
      }).addTo(map);
    });

    // Draw site markers
    Object.entries(SITES).forEach(([code, site]) => {
      const coord = SITE_COORDS[code];
      if (!coord) return;

      const isSelected = selectedSite === code;
      const siteLinks = LINKS.filter(l => l.a === code || l.b === code);
      const hasLive = siteLinks.some(l => l.status === 'live');
      const hasStaging = siteLinks.some(l => l.status === 'staging' || l.status === 'staged');
      const hexColor = hasLive ? '#33dcae' : (hasStaging ? '#5fa8ff' : '#ff5f5f');

      const marker = L.circleMarker(coord, {
        radius: isSelected ? 9 : 6.5,
        fillColor: hexColor,
        color: isSelected ? '#ffffff' : '#080b10',
        weight: isSelected ? 2 : 1.5,
        opacity: 1,
        fillOpacity: 0.9,
        className: `interactive-marker ${isSelected ? 'selected' : ''}`
      }).addTo(map);

      // Add permanent code label tooltip
      marker.bindTooltip(code, {
        permanent: true,
        direction: 'top',
        className: `map-tooltip ${isSelected ? 'selected' : ''}`,
        offset: [0, -8]
      });

      marker.on('click', () => {
        setSelectedSite(code);
      });
    });

    // Cleanup when activeTab toggles away
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeTab, selectedSite, assets]);

  return (
    <div>
      <div className="view-head">
        <span className="tagchip">
          <Gauge size={11} />
          Step 6 · Project Success Metrics
        </span>
        <h2>Mission Control</h2>
        <p>
          Live rollout health across all microwave links — completeness, custody risk, 
          and configuration throughput in one console.
        </p>
      </div>

      <div className="kpi-row">
        <div className="kpi" style={{ "--gl": "rgba(51,220,174,.10)" }}>
          <div className="k-top">
            <PackageCheck size={14} />
            Link Completeness Rate
          </div>
          <div className="k-val">
            {completePct}
            <span style={{ fontSize: 18, color: "var(--faint)" }}>%</span>
          </div>
          <div className="k-sub">
            {completeLinks} of {LINKS.length} links · full BOM in region
          </div>
          <div className="k-ring">
            <Ring pct={completePct} c="var(--teal)" />
          </div>
        </div>

        <div className="kpi" style={{ "--gl": "rgba(255,95,95,.10)" }}>
          <div className="k-top">
            <TrendingDown size={14} />
            Shrinkage / Loss Risk
          </div>
          <div className="k-val" style={{ color: shrink.length ? "var(--red)" : "var(--teal)" }}>
            {shrink.length}
          </div>
          <div className="k-sub">
            serialized units · dispatched &gt; 14 days, not installed
          </div>
          <div className="k-ring">
            <Ring pct={total ? shrink.length / total * 100 * 4 : 0} c="var(--red)" />
          </div>
        </div>

        <div className="kpi" style={{ "--gl": "rgba(95,168,255,.10)" }}>
          <div className="k-top">
            <Clock size={14} />
            Avg Configuration Time
          </div>
          <div className="k-val">
            {avgCfg.toFixed(1)}
            <span style={{ fontSize: 16, color: "var(--faint)" }}> d</span>
          </div>
          <div className="k-sub">
            days in staging before passing QC gates
          </div>
          <div className="spark k-ring" style={{ width: 84 }}>
            {[2, 3, 4, 2, 5, 3, 3, 4].map((v, i) => 
              <i key={i} style={{ height: `${v / 5 * 100}%` }} />
            )}
          </div>
        </div>

        <div className="kpi" style={{ "--gl": "rgba(173,139,255,.10)" }}>
          <div className="k-top">
            <Boxes size={14} />
            Serialized Assets Tracked
          </div>
          <div className="k-val">{total}</div>
          <div className="k-sub">
            {counts.installed || 0} live · {counts.staged || 0} staged · {counts.dispatched || 0} in transit
          </div>
          <div className="k-ring">
            <Ring pct={(counts.installed || 0) / total * 100} c="var(--violet)" />
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", marginTop: 16 }}>
        <div className="panel">
          <div className="panel-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={15} className="ph-ico" />
              <h3>{activeTab === 'map' ? 'Kenya Operations Map' : 'Asset Lifecycle Distribution'}</h3>
            </div>
            <div className="tab-buttons">
              <button 
                className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
                onClick={() => setActiveTab('map')}
              >
                <MapPin size={12} style={{ marginRight: 4 }} /> Map
              </button>
              <button 
                className={`tab-btn ${activeTab === 'bom' ? 'active' : ''}`}
                onClick={() => setActiveTab('bom')}
              >
                <List size={12} style={{ marginRight: 4 }} /> BOM List
              </button>
            </div>
          </div>
          
          {activeTab === 'map' ? (
            <div className="map-view-container">
              <div className="map-wrapper">
                <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '400px', background: 'var(--bg)' }} />
                
                <div className="map-legend">
                  <span><Dot c="var(--teal)" /> Active</span>
                  <span><Dot c="var(--blue)" /> Staging</span>
                  <span><Dot c="var(--red)" /> Short</span>
                </div>
              </div>

              <div className="site-details-panel">
                {selectedSiteDetails ? (
                  <div className="site-details-card">
                    <div className="sd-header">
                      <div>
                        <h4>{selectedSiteDetails.name}</h4>
                        <span className="mono">{selectedSiteDetails.code} · {selectedSiteDetails.region}</span>
                      </div>
                      <button className="sd-close" onClick={() => setSelectedSite(null)}>×</button>
                    </div>
                    <div className="sd-body">
                      <div className="sd-section">
                        <h5>Connected Microwave Links</h5>
                        {selectedSiteDetails.links.length === 0 ? (
                          <div className="sd-empty">No links configured at this site.</div>
                        ) : (
                          <div className="sd-links-list">
                            {selectedSiteDetails.links.map(l => (
                              <div key={l.id} className="sd-link-item">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span className="mono font-semibold">{l.id}</span>
                                  <span className="pill" style={{ color: LINK_STATUS[l.status].c, background: `${LINK_STATUS[l.status].c}1a`, border: `1px solid ${LINK_STATUS[l.status].c}33` }}>
                                    {LINK_STATUS[l.status].label}
                                  </span>
                                </div>
                                <div className="faint mono" style={{ fontSize: 10, marginTop: 2 }}>
                                  {l.path} · {l.band} ({l.dish})
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="sd-section">
                        <h5>Site Inventory Summary</h5>
                        <div className="sd-inv-grid">
                          <div className="sd-inv-item">
                            <span className="sd-inv-val">{selectedSiteDetails.stats.idus}</span>
                            <span className="sd-inv-lbl">IDUs</span>
                          </div>
                          <div className="sd-inv-item">
                            <span className="sd-inv-val">{selectedSiteDetails.stats.odus}</span>
                            <span className="sd-inv-lbl">ODUs</span>
                          </div>
                          <div className="sd-inv-item">
                            <span className="sd-inv-val">{selectedSiteDetails.stats.dishes}</span>
                            <span className="sd-inv-lbl">Dishes</span>
                          </div>
                        </div>
                      </div>

                      <div className="sd-section">
                        <h5>Hardware Tracked</h5>
                        {selectedSiteDetails.assets.length === 0 ? (
                          <div className="sd-empty">No serialized hardware found.</div>
                        ) : (
                          <div className="sd-assets-list">
                            {selectedSiteDetails.assets.slice(0, 3).map(a => (
                              <div key={a.serial} className="sd-asset-row">
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span className="mono text-xs">{a.serial}</span>
                                  <span className="faint text-xxs">{a.model}</span>
                                </div>
                                <StatePill s={a.state} />
                              </div>
                            ))}
                            {selectedSiteDetails.assets.length > 3 && (
                              <div className="sd-more faint text-xxs">
                                + {selectedSiteDetails.assets.length - 3} more assets at this location
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="sd-placeholder">
                    <MapPin size={28} className="sd-placeholder-icon" />
                    <h4>Interactive Site Ops</h4>
                    <p>Select any site node on the map of Kenya to view active link connectivity, inventory checklists, and tracked serialized hardware.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel-b">
              <div className="stackbar">
                {segs.map(s => 
                  <i 
                    key={s.k} 
                    style={{ width: `${s.n / total * 100}%`, background: s.c }} 
                    title={`${STATE_META[s.k].label}: ${s.n}`} 
                  />
                )}
              </div>
              <div className="legend">
                {segs.map(s => 
                  <span key={s.k}>
                    <Dot c={s.c} />
                    {STATE_META[s.k].label} 
                    <b className="mono" style={{ color: "var(--ink)" }}>{s.n}</b>
                  </span>
                )}
              </div>
              <div style={{ height: 1, background: "var(--line)", margin: "16px 0" }} />
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Link</th>
                    <th>Path</th>
                    <th>Band</th>
                    <th>BOM</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {LINKS.map(l => (
                    <tr key={l.id}>
                      <td className="mono">
                        {l.id}
                        <div className="faint" style={{ fontSize: 10 }}>
                          {l.a.split("-")[0]}→{l.b.split("-")[0]}
                        </div>
                      </td>
                      <td className="mono muted">{l.path}</td>
                      <td><Band b={l.band} /></td>
                      <td>
                        {l.bomReady ? (
                          <span className="pill" style={{ color: "var(--teal)" }}>
                            <CheckCircle2 size={12} />
                            100%
                          </span>
                        ) : (
                          <span className="pill" style={{ color: "var(--red)" }}>
                            <AlertTriangle size={12} />
                            Short
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="pill" style={{ color: LINK_STATUS[l.status].c }}>
                          <Dot c={LINK_STATUS[l.status].c} />
                          {LINK_STATUS[l.status].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-h">
            <AlertTriangle size={15} className="ph-ico" />
            <h3>Alerts</h3>
            <span className="ph-r" style={{ color: lowStock.length ? "var(--red)" : "var(--teal)" }}>
              {lowStock.length} active
            </span>
          </div>
          <div className="panel-b">
            {lowStock.map(c => (
              <div key={c.sku} className="alert">
                <div className="ai" style={{ color: c.qty <= 0 ? "var(--red)" : "var(--amber)" }}>
                  {c.qty <= 0 ? <AlertTriangle size={15} /> : <Clock size={15} />}
                </div>
                <div>
                  <div className="at">
                    {c.qty <= 0 ? "Out of stock" : "Low stock"}: {c.name}
                  </div>
                  <div className="as">
                    {c.qty} {c.unit} remaining · reorder at {c.reorder}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="panel-h" style={{ borderTop: "1px solid var(--line)", marginTop: 16 }}>
            <Clock size={15} className="ph-ico" />
            <h3>Activity Log</h3>
          </div>
          <div className="panel-b ledger">
            {ledger.map((e, i) => (
              <div className="lr" key={i}>
                <span className="lt">{e.t}</span>
                <span style={{ flex: 1 }}>{e.a}</span>
                <span className="lt" style={{ color: "var(--teal2)" }}>@{e.who}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}