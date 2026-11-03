import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Wallet } from "lucide-react";
import {
  createExpenseClaim,
  decideExpenseClaim,
  getExpenseClaimOptions,
  getExpenseClaims,
  markExpenseClaimPaid,
} from "../services/api";

const EMPTY_FORM = {
  movementPlanId: "",
  category: "transport",
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  description: "",
  receiptReference: "",
};
const CATEGORIES = ["fuel", "accommodation", "meals", "transport", "supplies", "other"];
const isApprover = (user) => ["ceo", "super_admin"].includes(user?.role);
const formatKes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const displayDate = (value) => value ? new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Status({ value }) {
  return <span className={`fleet-status ${value === "approved" || value === "paid" ? "moving" : value === "rejected" ? "maintenance" : "parked"}`}>{value}</span>;
}

export function ExpenseClaimsPage({ user }) {
  const [claims, setClaims] = useState([]);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const reviewer = isApprover(user);

  const load = async () => {
    try {
      const [claimRows, planRows] = await Promise.all([getExpenseClaims(), getExpenseClaimOptions()]);
      setClaims(claimRows);
      setPlans(planRows);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => ({
    submitted: claims.filter((claim) => claim.status === "submitted").length,
    approved: claims.filter((claim) => ["approved", "paid"].includes(claim.status)).reduce((sum, claim) => sum + claim.amount, 0),
    paid: claims.filter((claim) => claim.status === "paid").reduce((sum, claim) => sum + claim.amount, 0),
  }), [claims]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await createExpenseClaim({ ...form, amount: Number(form.amount) });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      setNotice("Expense claim submitted for CEO review.");
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (claim, decision) => {
    const comment = window.prompt(`Optional comment for ${decision} claim ${claim.planReference}:`);
    if (comment === null) return;
    setBusy(true);
    setNotice("");
    try {
      await decideExpenseClaim(claim._id, decision, comment);
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (claim) => {
    if (!window.confirm(`Mark ${formatKes(claim.amount)} for ${claim.claimantName} as paid?`)) return;
    setBusy(true);
    setNotice("");
    try {
      await markExpenseClaimPaid(claim._id);
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="view-head">
        <span className="tagchip"><Wallet size={11} /> Reimbursements</span>
        <h2>Expense Claims</h2>
        <p>Record movement-plan expenses and follow each claim through review and reimbursement.</p>
      </div>

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="k-top">SUBMITTED</div><div className="k-val">{totals.submitted}</div><div className="k-sub">awaiting CEO review</div></div>
        <div className="kpi"><div className="k-top">APPROVED</div><div className="k-val">{formatKes(totals.approved)}</div><div className="k-sub">approved reimbursement</div></div>
        <div className="kpi"><div className="k-top">PAID</div><div className="k-val">{formatKes(totals.paid)}</div><div className="k-sub">reimbursed to team</div></div>
      </div>

      {notice && <div className="fleet-operation-notice" role="status">{notice}</div>}
      {error && <div className="fleet-operation-notice error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      <section className="panel">
        <div className="panel-h">
          <Wallet size={15} className="ph-ico" />
          <h3>{reviewer ? "All claims" : "My claims"}</h3>
          {!showForm && plans.length > 0 && (
            <button className="btn sm amber ph-r" onClick={() => setShowForm(true)}><Plus size={13} /> New claim</button>
          )}
        </div>
        <div className="panel-b" style={{ padding: "14px" }}>
          {showForm && (
            <form className="fleet-operation-form" onSubmit={submit}>
              <label>Movement plan *
                <select className="form-input" required value={form.movementPlanId} onChange={(event) => setForm((current) => ({ ...current, movementPlanId: event.target.value }))}>
                  <option value="">Select an approved plan</option>
                  {plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.reference} · {plan.title}</option>)}
                </select>
              </label>
              <label>Category *
                <select className="form-input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}
                </select>
              </label>
              <label>Amount (KES) *
                <input className="form-input" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
              </label>
              <label>Expense date *
                <input className="form-input" type="date" required value={form.expenseDate} onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))} />
              </label>
              <label className="wide">Description *
                <input className="form-input" maxLength={500} required value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="What was purchased and why?" />
              </label>
              <label className="wide">Receipt / reference
                <input className="form-input" maxLength={250} value={form.receiptReference} onChange={(event) => setForm((current) => ({ ...current, receiptReference: event.target.value }))} placeholder="Receipt number or secure document link" />
              </label>
              <div className="fleet-operation-actions wide">
                <button className="btn amber sm" type="submit" disabled={busy}>{busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} Submit claim</button>
                <button className="btn ghost sm" type="button" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="fleet-operation-empty"><Loader2 size={18} className="spin" /> Loading expense claims…</div>
          ) : claims.length === 0 ? (
            <div className="fleet-operation-empty">No expense claims yet.</div>
          ) : (
            <div className="fleet-operation-list">
              {claims.map((claim) => (
                <article className="fleet-operation-row" key={claim._id}>
                  <div className="fleet-operation-main">
                    <strong>{claim.planReference} · {claim.category}</strong>
                    <span>{claim.claimantName} · {displayDate(claim.expenseDate)} · {claim.description}</span>
                    {claim.receiptReference && <small>Receipt / reference: {claim.receiptReference}</small>}
                    {claim.decisionComment && <small>Reviewer note: {claim.decisionComment}</small>}
                  </div>
                  <div className="fleet-operation-meta">
                    <b>{formatKes(claim.amount)}</b>
                    <Status value={claim.status} />
                    {reviewer && claim.status === "submitted" && (
                      <div className="fleet-operation-actions">
                        <button className="btn sm amber" disabled={busy} onClick={() => decide(claim, "approved")}>Approve</button>
                        <button className="btn sm ghost" disabled={busy} onClick={() => decide(claim, "rejected")}>Reject</button>
                      </div>
                    )}
                    {reviewer && claim.status === "approved" && <button className="btn sm amber" disabled={busy} onClick={() => markPaid(claim)}>Mark paid</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
          {!loading && plans.length === 0 && !showForm && (
            <div className="fleet-operation-help">Claims can be linked to approved movement plans where you are listed as a team member.</div>
          )}
        </div>
      </section>
    </div>
  );
}
