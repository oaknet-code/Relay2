import axios from "axios";

// Base URL from environment variable or fallback to local development
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Create an Axios instance with base configuration
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Automatically attach JWT token to headers if available
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: on 401 (invalid/expired token, or account
// suspended/deleted), clear the stale token and bounce back to login
// rather than leaving the user stuck looking at a generic error.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (typeof window !== "undefined") window.location.reload();
    }
    return Promise.reject(error);
  },
);

/**
 * Real login handler targeting your backend database
 */
export const loginUser = async (credentials) => {
  try {
    const response = await axiosInstance.post("/api/auth/login", {
      email: credentials.email || credentials.username,
      password: credentials.password,
    });

    const { token, user } = response.data;

    // Save JWT token only (no user data)
    if (token) localStorage.setItem("token", token);
    // Remove user object from localStorage - don't expose PII
    localStorage.removeItem("user");

    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      "Login failed. Please check your credentials.";
    throw new Error(message);
  }
};

// Aliased export for compatibility
export const login = loginUser;

/**
 * Change Password
 */
export const changePassword = async (passwordData) => {
  try {
    const { data } = await axiosInstance.put("/api/auth/change-password", {
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message || "Failed to change password";
    throw new Error(message);
  }
};

/**
 * Site Kits
 */
export const getSiteKits = async () => {
  const { data } = await axiosInstance.get("/api/sitekits");
  return data;
};

export const getSiteKit = async (kitId) => {
  const { data } = await axiosInstance.get(`/api/sitekits/${kitId}`);
  return data;
};

// file: a browser File object from an <input type="file">
export const importSiteKitsExcel = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await axiosInstance.post("/api/sitekits/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

/**
 * Dispatch — decrements the matching Site Kit's component availability
 * server-side and records a waybill.
 */
export const createDispatch = async (payload) => {
  const { data } = await axiosInstance.post("/api/dispatch", payload);
  return data;
};

// Look up existing dispatches, e.g. to check whether a link has already
// been dispatched (so a page refresh doesn't lose that state).
export const getDispatches = async ({ kitId, linkId } = {}) => {
  const params = {};
  if (kitId) params.kitId = kitId;
  if (linkId) params.linkId = linkId;
  const { data } = await axiosInstance.get("/api/dispatch", { params });
  return data;
};

/**
 * Field Ops — offline-safe sync. Always pass a stable clientSyncId
 * (generated once when the entry is captured, even offline) so retried
 * or queued syncs upsert instead of duplicating on the server.
 */
export const syncFieldOps = async (jobId, payload) => {
  const { data } = await axiosInstance.post("/api/fieldops/sync", {
    jobId,
    ...payload,
  });
  return data;
};

export const getFieldOpsReports = async (jobId) => {
  const { data } = await axiosInstance.get(`/api/fieldops/${jobId}`);
  return data;
};

/**
 * Inventory — Assets
 */
export const getAssets = async (params = {}) => {
  const { data } = await axiosInstance.get("/api/inventory/assets", { params });
  return data;
};

export const getAsset = async (id) => {
  const { data } = await axiosInstance.get(`/api/inventory/assets/${id}`);
  return data;
};

export const createAsset = async (payload) => {
  const { data } = await axiosInstance.post("/api/inventory/assets", payload);
  return data;
};

export const updateAsset = async (id, payload) => {
  const { data } = await axiosInstance.put(`/api/inventory/assets/${id}`, payload);
  return data;
};

export const updateAssetStatus = async (id, status, reason) => {
  const { data } = await axiosInstance.patch(`/api/inventory/assets/${id}/status`, {
    status,
    reason,
  });
  return data;
};

export const deleteAsset = async (id) => {
  const { data } = await axiosInstance.delete(`/api/inventory/assets/${id}`);
  return data;
};

export const getAssetAudit = async (id) => {
  const { data } = await axiosInstance.get(`/api/inventory/assets/${id}/audit`);
  return data;
};

/**
 * Inventory — Consumables
 */
export const getConsumables = async (params = {}) => {
  const { data } = await axiosInstance.get("/api/inventory/consumables", { params });
  return data;
};

export const createConsumable = async (payload) => {
  const { data } = await axiosInstance.post("/api/inventory/consumables", payload);
  return data;
};

export const updateConsumable = async (id, payload) => {
  const { data } = await axiosInstance.put(`/api/inventory/consumables/${id}`, payload);
  return data;
};

export const restockConsumable = async (id, delta) => {
  const { data } = await axiosInstance.patch(`/api/inventory/consumables/${id}/stock`, {
    delta,
  });
  return data;
};

/**
 * Links
 */
export const getLinks = async (params = {}) => {
  const { data } = await axiosInstance.get("/api/links", { params });
  return data;
};

export const getLink = async (linkId) => {
  const { data } = await axiosInstance.get(`/api/links/${linkId}`);
  return data;
};

export const createLink = async (payload) => {
  const { data } = await axiosInstance.post("/api/links", payload);
  return data;
};

export const updateLink = async (linkId, payload) => {
  const { data } = await axiosInstance.put(`/api/links/${linkId}`, payload);
  return data;
};

export const updateLinkStatus = async (linkId, status) => {
  const { data } = await axiosInstance.patch(`/api/links/${linkId}/status`, { status });
  return data;
};

export const deleteLink = async (linkId) => {
  const { data } = await axiosInstance.delete(`/api/links/${linkId}`);
  return data;
};

/**
 * Site Kits — new write operations
 */
export const createSiteKit = async (payload) => {
  const { data } = await axiosInstance.post("/api/sitekits", payload);
  return data;
};

export const updateSiteKit = async (kitId, payload) => {
  const { data } = await axiosInstance.put(`/api/sitekits/${kitId}`, payload);
  return data;
};

export const deleteSiteKit = async (kitId) => {
  const { data } = await axiosInstance.delete(`/api/sitekits/${kitId}`);
  return data;
};

export const allocateSiteKit = async (kitId) => {
  const { data } = await axiosInstance.post(`/api/sitekits/${kitId}/allocate`);
  return data;
};

/**
 * Staging
 */
export const listStaging = async (params = {}) => {
  const { data } = await axiosInstance.get("/api/staging", { params });
  return data;
};

export const listAwaitingStaging = async (params = {}) => {
  const { data } = await axiosInstance.get("/api/staging/awaiting", { params });
  return data;
};

export const checkInKit = async (kitId) => {
  const { data } = await axiosInstance.post(`/api/staging/${kitId}/checkin`);
  return data;
};

export const updateQA = async (stagingRecordId, qaData) => {
  const { data } = await axiosInstance.patch(
    `/api/staging/${stagingRecordId}/qa`,
    qaData
  );
  return data;
};

export const completeStaging = async (stagingRecordId) => {
  const { data } = await axiosInstance.post(
    `/api/staging/${stagingRecordId}/complete`
  );
  return data;
};

/**
 * Gate Pass (Dispatch)
 */
export const getGatePass = async (dispatchId) => {
  const { data } = await axiosInstance.get(`/api/dispatch/${dispatchId}/gatepass`);
  return data;
};

/**
 * Logout - Clear all stored credentials
 */
export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user"); // Already removed by login, but ensure it's gone
  localStorage.removeItem("relay_clients");
  localStorage.removeItem("relay_kits");
};

// Export full API interface wrapper
export const api = {
  login: loginUser,
  logout,
  changePassword,
  get: (endpoint, config) => axiosInstance.get(endpoint, config),
  post: (endpoint, payload, config) =>
    axiosInstance.post(endpoint, payload, config),
  put: (endpoint, payload, config) =>
    axiosInstance.put(endpoint, payload, config),
  delete: (endpoint, config) => axiosInstance.delete(endpoint, config),
  // Assets
  getAssets,
  getAsset,
  createAsset,
  updateAsset,
  updateAssetStatus,
  deleteAsset,
  getAssetAudit,
  // Consumables
  getConsumables,
  createConsumable,
  updateConsumable,
  restockConsumable,
  // Links
  getLinks,
  getLink,
  createLink,
  updateLink,
  updateLinkStatus,
  deleteLink,
  // Site Kits
  getSiteKits,
  getSiteKit,
  createSiteKit,
  updateSiteKit,
  deleteSiteKit,
  allocateSiteKit,
  importSiteKitsExcel,
  // Staging
  listStaging,
  listAwaitingStaging,
  checkInKit,
  updateQA,
  completeStaging,
  // Dispatch
  createDispatch,
  getDispatches,
  getGatePass,
  // Field Ops
  syncFieldOps,
  getFieldOpsReports,
};

export default api;
