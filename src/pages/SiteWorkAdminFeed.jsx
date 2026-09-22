import React, { useState, useEffect } from "react";
import { Camera, Loader, AlertTriangle, User as UserIcon } from "lucide-react";
import { getSiteWork, API_BASE_URL } from "../services/api";

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

// Admin-only feed — deliberately its own module so it can be lazy-loaded
// (see SiteWorkPage.jsx). A non-admin session should never fetch this
// chunk's JS at all, let alone call GET /api/site-work (the backend
// enforces that independently regardless of what the client requests).
export function SiteWorkAdminFeed() {
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
