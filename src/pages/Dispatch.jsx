import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck, ScanLine, ListChecks, CheckCircle2, FileText, Plus, Minus,
  Cable, ShieldCheck, Package, Boxes, User, Clock, ChevronDown, Loader2, AlertTriangle, ArrowLeft
} from 'lucide-react';
import { TypeIcon, Band } from '../components/ui';
import { LINKS, SITES, TODAY, FLEET_VEHICLES } from '../data/mockData';
import { getSiteKits, getSiteKit, createDispatch, getDispatches, getGatePass, downloadGatePassPDF } from '../services/api';

// Picks a reasonable icon for a consumable line based on its model/name —
// purely cosmetic, has no bearing on the actual decrement logic.
function consumableIcon(label = "") {
  const s = label.toLowerCase();
  if (s.includes("wave") || s.includes("cable") || s.includes("wg")) return Cable;
  if (s.includes("ground") || s.includes("gnd")) return ShieldCheck;
  if (s.includes("tape") || s.includes("wpf")) return Package;
  return Boxes;
}

// A kit's id doesn't reliably tell you its link id verbatim — some kits are
// stored as "KIT-MW01" (no hyphen) and others as "KIT-MW-02" (hyphenated) —
// so this strips the "KIT-" prefix and inserts the hyphen back if it's missing,
// to match the hyphenated link ids ("MW-01") used by the path-profile mock data.
const linkIdFromKitId = (kitId = "") => {
  const raw = kitId.replace(/^KIT-/i, "");
  return raw.includes("-") ? raw : raw.replace(/^([A-Za-z]+)(\d+)$/, "$1-$2");
};

