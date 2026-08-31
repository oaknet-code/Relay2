import React from 'react';
import {
  Antenna, RadioTower, CheckCircle2, Circle, SatelliteDish, MapPin
} from 'lucide-react';
import { TypeIcon, Band, StatePill, Dot } from '../components/ui';
import { STATE_META, LINK_STATUS, BAND_COLORS } from '../constants/states';
import { LINKS, SITES } from '../data/mockData';

export function LinksView({ assets }) {
  const byLink = (id) => assets.filter(a => a.link === id);
  
  const endNode = (link, end) => {
    const us = byLink(link.id).filter(a => a.end === end);
    const get = (t) => us.find(a => a.type === t);
    
    return (
      <div className="node">
        <div className="nn">{SITES[end === "A" ? link.a : link.b].name}</div>
        <div className="nr">
          {(end === "A" ? link.a : link.b)} · {SITES[end === "A" ? link.a : link.b].region}
        </div>
        {["IDU", "ODU", "DISH"].map(t => {
          const u = get(t);
          const live = u && u.state === "installed";
          return (
            <div key={t} className={`row ${live ? "ok" : (u ? "" : "pend")}`}>
              <TypeIcon t={t} size={13} />
              <span style={{ minWidth: 30 }}>{t}</span>
              <span className="faint" style={{ flex: 1, color: u ? "inherit" : "var(--faint)" }}>
                {u ? u.serial : "— not assigned —"}
              </span>
              {live ? <CheckCircle2 size={13} /> : (u ? <Dot c={STATE_META[u.state].c} /> : <Circle size={11} />)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div className="view-head">
        <span className="tagchip">
          <Antenna size={11} />
          Step 1 · Link Identity Mapping
        </span>
        <h2>Microwave Links</h2>
        <p>
          Equipment never lives in a vacuum. Every IDU is paired to its ODU and dish under a single{" "}
          <b>Link ID</b>, with a locked frequency assignment per hop — so a link is only "complete" 
          when both ends are accounted for.
        </p>
      </div>
      
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {LINKS.map(link => (
          <div className="linkcard" key={link.id}>
            <div className="lc-top">
              <RadioTower size={17} style={{ color: BAND_COLORS[link.band] }} />
              <span className="lc-id">{link.id}</span>
              <Band b={link.band} />
              <span className="pill" style={{ marginLeft: "auto", color: LINK_STATUS[link.status].c }}>
                <Dot c={LINK_STATUS[link.status].c} />
                {LINK_STATUS[link.status].label}
              </span>
            </div>
            
            <div className="endpoints">
              {endNode(link, "A")}
              <div className="beam">
                <SatelliteDish size={15} />
                <div className="pulse" />
                <span className="mono" style={{ fontSize: 9, color: "var(--faint)" }}>
                  {link.dish}
                </span>
              </div>
              {endNode(link, "B")}
            </div>
            
            <div style={{ display: "flex", gap: 18, fontSize: 11, color: "var(--faint)" }} className="mono">
              <span>
                <MapPin size={11} style={{ verticalAlign: -2 }} /> {link.path} path
              </span>
              <span>Dish {link.dish}</span>
              <span style={{ marginLeft: "auto", color: link.bomReady ? "var(--teal)" : "var(--red)" }}>
                {link.bomReady ? "BOM ready" : "BOM short"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}