import { useState, useMemo, useEffect } from 'react';
import {
  ClipboardList, CheckCircle2, Circle, AlertTriangle, ChevronDown,
  Package, ShieldCheck, Truck, MapPin, User, Clock, Loader2, Wrench
} from 'lucide-react';
import { TypeIcon, Band } from '../components/ui';
import { getAssets, getAssetAudit } from '../services/api';

// ─── Stage Pipeline Definition ──────────────────────────────
// Each stage covers one or more Asset.status values from the backend.
const STAGES = [
  { key: 'stocked', label: 'Stocked', ico: Package, color: 'var(--steel)', statuses: ['STOCKED', 'ALLOCATED'] },
  { key: 'staged', label: 'Staged', ico: ShieldCheck, color: 'var(--violet)', statuses: ['STAGING', 'QA_PASSED', 'STAGED'] },
  { key: 'dispatched', label: 'Dispatched', ico: Truck, color: 'var(--amber)', statuses: ['DISPATCHED', 'IN_TRANSIT'] },
  { key: 'received', label: 'Received', ico: MapPin, color: 'var(--blue)', statuses: ['ARRIVED', 'FIELD_INSTALLATION'] },
  { key: 'installed', label: 'Installed', ico: CheckCircle2, color: 'var(--teal)', statuses: ['INSTALLED', 'COMMISSIONED', 'LIVE'] },
];

// Index into STAGES, or -1 for MAINTENANCE / RETIRED (off the pipeline).
const stageIndex = (status) => STAGES.findIndex(s => s.statuses.includes(status));

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

const actionText = (e) => {
  if (e.action === 'STATUS_CHANGE') return `${e.fromStatus || '—'} → ${e.toStatus || '—'}`;
  if (e.action === 'CREATE') return 'Received into stock';
  return e.action.charAt(0) + e.action.slice(1).toLowerCase();
};

// Kit an asset belongs to, for grouping; "none" when it isn't in a kit yet.
const groupOf = (a) => a.kit?.kitId || 'none';

