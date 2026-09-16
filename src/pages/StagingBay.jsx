import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { listAwaitingStaging, listStaging, checkInKit, updateQA, completeStaging } from '../services/api';

const QA_TESTS = [
  { name: "Firmware Check", key: "firmware" },
  { name: "Frequency Set", key: "frequency" },
  { name: "IP Config", key: "ip" },
  { name: "Bench Test", key: "bench" },
];

export function StagingBay() {
  const [awaiting, setAwaiting] = useState([]);
  const [staging, setStaging] = useState([]);
  const [activeKit, setActiveKit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [awaitingData, stagingData] = await Promise.all([
        listAwaitingStaging(),
        listStaging(),
      ]);
      setAwaiting(awaitingData);
      setStaging(stagingData.filter(s => s.status !== "STAGED"));
    } catch (err) {
      setError("Failed to load staging data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCheckIn = async (kit) => {
    try {
      const stagingRecord = await checkInKit(kit.kitId);
      setActiveKit(stagingRecord);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Check-in failed");
    }
  };

  const handleCompleteStaging = async () => {
    if (!activeKit) return;
    try {
      await completeStaging(activeKit._id);
      setActiveKit(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Staging completion failed");
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
        <div>Loading staging data…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="view-head">
        <span className="tagchip">
          <ShieldCheck size={11} />
          Step 2 · Staging & QA
        </span>
        <h2>Staging Bay</h2>
        <p>
          Configure and test equipment before dispatch. Check in a kit, run QA checklist, and mark as staged.
        </p>
      </div>

      {error && (
        <div style={{
          marginBottom: 20,
          padding: "12px 14px",
          background: "rgba(255,90,90,.1)",
          border: "1px solid rgba(255,90,90,.25)",
          borderRadius: 10,
          color: "var(--red)",
          fontSize: 13,
          display: "flex",
          gap: 8,
          alignItems: "center"
        }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!activeKit && (
        <div>
          <h3 style={{ marginBottom: 16 }}>Kits Awaiting Staging</h3>
          {awaiting.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: 40, color: "var(--faint)" }}>
              No kits awaiting staging
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))" }}>
              {awaiting.map(kit => (
                <div key={kit._id} className="panel">
                  <div className="panel-h">
                    <div>
                      <h3>{kit.kitId}</h3>
                      <div className="faint" style={{ fontSize: 11 }}>{kit.name}</div>
                    </div>
                  </div>
                  <div className="panel-b">
                    <div style={{ marginBottom: 12, fontSize: 12 }}>
                      <strong>{kit.components?.length || 0}</strong> components
                    </div>
                    <button
                      className="btn teal"
                      onClick={() => handleCheckIn(kit)}
                      style={{ width: "100%" }}
                    >
                      Check In for Staging
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeKit && (
        <div className="panel" style={{ maxWidth: 600 }}>
          <div className="panel-h">
            <div>
              <h3>QA Checklist — {activeKit.kitId}</h3>
              <div className="faint" style={{ fontSize: 11 }}>Checked in by staging team</div>
            </div>
          </div>
          <div className="panel-b">
            <div style={{ marginBottom: 16 }}>
              {QA_TESTS.map(test => (
                <label key={test.key} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    defaultChecked={false}
                    style={{ cursor: "pointer" }}
                  />
                  <span>{test.name}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn teal"
                onClick={handleCompleteStaging}
                style={{ flex: 1 }}
              >
                Complete Staging
              </button>
              <button
                className="btn"
                onClick={() => setActiveKit(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {staging.length > 0 && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-h">
            <CheckCircle2 size={15} style={{ color: "var(--teal)" }} />
            <h3>In Progress</h3>
          </div>
          <div className="panel-b">
            {staging.map(record => (
              <div
                key={record._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--line)"
                }}
              >
                <span>{record.kitId}</span>
                <span style={{ fontSize: 11, color: "var(--faint)" }}>
                  {record.status === "CHECKED_IN" ? "Checked In" : "QA In Progress"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}