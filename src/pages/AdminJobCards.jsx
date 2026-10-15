import React, { useState, useEffect } from "react";
import { FileText, Upload, Loader, CheckCircle2, X } from "lucide-react";
import { getJobCardContractors, createJobCard, deleteJobCard } from "../services/api";
import { ErrorNote, JobCardList, useJobCards } from "./JobCards";

// Admin / super admin side of job cards (see JobCards.jsx). Imported only
// by SiteWorkAdminFeed.jsx, which is lazy-loaded for admins.

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const isPdfFile = (file) => file.name.toLowerCase().endsWith(".pdf") && file.type === "application/pdf";

const labelStyle = { display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" };

// Admin / super admin form: pick a contractor, give the card a title,
// attach one PDF.
function AddJobCardForm({ onSent, onCancel }) {
  const [contractors, setContractors] = useState([]);
  const [loadingContractors, setLoadingContractors] = useState(true);
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getJobCardContractors()
      .then((data) => { if (!cancelled) setContractors(data.contractors || []); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoadingContractors(false); });
    return () => { cancelled = true; };
  }, []);

  const handleFileChange = (e) => {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    if (!isPdfFile(chosen)) {
      setError(`${chosen.name}: only PDF job cards are accepted.`);
      return;
    }
    if (chosen.size > MAX_PDF_BYTES) {
      setError(`${chosen.name}: larger than 5 MB.`);
      return;
    }
    setError("");
    setFile(chosen);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!company) return setError("Choose a contractor.");
    if (!title.trim()) return setError("Title is required.");
    if (!file) return setError("Attach the job card as a PDF.");

    setIsSending(true);
    try {
      const data = await createJobCard({ title: title.trim(), notes: notes.trim(), company, file });
      onSent(data.jobCard);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex", flexDirection: "column", gap: "16px",
        background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "12px", padding: "24px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>New Job Card</h3>
        <button type="button" className="btn sm ghost" onClick={onCancel} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div>
        <label style={labelStyle} htmlFor="jc-company">Contractor *</label>
        <select
          id="jc-company"
          className="form-input"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          disabled={loadingContractors}
          required
        >
          <option value="">
            {loadingContractors
              ? "Loading contractors…"
              : contractors.length
                ? "Select a contractor"
                : "No contractors yet — register site workers with a company first"}
          </option>
          {contractors.map((c) => (
            <option key={c.company} value={c.company}>
              {c.company} ({c.workers} site worker{c.workers === 1 ? "" : "s"})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle} htmlFor="jc-title">Title *</label>
        <input
          id="jc-title"
          type="text"
          className="form-input"
          placeholder="e.g. Fibre splicing — Summit North to Lamu Town"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
        />
      </div>

      <div>
        <label style={labelStyle} htmlFor="jc-notes">Notes</label>
        <textarea
          id="jc-notes"
          className="form-input"
          rows={3}
          placeholder="Instructions, deadlines, contacts..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      <div>
        <label style={labelStyle}>Job Card PDF *</label>
        {file ? (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "var(--bg)", border: "1px solid var(--line2)", borderRadius: "8px",
            padding: "10px 12px", fontSize: "13px", color: "var(--ink)",
          }}>
            <FileText size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Remove file"
              style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              border: "1px dashed var(--line2)", borderRadius: "8px", padding: "20px",
              cursor: "pointer", color: "var(--muted)", fontSize: "13px",
            }}
          >
            <Upload size={16} />
            Choose the job card (PDF only · max 5 MB)
            <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} style={{ display: "none" }} />
          </label>
        )}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button type="submit" className="btn amber" disabled={isSending} style={{ flex: 1, justifyContent: "center" }}>
          {isSending ? <Loader size={14} className="spin" /> : <Upload size={15} />}
          {isSending ? "Sending…" : "Send Job Card"}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={isSending}>Cancel</button>
      </div>
    </form>
  );
}

// Admin / super admin: the form (opened by the "Add Job Card" button in the
// Site Work header) and every card sent so far, filterable by contractor.
export function AdminJobCards({ formOpen, onCloseForm }) {
  const { cards, setCards, isLoading, error, load } = useJobCards();
  const [filter, setFilter] = useState("all");
  const [sentNote, setSentNote] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const handleSent = (card) => {
    setCards((prev) => [card, ...prev]);
    setSentNote(`Job card "${card.title}" sent to ${card.company}.`);
    onCloseForm();
    load(); // picks up the sender's name
  };

  const handleDelete = async (card) => {
    if (!window.confirm(`Delete job card "${card.title}" sent to ${card.company}? Their site workers will no longer see it.`)) return;
    setDeletingId(card._id);
    setDeleteError("");
    try {
      await deleteJobCard(card._id);
      setCards((prev) => prev.filter((c) => c._id !== card._id));
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const companies = [...new Set(cards.map((c) => c.company))].sort((a, b) => a.localeCompare(b));
  const shown = filter === "all" ? cards : cards.filter((c) => c.company === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {formOpen && <AddJobCardForm onSent={handleSent} onCancel={onCloseForm} />}

      {sentNote && !formOpen && (
        <div style={{
          padding: "12px", background: "rgba(51, 220, 174, 0.1)", border: "1px solid rgba(51, 220, 174, 0.3)",
          borderRadius: "8px", color: "var(--teal)", fontSize: "13px", display: "flex", gap: "8px", alignItems: "center",
        }}>
          <CheckCircle2 size={16} />
          <span>{sentNote}</span>
        </div>
      )}

      {deleteError && <ErrorNote>{deleteError}</ErrorNote>}

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--muted)", fontSize: "13px" }}>
          <Loader size={16} className="spin" style={{ color: "var(--teal)" }} /> Loading job cards...
        </div>
      ) : error ? (
        <ErrorNote>
          {error} <button className="btn sm" onClick={load} style={{ marginLeft: 8 }}>Retry</button>
        </ErrorNote>
      ) : (
        <JobCardList
          title={`Job Cards Sent (${cards.length})`}
          cards={shown}
          emptyText={cards.length ? "No job cards for this contractor." : "No job cards sent yet. Use “Add Job Card” to send one."}
          showCompany
          onDelete={handleDelete}
          deletingId={deletingId}
          headerExtra={companies.length > 1 && (
            <select
              className="form-input"
              style={{ width: 200, padding: "6px 10px", fontSize: "12px" }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter by contractor"
            >
              <option value="all">All contractors</option>
              {companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        />
      )}
    </div>
  );
}

