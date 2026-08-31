import React, { useEffect, useRef, useState } from 'react';
import { 
  Smartphone, RadioTower, Wifi, WifiOff, Signal, MapPin, PenLine, 
  ClipboardList, CheckCircle2, Circle, ScanLine, RefreshCw, Navigation, Activity,
  CloudOff
} from 'lucide-react';
import { TypeIcon, Dot } from '../components/ui';
import { BAND_COLORS } from '../constants/states';
import { LINKS, SITES } from '../data/mockData';
import { api } from '../services/api';
import {
  loadPersistedPod, persistPod, makeSyncId, enqueueSync, getQueuedSyncId,
  pendingCount, flushQueue
} from '../utils/offlineSync';

const JOB_CONSUMABLES = [
  { uid: "cons-wg", type: "Consumable", label: "Flexible Waveguide EW63", model: "WG-FLEX-EW63", serial: "24 meters" },
  { uid: "cons-gnd", type: "Consumable", label: "Heavy Grounding Kit", model: "GND-LUG-35", serial: "2 units" },
  { uid: "cons-tape", type: "Consumable", label: "Weatherproof Tape", model: "WPF-TAPE-19", serial: "6 rolls" },
  { uid: "cons-tie", type: "Consumable", label: "UV Cable Ties", model: "CTIE-UV-300", serial: "4 packs" }
];

