import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Wallet } from "lucide-react";
import { decideClaim, getClaims, getVehicles, markClaimPaid } from "../services/api";
import { ClaimForm, ClaimRow } from "../components/Claims";

// Claims: one place for all money staff spend for work — trip per diem
// (meals, accommodation...), other costs, and fuel (logged in Fleet, claimed
// automatically). Everyone sees their own claims (and ones they submitted
// for others); only the CEO sees all, reviews and marks paid. The CEO
// doesn't make claims.

const STAFF_ROLES = ["super_admin", "admin", "project_manager", "site_engineer", "driver"];
const FILTERS = [["all", "All"], ["submitted", "Awaiting review"], ["approved", "Approved"], ["paid", "Paid"], ["rejected", "Rejected"]];
const kes = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ExpenseClaimsPage({ user }) {
  const [claims, setClaims] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null); // { ok, text }
  const reviewer = user?.role === "ceo";
  const canClaim = STAFF_ROLES.includes(user?.role);

  const load = useCallback(async () => {
    try {
      setClaims(await getClaims());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (canClaim && user?.role !== "driver") getVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, [canClaim, user?.role]);

  const totals = useMemo(() => ({
    submitted: claims.filter((claim) => claim.status === "submitted").length,
    approved: claims.filter((claim) => ["approved", "paid"].includes(claim.status)).reduce((sum, claim) => sum + claim.amount, 0),
    paid: claims.filter((claim) => claim.status === "paid").reduce((sum, claim) => sum + claim.amount, 0),
  }), [claims]);
  const visible = filter === "all" ? claims : claims.filter((claim) => claim.status === filter);

  const run = async (action, success) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      await load();
      setNotice({ ok: true, text: [success, result?.notificationWarning].filter(Boolean).join(" ") });
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const decide = (claim, decision) => {
    const comment = window.prompt(decision === "rejected"
      ? `Why is the claim from ${claim.claimantName} rejected? They see this.`
      : `Optional comment for approving ${claim.claimantName}'s claim:`);
    if (comment === null) return;
    if (decision === "rejected" && !comment.trim()) { setNotice({ ok: false, text: "Give a reason to reject the claim." }); return; }
    run(() => decideClaim(claim._id, decision, comment.trim()), `Claim ${decision}.`);
  };
  const markPaid = (claim) => {
    if (!window.confirm(`Mark ${kes(claim.amount)} for ${claim.claimantName} as paid?`)) return;
    run(() => markClaimPaid(claim._id), "Claim marked paid.");
  };

  return (
    <div>
      <div className="view-head">
        <span className="tagchip"><Wallet size={11} /> Reimbursements</span>
        <h2>Claims</h2>
        <p>
          Spent money for work, like meals and accommodation on a trip, supplies or transport? Claim it here with the receipts.
          Fuel logged in Fleet is claimed automatically. The CEO reviews each claim and marks it paid.
        </p>
      </div>

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="k-top">AWAITING REVIEW</div><div className="k-val">{totals.submitted}</div><div className="k-sub">with the CEO</div></div>
        <div className="kpi"><div className="k-top">APPROVED</div><div className="k-val">{kes(totals.approved)}</div><div className="k-sub">incl. paid</div></div>
        <div className="kpi"><div className="k-top">PAID</div><div className="k-val">{kes(totals.paid)}</div><div className="k-sub">reimbursed</div></div>
      </div>

      {notice && (
        <div className={`fleet-operation-notice ${notice.ok ? "" : "error"}`} role={notice.ok ? "status" : "alert"}>
          {notice.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {notice.text}
        </div>
      )}
      {error && <div className="fleet-operation-notice error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      <section className="panel">
        <div className="panel-h">
          <Wallet size={15} className="ph-ico" />
          <h3>{reviewer ? "All claims" : "My claims"}</h3>
          <span className="ff-count">{claims.length}</span>
          {canClaim && (
            <button className="btn sm amber ph-r" onClick={() => { setNotice(null); setShowForm(true); }}><Plus size={13} /> New claim</button>
          )}
        </div>
        <div className="panel-b" style={{ padding: 14 }}>
          <div className="driver-choice" role="radiogroup" aria-label="Show" style={{ marginBottom: 6 }}>
            {FILTERS.map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={filter === value} className={`driver-chip ${filter === value ? "on" : ""}`} onClick={() => setFilter(value)}>
                {label}{value === "all" ? ` (${claims.length})` : ` (${claims.filter((claim) => claim.status === value).length})`}
              </button>
            ))}
          </div>
          {!canClaim && !reviewer && <div className="fleet-operation-help">Your account can see its earlier claims but can&apos;t submit new ones.</div>}
          {loading ? (
            <div className="fleet-operation-empty"><Loader2 size={18} className="spin" /> Loading claims…</div>
          ) : visible.length === 0 ? (
            <div className="fleet-operation-empty">{claims.length ? "No claims with this status." : "No claims yet."}</div>
          ) : (
            visible.map((claim) => (
              <ClaimRow key={claim._id} claim={claim} actions={reviewer && (
                <>
                  {claim.status === "submitted" && (
                    <div className="fleet-operation-actions">
                      <button className="btn sm amber" disabled={busy} onClick={() => decide(claim, "approved")}>Approve</button>
                      <button className="btn sm ghost" disabled={busy} onClick={() => decide(claim, "rejected")}>Reject</button>
                    </div>
                  )}
                  {claim.status === "approved" && <button className="btn sm amber" disabled={busy} onClick={() => markPaid(claim)}>Mark paid</button>}
                </>
              )} />
            ))
          )}
        </div>
      </section>

      {showForm && (
        <ClaimForm vehicles={vehicles} onClose={() => setShowForm(false)}
          onSaved={async (result) => {
            setShowForm(false);
            await load();
            setNotice({ ok: true, text: ["Claim submitted for CEO review.", result?.notificationWarning].filter(Boolean).join(" ") });
          }} />
      )}
    </div>
  );
}