// ─── Main Component ─────────────────────────────────────────
export function AssetTracking({ onNavigate }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [audits, setAudits] = useState({}); // asset _id -> { loading, error, entries }

  useEffect(() => {
    let cancelled = false;
    getAssets()
      .then(data => { if (!cancelled) setAssets(Array.isArray(data) ? data : []); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.message || "Couldn't load assets."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => {
    const m = new Map();
    for (const a of assets) {
      const g = groupOf(a);
      if (!m.has(g)) m.set(g, { id: g, name: a.kit?.name || 'Not in a kit', count: 0 });
      m.get(g).count++;
    }
    return [...m.values()].sort((x, y) => (x.id === 'none') - (y.id === 'none') || x.id.localeCompare(y.id));
  }, [assets]);

  const filtered = useMemo(
    () => selectedGroup === 'all' ? assets : assets.filter(a => groupOf(a) === selectedGroup),
    [assets, selectedGroup]
  );

  const pipelineCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGES.map(s => [s.key, 0]));
    for (const a of filtered) {
      const i = stageIndex(a.status);
      if (i >= 0) counts[STAGES[i].key]++;
    }
    return counts;
  }, [filtered]);

  const offPipeline = filtered.filter(a => stageIndex(a.status) < 0).length;
  const installedCount = filtered.filter(a => stageIndex(a.status) === STAGES.length - 1).length;

  // Share of all pipeline stages reached by the filtered assets.
  const overallCompletion = useMemo(() => {
    const onPipe = filtered.filter(a => stageIndex(a.status) >= 0);
    if (onPipe.length === 0) return 0;
    const reached = onPipe.reduce((n, a) => n + stageIndex(a.status) + 1, 0);
    return Math.round((reached / (onPipe.length * STAGES.length)) * 100);
  }, [filtered]);

  const toggleExpand = (id) => {
    const open = !expanded[id];
    setExpanded(prev => ({ ...prev, [id]: open }));
    if (open && !audits[id]) {
      setAudits(prev => ({ ...prev, [id]: { loading: true } }));
      getAssetAudit(id)
        .then(entries => setAudits(prev => ({ ...prev, [id]: { entries: [...entries].reverse() } })))
        .catch(err => setAudits(prev => ({
          ...prev, [id]: { error: err.response?.data?.message || "Couldn't load the audit trail." }
        })));
    }
  };

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
          Every serialized asset and where it is in its lifecycle — from warehouse receipt to site
          installation — with the recorded history of each change.
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--faint)' }}>
          <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 12 }}>Loading assets…</div>
        </div>
      )}

      {!loading && error && (
        <div className="panel" style={{ textAlign: 'center', padding: 32, color: 'var(--red)' }}>
          <AlertTriangle size={20} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>{error}</div>
        </div>
      )}

      {!loading && !error && assets.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
          <Package size={24} style={{ color: 'var(--faint)', marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No serialized assets yet</div>
          <div className="faint" style={{ fontSize: 12.5 }}>
            Assets appear here once they&apos;re received into stock with a serial number.
          </div>
          {onNavigate && (
            <button className="btn sm" style={{ marginTop: 14 }} onClick={() => onNavigate('inventory')}>
              Go to Inventory
            </button>
          )}
        </div>
      )}

      {!loading && !error && assets.length > 0 && (
        <>
          {/* Pipeline Overview */}
          <div className="coc-pipeline">
            {STAGES.map(stage => {
              const Ico = stage.ico;
              return (
                <div key={stage.key} className="coc-stage-header">
                  <div className="csh-ico" style={{ borderColor: stage.color, color: stage.color }}>
                    <Ico size={16} />
                  </div>
                  <div className="csh-label" style={{ color: stage.color }}>{stage.label}</div>
                  <div className="csh-count" style={{ color: stage.color }}>{pipelineCounts[stage.key]}</div>
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
                {filtered.length} assets tracked{offPipeline ? ` · ${offPipeline} in maintenance/retired` : ''}
              </span>
              <span className="faint mono" style={{ fontSize: 10 }}>
                {installedCount} installed
              </span>
            </div>
          </div>

          {/* Kit filter tabs */}
          <div className="coc-link-tabs">
            <button
              className={`coc-link-tab ${selectedGroup === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedGroup('all')}
            >
              All Assets
              <span className="ff-count">{assets.length}</span>
            </button>
            {groups.map(g => (
              <button
                key={g.id}
                className={`coc-link-tab ${selectedGroup === g.id ? 'active' : ''}`}
                onClick={() => setSelectedGroup(g.id)}
                title={g.name}
              >
                {g.id === 'none' ? 'Not in a kit' : g.id}
                <span className="ff-count">{g.count}</span>
              </button>
            ))}
          </div>

          {/* Asset Cards */}
          {filtered.map(asset => {
            const idx = stageIndex(asset.status);
            const isOpen = !!expanded[asset._id];
            const audit = audits[asset._id];
            const isComplete = idx === STAGES.length - 1;

            return (
              <div key={asset._id} className="coc-asset-card">
                <div className="coc-asset-head" onClick={() => toggleExpand(asset._id)}>
                  <div className="cah-ico">
                    <TypeIcon t={asset.assetType} />
                  </div>
                  <div className="cah-info">
                    <div className="cah-serial">
                      {asset.serialNumber}
                      {asset.band && <Band b={asset.band} />}
                    </div>
                    <div className="cah-meta">
                      {asset.model} · {asset.assetType} · {asset.location}
                      {asset.kit && <> · <span style={{ color: 'var(--amber)' }}>{asset.kit.kitId}</span></>}
                      {asset.link && <> · {asset.link.linkId}</>}
                    </div>
                  </div>

                  <div className="cah-progress">
                    {idx >= 0 ? (
                      <div className="coc-mini-stages">
                        {STAGES.map((s, i) => (
                          <div
                            key={s.key}
                            className={`coc-mini-dot ${i < idx || isComplete ? 'done' : i === idx ? 'current' : 'pending'}`}
                            title={`${s.label}${i <= idx ? '' : ' (pending)'}`}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="pill" style={{ color: 'var(--red)' }}>
                        <Wrench size={12} /> {asset.status.toLowerCase()}
                      </span>
                    )}
                    <span className="mono faint" style={{ fontSize: 11, minWidth: 90, textAlign: 'right' }}>
                      {asset.status}
                    </span>
                    {isComplete ? (
                      <CheckCircle2 size={16} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                    ) : (
                      <ChevronDown size={16} className={`coc-chevron ${isOpen ? 'open' : ''}`} />
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="coc-timeline">
                    {audit?.loading && (
                      <div className="faint" style={{ fontSize: 12 }}>
                        <Loader2 size={12} className="spin" /> Loading history…
                      </div>
                    )}
                    {audit?.error && (
                      <div style={{ fontSize: 12, color: 'var(--red)' }}>{audit.error}</div>
                    )}
                    {audit?.entries && audit.entries.length === 0 && (
                      <div className="coc-tl-pending">
                        <Clock size={12} /> No recorded history for this asset yet.
                      </div>
                    )}
                    {audit?.entries?.map((e, i) => {
                      const last = i === audit.entries.length - 1;
                      return (
                        <div key={e._id} className={`coc-tl-item ${last ? 'current' : 'done'}`}>
                          <div className="coc-tl-line">
                            <div className={`coc-tl-dot ${last ? 'current' : 'done'}`}>
                              {last ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                            </div>
                          </div>
                          <div className="coc-tl-body">
                            <div className="coc-tl-head">
                              <span className="coc-tl-stage" style={{ color: 'var(--ink)' }}>
                                {actionText(e)}
                              </span>
                              <span className="coc-tl-time">
                                {fmtDate(e.createdAt)} · {fmtTime(e.createdAt)}
                              </span>
                            </div>
                            <div className="coc-tl-detail">
                              <div>
                                <div className="ctd-label">Performed by</div>
                                <div className="ctd-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <User size={12} style={{ color: 'var(--muted)' }} />
                                  {e.performedByName || 'System'}
                                </div>
                              </div>
                              {e.notes && (
                                <div style={{ gridColumn: '2 / -1' }}>
                                  <div className="ctd-label">Notes</div>
                                  <div className="ctd-val" style={{ color: 'var(--muted)', fontSize: 11 }}>
                                    {e.notes}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
