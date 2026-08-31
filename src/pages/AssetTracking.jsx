import React, { useState, useMemo } from 'react';
import {
  ClipboardList, CheckCircle2, Circle, AlertTriangle, ChevronDown,
  Package, ShieldCheck, Truck, MapPin, Wrench, FileText, Camera,
  Eye, User, Clock, Antenna
} from 'lucide-react';
import { TypeIcon, Band, StatePill } from '../components/ui';
import {
  SEED_ASSETS, LINKS, SITES, ASSET_CUSTODY_LOG
} from '../data/mockData';

// ─── Stage Pipeline Definition ──────────────────────────────
const STAGES = [
  { key: 'stocked', label: 'Stocked', ico: Package, color: 'var(--steel)' },
  { key: 'staged', label: 'Staged', ico: ShieldCheck, color: 'var(--violet)' },
  { key: 'dispatched', label: 'Dispatched', ico: Truck, color: 'var(--amber)' },
  { key: 'received', label: 'Received', ico: MapPin, color: 'var(--blue)' },
  { key: 'installed', label: 'Installed', ico: CheckCircle2, color: 'var(--teal)' },
];

// ─── Evidence type labels and icons ─────────────────────────
const EVIDENCE_META = {
  grn: { label: 'GRN', ico: FileText, tip: 'Goods Received Note' },
  config: { label: 'Config', ico: ShieldCheck, tip: 'Configuration Verified' },
  gatepass: { label: 'Gate Pass', ico: FileText, tip: 'Gate Pass Issued' },
  pod: { label: 'PoD', ico: FileText, tip: 'Proof of Delivery' },
  photo: { label: 'Photo', ico: Camera, tip: 'Photo Evidence' },
  visual: { label: 'Visual', ico: Eye, tip: 'Visual Inspection' },
};

// ─── Helpers ────────────────────────────────────────────────
const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

