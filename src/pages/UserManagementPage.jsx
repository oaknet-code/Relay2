import React, { useState, useEffect } from "react";
import {
  Building2,
  ShieldCheck,
  Power,
  Loader,
  AlertTriangle,
  Plus,
  X,
  Search,
  Copy,
  Check,
  KeyRound,
} from "lucide-react";
import { listUsers, createUser, setUserStatus } from "../services/api";

const ROLE_LABELS = {
  client: "Client",
  field_worker: "Site Worker",
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function UserManagementPage() {
  const [view, setView] = useState("list"); // list, create
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [formData, setFormData] = useState({ username: "", email: "", company: "", role: "client" });
  const [createdAccount, setCreatedAccount] = useState(null); // { username, email, role, temporaryPassword }
  const [copied, setCopied] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setListError("");
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setListError(err.message || "Failed to load accounts.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChange = (e) => {
    setFormError("");
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const resetForm = () => {
    setFormData({ username: "", email: "", company: "", role: "client" });
    setCreatedAccount(null);
    setCopied(false);
  };

  const startCreate = () => {
    setFormError("");
    setActionError("");
    resetForm();
    setView("create");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    try {
      const result = await createUser(formData);
      setCreatedAccount({
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
        temporaryPassword: result.temporaryPassword,
      });
      await loadUsers();
    } catch (err) {
      setFormError(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    if (!createdAccount) return;
    navigator.clipboard?.writeText(createdAccount.temporaryPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === "active" ? "suspended" : "active";
    const verb = nextStatus === "suspended" ? "Suspend" : "Reactivate";
    if (!window.confirm(`${verb} login access for "${user.username}"?`)) return;

    setBusyId(user.id);
    setActionError("");
    try {
      const updated = await setUserStatus(user.id, nextStatus);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    } catch (err) {
      setActionError(err.message || "Failed to update account status.");
    } finally {
      setBusyId(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const q = searchTerm.toLowerCase();
    return (
      user.username.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.company || "").toLowerCase().includes(q)
    );
  });

  // CREATE VIEW
  if (view === "create") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>
              {createdAccount ? "Account Created" : "Create Account"}
            </h1>
            <p className="faint" style={{ fontSize: "13px", margin: "4px 0 0" }}>
              {createdAccount
                ? "Share the password below with them securely — it won't be shown again."
                : "Give a client or site worker a login with role-appropriate access."}
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setView("list"); }}
            style={{
              background: "transparent", border: "1px solid var(--line2)", color: "var(--muted)",
              padding: "8px 12px", borderRadius: "8px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <X size={16} /> {createdAccount ? "Done" : "Cancel"}
          </button>
        </div>

        <div style={{
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "12px",
          padding: "28px", maxWidth: "600px",
        }}>
          {createdAccount ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{
                padding: "12px", background: "rgba(51, 220, 174, 0.1)", border: "1px solid rgba(51, 220, 174, 0.3)",
                borderRadius: "8px", color: "var(--teal)", fontSize: "13px", display: "flex", gap: "8px", alignItems: "center",
              }}>
                <ShieldCheck size={16} />
                <span>
                  {ROLE_LABELS[createdAccount.role] || createdAccount.role} account created for{" "}
                  <b>{createdAccount.username}</b> ({createdAccount.email})
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                  Temporary Password
                </label>
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 12px", background: "var(--bg)", border: "1px solid var(--line2)", borderRadius: "9px",
                }}>
                  <KeyRound size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: "var(--mono)", fontSize: "13.5px", letterSpacing: "0.03em" }}>
                    {createdAccount.temporaryPassword}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="btn sm"
                    style={{ flexShrink: 0 }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
                  This password is shown once and is not stored anywhere retrievable — if it's lost, you'll need to reset it separately.
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: 8 }}>
                <button className="btn amber" style={{ flex: 1 }} onClick={() => { resetForm(); setView("create"); }}>
                  <Plus size={15} /> Create Another
                </button>
                <button className="btn" onClick={() => { resetForm(); setView("list"); }}>
                  Back to List
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {formError && (
                <div style={{
                  padding: "12px", background: "rgba(255, 95, 95, 0.1)", border: "1px solid rgba(255, 95, 95, 0.3)",
                  borderRadius: "8px", color: "var(--red)", fontSize: "13px", display: "flex", gap: "8px", alignItems: "flex-start",
                }}>
                  <AlertTriangle size={16} style={{ marginTop: 1 }} />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                  Account Type *
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {["client", "field_worker"].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, role }))}
                      className="btn sm"
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        background: formData.role === role ? "rgba(255, 176, 32, 0.15)" : "transparent",
                        border: `1px solid ${formData.role === role ? "var(--amber)" : "var(--line2)"}`,
                        color: formData.role === role ? "var(--amber)" : "var(--muted)",
                      }}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  name="username"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="contact@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              {formData.role === "client" && (
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    className="form-input"
                    placeholder="e.g. Oaknet Business"
                    value={formData.company}
                    onChange={handleChange}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.username || !formData.email}
                  className="btn amber"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {isSubmitting ? <Loader size={14} className="spin" /> : <Plus size={15} />}
                  {isSubmitting ? "Creating…" : `Create ${ROLE_LABELS[formData.role]} Account`}
                </button>
                <button type="button" className="btn" onClick={() => { resetForm(); setView("list"); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>User Management</h1>
          <p className="faint" style={{ fontSize: "13px", margin: "4px 0 0" }}>
            Create and manage client and site worker logins.
          </p>
        </div>
        <button className="btn amber" onClick={startCreate}>
          <Plus size={16} /> New Account
        </button>
      </div>

      {actionError && (
        <div style={{
          padding: "12px", background: "rgba(255, 95, 95, 0.1)", border: "1px solid rgba(255, 95, 95, 0.3)",
          borderRadius: "8px", color: "var(--red)", fontSize: "13px", display: "flex", gap: "8px", alignItems: "flex-start",
        }}>
          <AlertTriangle size={16} style={{ marginTop: 1 }} />
          <span>{actionError}</span>
        </div>
      )}

      <div style={{
        display: "flex", gap: "12px", alignItems: "center", background: "var(--panel)",
        border: "1px solid var(--line)", borderRadius: "8px", padding: "10px 14px",
      }}>
        <Search size={16} style={{ color: "var(--faint)" }} />
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, background: "transparent", border: "none", color: "var(--ink)", fontSize: "14px", outline: "none" }}
        />
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "12px" }}>
            <Loader size={24} className="spin" style={{ color: "var(--teal)" }} />
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>Loading accounts...</span>
          </div>
        ) : listError ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "300px", color: "var(--red)", gap: "12px",
          }}>
            <AlertTriangle size={24} />
            <span style={{ fontSize: "13px" }}>{listError}</span>
            <button className="btn sm" onClick={loadUsers}>Retry</button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", color: "var(--faint)", gap: "12px" }}>
            <Building2 size={32} />
            <span style={{ fontSize: "14px" }}>
              {users.length === 0 ? "No accounts yet. Create one to get started." : "No accounts match your search."}
            </span>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line2)" }}>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>Name</th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>Email</th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>Role</th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>Company</th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>Created</th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>Status</th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "500", color: "var(--ink)" }}>{user.username}</td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: "12px" }}>{user.email}</td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{ROLE_LABELS[user.role] || user.role}</td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{user.company || "—"}</td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{fmtDate(user.createdAt)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontSize: "11px", padding: "4px 10px", borderRadius: "12px",
                        background: user.status === "active" ? "rgba(51, 220, 174, 0.12)" : "rgba(255, 95, 95, 0.12)",
                        color: user.status === "active" ? "var(--teal)" : "var(--red)",
                        fontWeight: "500", textTransform: "capitalize",
                      }}>
                        {user.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => handleToggleStatus(user)}
                        disabled={busyId === user.id}
                        className="btn sm"
                        style={user.status === "active"
                          ? { background: "rgba(255,95,95,.15)", color: "var(--red)" }
                          : { background: "rgba(51,220,174,.15)", color: "var(--teal)" }}
                        title={user.status === "active" ? "Suspend access" : "Reactivate access"}
                      >
                        {busyId === user.id ? <Loader size={13} className="spin" /> : <Power size={13} />}
                        {user.status === "active" ? "Suspend" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
