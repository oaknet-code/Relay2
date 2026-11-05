import { useState, useMemo, useEffect } from 'react';
import {
  Truck, ScanLine, ListChecks, CheckCircle2, FileText, Plus, Minus,
  Cable, ShieldCheck, Package, Boxes, User, ChevronDown, Loader2, AlertTriangle, ArrowLeft
} from 'lucide-react';
import { TypeIcon, Band } from '../components/ui';
import { getSiteKits, getSiteKit, createDispatch, getDispatches, getGatePass, downloadGatePassPDF, getVehicles, getDrivers, getAssets, getLinks, getFleetCompliance } from '../services/api';
import '../styles/custody.css';

// Picks a reasonable icon for a consumable line based on its model/name —
// purely cosmetic, has no bearing on the actual decrement logic.
function consumableIcon(label = "") {
  const s = label.toLowerCase();
  if (s.includes("wave") || s.includes("cable") || s.includes("wg")) return Cable;
  if (s.includes("ground") || s.includes("gnd")) return ShieldCheck;
  if (s.includes("tape") || s.includes("wpf")) return Package;
  return Boxes;
}

// Gate pass lines for the screen: serialized units grouped by what they
// are (with their serial numbers), then counted items.
function gatePassLines(gatePass) {
  const groups = new Map();
  for (const a of gatePass.assets || []) {
    const label = a.description || `${a.type} · ${a.model}`;
    const group = groups.get(label) || { key: `a-${label}`, label, part: a.description ? `${a.type} · ${a.model}` : "", serials: [], unit: "ea" };
    group.serials.push(a.serial);
    groups.set(label, group);
  }
  const units = [...groups.values()].map((g) => ({
    ...g, qty: g.serials.length, sub: [g.part, `S/N ${g.serials.join(", ")}`].filter(Boolean).join("   "),
  }));
  const counted = (gatePass.consumables || []).map((c, i) => ({
    key: `c-${i}`,
    label: c.description || `${c.type} · ${c.model}`,
    sub: c.description ? `${c.type} · ${c.model}` : "",
    qty: c.qty,
    unit: c.unit || "ea",
  }));
  return [...units, ...counted];
}

// Serialized units on the pick-list: the kit's assets that are staged
// (ready to scan) or already dispatched.
const toPickUnit = (a) => ({
  uid: a._id,
  serial: a.serialNumber,
  type: a.assetType,
  model: a.model,
  componentId: a.assignedComponentId,
  band: a.band,
  state: String(a.status).toLowerCase(),
});

