import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ListChecks, Loader2 } from "lucide-react";
import { lineLabel } from "../utils/dispatchLines";

// Site engineer's receipt of a whole dispatch, counted line by line. Each
// line is shown by its description (what the part is) and they enter how
// many arrived and how many of those are damaged. The overall condition
// follows from the counts, the same way the backend works it out (Relay3
// dispatch.controller receiveDispatch). A complete, undamaged receipt
// starts the link's installation automatically.

const CONDITION_TEXT = {
  good: { text: "Everything arrived in good condition", color: "var(--teal)" },
  damaged: { text: "Received with damage", color: "var(--amber)" },
  incomplete: { text: "Incomplete: something is short", color: "var(--red)" },
};

const unitText = (line) => (line.unit && line.unit !== "ea" ? ` ${line.unit}` : "");

export function DispatchReceiptCheck({ dispatch, busy, onSubmit }) {
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

  const submit = () => {
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
      setProblem("Describe the damage or shortage before confirming receipt.");
      return;
    }
    if (signature.trim().length < 2) {
      setProblem("Type your full name as the delivery signature.");
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

  const condition = CONDITION_TEXT[summary.condition];

  return (
    <div className="receipt-check">
      <div className="receipt-check-head">
        <span className="up faint" style={{ fontSize: 9 }}><ListChecks size={12} /> COUNT EACH LINE · {dispatch.siteName}</span>
        <button type="button" className="btn sm ghost" onClick={markAllReceived} disabled={busy}>Mark all received</button>
      </div>

      {lines.map((line) => {
        const componentId = String(line.componentId);
        const count = counts[componentId];
        return (
          <div key={componentId} className="receipt-line">
            <div className="receipt-line-title">
              <strong>{lineLabel(line)}</strong>
              <span className="faint">sent {line.qty}{unitText(line)}</span>
            </div>
            {line.description && <div className="faint" style={{ fontSize: 10.5 }}>{line.type} · {line.model}</div>}
            <div className="receipt-qty">
              <label>Received
                <input className="form-input" type="number" min="0" max={line.qty} step="1" value={count.qtyReceived}
                  onChange={(event) => setLine(componentId, { qtyReceived: event.target.value })} disabled={busy} />
              </label>
              <label>Of which damaged
                <input className="form-input" type="number" min="0" step="1" value={count.qtyDamaged} placeholder="0"
                  onChange={(event) => setLine(componentId, { qtyDamaged: event.target.value })} disabled={busy} />
              </label>
            </div>
            <input className="form-input receipt-note" maxLength={300} placeholder="Note for this line (optional)" value={count.note}
              onChange={(event) => setLine(componentId, { note: event.target.value })} disabled={busy} />
          </div>
        );
      })}

      <div className="receipt-outcome" style={{ color: summary.uncounted ? "var(--muted)" : condition.color }}>
        {summary.uncounted
          ? `${summary.uncounted} line${summary.uncounted === 1 ? "" : "s"} still to count`
          : condition.text}
        {!summary.uncounted && summary.condition === "good" && dispatch.linkId && (
          <span className="faint" style={{ fontWeight: 400 }}> · link {dispatch.linkId} will move to Installing if the whole kit is here</span>
        )}
      </div>

      {summary.condition !== "good" && (
        <label className="faint" style={{ fontSize: 11 }}>
          What was damaged or short? *
          <textarea className="form-input" rows={2} maxLength={1000} value={discrepancyDetails}
            onChange={(event) => setDiscrepancyDetails(event.target.value)} style={{ display: "block", width: "100%", marginTop: 5 }} />
        </label>
      )}
      <label className="faint" style={{ fontSize: 11 }}>
        Receipt notes
        <textarea className="form-input" rows={2} maxLength={1000} value={notes}
          onChange={(event) => setNotes(event.target.value)} style={{ display: "block", width: "100%", marginTop: 5 }} />
      </label>
      <label className="faint" style={{ fontSize: 11 }}>
        Electronic signature (type your full name) *
        <input className="form-input" value={signature} maxLength={150}
          onChange={(event) => setSignature(event.target.value)} style={{ display: "block", width: "100%", marginTop: 5 }} />
      </label>
      {problem && <div role="alert" style={{ color: "var(--red)", fontSize: 12 }}><AlertTriangle size={13} /> {problem}</div>}
      <button type="button" className="btn amber sm" disabled={busy} onClick={submit}>
        {busy ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />} Confirm receipt of the whole dispatch
      </button>
    </div>
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
