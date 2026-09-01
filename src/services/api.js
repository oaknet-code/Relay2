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

    // Save authentic credentials and JWT token to local storage
    if (token) localStorage.setItem("token", token);
    if (user) localStorage.setItem("user", JSON.stringify(user));

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

// Export full API interface wrapper
export const api = {
  login: loginUser,
  get: (endpoint, config) => axiosInstance.get(endpoint, config),
  post: (endpoint, payload, config) =>
    axiosInstance.post(endpoint, payload, config),
  put: (endpoint, payload, config) =>
    axiosInstance.put(endpoint, payload, config),
  delete: (endpoint, config) => axiosInstance.delete(endpoint, config),
  getSiteKits,
  getSiteKit,
  importSiteKitsExcel,
  createDispatch,
  getDispatches,
  syncFieldOps,
  getFieldOpsReports,
};

export default api;
