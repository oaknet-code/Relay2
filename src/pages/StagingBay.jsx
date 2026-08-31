import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, Circle, ArrowRight, Lock, Cpu, Signal, Navigation, Activity } from 'lucide-react';
import { TypeIcon, Band } from '../components/ui';

const CHECK_DEFS = [
  { key: "firmware", label: "Firmware updated", sub: "Image v9.4.2 flashed + verified", ico: Cpu },
  { key: "frequency", label: "Frequency pre-set", sub: "Tx/Rx channel plan loaded", ico: Signal },
  { key: "ip", label: "IP address configured", sub: "Mgmt + radio interface", ico: Navigation },
  { key: "bench", label: "Back-to-back bench test passed", sub: "BER + Rx level within spec", ico: Activity },
];

export function StagingBay({ assets, setAssets }) {
  const queue = assets.filter(a => a.checks && a.state === "stocked");
  const promoted = assets.filter(a => a.checks && a.state !== "stocked");

  const toggle = (uid, key) => {
    setAssets(prev => prev.map(a => 
      a.uid === uid 
        ? { ...a, checks: { ...a.checks, [key]: !a.checks[key] } }
        : a
    ));
  };

  const promote = (uid) => {
    setAssets(prev => prev.map(a => 
      a.uid === uid 
        ? { ...a, state: "staged", loc: "Staging Bay 01 · READY", cfg: a.cfg || 3 }
        : a
    ));
  };

  const allDone = (c) => CHECK_DEFS.every(d => c[d.key]);

  return (
    <div>
      <div className="view-head">
        <span className="tagchip">
          <ShieldCheck size={11} />
          Step 2 · Pre-Staging & Configuration Gates
        </span>
        <h2>Staging Bay</h2>
        <p>
          Microwave units cannot ship raw. Every gate below must pass before an asset transitions 
          from <b>Stocked → Staged</b> — shipping the wrong frequency to a tower risks regulatory 
          violation and a wasted crew climb.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {queue.map(a => {
          const done = allDone(a.checks);
          const n = CHECK_DEFS.filter(d => a.checks[d.key]).length;
          
          return (
            <div className="panel" key={a.uid}>
              <div className="panel-h">
                <span style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--panel3)",
                  color: "var(--amber)"
                }}>
                  <TypeIcon t={a.type} />
                </span>
                <div>
                  <h3 style={{ lineHeight: 1.1 }}>{a.serial}</h3>
                  <div className="faint mono" style={{ fontSize: 10 }}>
                    {a.model} · End {a.end} · {a.link}
                  </div>
                </div>
                <span className="ph-r" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Band b={a.band} />
                </span>
              </div>
              
              <div className="panel-b">
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  marginBottom: 11 
                }}>
                  <span className="faint" style={{ fontSize: 11 }}>
                    {n}/{CHECK_DEFS.length} gates passed
                  </span>
                  <div style={{ flex: 1, maxWidth: 140, marginLeft: 12 }}>
                    <div className="prog">
                      <span style={{ width: `${n / 4 * 100}%` }} />
                    </div>
                  </div>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {CHECK_DEFS.map(d => (
                    <button 
                      key={d.key} 
                      className={`chk ${a.checks[d.key] ? "on" : ""}`} 
                      onClick={() => toggle(a.uid, d.key)}
                    >
                      {a.checks[d.key] ? 
                        <CheckCircle2 size={18} className="cbox" /> : 
                        <Circle size={18} className="cbox" />
                      }
                      <div style={{ flex: 1 }}>
                        <div className="ctxt">{d.label}</div>
                        <div className="csub">{d.sub}</div>
                      </div>
                      <d.ico size={15} style={{ color: "var(--faint)" }} />
                    </button>
                  ))}
                </div>
                
                <button 
                  className={`btn ${done ? "teal" : ""}`} 
                  disabled={!done} 
                  onClick={() => promote(a.uid)} 
                  style={{ width: "100%", marginTop: 13, justifyContent: "center" }}
                >
                  {done ? 
                    <><ArrowRight size={15} /> Promote to Staged for Site</> : 
                    <><Lock size={14} /> Pass all gates to release</>
                  }
                </button>
              </div>
            </div>
          );
        })}
        
        {queue.length === 0 && (
          <div className="panel">
            <div className="panel-b faint" style={{ textAlign: "center", padding: 28 }}>
              Staging queue clear — all units released. ✓
            </div>
          </div>
        )}
      </div>

      {promoted.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-h">
            <CheckCircle2 size={15} style={{ color: "var(--teal)" }} />
            <h3>Released this session</h3>
          </div>
          <div className="panel-b">
            {promoted.map(a => (
              <div 
                key={a.uid} 
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 0",
                  borderBottom: "1px solid var(--line)"
                }}
              >
                <CheckCircle2 size={15} style={{ color: "var(--teal)" }} />
                <span className="mono" style={{ fontSize: 12 }}>{a.serial}</span>
                <span className="muted" style={{ fontSize: 12 }}>{a.model}</span>
                <span style={{ marginLeft: "auto" }}>
                  <span className="pill" style={{ color: "var(--teal)" }}>Staged</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}