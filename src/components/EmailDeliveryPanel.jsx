import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { getEmailStatus, sendTestEmail } from "../services/api";

// Super admin / CEO: is notification email working? Shows the server's
// SMTP setup (never the password), the last delivery problem, and sends a
// test email to the signed-in person with the real error if it fails.

const fmt = (value) => value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";

export function EmailDeliveryPanel() {
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getEmailStatus().then(setStatus).catch((err) => setLoadError(err.response?.data?.message || "Couldn't check email delivery."));
  }, []);

  const test = async () => {
    setSending(true);
    setResult(null);
    try {
      const data = await sendTestEmail();
      setResult({ ok: true, message: data.message });
      setStatus(data.status);
    } catch (err) {
      setResult({ ok: false, message: err.response?.data?.message || "The test email failed." });
      if (err.response?.data?.status) setStatus(err.response.data.status);
    } finally {
      setSending(false);
    }
  };

  const failing = status && status.lastErrorAt && (!status.lastSuccessAt || new Date(status.lastErrorAt) > new Date(status.lastSuccessAt));

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-h">
        <Mail size={15} className="ph-ico" />
        <h3>Email delivery</h3>
        {status && (
          <span className="ph-r" style={{ marginLeft: "auto", fontSize: 11, color: !status.configured || failing ? "var(--amber)" : "var(--teal)" }}>
            {!status.configured ? "Not set up · in-app only" : failing ? "Failing" : "Set up"}
          </span>
        )}
      </div>
      <div className="panel-b" style={{ display: "grid", gap: 10, fontSize: 12 }}>
        {loadError && <div style={{ color: "var(--red)" }}>{loadError}</div>}
        {!status && !loadError && <div className="faint"><Loader2 size={13} className="spin" /> Checking…</div>}
        {status && !status.configured && (
          <div style={{ lineHeight: 1.6 }}>
            Notifications reach people in the app (the bell) but no emails are sent: email isn&apos;t set up on the server.
            {status.provider === "resend"
              ? <> The Resend key is there, but the sender is missing. Add <code>MAIL_FROM</code> to the backend&apos;s <code>.env</code> and restart it.</>
              : <> To send with Resend, verify <b>oaknetbusiness.com</b> in Resend → Domains, create a key in Resend → API Keys, then add these to the backend&apos;s <code>.env</code> on Hostinger and restart it:</>}
            <pre style={{ margin: "8px 0 0", padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 11, whiteSpace: "pre-wrap" }}>
{`RESEND_API_KEY=re_...
MAIL_FROM="Relay <no-reply@oaknetbusiness.com>"`}
            </pre>
          </div>
        )}
        {status?.configured && (
          <div className="faint" style={{ lineHeight: 1.6 }}>
            Sending via <b>{status.provider === "resend" ? "Resend" : `${status.host}:${status.port}`}</b> as <b>{status.from}</b>.
            {status.lastSuccessAt && <> Last email sent {fmt(status.lastSuccessAt)}.</>}
          </div>
        )}
        {failing && (
          <div style={{ color: "var(--amber)", lineHeight: 1.5 }}>
            <AlertTriangle size={13} /> Last problem ({fmt(status.lastErrorAt)}): {status.lastError}
          </div>
        )}
        {status && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn sm" onClick={test} disabled={sending}>
              {sending ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Send me a test email
            </button>
            {result && (
              <span style={{ color: result.ok ? "var(--teal)" : "var(--red)" }}>
                {result.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {result.message}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
