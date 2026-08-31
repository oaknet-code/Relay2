import React, { useState } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { api } from "../../services/api";
import "../../styles/change-password.css";

export function ChangePasswordModal({ onClose }) {
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handlePassChange = (e) => {
    setModalError("");

    setPasswords((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handlePassSubmit = async (e) => {
    e.preventDefault();

    if (passwords.newPassword !== passwords.confirmPassword) {
      setModalError("New passwords do not match");
      return;
    }

    if (passwords.newPassword.length < 6) {
      setModalError("New password must be at least 6 characters");
      return;
    }

    setIsSubmittingPassword(true);
    setModalError("");
    setModalSuccess("");

    try {
      await api.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });

      setModalSuccess("Password changed successfully!");

      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setModalError(
        err.message || "Failed to change password. Check current password.",
      );
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="change-password-overlay">
      <div className="change-password-modal">
        <h3 className="change-password-title">Change Account Password</h3>

        <p className="change-password-description faint">
          Provide current credentials to update password
        </p>

        {modalError && (
          <div className="change-password-message change-password-error">
            <AlertTriangle size={16} />
            <span>{modalError}</span>
          </div>
        )}

        {modalSuccess && (
          <div className="change-password-message change-password-success">
            <ShieldCheck size={16} />
            <span>{modalSuccess}</span>
          </div>
        )}

        <form onSubmit={handlePassSubmit} className="change-password-form">
          <div className="form-group">
            <label htmlFor="currentPassword" className="change-password-label">
              Current Password
            </label>

            <input
              id="currentPassword"
              type="password"
              name="currentPassword"
              required
              value={passwords.currentPassword}
              onChange={handlePassChange}
              className="change-password-input"
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword" className="change-password-label">
              New Password
            </label>

            <input
              id="newPassword"
              type="password"
              name="newPassword"
              required
              value={passwords.newPassword}
              onChange={handlePassChange}
              className="change-password-input"
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="change-password-label">
              Confirm New Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              required
              value={passwords.confirmPassword}
              onChange={handlePassChange}
              className="change-password-input"
              autoComplete="new-password"
            />
          </div>

          <div className="change-password-actions">
            <button
              type="button"
              onClick={onClose}
              className="change-password-button change-password-cancel"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isSubmittingPassword ||
                !passwords.currentPassword ||
                !passwords.newPassword
              }
              className="change-password-button change-password-submit"
            >
              {isSubmittingPassword ? "Saving..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
