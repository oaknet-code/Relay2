// Offline-first helpers for Field Ops.
//
// Two jobs:
//  1. Persist the handheld's working state (pod) to localStorage per job,
//     so a page refresh / app relaunch while offline doesn't lose what
//     the engineer already entered.
//  2. Queue sync payloads locally when there's no connection, then flush
//     them to the server (in order) the moment connectivity returns.
//     Each queued entry carries a stable clientSyncId so a retried flush
//     upserts on the server instead of creating duplicate reports.

const POD_PREFIX = "relay_pod_";
const QUEUE_KEY = "relay_fieldops_queue";

export function makeSyncId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "sync-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

/** Load a previously-persisted pod state for this job, if any. */
export function loadPersistedPod(jobId) {
  try {
    const raw = localStorage.getItem(POD_PREFIX + jobId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Persist the current pod state for this job (called on every change). */
export function persistPod(jobId, pod) {
  try {
    localStorage.setItem(POD_PREFIX + jobId, JSON.stringify(pod));
  } catch {
    // localStorage full/unavailable — non-fatal, just means no offline persistence this session
  }
}

// Queue is keyed by jobId — at most one pending snapshot per job. If the
// engineer edits data and hits "Sync" again while still offline, it just
// overwrites the queued snapshot (and keeps the same clientSyncId) rather
// than piling up duplicate entries.
function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore — localStorage full/unavailable, non-fatal
  }
}

/** Queue (or replace) the pending sync snapshot for a job. */
export function enqueueSync(jobId, clientSyncId, payload) {
  const queue = readQueue();
  queue[jobId] = { clientSyncId, payload, queuedAt: new Date().toISOString() };
  writeQueue(queue);
}

/** The clientSyncId already queued for this job, if any — reuse it so edits upsert the same report. */
export function getQueuedSyncId(jobId) {
  const queue = readQueue();
  return queue[jobId]?.clientSyncId || null;
}

/** How many jobs have a pending (unsynced) snapshot queued. */
export function pendingCount(jobId) {
  const queue = readQueue();
  return jobId ? (queue[jobId] ? 1 : 0) : Object.keys(queue).length;
}

/**
 * Attempts to send every queued job snapshot via syncFn(jobId, payload).
 * Entries that succeed are removed; entries that fail (still offline,
 * server error) stay queued for the next attempt. Returns
 * { succeeded, failed } counts.
 */
export async function flushQueue(syncFn) {
  const queue = readQueue();
  const jobIds = Object.keys(queue);
  if (!jobIds.length) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;

  for (const jobId of jobIds) {
    const entry = queue[jobId];
    try {
      await syncFn(jobId, { ...entry.payload, clientSyncId: entry.clientSyncId });
      delete queue[jobId];
      succeeded++;
    } catch {
      failed++; // leave it queued, try again next time
    }
  }

  writeQueue(queue);
  return { succeeded, failed };
}
