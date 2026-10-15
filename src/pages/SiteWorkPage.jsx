import React, { Suspense, lazy } from "react";
import { Loader } from "lucide-react";
import { SiteWorkSubmissionForm } from "./SiteWorkSubmissionForm";
import { WorkerJobCards } from "./JobCards";
import { isAdmin, isSuperAdmin, isFieldWorker } from "../utils/access";

// The admin feed is its own chunk, fetched over the network only if this
// branch actually renders — a field_worker or client session never
// triggers this import, so that code never reaches their browser.
const SiteWorkAdminFeed = lazy(() =>
  import("./SiteWorkAdminFeed").then((m) => ({ default: m.SiteWorkAdminFeed }))
);

function ChunkLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", gap: "10px", color: "var(--muted)" }}>
      <Loader size={20} className="spin" style={{ color: "var(--teal)" }} />
      <span style={{ fontSize: "13px" }}>Loading...</span>
    </div>
  );
}

export function SiteWorkPage({ user }) {
  if (!isAdmin(user)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <SiteWorkSubmissionForm />
        {/* Job cards sent to this site worker's company. */}
        {isFieldWorker(user) && (
          <div style={{ maxWidth: "560px" }}>
            <WorkerJobCards />
          </div>
        )}
      </div>
    );
  }

  return (
    <Suspense fallback={<ChunkLoading />}>
      <SiteWorkAdminFeed canDelete={isSuperAdmin(user)} />
    </Suspense>
  );
}
