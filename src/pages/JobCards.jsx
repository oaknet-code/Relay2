import React, { useState, useEffect } from "react";
import { FileText, Loader, Loader2, AlertTriangle, Download, Trash2, Building2, ClipboardList } from "lucide-react";
import { getJobCards, jobCardFileUrl } from "../services/api";

// Job cards: PDFs that admins / super admins send to a contractor — a
// company that has site workers registered under it. Those site workers
// see their company's cards on their Site Work page. The backend enforces
// who can send and who can see each card; this only controls the UI.

// Shared by site workers (WorkerJobCards, below) and the admin view
// (AdminJobCards.jsx, lazy-loaded with the admin feed so the send form never
// reaches a site worker's browser).

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function ErrorNote({ children }) {
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

function JobCardRow({ card, showCompany, onDelete, deleting }) {
  const sender = card.sentBy ? `${card.sentBy.firstName || ""} ${card.sentBy.lastName || ""}`.trim() : "";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px",
      borderTop: "1px solid var(--line)",
    }}>
      <FileText size={22} style={{ color: "var(--muted)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis" }}>{card.title}</div>
        {card.notes && <div className="faint" style={{ fontSize: "13px", marginTop: 4, whiteSpace: "pre-wrap" }}>{card.notes}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: "12px", color: "var(--muted)", marginTop: 6 }}>
          {showCompany && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Building2 size={12} /> {card.company}
            </span>
          )}
          <span>{fmtDate(card.createdAt)}</span>
          {sender && <span>Sent by {sender}</span>}
        </div>
      </div>
      <a className="btn sm" href={jobCardFileUrl(card._id)} title={`Download ${card.fileName}`}>
        <Download size={14} />
        PDF
      </a>
      {onDelete && (
        <button
          className="btn sm"
          title="Delete job card"
          aria-label={`Delete job card ${card.title}`}
          disabled={deleting}
          onClick={() => onDelete(card)}
          style={{ color: "var(--red)", borderColor: "rgba(255,95,95,.35)" }}
        >
          {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
        </button>
      )}
    </div>
  );
}

export function JobCardList({ title, cards, emptyText, showCompany, onDelete, deletingId, headerExtra }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 16px" }}>
        <ClipboardList size={16} style={{ color: "var(--muted)" }} />
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", flex: 1 }}>{title}</h3>
        {headerExtra}
      </div>
      {cards.length === 0 ? (
        <div className="faint" style={{ fontSize: "13px", padding: "14px 16px", borderTop: "1px solid var(--line)" }}>{emptyText}</div>
      ) : (
        cards.map((card) => (
          <JobCardRow
            key={card._id}
            card={card}
            showCompany={showCompany}
            onDelete={onDelete}
            deleting={deletingId === card._id}
          />
        ))
      )}
    </div>
  );
}

export function useJobCards() {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getJobCards();
      setCards(data.jobCards || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { cards, setCards, isLoading, error, load };
}

// Site worker: the job cards sent to their company.
export function WorkerJobCards() {
  const { cards, isLoading, error, load } = useJobCards();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--muted)", fontSize: "13px" }}>
        <Loader size={16} className="spin" style={{ color: "var(--teal)" }} /> Loading job cards...
      </div>
    );
  }
  if (error) {
    return (
      <ErrorNote>
        {error} <button className="btn sm" onClick={load} style={{ marginLeft: 8 }}>Retry</button>
      </ErrorNote>
    );
  }
  return (
    <JobCardList
      title="Your Job Cards"
      cards={cards}
      emptyText="No job cards have been sent to your company yet."
    />
  );
}
