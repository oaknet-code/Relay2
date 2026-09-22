import React, { useState, useEffect } from "react";
import {
  Camera,
  Upload,
  Loader,
  AlertTriangle,
  CheckCircle2,
  X,
  User as UserIcon,
} from "lucide-react";
import { createSiteWork, getSiteWork, API_BASE_URL } from "../services/api";
import { isAdmin } from "../utils/access";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// imageUrls are relative paths served by the API origin (e.g.
// "/uploads/sitework/xyz.jpg"), not the frontend's own origin.
function imageSrc(relativeUrl) {
  return `${API_BASE_URL}${relativeUrl}`;
}

function SubmissionForm() {
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

function AdminFeed() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getSiteWork();
      setItems(data.siteWork || []);
    } catch (err) {
      setError(err.message || "Failed to load site work submissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>Site Work</h1>
        <p className="faint" style={{ fontSize: "13px", margin: "4px 0 0" }}>
          Progress reports submitted by field workers.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", gap: "10px", color: "var(--muted)" }}>
          <Loader size={20} className="spin" style={{ color: "var(--teal)" }} />
          <span style={{ fontSize: "13px" }}>Loading submissions...</span>
        </div>
      ) : error ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "200px", color: "var(--red)", gap: "12px",
        }}>
          <AlertTriangle size={24} />
          <span style={{ fontSize: "13px" }}>{error}</span>
          <button className="btn sm" onClick={load}>Retry</button>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "200px", color: "var(--faint)", gap: "12px",
        }}>
          <Camera size={32} />
          <span style={{ fontSize: "14px" }}>No submissions yet.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {items.map((item) => (
            <div
              key={item._id}
              style={{
                background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "12px", padding: "20px",
                display: "flex", flexDirection: "column", gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>{item.title}</h3>
                  {item.description && (
                    <p className="faint" style={{ fontSize: "13px", margin: "6px 0 0" }}>{item.description}</p>
                  )}
                </div>
                <span className="faint" style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{fmtDate(item.createdAt)}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)" }}>
                <UserIcon size={13} />
                <span>
                  {item.postedBy
                    ? `${item.postedBy.firstName || ""} ${item.postedBy.lastName || ""}`.trim() || item.postedBy.email
                    : "Unknown submitter"}
                  {item.postedBy?.email ? ` · ${item.postedBy.email}` : ""}
                </span>
              </div>

              {item.imageUrls?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {item.imageUrls.map((url) => (
                    <a key={url} href={imageSrc(url)} target="_blank" rel="noreferrer">
                      <img
                        src={imageSrc(url)}
                        alt={item.title}
                        style={{
                          width: 120, height: 120, objectFit: "cover",
                          borderRadius: "8px", border: "1px solid var(--line2)",
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteWorkPage({ user }) {
  return isAdmin(user) ? <AdminFeed /> : <SubmissionForm />;
}
