import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CheckCheck, Loader2 } from "lucide-react";
import { lineLabel } from "../utils/dispatchLines";

// Site engineer's receipt of a whole dispatch (shown in a pop-up). One row
// per packing-list line, by description: how many arrived and how many of
// those are damaged. A note box appears only on a line with a problem. The
// overall condition follows from the counts, the same way the backend works
// it out (Relay3 dispatch.controller receiveDispatch); a complete,
// undamaged receipt starts the link's installation automatically.

const CONDITION = {
  good: { text: "Everything arrived in good condition", className: "good" },
  damaged: { text: "Received with damage", className: "damaged" },
  incomplete: { text: "Something is short", className: "short" },
};

const unitText = (line) => (line.unit && line.unit !== "ea" ? line.unit : "");

export function DispatchReceiptCheck({ dispatch, busy, onSubmit, onCancel }) {
  const lines = useMemo(() => dispatch.items || [], [dispatch.items]);
  const [counts, setCounts] = useState(() => Object.fromEntries(lines.map((line) => [
    String(line.componentId), { qtyReceived: "", qtyDamaged: "", note: "" },
  ])));
  const [discrepancyDetails, setDiscrepancyDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [problem, setProblem] = useState("");

  const setLine = (componentId, patch) => setCounts((current) => ({
    ...current,
    [componentId]: { ...current[componentId], ...patch },
  }));

  const lineIssue = (line) => {
    const count = counts[String(line.componentId)];
    if (count.qtyReceived === "") return false;
    return Number(count.qtyReceived) < line.qty || Number(count.qtyDamaged || 0) > 0;
  };

  const summary = useMemo(() => {
    let uncounted = 0;
    let short = false;
    let damaged = false;
    for (const line of lines) {
      const count = counts[String(line.componentId)];
      if (count.qtyReceived === "") { uncounted += 1; continue; }
      if (Number(count.qtyReceived) < line.qty) short = true;
      if (Number(count.qtyDamaged || 0) > 0) damaged = true;
    }
    return { uncounted, condition: short ? "incomplete" : damaged ? "damaged" : "good" };
  }, [counts, lines]);

  const markAllReceived = () => {
    setCounts(Object.fromEntries(lines.map((line) => [String(line.componentId), {
      ...counts[String(line.componentId)], qtyReceived: String(line.qty), qtyDamaged: "",
    }])));
    setProblem("");
  };

  const submit = (event) => {
    event.preventDefault();
    if (summary.uncounted > 0) {
      setProblem(`Count every line first: ${summary.uncounted} still to count.`);
      return;
    }
    for (const line of lines) {
      const count = counts[String(line.componentId)];
      const received = Number(count.qtyReceived);
      const damagedQty = Number(count.qtyDamaged || 0);
      if (!Number.isInteger(received) || received < 0 || received > line.qty) {
        setProblem(`${lineLabel(line)}: enter how many arrived (0 to ${line.qty}).`);
        return;
      }
      if (!Number.isInteger(damagedQty) || damagedQty < 0 || damagedQty > received) {
        setProblem(`${lineLabel(line)}: damaged can't be more than received.`);
        return;
      }
    }
    if (summary.condition !== "good" && !discrepancyDetails.trim()) {
      setProblem("Say what was damaged or short.");
      return;
    }
    if (signature.trim().length < 2) {
      setProblem("Type your full name to sign for the delivery.");
      return;
    }
    setProblem("");
    onSubmit({
      items: lines.map((line) => {
        const count = counts[String(line.componentId)];
        return { componentId: line.componentId, qtyReceived: Number(count.qtyReceived), qtyDamaged: Number(count.qtyDamaged || 0), note: count.note };
      }),
      discrepancyDetails,
      notes,
      signature,
    });
  };

  const condition = CONDITION[summary.condition];
  const counted = lines.length - summary.uncounted;

  return (
    <form className="receipt-form" onSubmit={submit} noValidate>
      <div className="receipt-form-bar">
        <span className="faint">{counted} of {lines.length} line{lines.length === 1 ? "" : "s"} counted</span>
        <button type="button" className="btn sm" onClick={markAllReceived} disabled={busy}>
          <CheckCheck size={13} /> Everything arrived
        </button>
      </div>

      <table className="receipt-table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Sent</th>
            <th className="num">Received</th>
            <th className="num">Damaged</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const componentId = String(line.componentId);
            const count = counts[componentId];
            const issue = lineIssue(line);
            const label = lineLabel(line);
            return (
              <tr key={componentId} className={issue ? "issue" : count.qtyReceived !== "" ? "ok" : ""}>
                <td data-label="Item">
                  <div className="receipt-item">{label}</div>
                  {line.description && <div className="receipt-item-sub">{line.type} · {line.model}</div>}
                  {issue && (
                    <input className="form-input receipt-line-note" maxLength={300} placeholder="What's wrong with this line?"
                      aria-label={`Note for ${label}`} value={count.note}
                      onChange={(event) => setLine(componentId, { note: event.target.value })} disabled={busy} />
                  )}
                </td>
                <td className="num" data-label="Sent">{line.qty}{unitText(line) && <span className="faint"> {unitText(line)}</span>}</td>
                <td className="num" data-label="Received">
                  <input className="form-input" type="number" inputMode="numeric" min="0" max={line.qty} step="1"
                    aria-label={`Received: ${label}`} value={count.qtyReceived}
                    onChange={(event) => setLine(componentId, { qtyReceived: event.target.value })} disabled={busy} />
                </td>
                <td className="num" data-label="Damaged">
                  <input className="form-input" type="number" inputMode="numeric" min="0" step="1" placeholder="0"
                    aria-label={`Damaged: ${label}`} value={count.qtyDamaged}
                    onChange={(event) => setLine(componentId, { qtyDamaged: event.target.value })} disabled={busy} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {summary.uncounted === 0 && (
        <div className={`receipt-status ${condition.className}`}>
          {summary.condition === "good" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span>
            {condition.text}
            {summary.condition === "good" && dispatch.linkId && (
              <span className="faint"> · link {dispatch.linkId} moves to Installing if the whole kit is here</span>
            )}
          </span>
        </div>
      )}

      {summary.condition !== "good" && summary.uncounted === 0 && (
        <label className="receipt-field">
          What was damaged or short? *
          <textarea className="form-input" rows={2} maxLength={1000} value={discrepancyDetails}
            onChange={(event) => setDiscrepancyDetails(event.target.value)} disabled={busy} />
        </label>
      )}

      <div className="receipt-sign">
        <label className="receipt-field">
          Notes (optional)
          <input className="form-input" maxLength={1000} value={notes}
            onChange={(event) => setNotes(event.target.value)} disabled={busy} />
        </label>
        <label className="receipt-field">
          Your full name (signature) *
          <input className="form-input" maxLength={150} value={signature} autoComplete="name"
            onChange={(event) => setSignature(event.target.value)} disabled={busy} />
        </label>
      </div>

      {problem && <div role="alert" className="receipt-problem"><AlertTriangle size={13} /> {problem}</div>}

      <div className="receipt-actions">
        {onCancel && <button type="button" className="btn sm ghost" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button type="submit" className="btn amber sm" disabled={busy}>
          {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} Confirm receipt
        </button>
      </div>
    </form>
  );
}

// What the site engineer counted, line by line (read-only).
export function DispatchReceiptLines({ receipt }) {
  if (!receipt?.items?.length) return null;
  return (
    <div className="receipt-lines-readonly">
      {receipt.items.map((line) => {
        const ok = line.qtyReceived === line.qtySent && !line.qtyDamaged;
        return (
          <div key={String(line.componentId)} className={ok ? "" : "issue"}>
            {lineLabel(line)}: received {line.qtyReceived} of {line.qtySent}
            {line.qtyDamaged ? ` · ${line.qtyDamaged} damaged` : ""}
            {line.note && <span className="faint"> · {line.note}</span>}
          </div>
        );
      })}
    </div>
  );
}
