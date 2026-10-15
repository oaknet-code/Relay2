import React, { useState, useEffect } from "react";
import { Camera, FileText, FilePlus, Loader, Loader2, AlertTriangle, Trash2, X, User as UserIcon } from "lucide-react";
import { getSiteWork, deleteSiteWork, deleteSiteWorkImage, API_BASE_URL } from "../services/api";
import { AdminJobCards } from "./AdminJobCards";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// imageUrls are relative paths served by the API origin (e.g.
// "/media/site-work/<id>", stored in MongoDB), not the frontend's own
// origin. The session cookie rides along with the <img> request.
function imageSrc(relativeUrl) {
  return `${API_BASE_URL}${relativeUrl}`;
}

// Admin-only feed — deliberately its own module so it can be lazy-loaded
// (see SiteWorkPage.jsx). A non-admin session should never fetch this
// chunk's JS at all, let alone call GET /api/site-work (the backend
// enforces that independently regardless of what the client requests).
// `canDelete`: super admins only (admins see the feed read-only).
export function SiteWorkAdminFeed({ canDelete = false }) {
  const [items, setItems] = useState([]);
  // url -> stored content type; PDFs are new reports, anything else an older photo.
  const [contentTypes, setContentTypes] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // "Add Job Card" — open to admins and super admins alike.
  const [jobCardFormOpen, setJobCardFormOpen] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getSiteWork();
      setItems(data.siteWork || []);
      setContentTypes(data.contentTypes || {});
    } catch (err) {
      setError(err.message || "Failed to load site work submissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Key of the report or photo currently being deleted, to disable its button.
  const [deletingKey, setDeletingKey] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteReport = async (item) => {
    if (!window.confirm(`Delete "${item.title}" and all ${item.imageUrls?.length || 0} file(s)? This can't be undone.`)) return;
    setDeletingKey(item._id);
    setDeleteError("");
    try {
      await deleteSiteWork(item._id);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteImage = async (item, url) => {
    const isLast = item.imageUrls.length === 1;
    const prompt = isLast
      ? `This is the only file in "${item.title}" — deleting it deletes the whole submission. Continue?`
      : "Delete this file? This can't be undone.";
    if (!window.confirm(prompt)) return;

    const imageId = url.split("/").pop();
    setDeletingKey(url);
    setDeleteError("");
    try {
      const data = await deleteSiteWorkImage(item._id, imageId);
      setItems((prev) =>
        data.deletedReport
          ? prev.filter((i) => i._id !== item._id)
          : prev.map((i) => (i._id === item._id ? { ...i, imageUrls: i.imageUrls.filter((u) => u !== url) } : i)),
      );
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>Site Work</h1>
          <p className="faint" style={{ fontSize: "13px", margin: "4px 0 0" }}>
            Progress reports submitted by field workers, and job cards sent to contractors.
          </p>
        </div>
        <button className="btn amber" onClick={() => setJobCardFormOpen(true)} disabled={jobCardFormOpen}>
          <FilePlus size={15} />
          Add Job Card
        </button>
      </div>

      <AdminJobCards formOpen={jobCardFormOpen} onCloseForm={() => setJobCardFormOpen(false)} />

      <h2 style={{ fontSize: "16px", fontWeight: "600", margin: "8px 0 0" }}>Progress Reports</h2>

      {deleteError && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--red)" }}>
          <AlertTriangle size={14} />
          <span>{deleteError}</span>
        </div>
      )}

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
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="faint" style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{fmtDate(item.createdAt)}</span>
                  {canDelete && (
                  <button
                    className="btn sm"
                    title="Delete submission"
                    aria-label={`Delete submission ${item.title}`}
                    disabled={deletingKey !== null}
                    onClick={() => handleDeleteReport(item)}
                    style={{ color: "var(--red)", borderColor: "rgba(255,95,95,.35)" }}
                  >
                    {deletingKey === item._id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    Delete
                  </button>
                  )}
                </div>
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
                    <div key={url} style={{ position: "relative" }}>
                      {contentTypes[url] === "application/pdf" ? (
                        // Served as a download (see getImage on the backend).
                        <a
                          href={imageSrc(url)}
                          title="Download PDF report"
                          style={{
                            width: 120, height: 120, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: "6px",
                            borderRadius: "8px", border: "1px solid var(--line2)", background: "var(--bg)",
                            color: "var(--muted)", fontSize: "12px", textDecoration: "none",
                          }}
                        >
                          <FileText size={32} />
                          <span>PDF report</span>
                        </a>
                      ) : (
                      <a href={imageSrc(url)} target="_blank" rel="noreferrer">
                        <img
                          src={imageSrc(url)}
                          alt={item.title}
                          style={{
                            width: 120, height: 120, objectFit: "cover",
                            borderRadius: "8px", border: "1px solid var(--line2)",
                          }}
                        />
                      </a>
                      )}
                      {canDelete && (
                      <button
                        className="photo-del"
                        title="Delete file"
                        aria-label="Delete file"
                        disabled={deletingKey !== null}
                        onClick={() => handleDeleteImage(item, url)}
                        style={{
                          position: "absolute", top: 6, right: 6, width: 24, height: 24,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          borderRadius: "50%", border: "1px solid rgba(255,255,255,.2)",
                          background: "rgba(10,14,20,.8)", color: "#fff", cursor: "pointer", padding: 0,
                        }}
                      >
                        {deletingKey === url ? <Loader2 size={12} className="spin" /> : <X size={12} />}
                      </button>
                      )}
                    </div>
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
