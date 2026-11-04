import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Radio } from "lucide-react";
import { advanceLinkInstallation } from "../services/api";

// After a dispatch has been received on site, the link's installation is
// stepped by a site engineer: Installing → Installed → Commissioned → Live.
// Installation and works usually take a few days, so each step is recorded
// separately, when it actually happens. Others see the progress only.

const STAGES = [
  ["INSTALLING", "Installing", "Start installation"],
  ["INSTALLED", "Installed", "Mark installed"],
  ["COMMISSIONED", "Commissioned", "Mark commissioned"],
  ["LIVE", "Live", "Turn link on (Live)"],
];
const PRE_INSTALL = ["PLANNED", "KIT_ASSIGNED", "STAGING", "DISPATCHED", "IN_TRANSIT"];
const stageIndex = (status) => STAGES.findIndex(([stage]) => stage === status);
const nextStage = (status) => (PRE_INSTALL.includes(status) ? STAGES[0] : STAGES[stageIndex(status) + 1] || null);
const when = (value) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function LinkInstallationPanel({ link, canAdvance, onChanged }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  if (!link) return null;
  const next = nextStage(link.status);
  const reached = stageIndex(link.status);
  const steps = link.installation?.steps || [];

  const advance = async () => {
    if (!next) return;
    if (next[0] === "LIVE" && !window.confirm(`Turn ${link.linkId} on? This marks the link as Live.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const updated = await advanceLinkInstallation(link.linkId, next[0], note);
      setNote("");
      setMessage({ ok: true, text: `${link.linkId}: ${next[1].toLowerCase()}.${updated.notificationWarning ? ` ${updated.notificationWarning}` : ""}` });
      onChanged?.(updated);
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || "Couldn't record the installation step." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="link-install">
      <div className="up faint" style={{ fontSize: 9 }}><Radio size={12} /> LINK {link.linkId} · INSTALLATION</div>
      <ol className="link-install-steps">
        {STAGES.map(([stage, label]) => {
          const done = reached >= stageIndex(stage);
          const record = [...steps].reverse().find((step) => step.stage === stage);
          return (
            <li key={stage} className={done ? "done" : ""}>
              {done ? <CheckCircle2 size={13} /> : <span className="link-install-dot" />}
              <span>{label}</span>
              {record && <small className="faint">{when(record.at)} · {record.byName}{record.note ? ` · ${record.note}` : ""}</small>}
            </li>
          );
        })}
      </ol>
      {canAdvance && next && (
        <div className="link-install-action">
          <input className="form-input" maxLength={500} placeholder="Note (optional), e.g. alignment done, RSSI −48 dBm" value={note}
            onChange={(event) => setNote(event.target.value)} disabled={busy} />
          <button type="button" className={`btn sm ${next[0] === "LIVE" ? "teal" : "amber"}`} disabled={busy} onClick={advance}>
            {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} {next[2]}
          </button>
        </div>
      )}
      {!next && <div style={{ color: "var(--teal)", fontSize: 11.5 }}>Link is live.</div>}
      {message && (
        <div role={message.ok ? "status" : "alert"} style={{ color: message.ok ? "var(--teal)" : "var(--red)", fontSize: 11.5 }}>
          {message.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {message.text}
        </div>
      )}
    </div>
  );
}