export function FieldOps({ assets, pod, setPod, onInstall }) {
  const job = LINKS.find(l => l.id === "MW-04");
  const units = assets.filter(a => a.link === "MW-04");
  const manifestItems = [
    ...units,
    ...JOB_CONSUMABLES
  ];
  const allReceived = manifestItems.length > 0 && manifestItems.every(a => pod.manifest[a.uid]);
  const installed = units.filter(a => a.state === "installed").length;
  const allInstalled = units.length > 0 && installed === units.length;

  const [queuedCount, setQueuedCount] = useState(() => pendingCount(job.id));
  const hydrated = useRef(false);

  // Hydrate from whatever was cached locally last time this handheld
  // touched this job — so a refresh/relaunch while offline doesn't lose
  // manifest checks, the stage-1 signature, etc.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const cached = loadPersistedPod(job.id);
    if (cached) setPod(p => ({ ...p, ...cached }));
  }, [job.id, setPod]);

  // Persist on every change so the cache always reflects what's on screen.
  useEffect(() => {
    persistPod(job.id, pod);
  }, [job.id, pod]);

  const buildSyncPayload = () => {
    const receivedItems = manifestItems
      .filter(a => pod.manifest[a.uid])
      .map(a => ({ type: a.type, model: a.model || a.label, serial: a.serial }));
    const missingItems = manifestItems
      .filter(a => !pod.manifest[a.uid])
      .map(a => ({ type: a.type, model: a.model || a.label, serial: a.serial }));
    const installedItems = units
      .filter(a => a.state === "installed")
      .map(a => ({ type: a.type, model: a.model, serial: a.serial }));

    return {
      receivedItems,
      missingItems,
      installedItems,
      signedBy: pod.stage1.signedBy || 'N/A',
      gps: pod.stage1.gps || 'N/A',
      clientTimestamp: new Date().toISOString(),
    };
  };

  // Push any snapshot(s) queued while offline up to the server. Safe to
  // call repeatedly — each entry is keyed by a stable clientSyncId, so
  // the server upserts instead of duplicating.
  const flushPending = async () => {
    const { succeeded, failed } = await flushQueue((jobId, payload) => api.syncFieldOps(jobId, payload));
    setQueuedCount(pendingCount(job.id));
    if (succeeded > 0) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setPod(p => ({ ...p, synced: timeStr }));
    }
    return { succeeded, failed };
  };

  // Auto-flush the moment the browser regains connectivity — covers the
  // case where the engineer never taps "Reconnect" manually and their
  // device just comes back into signal.
  useEffect(() => {
    const handleOnline = () => {
      setPod(p => ({ ...p, online: true }));
      flushPending();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  const setOnline = (v) => {
    setPod(p => ({ ...p, online: v }));
    if (v) flushPending();
  };

  const doStage1 = () => {
    setPod(p => ({
      ...p,
      stage1: {
        done: true,
        gps: "-1.3192, 36.8421",
        signedBy: "P. Otieno (Rigging Lead)",
        at: "09:14"
      }
    }));
  };

  const sync = async () => {
    const payload = buildSyncPayload();
    // Reuse the clientSyncId from any snapshot already queued for this
    // job, so repeated offline taps update the same pending report
    // instead of creating a new one once it finally reaches the server.
    const clientSyncId = getQueuedSyncId(job.id) || makeSyncId();

    if (!pod.online) {
      enqueueSync(job.id, clientSyncId, payload);
      setQueuedCount(pendingCount(job.id));
      alert("Offline — report cached on this device. It'll sync automatically once you're back online.");
      return;
    }

    try {
      await api.syncFieldOps(job.id, { ...payload, clientSyncId });

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setPod(p => ({ ...p, synced: timeStr }));

      // Notify the user visually
      alert("Sync completed! Central database updated, and administrator notified of site delivery and installation status.");
    } catch (err) {
      console.error("Sync to server failed, queuing for retry:", err);
      enqueueSync(job.id, clientSyncId, payload);
      setQueuedCount(pendingCount(job.id));
      alert("Couldn't reach the platform — report cached and will retry automatically.");
    }
  };

  return (
    <div>
      <div className="view-head">
        <span className="tagchip">
          <Smartphone size={11} />
          Step 4 · Field Module · Offline + Two-Stage PoD
        </span>
        <h2>Field Ops · {job.id}</h2>
        <p>
          Greenfield towers often have no signal. The handheld caches the manifest locally; 
          the crew works offline, then syncs on the way down. Proof of Delivery is two stages: 
          drop-off at the tower base, then serial-scan at install.
        </p>
      </div>

      <div className="phone-wrap">
        <div className="phone">
          <div className="phone-notch">
            <span />
          </div>
          <div className="phone-status">
            <span>{pod.online ? "5G" : "SOS"}</span>
            {pod.online ? <Wifi size={13} /> : <WifiOff size={13} style={{ color: "var(--amber)" }} />}
            <span style={{ marginLeft: "auto" }}>09:{pod.synced ? "47" : "14"}</span>
            <Signal size={13} />
            <span>71%</span>
          </div>
          
          <div className="phone-body">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <RadioTower size={16} style={{ color: BAND_COLORS[job.band] }} />
              <b style={{ fontFamily: "var(--cond)", fontSize: 15 }}>{SITES[job.a].name}</b>
              <span className="pill" style={{ marginLeft: "auto", fontSize: 9, color: BAND_COLORS[job.band] }}>
                {job.band}
              </span>
            </div>
            <div className="faint mono" style={{ fontSize: 10, marginBottom: 6 }}>
              {job.id} · KDJ-402F · 6 units
            </div>

            <div className="offline-banner" style={pod.online
              ? { background: "rgba(51,220,174,.08)", border: "1px solid rgba(51,220,174,.3)", color: "var(--teal)" }
              : { background: "rgba(95,168,255,.1)", border: "1px solid rgba(95,168,255,.32)", color: "var(--amber)" }
            }>
              {pod.online ? <Wifi size={13} /> : <WifiOff size={13} />}
              {pod.online ? "Online — ready to sync" : "Offline — manifest cached locally"}
              <button 
                className="btn sm ghost" 
                style={{ marginLeft: "auto", padding: "3px 8px", fontSize: 10 }} 
                onClick={() => setOnline(!pod.online)}
              >
                {pod.online ? "Go offline" : "Reconnect"}
              </button>
            </div>

            {/* Stage 1 */}
            <div className="field-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="stage-pill" style={{ background: "rgba(95,168,255,.15)", color: "var(--blue)" }}>
                  Stage 1
                </span>
                <h4>Delivery drop-off</h4>
                {pod.stage1.done && <CheckCircle2 size={15} style={{ color: "var(--teal)", marginLeft: "auto" }} />}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--faint)", marginBottom: 8 }} className="mono">
                <MapPin size={11} style={{ verticalAlign: -2 }} /> GPS {pod.stage1.gps || "awaiting fix…"}
              </div>
              <div className={`sig-pad ${pod.stage1.done ? "signed" : ""}`}>
                {pod.stage1.done ? 
                  <span><PenLine size={12} style={{ verticalAlign: -2 }} /> {pod.stage1.signedBy}</span> : 
                  "Tap to capture receiver signature"
                }
              </div>
              {!pod.stage1.done && (
                <button 
                  className="btn sm" 
                  style={{ width: "100%", marginTop: 8, justifyContent: "center" }} 
                  onClick={doStage1}
                >
                  <PenLine size={13} /> Log drop-off + signature
                </button>
              )}
            </div>

            {/* Manifest receive */}
            <div className="field-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ClipboardList size={15} style={{ color: "var(--amber)" }} />
                <h4>Receive at tower base</h4>
                <span className="faint mono" style={{ marginLeft: "auto", fontSize: 10 }}>
                  {manifestItems.filter(a => pod.manifest[a.uid]).length}/{manifestItems.length}
                </span>
              </div>
              {manifestItems.map(a => (
                <button 
                  key={a.uid} 
                  className={`chk ${pod.manifest[a.uid] ? "on" : ""}`} 
                  onClick={() => toggleReceived(a.uid)} 
                  style={{ marginBottom: 6, padding: "8px 10px" }}
                >
                  {pod.manifest[a.uid] ? 
                    <CheckCircle2 size={16} className="cbox" /> : 
                    <Circle size={16} className="cbox" />
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5 }}>
                      {a.type === "Consumable" ? a.label : `${a.type} · End ${a.end}`}
                    </div>
                    <div className="csub">
                      {a.type === "Consumable" ? a.model : a.serial}
                    </div>
                  </div>
                  {a.type === "Consumable" ? (
                    <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>{a.serial}</span>
                  ) : (
                    <TypeIcon t={a.type} size={13} />
                  )}
                </button>
              ))}
            </div>

            {/* Stage 2 */}
            <div className="field-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="stage-pill" style={{ background: "rgba(51,220,174,.15)", color: "var(--teal)" }}>
                  Stage 2
                </span>
                <h4>Scan at install</h4>
                <span className="faint mono" style={{ marginLeft: "auto", fontSize: 10 }}>
                  {installed}/{units.length}
                </span>
              </div>
              {units.map(a => {
                const live = a.state === "installed";
                return (
                  <div 
                    key={a.uid} 
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "7px 0",
                      borderBottom: "1px solid var(--line)"
                    }}
                  >
                    <TypeIcon t={a.type} size={14} style={{ color: live ? "var(--teal)" : "var(--faint)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11.5 }} className="mono">{a.serial}</div>
                    </div>
                    {live ? (
                      <span className="pill" style={{ color: "var(--teal)", fontSize: 9 }}>
                        <CheckCircle2 size={11} />
                        Live
                      </span>
                    ) : (
                      <button 
                        className="btn sm" 
                        style={{ padding: "4px 8px", fontSize: 10 }} 
                        disabled={!pod.manifest[a.uid]} 
                        onClick={() => onInstall(a.uid)}
                      >
                        <ScanLine size={11} />
                        Bolt-in
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button 
              className="btn teal" 
              disabled={!pod.stage1.done && installed === 0} 
              onClick={sync} 
              style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
            >
              {pod.online ? (
                pod.synced ?
                  <><CheckCircle2 size={15} /> Synced {pod.synced}</> :
                  <><RefreshCw size={14} /> Sync to platform</>
              ) : (
                <><CloudOff size={14} /> Cache report (offline)</>
              )}
            </button>
            {queuedCount > 0 && (
              <div className="faint" style={{ fontSize: 10.5, marginTop: 6, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <CloudOff size={11} style={{ color: "var(--amber)" }} />
                {queuedCount} report{queuedCount > 1 ? "s" : ""} cached on this device, waiting to sync
              </div>
            )}
          </div>
        </div>

        {/* side status */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel">
            <div className="panel-h">
              <Navigation size={15} className="ph-ico" />
              <h3>Job status — server view</h3>
              {allInstalled && <span className="ph-r" style={{ color: "var(--teal)" }}>Link LIVE</span>}
            </div>
            <div className="panel-b">
              <div className="kv">
                <span className="muted">Link</span>
                <span className="vv">{job.id} · {SITES[job.a].name} ↔ {SITES[job.b].name}</span>
              </div>
              <div className="kv">
                <span className="muted">Connectivity</span>
                <span className="vv" style={{ color: pod.online ? "var(--teal)" : "var(--amber)" }}>
                  {pod.online ? "Online" : "Offline (cached)"}
                </span>
              </div>
              <div className="kv">
                <span className="muted">Stage 1 — drop-off</span>
                <span className="vv" style={{ color: pod.stage1.done ? "var(--teal)" : "var(--faint)" }}>
                  {pod.stage1.done ? `Signed ${pod.stage1.at}` : "Pending"}
                </span>
              </div>
              <div className="kv">
                <span className="muted">Items received</span>
                <span className="vv">{manifestItems.filter(a => pod.manifest[a.uid]).length}/{manifestItems.length}</span>
              </div>
              <div className="kv">
                <span className="muted">Stage 2 — installed</span>
                <span className="vv" style={{ color: allInstalled ? "var(--teal)" : "var(--ink)" }}>
                  {installed}/{units.length}
                </span>
              </div>
              <div className="kv">
                <span className="muted">Last sync</span>
                <span className="vv">{pod.synced ? `09:${pod.synced.split(":")[1]}` : "— never —"}</span>
              </div>
            </div>
          </div>
          
          <div className="panel">
            <div className="panel-h">
              <Activity size={15} className="ph-ico" />
              <h3>Asset state transitions</h3>
            </div>
            <div className="panel-b">
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
                Bolting a unit in flips its lifecycle state from{" "}
                <b style={{ color: "var(--amber)" }}>Dispatched → Live</b> on the master record. 
                Once all 6 units are live and the handheld syncs, the link is commissioned.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }} className="mono">
                <span className="pill" style={{ color: "var(--amber)" }}>
                  <Dot c="var(--amber)" />
                  Dispatched
                </span>
                <span style={{ color: "var(--faint)" }}>→</span>
                <span className="pill" style={{ color: "var(--teal)" }}>
                  <Dot c="var(--teal)" />
                  Live / Installed
                </span>
              </div>
              {allInstalled && (
                <div className="alert" style={{ 
                  marginTop: 14, 
                  borderColor: "rgba(51,220,174,.3)", 
                  background: "rgba(51,220,174,.06)" 
                }}>
                  <CheckCircle2 size={16} className="ai" style={{ color: "var(--teal)" }} />
                  <div>
                    <div className="at" style={{ color: "var(--teal)" }}>MW-04 commissioned</div>
                    <div className="as">All endpoints live — link added to network.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
