import React, { useState, useEffect } from 'react';
import {
  Antenna, RadioTower, CheckCircle2, Circle, SatelliteDish, MapPin
} from 'lucide-react';
import { TypeIcon, Band, Dot } from '../components/ui';
import { STATE_META, LINK_STATUS, BAND_COLORS } from '../constants/states';
import { getLinks, getAssets } from '../services/api';

export function LinksView() {
  const [links, setLinks] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [linksData, assetsData] = await Promise.all([
          getLinks(),
          getAssets()
        ]);
        setLinks(linksData);
        setAssets(assetsData);
      } catch (err) {
        console.error("Failed to load links/assets:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const byLink = (linkId) => assets.filter(a => a.link && a.link._id === linkId);

  const endNode = (link, end) => {
    const site = end === "A" ? link.siteA : link.siteB;
    const us = byLink(link._id);
    const get = (t) => us.find(a => a.assetType === t);

    return (
      <div className="node">
        <div className="nn">{site?.name || "Unknown Site"}</div>
        <div className="nr">
          {site?.siteId || "—"} · {site?.region || "—"}
        </div>
        {["IDU", "ODU", "DISH"].map(t => {
          const u = get(t);
          const live = u && u.status === "INSTALLED";
          return (
            <div key={t} className={`row ${live ? "ok" : (u ? "" : "pend")}`}>
              <TypeIcon t={t} size={13} />
              <span style={{ minWidth: 30 }}>{t}</span>
              <span className="faint" style={{ flex: 1, color: u ? "inherit" : "var(--faint)" }}>
                {u ? u.serialNumber : "— not assigned —"}
              </span>
              {live ? <CheckCircle2 size={13} /> : (u ? <Dot c={STATE_META[u.status?.toLowerCase?.() || "stocked"].c} /> : <Circle size={11} />)}
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
        {links.map(link => {
          const statusMeta = LINK_STATUS[link.status] || { label: link.status, c: "var(--faint)" };
          return (
            <div className="linkcard" key={link._id}>
              <div className="lc-top">
                <RadioTower size={17} style={{ color: BAND_COLORS[link.band] || "var(--faint)" }} />
                <span className="lc-id">{link.linkId}</span>
                {link.band && <Band b={link.band} />}
                <span className="pill" style={{ marginLeft: "auto", color: statusMeta.c }}>
                  <Dot c={statusMeta.c} />
                  {statusMeta.label}
                </span>
              </div>

              <div className="endpoints">
                {endNode(link, "A")}
                <div className="beam">
                  <SatelliteDish size={15} />
                  <div className="pulse" />
                  <span className="mono" style={{ fontSize: 9, color: "var(--faint)" }}>
                    {link.dishSize || "—"}
                  </span>
                </div>
                {endNode(link, "B")}
              </div>

              <div style={{ display: "flex", gap: 18, fontSize: 11, color: "var(--faint)" }} className="mono">
                <span>
                  <MapPin size={11} style={{ verticalAlign: -2 }} /> {link.pathLengthKm || "—"} km
                </span>
                <span>Dish {link.dishSize || "—"}</span>
                <span style={{ marginLeft: "auto", color: link.status === "KIT_ASSIGNED" ? "var(--teal)" : "var(--red)" }}>
                  {link.status === "KIT_ASSIGNED" ? "Kit assigned" : "Awaiting kit"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}