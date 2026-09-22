import React, { useState } from "react";
import {
  Camera,
  Upload,
  Loader,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { createSiteWork } from "../services/api";

// Field worker's submission form. Kept in its own module (not lazy) since
// every non-admin session that reaches Site Work needs it — splitting it
// out separately is what lets SiteWorkAdminFeed.jsx be lazy-loaded on its
// own without dragging this in too.
export function SiteWorkSubmissionForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files || []));
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (files.length === 0) {
      setError("Attach at least one photo.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createSiteWork({ title, description, images: files });
      setSuccess(true);
      setTitle("");
      setDescription("");
      setFiles([]);
    } catch (err) {
      setError(err.message || "Failed to submit progress report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "560px" }}>
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>Site Work</h1>
        <p className="faint" style={{ fontSize: "13px", margin: "4px 0 0" }}>
          Submit a progress report with photos from the field.
        </p>
      </div>

      {success && (
        <div style={{
          padding: "12px", background: "rgba(51, 220, 174, 0.1)", border: "1px solid rgba(51, 220, 174, 0.3)",
          borderRadius: "8px", color: "var(--teal)", fontSize: "13px", display: "flex", gap: "8px", alignItems: "center",
        }}>
          <CheckCircle2 size={16} />
          <span>Submitted. Thanks — your update is on its way to the team.</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex", flexDirection: "column", gap: "16px",
          background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "12px", padding: "24px",
        }}
      >
        {error && (
          <div style={{
            padding: "12px", background: "rgba(255, 95, 95, 0.1)", border: "1px solid rgba(255, 95, 95, 0.3)",
            borderRadius: "8px", color: "var(--red)", fontSize: "13px", display: "flex", gap: "8px", alignItems: "flex-start",
          }}>
            <AlertTriangle size={16} style={{ marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
            Title *
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Trench excavation complete — Summit North"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
            Description
          </label>
          <textarea
            className="form-input"
            rows={4}
            placeholder="What's been done, any blockers, what's next..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
            Photos *
          </label>
          <label
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              border: "1px dashed var(--line2)", borderRadius: "8px", padding: "20px",
              cursor: "pointer", color: "var(--muted)", fontSize: "13px",
            }}
          >
            <Upload size={16} />
            Tap to choose photos
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>

          {files.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    background: "var(--bg)", border: "1px solid var(--line2)", borderRadius: "8px",
                    padding: "6px 10px", fontSize: "12px", color: "var(--ink)",
                  }}
                >
                  <Camera size={13} style={{ color: "var(--muted)" }} />
                  <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn amber"
          style={{ justifyContent: "center" }}
        >
          {isSubmitting ? <Loader size={14} className="spin" /> : <Upload size={15} />}
          {isSubmitting ? "Submitting…" : "Submit Progress Report"}
        </button>
      </form>
    </div>
  );
}
