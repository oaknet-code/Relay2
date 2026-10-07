import React, { useState } from "react";
import {
  RadioTower, Eye, EyeOff, ArrowRight, ShieldCheck, ArrowLeft, MailCheck, CheckCircle2
} from "lucide-react";
import { api, requestPasswordReset, resetPassword } from "../services/api";
import { PasswordRules } from "../components/ui/PasswordRules";
import { isPasswordValid, passwordProblem, PASSWORD_MAX_LENGTH } from "../utils/passwordPolicy";

// resetToken: from an emailed "Reset password" link (App reads it from the
// URL hash). Opens the set-new-password form instead of the login form.
export function LoginPage({ onLoginSuccess, resetToken = null, onResetDone }) {
  const [mode, setMode] = useState(resetToken ? "reset" : "login"); // login | forgot | forgot-sent | reset | reset-done
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [info, setInfo] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setError("");
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // The server sets the session token as an HttpOnly cookie — it's
      // never in this response body, so there's nothing here to read or
      // trust for identity. Fetch the authenticated profile instead: it's
      // derived server-side from the cookie via the `protect` middleware,
      // not from anything the client supplied.
      await api.login({
        email: formData.email,
        password: formData.password
      });

      const { user } = await api.getMe();

      onLoginSuccess?.(user);
    } catch (err) {
      setError(err.message || "Login failed. Check your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = formData.email && formData.password;

  const goToLogin = () => {
    setMode("login");
    setError("");
    setInfo("");
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const res = await requestPasswordReset(forgotEmail.trim());
      setInfo(res.message);
      setMode("forgot-sent");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    const problem = passwordProblem(newPassword);
    if (problem) return setError(problem);
    if (newPassword !== confirmPassword) return setError("The two passwords don't match.");
    setIsSubmitting(true);
    try {
      const res = await resetPassword(resetToken, newPassword);
      setInfo(res.message);
      setNewPassword("");
      setConfirmPassword("");
      setMode("reset-done");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtitle = {
    login: "Log in with your email and company-provided password.",
    forgot: "Enter your account email and we'll send you a link to reset your password.",
    "forgot-sent": "Check your email.",
    reset: "Choose a new password for your account.",
    "reset-done": "Password updated.",
  }[mode];

  return (
    <div className="relay">
      <div className="signup-container">
        <div className="signup-card">
          <div className="signup-header">
            <div className="signup-brand">
              <div className="signup-brand-badge">
                <RadioTower size={24} />
              </div>
              <div>
                <h1 className="signup-title">RELAY</h1>
                <div className="signup-subtitle">MW Rollout Operations</div>
              </div>
            </div>
            <p className="signup-subtitle">{subtitle}</p>
          </div>

          {error && (
            <div className="auth-error">
              <ShieldCheck size={16} />
              {error}
            </div>
          )}

          {info && (mode === "forgot-sent" || mode === "reset-done") && (
            <div className="auth-info" role="status">
              {mode === "forgot-sent" ? <MailCheck size={16} /> : <CheckCircle2 size={16} />}
              <span>{info}</span>
            </div>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot}>
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">Company Email</label>
                <input id="forgot-email" type="email" className="form-input" placeholder="name@company.com"
                  value={forgotEmail} onChange={(e) => { setError(""); setForgotEmail(e.target.value); }}
                  required autoFocus autoComplete="email" maxLength={254} />
              </div>
              <button type="submit" className="submit-btn" disabled={!forgotEmail || isSubmitting}>
                {isSubmitting ? "Sending…" : <><MailCheck size={16} /> Send reset link</>}
              </button>
              <button type="button" className="auth-link" onClick={goToLogin}>
                <ArrowLeft size={14} /> Back to log in
              </button>
            </form>
          )}

          {mode === "forgot-sent" && (
            <div>
              <p className="auth-note">
                Didn't get it? Check your spam folder, make sure you used the email your account was created with,
                or ask your administrator.
              </p>
              <button type="button" className="auth-link" onClick={goToLogin}>
                <ArrowLeft size={14} /> Back to log in
              </button>
            </div>
          )}

          {mode === "reset" && (
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-new">New Password</label>
                <div className="password-wrapper">
                  <input id="reset-new" type={showPassword ? "text" : "password"} className="form-input"
                    value={newPassword} onChange={(e) => { setError(""); setNewPassword(e.target.value); }}
                    required autoFocus autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH}
                    aria-describedby="reset-rules" />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PasswordRules password={newPassword} id="reset-rules" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-confirm">Confirm New Password</label>
                <input id="reset-confirm" type={showPassword ? "text" : "password"} className="form-input"
                  value={confirmPassword} onChange={(e) => { setError(""); setConfirmPassword(e.target.value); }}
                  required autoComplete="new-password" maxLength={PASSWORD_MAX_LENGTH} />
              </div>
              <button type="submit" className="submit-btn"
                disabled={!isPasswordValid(newPassword) || !confirmPassword || isSubmitting}>
                {isSubmitting ? "Saving…" : <><CheckCircle2 size={16} /> Set new password</>}
              </button>
              <button type="button" className="auth-link" onClick={() => { goToLogin(); onResetDone?.(); }}>
                <ArrowLeft size={14} /> Back to log in
              </button>
            </form>
          )}

          {mode === "reset-done" && (
            <button type="button" className="submit-btn" onClick={() => { goToLogin(); onResetDone?.(); }}>
              <ArrowRight size={16} /> Go to log in
            </button>
          )}

          {mode === "login" && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Company Email</label>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Company Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="form-input"
                  placeholder="Enter the password provided to you"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="submit-btn" 
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <>Signing In...</>
              ) : (
                <>
                  <ArrowRight size={16} /> Access Platform
                </>
              )}
            </button>
            <button type="button" className="auth-link" onClick={() => { setError(""); setForgotEmail(formData.email); setMode("forgot"); }}>
              Forgot password?
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function SignupPage({ onSignupSuccess }) {
  return <LoginPage onLoginSuccess={onSignupSuccess} />;
}