export function Dispatch({ assets, onDispatch }) {
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
  const linkId = selectedKitId ? linkIdFromKitId(selectedKitId) : null;
  // Falls back to a minimal stand-in when the link isn't in the path-profile
  // mock data, so the rest of the page still has something to render against.
  const job = linkId
    ? (LINKS.find(l => l.id === linkId) || { id: linkId, a: null, b: null, band: selectedKitSummary?.band, path: null, dish: null })
    : null;

  const serUnits = linkId
    ? assets.filter(a => a.link === linkId && (a.state === "staged" || a.state === "dispatched"))
    : [];
  const dispatched = serUnits.length > 0 && serUnits.every(a => a.state === "dispatched");

  const [kit, setKit] = useState(null);
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState(null);

  const [verified, setVerified] = useState({});
  const [counts, setCounts] = useState({}); // keyed by componentId
  const [waybill, setWaybill] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [dispatchTime, setDispatchTime] = useState(null);
  const [dispatchError, setDispatchError] = useState(null);
  const [firing, setFiring] = useState(false);
  const [gatePass, setGatePass] = useState(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showWaybillDetails, setShowWaybillDetails] = useState(false);

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

  // If this link was already dispatched in a previous session, the server
  // still knows even after a page refresh wipes local component state —
  // so pick up the most recent dispatch record and show "issued" instead
  // of re-presenting the form (which would just get rejected as
  // out-of-stock anyway).
  useEffect(() => {
    if (!linkId) return;
    let cancelled = false;
    getDispatches({ linkId })
      .then(records => {
        if (cancelled || !records.length) return;
        const latest = records[0]; // API returns newest first
        setWaybill(latest.waybillId);
        setDispatchTime(new Date(latest.dispatchedAt));
        // Also restore the full gate pass so the Download button reappears
        // after a refresh — not just the waybill id/time.
        getGatePass(latest._id)
          .then(gp => { if (!cancelled) setGatePass(gp); })
          .catch(() => { /* non-fatal — download button just stays hidden */ });
      })
      .catch(() => { /* non-fatal — form just stays available */ });
    return () => { cancelled = true; };
  }, [linkId]);

  // Available vehicles: exclude those in maintenance
  const availableVehicles = useMemo(
    () => FLEET_VEHICLES.filter(v => v.status !== 'maintenance'),
    []
  );
  const selectedVehicle = availableVehicles.find(v => v.id === selectedVehicleId) || null;

  // Consumable pick-list is driven straight from the kit's components —
  // the "required" amount doubles as what gets requested from stock.
  const consReq = (kit?.components || [])
    .filter(c => c.type === "Consumable")
    .map(c => ({
      k: c._id,
      t: c.model,
      req: c.qtyRequired,
      unit: c.unit || "ea",
      ico: consumableIcon(c.model),
    }));

  // Serialized (IDU/ODU/DISH) units are matched to a kit component of the
  // same type, so scanning them can decrement that component too.
  const serialComponentForType = (type) =>
    (kit?.components || []).find(c => c.type === type && c.type !== "Consumable");

  const step = (k, d) => setCounts(p => ({ ...p, [k]: Math.max(0, (p[k] || 0) + d) }));
  const verify = (uid) => setVerified(p => ({ ...p, [uid]: true }));

  const serDone = serUnits.length > 0 && serUnits.every(a => dispatched || verified[a.uid]);
  const consDone = consReq.length === 0 || consReq.every(c => (counts[c.k] || 0) >= c.req);
  const serN = serUnits.filter(a => dispatched || verified[a.uid]).length;

  // Anything selected for dispatch — scanned units or counted consumables —
  // is enough to raise a waybill/gate pass for. Full completion of every
  // line is no longer required to enable the button.
  const anySelected = serUnits.some(a => verified[a.uid]) || consReq.some(c => (counts[c.k] || 0) > 0);
  const ready = !!kit && anySelected && !!selectedVehicle && !dispatched;

  const changeKit = () => {
    setSelectedKitId(null);
    setKit(null);
    setKitError(null);
    setVerified({});
    setCounts({});
    setWaybill(null);
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

      // Serialized units: group verified units by type, decrement the
      // matching kit component by that count.
      const byType = {};
      serUnits.forEach(a => {
        if (verified[a.uid]) byType[a.type] = (byType[a.type] || 0) + 1;
      });
      Object.entries(byType).forEach(([type, qty]) => {
        const comp = serialComponentForType(type);
        if (comp) items.push({ componentId: comp._id, qty });
      });

      const { dispatch, kit: updatedKit } = await createDispatch({
        kitId: kit.kitId,
        linkId: job.id,
        items,
        vehicle: {
          id: selectedVehicle.id,
          plate: selectedVehicle.plate,
          make: selectedVehicle.make,
          type: selectedVehicle.type,
        },
        driver: { name: selectedVehicle.driver, phone: selectedVehicle.phone },
      });

      setKit(updatedKit); // reflects the decremented component quantities
      setWaybill(dispatch.waybillId);
      setDispatchTime(new Date(dispatch.dispatchedAt));

      // Fetch full gate pass data
      try {
        const gp = await getGatePass(dispatch._id);
        setGatePass(gp);
      } catch (err) {
        console.error("Failed to fetch gate pass:", err);
        // Non-fatal — dispatch still succeeded
      }

      onDispatch(serUnits.map(a => a.uid));
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
        csv += 'Serial,Type,Model\n';
        (gatePass.assets || []).forEach(a => {
          csv += `"${a.serial}","${a.type}","${a.model}"\n`;
        });
        csv += '\nCONSUMABLES\n';
        csv += 'Type,Model,Qty,Unit\n';
        (gatePass.consumables || []).forEach(c => {
          csv += `"${c.type}","${c.model}",${c.qty},"${c.unit}"\n`;
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

  // ── Step 1: pick which staged kit to dispatch ────────────────
  if (!selectedKitId) {
    return (
      <div>
        <div className="view-head">
          <span className="tagchip">
            <Truck size={11} />
            Step 3 · Dispatch
          </span>
          <h2>Dispatch</h2>
          <p>
            Pick a kit that's staged and ready to go — scan/count its items, assign a vehicle,
            and generate its waybill &amp; gate pass.
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
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              {kits.map(k => (
                <div key={k._id} className="panel">
                  <div className="panel-h">
                    <Boxes size={15} className="ph-ico" />
                    <div>
                      <h3>{k.kitId}</h3>
                      <div className="faint" style={{ fontSize: 11 }}>{k.name}</div>
                    </div>
                    <span className="ph-r" style={{ marginLeft: "auto" }}>
                      <Band b={k.band} />
                    </span>
                  </div>
                  <div className="panel-b">
                    <div style={{ marginBottom: 12, fontSize: 12 }}>
                      <strong>{k.components?.length || 0}</strong> components
                    </div>
                    <button className="btn amber" style={{ width: "100%" }} onClick={() => setSelectedKitId(k.kitId)}>
                      <Truck size={14} />
                      Dispatch this kit
                    </button>
                  </div>
                </div>
              ))}
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
          <h2>Waybill · {gatePass.gatePassNumber}</h2>
          <p>Gate pass for <b>{gatePass.kitId}</b> · {gatePass.linkId || job.id}</p>
        </div>

        <div className="panel" style={{ maxWidth: 760 }}>
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

          <div className="panel-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              padding: "12px 14px",
              background: "rgba(51, 220, 174, 0.04)",
              border: "1px solid rgba(51, 220, 174, 0.18)",
              borderRadius: 10
            }}>
              <div>
                <div className="faint" style={{ fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Vehicle</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                  {gatePass.vehicle?.plate || '—'}
                </div>
                <div className="faint" style={{ fontSize: 10.5, fontFamily: 'var(--mono)' }}>
                  {gatePass.vehicle?.make || ''} {gatePass.vehicle?.type ? `· ${gatePass.vehicle.type}` : ''}
                </div>
              </div>
              <div>
                <div className="faint" style={{ fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Driver</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                  {gatePass.driver?.name || '—'}
                </div>
                <div className="faint" style={{ fontSize: 10.5, fontFamily: 'var(--mono)' }}>
                  {gatePass.driver?.phone || ''}
                </div>
              </div>
              <div>
                <div className="faint" style={{ fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Issued</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                  {gatePass.dispatchedAt ? fmtTime(new Date(gatePass.dispatchedAt)) : (dispatchTime ? fmtTime(dispatchTime) : TODAY)}
                </div>
                <div className="faint" style={{ fontSize: 10.5, fontFamily: 'var(--mono)' }}>
                  {job.a && job.b ? `${SITES[job.a].name} → ${SITES[job.b].name}` : job.id}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {gatePass.assets && gatePass.assets.length > 0 && (
                <div style={{
                  padding: "12px 14px",
                  background: "rgba(255,255,255,.02)",
                  border: "1px solid var(--line)",
                  borderRadius: 10
                }}>
                  <div className="faint" style={{ fontSize: 10, marginBottom: 8, textTransform: "uppercase", fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
                    Assets ({gatePass.assets.length})
                  </div>
                  {gatePass.assets.map((a, i) => (
                    <div key={i} style={{ fontSize: 11, lineHeight: 1.4, color: "var(--ink)", marginBottom: i < gatePass.assets.length - 1 ? 6 : 0 }}>
                      <span style={{ fontWeight: 600 }}>{a.serial}</span>
                      <div className="faint" style={{ fontSize: 10 }}>{a.type} · {a.model}</div>
                    </div>
                  ))}
                </div>
              )}
              {gatePass.consumables && gatePass.consumables.length > 0 && (
                <div style={{
                  padding: "12px 14px",
                  background: "rgba(255,255,255,.02)",
                  border: "1px solid var(--line)",
                  borderRadius: 10
                }}>
                  <div className="faint" style={{ fontSize: 10, marginBottom: 8, textTransform: "uppercase", fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
                    Consumables ({gatePass.consumables.length})
                  </div>
                  {gatePass.consumables.map((c, i) => (
                    <div key={i} style={{ fontSize: 11, lineHeight: 1.4, color: "var(--ink)", marginBottom: i < gatePass.consumables.length - 1 ? 6 : 0 }}>
                      <span style={{ fontWeight: 600 }}>{c.qty} {c.unit}</span>
                      <div className="faint" style={{ fontSize: 10 }}>{c.type} · {c.model}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
          Step 3 · Dynamic BOM Pick-List
        </span>
        <h2>Dispatch · {job.id}</h2>
        {job.a && job.b ? (
          <p>
            Pick-list auto-populated from the path profile for{" "}
            <b>{SITES[job.a].name} → {SITES[job.b].name}</b> ({job.path}) — a long hop,
            so the engineering BOM specifies <b>{job.dish}</b> dishes. High-value units are{" "}
            <b>scanned to verify</b>; consumables are <b>counted to verify</b>.
          </p>
        ) : (
          <p>
            Pick-list for <b>{selectedKitSummary?.name || job.id}</b>. High-value units are{" "}
            <b>scanned to verify</b>; consumables are <b>counted to verify</b>.
          </p>
        )}
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
          <Band b={job.band} />
          <span className="ph-r" style={{ marginLeft: "auto" }}>
            {(dispatched || waybill) ?
              "Gate pass issued" :
              `${serN}/${serUnits.length} scanned · ${consReq.filter(c => (counts[c.k] || 0) >= c.req).length}/${consReq.length} counted`
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
                      <div style={{ fontSize: 12.5 }}>{a.type} · {a.model}</div>
                      <div className="mono faint" style={{ fontSize: 10.5 }}>
                        {a.serial} · End {a.end}
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
                <div className="faint" style={{ fontSize: 11.5 }}>No serialized units staged for this link.</div>
              )}
            </div>

            <div>
              <div className="up faint" style={{ fontSize: 10, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                <ListChecks size={13} /> Count to verify · consumables
              </div>
              {consReq.map(c => {
                const ok = counts[c.k] >= c.req;
                return (
                  <div className={`pickrow ${ok ? "done" : ""}`} key={c.k}>
                    <span className="pi" style={{ color: "var(--steel)" }}>
                      <c.ico size={16} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5 }}>{c.t}</div>
                      <div className="mono faint" style={{ fontSize: 10.5 }}>
                        required {c.req} {c.unit}
                      </div>
                    </div>
                    {dispatched ? (
                      <span className="pill" style={{ color: "var(--teal)" }}>
                        <CheckCircle2 size={13} />
                        {c.req}
                      </span>
                    ) : (
                      <div className="stepper">
                        <button onClick={() => step(c.k, -1)}>
                          <Minus size={13} />
                        </button>
                        <span className="n" style={{ color: ok ? "var(--teal)" : "var(--ink)" }}>
                          {counts[c.k]}
                        </span>
                        <button onClick={() => step(c.k, 1)}>
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
                      onChange={e => setSelectedVehicleId(e.target.value)}
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
                        <option key={v.id} value={v.id}>
                          {v.plate} · {v.make} ({v.type})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', pointerEvents: 'none' }} />
                  </div>
                </div>

                {/* Driver display (auto-populated from selected vehicle) */}
                <div>
                  <label className="faint" style={{ display: 'block', fontSize: 10.5, marginBottom: 5, fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>DRIVER</label>
                  <div style={{
                    padding: '10px 12px',
                    background: 'var(--bg)',
                    border: `1px solid ${selectedVehicle ? 'rgba(51, 220, 174, 0.4)' : 'var(--line2)'}`,
                    borderRadius: 9,
                    fontSize: 12.5,
                    fontFamily: 'var(--mono)',
                    color: selectedVehicle ? 'var(--ink)' : 'var(--faint)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <User size={14} style={{ color: selectedVehicle ? 'var(--teal)' : 'var(--faint)', flexShrink: 0 }} />
                    {selectedVehicle ? (
                      <span>{selectedVehicle.driver} <span style={{ color: 'var(--faint)', fontSize: 10.5 }}>{selectedVehicle.phone}</span></span>
                    ) : (
                      <span>Select a vehicle first</span>
                    )}
                  </div>
                </div>
              </div>
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
                  Gate pass {waybill} generated — View details
                </button>
              ) : (
                <span className="pill" style={{ color: "var(--teal)", fontSize: 12, padding: "6px 12px" }}>
                  <FileText size={14} />
                  Gate pass {waybill || "GP-2207"} generated
                </span>
              )
            ) : (
              <>
                <button className="btn amber" disabled={!ready || firing} onClick={fire}>
                  {firing ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
                  {firing ? "Dispatching…" : "Generate Waybill & Gate Pass"}
                </button>
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {!anySelected
                    ? "Scan a unit or count a consumable to enable."
                    : !selectedVehicle
                      ? "Select a vehicle above to enable."
                      : "Ready to seal manifest."
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
