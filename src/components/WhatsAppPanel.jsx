import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageCircle, Save, Send } from "lucide-react";
import { getWhatsAppSettings, saveMyWhatsApp, sendTestWhatsApp } from "../services/api";

// Notifications page: your own WhatsApp number (Relay sends notifications
// and approval requests there). Super admins / the CEO also see whether the
// server's WhatsApp setup works and can send themselves a test message.

const fmt = (value) => (value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");
const errorText = (err, fallback) => err.response?.data?.message || fallback;

export function WhatsAppPanel({ isAdmin = false }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // { ok, message }
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    getWhatsAppSettings()
      .then((result) => { setData(result); setPhone(result.whatsappPhone || ""); })
      .catch((err) => setLoadError(errorText(err, "Couldn't load your WhatsApp settings.")));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaved(null);
    try {
      const result = await saveMyWhatsApp(phone.trim());
      setPhone(result.whatsappPhone);
      setData((current) => ({ ...current, whatsappPhone: result.whatsappPhone }));
      setSaved({ ok: true, message: result.whatsappPhone ? `Saved. Notifications go to ${result.whatsappPhone}.` : "Removed. You'll get notifications in Relay only." });
    } catch (err) {
      setSaved({ ok: false, message: errorText(err, "Couldn't save the number.") });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await sendTestWhatsApp();
      setTestResult({ ok: true, message: result.message });
      setData((current) => ({ ...current, status: result.status }));
    } catch (err) {
      setTestResult({ ok: false, message: errorText(err, "The test message failed.") });
      if (err.response?.data?.status) setData((current) => ({ ...current, status: err.response.data.status }));
    } finally {
      setTesting(false);
    }
  };

  const status = data?.status;
  const failing = status?.lastErrorAt && (!status.lastSuccessAt || new Date(status.lastErrorAt) > new Date(status.lastSuccessAt));
  const changed = data && phone.trim() !== (data.whatsappPhone || "");

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-h">
        <MessageCircle size={15} className="ph-ico" />
        <h3>WhatsApp</h3>
        {isAdmin && status && (
          <span className="ph-r" style={{ marginLeft: "auto", fontSize: 11, color: !status.configured || failing ? "var(--amber)" : "var(--teal)" }}>
            {!status.configured ? "Not set up · in-app only" : failing ? "Failing" : status.webhookReady ? "Set up" : "Sending only · approvals off"}
          </span>
        )}
      </div>
      <div className="panel-b" style={{ display: "grid", gap: 12, fontSize: 12 }}>
        {loadError && <div style={{ color: "var(--red)" }}>{loadError}</div>}
        {!data && !loadError && <div className="faint"><Loader2 size={13} className="spin" /> Loading…</div>}

        {data && (
          <form onSubmit={save} style={{ display: "grid", gap: 8 }}>
            <label htmlFor="wa-phone" style={{ color: "var(--muted)", lineHeight: 1.5 }}>
              Your WhatsApp number. Relay sends your notifications here, and approval requests come with Approve and Reject buttons.
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input id="wa-phone" className="form-input" style={{ maxWidth: 240 }} type="tel" inputMode="tel" autoComplete="tel"
                placeholder="+254 712 345 678" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} disabled={saving} />
              <button type="submit" className="btn sm amber" disabled={saving || !changed}>
                {saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Save
              </button>
            </div>
            {saved && (
              <span style={{ color: saved.ok ? "var(--teal)" : "var(--red)" }}>
                {saved.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {saved.message}
              </span>
            )}
          </form>
        )}

        {isAdmin && status && (
          <div style={{ display: "grid", gap: 8, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
            {!status.configured ? (
              <div style={{ lineHeight: 1.6 }}>
                WhatsApp isn&apos;t set up on the server, so notifications stay in the app (the bell). Set up the Meta WhatsApp Cloud API
                (see <code>.env.example</code> in the backend), add these to the backend&apos;s <code>.env</code> on Hostinger and restart it:
                <pre style={{ margin: "8px 0 0", padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 11, whiteSpace: "pre-wrap" }}>
{`WHATSAPP_TOKEN=EAAG...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_APP_SECRET=...
WHATSAPP_VERIFY_TOKEN=any-long-random-text`}
                </pre>
              </div>
            ) : (
              <div className="faint" style={{ lineHeight: 1.6 }}>
                Sending through the WhatsApp Cloud API (number ID {status.phoneNumberId}) with templates <b>{status.updateTemplate}</b> and <b>{status.approvalTemplate}</b> ({status.language}).
                {status.lastSuccessAt && <> Last message sent {fmt(status.lastSuccessAt)}.</>}
                {!status.webhookReady && <> <span style={{ color: "var(--amber)" }}>Approvals from WhatsApp need WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN.</span></>}
              </div>
            )}
            {failing && (
              <div style={{ color: "var(--amber)", lineHeight: 1.5 }}>
                <AlertTriangle size={13} /> Last problem ({fmt(status.lastErrorAt)}): {status.lastError}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn sm" onClick={test} disabled={testing || !data.whatsappPhone}>
                {testing ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Send me a test message
              </button>
              {!data.whatsappPhone && <span className="faint">Save your number first.</span>}
              {testResult && (
                <span style={{ color: testResult.ok ? "var(--teal)" : "var(--red)" }}>
                  {testResult.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {testResult.message}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
