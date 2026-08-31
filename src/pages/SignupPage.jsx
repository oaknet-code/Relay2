import React, { useState } from "react";
import { 
  RadioTower, Eye, EyeOff, ArrowRight, ShieldCheck
} from "lucide-react";
import { api } from "../services/api";
import { getAccessLevel } from "../utils/access";

export function LoginPage({ onLoginSuccess }) {
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
      const response = await api.login({
        email: formData.email,
        password: formData.password
      });

      const loggedInUser = {
        ...response.user,
        username: response.user?.first_name || response.user?.email,
        displayName: response.user?.first_name || response.user?.email,
        accessLevel: getAccessLevel(response.user)
      };

      onLoginSuccess?.(loggedInUser);
    } catch (err) {
      setError(err.message || "Login failed. Check your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = formData.email && formData.password;

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
            <p className="signup-subtitle">
              Log in with your email and company-provided password.
            </p>
          </div>

          {error && (
            <div className="auth-error">
              <ShieldCheck size={16} />
              {error}
            </div>
          )}

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
          </form>
        </div>
      </div>
    </div>
  );
}

export function SignupPage({ onSignupSuccess }) {
  return <LoginPage onLoginSuccess={onSignupSuccess} />;
}
