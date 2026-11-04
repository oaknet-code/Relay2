import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Package,
  Printer,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";
import { decideDispatchApproval, downloadGatePassPDF, getDispatches, getLinks, receiveDispatch } from "../services/api";
import { DispatchReceiptCheck, DispatchReceiptLines } from "./DispatchReceiptCheck";
import { lineLabel } from "../utils/dispatchLines";
import { LinkInstallationPanel } from "./LinkInstallationPanel";
import { FleetModal } from "./FleetModal";
import "../styles/custody.css";

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


export function DispatchCustodyTracker({ user }) {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [comments, setComments] = useState({});
  const [notice, setNotice] = useState("");
  const [links, setLinks] = useState({}); // linkId → link, for installation progress

  const loadDispatches = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [records, linkRows] = await Promise.all([
        getDispatches(),
        getLinks().catch(() => []), // progress is optional; dispatches still show
      ]);
      setDispatches(Array.isArray(records) ? records : []);
      setLinks(Object.fromEntries((Array.isArray(linkRows) ? linkRows : []).map((link) => [link.linkId, link])));
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
    setNotice("");
    setBusyId(dispatch._id);
    try {
      const result = await decideDispatchApproval(dispatch._id, decision, comment);
      await loadDispatches();
      setNotice(`${dispatch.waybillId} ${decision === "approve" ? "approved" : "rejected"}.${result?.notificationWarning ? ` ${result.notificationWarning}` : ""}`);
    } catch (err) {
      setActionError(err.response?.data?.message || "Couldn't record the approval decision.");
    } finally {
      setBusyId("");
    }
  };

  // Opens the gate pass PDF (anyone who can see the dispatch, incl. admins).
  const printGatePass = async (dispatch) => {
    setActionError("");
    setBusyId(dispatch._id);
    try {
      const blob = await downloadGatePassPDF(dispatch._id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setActionError(err.response?.data?.message || "Couldn't open the gate pass.");
    } finally {
      setBusyId("");
    }
  };

  const [receivingId, setReceivingId] = useState("");
  const receiving = dispatches.find((item) => item._id === receivingId) || null;

  const submitReceipt = async (dispatch, receipt) => {
    setActionError("");
    setNotice("");
    setBusyId(dispatch._id);
    try {
      const result = await receiveDispatch(dispatch._id, receipt);
      setReceivingId("");
      await loadDispatches();
      setNotice([
        `${dispatch.waybillId} received: ${result?.dispatch?.receipt?.condition || "recorded"}.`,
        result?.linkInstalling ? `Link ${result.linkInstalling} is now Installing.` : "",
        result?.notificationWarning || "",
      ].filter(Boolean).join(" "));
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
            Requests, approvals (Project Manager, then CEO), release, site receipt and link installation
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
        {notice && (
          <div role="status" style={{ color: "var(--teal)", fontSize: 12, display: "flex", gap: 7, alignItems: "center" }}>
            <CheckCircle2 size={14} /> {notice}
          </div>
        )}
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
          const canReceive = status === "DISPATCHED" && user?.role === "site_engineer";
          const link = dispatch.linkId ? links[dispatch.linkId] : null;
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
                      Recorded serialized-asset value · {Number(dispatch.estimatedValue || 0).toLocaleString()}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div className="up faint" style={{ fontSize: 9 }}>PACKING LIST / VEHICLE</div>
                  {(dispatch.items || []).map((item, index) => {
                    const selectedAssets = Array.isArray(item.assetIds) ? item.assetIds : [];
                    const serials = selectedAssets.map((asset) => asset?.serialNumber).filter(Boolean);
                    return (
                      <div key={`${item.componentId}-${index}`} style={{ fontSize: 11.5 }}>
                        <strong style={{ fontWeight: 600 }}>{lineLabel(item)}</strong> · {item.qty}{item.unit && item.unit !== "ea" ? ` ${item.unit}` : ""}
                        <div className="faint" style={{ fontSize: 10.5 }}>
                          {item.type} · {item.model}{serials.length > 0 ? ` · SN ${serials.join(", ")}` : ""}
                        </div>
                      </div>
                    );
                  })}
                  <div className="faint" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    Vehicle {dispatch.vehicle?.plate || "—"} · Driver {dispatch.driver?.name || "—"}
                    {["DISPATCHED", "RECEIVED"].includes(status) && (
                      <button type="button" className="btn sm ghost" disabled={busyId === dispatch._id} onClick={() => printGatePass(dispatch)}>
                        <Printer size={13} /> Print gate pass
                      </button>
                    )}
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
                        <div style={{ marginLeft: 18, marginTop: 4 }}><DispatchReceiptLines receipt={dispatch.receipt} /></div>
                        {dispatch.receipt.discrepancyDetails && <div className="faint" style={{ marginLeft: 18, marginTop: 2, whiteSpace: "pre-line" }}>{dispatch.receipt.discrepancyDetails}</div>}
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
                  <div style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                    <button type="button" className="btn amber sm" onClick={() => { setActionError(""); setReceivingId(dispatch._id); }}>
                      <Package size={13} /> Receive this dispatch
                    </button>
                  </div>
                )}

                {status === "RECEIVED" && link && (
                  <div style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                    <LinkInstallationPanel
                      link={link}
                      canAdvance={user?.role === "site_engineer"}
                      onChanged={(updated) => setLinks((current) => ({ ...current, [updated.linkId]: updated }))}
                    />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {receiving && (
        <FleetModal
          wide
          title={`Receive ${receiving.waybillId}`}
          description={`${receiving.siteName || receiving.siteId}${receiving.linkId ? ` · link ${receiving.linkId}` : ""}. Count what arrived on each line.`}
          onClose={() => { if (busyId !== receiving._id) setReceivingId(""); }}
        >
          {actionError && <div role="alert" className="receipt-problem" style={{ marginBottom: 10 }}><AlertTriangle size={13} /> {actionError}</div>}
          <DispatchReceiptCheck
            key={receiving._id}
            dispatch={receiving}
            busy={busyId === receiving._id}
            onCancel={() => setReceivingId("")}
            onSubmit={(receipt) => submitReceipt(receiving, receipt)}
          />
        </FleetModal>
      )}
    </section>
  );
}
