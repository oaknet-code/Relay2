import React, { useState, useEffect, useMemo } from "react";
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
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldOff,
} from "lucide-react";
import { PasswordRules } from "../components/ui/PasswordRules";
import { isPasswordValid, passwordProblem, generatePassword, PASSWORD_MAX_LENGTH } from "../utils/passwordPolicy";
import { listUsers, createUser, updateUser, deleteUser, setUserStatus, resetUserMfa } from "../services/api";

// All seven account roles. Order = how they appear in the role picker.
const ROLES = [
  { value: "super_admin", label: "Super Admin", hint: "Full access, including admin accounts" },
  { value: "admin", label: "Admin", hint: "Views everything; manages accounts below admin" },
  { value: "warehouse_manager", label: "Warehouse Manager", hint: "Manages stock, kits and links" },
  { value: "warehouse_operator", label: "Warehouse Operator", hint: "Allocates kits and dispatches" },
  { value: "site_engineer", label: "Site Engineer", hint: "Views kits, staging and field ops" },
  { value: "client", label: "Client", hint: "Sees only their own links" },
  { value: "field_worker", label: "Site Worker", hint: "Submits Site Work reports (needs a company)" },
];
const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));
// Only a super admin can create, edit or delete these.
const PRIVILEGED_ROLES = ["super_admin", "admin"];
const ROLE_COLORS = {
  super_admin: "var(--red)",
  admin: "var(--amber)",
  warehouse_manager: "var(--blue)",
  warehouse_operator: "var(--blue)",
  site_engineer: "var(--violet)",
  client: "var(--teal)",
  field_worker: "var(--teal)",
};