export function Dispatch({ canEdit = true, onNavigate }) {
  // ── Kits ready for dispatch (status STAGED) ──────────────────
  const [kits, setKits] = useState([]);
  const [kitsLoading, setKitsLoading] = useState(true);
  const [kitsError, setKitsError] = useState(null);
  const [selectedKitId, setSelectedKitId] = useState(null); // e.g. "KIT-MW-02"

  useEffect(() => {
    let cancelled = false;
    setKitsLoading(true);
    setKitsError(null);
    getSiteKits()
      .then(all => {
        if (cancelled) return;
        // Some legacy records were written with lowercase statuses —
        // compare case-insensitively so they still show up here.
        setKits(all.filter(k => String(k.status).toUpperCase() === "STAGED"));
      })
      .catch(err => { if (!cancelled) setKitsError(err.response?.data?.message || "Couldn't load site kits."); })
      .finally(() => { if (!cancelled) setKitsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selectedKitSummary = kits.find(k => k.kitId === selectedKitId) || null;

  // Links from the database — used to show which hops a kit's site serves.
  const [links, setLinks] = useState([]);
  useEffect(() => {
    getLinks()
      .then(data => setLinks(Array.isArray(data) ? data : []))
      .catch(() => { /* non-fatal: the route line just stays blank */ });
  }, []);

  const [kit, setKit] = useState(null);
  const [kitAssets, setKitAssets] = useState([]);

  // A kit belongs to a site; the links touching that site are its hops.
  const site = kit?.site || selectedKitSummary?.site || null;
  const kitLink = kit?.link || selectedKitSummary?.link || null;
  const siteLinks = site
    ? links.filter(l => l.siteA?.siteId === site.siteId || l.siteB?.siteId === site.siteId)
    : [];
  const routeText = siteLinks.length
    ? siteLinks.map(l => `${l.siteA?.name || '?'} → ${l.siteB?.name || '?'} (${l.linkId})`).join(' · ')
    : null;
  const band = kit?.band || selectedKitSummary?.band || null;

  const serUnits = kitAssets
    .filter(a => a.status === "STAGED" || a.status === "DISPATCHED")
    .map(toPickUnit);
  const dispatched = serUnits.length > 0 && serUnits.every(a => a.state === "dispatched");
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState(null);

  const [verified, setVerified] = useState({});
  const [counts, setCounts] = useState({}); // keyed by componentId
  const [waybill, setWaybill] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [fleetDrivers, setFleetDrivers] = useState([]);

  // Vehicles and drivers come from the Fleet page (database).
  useEffect(() => {
    Promise.all([getVehicles(), getDrivers()])
      .then(([v, d]) => { setFleetVehicles(v); setFleetDrivers(d); })
      .catch(() => { /* non-fatal: the selectors just stay empty */ });
  }, []);
  const [dispatchTime, setDispatchTime] = useState(null);
  const [dispatchError, setDispatchError] = useState(null);
  const [firing, setFiring] = useState(false);
  const [gatePass, setGatePass] = useState(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showWaybillDetails, setShowWaybillDetails] = useState(false);

  const loadKitAssets = (kitObjectId) =>
    getAssets({ kit: kitObjectId })
      .then(data => setKitAssets(Array.isArray(data) ? data : []))
      .catch(err => {
        setKitAssets([]);
        setKitError(err.response?.data?.message || "Couldn't load this kit's serialized assets.");
      });

  useEffect(() => {
    if (kit?._id) loadKitAssets(kit._id);
    else setKitAssets([]);
  }, [kit?._id]);

  useEffect(() => {
    if (!selectedKitId) { setKit(null); return; }
    let cancelled = false;
    setKitLoading(true);
    setKitError(null);
    getSiteKit(selectedKitId)
      .then(data => { if (!cancelled) setKit(data); })
      .catch(err => { if (!cancelled) setKitError(err.response?.data?.message || "Couldn't load this kit."); })
      .finally(() => { if (!cancelled) setKitLoading(false); });
    return () => { cancelled = true; };
  }, [selectedKitId]);

  // If this kit was already dispatched in a previous session, the server
  // still knows even after a page refresh wipes local component state —
  // so pick up the most recent dispatch record and show "issued" instead
  // of re-presenting the form (which would just get rejected as
  // out-of-stock anyway).
  useEffect(() => {
    if (!selectedKitId) return;
    let cancelled = false;
    setWaybill(null);
    setDispatchStatus(null);
    setDispatchTime(null);
    setGatePass(null);
    setDispatchError(null);
    getDispatches({ kitId: selectedKitId })
      .then(records => {
        if (cancelled || !records.length) return;
        const latest = records[0]; // API returns newest first
        if (latest.status === "REJECTED") {
          setDispatchError(`The previous request ${latest.waybillId} was rejected. You can submit a new request.`);
          return;
        }
        setWaybill(latest.waybillId);
        setDispatchStatus(latest.status || "DISPATCHED");
        setDispatchTime(new Date(latest.dispatchedAt || latest.requestedAt || latest.createdAt));
        if (latest.status === "PENDING_APPROVAL") return;
        // Also restore the full gate pass so the Download button reappears
        // after a refresh — not just the waybill id/time.
        getGatePass(latest._id)
          .then(gp => { if (!cancelled) setGatePass(gp); })
          .catch(err => {
            if (!cancelled) setDispatchError(err.response?.data?.message || "Couldn't load the approved gate pass.");
          });
      })
      .catch(err => {
        if (!cancelled) setDispatchError(err.response?.data?.message || "Couldn't check existing dispatch requests.");
      });
    return () => { cancelled = true; };
  }, [selectedKitId]);

  // Available vehicles: exclude those in maintenance
  const availableVehicles = useMemo(
    () => fleetVehicles.filter(v => v.status !== 'maintenance'),
    [fleetVehicles]
  );
  const activeDrivers = useMemo(() => fleetDrivers.filter(d => d.status === 'active'), [fleetDrivers]);
  const selectedVehicle = availableVehicles.find(v => v._id === selectedVehicleId) || null;
  const selectedDriver = activeDrivers.find(d => d._id === selectedDriverId) || null;

  // Expired / soon-expiring / missing documents for the chosen vehicle and
  // driver: a warning (approvers see it too), not a block.
  const [documentIssues, setDocumentIssues] = useState([]);
  useEffect(() => {
    if (!canEdit || (!selectedVehicleId && !selectedDriverId)) { setDocumentIssues([]); return undefined; }
    let cancelled = false;
    getFleetCompliance(selectedVehicleId, selectedDriverId)
      .then((result) => { if (!cancelled) setDocumentIssues(result.issues || []); })
      .catch(() => { if (!cancelled) setDocumentIssues([]); });
    return () => { cancelled = true; };
  }, [canEdit, selectedVehicleId, selectedDriverId]);

  // Picking a vehicle pre-selects its usual driver (or the only driver).
  const chooseVehicle = (id) => {
    setSelectedVehicleId(id);
    const v = availableVehicles.find(x => x._id === id);
    const usual = v?.driver && activeDrivers.find(d => d._id === v.driver._id);
    if (usual) setSelectedDriverId(usual._id);
    else if (!selectedDriverId && activeDrivers.length === 1) setSelectedDriverId(activeDrivers[0]._id);
  };

  // Consumable pick-list comes from the kit's components. What can be sent
  // is the stock reserved for the kit from the inventory list (BOQ) on
  // Site Kits — qtyAvailable — so the count is capped there. "toSend" is
  // what the kit still needs after earlier dispatches.
  const consReq = (kit?.components || [])
    .filter(c => c.sourceType === "consumable")
    .map(c => ({
      k: c._id,
      t: c.model,
      desc: c.description || "",
      type: c.type,
      req: c.qtyRequired,
      sent: c.qtyDispatched || 0,
      toSend: Math.max(0, c.qtyRequired - (c.qtyDispatched || 0)),
      reserved: c.qtyAvailable || 0,
      unit: c.unit || "ea",
      ico: consumableIcon(c.model),
    }));

  // A serialized unit's description comes from the kit component it was
  // assigned to (or the first component of the same type and model).
  const componentDescription = (unit) => {
    const comps = kit?.components || [];
    const comp = comps.find(c => String(c._id) === String(unit.componentId)) ||
      comps.find(c => c.type === unit.type && c.model === unit.model);
    return comp?.description || "";
  };

  // Serialized (IDU/ODU/DISH) units are matched to a kit component of the
  // same type, so scanning them can decrement that component too.
  const step = (k, d, max) => setCounts(p => ({ ...p, [k]: Math.min(max, Math.max(0, (p[k] || 0) + d)) }));
  const countableLines = consReq.filter(c => c.reserved > 0);
  const verify = (uid) => setVerified(p => ({ ...p, [uid]: true }));

  const serN = serUnits.filter(a => dispatched || verified[a.uid]).length;

  // A selected subset is enough to submit a dispatch request.
  const anySelected = serUnits.some(a => verified[a.uid]) || consReq.some(c => (counts[c.k] || 0) > 0);
  const ready = !!kit && anySelected && !!selectedVehicle && !!selectedDriver && !dispatched;

  const changeKit = () => {
    setSelectedKitId(null);
    setKit(null);
    setKitError(null);
    setVerified({});
    setCounts({});
    setWaybill(null);
    setDispatchStatus(null);
    setSelectedVehicleId('');
    setDispatchTime(null);
    setDispatchError(null);
    setGatePass(null);
    setShowDownloadMenu(false);
    setShowWaybillDetails(false);
  };

  const fire = async () => {
    if (!kit) return;
    setDispatchError(null);
    setFiring(true);
    try {
      // Consumables: one line per component, qty = whatever was counted.
      const items = consReq
        .filter(c => (counts[c.k] || 0) > 0)
        .map(c => ({ componentId: c.k, qty: counts[c.k] }));

      // Serialized units: group selected asset IDs by their kit component.
      const byComponent = {};
      serUnits.forEach(a => {
        if (verified[a.uid]) {
          const key = a.componentId || `${a.type}|${a.model}`;
          if (!byComponent[key]) byComponent[key] = { type: a.type, model: a.model, qty: 0, assetIds: [] };
          byComponent[key].qty += 1;
          byComponent[key].assetIds.push(a.uid);
        }
      });
      Object.entries(byComponent).forEach(([componentId, selection]) => {
        const comp = (kit.components || []).find(c =>
          String(c._id) === String(componentId) ||
          (c.type === selection.type && c.model === selection.model && c.sourceType === "serialized")
        );
        if (comp) items.push({ componentId: comp._id, qty: selection.qty, assetIds: selection.assetIds });
      });

      const { dispatch, kit: updatedKit } = await createDispatch({
        kitId: kit.kitId,
        linkId: kitLink?.linkId || null,
        items,
        // The server looks these up in the fleet and copies them onto the gate pass.
        vehicleId: selectedVehicle._id,
        driverId: selectedDriver._id,
      });

      setKit(updatedKit);
      setWaybill(dispatch.waybillId);
      setDispatchStatus(dispatch.status);
      setDispatchTime(new Date(dispatch.requestedAt));
      setGatePass(null);
      setKits((previous) => previous.filter((stagedKit) => stagedKit._id !== updatedKit._id));
    } catch (err) {
      const details = err.response?.data?.details;
      setDispatchError(
        details ? details.join("; ") : (err.response?.data?.message || "Dispatch failed.")
      );
    } finally {
      setFiring(false);
    }
  };

  const fmtTime = (d) => {
    if (!d) return '';
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  };

  const handleDownloadGatePass = async (format) => {
    if (!gatePass) return;
    setDownloadingPDF(true);
    setShowDownloadMenu(false);
    try {
      let blob, filename;

      if (format === 'pdf') {
        blob = await downloadGatePassPDF(gatePass.dispatch);
        filename = `gatepass-${gatePass.gatePassNumber}.pdf`;
      } else if (format === 'json') {
        blob = new Blob([JSON.stringify(gatePass, null, 2)], { type: 'application/json' });
        filename = `gatepass-${gatePass.gatePassNumber}.json`;
      } else if (format === 'csv') {
        // Simple CSV export: header row + asset/consumable rows
        let csv = 'Gate Pass Report\n';
        csv += `Gate Pass Number,${gatePass.gatePassNumber}\n`;
        csv += `Kit ID,${gatePass.kitId}\n`;
        csv += `Link ID,${gatePass.linkId || 'N/A'}\n`;
        csv += `Vehicle,${gatePass.vehicle?.plate || 'N/A'}\n`;
        csv += `Driver,${gatePass.driver?.name || 'N/A'}\n`;
        csv += `Dispatched At,${new Date(gatePass.dispatchedAt).toISOString()}\n`;
        csv += '\nASSETS\n';
        csv += 'Description,Serial,Type,Model\n';
        (gatePass.assets || []).forEach(a => {
          csv += `"${a.description || ''}","${a.serial}","${a.type}","${a.model}"\n`;
        });
        csv += '\nCONSUMABLES\n';
        csv += 'Description,Type,Model,Qty,Unit\n';
        (gatePass.consumables || []).forEach(c => {
          csv += `"${c.description || ''}","${c.type}","${c.model}",${c.qty},"${c.unit}"\n`;
        });
        blob = new Blob([csv], { type: 'text/csv' });
        filename = `gatepass-${gatePass.gatePassNumber}.csv`;
      }

      if (blob && filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setDispatchError(`Failed to download gate pass as ${format.toUpperCase()}`);
      console.error(err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (waybill && dispatchStatus === "PENDING_APPROVAL") {
    return (
      <div>
        <div className="view-head">
          <span className="tagchip"><ShieldCheck size={11} /> Dispatch approval</span>
          <h2>Request submitted</h2>
          <p>Request <b>{waybill}</b> is waiting for sequential approval from the Project Manager and CEO. Inventory and the gate pass remain locked until both approve.</p>
        </div>
        <div className="panel" style={{ padding: 24 }}>
          <div className="faint" style={{ fontSize: 12, marginBottom: 16 }}>
            Submitted {dispatchTime ? fmtTime(dispatchTime) : "—"} · {kit?.kitId || selectedKitId} · {site?.name || "Site"}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn amber" onClick={() => onNavigate?.("tracking")}>View approvals in Asset Tracking</button>
            <button className="btn" onClick={changeKit}>Back to staged kits</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: pick which staged kit to dispatch ────────────────
  if (!selectedKitId) {
    return (
      <div>
        <div className="view-head">
          <span className="tagchip">
            <Truck size={11} />
            Dispatch
          </span>
          <h2>Dispatch</h2>
          <p>
            Pick a staged kit, verify the selected items, assign its vehicle and driver, then submit it for approval.
          </p>
        </div>

        {kitsLoading && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--faint)" }}>
            <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 12 }}>Loading staged kits…</div>
          </div>
        )}

        {!kitsLoading && kitsError && (
          <div style={{
            textAlign: "center", padding: 40, color: "var(--red)",
            background: "rgba(255,90,90,.05)", border: "1px solid rgba(255,90,90,.25)", borderRadius: 14
          }}>
            <AlertTriangle size={24} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 13 }}>{kitsError}</div>
          </div>
        )}

        {!kitsLoading && !kitsError && (
          kits.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: 40, color: "var(--faint)" }}>
              No kits are staged and ready for dispatch yet.
              {onNavigate && (
                <div style={{ marginTop: 14 }}>
                  <button className="btn sm" onClick={() => onNavigate("sites")}>Go to Sites &amp; kits</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              {kits.map(k => {
                const siteName = k.site?.name || k.link?.siteA?.name;
                const hasSite = Boolean(k.site || k.link?.siteA?.siteId);
                return (
                <div key={k._id} className="panel">
                  <div className="panel-h">
                    <Boxes size={15} className="ph-ico" />
                    <div>
                      <h3>{k.kitId}</h3>
                      <div className="faint" style={{ fontSize: 11 }}>{k.name}</div>
                      {siteName && <div className="faint" style={{ fontSize: 10, marginTop: 4 }}>{k.site?.siteId || k.link?.siteA?.siteId} · {siteName}</div>}
                    </div>
                    <span className="ph-r" style={{ marginLeft: "auto" }}>
                      <Band b={k.band} />
                    </span>
                  </div>
                  <div className="panel-b">
                    <div style={{ marginBottom: 12, fontSize: 12 }}>
                      <strong>{k.components?.length || 0}</strong> components
                    </div>
                    <button className="btn amber" style={{ width: "100%" }} disabled={!hasSite} onClick={() => setSelectedKitId(k.kitId)}>
                      <Truck size={14} />
                      {hasSite ? "Dispatch this kit" : "Assign a site before dispatch"}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )
        )}
      </div>
    );
  }

  // ── Waybill details screen ────────────────────────────────────
  if (showWaybillDetails && (waybill || dispatched) && gatePass) {
    return (
      <div>
        <div className="view-head">
          <button
            className="btn sm"
            onClick={() => setShowWaybillDetails(false)}
            style={{ marginBottom: 12 }}
          >
            <ArrowLeft size={13} />
            Back to Dispatch
          </button>
          <span className="tagchip">
            <FileText size={11} />
            Waybill
          </span>
          <h2>Gate pass {gatePass.gatePassNumber}</h2>
        </div>

        <div className="panel" style={{ maxWidth: 720 }}>
          <div className="panel-h">
            <FileText size={15} className="ph-ico" />
            <h3>{gatePass.gatePassNumber}</h3>
            <div className="ph-r" style={{ marginLeft: "auto", position: "relative" }}>
              <button
                className="btn sm teal"
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                disabled={downloadingPDF}
              >
                {downloadingPDF ? (
                  <><Loader2 size={13} className="spin" /> Downloading...</>
                ) : (
                  <><FileText size={13} /> Download ({showDownloadMenu ? '↑' : '↓'})</>
                )}
              </button>
              {showDownloadMenu && !downloadingPDF && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  zIndex: 100,
                  minWidth: 140
                }}>
                  <button
                    onClick={() => handleDownloadGatePass('pdf')}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--ink)",
                      borderBottom: "1px solid var(--line)"
                    }}
                    onMouseOver={(e) => e.target.style.background = "rgba(51, 220, 174, 0.08)"}
                    onMouseOut={(e) => e.target.style.background = "transparent"}
                  >
                    📄 PDF (printable)
                  </button>
                  <button
                    onClick={() => handleDownloadGatePass('csv')}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--ink)",
                      borderBottom: "1px solid var(--line)"
                    }}
                    onMouseOver={(e) => e.target.style.background = "rgba(51, 220, 174, 0.08)"}
                    onMouseOut={(e) => e.target.style.background = "transparent"}
                  >
                    📊 CSV (spreadsheet)
                  </button>
                  <button
                    onClick={() => handleDownloadGatePass('json')}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--ink)"
                    }}
                    onMouseOver={(e) => e.target.style.background = "rgba(51, 220, 174, 0.08)"}
                    onMouseOut={(e) => e.target.style.background = "transparent"}
                  >
                    { } JSON (data)
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="panel-b gp-compact">
            <dl className="gp-details">
              <div><dt>To</dt><dd>{[gatePass.siteId, gatePass.destination || site?.name].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt>Vehicle</dt><dd>{[gatePass.vehicle?.plate, gatePass.vehicle?.make].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt>Link</dt><dd>{gatePass.linkId || "—"}</dd></div>
              <div><dt>Driver</dt><dd>{[gatePass.driver?.name, gatePass.driver?.phone].filter(Boolean).join(" · ") || "—"}</dd></div>
              <div><dt>Kit</dt><dd>{gatePass.kitId || "—"}</dd></div>
              <div><dt>Out</dt><dd>{gatePass.dispatchedAt ? fmtTime(new Date(gatePass.dispatchedAt)) : (dispatchTime ? fmtTime(dispatchTime) : "—")}</dd></div>
              <div><dt>Released by</dt><dd>{gatePass.requestedByName || gatePass.dispatchedBy || "—"}</dd></div>
            </dl>

            <table className="gp-items">
              <thead>
                <tr><th>Description</th><th className="num">Qty</th><th>Unit</th></tr>
              </thead>
              <tbody>
                {gatePassLines(gatePass).map((line) => (
                  <tr key={line.key}>
                    <td>
                      {line.label}
                      {line.sub && <div className="gp-sub">{line.sub}</div>}
                    </td>
                    <td className="num">{line.qty}</td>
                    <td>{line.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="gp-approvals-h">Approvals</div>
            {gatePass.approvalSteps?.length ? (
              <div className="gp-approvals">
                {gatePass.approvalSteps.map((step, i) => (
                  <div key={`${step.role}-${i}`} className={`gp-approval ${step.status || "pending"}`}>
                    <div className="gp-approval-top">
                      <span>Step {i + 1} · {step.role === "project_manager" ? "Project Manager" : step.role === "ceo" ? "CEO" : step.role}</span>
                      <b>{step.status || "pending"}</b>
                    </div>
                    <div className="gp-approval-name">{step.approverName || "—"}</div>
                    <div className="gp-approval-when">{step.decidedAt ? fmtTime(new Date(step.decidedAt)) : "Awaiting decision"}</div>
                    {step.comment && <div className="gp-approval-comment">&ldquo;{step.comment}&rdquo;</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="gp-note">Authorized by {gatePass.authorizedBy || "—"}</div>
            )}
            {gatePass.receivedAt && (
              <div className={`gp-note ${gatePass.receivedCondition === "good" ? "" : "issue"}`}>
                <span>Received</span>
                {gatePass.receivedByName || "—"} · {fmtTime(new Date(gatePass.receivedAt))} · {gatePass.receivedCondition || "—"}
                {gatePass.receiptDiscrepancyDetails && <> · {gatePass.receiptDiscrepancyDetails.split("\n").join("; ")}</>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: scan/count/generate for the selected kit ─────────
  return (
    <div>
      <div className="view-head">
        <button
          className="btn sm"
          onClick={changeKit}
          style={{ marginBottom: 12 }}
        >
          <ArrowLeft size={13} />
          Change kit
        </button>
        <span className="tagchip">
          <Truck size={11} />
          Dynamic BOM Pick-List
        </span>
        <h2>Dispatch · {selectedKitSummary?.name || selectedKitId}</h2>
        <p>
          Pick-list for <b>{selectedKitSummary?.name || selectedKitId}</b>
          {site && <> at site <b>{site.siteId} · {site.name}</b></>}
          {routeText && <> — serving {routeText}</>}. High-value units are{" "}
          <b>scanned to verify</b>; consumables are <b>counted to verify</b>.
        </p>
      </div>

      {kitLoading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--faint)" }}>
          <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 12 }}>Loading kit {selectedKitId}…</div>
        </div>
      )}

      {!kitLoading && kitError && (
        <div style={{
          textAlign: "center", padding: 40, color: "var(--red)",
          background: "rgba(255,90,90,.05)", border: "1px solid rgba(255,90,90,.25)", borderRadius: 14
        }}>
          <AlertTriangle size={24} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 13 }}>{kitError}</div>
        </div>
      )}

      {!kitLoading && !kitError && kit && (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-h">
          <Boxes size={15} className="ph-ico" />
          <h3>{kit.name}</h3>
          {band && <Band b={band} />}
          <span className="ph-r" style={{ marginLeft: "auto" }}>
            {(dispatched || waybill) ?
              "Gate pass issued" :
              `${serN}/${serUnits.length} scanned · ${countableLines.filter(c => (counts[c.k] || 0) >= c.reserved).length}/${countableLines.length} counted`
            }
          </span>
        </div>

        <div className="panel-b">
          <div className="split">
            <div>
              <div className="up faint" style={{ fontSize: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                <ScanLine size={13} /> Scan to verify · serialized
              </div>
              {serUnits.map(a => {
                const v = dispatched || verified[a.uid];
                return (
                  <div className={`pickrow ${v ? "done" : ""}`} key={a.uid}>
                    <span className="pi">
                      <TypeIcon t={a.type} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5 }}>{componentDescription(a) || `${a.type} · ${a.model}`}</div>
                      <div className="mono faint" style={{ fontSize: 10.5 }}>
                        {componentDescription(a) ? `${a.type} · ${a.model} · ` : ""}{a.serial}{a.band ? ` · ${a.band}` : ""}
                      </div>
                    </div>
                    {v ? (
                      <span className="pill" style={{ color: "var(--teal)" }}>
                        <CheckCircle2 size={13} />
                        Verified
                      </span>
                    ) : (
                      <button className="btn sm" onClick={() => verify(a.uid)}>
                        <ScanLine size={13} />
                        Scan
                      </button>
                    )}
                  </div>
                );
              })}
              {serUnits.length === 0 && (
                <div className="faint" style={{ fontSize: 11.5 }}>No serialized units staged for this kit.</div>
              )}
            </div>

            <div>
              <div className="up faint" style={{ fontSize: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                <ListChecks size={13} /> Count to verify · consumables
              </div>
              {consReq.map(c => {
                const ok = c.reserved > 0 && (counts[c.k] || 0) >= c.reserved;
                const unreserved = Math.max(0, c.toSend - c.reserved);
                const blocked = c.reserved === 0;
                return (
                  <div className={`pickrow ${ok ? "done" : ""}`} key={c.k} style={blocked && !dispatched ? { opacity: 0.6 } : undefined}>
                    <span className="pi" style={{ color: "var(--steel)" }}>
                      <c.ico size={16} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5 }}>{c.desc || c.t}</div>
                      <div className="mono faint" style={{ fontSize: 10.5 }}>
                        {c.desc ? `${c.type} · ${c.t} · ` : ""}reserved {c.reserved} of {c.toSend} {c.unit} to send
                        {c.sent > 0 && ` · ${c.sent} sent already`}
                      </div>
                      {!dispatched && (c.toSend === 0 ? (
                        <div style={{ fontSize: 10.5, color: "var(--teal)" }}>All sent</div>
                      ) : blocked ? (
                        <div style={{ fontSize: 10.5, color: "var(--red)" }}>Nothing reserved: reserve stock for this kit on Site Kits</div>
                      ) : unreserved > 0 && (
                        <div style={{ fontSize: 10.5, color: "var(--amber)" }}>{unreserved} {c.unit} not reserved yet</div>
                      ))}
                    </div>
                    {dispatched ? (
                      <span className="pill" style={{ color: "var(--teal)" }}>
                        <CheckCircle2 size={13} />
                        {c.sent || c.req}
                      </span>
                    ) : (
                      <div className="stepper">
                        <button onClick={() => step(c.k, -1, c.reserved)} disabled={blocked}>
                          <Minus size={13} />
                        </button>
                        <span className="n" style={{ color: ok ? "var(--teal)" : "var(--ink)" }}>
                          {counts[c.k] || 0}
                        </span>
                        <button onClick={() => step(c.k, 1, c.reserved)} disabled={blocked || (counts[c.k] || 0) >= c.reserved}>
                          <Plus size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Fleet & Driver Selection ────────────────── */}
          {!(waybill || dispatched) && (
            <div style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--line)"
            }}>
              <div className="up faint" style={{ fontSize: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                <Truck size={13} /> Assign vehicle & driver
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {/* Vehicle selector */}
                <div style={{ position: 'relative' }}>
                  <label className="faint" style={{ display: 'block', fontSize: 10.5, marginBottom: 5, fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>VEHICLE</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={selectedVehicleId}
                      onChange={e => chooseVehicle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 32px 10px 12px',
                        background: 'var(--bg)',
                        border: `1px solid ${selectedVehicle ? 'rgba(51, 220, 174, 0.4)' : 'var(--line2)'}`,
                        borderRadius: 9,
                        color: 'var(--ink)',
                        fontSize: 12.5,
                        fontFamily: 'var(--mono)',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none'
                      }}
                    >
                      <option value="">— Select vehicle —</option>
                      {availableVehicles.map(v => (
                        <option key={v._id} value={v._id}>
                          {v.plate} · {v.make}{v.body ? ` (${v.body})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', pointerEvents: 'none' }} />
                  </div>
                </div>

                {/* Driver (pre-filled from the vehicle's usual driver) */}
                <div style={{ position: 'relative' }}>
                  <label className="faint" style={{ display: 'block', fontSize: 10.5, marginBottom: 5, fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>DRIVER</label>
                  <div style={{ position: 'relative' }}>
                    <User size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: selectedDriver ? 'var(--teal)' : 'var(--faint)', pointerEvents: 'none' }} />
                    <select
                      value={selectedDriverId}
                      onChange={e => setSelectedDriverId(e.target.value)}
                      aria-label="Driver"
                      style={{
                        width: '100%',
                        padding: '10px 32px',
                        background: 'var(--bg)',
                        border: `1px solid ${selectedDriver ? 'rgba(51, 220, 174, 0.4)' : 'var(--line2)'}`,
                        borderRadius: 9,
                        color: 'var(--ink)',
                        fontSize: 12.5,
                        fontFamily: 'var(--mono)',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none'
                      }}
                    >
                      <option value="">— Select driver —</option>
                      {activeDrivers.map(d => (
                        <option key={d._id} value={d._id}>
                          {d.name}{d.phone ? ` · ${d.phone}` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {documentIssues.length > 0 && !waybill && !dispatched && (
            <div role="alert" style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, fontSize: 12, lineHeight: 1.6,
              background: documentIssues.some((i) => i.severity === "expired") ? "rgba(255,95,95,.08)" : "rgba(255,180,70,.08)",
              color: documentIssues.some((i) => i.severity === "expired") ? "var(--red)" : "var(--amber)" }}>
              <b><AlertTriangle size={13} /> Check the documents before this dispatch goes out:</b>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {documentIssues.map((issue) => <li key={issue.text}>{issue.text}</li>)}
              </ul>
              <span className="faint">The approvers will see this too. Update the documents in Fleet → Documents.</span>
            </div>
          )}

          {/* ── Generate / Gate Pass Result ────────────── */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            ...(waybill || dispatched ? {
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--line)"
            } : {})
          }}>
            {(waybill || dispatched) ? (
              gatePass ? (
                <button
                  className="pill"
                  style={{ color: "var(--teal)", fontSize: 12, padding: "6px 12px", cursor: "pointer", border: "1px solid rgba(51,220,174,.35)", background: "rgba(51,220,174,.06)" }}
                  onClick={() => setShowWaybillDetails(true)}
                >
                  <FileText size={14} />
                  Gate pass {waybill} approved — View details
                </button>
              ) : (
                <span className="pill" style={{ color: "var(--teal)", fontSize: 12, padding: "6px 12px" }}>
                  <FileText size={14} />
                  Gate pass {waybill || "GP-2207"} approved
                </span>
              )
            ) : (
              <>
                <button className="btn amber" disabled={!canEdit || !ready || firing} onClick={fire}
                  title={canEdit ? undefined : "View only — a super admin dispatches"}>
                  {firing ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
                  {firing ? "Submitting…" : "Submit for Approval"}
                </button>
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {!canEdit
                    ? "View only — a super admin requests dispatches."
                    : !anySelected
                    ? "Scan a unit or count a consumable to enable."
                    : !selectedVehicle
                      ? "Select a vehicle above to enable."
                      : !selectedDriver
                        ? "Select a driver above to enable."
                        : "Ready to submit for sequential approval."
                  }
                </span>
              </>
            )}
          </div>
          {dispatchError && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 10, fontSize: 12,
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,90,90,.06)", border: "1px solid rgba(255,90,90,.25)", color: "var(--red)"
            }}>
              <AlertTriangle size={14} />
              {dispatchError}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
