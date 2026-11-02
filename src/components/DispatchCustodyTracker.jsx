import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { decideDispatchApproval, getDispatches, receiveDispatch } from "../services/api";

const formatDateTime = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
};

const approvalRole = (role) => ({
  project_manager: "Project Manager",
  ceo: "CEO",
}[role] || role);

const STATUS_COLORS = {
  PENDING_APPROVAL: "var(--amber)",
  REJECTED: "var(--red)",
  DISPATCHED: "var(--blue)",
  RECEIVED: "var(--teal)",
};

const emptyReceipt = () => ({
  condition: "good",
  discrepancyDetails: "",
  notes: "",
  signature: "",
});

export function DispatchCustodyTracker({ user }) {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [comments, setComments] = useState({});
  const [receipts, setReceipts] = useState({});

  const loadDispatches = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const records = await getDispatches();
      setDispatches(Array.isArray(records) ? records : []);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load dispatch custody records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDispatches();
  }, [loadDispatches]);

  const submitApproval = async (dispatch, decision) => {
    const comment = comments[dispatch._id] || "";
    if (decision === "reject" && !comment.trim()) {
      setActionError("Add a comment before rejecting a dispatch.");
      return;
    }
    setActionError("");
    setBusyId(dispatch._id);
    try {
      await decideDispatchApproval(dispatch._id, decision, comment);
      await loadDispatches();
    } catch (err) {
      setActionError(err.response?.data?.message || "Couldn't record the approval decision.");
    } finally {
      setBusyId("");
    }
  };

  const changeReceipt = (dispatchId, field, value) => {
    setReceipts((previous) => ({
      ...previous,
      [dispatchId]: { ...emptyReceipt(), ...previous[dispatchId], [field]: value },
    }));
  };

  const submitReceipt = async (dispatch) => {
    const receipt = { ...emptyReceipt(), ...receipts[dispatch._id] };
    if (!receipt.signature.trim()) {
      setActionError("Enter your name as the delivery signature.");
      return;
    }
    if (receipt.condition !== "good" && !receipt.discrepancyDetails.trim()) {
      setActionError("Describe the damage or shortage before confirming receipt.");
      return;
    }
    setActionError("");
    setBusyId(dispatch._id);
    try {
      await receiveDispatch(dispatch._id, receipt);
      await loadDispatches();
    } catch (err) {
      setActionError(err.response?.data?.message || "Couldn't record the delivery receipt.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="panel-h" style={{ gap: 10 }}>
        <Truck size={16} className="ph-ico" />
        <div>
          <h3>Dispatch custody</h3>
          <div className="faint" style={{ fontSize: 11 }}>
            Requests, sequential approvals, warehouse release and site receipt
          </div>
        </div>
        <button
          className="btn sm"
          style={{ marginLeft: "auto" }}
          onClick={loadDispatches}
          disabled={loading}
          aria-label="Refresh dispatch custody"
        >
          {loading ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </div>

      <div className="panel-b" style={{ display: "grid", gap: 12 }}>
        {actionError && (
          <div role="alert" style={{ color: "var(--red)", fontSize: 12, display: "flex", gap: 7, alignItems: "center" }}>
            <AlertTriangle size={14} /> {actionError}
          </div>
        )}
        {loading && (
          <div className="faint" style={{ padding: 18, textAlign: "center", fontSize: 12 }}>
            <Loader2 size={14} className="spin" /> Loading dispatches…
          </div>
        )}
        {!loading && error && (
          <div role="alert" style={{ color: "var(--red)", fontSize: 12 }}>
            <AlertTriangle size={14} /> {error}
            <button className="btn sm" style={{ marginLeft: 10 }} onClick={loadDispatches}>Retry</button>
          </div>
        )}
        {!loading && !error && dispatches.length === 0 && (
          <div className="faint" style={{ padding: 16, textAlign: "center", fontSize: 12 }}>
            No dispatch custody records are available.
          </div>
        )}

        {!loading && !error && dispatches.map((dispatch) => {
          const currentApproval = dispatch.approvalSteps?.find((step) => step.status === "pending");
          const isLegacy = !dispatch.status;
          const status = dispatch.status || (dispatch.dispatchedAt ? "DISPATCHED" : "PENDING_APPROVAL");
          const canApprove = status === "PENDING_APPROVAL" && currentApproval?.role === user?.role;
          const canReceive = status === "DISPATCHED" && user?.role === "site_manager";
          const receipt = { ...emptyReceipt(), ...receipts[dispatch._id] };
          const statusColor = STATUS_COLORS[status] || "var(--muted)";

          return (
            <article key={dispatch._id} style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
              <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px", background: "var(--bg)" }}>
                <Package size={15} style={{ color: "var(--amber)" }} />
                <strong className="mono">{dispatch.waybillId}</strong>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{dispatch.kitId}</span>
                <span style={{ marginLeft: "auto", color: statusColor, border: `1px solid ${statusColor}`, borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 700 }}>
                  {isLegacy ? "LEGACY · " : ""}{status.replaceAll("_", " ")}
                </span>
              </header>

              <div style={{ padding: 14, display: "grid", gap: 14 }}>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 11.5 }}>
                  <span><MapPin size={12} /> {dispatch.siteName || "Site not recorded"}{dispatch.siteId ? ` · ${dispatch.siteId}` : ""}</span>
                  <span><UserRound size={12} /> Requested by {dispatch.requestedByName || dispatch.dispatchedBy || "Not recorded"}</span>
                  <span><Clock3 size={12} /> {formatDateTime(dispatch.requestedAt || dispatch.createdAt)}</span>
                  {dispatch.financialAspect && (
                    <span style={{ color: "var(--amber)" }}>
                      Costed · {Number(dispatch.estimatedValue || 0).toLocaleString()} recorded · CEO approval required
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div className="up faint" style={{ fontSize: 9 }}>ITEMS / VEHICLE</div>
                  {(dispatch.items || []).map((item, index) => {
                    const selectedAssets = Array.isArray(item.assetIds) ? item.assetIds : [];
                    const serials = selectedAssets.map((asset) => asset?.serialNumber).filter(Boolean);
                    return (
                      <div key={`${item.componentId}-${index}`} style={{ fontSize: 11.5 }}>
                        {item.type} · {item.model} · qty {item.qty}
                        {serials.length > 0 && <span className="faint"> · {serials.join(", ")}</span>}
                      </div>
                    );
                  })}
                  <div className="faint" style={{ fontSize: 11 }}>
                    Vehicle {dispatch.vehicle?.plate || "—"} · Driver {dispatch.driver?.name || "—"}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div className="up faint" style={{ fontSize: 9 }}>CUSTODY TIMELINE</div>
                  <div style={{ borderLeft: "1px solid var(--line2)", marginLeft: 5, paddingLeft: 12, display: "grid", gap: 9 }}>
                    <div style={{ fontSize: 11.5 }}>
                      <CheckCircle2 size={13} style={{ color: "var(--teal)" }} /> Request submitted · {formatDateTime(dispatch.requestedAt || dispatch.createdAt)}
                    </div>
                    {dispatch.approvalSteps?.length ? dispatch.approvalSteps.map((step) => (
                      <div key={step.role} style={{ fontSize: 11.5 }}>
                        {step.status === "approved" ? <CheckCircle2 size={13} style={{ color: "var(--teal)" }} />
                          : step.status === "rejected" ? <AlertTriangle size={13} style={{ color: "var(--red)" }} />
                            : <Clock3 size={13} style={{ color: "var(--amber)" }} />}
                        {" "}{approvalRole(step.role)} · {step.status}
                        {step.approverName && ` by ${step.approverName}`}
                        {step.decidedAt && ` · ${formatDateTime(step.decidedAt)}`}
                        {step.comment && <div className="faint" style={{ marginLeft: 18, marginTop: 2 }}>{step.comment}</div>}
                      </div>
                    )) : (
                      <div className="faint" style={{ fontSize: 11.5 }}>Approval history not recorded.</div>
                    )}
                    {dispatch.dispatchedAt && (
                      <div style={{ fontSize: 11.5 }}>
                        <Truck size={13} style={{ color: "var(--blue)" }} /> Released to transit · {formatDateTime(dispatch.dispatchedAt)}
                      </div>
                    )}
                    {dispatch.receipt && (
                      <div style={{ fontSize: 11.5 }}>
                        <CheckCircle2 size={13} style={{ color: "var(--teal)" }} /> Received by {dispatch.receipt.receivedByName} · {formatDateTime(dispatch.receipt.receivedAt)} · {dispatch.receipt.condition}
                        {dispatch.receipt.discrepancyDetails && <div className="faint" style={{ marginLeft: 18, marginTop: 2 }}>{dispatch.receipt.discrepancyDetails}</div>}
                        {dispatch.receipt.notes && <div className="faint" style={{ marginLeft: 18, marginTop: 2 }}>Notes: {dispatch.receipt.notes}</div>}
                        <div className="faint" style={{ marginLeft: 18, marginTop: 2 }}>Signature: {dispatch.receipt.signature}</div>
                      </div>
                    )}
                    {isLegacy && <div className="faint" style={{ fontSize: 11 }}>Approval and signed-receipt steps were not recorded for this older dispatch.</div>}
                  </div>
                </div>

                {canApprove && (
                  <div style={{ display: "grid", gap: 8, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                    <label className="faint" style={{ fontSize: 11 }}>
                      {approvalRole(currentApproval.role)} decision comment
                      <textarea
                        className="form-input"
                        rows={2}
                        maxLength={1000}
                        value={comments[dispatch._id] || ""}
                        onChange={(event) => setComments((previous) => ({ ...previous, [dispatch._id]: event.target.value }))}
                        style={{ display: "block", width: "100%", marginTop: 5 }}
                      />
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn amber sm" disabled={busyId === dispatch._id} onClick={() => submitApproval(dispatch, "approve")}>
                        {busyId === dispatch._id ? <Loader2 size={13} className="spin" /> : <ShieldCheck size={13} />} Approve
                      </button>
                      <button className="btn sm" disabled={busyId === dispatch._id} onClick={() => submitApproval(dispatch, "reject")}>
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {canReceive && (
                  <div style={{ display: "grid", gap: 9, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                    <div className="up faint" style={{ fontSize: 9 }}>CONFIRM DELIVERY · {dispatch.siteName}</div>
                    <label className="faint" style={{ fontSize: 11 }}>
                      Condition
                      <select
                        className="form-input"
                        value={receipt.condition}
                        onChange={(event) => changeReceipt(dispatch._id, "condition", event.target.value)}
                        style={{ display: "block", width: "100%", marginTop: 5 }}
                      >
                        <option value="good">Received in good condition</option>
                        <option value="damaged">Damage reported</option>
                        <option value="incomplete">Shortage / incomplete</option>
                      </select>
                    </label>
                    {receipt.condition !== "good" && (
                      <label className="faint" style={{ fontSize: 11 }}>
                        Damage or shortage details *
                        <textarea
                          className="form-input"
                          rows={2}
                          maxLength={1000}
                          value={receipt.discrepancyDetails}
                          onChange={(event) => changeReceipt(dispatch._id, "discrepancyDetails", event.target.value)}
                          style={{ display: "block", width: "100%", marginTop: 5 }}
                        />
                      </label>
                    )}
                    <label className="faint" style={{ fontSize: 11 }}>
                      Receipt notes
                      <textarea
                        className="form-input"
                        rows={2}
                        maxLength={1000}
                        value={receipt.notes}
                        onChange={(event) => changeReceipt(dispatch._id, "notes", event.target.value)}
                        style={{ display: "block", width: "100%", marginTop: 5 }}
                      />
                    </label>
                    <label className="faint" style={{ fontSize: 11 }}>
                      Electronic signature (type your full name) *
                      <input
                        className="form-input"
                        value={receipt.signature}
                        onChange={(event) => changeReceipt(dispatch._id, "signature", event.target.value)}
                        maxLength={150}
                        style={{ display: "block", width: "100%", marginTop: 5 }}
                      />
                    </label>
                    <button className="btn amber sm" disabled={busyId === dispatch._id} onClick={() => submitReceipt(dispatch)}>
                      {busyId === dispatch._id ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} Confirm receipt
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
