import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, Smartphone, KeyRound, Copy, Check, Download, ArrowLeft, Loader2 } from "lucide-react";
import { mfaSetupStart, mfaSetupConfirm, mfaVerify } from "../../services/api";

// Second login step (Google Authenticator), shown after a correct password.
//  stage "setup":  first login — scan QR, confirm a code, save recovery codes.
//  stage "verify": enter the 6-digit code (or a recovery code).
// onDone() once the server has created the real session; onRestart(msg)
// when the step expired / too many wrong codes (back to the password form).
export function MfaStep({ stage, email, onDone, onRestart }) {
  const [setup, setSetup] = useState(null); // { qrDataUrl, secret }
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState(null); // shown once after setup
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const codeRef = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (stage !== "setup" || started.current) return;
    started.current = true; // once, even under React StrictMode
    mfaSetupStart()
      .then(setSetup)
      .catch((err) => (err.restart ? onRestart(err.message) : setError(err.message)));
  }, [stage, onRestart]);

  useEffect(() => { codeRef.current?.focus(); }, [setup, useRecovery]);

  const handleError = (err) => {
    if (err.restart) return onRestart(err.message);
    setError(err.attemptsLeft != null ? `${err.message} (${err.attemptsLeft} tries left)` : err.message);
    setCode("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (stage === "setup") {
        const res = await mfaSetupConfirm(code.trim());
        setRecoveryCodes(res.recoveryCodes); // logged in now; show codes before continuing
      } else {
        const res = await mfaVerify(useRecovery ? { recoveryCode: recoveryInput.trim() } : { code: code.trim() });
        onDone({ recoveryCodesLeft: res.recoveryCodesLeft });
      }
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const recoveryText = () =>
    `Relay recovery codes for ${email}\nEach code works once. Keep them somewhere safe.\n\n${(recoveryCodes || []).join("\n")}\n`;

  const copyCodes = () => {
    navigator.clipboard?.writeText(recoveryText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([recoveryText()], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "relay-recovery-codes.txt" });
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── after setup: recovery codes, shown once ─────────────────────
  if (recoveryCodes) {
    return (
      <div className="mfa">
        <div className="auth-info" role="status">
          <ShieldCheck size={16} />
          <span>Two-factor authentication is on.</span>
        </div>
        <p className="auth-note">
          Save these <b>recovery codes</b>. If you lose your phone, each code lets you log in once. They won't be shown again.
        </p>
        <ul className="mfa-codes" aria-label="Recovery codes">
          {recoveryCodes.map((c) => <li key={c} className="mono">{c}</li>)}
        </ul>
        <div className="mfa-actions">
          <button type="button" className="btn sm ghost" onClick={copyCodes}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="btn sm ghost" onClick={downloadCodes}>
            <Download size={13} /> Download
          </button>
        </div>
        <label className="mfa-check">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          I've saved my recovery codes
        </label>
        <button type="button" className="submit-btn" disabled={!saved} onClick={() => onDone({})}>
          <ShieldCheck size={16} /> Continue to Relay
        </button>
      </div>
    );
  }

  // ── setup: scan + confirm ──────────────────────────────────────
  if (stage === "setup") {
    return (
      <form className="mfa" onSubmit={submit}>
        {error && <div className="auth-error" role="alert"><ShieldCheck size={16} />{error}</div>}
        <ol className="mfa-steps">
          <li><Smartphone size={14} /> Install <b>Google Authenticator</b> on your phone.</li>
          <li>Tap <b>+</b> → <b>Scan a QR code</b>, and scan this:</li>
        </ol>
        <div className="mfa-qr">
          {setup ? <img src={setup.qrDataUrl} alt="QR code for Google Authenticator" width={180} height={180} /> : <Loader2 size={22} className="spin" />}
        </div>
        {setup && (
          <details className="mfa-manual">
            <summary>Can't scan? Enter this key instead</summary>
            <code className="mono">{setup.secret.match(/.{1,4}/g).join(" ")}</code>
          </details>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="mfa-code">3. Enter the 6-digit code it shows</label>
          <input ref={codeRef} id="mfa-code" className="form-input mfa-code-input" inputMode="numeric" autoComplete="one-time-code"
            pattern="\d{6}" maxLength={6} placeholder="123456" value={code}
            onChange={(e) => { setError(""); setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); }} required />
        </div>
        <button type="submit" className="submit-btn" disabled={busy || !setup || code.length !== 6}>
          {busy ? "Checking…" : <><ShieldCheck size={16} /> Turn on 2FA</>}
        </button>
        <button type="button" className="auth-link" onClick={() => onRestart("")}>
          <ArrowLeft size={14} /> Back to log in
        </button>
      </form>
    );
  }

  // ── verify ─────────────────────────────────────────────────────
  return (
    <form className="mfa" onSubmit={submit}>
      {error && <div className="auth-error" role="alert"><ShieldCheck size={16} />{error}</div>}
      {useRecovery ? (
        <div className="form-group">
          <label className="form-label" htmlFor="mfa-recovery">Recovery code</label>
          <input ref={codeRef} id="mfa-recovery" className="form-input mono" autoComplete="off" placeholder="ABCD-EF23"
            maxLength={9} value={recoveryInput} onChange={(e) => { setError(""); setRecoveryInput(e.target.value); }} required />
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label" htmlFor="mfa-code">6-digit code from Google Authenticator</label>
          <input ref={codeRef} id="mfa-code" className="form-input mfa-code-input" inputMode="numeric" autoComplete="one-time-code"
            pattern="\d{6}" maxLength={6} placeholder="123456" value={code}
            onChange={(e) => { setError(""); setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); }} required />
        </div>
      )}
      <button type="submit" className="submit-btn" disabled={busy || (useRecovery ? recoveryInput.trim().length < 8 : code.length !== 6)}>
        {busy ? "Checking…" : <><ShieldCheck size={16} /> Verify</>}
      </button>
      <button type="button" className="auth-link" onClick={() => { setError(""); setUseRecovery((v) => !v); }}>
        <KeyRound size={14} /> {useRecovery ? "Use the authenticator app instead" : "Lost your phone? Use a recovery code"}
      </button>
      <button type="button" className="auth-link" style={{ marginLeft: 16 }} onClick={() => onRestart("")}>
        <ArrowLeft size={14} /> Back
      </button>
    </form>
  );
}
