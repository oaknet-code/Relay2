import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Loader2, Lock, Mail, MessageCircle, Save, Settings } from "lucide-react";
import { getNotificationPrefs, saveMyWhatsApp, saveNotificationPrefs } from "../services/api";
import "../styles/driver.css";

// Settings (everyone): your WhatsApp number and which notifications reach
// you where. In-app (the bell) is always on, so nothing is ever lost;
// approvals must also go to email or WhatsApp so they aren't missed.

const errorText = (err, fallback) => err.response?.data?.message || err.message || fallback;

export function SettingsPage() {
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }
  const [phone, setPhone] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneResult, setPhoneResult] = useState(null);

  useEffect(() => {
    getNotificationPrefs()
      .then((res) => { setData(res); setRows(res.categories); setPhone(res.whatsappPhone || ""); })
      .catch((err) => setLoadError(errorText(err, "Couldn't load your settings.")));
  }, []);

  const changed = useMemo(() => data && JSON.stringify(rows.map((r) => [r.email, r.whatsapp])) !== JSON.stringify(data.categories.map((r) => [r.email, r.whatsapp])), [rows, data]);
  const hasWhatsApp = Boolean(data?.whatsappPhone);

  const toggle = (key, channel) => {
    setResult(null);
    setRows((current) => current.map((row) => {
      if (row.key !== key) return row;
      const next = { ...row, [channel]: !row[channel] };
      // Approvals must keep email or WhatsApp on.
      if (row.needsOutside && !next.email && !next.whatsapp) {
        setResult({ ok: false, message: `"${row.label}" must stay on for email or WhatsApp, so approvals aren't missed.` });
        return row;
      }
      return next;
    }));
  };

  const setAll = (channel, value) => {
    setResult(null);
    setRows((current) => current.map((row) => {
      const next = { ...row, [channel]: value };
      return row.needsOutside && !next.email && !next.whatsapp ? row : next;
    }));
  };

  const save = async () => {
    setSaving(true);
    setResult(null);
    try {
      const prefs = Object.fromEntries(rows.map((r) => [r.key, { email: r.email, whatsapp: r.whatsapp }]));
      const res = await saveNotificationPrefs(prefs);
      setData((current) => ({ ...current, categories: rows }));
      setResult({ ok: true, message: res.message || "Saved." });
    } catch (err) {
      setResult({ ok: false, message: errorText(err, "Couldn't save your settings.") });
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async (event) => {
    event.preventDefault();
    setPhoneSaving(true);
    setPhoneResult(null);
    try {
      const res = await saveMyWhatsApp(phone.trim());
      setPhone(res.whatsappPhone);
      setData((current) => ({ ...current, whatsappPhone: res.whatsappPhone }));
      setPhoneResult({ ok: true, message: res.whatsappPhone ? `Saved. WhatsApp messages go to ${res.whatsappPhone}.` : "Removed. You won't get WhatsApp messages." });
    } catch (err) {
      setPhoneResult({ ok: false, message: errorText(err, "Couldn't save the number.") });
    } finally {
      setPhoneSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="view-head">
        <span className="tagchip"><Settings size={11} /> Settings</span>
        <h2>Settings</h2>
        <p>Choose how Relay reaches you. Every notification is always kept in Relay (the bell); turn email and WhatsApp on or off for each kind of notification.</p>
      </div>

      {loadError && <div className="fleet-operation-notice error" role="alert"><AlertTriangle size={14} /> {loadError}</div>}
      {!data && !loadError && <div className="faint"><Loader2 size={14} className="spin" /> Loading…</div>}

      {data && (
        <>
          <section className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-h"><MessageCircle size={15} className="ph-ico" /><h3>Where notifications go</h3></div>
            <div className="panel-b set-contact">
              <div>
                <span className="set-label"><Mail size={12} /> Email</span>
                <b>{data.email}</b>
                <small className="faint">Your work email. Ask a super admin to change it.</small>
              </div>
              <form onSubmit={savePhone}>
                <label className="set-label" htmlFor="set-phone"><MessageCircle size={12} /> WhatsApp number</label>
                <div className="set-phone">
                  <input id="set-phone" className="form-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="+254 712 345 678" maxLength={30}
                    value={phone} onChange={(event) => setPhone(event.target.value)} disabled={phoneSaving} />
                  <button type="submit" className="btn sm amber" disabled={phoneSaving || phone.trim() === (data.whatsappPhone || "")}>
                    {phoneSaving ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Save
                  </button>
                </div>
                {phoneResult
                  ? <small style={{ color: phoneResult.ok ? "var(--teal)" : "var(--red)" }}>{phoneResult.message}</small>
                  : <small className="faint">{hasWhatsApp ? "Approval requests come with Approve and Reject buttons." : "Add your number to get WhatsApp messages."}</small>}
              </form>
            </div>
          </section>

          <section className="panel">
            <div className="panel-h"><Bell size={15} className="ph-ico" /><h3>Notifications</h3></div>
            <div className="panel-b" style={{ padding: 0 }}>
              <div className="set-table" role="table" aria-label="Notification settings">
                <div className="set-row set-head" role="row">
                  <span role="columnheader">Notification</span>
                  <span role="columnheader">In Relay</span>
                  <span role="columnheader">
                    Email
                    <span className="set-all">
                      <button type="button" onClick={() => setAll("email", true)}>All</button>·<button type="button" onClick={() => setAll("email", false)}>None</button>
                    </span>
                  </span>
                  <span role="columnheader">
                    WhatsApp
                    <span className="set-all">
                      <button type="button" onClick={() => setAll("whatsapp", true)}>All</button>·<button type="button" onClick={() => setAll("whatsapp", false)}>None</button>
                    </span>
                  </span>
                </div>
                {rows.map((row) => (
                  <div key={row.key} className="set-row" role="row">
                    <span role="cell" className="set-cat">
                      <b>{row.label}</b>
                      <small className="faint">{row.description}</small>
                      {row.needsOutside && <small className="set-req">Email or WhatsApp must stay on</small>}
                    </span>
                    <span role="cell" data-label="In Relay">
                      <span className="set-switch on locked" title="Always on"><Lock size={10} /></span>
                    </span>
                    <span role="cell" data-label="Email">
                      <button type="button" role="switch" aria-checked={row.email} aria-label={`${row.label} by email`}
                        className={`set-switch ${row.email ? "on" : ""}`} onClick={() => toggle(row.key, "email")} />
                    </span>
                    <span role="cell" data-label="WhatsApp">
                      <button type="button" role="switch" aria-checked={row.whatsapp} aria-label={`${row.label} on WhatsApp`}
                        className={`set-switch ${row.whatsapp ? "on" : ""} ${hasWhatsApp ? "" : "dim"}`} onClick={() => toggle(row.key, "whatsapp")} />
                    </span>
                  </div>
                ))}
              </div>
              {!hasWhatsApp && rows.some((r) => r.whatsapp) && (
                <div className="faint set-note"><AlertTriangle size={12} /> WhatsApp is on for some notifications, but you haven&apos;t added a WhatsApp number yet, so they&apos;ll only arrive in Relay and by email.</div>
              )}
              <div className="set-actions">
                {result && (
                  <span style={{ color: result.ok ? "var(--teal)" : "var(--red)" }}>
                    {result.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {result.message}
                  </span>
                )}
                <button type="button" className="btn amber sm" onClick={save} disabled={saving || !changed}>
                  {saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Save settings
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