// ─── Main Component ─────────────────────────────────────────
export function AssetTracking({ assets }) {
  const [selectedLink, setSelectedLink] = useState('all');
  const [expandedAssets, setExpandedAssets] = useState({});

  // Use live assets from App state (reflects staging/dispatch changes)
  const liveAssets = assets || SEED_ASSETS;

  // Get only assets assigned to links (trackable)
  const trackableAssets = useMemo(() =>
    liveAssets.filter(a => a.link),
    [liveAssets]
  );

  // Group by link
  const linkIds = useMemo(() =>
    [...new Set(trackableAssets.map(a => a.link))].sort(),
    [trackableAssets]
  );

  // Filter by selected link
  const filteredAssets = useMemo(() => {
    if (selectedLink === 'all') return trackableAssets;
    return trackableAssets.filter(a => a.link === selectedLink);
  }, [trackableAssets, selectedLink]);

  // Build custody chain per asset
  const getAssetChain = (serial) => {
    return ASSET_CUSTODY_LOG
      .filter(e => e.assetSerial === serial)
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  };

  // Determine which stages are done/current/pending for an asset
  const getStageStatus = (serial, currentState) => {
    const chain = getAssetChain(serial);
    const completedStages = new Set(chain.map(e => e.stage));

    return STAGES.map((stage, idx) => {
      if (completedStages.has(stage.key)) {
        return { ...stage, status: 'done', entry: chain.find(e => e.stage === stage.key) };
      }
      // current = first pending stage (the asset's next step)
      const prevDone = idx === 0 || STAGES.slice(0, idx).every(s => completedStages.has(s.key));
      if (prevDone && !completedStages.has(stage.key)) {
        // Check if it's actually current (state matches) or truly pending
        const stateToStage = {
          stocked: 'staged',
          staged: 'dispatched',
          dispatched: 'received',
        };
        const isCurrent = stateToStage[currentState] === stage.key ||
          (currentState === stage.key);
        return { ...stage, status: isCurrent ? 'current' : 'pending', entry: null };
      }
      return { ...stage, status: 'pending', entry: null };
    });
  };

  // Pipeline summary counts
  const pipelineCounts = useMemo(() => {
    const counts = {};
    STAGES.forEach(s => { counts[s.key] = 0; });

    filteredAssets.forEach(a => {
      const chain = getAssetChain(a.serial);
      const completed = new Set(chain.map(e => e.stage));
      // Count assets at each stage (highest completed stage)
      let highest = null;
      STAGES.forEach(s => {
        if (completed.has(s.key)) highest = s.key;
      });
      if (highest) counts[highest]++;
      else counts['stocked']++; // fallback
    });

    return counts;
  }, [filteredAssets]);

  // Toggle expand
  const toggleExpand = (uid) => {
    setExpandedAssets(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  // Overall completion for filtered set
  const overallCompletion = useMemo(() => {
    if (filteredAssets.length === 0) return 0;
    const totalStages = filteredAssets.length * STAGES.length;
    let completed = 0;
    filteredAssets.forEach(a => {
      const chain = getAssetChain(a.serial);
      completed += chain.length;
    });
    return Math.round((completed / totalStages) * 100);
  }, [filteredAssets]);

  return (
    <div>
      {/* Header */}
      <div className="view-head">
        <span className="tagchip">
          <ClipboardList size={11} />
          Chain of Custody · Audit Trail
        </span>
        <h2>Asset Tracking</h2>
        <p>
          Track every asset through its lifecycle — from warehouse receipt to site installation.
          Each stage requires <b>documented proof</b> (GRN, config verification, gate pass, proof of delivery, or
          photo evidence) before an asset can advance.
        </p>
      </div>

      {/* Pipeline Overview */}
      <div className="coc-pipeline">
        {STAGES.map(stage => {
          const Ico = stage.ico;
          const count = pipelineCounts[stage.key] || 0;
          return (
            <div key={stage.key} className="coc-stage-header">
              <div className="csh-ico" style={{ borderColor: stage.color, color: stage.color }}>
                <Ico size={16} />
              </div>
              <div className="csh-label" style={{ color: stage.color }}>{stage.label}</div>
              <div className="csh-count" style={{ color: stage.color }}>{count}</div>
              <div className="csh-sub">assets</div>
            </div>
          );
        })}
      </div>

      {/* Overall completion bar */}
      <div className="panel" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            Overall Pipeline Completion
          </span>
          <span className="mono" style={{ fontSize: 12, color: overallCompletion === 100 ? 'var(--teal)' : 'var(--amber)' }}>
            {overallCompletion}%
          </span>
        </div>
        <div className="prog">
          <span style={{
            width: `${overallCompletion}%`,
            background: overallCompletion === 100
              ? 'linear-gradient(90deg, var(--teal2), var(--teal))'
              : 'linear-gradient(90deg, var(--amber2), var(--amber))'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span className="faint mono" style={{ fontSize: 10 }}>
            {filteredAssets.length} assets tracked
          </span>
          <span className="faint mono" style={{ fontSize: 10 }}>
            {filteredAssets.filter(a => {
              const chain = getAssetChain(a.serial);
              return chain.some(e => e.stage === 'installed');
            }).length} fully installed
          </span>
        </div>
      </div>

      {/* Link filter tabs */}
      <div className="coc-link-tabs">
        <button
          className={`coc-link-tab ${selectedLink === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedLink('all')}
        >
          All Links
          <span className="ff-count">{trackableAssets.length}</span>
        </button>
        {linkIds.map(linkId => {
          const link = LINKS.find(l => l.id === linkId);
          const count = trackableAssets.filter(a => a.link === linkId).length;
          const linkColor = link?.status === 'live' ? 'var(--teal)' :
            link?.status === 'staged' ? 'var(--violet)' :
              link?.status === 'dispatched' ? 'var(--amber)' : 'var(--faint)';
          return (
            <button
              key={linkId}
              className={`coc-link-tab ${selectedLink === linkId ? 'active' : ''}`}
              onClick={() => setSelectedLink(linkId)}
            >
              <span className="clt-dot" style={{ background: linkColor }} />
              {linkId}
              {link && (
                <span className="faint" style={{ fontSize: 10, fontWeight: 400 }}>
                  {SITES[link.a]?.name?.split(' ')[0]}→{SITES[link.b]?.name?.split(' ')[0]}
                </span>
              )}
              <span className="ff-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Asset Cards */}
      {filteredAssets.map(asset => {
        const stageStatuses = getStageStatus(asset.serial, asset.state);
        const chain = getAssetChain(asset.serial);
        const completedCount = chain.length;
        const isExpanded = expandedAssets[asset.uid];
        const link = LINKS.find(l => l.id === asset.link);
        const isComplete = stageStatuses.every(s => s.status === 'done');

        return (
          <div key={asset.uid} className="coc-asset-card">
            {/* Card Header */}
            <div className="coc-asset-head" onClick={() => toggleExpand(asset.uid)}>
              <div className="cah-ico">
                <TypeIcon t={asset.type} />
              </div>
              <div className="cah-info">
                <div className="cah-serial">
                  {asset.serial}
                  <Band b={asset.band} />
                </div>
                <div className="cah-meta">
                  {asset.model} · {asset.type} · End {asset.end || '—'} · <span style={{ color: 'var(--amber)' }}>{asset.link}</span>
                </div>
              </div>

              <div className="cah-progress">
                {/* Mini stage dots */}
                <div className="coc-mini-stages">
                  {stageStatuses.map(s => (
                    <div
                      key={s.key}
                      className={`coc-mini-dot ${s.status}`}
                      title={`${s.label}: ${s.status}`}
                    />
                  ))}
                </div>
                <span className="mono faint" style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>
                  {completedCount}/{STAGES.length}
                </span>
                {isComplete ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={16} className={`coc-chevron ${isExpanded ? 'open' : ''}`} />
                )}
              </div>
            </div>

            {/* Expanded Timeline */}
            {isExpanded && (
              <div className="coc-timeline">
                {stageStatuses.map((stage, idx) => {
                  const StageIco = stage.ico;
                  const entry = stage.entry;
                  const evMeta = entry ? EVIDENCE_META[entry.evidence] : null;
                  const EvIco = evMeta?.ico || Circle;

                  return (
                    <div key={stage.key} className={`coc-tl-item ${stage.status}`}>
                      <div className="coc-tl-line">
                        <div className={`coc-tl-dot ${stage.status}`}>
                          {stage.status === 'done' ? (
                            <CheckCircle2 size={14} />
                          ) : stage.status === 'current' ? (
                            <StageIco size={14} />
                          ) : (
                            <Circle size={14} />
                          )}
                        </div>
                      </div>

                      <div className="coc-tl-body">
                        <div className="coc-tl-head">
                          <span className="coc-tl-stage" style={{ color: stage.status === 'pending' ? 'var(--faint)' : stage.color }}>
                            {stage.label}
                          </span>
                          {entry && (
                            <span className="coc-tl-time">
                              {fmtDate(entry.at)} · {fmtTime(entry.at)}
                            </span>
                          )}
                        </div>

                        {entry ? (
                          <div className="coc-tl-detail">
                            <div>
                              <div className="ctd-label">Performed by</div>
                              <div className="ctd-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <User size={12} style={{ color: 'var(--muted)' }} />
                                {entry.by}
                              </div>
                            </div>
                            <div>
                              <div className="ctd-label">Location</div>
                              <div className="ctd-val">{entry.loc}</div>
                            </div>
                            <div>
                              <div className="ctd-label">Evidence</div>
                              <div className="ctd-val">
                                <span className={`coc-evidence ${entry.evidence}`}>
                                  <EvIco size={10} />
                                  {evMeta?.label || entry.evidence} · {entry.evidenceRef}
                                </span>
                              </div>
                            </div>
                            {entry.notes && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <div className="ctd-label">Notes</div>
                                <div className="ctd-val" style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 11 }}>
                                  {entry.notes}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="coc-tl-pending">
                            {stage.status === 'current' ? (
                              <>
                                <Clock size={12} />
                                Awaiting {stage.label.toLowerCase()} — next action required
                              </>
                            ) : (
                              <>
                                <AlertTriangle size={12} />
                                Pending — requires completion of previous stage
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {filteredAssets.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', padding: 32 }}>
          <span className="faint">No tracked assets for this filter.</span>
        </div>
      )}
    </div>
  );
}