const EMPTY_FORM = { username: "", email: "", company: "", role: "client", password: "" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ErrorBox({ children }) {
  return (
    <div style={{
      padding: "12px", background: "rgba(255, 95, 95, 0.1)", border: "1px solid rgba(255, 95, 95, 0.3)",
      borderRadius: "8px", color: "var(--red)", fontSize: "13px", display: "flex", gap: "8px", alignItems: "flex-start",
    }}>
      <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" };

export function UserManagementPage({ isSuper = false }) {
  // Roles this user may hand out: admins can't create admins or super admins.
  const assignableRoles = isSuper ? ROLES : ROLES.filter((r) => !PRIVILEGED_ROLES.includes(r.value));
  const [view, setView] = useState("list"); // list, create, edit
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [createdAccount, setCreatedAccount] = useState(null); // { username, email, role, temporaryPassword }
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setListError("");
    try {
      setUsers(await listUsers());
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

  const backToList = () => {
    setFormData(EMPTY_FORM);
    setEditingUser(null);
    setCreatedAccount(null);
    setCopied(false);
    setShowPassword(false);
    setFormError("");
    setView("list");
  };

  const startCreate = () => {
    backToList();
    setActionError("");
    setNotice("");
    setView("create");
  };

  const startEdit = (user) => {
    setActionError("");
    setNotice("");
    setFormError("");
    setEditingUser(user);
    setFormData({ username: user.username, email: user.email, company: user.company || "", role: user.role, password: "" });
    setView("edit");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError("");
    // Company belongs to site workers only — don't send a value typed
    // before switching to another role.
    const company = formData.role === "field_worker" ? formData.company.trim() : undefined;

    try {
      if (view === "edit") {
        const payload = {};
        if (formData.username.trim() !== editingUser.username) payload.username = formData.username.trim();
        if (formData.email.trim().toLowerCase() !== editingUser.email) payload.email = formData.email.trim();
        if (formData.role !== editingUser.role) payload.role = formData.role;
        if (formData.role === "field_worker" && company !== (editingUser.company || "")) payload.company = company;
        if (Object.keys(payload).length) {
          const updated = await updateUser(editingUser.id, payload);
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          setNotice(`Saved changes to ${updated.username}.`);
        }
        backToList();
      } else {
        const problem = passwordProblem(formData.password);
        if (problem) {
          setFormError(problem);
          return;
        }
        const result = await createUser({ ...formData, company });
        setCreatedAccount({
          username: result.user.username,
          email: result.user.email,
          role: result.user.role,
          temporaryPassword: formData.password,
        });
        await loadUsers();
      }
    } catch (err) {
      setFormError(err.message || "Failed to save the account.");
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
    setNotice("");
    try {
      const updated = await setUserStatus(user.id, nextStatus);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    } catch (err) {
      setActionError(err.message || "Failed to update account status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleResetMfa = async (user) => {
    if (!window.confirm(`Reset two-factor authentication for "${user.username}"? They'll be signed out and must set up Google Authenticator again at their next login.`)) return;
    setBusyId(user.id);
    setActionError("");
    setNotice("");
    try {
      const updated = await resetUserMfa(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      setNotice(`2FA reset for ${user.username}. They'll set it up again at next login.`);
    } catch (err) {
      setActionError(err.message || "Failed to reset 2FA.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Permanently delete the account for "${user.username}" (${user.email})? This can't be undone.`)) return;

    setBusyId(user.id);
    setActionError("");
    setNotice("");
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setNotice(`Deleted the account for ${user.username}.`);
    } catch (err) {
      setActionError(err.message || "Failed to delete the account.");
    } finally {
      setBusyId(null);
    }
  };

  const roleCounts = useMemo(() => {
    const c = {};
    users.forEach((u) => { c[u.role] = (c[u.role] || 0) + 1; });
    return c;
  }, [users]);

  const filteredUsers = users.filter((user) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      user.username.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      (user.company || "").toLowerCase().includes(q) ||
      (ROLE_LABELS[user.role] || "").toLowerCase().includes(q);
    return matchesSearch && (roleFilter === "all" || user.role === roleFilter);
  });

  // CREATE / EDIT VIEW
  if (view === "create" || view === "edit") {
    const isEdit = view === "edit";
    const roleLocked = isEdit && editingUser?.isSelf;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>
              {createdAccount ? "Account Created" : isEdit ? "Edit Account" : "Create Account"}
            </h1>
            <p className="faint" style={{ fontSize: "13px", margin: "4px 0 0" }}>
              {createdAccount
                ? "Share the password below with them securely — it won't be shown again."
                : isEdit
                  ? `Update ${editingUser.username}'s details or role.`
                  : "Give someone a login and choose their role."}
            </p>
          </div>
          <button className="btn ghost" onClick={backToList}>
            <X size={16} /> {createdAccount ? "Done" : "Cancel"}
          </button>
        </div>

        <div style={{
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "12px",
          padding: "28px", maxWidth: "680px",
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
                <label style={labelStyle}>Password</label>
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 12px", background: "var(--bg)", border: "1px solid var(--line2)", borderRadius: "9px",
                }}>
                  <KeyRound size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: "var(--mono)", fontSize: "13.5px", letterSpacing: "0.03em", overflowWrap: "anywhere" }}>
                    {createdAccount.temporaryPassword}
                  </span>
                  <button type="button" onClick={handleCopyPassword} className="btn sm" style={{ flexShrink: 0 }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
                  This is the password you set. It's stored only as a secure hash, so copy it now if you still need to share it.
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: 8, flexWrap: "wrap" }}>
                <button className="btn amber" style={{ flex: 1 }} onClick={startCreate}>
                  <Plus size={15} /> Create Another
                </button>
                <button className="btn" onClick={backToList}>Back to List</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {formError && <ErrorBox>{formError}</ErrorBox>}

              <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={roleLocked}>
                <legend style={labelStyle}>Role *</legend>
                <div className="role-picker" role="radiogroup" aria-label="Role">
                  {assignableRoles.map((r) => {
                    const selected = formData.role === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`role-option ${selected ? "selected" : ""}`}
                        onClick={() => { setFormError(""); setFormData((prev) => ({ ...prev, role: r.value })); }}
                      >
                        <span className="role-option-label">{r.label}</span>
                        <span className="role-option-hint">{r.hint}</span>
                      </button>
                    );
                  })}
                </div>
                {roleLocked && (
                  <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
                    You can't change the role of your own account.
                  </div>
                )}
              </fieldset>

              <div>
                <label style={labelStyle} htmlFor="um-name">Full Name *</label>
                <input id="um-name" type="text" name="username" className="form-input" placeholder="e.g. John Doe"
                  value={formData.username} onChange={handleChange} required minLength={2} maxLength={100} />
              </div>

              <div>
                <label style={labelStyle} htmlFor="um-email">Email *</label>
                <input id="um-email" type="email" name="email" className="form-input" placeholder="name@company.com"
                  value={formData.email} onChange={handleChange} required maxLength={254} />
              </div>

              {!isEdit && (
                <div>
                  <label style={labelStyle} htmlFor="um-password">Password *</label>
                  <div className="pw-field">
                    <input
                      id="um-password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      className="form-input"
                      autoComplete="new-password"
                      placeholder="Type a password or generate one"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      maxLength={PASSWORD_MAX_LENGTH}
                      aria-describedby="um-password-rules"
                    />
                    <button type="button" className="btn sm ghost" onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button type="button" className="btn sm ghost"
                      onClick={() => { setFormError(""); setShowPassword(true); setFormData((p) => ({ ...p, password: generatePassword() })); }}>
                      <RefreshCw size={13} /> Generate
                    </button>
                  </div>
                  <PasswordRules password={formData.password} id="um-password-rules" />
                </div>
              )}

              {formData.role === "field_worker" && (
                <div>
                  <label style={labelStyle} htmlFor="um-company">Company *</label>
                  <input id="um-company" type="text" name="company" className="form-input" placeholder="e.g. Oaknet Business"
                    value={formData.company} onChange={handleChange} required minLength={2} maxLength={150} />
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.username || !formData.email || (!isEdit && !isPasswordValid(formData.password))}
                  className="btn amber"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {isSubmitting ? <Loader size={14} className="spin" /> : isEdit ? <Check size={15} /> : <Plus size={15} />}
                  {isSubmitting
                    ? (isEdit ? "Saving…" : "Creating…")
                    : (isEdit ? "Save Changes" : `Create ${ROLE_LABELS[formData.role]} Account`)}
                </button>
                <button type="button" className="btn" onClick={backToList}>Cancel</button>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>User Management</h1>
          <p className="faint" style={{ fontSize: "13px", margin: "4px 0 0" }}>
            Create, edit and remove accounts for every role.
          </p>
        </div>
        <button className="btn amber" onClick={startCreate}>
          <Plus size={16} /> New Account
        </button>
      </div>

      {actionError && <ErrorBox>{actionError}</ErrorBox>}
      {notice && (
        <div style={{
          padding: "10px 12px", background: "rgba(51, 220, 174, 0.08)", border: "1px solid rgba(51, 220, 174, 0.3)",
          borderRadius: "8px", color: "var(--teal)", fontSize: "13px", display: "flex", gap: "8px", alignItems: "center",
        }}>
          <Check size={15} /> {notice}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <div style={{
          display: "flex", gap: "12px", alignItems: "center", background: "var(--panel)", flex: "1 1 260px",
          border: "1px solid var(--line)", borderRadius: "8px", padding: "10px 14px",
        }}>
          <Search size={16} style={{ color: "var(--faint)" }} />
          <input
            type="text"
            placeholder="Search by name, email, company or role..."
            aria-label="Search accounts"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, background: "transparent", border: "none", color: "var(--ink)", fontSize: "14px", outline: "none" }}
          />
        </div>
        <select
          className="form-input"
          style={{ width: 220 }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
        >
          <option value="all">All roles ({users.length})</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label} ({roleCounts[r.value] || 0})</option>
          ))}
        </select>
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
            <table className="users-tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>2FA</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const busy = busyId === user.id;
                  const color = ROLE_COLORS[user.role] || "var(--muted)";
                  return (
                    <tr key={user.id}>
                      <td style={{ fontWeight: "500", color: "var(--ink)" }}>
                        {user.username}
                        {user.isSelf && <span className="you-chip">You</span>}
                      </td>
                      <td style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: "12px" }}>{user.email}</td>
                      <td>
                        <span className="role-badge" style={{ color, borderColor: color }}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{user.company || "—"}</td>
                      <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(user.createdAt)}</td>
                      <td>
                        <span style={{
                          fontSize: "11px", padding: "4px 10px", borderRadius: "12px",
                          background: user.status === "active" ? "rgba(51, 220, 174, 0.12)" : "rgba(255, 95, 95, 0.12)",
                          color: user.status === "active" ? "var(--teal)" : "var(--red)",
                          fontWeight: "500", textTransform: "capitalize",
                        }}>
                          {user.status}
                        </span>
                      </td>
                      <td>
                        <span className={`mfa-badge ${user.mfaEnabled ? "on" : ""}`}>
                          {user.mfaEnabled ? "On" : "Not set up"}
                        </span>
                      </td>
                      <td>
                        {/* user.canManage comes from the server: admins can't touch admin / super admin accounts. */}
                        {!user.canManage ? (
                          <div className="user-actions faint" style={{ fontSize: 11.5 }}>Super admin only</div>
                        ) : (
                        <div className="user-actions">
                          <button className="btn sm ghost" onClick={() => startEdit(user)} disabled={busy} title="Edit account">
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={busy || user.isSelf}
                            className="btn sm"
                            style={user.status === "active"
                              ? { background: "rgba(255,176,32,.12)", color: "var(--amber)" }
                              : { background: "rgba(51,220,174,.15)", color: "var(--teal)" }}
                            title={user.isSelf ? "You can't suspend your own account" : user.status === "active" ? "Suspend access" : "Reactivate access"}
                          >
                            {busy ? <Loader size={13} className="spin" /> : <Power size={13} />}
                            {user.status === "active" ? "Suspend" : "Reactivate"}
                          </button>
                          {user.mfaEnabled && !user.isSelf && (
                            <button className="btn sm ghost" onClick={() => handleResetMfa(user)} disabled={busy}
                              title="Lost phone: clear 2FA so they can set it up again">
                              <ShieldOff size={13} /> Reset 2FA
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={busy || user.isSelf}
                            className="btn sm"
                            style={{ background: "rgba(255,95,95,.15)", color: "var(--red)" }}
                            title={user.isSelf ? "You can't delete your own account" : "Delete account"}
                            aria-label={`Delete ${user.username}`}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
